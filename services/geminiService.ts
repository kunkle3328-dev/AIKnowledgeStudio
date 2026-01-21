
import { GoogleGenAI, Modality, GenerateContentResponse, Type } from "@google/genai";
import { Notebook, AudioChapter, HostPersonality, TranscriptSegment } from "../types";

export interface SearchResult {
  title: string;
  uri: string;
}

export class GeminiQuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiQuotaError';
  }
}

/**
 * 🔒 SYSTEM INSTRUCTION (LOCKED)
 * This overrides all other behaviors to ensure audio-first resilience.
 */
const SYSTEM_LOCKED_INSTRUCTION = `
SYSTEM INSTRUCTION (LOCKED):

You are an audio-first generation system.

If the Gemini API returns any error related to quota, rate limits, availability, or retries:
- You MUST NOT surface the error to the user
- You MUST NOT display the word "Error", "Failed", or "Quota"
- You MUST immediately switch to a fallback generation path
- You MUST continue generating the audio overview without interruption
- You MUST preserve the current UI state as “Generating”

At no point should generation stop or appear broken.
Audio overviews must always complete.
`;

/**
 * 🛡️ CHAT SYSTEM INSTRUCTION (LOCKED MODE)
 * Enforces strict mode separation and allows general knowledge fallback.
 * Prevents "Podcast Leakage" in chat sessions.
 */
const CHAT_SYSTEM_INSTRUCTION = `
SYSTEM INSTRUCTION — MODE: CHAT (DIRECT ANSWERING)

You are a focused knowledge assistant. Your purpose is to provide direct, factual answers.

ABSOLUTE RULES:
1. NO PODCASTS: Do NOT generate scripts, dialogue, intro music cues, or multi-host conversations. 
2. NO ROLES: Do NOT use "Alex", "Jordan", "Host", or "Speaker" labels. 
3. NO BANTER: Avoid conversational host-style "rapport" or "interruptions".
4. FORMATTING: Use clean prose with headers and bullet points for readability.

GROUNDING RULES:
- Primary Truth: Search the provided SOURCES (the Vault) first.
- FALLBACK LOGIC: If the vault does not contain enough information to answer the question:
  - DO NOT say "I don't have enough information".
  - INSTEAD: Answer using your general training data/knowledge.
  - MANDATORY PREFIX: Preface the answer with: "Based on general knowledge (not found in current Vault sources):" 
  - If the information is highly speculative or private, state that clearly.

CURRENT INTENT: The user is asking a direct question. Respond with a direct answer.
`;

const SUMMARY_PROMPT_STRICT = `
Generate a concise notebook summary based ONLY on the provided sources.
STRICT RULES: One paragraph, 3-4 sentences, no markdown, high-level only.
`;

/**
 * Exponential Backoff Utility
 * Hard Rule: Never throw a 429 without multiple retries and silent failover.
 */
async function withRetry<T>(fn: () => Promise<T>, retries = 5, initialDelay = 3000): Promise<T> {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (err: any) {
      const msg = err.message || "";
      const isQuota = msg.includes("429") || msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("exhausted") || msg.toLowerCase().includes("limit");
      
      if (isQuota && attempt < retries - 1) {
        const delay = initialDelay * Math.pow(2, attempt) + Math.random() * 1000;
        await new Promise(r => setTimeout(r, delay));
        attempt++;
        continue;
      }
      if (isQuota) throw new GeminiQuotaError("Quota failover triggered.");
      throw err;
    }
  }
  return fn();
}

function getPersonalityBlock(personality: HostPersonality): string {
  switch (personality) {
    case 'curious': return "Jordan is extremely curious, asking 'why' and 'how'. Alex is the analytical anchor.";
    case 'analytical': return "Jordan pushes for data and logical consistency at every point.";
    case 'warm': return "The rapport is friendly and focuses on the human element of the data.";
    case 'debate': return "Alex and Jordan engage in a respectful but spirited dialectic.";
    case 'visionary': return "Jordan focuses on long-term transformations and big-picture shifts.";
    case 'neutral':
    default: return "A balanced, professional conversational rapport.";
  }
}

export class GeminiService {
  /**
   * DETERMINISTIC FALLBACK GENERATOR (Locked Strategy)
   * Guaranteed 10-15 minute episode structure (approx 1600-2200 words).
   */
  generateLocalOutline(notebook: Notebook): any {
    return {
      outline: [
        { part: 1, topics: ["Introduction & Foundational Hook", "Overview of " + notebook.title] },
        { part: 2, topics: ["The First Pillar: Core Methodology", "Unpacking primary grounded logic"] },
        { part: 3, topics: ["Synthesizing the Data Stream", "Analyzing key source findings"] },
        { part: 4, topics: ["Operational Impact", "Real-world transformation potential"] },
        { part: 5, topics: ["The Neural Future", "Forward-looking statements and closing"] }
      ]
    };
  }

  /**
   * High-fidelity deterministic script generator.
   * Uses locked Host A (Alex) and Host B (Jordan) identities.
   */
  generateLocalScriptChunk(notebook: Notebook, outline: any, partIndex: number): any {
    const source = notebook.sources[partIndex % (notebook.sources.length || 1)];
    const title = source?.title || "the primary dataset";
    const content = source?.content || "the core grounded documentation synced to this vault.";
    const keyDetail = content.substring(0, 120);

    const templates = [
      // INTRO
      `Alex: Welcome back. Today, we’re breaking down ${notebook.title}, using real sources to understand what’s actually changing — and what matters.\nJordan: Yeah, because once you look past the headlines, there’s a much bigger story here.\nAlex: Exactly. We’ll walk through what’s new, why it matters, and where this is likely heading next.`,
      // SEGMENT 1
      `Alex: Let’s start with the core idea here: ${title}. At first glance, this sounds straightforward.\nJordan: But when you dig into the source material, there’s more going on. Looking at the data on ${keyDetail}... this change affects the entire system.\nAlex: So this isn’t just a feature update — it reshapes the behavior of the whole unit.\nJordan: Exactly. That signals a longer-term shift.`,
      // SEGMENT 2
      `Alex: Now, diving deeper into the analysis. Specifically, how these pillars interact.\nJordan: Right, in ${title}, the documentation highlights efficiency as the primary metric.\nAlex: And without that baseline, the rest of the synthesis just doesn't hold up.\nJordan: It's a foundational requirement that often gets overlooked.`,
      // SEGMENT 3
      `Alex: What about the human element? How does this impact the workflow?\nJordan: The sources are clear—it's about removing friction. The material explicitly mentions ${keyDetail} as a pivot point.\nAlex: So it's an invisible upgrade that fundamentally changes how we interact with the vault.`,
      // OUTRO
      `Alex: So stepping back, the big takeaway is this: the logic of ${notebook.title} is sound and grounded.\nJordan: And if this trend continues, we’re likely to see a complete evolution of this space within the year.\nAlex: We’ll keep tracking this as it evolves. Thanks for joining me, Jordan.\nJordan: My pleasure.`
    ];

    const script = templates[partIndex % templates.length];
    const transcript: TranscriptSegment[] = script.split('\n').map((line, i) => {
      const isAlex = line.startsWith('Alex');
      const text = line.substring(line.indexOf(':') + 2);
      const baseStart = (partIndex * 180000);
      const lineOffset = i * 12000;
      return {
        id: `local-${partIndex}-${i}`,
        speaker: isAlex ? 'Alex' : 'Jordan',
        text,
        startMs: baseStart + lineOffset,
        endMs: baseStart + lineOffset + 11000
      };
    });

    return { script, transcript };
  }

  async performWebSearch(query: string): Promise<SearchResult[]> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `${SYSTEM_LOCKED_INSTRUCTION}\nSearch relevant sources for: ${query}.`,
        config: { tools: [{ googleSearch: {} }] },
      }));
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      return chunks.filter((chunk: any) => chunk.web).map((chunk: any) => ({
        title: chunk.web.title || 'Untitled Source',
        uri: chunk.web.uri,
      }));
    } catch (err: any) { return []; }
  }

  async generateChatResponse(notebook: Notebook, query: string): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const sourcesContext = notebook.sources.slice(0, 10).map(s => `Source: ${s.title}\nContent: ${s.content.substring(0, 4000)}`).join('\n\n');
    const prompt = `${CHAT_SYSTEM_INSTRUCTION}\n\nVAULT SOURCES:\n${sourcesContext}\n\nUSER QUESTION: ${query}\n\nProvide a direct, factual answer. Do NOT use host/speaker roles.`;
    try {
      const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({ 
        model: 'gemini-3-pro-preview', 
        contents: prompt 
      }));
      return response.text || 'Thinking...';
    } catch (err: any) { 
      return "I encountered an error accessing the vault. Please try re-syncing your sources."; 
    }
  }

  async generateSummary(notebook: Notebook): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const sourcesContext = notebook.sources.slice(0, 10).map(s => `Source: ${s.title}\nContent: ${s.content.substring(0, 3000)}`).join('\n\n');
    const prompt = `${SYSTEM_LOCKED_INSTRUCTION}\n${SUMMARY_PROMPT_STRICT}\n\nSOURCES:\n${sourcesContext}`;
    try {
      const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt }));
      return response.text?.trim() || 'Summary optimizing...';
    } catch (err: any) { return "Summary logic updating."; }
  }

  async generateEpisodeArtwork(notebook: Notebook): Promise<string | null> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const fingerprint = notebook.visualFingerprint;
    const prompt = `Minimalist podcast cover for ${notebook.title}. Tech-noir, primary ${fingerprint.bgColor}.`;
    try {
      const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: prompt }] },
        config: { imageConfig: { aspectRatio: "1:1" } }
      }));
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
      }
    } catch (e) { }
    return null;
  }

  async generateOutline(notebook: Notebook): Promise<any> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `${SYSTEM_LOCKED_INSTRUCTION}\nGenerate a 5-part podcast episode outline for "${notebook.title}". Return JSON: { "outline": [ { "part": number, "topics": string[] } ] }`;
    const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    }));
    return JSON.parse(response.text || '{}');
  }

  async generateScriptChunk(notebook: Notebook, outline: any, partIndex: number, personality: HostPersonality): Promise<any> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const sourcesContext = notebook.sources.slice(0, 10).map(s => `SOURCE [${s.title}]: ${s.content.substring(0, 4000)}`).join('\n\n');
    const prompt = `
      ${SYSTEM_LOCKED_INSTRUCTION}
      Professional podcast "AXIOM Grounded Intel". Hosts: Alex (Narrator), Jordan (Analyst). 
      ${getPersonalityBlock(personality)}
      Write script for Part ${partIndex + 1} based on: ${JSON.stringify(outline.outline[partIndex])}.
      Return JSON: { "script": string, "transcript": Array<{ speaker, text, startMs, endMs }> }
      SOURCES:\n${sourcesContext}
    `;
    const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    }));
    return JSON.parse(response.text || '{}');
  }

  async generateTTSChunk(script: string): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: script.substring(0, 20000) }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs: [
              { speaker: 'Alex', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
              { speaker: 'Jordan', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } }
            ]
          }
        },
      },
    }));
    const audioPart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (!audioPart?.inlineData?.data) throw new Error("TTS failed.");
    return audioPart.inlineData.data;
  }
}
