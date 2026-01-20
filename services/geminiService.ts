
import { GoogleGenAI, Modality, GenerateContentResponse } from "@google/genai";
import { Notebook } from "../types";

export class GeminiService {
  async generateChatResponse(notebook: Notebook, query: string): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    const sourcesContext = notebook.sources.map(s => `Source (${s.title}): ${s.content}`).join('\n\n');
    const prompt = `You are a helpful grounded AI assistant. Using ONLY the following sources, answer the user's question. If the answer is not in the sources, say you don't know.\n\nSOURCES:\n${sourcesContext}\n\nUSER QUESTION: ${query}`;
    
    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
      });
      return response.text || 'No response generated.';
    } catch (err: any) {
      console.error("Gemini Chat Error:", err);
      if (err.message?.includes("500") || err.message?.includes("INTERNAL")) {
        return "The AI is currently experiencing a temporary hiccup (500). Please try again in a moment.";
      }
      throw err;
    }
  }

  async generateTTSOverview(notebook: Notebook): Promise<string> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    const prompt = `Say in a professional, engaging podcast host voice: Welcome to this audio overview of "${notebook.title}". ${notebook.summary || 'This notebook covers various research topics.'} We have ${notebook.sources.length} sources to explore today.`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: prompt,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!audioData) throw new Error("No audio data returned from Gemini TTS");
      return audioData;
    } catch (err: any) {
      console.error("Gemini TTS Error:", err);
      throw err;
    }
  }

  getLiveSessionConfig(notebook: Notebook) {
    const sourcesContext = notebook.sources.map(s => `Source (${s.title}): ${s.content}`).join('\n\n');
    return {
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
        },
        systemInstruction: `You are a live conversational assistant for the notebook "${notebook.title}". 
        The user wants to talk about these sources:\n${sourcesContext}\n
        Be concise, friendly, and always stay grounded in the provided sources. 
        Don't use filler. Speak like a real human in a meeting.`,
      },
    };
  }
}
