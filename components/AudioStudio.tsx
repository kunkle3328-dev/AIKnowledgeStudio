
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  const [intensity, setIntensity] = useState(0.5);
  
  const gemini = useRef(new GeminiService());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const liveSessionRef = useRef<any>(null);

  const stopAllAudio = () => {
    sourcesRef.current.forEach(s => s.stop());
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    setIsPlaying(false);
  };

  const handleOverviewPlay = async () => {
    if (isPlaying) {
      stopAllAudio();
      return;
    }

    setLoading(true);
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
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const startLiveSession = async () => {
    setLoading(true);
    setIsLive(true);
    stopAllAudio();

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
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
              setIsPlaying(true); // resume anim after interrupt
            }
          },
          onerror: (e) => console.error("Live Error", e),
          onclose: () => setIsLive(false)
        }
      });
      liveSessionRef.current = await sessionPromise;
    } catch (err) {
      console.error(err);
      setIsLive(false);
      setLoading(false);
    }
  };

  const stopLiveSession = () => {
    if (liveSessionRef.current) {
      liveSessionRef.current.close();
      liveSessionRef.current = null;
    }
    stopAllAudio();
    setIsLive(false);
  };

  return (
    <div className="flex-1 flex flex-col bg-black relative overflow-hidden">
      {/* Background Studio Branding */}
      <div className="absolute top-12 left-0 right-0 text-center px-4">
        <h2 className="text-zinc-500 text-xs font-medium tracking-widest uppercase mb-1">Studio</h2>
        <h1 className="text-white text-lg font-semibold truncate px-8">{notebook.title}</h1>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full h-64 relative">
          <Waveform isActive={isPlaying} intensity={intensity} />
          {loading && (
             <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
             </div>
          )}
        </div>
      </div>

      <div className="pb-safe px-6 mb-24">
        <div className="flex flex-col items-center gap-6">
          <div className="flex items-center gap-12">
            <button className="p-3 text-zinc-500 hover:text-white transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"/></svg>
            </button>
            
            {isLive ? (
              <button 
                onClick={stopLiveSession}
                className="bg-red-500 text-white px-10 py-4 rounded-full font-bold shadow-xl shadow-red-500/20 active:scale-95 transition-all flex items-center gap-2"
              >
                <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                End Session
              </button>
            ) : (
              <button 
                onClick={startLiveSession}
                disabled={loading}
                className="bg-blue-600 text-white px-12 py-4 rounded-full font-bold shadow-xl shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-50"
              >
                ✋ Join Live
              </button>
            )}

            <button className="p-3 text-zinc-500 hover:text-white transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z"/></svg>
            </button>
          </div>

          {!isLive && (
            <button 
              onClick={handleOverviewPlay}
              className="bg-zinc-800/80 p-4 rounded-full text-white hover:bg-zinc-700 transition-colors"
            >
              {isPlaying ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="4" height="16" x="6" y="4"/><rect width="4" height="16" x="14" y="4"/></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AudioStudio;
