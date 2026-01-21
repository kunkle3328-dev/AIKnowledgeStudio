
import { GoogleGenAI, Modality, GenerateContentResponse, Type } from "@google/genai";
import { Notebook, AudioChapter, HostPersonality } from "../types";

export interface SearchResult {
  title: string;
  uri: string;
}

/**
 * LOCKED SUMMARY PROMPT (NON-NEGOTIABLE)
 */
const SUMMARY_PROMPT_STRICT = `
Generate a concise notebook summary based ONLY on the provided sources.

STRICT RULES (must be followed exactly):
- Write EXACTLY one paragraph
- 3–4 sentences total
- No headings
- No bullet points
- No markdown
- No line breaks
- High-level overview only
- No examples
- No details
- No explanations

If more detail is possible, omit it.
This summary must fit entirely on screen without scrolling.
`;

/**
 * LOCKED CHAT FORMATTING RULES
 */
const CHAT_FORMATTING_INSTRUCTION = `
Format your response for readability.

Rules:
- Use clear section headers (##) where helpful
- Separate paragraphs with line breaks
- Keep paragraphs short (2–4 lines max)
- Use bullet lists (- or •) sparingly
- Never output long unbroken blocks of text
- Prefer structure over verbosity
`;

/**
 * LOCKED SUMMARY VALIDATOR
 */
export function validateSummary(text: string): boolean {
  if (!text) return false;

  // No line breaks
  if (text.includes('\n')) return false;

  // No markdown
  if (/[#*_`>-]/.test(text)) return false;

  // Sentence count
  const sentences = text.split(/[.!?]+/).filter(Boolean);
  if (sentences.length < 3 || sentences.length > 4) return false;

  // Hard length cap
  if (text.length > 600) return false;

  return true;
}

export const AUDIO_OVERVIEW_DUAL = `
Generate a long-form, two-voice podcast episode script based on the provided sources.

VOICES:
- Host: Guides the narrative, introduces themes, and asks insightful questions.
- Analyst: Provides depth, technical nuance, and detailed explanations.

CONVERSATION RULES:
- The tone is calm, intellectual, and broadcast-quality.
- Use natural transitions, micro-pauses, and human-like back-and-forth.
- Target duration: 15–20 minutes.
- DO NOT use lists or bullet points.
- Formatting: Start each line with "Host: " or "Analyst: ".

STRUCTURE:
1. Host intro and hook.
2. Analyst provides foundational context.
3. 3-4 Major thematic chapters with deep discussion.
4. Host summaries and closing thoughts.
`;

function getPersonalityBlock(type: HostPersonality = 'neutral') {
  switch (type) {
    case 'curious':
      return `HOST PERSONALITY: The Host should ask exploratory questions, express deep curiosity, and actively invite the Analyst to explain complex points in simpler terms.`;
    case 'analytical':
      return `HOST PERSONALITY: The Host should challenge assumptions, seek extreme precision, and request logical clarifications at every major turn.`;
    case 'warm':
      return `HOST PERSONALITY: The Host should sound exceptionally welcoming, reflective, and supportive, focusing on the human impact of the information.`;
    case 'debate':
      return `HOST PERSONALITY: The Host should gently push back on the Analyst's points, presenting alternative interpretations respectfully to create a dialectic discussion.`;
    default:
      return `HOST PERSONALITY: The Host maintains a calm, steady, and neutral guidance through the material.`;
  }
}

export class GeminiService {
  async performWebSearch(query: string): Promise<SearchResult[]> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Search for high-quality articles, papers, or documentation related to: ${query}. List the most relevant sources with titles and URLs.`,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const results: SearchResult[] = chunks
        .filter((chunk: any) => chunk.web)
        .map((chunk: any) => ({
          title: chunk.web.title || 'Untitled Source',
          uri: chunk.web.uri,
        }));

      return results;
    } catch (err: any) {
      console.error("Gemini Search Error:", err);
      return [];
    }
  }

  async generateChatResponse(notebook: Notebook, query: string): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const sourcesContext = notebook.sources
      .slice(0, 10)
      .map(s => `Source: ${s.title}\nContent: ${s.content.substring(0, 4000)}`)
      .join('\n\n');
    
    const prompt = `You are a helpful assistant. Use these sources to answer:
    
    ${sourcesContext}
    
    Question: ${query}

    ${CHAT_FORMATTING_INSTRUCTION}`;
    
    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt
      });
      return response.text || 'No response generated.';
    } catch (err: any) {
      console.error("Gemini Chat Error:", err);
      return "I encountered an internal error.";
    }
  }

  async generateSummary(notebook: Notebook): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const sourcesContext = notebook.sources
      .slice(0, 10)
      .map(s => `Source: ${s.title}\nContent: ${s.content.substring(0, 3000)}`)
      .join('\n\n');
    
    const prompt = `${SUMMARY_PROMPT_STRICT}\n\nSOURCES:\n${sourcesContext}`;
    
    for (let i = 0; i < 3; i++) {
      try {
        const response: GenerateContentResponse = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: prompt
        });
        const text = response.text?.trim() || '';
        if (validateSummary(text)) {
          return text;
        }
        console.warn(`Summary attempt ${i+1} failed validation:`, text);
      } catch (err: any) {
        console.error("Summary generation error:", err);
      }
    }

    return "Summary generation failed to meet strict quality criteria. Please review sources manually.";
  }

  async generateTTSOverview(notebook: Notebook, personality: HostPersonality = 'neutral'): Promise<{ audio: string; chapters: AudioChapter[] }> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const sourcesContext = notebook.sources
      .slice(0, 8)
      .map(s => `SOURCE [${s.title}]: ${s.content.substring(0, 5000)}`)
      .join('\n\n');

    const personalityBlock = getPersonalityBlock(personality);

    const scriptPrompt = `SOURCES:\n${sourcesContext}\n\nTASK: ${AUDIO_OVERVIEW_DUAL}\n\n${personalityBlock}\n\nReturn a JSON object with:
    1. "script": The full multi-speaker script.
    2. "chapters": An array of objects with "title" and "estimatedStartTimeSeconds".`;

    try {
      const scriptResponse: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: scriptPrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              script: { type: Type.STRING },
              chapters: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    estimatedStartTimeSeconds: { type: Type.NUMBER }
                  }
                }
              }
            }
          }
        }
      });

      const data = JSON.parse(scriptResponse.text);
      const script = data.script;
      const chapters: AudioChapter[] = (data.chapters || []).map((c: any, i: number) => ({
        id: `ch-${i}`,
        title: c.title,
        startTime: c.estimatedStartTimeSeconds
      }));

      if (!script) throw new Error("Script generation failed");

      const safeScript = script.substring(0, 12000); 

      const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: safeScript }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            multiSpeakerVoiceConfig: {
              speakerVoiceConfigs: [
                {
                  speaker: 'Host',
                  voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
                },
                {
                  speaker: 'Analyst',
                  voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } },
                }
              ]
            }
          },
        },
      });

      const audioPart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      const audioData = audioPart?.inlineData?.data;
      
      if (!audioData) throw new Error("No audio data returned");
      
      return { audio: audioData, chapters };
    } catch (err: any) {
      console.error("Gemini TTS Dual-Voice Error:", err);
      throw err;
    }
  }

  getLiveSessionConfig(notebook: Notebook) {
    const sourcesContext = notebook.sources
      .slice(0, 5)
      .map(s => `Source: ${s.title}\n${s.content.substring(0, 1000)}`)
      .join('\n\n');
      
    return {
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
        },
        systemInstruction: `You are a professional audio researcher. Your persona is calm and intellectual. Project: "${notebook.title}". 
        
        SOURCES:
        ${sourcesContext}
        
        Tone: Natural, broadcast-quality podcast host. Stay grounded in sources.`,
      },
    };
  }
}
