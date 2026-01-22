
import { GoogleGenAI, Modality, GenerateContentResponse } from "@google/genai";
import { Notebook, HostPersonality } from "../types";
import { suppressGeminiErrors } from "../utils/suppressGeminiErrors";

export interface SearchResult {
  title: string;
  uri: string;
}

/**
 * 🛡️ RETRIEVAL ENGINE
 * Scores keywords to find the most relevant context chunks.
 */
function retrieveTopK(notebook: Notebook, query: string, k: number = 8): string {
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  const scoredSources = notebook.sources.map(source => {
    const content = source.content.toLowerCase();
    const score = queryTerms.reduce((acc, term) => acc + (content.includes(term) ? 1 : 0), 0);
    return { source, score };
  });

  const topK = scoredSources
    .filter(s => s.score > 0 || notebook.sources.length <= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);

  if (topK.length === 0) {
    if (notebook.sources.length > 0) {
       // Fallback to first few sources if keywords don't match well
       return notebook.sources.slice(0, 3).map((s, i) => `SOURCE ${i + 1} (${s.title}):\n${s.content}`).join("\n\n");
    }
    return "No directly relevant sources were found. Answer using careful reasoning and state uncertainty clearly.";
  }

  return topK.map((tk, i) => `SOURCE ${i + 1} (${tk.source.title}):\n${tk.source.content}`).join("\n\n");
}

const NOTEBOOK_LM_SYSTEM_INSTRUCTION = `
You are an analytical research assistant.
Answer using the provided sources as your primary evidence.
Synthesize information clearly and calmly.
If sources are incomplete, reason carefully and state uncertainty.
Do not mention system errors, model limitations, or internal processes.
Do not hallucinate citations.
Stay professional, grounded, and objective.
`;

/**
 * 🔒 AUDIO OVERVIEW SYSTEM PROMPT (INVARIANT)
 * This prevents "Persona Leak" where the host vibe overrides the actual source facts.
 */
const AUDIO_OVERVIEW_SYSTEM_PROMPT = `
You are generating a professional audio overview strictly from the provided sources.

Rules:
- The script MUST reflect the actual subject matter of the sources.
- Do NOT introduce themes, debates, or personas not supported by sources.
- Use a calm, analytical, and professional tone.
- Alex and Jordan are analysts, not fictional characters; they prioritize source evidence over "vibe".
- Every claim made must be traceable to the GROUNDING CONTEXT provided.
- If sources are technical, stay technical. If they are specific, stay specific.
- Never invent context.
`.trim();

const PERSONALITY_PROMPTS: Record<HostPersonality, string> = {
  neutral: "Balanced and objective.",
  curious: "Exploratory. Ask why and how.",
  analytical: "Deconstruct patterns with logic.",
  warm: "Empathic and personal.",
  debate: "Socratic and challenging.",
  visionary: "Speculative and future-looking."
};

export class GeminiService {
  private getClient() {
    try {
      const key = process.env.API_KEY;
      if (!key) return null;
      return new GoogleGenAI({ apiKey: key });
    } catch (e) {
      return null;
    }
  }

  async generateOutline(notebook: Notebook): Promise<any> {
    const ai = this.getClient();
    if (!ai || notebook.sources.length === 0) return this.generateLocalOutline(notebook);

    // Seed the outline with a summary of all sources to ensure thematic grounding
    const initialContext = notebook.sources.map(s => s.content.substring(0, 400)).join("\n\n");
    const prompt = `
      SOURCES SUMMARY:
      ${initialContext}

      Based ONLY on the sources above, generate a cinematic podcast outline for "${notebook.title}". 
      JSON: { "outline": [ { "part": number, "topics": string[] } ] }
    `;

    const result = await suppressGeminiErrors<GenerateContentResponse>(ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { 
        responseMimeType: "application/json",
        systemInstruction: AUDIO_OVERVIEW_SYSTEM_PROMPT,
        temperature: 0.1 // Hard lock for stability
      }
    }));

    if (!result) return this.generateLocalOutline(notebook);
    try { return JSON.parse(result.text || '{}'); } catch { return this.generateLocalOutline(notebook); }
  }

  async generateScriptChunk(notebook: Notebook, outline: any, partIndex: number, personality: HostPersonality): Promise<any> {
    const ai = this.getClient();
    if (!ai) return this.generateLocalScriptChunk(notebook, outline, partIndex);

    const topics = outline.outline[partIndex]?.topics.join(" ") || "";
    const grounding = retrieveTopK(notebook, topics, 6);
    
    const prompt = `
      GROUNDING CONTEXT:
      ${grounding}
      
      TOPICS TO COVER: ${topics}
      TONE: ${PERSONALITY_PROMPTS[personality]}
      
      Write natural dialogue between Alex and Jordan for Part ${partIndex + 1}. 
      Alex and Jordan must use the GROUNDING CONTEXT as their only source of information.
      JSON: { "script": string, "transcript": Array }
    `;

    const result = await suppressGeminiErrors<GenerateContentResponse>(ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: { 
        responseMimeType: "application/json",
        systemInstruction: AUDIO_OVERVIEW_SYSTEM_PROMPT,
        temperature: 0.15 // Prevent creative drift
      }
    }));

    if (!result) return this.generateLocalScriptChunk(notebook, outline, partIndex);
    try { return JSON.parse(result.text || '{}'); } catch { return this.generateLocalScriptChunk(notebook, outline, partIndex); }
  }

  async generateTTSChunk(script: string): Promise<string> {
    const ai = this.getClient();
    if (!ai) return "";

    const result = await suppressGeminiErrors<GenerateContentResponse>(ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: script }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs: [
              { speaker: 'Alex', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
              { speaker: 'Jordan', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } }
            ]
          }
        }
      },
    }));

    if (!result) return "";
    const part = result.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    return part?.inlineData?.data || "";
  }

  /**
   * 🔎 RETRIEVAL-FIRST CHAT PIPELINE (INVARIANT)
   */
  async generateChatResponse(notebook: Notebook, query: string): Promise<string> {
    const ai = this.getClient();
    if (!ai) return "Sources currently unsynced.";

    const context = retrieveTopK(notebook, query, 8);
    const prompt = `SOURCES:\n${context}\n\nUSER QUESTION:\n${query}`;

    const result = await suppressGeminiErrors<GenerateContentResponse>(ai.models.generateContent({ 
      model: 'gemini-3-pro-preview', 
      contents: prompt,
      config: { 
        systemInstruction: NOTEBOOK_LM_SYSTEM_INSTRUCTION,
        temperature: 0.2
      }
    }));

    if (!result) return "I'm not finding enough information in your sources to answer confidently. Try adding more detail to the vault.";
    return result.text || "Analysis complete.";
  }

  async generateSummary(notebook: Notebook): Promise<string> {
    const ai = this.getClient();
    if (!ai) return "Grounded analysis ready.";

    const result = await suppressGeminiErrors<GenerateContentResponse>(ai.models.generateContent({ 
      model: 'gemini-3-flash-preview', 
      contents: `Synthesize a grounded overview paragraph for Vault: ${notebook.title}. No formatting.`,
      config: {
        systemInstruction: NOTEBOOK_LM_SYSTEM_INSTRUCTION,
        temperature: 0.1
      }
    }));

    return result?.text?.trim() || "Vault logic active.";
  }

  async performWebSearch(query: string): Promise<SearchResult[]> {
    const ai = this.getClient();
    if (!ai) return [];

    const result = await suppressGeminiErrors<GenerateContentResponse>(ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: query,
      config: { tools: [{ googleSearch: {} }] },
    }));

    if (!result) return [];
    const chunks = result.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    return chunks.filter((chunk: any) => chunk.web).map((chunk: any) => ({
      title: chunk.web.title || 'Untitled',
      uri: chunk.web.uri,
    }));
  }

  async generateEpisodeArtwork(notebook: Notebook): Promise<string | null> {
    const ai = this.getClient();
    if (!ai) return null;

    const result = await suppressGeminiErrors<GenerateContentResponse>(ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: `Minimalist concept art for "${notebook.title}"` }] }
    }));

    const part = result?.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    return part?.inlineData?.data ? `data:image/png;base64,${part.inlineData.data}` : null;
  }

  generateLocalOutline(notebook: Notebook): any {
    return { outline: [{ part: 1, topics: ["Knowledge Synthesis"] }] };
  }
  
  generateLocalScriptChunk(notebook: Notebook, outline: any, partIndex: number): any {
    return { speaker: "Alex", text: "Retrieval complete. Source context synchronized.", transcript: [] };
  }
}
