
import React, { useState, useRef, useEffect } from 'react';
import { Notebook, Tab, Message, Source } from '../types';
import { GeminiService, SearchResult } from '../services/geminiService';
import AudioStudio from './AudioStudio';

interface NotebookDetailProps {
  notebook: Notebook;
  onBack: () => void;
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  onAddSource: (source: Source) => void;
  onUpdateSummary: (notebookId: string, summary: string) => void;
  onSetGeneratingSummary: (notebookId: string, isGenerating: boolean) => void;
}

/**
 * 🔒 TYPOGRAPHY SYSTEM (ENFORCED - SCALED FOR MOBILE)
 */
const Typography = {
  title: {
    fontSize: "20px",
    fontWeight: "600",
    lineHeight: "26px",
    color: "#FFFFFF",
    marginBottom: "10px",
  },
  section: {
    fontSize: "15px",
    fontWeight: "600",
    lineHeight: "20px",
    color: "#FFFFFF",
    marginTop: "16px",
    marginBottom: "6px",
  },
  body: {
    fontSize: "13.5px",
    lineHeight: "20px",
    color: "#B6B6C2",
    marginBottom: "10px",
  },
  listItem: {
    fontSize: "13.5px",
    lineHeight: "20px",
    color: "#B6B6C2",
    marginBottom: "4px",
  },
};

type Block =
  | { type: 'section'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] };

/**
 * ✅ PARSER (MARKDOWN-LITE)
 */
export function parseMarkdownLite(input: string): Block[] {
  const lines = input.split('\n');
  const blocks: Block[] = [];

  let currentList: string[] = [];
  let currentParagraph: string[] = [];

  const flushParagraph = () => {
    if (currentParagraph.length) {
      blocks.push({
        type: 'paragraph',
        text: currentParagraph.join(' '),
      });
      currentParagraph = [];
    }
  };

  const flushList = () => {
    if (currentList.length) {
      blocks.push({ type: 'list', items: currentList });
      currentList = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    if (trimmed.startsWith('## ')) {
      flushParagraph();
      flushList();
      blocks.push({
        type: 'section',
        text: trimmed.replace('## ', ''),
      });
      continue;
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
      flushParagraph();
      currentList.push(trimmed.slice(2));
      continue;
    }

    currentParagraph.push(trimmed);
  }

  flushParagraph();
  flushList();

  return blocks;
}

/**
 * ✅ REACT RENDERER
 */
export function RichText({ content }: { content: string }) {
  const blocks = parseMarkdownLite(content);

  return (
    <div style={{ wordBreak: 'break-word' }}>
      {blocks.map((block, i) => {
        if (block.type === 'section') {
          return (
            <div key={i} style={Typography.section}>
              {block.text}
            </div>
          );
        }

        if (block.type === 'paragraph') {
          // Hard UI Guardrail
          const text = block.text.length > 500 ? block.text.slice(0, 500) + '...' : block.text;
          return (
            <div key={i} style={Typography.body}>
              {text}
            </div>
          );
        }

        if (block.type === 'list') {
          return (
            <div key={i} style={{ marginBottom: '10px' }}>
              {block.items.map((item, j) => (
                <div key={j} style={Typography.listItem}>
                  • {item}
                </div>
              ))}
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}

const NotebookDetail: React.FC<NotebookDetailProps> = ({ 
  notebook, 
  onBack, 
  activeTab, 
  setActiveTab, 
  onAddSource,
  onUpdateSummary,
  onSetGeneratingSummary
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showAddSourceOverlay, setShowAddSourceOverlay] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedSearchUris, setSelectedSearchUris] = useState<Set<string>>(new Set());

  const [activeModal, setActiveModal] = useState<'WEBSITE' | 'YOUTUBE' | 'TEXT' | null>(null);
  const [modalValue, setModalValue] = useState('');
  const [modalTitle, setModalTitle] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const gemini = useRef(new GeminiService());

  const indexedSourceCount = notebook.sources.length;
  const summaryReady = indexedSourceCount > 0;
  const summaryExists = !!notebook.summary && notebook.summary.trim().length > 20 && !notebook.summary.includes('Add sources');

  useEffect(() => {
    if (summaryReady && !summaryExists && !notebook.isGeneratingSummary) {
      const autoSummary = async () => {
        onSetGeneratingSummary(notebook.id, true);
        try {
          const newSummary = await gemini.current.generateSummary(notebook);
          onUpdateSummary(notebook.id, newSummary);
        } catch (e) {
          onSetGeneratingSummary(notebook.id, false);
        }
      };
      autoSummary();
    }
  }, [summaryReady, summaryExists, notebook.id, notebook.isGeneratingSummary]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsTyping(true);

    try {
      const response = await gemini.current.generateChatResponse(notebook, userMsg);
      setMessages(prev => [...prev, { role: 'model', text: response }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'model', text: 'Error generating response.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleWebSearch = async () => {
    if (!searchQuery.trim() || isSearching) return;
    setIsSearching(true);
    setSearchResults([]);
    setSelectedSearchUris(new Set());
    try {
      const results = await gemini.current.performWebSearch(searchQuery);
      setSearchResults(results);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const toggleSearchResultSelection = (uri: string) => {
    const next = new Set(selectedSearchUris);
    if (next.has(uri)) {
      next.delete(uri);
    } else {
      next.add(uri);
    }
    setSelectedSearchUris(next);
  };

  const toggleSelectAll = () => {
    if (selectedSearchUris.size === searchResults.length) {
      setSelectedSearchUris(new Set());
    } else {
      setSelectedSearchUris(new Set(searchResults.map(r => r.uri)));
    }
  };

  const handleAddSelectedSources = () => {
    const selected = searchResults.filter(r => selectedSearchUris.has(r.uri));
    selected.forEach(result => {
      onAddSource({
        id: Math.random().toString(36).substr(2, 9),
        type: 'url',
        title: result.title,
        content: `Source content from ${result.uri}. Grounded content placeholder.`,
      });
    });
    setSearchResults([]);
    setSelectedSearchUris(new Set());
    setSearchQuery('');
    setShowAddSourceOverlay(false);
  };

  const handleAddSourceComplete = () => {
    if (!modalValue.trim()) return;
    let type: 'text' | 'url' | 'pdf' = 'text';
    let title = modalTitle.trim() || modalValue.trim().substring(0, 30);
    if (activeModal === 'WEBSITE' || activeModal === 'YOUTUBE') type = 'url';

    onAddSource({
      id: Math.random().toString(36).substr(2, 9),
      type,
      title,
      content: modalValue,
    });
    setModalValue('');
    setModalTitle('');
    setActiveModal(null);
    setShowAddSourceOverlay(false);
  };

  const triggerFileUpload = (type: 'PDF' | 'Audio' | 'Image') => {
    if (fileInputRef.current) {
      if (type === 'PDF') fileInputRef.current.accept = '.pdf';
      else if (type === 'Audio') fileInputRef.current.accept = 'audio/*';
      else fileInputRef.current.accept = 'image/*';
      
      fileInputRef.current.onchange = (e: any) => {
        const file = e.target.files?.[0];
        if (file) {
          onAddSource({
            id: Math.random().toString(36).substr(2, 9),
            type: type === 'PDF' ? 'pdf' : 'text',
            title: file.name,
            content: `Uploaded file placeholder: ${file.name}`,
          });
          setShowAddSourceOverlay(false);
        }
      };
      fileInputRef.current.click();
    }
  };

  const renderSourceModal = () => {
    if (!activeModal) return null;
    const config = {
      WEBSITE: { title: 'Ingest Website', placeholder: 'Enter URL (e.g. https://example.com)', type: 'url' },
      YOUTUBE: { title: 'Ingest YouTube', placeholder: 'Enter Video URL', type: 'url' },
      TEXT: { title: 'Sync Plaintext', placeholder: 'Paste knowledge buffer here...', type: 'textarea' }
    }[activeModal];

    return (
      <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[210] flex items-center justify-center p-6">
        <div className="bg-[#111214] w-full max-w-sm rounded-[32px] p-6 border border-white/10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-[#4DA3FF]"></div>
          <h3 className="text-lg font-axiom font-bold mb-4 text-white text-center tracking-widest">{config.title}</h3>
          <input 
            type="text" placeholder="Grounded Title (Optional)"
            value={modalTitle} onChange={(e) => setModalTitle(e.target.value)}
            className="w-full bg-white/5 border border-white/5 rounded-xl p-3 text-white text-xs outline-none mb-3 font-tech"
          />
          {config.type === 'textarea' ? (
            <textarea 
              autoFocus rows={4} placeholder={config.placeholder}
              value={modalValue} onChange={(e) => setModalValue(e.target.value)}
              className="w-full bg-white/5 border border-white/5 rounded-xl p-3 text-white text-xs outline-none mb-4 resize-none font-tech"
            />
          ) : (
            <input 
              autoFocus type="text" placeholder={config.placeholder}
              value={modalValue} onChange={(e) => setModalValue(e.target.value)}
              className="w-full bg-white/5 border border-white/5 rounded-xl p-3 text-white text-xs outline-none mb-4 font-tech"
            />
          )}
          <div className="flex gap-3">
            <button onClick={() => setActiveModal(null)} className="flex-1 py-3 text-zinc-500 font-bold text-[10px] uppercase tracking-widest">Abort</button>
            <button onClick={handleAddSourceComplete} disabled={!modalValue.trim()} className="flex-1 bg-white text-black py-3 rounded-full font-bold text-[10px] uppercase tracking-widest disabled:opacity-50 transition-all active:scale-95">Incorporate</button>
          </div>
        </div>
      </div>
    );
  };

  const renderAddSourceView = () => (
    <div className="fixed inset-0 bg-black z-[200] flex flex-col pt-safe px-6 overflow-hidden">
      <div className="flex justify-end pt-4 mb-6 shrink-0">
        <button onClick={() => setShowAddSourceOverlay(false)} className="p-2 text-white active:scale-90 transition-transform">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>
      <div className="text-center mb-6 shrink-0">
        <h2 className="text-[20px] font-bold text-white leading-tight font-tech">
          Create audio overviews<br />from <span className="shimmer-text">your documents</span>
        </h2>
      </div>
      <div className="relative mb-6 shrink-0">
        <div className="absolute inset-0 border-[2px] border-[#4DA3FF] rounded-[16px] pointer-events-none opacity-40"></div>
        <input 
          type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleWebSearch()}
          placeholder="Search global intelligence"
          className="w-full bg-transparent p-4 pr-14 text-zinc-200 outline-none text-base font-tech placeholder-zinc-600"
        />
        <button onClick={handleWebSearch} disabled={isSearching} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center text-zinc-200 disabled:opacity-50 transition-all active:scale-90">
          {isSearching ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto no-scrollbar pb-10">
        {searchResults.length > 0 ? (
          <div className="flex flex-col gap-3 mb-24">
            <div className="flex items-center justify-between px-1">
              <h4 className="text-zinc-500 text-[9px] font-black uppercase tracking-[0.2em]">Vault Matches</h4>
              <button onClick={toggleSelectAll} className="text-[#4DA3FF] text-[9px] font-black uppercase tracking-widest">{selectedSearchUris.size === searchResults.length ? 'Discard All' : 'Acquire All'}</button>
            </div>
            {searchResults.map((result, i) => (
              <div key={i} onClick={() => toggleSearchResultSelection(result.uri)} className={`bg-[#111214] border p-4 rounded-[20px] flex items-center gap-4 transition-all cursor-pointer ${selectedSearchUris.has(result.uri) ? 'border-[#4DA3FF]' : 'border-white/5'}`}>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${selectedSearchUris.has(result.uri) ? 'bg-[#4DA3FF] border-[#4DA3FF]' : 'border-zinc-800'}`}>
                  {selectedSearchUris.has(result.uri) && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
                <div className="overflow-hidden flex-1">
                  <div className="text-white text-sm font-bold truncate mb-0.5 font-tech">{result.title}</div>
                  <div className="text-zinc-500 text-[10px] truncate uppercase tracking-tighter opacity-60">{result.uri}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            <input type="file" ref={fileInputRef} className="hidden" />
            <div className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-600 mb-1 mt-2 text-center">Physical Uplink</div>
            <div className="grid grid-cols-2 gap-3">
               <button 
                onClick={() => triggerFileUpload('PDF')} 
                className="bg-[#111214] border border-white/5 p-4 rounded-[24px] flex flex-col items-center gap-2 active:bg-white/5 active:border-[#4DA3FF] transition-all group"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500 group-active:text-[#4DA3FF]"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                <span className="font-tech font-bold text-zinc-300 text-xs uppercase tracking-widest">PDF</span>
              </button>
               <button 
                onClick={() => triggerFileUpload('Audio')} 
                className="bg-[#111214] border border-white/5 p-4 rounded-[24px] flex flex-col items-center gap-2 active:bg-white/5 active:border-[#4DA3FF] transition-all group"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500 group-active:text-[#4DA3FF]"><path d="M12 2v20"/><path d="M2 12h20"/><path d="M6 12v4"/><path d="M18 12v4"/></svg>
                <span className="font-tech font-bold text-zinc-300 text-xs uppercase tracking-widest">Audio</span>
              </button>
               <button 
                onClick={() => triggerFileUpload('Image')} 
                className="bg-[#111214] border border-white/5 p-4 rounded-[24px] flex flex-col items-center gap-2 active:bg-white/5 active:border-[#4DA3FF] transition-all group"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500 group-active:text-[#4DA3FF]"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                <span className="font-tech font-bold text-zinc-300 text-xs uppercase tracking-widest">Image</span>
              </button>
               <button 
                onClick={() => setActiveModal('WEBSITE')} 
                className="bg-[#111214] border border-white/5 p-4 rounded-[24px] flex flex-col items-center gap-2 active:bg-white/5 active:border-[#4DA3FF] transition-all group"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500 group-active:text-[#4DA3FF]"><circle cx="12" cy="12" r="10"/><line x1="2" x2="22" y1="12" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                <span className="font-tech font-bold text-zinc-300 text-xs uppercase tracking-widest">Web</span>
              </button>
            </div>
            
            <div className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-600 mb-1 mt-4 text-center">Neural Sync</div>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setActiveModal('YOUTUBE')} 
                className="bg-[#111214] border border-white/5 p-4 rounded-[24px] flex flex-col items-center gap-2 active:bg-white/5 active:border-[#4DA3FF] transition-all group"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500 group-active:text-[#4DA3FF]"><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 2-2 10 10 0 0 1 15 0 2 2 0 0 1 2 2 24.12 24.12 0 0 1 0 10 2 2 0 0 1-2 2 10 10 0 0 1-15 0 2 2 0 0 1-2-2Z"/><path d="m10 15 5-3-5-3v6Z"/></svg>
                <span className="font-tech font-bold text-zinc-300 text-xs uppercase tracking-widest">YouTube</span>
              </button>
              <button 
                onClick={() => setActiveModal('TEXT')} 
                className="bg-[#111214] border border-white/5 p-4 rounded-[24px] flex flex-col items-center gap-2 active:bg-white/5 active:border-[#4DA3FF] transition-all group"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-500 group-active:text-[#4DA3FF]"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg>
                <span className="font-tech font-bold text-zinc-300 text-xs uppercase tracking-widest">Text</span>
              </button>
            </div>
          </div>
        )}
      </div>
      {selectedSearchUris.size > 0 && (
        <div className="absolute bottom-10 left-0 right-0 px-6 z-10 flex justify-center">
          <button onClick={handleAddSelectedSources} className="bg-white text-black px-10 py-4 rounded-full font-black text-[10px] uppercase tracking-[0.15em] shadow-2xl active:scale-95 transition-all w-full max-w-sm shimmer-text">Sync {selectedSearchUris.size} Intelligence Units</button>
        </div>
      )}
      {renderSourceModal()}
    </div>
  );

  const renderSources = () => (
    <div className="flex-1 flex flex-col overflow-hidden pt-4 relative">
       <div className="px-6 flex items-center justify-between mb-6 shrink-0">
         <h2 className="text-[15px] font-axiom font-bold tracking-widest text-white uppercase">Vault Contents</h2>
       </div>
       <div className="flex-1 overflow-y-auto no-scrollbar px-6 pb-48 flex flex-col gap-4">
         {notebook.sources.length === 0 ? (
           <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 text-[9px] font-black uppercase tracking-[0.2em] mt-16 italic bg-[#111214] rounded-[32px] p-16 border border-dashed border-white/5">
             Vault is currently empty.
           </div>
         ) : (
           notebook.sources.map(s => (
            <div key={s.id} className="flex items-center gap-4 bg-[#111214] border border-white/5 p-4 rounded-[24px] transition-all hover:border-[#4DA3FF]/30">
              <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center shrink-0 border border-white/5">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4DA3FF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
              </div>
              <h4 className="font-bold text-sm text-zinc-100 truncate flex-1 font-tech tracking-tight">{s.title}</h4>
            </div>
           ))
         )}
       </div>
       <div className="fixed bottom-20 left-0 right-0 flex justify-center items-center z-40 px-6 pb-4">
        <button onClick={() => setShowAddSourceOverlay(true)} className="bg-white text-black w-full max-w-sm py-4 rounded-full flex items-center justify-center gap-3 font-black text-[10px] uppercase tracking-[0.15em] shadow-2xl active:scale-95 transition-all shimmer-text border-2 border-white">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
          Incorporate Intelligence
        </button>
      </div>
    </div>
  );

  const renderChat = () => (
    <div className="flex-1 flex flex-col bg-black overflow-hidden relative">
      <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-8 pb-48 no-scrollbar">
        {messages.length === 0 && (
          <div className="flex flex-col gap-6">
            <div style={Typography.title} className="font-tech text-2xl font-black">{notebook.title}</div>
            <div className="flex items-center gap-3">
              <div className="h-[1px] flex-1 bg-white/5"></div>
              <div className="text-zinc-500 font-black text-[9px] uppercase tracking-[0.3em]">{notebook.sources.length} GROUNDED UNITS</div>
              <div className="h-[1px] flex-1 bg-white/5"></div>
            </div>
            <div className="mb-4">
              {!summaryReady ? (
                <div className="p-10 border border-dashed border-white/10 rounded-[32px] flex flex-col items-center justify-center text-center bg-[#111214]">
                  <h3 className="text-zinc-500 font-black text-[10px] uppercase tracking-[0.2em] mb-2">Sync required</h3>
                  <p className="text-zinc-600 text-[11px] font-tech max-w-[200px]">Acquire sources to initialize narrative intelligence synthesis.</p>
                </div>
              ) : notebook.isGeneratingSummary ? (
                <div className="space-y-4">
                  <div className="h-4 bg-white/5 rounded-full animate-pulse w-full"></div>
                  <div className="h-4 bg-white/5 rounded-full animate-pulse w-11/12"></div>
                  <div className="h-4 bg-white/5 rounded-full animate-pulse w-4/5"></div>
                  <p className="text-[9px] font-black text-[#4DA3FF] uppercase tracking-[0.3em] text-center mt-4 animate-pulse">Synthesizing Vault Logic...</p>
                </div>
              ) : (
                <div className="bg-[#111214] p-6 rounded-[32px] border border-white/5 shadow-inner relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-30 transition-opacity">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  </div>
                  <RichText content={notebook.summary || ''} />
                </div>
              )}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[88%] px-5 py-3 rounded-[24px] ${m.role === 'user' ? 'bg-white text-black font-bold shadow-[0_8px_20px_rgba(255,255,255,0.08)]' : 'bg-[#111214] text-zinc-200 border border-white/5 shadow-lg'}`}>
              <RichText content={m.text} />
            </div>
          </div>
        ))}
        {isTyping && <div className="flex justify-start"><div className="bg-[#111214] px-5 py-4 rounded-[24px] border border-white/5 flex gap-1.5"><div className="w-1.5 h-1.5 bg-zinc-600 rounded-full animate-bounce"></div><div className="w-1.5 h-1.5 bg-zinc-600 rounded-full animate-bounce [animation-delay:0.2s]"></div><div className="w-1.5 h-1.5 bg-zinc-600 rounded-full animate-bounce [animation-delay:0.4s]"></div></div></div>}
      </div>
      <div className="absolute bottom-16 left-0 right-0 p-5 z-50">
        <div className="max-w-xl mx-auto flex items-center gap-2 bg-[#111214] p-1.5 pl-6 rounded-full border border-white/10 shadow-xl focus-within:border-[#4DA3FF]/40 transition-all backdrop-blur-xl">
          <input 
            type="text" value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={`Query ${notebook.sources.length} units...`}
            className="flex-1 bg-transparent outline-none text-white text-base py-3 font-tech placeholder-zinc-700"
          />
          {input.trim() && (
            <button onClick={handleSend} disabled={isTyping} className="bg-white text-black w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-20 active:scale-90 transition-all mr-0.5 shadow-md">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col pt-safe bg-black h-full overflow-hidden">
      <header className="px-6 py-4 flex items-center justify-between shrink-0 border-b border-white/5 bg-black/50 backdrop-blur-md">
        <button onClick={onBack} className="p-1.5 text-white active:scale-90 transition-transform bg-white/5 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
        <span className="text-[11px] font-axiom font-bold tracking-[0.25em] text-white line-clamp-1 max-w-[65%] text-center uppercase shimmer-text">{notebook.title}</span>
        <div className="w-8"></div>
      </header>
      <div className="flex-1 flex flex-col min-h-0 relative">
        {activeTab === Tab.SOURCES && renderSources()}
        {activeTab === Tab.CHAT && renderChat()}
        {activeTab === Tab.STUDIO && <AudioStudio notebook={notebook} onBack={onBack} />}
      </div>
      {showAddSourceOverlay && renderAddSourceView()}
    </div>
  );
};

export default NotebookDetail;
