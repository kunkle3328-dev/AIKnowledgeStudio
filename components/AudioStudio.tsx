
import React, { useState, useRef } from 'react';
import { Notebook } from '../types';
import { GeminiService } from '../services/geminiService';
import { decode, decodeAudioData, createBlob } from '../utils/audioUtils';
import Waveform from './Waveform';
import { GoogleGenAI, LiveServerMessage } from '@google/genai';

interface AudioStudioProps {
  notebook: Notebook;
}

const AudioStudio: React.FC<AudioStudioProps> = ({ notebook }) => {
  const [isLive, setIsLive] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const gemini = useRef(new GeminiService());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const liveSessionRef = useRef<any>(null);

  const stopAllAudio = () => {
    sourcesRef.current.forEach(s => {
      try { s.stop(); } catch(e) {}
    });
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    setIsPlaying(false);
    setError(null);
  };

  const handleOverviewPlay = async () => {
    if (isPlaying && !isLive) {
      stopAllAudio();
      return;
    }
    if (isLive) return;

    setLoading(true);
    setError(null);
    try {
      const audioData = await gemini.current.generateTTSOverview(notebook);
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const ctx = audioCtxRef.current;
      const buffer = await decodeAudioData(decode(audioData), ctx, 24000, 1);
      
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = () => {
        setIsPlaying(false);
        sourcesRef.current.delete(source);
      };
      
      sourcesRef.current.add(source);
      source.start();
      setIsPlaying(true);
    } catch (err: any) {
      console.error(err);
      setError("Failed to generate audio overview.");
    } finally {
      setLoading(false);
    }
  };

  const startLiveSession = async () => {
    setLoading(true);
    setError(null);
    setIsLive(true);
    stopAllAudio();

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const config = gemini.current.getLiveSessionConfig(notebook);

    const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    audioCtxRef.current = outputCtx;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const sessionPromise = ai.live.connect({
        ...config,
        callbacks: {
          onopen: () => {
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
            setLoading(false);
            setIsPlaying(true);
          },
          onmessage: async (msg: LiveServerMessage) => {
            const audioStr = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioStr) {
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              const buffer = await decodeAudioData(decode(audioStr), outputCtx, 24000, 1);
              const source = outputCtx.createBufferSource();
              source.buffer = buffer;
              source.connect(outputCtx.destination);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }
            if (msg.serverContent?.interrupted) {
              stopAllAudio();
              setIsPlaying(true);
            }
          },
          onerror: (e) => {
            console.error("Live Error", e);
            setError("Live session error.");
          },
          onclose: () => {
            setIsLive(false);
            setIsPlaying(false);
          }
        }
      });
      liveSessionRef.current = await sessionPromise;
    } catch (err) {
      console.error(err);
      setIsLive(false);
      setLoading(false);
      setError("Session failed.");
    }
  };

  const stopLiveSession = () => {
    if (liveSessionRef.current) {
      try { liveSessionRef.current.close(); } catch(e) {}
      liveSessionRef.current = null;
    }
    stopAllAudio();
    setIsLive(false);
  };

  return (
    <div className="flex-1 flex flex-col bg-black relative overflow-hidden">
      <div className="absolute top-8 left-0 right-0 text-center px-6">
        <h2 className="text-zinc-500 text-[9px] font-bold tracking-[0.2em] uppercase mb-1.5">Studio</h2>
        <h1 className="text-white text-lg font-bold truncate max-w-xs mx-auto">{notebook.title}</h1>
        {error && <div className="text-red-400 text-[10px] mt-1 px-3 bg-red-900/20 py-1.5 rounded-lg inline-block border border-red-900/50">{error}</div>}
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full h-64 relative flex items-center justify-center">
          <Waveform isActive={isPlaying} />
          {loading && (
             <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
             </div>
          )}
        </div>
      </div>

      <div className="pb-safe px-6 mb-24">
        <div className="flex flex-col items-center gap-8">
          <div className="flex items-center gap-8">
            <button className="p-4 text-zinc-400 hover:text-white transition-colors bg-zinc-900/40 rounded-full active:scale-90 transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"/></svg>
            </button>
            
            {isLive ? (
              <button 
                onClick={stopLiveSession}
                className="bg-red-600 text-white px-8 py-4 rounded-full font-black tracking-wide shadow-2xl active:scale-95 transition-all flex items-center gap-2.5 uppercase text-[10px]"
              >
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                End Session
              </button>
            ) : (
              <button 
                onClick={startLiveSession}
                disabled={loading}
                className="bg-blue-600 text-white px-10 py-4 rounded-full font-black tracking-wide shadow-2xl active:scale-95 transition-all disabled:opacity-50 uppercase text-[10px] flex items-center gap-2 pulse-btn"
              >
                ✋ Join Live
              </button>
            )}

            <button className="p-4 text-zinc-400 hover:text-white transition-colors bg-zinc-900/40 rounded-full active:scale-90 transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79-1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z"/></svg>
            </button>
          </div>

          {!isLive && (
            <button 
              onClick={handleOverviewPlay}
              disabled={loading}
              className="bg-white p-5 rounded-full text-black shadow-2xl active:scale-90 transition-all disabled:opacity-50"
            >
              {isPlaying ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><rect width="4" height="16" x="6" y="4" rx="1"/><rect width="4" height="16" x="14" y="4" rx="1"/></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AudioStudio;
