
import React, { useRef, useState, useMemo } from 'react';
import { Notebook, HostPersonality, PodcastJob, WaveformMode, TranscriptSegment } from '../types';
import { decode, decodeAudioData } from '../utils/audioUtils';
import Waveform from './Waveform';

interface AudioStudioProps {
  notebook: Notebook;
  job?: PodcastJob;
  onBack?: () => void;
  onUpdateNotebook?: (updates: Partial<Notebook>) => void;
  onStartJob: (personality: HostPersonality) => void;
}

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

const AudioStudio: React.FC<AudioStudioProps> = ({ notebook, job, onBack, onStartJob, onUpdateNotebook }) => {
  const [view, setView] = useState<'DASHBOARD' | 'PLAYER'>('DASHBOARD');
  const [isPlaying, setIsPlaying] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [personality, setPersonality] = useState<HostPersonality>(notebook.hostPersonality || 'neutral');
  
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const stopAllAudio = () => {
    sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
    sourcesRef.current.clear();
    setIsPlaying(false);
  };

  const isGenerating = job && 
    ['QUEUED', 'PREFLIGHT', 'OUTLINING', 'SCRIPTING', 'SYNTHESIZING', 'FINALIZING'].includes(job.state) &&
    job.activeEngine !== null;

  /**
   * 🛡️ WAVEFORM MODE (INVARIANT)
   * Derived from app activity. Silent to user errors.
   */
  const waveformMode: WaveformMode = useMemo(() => {
    if (isPlaying) return 'speaking';
    if (isGenerating) return 'thinking';
    return 'idle';
  }, [isPlaying, isGenerating]);

  const initAudio = () => {
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

  const playAudio = async (base64: string) => {
    if (!base64) return;
    const ctx = initAudio();
    if (!ctx || !analyserRef.current) return;
    try {
      stopAllAudio();
      const buffer = await decodeAudioData(decode(base64), ctx, 24000, 1);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(analyserRef.current);
      source.start(0);
      sourcesRef.current.add(source);
      setIsPlaying(true);
      source.onended = () => { 
        sourcesRef.current.delete(source); 
        setIsPlaying(false);
      };
    } catch (e) { console.warn("Audio playback suppressed", e); }
  };

  const handlePlayAction = () => {
    if (isPlaying) { stopAllAudio(); return; }
    if (job?.audio) playAudio(job.audio.audio);
  };

  if (view === 'DASHBOARD') {
    return (
      <div className="flex-1 flex flex-col bg-black overflow-hidden h-full pb-32">
        <header className="px-5 py-4 flex items-center justify-between shrink-0">
          <button onClick={onBack} className="p-2 text-white active:scale-95 transition-transform bg-white/5 rounded-full"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
          <span className="text-[12px] font-axiom font-bold tracking-[0.2em] text-white uppercase">Neural Studio</span>
          <div className="w-9"></div>
        </header>
        <div className="flex-1 overflow-y-auto px-5 no-scrollbar pb-10">
          <div className="mt-4 mb-8">
            <h3 className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] mb-3">Narrative Strategy</h3>
            <button 
              onClick={() => {
                if (job?.state === 'READY') setView('PLAYER');
                else if (!isGenerating) onStartJob(personality);
              }} 
              className={`w-full bg-[#111214] p-5 rounded-[28px] flex items-center justify-between border shadow-xl transition-all ${isGenerating ? 'border-[#4DA3FF]/50 bg-[#4DA3FF]/5' : 'border-white/5'}`}
            >
              <div className="flex items-center gap-4 overflow-hidden">
                <div className={`${isGenerating ? 'text-[#4DA3FF]' : 'text-zinc-400'}`}>
                  {isGenerating ? <div className="w-5 h-5 border-2 border-[#4DA3FF]/20 border-t-[#4DA3FF] rounded-full animate-spin"></div> : <WaveformSparkleIcon />}
                </div>
                <span className="text-white text-base font-bold font-tech truncate max-w-[180px]">{isGenerating ? 'Synthesizing...' : (job?.state === 'READY' ? 'Audio Overview Ready' : 'Generate Summary')}</span>
              </div>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${job?.state === 'READY' ? 'bg-white text-black' : 'bg-white/5 text-zinc-400'}`}>
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>
              </div>
            </button>
          </div>
          <div className="mb-10">
            <h3 className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] mb-3">Host Personality</h3>
            <div className="grid grid-cols-2 gap-2">
              {PERSONALITIES.map((p) => (
                <button key={p.id} onClick={() => { setPersonality(p.id); if (onUpdateNotebook) onUpdateNotebook({ hostPersonality: p.id }); }} disabled={isGenerating} className={`flex items-center justify-between px-4 py-3 rounded-2xl border transition-all ${personality === p.id ? 'bg-[#4DA3FF]/10 border-[#4DA3FF] text-white' : 'bg-[#111214] border-white/5 text-zinc-400'}`}>
                  <span className="text-[10px] font-black uppercase tracking-widest truncate">{p.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-black relative overflow-hidden h-full">
      <div className="absolute top-8 left-0 right-0 px-6 z-[60] flex flex-col items-center pointer-events-none">
        <div className="w-full flex justify-between items-center mb-1 pointer-events-auto">
          <button onClick={() => { setView('DASHBOARD'); stopAllAudio(); }} className="p-2 text-zinc-400 active:text-white transition-all bg-white/5 rounded-full"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
          <button onClick={() => setShowTranscript(!showTranscript)} className={`p-2 transition-colors ${showTranscript ? 'text-[#4DA3FF]' : 'text-zinc-500'}`}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h10"/></svg></button>
        </div>
        <h1 className="text-white text-lg font-bold tracking-tight text-center font-tech">{notebook.title}</h1>
      </div>
      
      <div className="flex-1 flex flex-col relative mt-28 px-6 overflow-hidden">
        {showTranscript ? (
          <div className="flex-1 overflow-y-auto no-scrollbar pb-32 pt-4 flex flex-col gap-6">
            {(job?.audio?.transcript || []).map((seg: TranscriptSegment, idx: number) => (
              <div key={idx} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className={`text-[10px] font-black uppercase tracking-[0.3em] mb-1 ${seg.speaker === 'Alex' ? 'text-[#4DA3FF]' : 'text-emerald-400'}`}>{seg.speaker}</div>
                <p className="text-base font-tech leading-[1.6] text-zinc-200">{seg.text}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center relative">
            <div className="w-60 h-60 rounded-[48px] overflow-hidden shadow-2xl border-2 border-white/10 relative z-10">
              {job?.audio?.artworkUrl ? <img src={job.audio.artworkUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-[#111214] flex items-center justify-center text-[#4DA3FF]"><WaveformSparkleIcon /></div>}
            </div>
            
            {/* 🛡️ WAVEFORM: HERO POSITION (ALWAYS VISIBLE) */}
            <div className="w-full min-h-[160px] mt-8 relative z-[80] overflow-visible pointer-events-auto">
                <Waveform isActive={waveformMode !== 'idle'} analyser={analyserRef.current} intensity={waveformMode === 'thinking' ? 0.3 : 0.8} />
            </div>
          </div>
        )}
      </div>

      <div className="pb-32 px-8 flex flex-col items-center z-[70] relative pointer-events-none">
        <button 
          onClick={handlePlayAction} 
          disabled={!job?.audio} 
          className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-2xl active:scale-90 relative pointer-events-auto ${isPlaying ? 'bg-[#111214] text-white border-2 border-white/20' : 'bg-white text-black disabled:opacity-20'}`}
        >
          {isPlaying ? <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><rect width="4" height="14" x="7" y="5" rx="1.5"/><rect width="4" height="14" x="13" y="5" rx="1.5"/></svg> : <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" className="ml-1.5"><polygon points="5 3 19 12 5 21"/></svg>}
        </button>
      </div>
    </div>
  );
};

export default AudioStudio;
