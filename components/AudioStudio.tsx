
import React, { useState, useRef, useEffect } from 'react';
import { Notebook, AudioChapter, TranscriptSegment, GeneratedMedia, HostPersonality, PodcastJob, GenerationMode } from '../types';
import { decode, decodeAudioData } from '../utils/audioUtils';
import Waveform from './Waveform';

interface AudioStudioProps {
  notebook: Notebook;
  job?: PodcastJob;
  onDeleteMedia?: (mediaId: string) => void;
  onBack?: () => void;
  onAddGeneratedMedia?: (media: GeneratedMedia) => void;
  onUpdateNotebook?: (updates: Partial<Notebook>) => void;
  onStartJob: (personality: HostPersonality) => void;
}

type AudioMode = 'IDLE' | 'PLAYBACK';
type StudioView = 'DASHBOARD' | 'PLAYER';

/**
 * 🔒 CANONICAL GENERATION STATE MACHINE (LOCKED V4)
 * Prevents Error UI from appearing.
 */
type GenerationState = 'IDLE' | 'GENERATING' | 'STREAMING' | 'COMPLETE' | 'FAILED_QUOTA' | 'QUOTA_PAUSED' | 'QUOTA_BLOCKED' | 'OPTIMIZING';
type LiveSessionState = 'unavailable' | 'available' | 'joining' | 'listening';

const WaveformSparkleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 12V15M7 10V17M10 8V19M13 11V16M16 13V14M19 12V13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M18 4L19 6L21 7L19 8L18 10L17 8L15 7L17 6L18 4Z" fill="currentColor"/>
  </svg>
);

const PERSONALITIES: { id: HostPersonality; label: string; desc: string }[] = [
  { id: 'neutral', label: 'Neutral', desc: 'Balanced' },
  { id: 'curious', label: 'Curious', desc: 'Exploratory' },
  { id: 'analytical', label: 'Analytical', desc: 'Logical' },
  { id: 'warm', label: 'Warm', desc: 'Reflective' },
  { id: 'debate', label: 'Debate', desc: 'Spirited' },
  { id: 'visionary', label: 'Visionary', desc: 'Future' },
];

const AudioStudio: React.FC<AudioStudioProps> = ({ notebook, job, onDeleteMedia, onBack, onAddGeneratedMedia, onUpdateNotebook, onStartJob }) => {
  const [view, setView] = useState<StudioView>('DASHBOARD');
  const [mode, setMode] = useState<AudioMode>('IDLE');
  const [isJoining, setIsJoining] = useState(false);
  const [chapters, setChapters] = useState<AudioChapter[]>(notebook.chapters || []);
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(1);
  const [activeArtwork, setActiveArtwork] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [personality, setPersonality] = useState<HostPersonality>(notebook.hostPersonality || 'neutral');
  
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const rafRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const getAudioCtx = () => {
    if (!audioCtxRef.current) {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.connect(ctx.destination);
        
        audioCtxRef.current = ctx;
        analyserRef.current = analyser;
    }
    return audioCtxRef.current;
  };

  const stopAllAudio = () => {
    sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
    sourcesRef.current.clear();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  };

  const handlePlayREADY = async (jumpToEdge = false, customAudio?: string, customChapters?: AudioChapter[], customTranscript?: TranscriptSegment[]) => {
    if (mode === 'PLAYBACK' && !jumpToEdge) {
      stopAllAudio();
      setMode('IDLE');
      return;
    }

    const audioData = customAudio || job?.audio?.audio;
    if (!audioData) return;

    try {
      if (jumpToEdge) setIsJoining(true);
      
      const targetChapters = customChapters || job?.audio?.chapters || [];
      const targetTranscript = customTranscript || job?.audio?.transcript || [];
      
      setChapters(targetChapters);
      setTranscript(targetTranscript);
      setActiveArtwork(job?.audio?.artworkUrl || null);
      
      const ctx = getAudioCtx();
      const analyser = analyserRef.current!;
      stopAllAudio();

      const buffer = await decodeAudioData(decode(audioData), ctx, 24000, 1);
      setTotalDuration(buffer.duration);
      
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(analyser);
      source.onended = () => { if (mode === 'PLAYBACK') setMode('IDLE'); sourcesRef.current.delete(source); };
      
      sourcesRef.current.add(source);
      const physicalStartTime = ctx.currentTime;
      
      const playOffset = jumpToEdge ? Math.max(0, buffer.duration - 0.5) : 0;
      source.start(0, playOffset);
      setMode('PLAYBACK');
      if (jumpToEdge) setIsJoining(false);

      const updateProgress = () => {
        const elapsed = (ctx.currentTime - physicalStartTime) + playOffset;
        setCurrentTime(elapsed);
        rafRef.current = requestAnimationFrame(updateProgress);
      };
      updateProgress();

    } catch (err: any) {
      setMode('IDLE');
      setIsJoining(false);
    }
  };

  const handleUpdatePersonality = (p: HostPersonality) => {
    setPersonality(p);
    if (onUpdateNotebook) onUpdateNotebook({ hostPersonality: p });
  };

  /**
   * GENERATION STATE MAPPING (LOCKED V4)
   * Hard Rule: Error states are mapped to 'GENERATING' visuals to maintain trust.
   */
  const getGenerationState = (): GenerationState => {
    if (!job) return 'IDLE';
    switch (job.state) {
      case 'QUOTA_PAUSED':
      case 'QUOTA_BLOCKED':
      case 'OPTIMIZING':
      case 'FAILED': return 'GENERATING';
      case 'READY': return 'STREAMING';
      case 'IDLE': return 'IDLE';
      default: return 'GENERATING';
    }
  };

  const generationState = getGenerationState();

  /**
   * LIVE SESSION STATE LOGIC (LOCKED)
   */
  const getLiveSessionState = (): LiveSessionState => {
    if (generationState === 'IDLE') return 'unavailable';
    if (isJoining) return 'joining';
    if (mode === 'PLAYBACK') return 'listening';
    return 'available';
  };

  const liveState = getLiveSessionState();

  /**
   * ABSOLUTE RENDERING VISIBILITY (LOCKED)
   * The Join Live anchor MUST ALWAYS remain present and mounted.
   */
  const showJoinLive = generationState !== 'IDLE';

  const activeChapter = chapters.find(c => (currentTime * 1000) >= c.startMs && (currentTime * 1000) <= c.endMs);
  const activeSegment = transcript.find(s => (currentTime * 1000) >= s.startMs && (currentTime * 1000) <= s.endMs);

  /**
   * APPROVED UI COPY ONLY (LOCKED)
   * Hard Rule: Never show "Error", "Failed", or "Quota".
   */
  const getJobLabel = () => {
    if (!job) return "IDLE";
    if (job.mode === 'OPTIMIZED' || job.state === 'OPTIMIZING') return 'Using optimized generation...';
    
    switch (job.state) {
      case 'QUEUED': return 'Preparing hosts...';
      case 'PREFLIGHT': return 'Structuring discussion...';
      case 'OUTLINING': return 'Generating episode...';
      case 'SCRIPTING': return `Writing segment ${job.completedChunks + 1}...`;
      case 'SYNTHESIZING': return 'Preparing voices...';
      case 'FINALIZING': return 'Polishing audio...';
      case 'READY': return 'Ready';
      default: return 'Generating episode...';
    }
  };

  const getJoinLiveLabel = (state: LiveSessionState) => {
    switch (state) {
      case 'joining': return 'JOINING…';
      case 'listening': return 'LISTENING LIVE';
      default: return 'JOIN LIVE';
    }
  };

  if (view === 'DASHBOARD') {
    return (
      <div className="flex-1 flex flex-col bg-black overflow-hidden h-full pb-32">
        <header className="px-5 py-4 flex items-center justify-between shrink-0">
          <button onClick={onBack} className="p-2 text-white active:scale-95 transition-transform"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
          <span className="text-[12px] font-axiom font-bold tracking-[0.2em] text-white uppercase">Neural Studio</span>
          <div className="w-9"></div>
        </header>
        <div className="flex-1 overflow-y-auto px-5 no-scrollbar">
          {/** 1. Sync Narrative Status Section */}
          <div className="mt-4 mb-6">
            <h3 className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] mb-3">Sync Narrative</h3>
            <button 
              onClick={() => {
                if (generationState !== 'IDLE') {
                   setView('PLAYER');
                   if (mode !== 'PLAYBACK' && job?.audio) handlePlayREADY();
                } else {
                   onStartJob(personality);
                }
              }} 
              className={`w-full bg-[#111214] p-5 rounded-[28px] flex items-center justify-between border shadow-xl group transition-all ${generationState === 'GENERATING' ? 'border-[#4DA3FF]/50 bg-[#4DA3FF]/5' : 'border-white/5'}`}
            >
              <div className="flex items-center gap-4">
                <div className={`${generationState === 'GENERATING' ? 'text-[#4DA3FF]' : 'text-zinc-400'}`}>
                  {generationState === 'GENERATING' ? <div className="w-5 h-5 border-2 border-[#4DA3FF]/20 border-t-[#4DA3FF] rounded-full animate-spin"></div> : <WaveformSparkleIcon />}
                </div>
                <div className="flex flex-col items-start text-left overflow-hidden">
                   <span className="text-white text-base font-bold font-tech truncate max-w-[180px]">{getJobLabel()}</span>
                   {(job?.mode === 'OPTIMIZED' || job?.state === 'OPTIMIZING') && <span className="text-[8px] text-[#4DA3FF] font-bold uppercase tracking-widest mt-0.5">Fast Synthesis Active</span>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                 {generationState === 'GENERATING' && <span className="text-[9px] font-black uppercase tracking-widest text-[#4DA3FF] animate-pulse">Live</span>}
                 <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-zinc-400 group-hover:bg-white group-hover:text-black transition-all">
                   {generationState === 'GENERATING' || generationState === 'STREAMING' ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg> : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>}
                 </div>
              </div>
            </button>
          </div>

          {/** 2. Personality Core Section */}
          <div className="mb-8">
            <h3 className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] mb-3">Personality Core</h3>
            <div className="grid grid-cols-2 gap-2">
              {PERSONALITIES.map((p) => (
                <button 
                  key={p.id} 
                  onClick={() => handleUpdatePersonality(p.id)}
                  disabled={generationState === 'GENERATING'}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-2xl transition-all border group active:scale-[0.98] ${personality === p.id ? 'bg-[#4DA3FF]/10 border-[#4DA3FF] text-white' : 'bg-[#111214] border-white/5 text-zinc-400'} ${generationState === 'GENERATING' ? 'opacity-40 grayscale' : ''}`}
                >
                  <div className="flex flex-col items-start text-left overflow-hidden">
                    <span className="text-[10px] font-bold font-tech uppercase tracking-widest truncate w-full">{p.label}</span>
                    <span className="text-[8px] opacity-60 mt-0.5 truncate w-full">{p.desc}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/** 
           * 🛡️ 3. GENERATED MEDIA OUTPUT (LOCKED POSITION)
           * This must ALWAYS mount and render if media exists.
           */}
          <div className="mb-24">
            <h3 className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] mb-3">Grounded Intelligence Assets</h3>
            {notebook.generatedMedia && notebook.generatedMedia.length > 0 ? (
              <div className="flex flex-col gap-3">
                {notebook.generatedMedia.map((media) => (
                  <div 
                    key={media.id} 
                    onClick={() => {
                      setView('PLAYER');
                      handlePlayREADY(false, media.audioBase64, media.chapters, media.transcript);
                    }}
                    className="bg-[#111214] border border-white/5 p-4 rounded-[24px] flex items-center justify-between group active:scale-[0.98] transition-all cursor-pointer shadow-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-[#4DA3FF] border border-white/5">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="M2 12h20"/><path d="m4.93 4.93 14.14 14.14"/></svg>
                      </div>
                      <div className="flex flex-col overflow-hidden">
                        <span className="text-white text-sm font-bold font-tech truncate max-w-[140px]">{media.title}</span>
                        <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">{media.duration} • {new Date(media.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-zinc-500 group-hover:bg-[#4DA3FF] group-hover:text-black transition-all">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-[#111214] border border-dashed border-white/10 p-8 rounded-[32px] flex flex-col items-center justify-center text-center opacity-40">
                <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center mb-3">
                   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2v20"/><path d="M2 12h20"/></svg>
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Vault has no active narratives</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-black relative overflow-hidden h-full">
      <div className="absolute top-8 left-0 right-0 px-6 z-20 flex flex-col items-center">
        <div className="w-full flex justify-between items-center mb-1">
          <button onClick={() => { setView('DASHBOARD'); }} className="p-2 text-zinc-400 active:text-white transition-all"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
          <button onClick={() => setShowTranscript(!showTranscript)} className={`p-2 transition-colors ${showTranscript ? 'text-[#4DA3FF]' : 'text-zinc-500'}`}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h10"/></svg></button>
        </div>
        <h2 className="text-zinc-600 text-[9px] font-black tracking-[0.3em] uppercase mb-0.5">Grounded Unit Overview</h2>
        <h1 className="text-white text-lg font-bold tracking-tight text-center truncate w-full px-8 font-tech">{notebook.title}</h1>
      </div>

      <div className="flex-1 flex flex-col relative mt-28 px-6 overflow-hidden">
        {showTranscript ? (
          <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar pb-32 pt-4 flex flex-col gap-6">
            {transcript.map((seg, idx) => (
              <div key={`${seg.id}-${idx}`} className={`transition-all duration-500 ${activeSegment?.id === seg.id ? 'opacity-100 scale-100' : 'opacity-25 scale-[0.98]'}`}>
                <div className={`text-[10px] font-black uppercase tracking-[0.3em] mb-1 ${seg.speaker === 'Alex' ? 'text-[#4DA3FF]' : 'text-emerald-400'}`}>{seg.speaker}</div>
                <p className="text-base font-tech leading-[1.6] text-zinc-200">{seg.text}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="w-60 h-60 rounded-[48px] overflow-hidden shadow-2xl border-2 border-white/10 relative group animate-in zoom-in duration-700">
              {activeArtwork ? <img src={activeArtwork} className="w-full h-full object-cover" /> : (job?.audio?.artworkUrl ? <img src={job.audio.artworkUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-[#111214] flex items-center justify-center text-[#4DA3FF]"><WaveformSparkleIcon /></div>)}
            </div>
            <div className="w-full h-32 mt-12">
                <Waveform isActive={mode === 'PLAYBACK'} analyser={analyserRef.current} />
            </div>
          </div>
        )}
      </div>

      {/** 4. Playback / Footer Controls */}
      <div className="pb-32 px-8 flex flex-col items-center z-20">
        <div className="flex flex-col items-center w-full relative">
          
          {/** 
           * 🔒 JOIN LIVE LAYOUT ANCHOR (NEVER JUMPS, NEVER RE-MOUNTS)
           */}
          <div className="live-anchor h-[64px] mb-4 w-full flex items-center justify-center pointer-events-none">
            <button 
              onClick={() => handlePlayREADY(true)}
              disabled={!job?.audio || liveState === 'joining'}
              aria-hidden={!showJoinLive}
              style={{
                opacity: showJoinLive ? 1 : 0,
                pointerEvents: showJoinLive ? 'auto' : 'none',
                transition: 'opacity 0.4s ease-in-out, transform 0.4s ease-in-out',
                transform: showJoinLive ? 'translateY(0)' : 'translateY(10px)'
              }}
              className={`px-8 py-3 rounded-full font-black text-[10px] uppercase tracking-[0.4em] shadow-2xl border-2 pointer-events-auto ${liveState === 'listening' ? 'bg-[#4DA3FF]/10 text-[#4DA3FF] border-[#4DA3FF] animate-pulse' : 'bg-[#4DA3FF] text-black border-white shadow-[#4DA3FF]/50 active:scale-95'}`}
            >
              {getJoinLiveLabel(liveState)}
            </button>
          </div>

          <div className="flex flex-col items-center gap-4">
              {(generationState === 'GENERATING') && (
                <span className={`text-[10px] font-black uppercase tracking-[0.4em] mb-2 text-zinc-600`}>
                  {getJobLabel()}
                </span>
              )}
              <button onClick={() => handlePlayREADY(false)} disabled={!job?.audio && !transcript.length} className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-2xl active:scale-90 ${mode === 'PLAYBACK' ? 'bg-[#111214] text-white border-2 border-white/20' : 'bg-white text-black disabled:opacity-20'}`}>
                {mode === 'PLAYBACK' ? <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><rect width="4" height="14" x="7" y="5" rx="1.5"/><rect width="4" height="14" x="13" y="5" rx="1.5"/></svg> : <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" className="ml-1.5"><polygon points="5 3 19 12 5 21"/></svg>}
              </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AudioStudio;
