
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Notebook, Tab, AppState, Source, GeneratedMedia, PodcastJob, HostPersonality, TranscriptSegment, AudioChapter, PodcastJobState, TTSEngine } from './types';
import NotebookList from './components/NotebookList';
import NotebookDetail from './components/NotebookDetail';
import AudioStudio from './components/AudioStudio';
import SplashScreen from './components/SplashScreen';
import { MOCK_NOTEBOOKS } from './constants';
import { GeminiService } from './services/geminiService';
import { decode, encode } from './utils/audioUtils';

const App: React.FC = () => {
  const [isBooting, setIsBooting] = useState(true);
  const [appState, setAppState] = useState<AppState>(AppState.LIST);
  const [notebooks, setNotebooks] = useState<Notebook[]>(MOCK_NOTEBOOKS);
  const [activeNotebookId, setActiveNotebookId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab | null>(Tab.SOURCES);
  const [jobs, setJobs] = useState<Record<string, PodcastJob>>({});
  const [notification, setNotification] = useState<{title: string, body: string, notebookId: string} | null>(null);

  const gemini = useRef(new GeminiService());
  const activeNotebook = notebooks.find(n => n.id === activeNotebookId) || null;

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const activeJobs = useMemo(() => {
    return Object.values(jobs).filter((j: PodcastJob) => 
      ['QUEUED', 'PREFLIGHT', 'OUTLINING', 'SCRIPTING', 'SYNTHESIZING', 'FINALIZING', 'INDEXING'].includes(j.state) && 
      j.activeEngine !== null
    );
  }, [jobs]);

  const handleSelectNotebook = (notebook: Notebook) => {
    setActiveNotebookId(notebook.id);
    setAppState(AppState.DETAIL);
    setActiveTab(Tab.SOURCES);
  };

  const handleJumpToStudio = (notebook: Notebook) => {
    setActiveNotebookId(notebook.id);
    setAppState(AppState.DETAIL);
    setActiveTab(Tab.STUDIO);
  };

  const handleBack = () => {
    setAppState(AppState.LIST);
    setActiveNotebookId(null);
    setActiveTab(Tab.SOURCES);
  };

  const handleAddNotebook = (newNotebook: Notebook) => {
    setNotebooks(prev => [newNotebook, ...prev]);
    setActiveNotebookId(newNotebook.id);
    setAppState(AppState.DETAIL);
    setActiveTab(Tab.SOURCES);
  };

  const handleUpdateNotebook = (notebookId: string, updates: Partial<Notebook>) => {
    setNotebooks(prev => prev.map(n => n.id === notebookId ? { ...n, ...updates } : n));
  };

  /**
   * 🛡️ BACKGROUND INDEXING
   */
  const handleAddSource = (notebookId: string, source: Source) => {
    setNotebooks(prev => prev.map(n => n.id === notebookId ? { ...n, sources: [source, ...n.sources] } : n));
    
    // Simulate background sync
    setTimeout(() => {
      setNotebooks(prev => prev.map(n => n.id === notebookId ? { 
        ...n, 
        sources: n.sources.map(s => s.id === source.id ? { ...s, indexed: true } : s)
      } : n));
    }, 2000);
  };

  const handleUpdateSummary = (notebookId: string, summary: string) => {
    setNotebooks(prev => prev.map(n => n.id === notebookId ? { ...n, summary, isGeneratingSummary: false } : n));
  };

  const handleSetGeneratingSummary = (notebookId: string, isGenerating: boolean) => {
    setNotebooks(prev => prev.map(n => n.id === notebookId ? { ...n, isGeneratingSummary: isGenerating } : n));
  };

  const handleAddGeneratedMedia = (notebookId: string, media: GeneratedMedia) => {
    setNotebooks(prev => prev.map(n => n.id === notebookId ? { ...n, generatedMedia: [media, ...(n.generatedMedia || [])] } : n));
  };

  /**
   * 🎧 AUDIO OVERVIEW SYNC
   */
  const createPodcastJob = async (notebookId: string, personality: HostPersonality) => {
    const notebook = notebooks.find(n => n.id === notebookId);
    if (!notebook) return;

    const jobId = `job-${Date.now()}`;
    const initialJob: PodcastJob = {
      jobId, notebookId, state: 'QUEUED', progress: 0.05, mode: 'PRIMARY',
      activeEngine: TTSEngine.GEMINI,
      createdAt: Date.now(), personality, completedChunks: 0, totalChunks: 5,
      partialAudioBuffers: [], partialTranscript: []
    };

    setJobs(prev => ({ ...prev, [notebookId]: initialJob }));

    const setJobState = (state: PodcastJobState, progress: number, updates: Partial<PodcastJob> = {}) => {
      setJobs(prev => {
        const current = prev[notebookId];
        if (!current) return prev;
        return { ...prev, [notebookId]: { ...current, state, progress, ...updates } };
      });
    };

    try {
      setJobState('PREFLIGHT', 0.1);
      const outline = await gemini.current.generateOutline(notebook);
      const artwork = await gemini.current.generateEpisodeArtwork(notebook);

      const chunks = (outline && outline.outline) ? outline.outline : [];
      const audioChunks: string[] = [];
      const transcript: TranscriptSegment[] = [];

      for (let i = 0; i < chunks.length; i++) {
        setJobState('SCRIPTING', 0.2 + (i * 0.1));
        const chunkResult = await gemini.current.generateScriptChunk(notebook, outline, i, personality);

        setJobState('SYNTHESIZING', 0.25 + (i * 0.1));
        const audioBase64 = await gemini.current.generateTTSChunk(chunkResult.script || chunkResult.text);

        if (audioBase64) {
          audioChunks.push(audioBase64);
          const segs: TranscriptSegment[] = (chunkResult.transcript || []).length > 0 
            ? chunkResult.transcript 
            : [{ id: `seg-${i}`, speaker: chunkResult.speaker || 'Alex', text: chunkResult.script || chunkResult.text, startMs: i*60000, endMs: (i+1)*60000 }];
          transcript.push(...segs);
        }

        setJobState('SYNTHESIZING', 0.25 + (i * 0.1), { completedChunks: i + 1 });
      }

      setJobState('FINALIZING', 0.95);
      const validChunks = audioChunks.filter(c => !!c);
      let finalAudioEncoded = '';
      
      if (validChunks.length > 0) {
        const decodedChunks = validChunks.map(c => decode(c));
        const totalLength = decodedChunks.reduce((acc, val) => acc + val.length, 0);
        const mergedAudio = new Uint8Array(totalLength);
        let offset = 0;
        for (const data of decodedChunks) { mergedAudio.set(data, offset); offset += data.length; }
        finalAudioEncoded = encode(mergedAudio);
      }

      setJobState('READY', 1.0, {
        activeEngine: null,
        audio: { audio: finalAudioEncoded, chapters: [], transcript, artworkUrl: artwork || undefined },
        completedChunks: chunks.length,
        totalChunks: chunks.length || 1
      });

      if (finalAudioEncoded) {
        handleAddGeneratedMedia(notebookId, {
          id: jobId, type: 'AUDIO', title: `Deep Narrative: ${notebook.title}`,
          sourceCount: notebook.sources.length, createdAt: Date.now(),
          artworkUrl: artwork || undefined, transcript, audioBase64: finalAudioEncoded
        });
        
        /**
         * 🔔 SUCCESS-ONLY NOTIFICATION (INVARIANT)
         */
        setNotification({ title: "🎧 Sync Complete", body: "Audio overview is ready.", notebookId: notebook.id });
      }
    } catch (e: any) {
      console.warn("[AXIOM SILENT RECOVERY]", e);
      setJobState('READY', 1.0, { activeEngine: null }); 
    }
  };

  const renderContent = () => {
    if (appState === AppState.LIST) return <NotebookList notebooks={notebooks} onSelect={handleSelectNotebook} onAddNotebook={handleAddNotebook} onJumpToStudio={handleJumpToStudio} jobs={jobs} />;
    if (!activeNotebook) return null;
    if (activeTab === Tab.STUDIO) return <AudioStudio notebook={activeNotebook} job={jobs[activeNotebook.id]} onBack={handleBack} onStartJob={(p) => createPodcastJob(activeNotebook.id, p)} onUpdateNotebook={(updates) => handleUpdateNotebook(activeNotebook.id, updates)} />;
    return <NotebookDetail notebook={activeNotebook} onBack={handleBack} activeTab={activeTab as Tab} setActiveTab={setActiveTab as any} onAddSource={(s) => handleAddSource(activeNotebook.id, s)} onUpdateSummary={handleUpdateSummary} onSetGeneratingSummary={handleSetGeneratingSummary} job={jobs[activeNotebook.id]} />;
  };

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-black text-white relative overflow-hidden">
      {isBooting && <SplashScreen onComplete={() => setIsBooting(false)} />}
      {!isBooting && (
        <>
          {activeJobs.length > 0 && (
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-white/5 z-[200]">
               <div className="h-full bg-[#4DA3FF] transition-all duration-500 shadow-[0_0_10px_#4DA3FF]" style={{ width: `${Math.max(...activeJobs.map(j => j.progress)) * 100}%` }} />
            </div>
          )}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">{renderContent()}</div>
          {notification && (
            <div className="absolute top-12 left-0 right-0 z-[100] px-6 flex justify-center animate-in slide-in-from-top-4 duration-500">
              <div onClick={() => { setActiveNotebookId(notification.notebookId); setAppState(AppState.DETAIL); setActiveTab(Tab.STUDIO); setNotification(null); }} className="bg-[#111214] border-2 border-[#4DA3FF] rounded-[24px] p-5 shadow-2xl flex items-center gap-4 cursor-pointer max-w-sm w-full active:scale-95 transition-transform">
                 <div className="w-12 h-12 bg-[#4DA3FF] rounded-2xl flex items-center justify-center text-black font-bold">SY</div>
                 <div className="flex-1">
                   <div className="text-sm font-bold font-tech text-white">{notification.title}</div>
                   <div className="text-[10px] text-zinc-400 font-tech uppercase tracking-wider">{notification.body}</div>
                 </div>
              </div>
            </div>
          )}
          {activeNotebook && (
            <nav className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-2xl border-t border-white/5 pb-safe z-50">
              <div className="flex items-center justify-around h-14 px-4">
                <button onClick={() => setActiveTab(Tab.SOURCES)} className={`flex flex-col items-center transition-all px-4 ${activeTab === Tab.SOURCES ? 'text-white' : 'text-zinc-500'}`}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg></button>
                <button onClick={() => setActiveTab(Tab.CHAT)} className={`flex flex-col items-center transition-all px-4 ${activeTab === Tab.CHAT ? 'text-white' : 'text-zinc-500'}`}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></button>
                <button onClick={() => setActiveTab(Tab.STUDIO)} className={`flex flex-col items-center transition-all px-4 relative ${activeTab === Tab.STUDIO ? 'text-white' : 'text-zinc-500'}`}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20"/><path d="M2 12h20"/><path d="m4.93 4.93 14.14 14.14"/></svg>
                  {jobs[activeNotebook.id] && ['SYNTHESIZING', 'SCRIPTING', 'FINALIZING'].includes(jobs[activeNotebook.id].state) && jobs[activeNotebook.id].activeEngine !== null && (
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-[#4DA3FF] rounded-full animate-pulse shadow-[0_0_5px_#4DA3FF]"></div>
                  )}
                </button>
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  );
};

export default App;
