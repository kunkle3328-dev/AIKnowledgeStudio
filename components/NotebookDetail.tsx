
import React, { useState } from 'react';
import { Notebook, Tab, Message, Source } from '../types';
import { GeminiService } from '../services/geminiService';

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
  const [showAddSource, setShowAddSource] = useState(false);
  const [sourceTitle, setSourceTitle] = useState('');
  const [sourceContent, setSourceContent] = useState('');

  const gemini = new GeminiService();

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsTyping(true);

    try {
      const response = await gemini.generateChatResponse(notebook, userMsg);
      setMessages(prev => [...prev, { role: 'model', text: response }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'model', text: 'Sorry, I hit a temporary issue (500). Please try again.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleAddSource = () => {
    if (!sourceTitle.trim() || !sourceContent.trim()) return;
    const newSource: Source = {
      id: Date.now().toString(),
      type: 'text',
      title: sourceTitle.trim(),
      content: sourceContent.trim(),
    };
    onAddSource(newSource);
    setSourceTitle('');
    setSourceContent('');
    setShowAddSource(false);
  };

  const renderSources = () => (
    <div className="flex-1 flex flex-col overflow-hidden px-6 pt-4 relative">
       <div className="flex items-center justify-between mb-4 shrink-0">
         <h2 className="text-xl font-bold">Sources</h2>
       </div>
       <div className="flex-1 overflow-y-auto custom-scrollbar grid gap-4 pb-48">
         {notebook.sources.length > 0 ? notebook.sources.map(s => (
           <div key={s.id} className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl shrink-0">
              <div className="text-xs text-blue-400 font-semibold mb-1 uppercase tracking-wider">{s.type}</div>
              <h4 className="font-semibold mb-2">{s.title}</h4>
              <p className="text-sm text-zinc-400 line-clamp-3">{s.content}</p>
           </div>
         )) : (
           <div className="text-center py-20 text-zinc-500">No sources added yet. Click "+" to add one.</div>
         )}
       </div>

       {/* Dedicated FAB for adding sources, matching List's FAB style */}
       <div className="fixed bottom-24 left-0 right-0 flex justify-center pointer-events-none z-40">
        <button 
          onClick={() => setShowAddSource(true)}
          className="pointer-events-auto bg-white text-black px-8 py-4 rounded-full flex items-center gap-3 font-bold shadow-2xl shadow-white/30 active:scale-95 transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
          Add Source
        </button>
      </div>

       {showAddSource && (
         <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-6">
            <div className="bg-zinc-900 w-full max-w-sm rounded-[40px] p-8 border border-white/10 shadow-2xl">
              <h3 className="text-lg font-bold mb-6">Add Text Source</h3>
              <input 
                autoFocus
                type="text" 
                placeholder="Source Title"
                value={sourceTitle}
                onChange={(e) => setSourceTitle(e.target.value)}
                className="w-full bg-zinc-800 border-none rounded-2xl p-4 text-white outline-none mb-4 focus:ring-2 focus:ring-white/10"
              />
              <textarea 
                placeholder="Paste content here..."
                rows={4}
                value={sourceContent}
                onChange={(e) => setSourceContent(e.target.value)}
                className="w-full bg-zinc-800 border-none rounded-2xl p-4 text-white outline-none mb-6 resize-none focus:ring-2 focus:ring-white/10"
              />
              <div className="flex gap-3">
                <button onClick={() => setShowAddSource(false)} className="flex-1 py-4 text-zinc-400 font-bold">Cancel</button>
                <button 
                  onClick={handleAddSource} 
                  disabled={!sourceTitle.trim() || !sourceContent.trim()}
                  className="flex-1 bg-white text-black py-4 rounded-full font-bold disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>
         </div>
       )}
    </div>
  );

  const renderOverview = () => (
    <div className="flex-1 overflow-y-auto custom-scrollbar px-6 pt-6 pb-48">
       <div className="text-blue-500 font-bold text-xs tracking-wide mb-2 uppercase">{notebook.sources.length} SOURCES</div>
       <h1 className="text-3xl font-bold mb-6 leading-tight">{notebook.title}</h1>
       
       <div className="bg-zinc-900/50 border border-white/5 p-6 rounded-[32px] mb-8 shadow-inner">
         <p className="text-zinc-300 leading-relaxed text-base" dangerouslySetInnerHTML={{ 
           __html: notebook.summary?.replace(/\*\*(.*?)\*\*/g, '<span class="text-white font-bold">$1</span>') || 'Summary being generated...' 
         }} />
         
         {notebook.keywords && notebook.keywords.length > 0 && (
           <div className="flex flex-wrap gap-2 mt-6">
             {notebook.keywords.map(kw => (
               <span key={kw} className="bg-zinc-800 text-zinc-400 px-3 py-1 rounded-full text-[10px] font-semibold">#{kw}</span>
             ))}
           </div>
         )}
       </div>

       <div className="flex justify-center mb-8">
         <button 
           onClick={() => setActiveTab(Tab.STUDIO)}
           className="bg-white text-black px-10 py-4 rounded-full font-bold flex items-center gap-3 shadow-2xl active:scale-95 transition-all shadow-white/20"
         >
           <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
           Audio Overview
         </button>
       </div>

       <div className="bg-zinc-900/60 rounded-[28px] p-3 flex items-center gap-3 border border-zinc-800/50 group focus-within:border-zinc-700 transition-colors">
         <div className="flex-1 px-2 py-1">
          <input 
              type="text" 
              readOnly
              placeholder={`Ask ${notebook.sources.length} sources...`}
              className="w-full bg-transparent border-none outline-none text-zinc-400 text-sm cursor-pointer"
              onClick={() => setActiveTab(Tab.CHAT)}
          />
         </div>
         <button 
           onClick={() => setActiveTab(Tab.CHAT)}
           className="bg-white text-black p-2.5 rounded-full shadow-lg"
          >
           <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
         </button>
       </div>
    </div>
  );

  const renderChat = () => (
    <div className="flex-1 flex flex-col bg-black overflow-hidden relative">
      <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-6 pb-48 custom-scrollbar">
        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm text-center px-12 pt-20">
            Ask me anything about the {notebook.sources.length} sources attached to this notebook. I will answer based strictly on their content.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-5 py-3.5 rounded-[24px] shadow-sm ${m.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-zinc-900 text-zinc-200 rounded-tl-none border border-white/5'}`}>
              <p className="text-sm leading-relaxed">{m.text}</p>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-zinc-900 px-5 py-4 rounded-[24px] rounded-tl-none border border-white/5">
              <div className="flex gap-1.5">
                <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="absolute bottom-20 left-0 right-0 p-4 z-10 bg-gradient-to-t from-black via-black to-transparent">
        <div className="max-w-xl mx-auto flex items-center gap-3 bg-zinc-900/90 backdrop-blur-xl p-1.5 pl-4 rounded-full border border-zinc-800 shadow-2xl focus-within:border-zinc-700 transition-colors">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask your sources..."
            className="flex-1 bg-transparent outline-none text-zinc-100 text-sm py-2"
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="bg-white text-black p-3 rounded-full disabled:opacity-30 active:scale-90 transition-all shadow-lg"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col pt-safe bg-black overflow-hidden h-full">
      <header className="px-4 py-3 flex items-center justify-between shrink-0 border-b border-white/5">
        <button onClick={onBack} className="p-2 text-zinc-400 hover:text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <span className="text-sm font-bold truncate max-w-[200px]">{notebook.title}</span>
        <button className="p-2 text-zinc-400 hover:text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
        </button>
      </header>

      <div className="flex-1 flex flex-col min-h-0">
        {activeTab === Tab.SOURCES && renderSources()}
        {activeTab === Tab.CHAT && renderChat()}
        {!activeTab && renderOverview()}
      </div>
    </div>
  );
};

export default NotebookDetail;
