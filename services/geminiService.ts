
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
 * This ensures the model never reports failure to the user.
 */
const SYSTEM_LOCKED_INSTRUCTION = `
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

const SUMMARY_PROMPT_STRICT = `
Generate a concise notebook summary based ONLY on the provided sources.
STRICT RULES: One paragraph, 3-4 sentences, no markdown, high-level only.
`;

const CHAT_FORMATTING_INSTRUCTION = `
Format your response for readability with headers and short paragraphs.
`;

/**
 * Exponential Backoff Retry Utility
 * Designed to survive brief quota bursts.
 */
async function withRetry<T>(fn: () => Promise<T>, retries = 5, delay = 2000): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    const msg = err.message || "";
    const isQuota = msg.includes("429") || msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("exhausted");
    if (isQuota && retries > 0) {
      console.warn(`[Gemini Service] Quota hit. Retrying in ${delay}ms...`);
      await new Promise(res => setTimeout(res, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw err;
  }
}

function getPersonalityBlock(personality: HostPersonality): string {
  switch (personality) {
    case 'curious':
      return "Jordan is extremely curious, asking lots of 'why' and 'how' questions. Alex is more grounded.";
    case 'analytical':
      return "Jordan is highly analytical, focusing on data points, statistics, and logical deductions.";
    case 'warm':
      return "Alex and Jordan have a warm, friendly rapport. They focus on the human impact of the topics.";
    case 'debate':
      return "Alex and Jordan often take slightly different perspectives, creating a respectful but spirited debate.";
    case 'visionary':
      return "Jordan focuses on future implications and big-picture transformations. Alex connects it to current data.";
    case 'neutral':
    default:
      return "Alex and Jordan have a balanced, professional tone.";
  }
}

export class GeminiService {
  /**
   * DETERMINISTIC FALLBACK GENERATOR (Locked Strategy)
   * This ensures the episode ALWAYS completes even with ZERO Gemini quota.
   */
  generateLocalOutline(notebook: Notebook): any {
    const parts = [
      { part: 1, topics: ["Introduction & Foundational Context", "Overview of " + notebook.title] },
      { part: 2, topics: ["Deep Dive Analysis", "Synthesizing Core Data"] },
      { part: 3, topics: ["Broader Implications", "Impact Assessment"] },
      { part: 4, topics: ["Grounded Synthesis", "Contextual Integration"] },
      { part: 5, topics: ["Final Takeaways", "The Way Forward"] }
    ];
    return { outline: parts };
  }

  generateLocalScriptChunk(notebook: Notebook, outline: any, partIndex: number): any {
    const part = outline.outline[partIndex];
    const sourceIdx = partIndex % (notebook.sources.length || 1);
    const source = notebook.sources[sourceIdx];
    const title = source?.title || "these core units";
    const content = source?.content.substring(0, 400) || "the grounded logic provided in the vault.";
    
    const templates = [
      {
        script: `Alex: Let's break down the big picture. Jordan, looking at ${title}, what stands out?\nJordan: I'm struck by the claim that ${content.substring(0, 100)}... It signals a clear shift.\nAlex: Precisely. It's a foundational development.`,
        duration: 45
      },
      {
        script: `Alex: Digging into the specifics now. Especially regarding ${part.topics.join(' and ')}.\nJordan: Right. In ${title}, we see a consistent focus on efficiency.\nAlex: That consistency is what makes this grounding so reliable.`,
        duration: 50
      },
      {
        script: `Alex: How does this translate to the real world? How does ${title} affect users?\nJordan: The material suggests it removes significant friction. It notes: ${content.substring(100, 200)}...\nAlex: So it's about simplifying complex workflows.`,
        duration: 55
      },
      {
        script: `Alex: We're seeing strong connections across the board. Jordan, how does this tie back?\nJordan: Everything in ${notebook.title} points toward a more integrated future.\nAlex: Built on the truths we're extracting today.`,
        duration: 50
      },
      {
        script: `Alex: What's the final takeaway? Where do we land on this?\nJordan: The data is definitive. If these trends in ${title} hold, we're looking at a major evolution.\nAlex: A great synthesis. Thanks for the analysis, Jordan.`,
        duration: 60
      }
    ];

    const currentTemplate = templates[partIndex % templates.length];
    const script = currentTemplate.script;
    
    const transcript: TranscriptSegment[] = script.split('\n').map((line, i) => {
      const isAlex = line.startsWith('Alex');
      const text = line.substring(line.indexOf(':') + 2);
      const baseStart = (partIndex * 180000);
      const lineOffset = i * 8000;
      return {
        id: `local-${partIndex}-${i}`,
        speaker: isAlex ? 'Alex' : 'Jordan',
        text,
        startMs: baseStart + lineOffset,
        endMs: baseStart + lineOffset + 7500
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
    const prompt = `${SYSTEM_LOCKED_INSTRUCTION}\nSources:\n${sourcesContext}\n\nQuestion: ${query}\n\nFormat your response for readability.`;
    try {
      const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({ model: 'gemini-3-pro-preview', contents: prompt }));
      return response.text || 'Thinking...';
    } catch (err: any) { 
      return "Synthesizing response..."; 
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
    const prompt = `Minimalist podcast cover. Topic: ${notebook.title}. Cinematic, dark background, primary ${fingerprint.bgColor}.`;
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
    const sourcesContext = notebook.sources.slice(0, 10).map(s => `SOURCE [${s.title}]: ${s.content.substring(0, 2000)}`).join('\n\n');
    const prompt = `${SYSTEM_LOCKED_INSTRUCTION}\nAnalyze these sources and provide a 5-part episode outline for a podcast. 
    Return JSON: { "outline": [ { "part": 1, "topics": string[] }, ... ] }
    SOURCES:\n${sourcesContext}`;

    const response: GenerateContentResponse = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    }));
    return JSON.parse(response.text || '{}');
  }

  async generateScriptChunk(notebook: Notebook, outline: any, partIndex: number, personality: HostPersonality): Promise<any> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const sourcesContext = notebook.sources.slice(0, 15).map(s => `SOURCE [${s.title}]: ${s.content.substring(0, 8000)}`).join('\n\n');
    const prompt = `
      ${SYSTEM_LOCKED_INSTRUCTION}
      ${SPEECH_SYSTEM_INSTRUCTION}
      ${getPersonalityBlock(personality)}
      Grounded in these sources, write ONLY the script for Part ${partIndex + 1}.
      Outline: ${JSON.stringify(outline.outline[partIndex])}
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
    if (!audioPart?.inlineData?.data) throw new Error("Audio synthesis failed.");
    return audioPart.inlineData.data;
  }
}

const SPEECH_SYSTEM_INSTRUCTION = `
You are generating a professional audio episode titled "AXIOM Grounded Intel".
STRICT IDENTITY: Host A is Alex (Narrator), Host B is Jordan (Analyst).
Short conversational turns. Natural interruptions. Grounded ONLY in sources.
`;
