
import React, { useState, useRef, useEffect } from 'react';
import { Notebook, AudioChapter, HostPersonality } from '../types';
import { GeminiService } from '../services/geminiService';
import { decode, decodeAudioData, createBlob, getSilenceBuffer } from '../utils/audioUtils';
import Waveform from './Waveform';
import { GoogleGenAI, LiveServerMessage } from '@google/genai';

interface AudioStudioProps {
  notebook: Notebook;
  onDeleteMedia?: (mediaId: string) => void;
  onBack?: () => void;
}

type AudioMode = 'IDLE' | 'GENERATING' | 'PLAYBACK' | 'LIVE';
type StudioView = 'DASHBOARD' | 'PLAYER';
type LiveJoinState = 'IDLE' | 'CONNECTING' | 'WARMING_UP' | 'LIVE' | 'FAILED';

const WaveformSparkleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 12V15M7 10V17M10 8V19M13 11V16M16 13V14M19 12V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M18 4L19 6L21 7L19 8L18 10L17 8L15 7L17 6L18 4Z" fill="currentColor"/>
  </svg>
);

const MicIcon: React.FC<{ active?: boolean; loading?: boolean }> = ({ active, loading }) => (
  <div className={`relative ${loading ? 'animate-pulse' : ''}`}>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 1C10.3431 1 9 2.34315 9 4V12C9 13.6569 10.3431 15 12 15C13.6569 15 15 13.6569 15 12V4C15 2.34315 13.6569 1 12 1Z"
        fill={active ? "#FFFFFF" : "#6B7280"}
      />
      <path d="M19 10V12C19 15.866 15.866 19 12 19C8.13401 19 5 15.866 5 12V10" stroke={active ? "#FFFFFF" : "#6B7280"} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M12 19V23M8 23H16" stroke={active ? "#FFFFFF" : "#6B7280"} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  </div>
);

const PERSONALITIES: { id: HostPersonality, label: string }[] = [
  { id: 'neutral', label: 'Neutral' },
  { id: 'curious', label: 'Curious' },
  { id: 'analytical', label: 'Analytical' },
  { id: 'warm', label: 'Warm' },
  { id: 'debate', label: 'Debate' }
];

const AudioStudio: React.FC<AudioStudioProps> = ({ notebook, onDeleteMedia, onBack }) => {
  const [view, setView] = useState<StudioView>('DASHBOARD');
  const [mode, setMode] = useState<AudioMode>('IDLE');
  const [liveJoinState, setLiveJoinState] = useState<LiveJoinState>('IDLE');
  const [error, setError] = useState<string | null>(null);
  const [chapters, setChapters] = useState<AudioChapter[]>(notebook.chapters || []);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(1);
  const [personality, setPersonality] = useState<HostPersonality>(notebook.hostPersonality || 'neutral');
  const [showSettings, setShowSettings] = useState(false);
  
  const gemini = useRef(new GeminiService());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const liveSessionRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const lastPlaybackPositionRef = useRef<number>(0);

  const PERSISTENCE_KEY = `studio_playback_${notebook.id}`;

  const saveSnapshot = (pos: number, playing: boolean) => {
    const snapshot = {
      notebookId: notebook.id,
      position: pos,
      wasPlaying: playing,
      timestamp: Date.now()
    };
    localStorage.setItem(PERSISTENCE_KEY, JSON.stringify(snapshot));
  };

  const loadSnapshot = () => {
    const data = localStorage.getItem(PERSISTENCE_KEY);
    if (data) {
      try {
        const snapshot = JSON.parse(data);
        if (Date.now() - snapshot.timestamp < 48 * 60 * 60 * 1000) {
          lastPlaybackPositionRef.current = snapshot.position;
          setCurrentTime(snapshot.position);
        }
      } catch (e) {
        console.warn("Restore failed", e);
      }
    }
  };

  useEffect(() => {
    loadSnapshot();
    setupMediaSession();
    return () => {
      stopAllAudio(false);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    if (mode === 'PLAYBACK') {
      const interval = setInterval(() => {
        saveSnapshot(lastPlaybackPositionRef.current, true);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [mode]);

  const getAudioCtx = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    return audioCtxRef.current;
  };

  const setupMediaSession = () => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: notebook.title,
        artist: 'AI Knowledge Studio',
        album: 'Source-Grounded Podcast',
      });
      navigator.mediaSession.setActionHandler('play', () => handleOverviewPlay());
      navigator.mediaSession.setActionHandler('pause', () => handleOverviewPlay());
      navigator.mediaSession.setActionHandler('stop', () => stopAllAudio(true));
    }
  };

  const stopAllAudio = (resetCursor = true) => {
    sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
    sourcesRef.current.clear();
    if (resetCursor) {
      nextStartTimeRef.current = 0;
      setCurrentTime(0);
      lastPlaybackPositionRef.current = 0;
      localStorage.removeItem(PERSISTENCE_KEY);
    }
    setError(null);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (silenceTimerRef.current) window.clearInterval(silenceTimerRef.current);
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
  };

  const handleOverviewPlay = async () => {
    if (mode === 'PLAYBACK') {
      lastPlaybackPositionRef.current = currentTime;
      saveSnapshot(currentTime, false);
      stopAllAudio(false);
      setMode('IDLE');
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
      return;
    }
    
    setMode('GENERATING');
    setError(null);
    try {
      const { audio, chapters: newChapters } = await gemini.current.generateTTSOverview(notebook, personality);
      setChapters(newChapters);
      
      const ctx = getAudioCtx();
      const buffer = await decodeAudioData(decode(audio), ctx, 24000, 1);
      setTotalDuration(buffer.duration);
      
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = () => {
        if (mode === 'PLAYBACK') {
          setMode('IDLE');
          if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
        }
        sourcesRef.current.delete(source);
      };
      
      sourcesRef.current.add(source);
      const startTimeOffset = lastPlaybackPositionRef.current;
      const physicalStartTime = ctx.currentTime - startTimeOffset;
      
      source.start(0, startTimeOffset);
      setMode('PLAYBACK');
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';

      const updateProgress = () => {
        const elapsed = ctx.currentTime - physicalStartTime;
        setCurrentTime(elapsed);
        lastPlaybackPositionRef.current = elapsed;
        rafRef.current = requestAnimationFrame(updateProgress);
      };
      updateProgress();

    } catch (err: any) {
      setError("Podcast generation failed.");
      setMode('IDLE');
    }
  };

  const startLiveSession = async () => {
    if (mode === 'PLAYBACK') {
      lastPlaybackPositionRef.current = currentTime;
      saveSnapshot(currentTime, false);
      stopAllAudio(false);
    }
    
    setLiveJoinState('CONNECTING');
    setError(null);

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const config = gemini.current.getLiveSessionConfig(notebook);
    const inCtx = new AudioContext({ sampleRate: 16000 });
    const outCtx = getAudioCtx();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const sessionPromise = ai.live.connect({
        ...config,
        callbacks: {
          onopen: () => {
            setLiveJoinState('WARMING_UP');
            const node = inCtx.createMediaStreamSource(stream);
            const proc = inCtx.createScriptProcessor(4096, 1, 1);
            proc.onaudioprocess = (e) => {
              sessionPromise.then(s => s.sendRealtimeInput({ media: createBlob(e.inputBuffer.getChannelData(0)) }));
            };
            node.connect(proc); proc.connect(inCtx.destination);
            
            silenceTimerRef.current = window.setInterval(() => {
              const ctx = getAudioCtx();
              const silence = getSilenceBuffer(ctx);
              const s = ctx.createBufferSource();
              s.buffer = silence;
              s.connect(ctx.destination);
              s.start(nextStartTimeRef.current);
              nextStartTimeRef.current += silence.duration;
            }, 500);
          },
          onmessage: async (msg: LiveServerMessage) => {
            if (liveJoinState !== 'LIVE') {
              setLiveJoinState('LIVE');
              setMode('LIVE');
            }

            const data = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (data) {
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outCtx.currentTime);
              const buf = await decodeAudioData(decode(data), outCtx, 24000, 1);
              const s = outCtx.createBufferSource(); s.buffer = buf;
              s.connect(outCtx.destination); s.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buf.duration;
              sourcesRef.current.add(s);
            }
          },
          onerror: (e) => {
            console.error("Live Error", e);
            setLiveJoinState('FAILED');
            setTimeout(() => setLiveJoinState('IDLE'), 3000);
            stopLiveSession();
          },
          onclose: () => {
            setLiveJoinState('IDLE');
            stopLiveSession();
          }
        }
      });
      liveSessionRef.current = await sessionPromise;
    } catch (e) {
      console.error("Live Init Failed", e);
      setLiveJoinState('FAILED');
      setTimeout(() => setLiveJoinState('IDLE'), 3000);
      setMode('IDLE');
    }
  };

  const stopLiveSession = () => {
    if (liveSessionRef.current) {
      try { liveSessionRef.current.close(); } catch(e) {}
      liveSessionRef.current = null;
    }
    setLiveJoinState('IDLE');
    setMode('IDLE');
    if (lastPlaybackPositionRef.current > 0) {
      handleOverviewPlay();
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: notebook.title,
          text: `Check out this AI-powered audio overview for ${notebook.title}`,
          url: window.location.href,
        });
      } catch (err) {}
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied');
    }
  };

  const activeChapter = chapters.find((c, i) => {
    const next = chapters[i+1];
    return currentTime >= c.startTime && (!next || currentTime < next.startTime);
  });

  if (view === 'DASHBOARD') {
    return (
      <div className="flex-1 flex flex-col bg-black overflow-hidden h-full pb-32">
        <header className="px-5 py-4 flex items-center justify-between shrink-0">
          <button onClick={onBack} className="p-2 text-white active:scale-95 transition-transform">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <span className="text-[12px] font-bold tracking-tight text-white line-clamp-1 max-w-[65%] text-center uppercase tracking-widest">{notebook.title}</span>
          <div className="w-9"></div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 no-scrollbar">
          <div className="mt-4 mb-6">
            <h3 className="text-zinc-500 text-[11px] font-bold mb-3 uppercase tracking-widest">Generate new</h3>
            <div className="flex flex-col gap-2.5">
              <button 
                onClick={() => { setView('PLAYER'); handleOverviewPlay(); }}
                className="bg-[#111214] hover:bg-[#1A1D23] p-4 rounded-[24px] flex items-center justify-between transition-colors border border-white/5 shadow-lg group"
              >
                <div className="flex items-center gap-3">
                  <div className="text-zinc-400 group-hover:text-white transition-colors">
                    <WaveformSparkleIcon />
                  </div>
                  <span className="text-white text-base font-bold">Audio Overview</span>
                </div>
                <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-zinc-400 group-hover:bg-white group-hover:text-black transition-all">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                </div>
              </button>
            </div>
          </div>

          <div className="mt-8 mb-20">
            <h3 className="text-zinc-500 text-[11px] font-bold mb-3 uppercase tracking-widest">Library</h3>
            <div className="flex flex-col gap-4">
              {notebook.generatedMedia && notebook.generatedMedia.length > 0 ? (
                notebook.generatedMedia.map((media) => (
                  <div key={media.id} className="flex items-center justify-between group bg-[#111214] p-4 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-9 h-9 flex items-center justify-center text-[#4DA3FF] bg-[#000000] rounded-lg border border-white/5 shrink-0">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="M2 12h20"/><path d="m4.93 4.93 14.14 14.14"/><path d="m4.93 19.07 14.14-14.14"/></svg>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-white text-sm font-bold truncate">{media.title}</span>
                        <span className="text-zinc-500 text-[10px] font-medium mt-0.5 uppercase tracking-wider">
                          {media.duration} • {media.sourceCount} sources
                        </span>
                      </div>
                    </div>
                    <button 
                      onClick={() => { setView('PLAYER'); handleOverviewPlay(); }}
                      className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-black active:scale-90 transition-all shadow-xl"
                    >
                       <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-zinc-600 text-[10px] italic py-8 text-center bg-[#111214] rounded-3xl border border-dashed border-white/5">No media in library yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-black relative overflow-hidden h-full">
      <div className="absolute top-8 left-0 right-0 px-6 z-20 flex flex-col items-center">
        <div className="w-full flex justify-between items-center mb-1">
          <button onClick={() => setView('DASHBOARD')} className="p-2 text-zinc-400 active:text-white">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowSettings(!showSettings)} className="p-2 text-zinc-400 active:text-white">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
            <button onClick={handleShare} className="p-2 text-zinc-400 active:text-white">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" x2="12" y1="2" y2="15"/></svg>
            </button>
          </div>
        </div>
        <h2 className="text-zinc-600 text-[9px] font-bold tracking-[0.2em] uppercase mb-0.5">Source Studio</h2>
        <h1 className="text-white text-lg font-bold tracking-tight text-center truncate w-full px-4">{notebook.title}</h1>
        {activeChapter && (
           <div className="mt-3 px-3 py-1 bg-white/5 rounded-full inline-flex items-center gap-2 border border-white/5 backdrop-blur-xl">
             <div className="w-1 h-1 bg-[#4DA3FF] rounded-full animate-pulse shadow-[0_0_6px_#4DA3FF]"></div>
             <span className="text-[9px] text-zinc-200 font-black uppercase tracking-widest">{activeChapter.title}</span>
           </div>
        )}
      </div>

      {showSettings && (
        <div className="absolute inset-x-0 top-28 px-8 z-30 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-[#111214] border border-white/10 rounded-3xl p-5 shadow-2xl">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">Host Personality</h3>
            <div className="flex flex-wrap gap-2">
              {PERSONALITIES.map(p => (
                <button
                  key={p.id}
                  onClick={() => { setPersonality(p.id); setShowSettings(false); }}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border ${personality === p.id ? 'bg-white text-black border-white' : 'bg-transparent text-zinc-400 border-white/10 active:border-white/30'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center relative mt-20 px-6">
        <div className="w-full h-32 flex items-center justify-center relative">
          <Waveform 
            isActive={mode === 'PLAYBACK' || mode === 'LIVE' || mode === 'GENERATING' || liveJoinState === 'WARMING_UP'} 
            intensity={liveJoinState === 'WARMING_UP' ? 0.15 : (mode === 'LIVE' ? 0.8 : 0.35)} 
          />
          {mode === 'GENERATING' && (
             <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm rounded-3xl">
                <div className="w-6 h-6 border-2 border-white/10 border-t-white rounded-full animate-spin mb-3"></div>
                <p className="text-[#8A8A8A] text-[10px] italic text-center px-8">
                  Analyzing Vault Logic...
                </p>
             </div>
          )}
        </div>
      </div>

      <div className="pb-40 px-8 flex flex-col items-center gap-8">
        <div className="flex items-center gap-5">
          <button className="w-9 h-9 rounded-full bg-[#111214] flex items-center justify-center text-zinc-600 border border-white/5 active:text-white transition-colors">
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 10v12M15 5.88l-1 4.12h5.83a2 2 0 0 1 1.92 2.56l-2.33 8a2 2 0 0 1-1.92 1.44H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/></svg>
          </button>
          
          {mode === 'LIVE' || liveJoinState === 'LIVE' ? (
            <button onClick={stopLiveSession} className="bg-[#FF4D4F] text-white px-6 py-2.5 rounded-full font-black text-[10px] tracking-[0.15em] flex items-center gap-2 shadow-[0_0_15px_rgba(255,77,79,0.25)] active:scale-95 transition-all">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              END LIVE
            </button>
          ) : (
            <div className="flex flex-col items-center relative">
              <button 
                onClick={startLiveSession} 
                disabled={mode === 'GENERATING' || liveJoinState === 'CONNECTING' || liveJoinState === 'WARMING_UP'} 
                className={`bg-[#4DA3FF] text-white px-6 py-3 rounded-full font-black text-[10px] tracking-[0.15em] flex items-center gap-2 shadow-[0_0_20px_rgba(77,163,255,0.25)] active:scale-95 transition-all disabled:opacity-50 disabled:grayscale min-w-[140px] justify-center overflow-hidden`}
              >
                {liveJoinState === 'CONNECTING' ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                    SYNCING…
                  </>
                ) : liveJoinState === 'WARMING_UP' ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                    WARMING…
                  </>
                ) : (
                  <>
                    <MicIcon active />
                    JOIN LIVE
                  </>
                )}
              </button>
              {liveJoinState === 'FAILED' && (
                <div className="absolute top-full mt-2 text-[#FF4D4F] text-[9px] font-bold uppercase tracking-wider animate-in fade-in slide-in-from-top-1">
                  Failed. Retry.
                </div>
              )}
            </div>
          )}

          <button className="w-9 h-9 rounded-full bg-[#111214] flex items-center justify-center text-zinc-600 border border-white/5 active:text-white transition-colors">
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 14V2M9 18.12l1-4.12H4.17a2 2 0 0 1-1.92-2.56l2.33-8a2 2 0 0 1 1.92-1.44H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79-1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"/></svg>
          </button>
        </div>

        {(mode === 'IDLE' || mode === 'PLAYBACK' || mode === 'GENERATING') && liveJoinState === 'IDLE' && (
          <div className="flex flex-col items-center gap-3">
            <button 
              onClick={handleOverviewPlay} 
              disabled={mode === 'GENERATING'} 
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-xl active:scale-90 ${mode === 'PLAYBACK' ? 'bg-[#111214] text-white border border-white/10' : 'bg-white text-black'}`}
            >
              {mode === 'PLAYBACK' ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect width="3.5" height="12" x="7.5" y="6" rx="1"/><rect width="3.5" height="12" x="13" y="6" rx="1"/></svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="ml-0.5"><polygon points="5 3 19 12 5 21"/></svg>
              )}
            </button>
            <span className="text-zinc-600 text-[8px] font-black uppercase tracking-[0.15em]">
              {mode === 'GENERATING' ? 'Synthesizing...' : mode === 'PLAYBACK' ? 'Playing' : 'Initialize'}
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="absolute bottom-24 left-0 right-0 px-10 text-center">
          <span className="text-[9px] text-red-500 font-bold bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-500/20">{error}</span>
        </div>
      )}
    </div>
  );
};

export default AudioStudio;
