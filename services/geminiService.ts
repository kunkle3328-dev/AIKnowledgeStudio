
import { GoogleGenAI, Modality, GenerateContentResponse } from "@google/genai";
import { Notebook } from "../types";

export interface SearchResult {
  title: string;
  uri: string;
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
      .map(s => `Source: ${s.title}\nContent: ${s.content.substring(0, 2000)}`)
      .join('\n\n');
    
    const prompt = `You are a helpful assistant. Use these sources to answer:
    
    ${sourcesContext}
    
    Question: ${query}`;
    
    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
      });
      return response.text || 'No response generated.';
    } catch (err: any) {
      console.error("Gemini Chat Error:", err);
      return "I encountered an internal error. Please try a simpler question or check your sources.";
    }
  }

  async generateTTSOverview(notebook: Notebook): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const cleanSummary = (notebook.summary || '')
      .replace(/[^\w\s.,?!]/gi, ' ') 
      .substring(0, 1500);
    
    const textToSpeak = `Welcome to the audio overview of ${notebook.title.replace(/[^\w\s]/gi, '')}. ${cleanSummary}`;

    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: textToSpeak }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const audioPart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      const audioData = audioPart?.inlineData?.data;
      
      if (!audioData) {
        throw new Error("Empty audio response");
      }
      return audioData;
    } catch (err: any) {
      console.error("Gemini TTS Error:", err);
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
        systemInstruction: `Assistant for "${notebook.title}". Sources:\n${sourcesContext}\nAnswer briefly and stay grounded.`,
      },
    };
  }
}
