
import React, { useState, useRef } from 'react';
import { Notebook, Tab, Message, Source } from '../types';
import { GeminiService, SearchResult } from '../services/geminiService';
import AudioStudio from './AudioStudio';

interface NotebookDetailProps {
  notebook: Notebook;
  onBack: () => void;
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  onAddSource: (source: Source) => void;
}

const NotebookDetail: React.FC<NotebookDetailProps> = ({ notebook, onBack, activeTab, setActiveTab, onAddSource }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showAddSourceOverlay, setShowAddSourceOverlay] = useState(false);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedSearchUris, setSelectedSearchUris] = useState<Set<string>>(new Set());

  // Specific Modal States for fully implemented source types
  const [activeModal, setActiveModal] = useState<'WEBSITE' | 'YOUTUBE' | 'TEXT' | null>(null);
  const [modalValue, setModalValue] = useState('');
  const [modalTitle, setModalTitle] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const gemini = useRef(new GeminiService());

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
        content: `Grounded Source URL: ${result.uri}. This content will be synthesized upon grounding.`,
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
    
    if (activeModal === 'WEBSITE') {
      type = 'url';
      title = `Web: ${title}`;
    } else if (activeModal === 'YOUTUBE') {
      type = 'url';
      title = `YouTube: ${title}`;
    }

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
      else if (type === 'Image') fileInputRef.current.accept = 'image/*';
      
      fileInputRef.current.onchange = (e: any) => {
        const file = e.target.files?.[0];
        if (file) {
          onAddSource({
            id: Math.random().toString(36).substr(2, 9),
            type: type === 'PDF' ? 'pdf' : 'text',
            title: file.name,
            content: `Uploaded file content placeholder for ${file.name}`,
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
      WEBSITE: { title: 'Add Website', placeholder: 'Enter URL (e.g. https://example.com)', type: 'url' },
      YOUTUBE: { title: 'Add YouTube Video', placeholder: 'Enter Video URL', type: 'url' },
      TEXT: { title: 'Paste Text', placeholder: 'Paste your content here...', type: 'textarea' }
    }[activeModal];

    return (
      <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[210] flex items-center justify-center p-6">
        <div className="bg-[#111214] w-full max-w-sm rounded-[32px] p-6 border border-white/10 shadow-2xl">
          <h3 className="text-xl font-bold mb-4 text-white">{config.title}</h3>
          <input 
            type="text" 
            placeholder="Document Title (optional)"
            value={modalTitle}
            onChange={(e) => setModalTitle(e.target.value)}
            className="w-full bg-zinc-800/50 border border-white/5 rounded-xl p-3 text-white text-sm outline-none mb-3"
          />
          {config.type === 'textarea' ? (
            <textarea 
              autoFocus
              rows={5}
              placeholder={config.placeholder}
              value={modalValue}
              onChange={(e) => setModalValue(e.target.value)}
              className="w-full bg-zinc-800/50 border border-white/5 rounded-xl p-3 text-white text-sm outline-none mb-4 resize-none"
            />
          ) : (
            <input 
              autoFocus
              type="text"
              placeholder={config.placeholder}
              value={modalValue}
              onChange={(e) => setModalValue(e.target.value)}
              className="w-full bg-zinc-800/50 border border-white/5 rounded-xl p-3 text-white text-sm outline-none mb-4"
            />
          )}
          <div className="flex gap-3">
            <button onClick={() => setActiveModal(null)} className="flex-1 py-3 text-zinc-400 font-bold text-sm">Cancel</button>
            <button 
              onClick={handleAddSourceComplete} 
              disabled={!modalValue.trim()} 
              className="flex-1 bg-white text-black py-3 rounded-full font-bold text-sm disabled:opacity-50"
            >
              Add Source
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderAddSourceView = () => (
    <div className="fixed inset-0 bg-black z-[200] flex flex-col pt-safe px-6 overflow-hidden">
      <div className="flex justify-end pt-4 mb-8 shrink-0">
        <button onClick={() => {
          setShowAddSourceOverlay(false);
          setSearchResults([]);
          setSearchQuery('');
          setSelectedSearchUris(new Set());
        }} className="p-2 text-white active:scale-90 transition-transform">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>

      <div className="text-center mb-8 shrink-0">
        <h2 className="text-[22px] font-semibold text-white leading-tight">
          Create audio overviews<br />
          from <span className="text-[#6EE7B7]">your documents</span>
        </h2>
      </div>

      <div className="relative mb-6 shrink-0">
        <div className="absolute inset-0 border-[2px] border-[#3B82F6] rounded-[16px] pointer-events-none"></div>
        <input 
          type="text" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleWebSearch()}
          placeholder="Find sources from the web"
          className="w-full bg-transparent p-4 pr-14 text-zinc-200 outline-none text-base font-medium placeholder-zinc-500"
        />
        <button 
          onClick={handleWebSearch}
          disabled={isSearching}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-zinc-600/30 rounded-full flex items-center justify-center text-zinc-200 disabled:opacity-50"
        >
          {isSearching ? (
             <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
          ) : (
             <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-10">
        {searchResults.length > 0 ? (
          <div className="flex flex-col gap-4 mb-24">
            <div className="flex items-center justify-between px-1">
              <h4 className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Search Results</h4>
              <button 
                onClick={toggleSelectAll}
                className="text-blue-400 text-xs font-bold"
              >
                {selectedSearchUris.size === searchResults.length ? 'Unselect all' : 'Select all'}
              </button>
            </div>
            {searchResults.map((result, i) => (
              <div 
                key={i} 
                onClick={() => toggleSearchResultSelection(result.uri)}
                className={`bg-[#111214] border p-4 rounded-2xl flex items-center gap-4 transition-all cursor-pointer ${selectedSearchUris.has(result.uri) ? 'border-blue-600' : 'border-white/5'}`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${selectedSearchUris.has(result.uri) ? 'bg-blue-600 border-blue-600' : 'border-zinc-700'}`}>
                  {selectedSearchUris.has(result.uri) && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  )}
                </div>
                <div className="overflow-hidden flex-1">
                  <div className="text-white text-sm font-bold truncate mb-1">{result.title}</div>
                  <div className="text-zinc-500 text-xs truncate">{result.uri}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="text-center text-zinc-400 text-[13px] mb-6 font-medium">Or upload your files</div>
            <div className="flex flex-col gap-3">
              <input type="file" ref={fileInputRef} className="hidden" />
              <button onClick={() => triggerFileUpload('PDF')} className="w-full bg-[#111214] border border-white/10 p-4 rounded-full flex items-center justify-center gap-3"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15h.01"/><path d="M12 15h.01"/><path d="M15 15h.01"/></svg><span className="font-semibold text-zinc-200 text-sm tracking-wide">PDF</span></button>
              <button onClick={() => triggerFileUpload('Audio')} className="w-full bg-[#111214] border border-white/10 p-4 rounded-full flex items-center justify-center gap-3"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="M2 12h20"/><path d="M6 12v4"/><path d="M18 12v4"/><path d="M10 12v6"/><path d="M14 12v6"/></svg><span className="font-semibold text-zinc-200 text-sm tracking-wide">Audio</span></button>
              <button onClick={() => triggerFileUpload('Image')} className="w-full bg-[#111214] border border-white/10 p-4 rounded-full flex items-center justify-center gap-3"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg><span className="font-semibold text-zinc-200 text-sm tracking-wide">Image</span></button>
              <button onClick={() => setActiveModal('WEBSITE')} className="w-full bg-[#111214] border border-white/10 p-4 rounded-full flex items-center justify-center gap-3"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="3" x2="21" y1="9" y2="9"/><line x1="9" x2="9" y1="21" y2="9"/></svg><span className="font-semibold text-zinc-200 text-sm tracking-wide">Website</span></button>
              <button onClick={() => setActiveModal('YOUTUBE')} className="w-full bg-[#111214] border border-white/10 p-4 rounded-full flex items-center justify-center gap-3"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="15" x="2" y="4.5" rx="2.18" ry="2.18"/><path d="m10 9.5 5 2.5-5 2.5v-5z"/></svg><span className="font-semibold text-zinc-200 text-sm tracking-wide">YouTube</span></button>
              <button onClick={() => setActiveModal('TEXT')} className="w-full bg-[#111214] border border-white/10 p-4 rounded-full flex items-center justify-center gap-3"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg><span className="font-semibold text-zinc-200 text-sm tracking-wide">Copied text</span></button>
            </div>
          </>
        )}
      </div>

      {searchResults.length > 0 && selectedSearchUris.size > 0 && (
        <div className="absolute bottom-10 left-0 right-0 px-6 z-10 flex justify-center">
          <button 
            onClick={handleAddSelectedSources}
            className="bg-white text-black px-10 py-4 rounded-full font-bold shadow-2xl active:scale-95 transition-all w-full max-w-sm"
          >
            Add {selectedSearchUris.size} source{selectedSearchUris.size > 1 ? 's' : ''}
          </button>
        </div>
      )}

      {renderSourceModal()}
    </div>
  );

  const renderSources = () => (
    <div className="flex-1 flex flex-col overflow-hidden pt-4 relative">
       <div className="px-5 flex items-center justify-between mb-8 shrink-0">
         <h2 className="text-[17px] font-semibold text-white">Sources</h2>
         <button className="text-white p-1">
           <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
         </button>
       </div>
       <div className="flex-1 overflow-y-auto no-scrollbar px-5 pb-48 flex flex-col gap-8">
         {notebook.sources.length === 0 ? (
           <div className="flex-1 flex items-center justify-center text-zinc-600 text-xs mt-10 italic">
             No sources added yet.
           </div>
         ) : (
           notebook.sources.map(s => (
            <div key={s.id} className="flex items-center gap-4 active:bg-white/5 p-1 rounded-lg transition-colors">
              <div className="w-10 h-10 bg-[#3B82F6] rounded-md flex items-center justify-center shrink-0">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
              </div>
              <h4 className="font-medium text-[15px] text-zinc-100 truncate flex-1">{s.title}</h4>
            </div>
           ))
         )}
       </div>
       
       <div className="fixed bottom-20 left-0 right-0 flex justify-center items-center gap-4 pointer-events-none z-40 pb-6">
        <button 
          className="pointer-events-auto bg-white text-black w-14 h-14 rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
        </button>
        <button 
          onClick={() => setShowAddSourceOverlay(true)}
          className="pointer-events-auto bg-white text-black px-8 py-4 rounded-full flex items-center gap-3 font-bold shadow-2xl active:scale-95 transition-all text-[15px]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
          Add a source
        </button>
      </div>
    </div>
  );

  const renderChat = () => (
    <div className="flex-1 flex flex-col bg-black overflow-hidden relative">
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-6 pb-48 no-scrollbar">
        {messages.length === 0 && (
          <div className="flex flex-col gap-6">
            <h1 className="text-[28px] font-bold leading-tight text-white mt-4">{notebook.title}</h1>
            <div className="text-zinc-500 font-semibold text-sm mb-1">{notebook.sources.length} sources</div>
            <div className="mb-4">
              <p className="text-zinc-200 leading-[1.6] text-[15px] font-normal whitespace-pre-wrap">
                {notebook.summary?.split(/(\*\*.*?\*\*)/).map((part, i) => 
                  part.startsWith('**') ? <span key={i} className="font-bold text-white">{part.slice(2, -2)}</span> : part
                )}
              </p>
            </div>
            <div className="flex gap-6 mb-4">
               <button className="text-zinc-500 p-1"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg></button>
               <button className="text-zinc-500 p-1"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg></button>
               <button className="text-zinc-500 p-1"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"/></svg></button>
            </div>
            <div className="flex justify-center mb-6">
               <button onClick={() => setActiveTab(Tab.STUDIO)} className="bg-[#111214] border border-white/10 text-zinc-100 px-10 py-3.5 rounded-full font-semibold flex items-center gap-3 text-sm tracking-wide">
                 <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v20"/><path d="M2 12h20"/><path d="M6 12v4"/><path d="M18 12v4"/><path d="M10 12v6"/><path d="M14 12v6"/></svg>
                 Audio Overview
               </button>
            </div>
          </div>
        )}
        
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-5 py-3.5 rounded-[24px] ${m.role === 'user' ? 'bg-[#1e1e1e] text-white' : 'bg-[#111214] text-zinc-200 border border-white/5'}`}>
              <p className="text-[15px] leading-relaxed">{m.text}</p>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-[#111214] px-5 py-4 rounded-[24px] border border-white/5">
              <div className="flex gap-1.5">
                <div className="w-1.5 h-1.5 bg-zinc-600 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-zinc-600 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-1.5 h-1.5 bg-zinc-600 rounded-full animate-bounce [animation-delay:0.4s]"></div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="absolute bottom-20 left-0 right-0 p-4 z-50">
        <div className="max-w-xl mx-auto flex items-center gap-2 bg-[#111214] p-1.5 pl-6 rounded-full border border-white/10 shadow-2xl group focus-within:border-white/20">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={`Ask ${notebook.sources.length} sources...`}
            className="flex-1 bg-transparent outline-none text-white text-[15px] py-3 font-medium placeholder-zinc-500"
          />
          <div className="flex items-center gap-1.5 bg-[#1e1e1e] px-4 py-2.5 rounded-full border border-white/5 active:bg-zinc-700 transition-colors mr-1 cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
            <span className="text-white text-[13px] font-bold leading-none">{notebook.sources.length}</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
          </div>
          {input.trim() && (
            <button 
              onClick={handleSend}
              disabled={isTyping}
              className="bg-white text-black w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-20 active:scale-90 transition-all mr-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col pt-safe bg-black overflow-hidden h-full">
      <header className="px-5 py-4 flex items-center justify-between shrink-0">
        <button onClick={onBack} className="p-2 text-white active:scale-90 transition-transform">
          <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <span className="text-[14px] font-bold tracking-tight text-white line-clamp-1 max-w-[65%] text-center">{notebook.title}</span>
        <button className="p-2 text-white active:scale-90 transition-transform">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="19" r="1.2"/></svg>
        </button>
      </header>

      <div className="flex-1 flex flex-col min-h-0 relative">
        {activeTab === Tab.SOURCES && renderSources()}
        {activeTab === Tab.CHAT && renderChat()}
        {activeTab === Tab.STUDIO && <AudioStudio notebook={notebook} />}
      </div>

      {showAddSourceOverlay && renderAddSourceView()}
    </div>
  );
};

export default NotebookDetail;
