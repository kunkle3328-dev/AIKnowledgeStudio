
import React, { useState, useMemo } from 'react';
import { Notebook, NotebookIcon } from '../types';
import { createVisualFingerprint } from '../services/classifyNotebook';
import AxiomLogo from './AxiomLogo';

interface NotebookListProps {
  notebooks: Notebook[];
  onSelect: (notebook: Notebook) => void;
  onAddNotebook: (notebook: Notebook) => void;
  onJumpToStudio: (notebook: Notebook) => void;
}

type ListFilter = 'ALL' | 'INTELLIGENCE' | 'SHARED';

const NotebookIconRenderer: React.FC<{ icon: NotebookIcon; color: string }> = ({ icon, color }) => {
  const props = {
    width: "20", height: "20", viewBox: "0 0 24 24", fill: "none",
    stroke: color, strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round"
  } as const;

  switch (icon) {
    case 'chip': return <svg {...props}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M11 9h2"/><path d="M11 13h2"/><path d="M11 17h2"/><path d="M15 9h2"/><path d="M15 13h2"/><path d="M15 17h2"/><path d="M7 9h2"/><path d="M7 13h2"/><path d="M7 17h2"/></svg>;
    case 'smartphone': return <svg {...props}><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12" y2="18"/></svg>;
    case 'atom': return <svg {...props}><circle cx="12" cy="12" r="3"/><path d="M12 21a9 9 0 1 0-9-9 9 9 0 0 0 9 9Z"/><path d="M12 3v18"/><path d="M3 12h18"/></svg>;
    case 'briefcase': return <svg {...props}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>;
    case 'palette': return <svg {...props}><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.6-.7 1.6-1.6 0-.4-.2-.8-.5-1.1-.3-.3-.5-.7-.5-1.1 0-.9.7-1.6 1.6-1.6H17c2.8 0 5-2.2 5-5 0-5.3-4.5-9.7-10-9.7z"/></svg>;
    case 'trending-up': return <svg {...props}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>;
    case 'book-open': return <svg {...props}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>;
    case 'flask': return <svg {...props}><path d="M9 3h6"/><path d="M10 3v6l-4 8a4 4 0 0 0 4 4h4a4 4 0 0 0 4-4l-4-8V3"/></svg>;
    default: return <svg {...props}><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/></svg>;
  }
};

const NotebookList: React.FC<NotebookListProps> = ({ notebooks, onSelect, onAddNotebook, onJumpToStudio }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [activeFilter, setActiveFilter] = useState<ListFilter>('ALL');

  const filteredNotebooks = useMemo(() => {
    switch (activeFilter) {
      case 'INTELLIGENCE':
        // Show notebooks that are categorized in 'core' intelligence fields
        return notebooks.filter(n => ['technology', 'science', 'research', 'brain'].includes(n.visualFingerprint.category));
      case 'SHARED':
        // Show shared notebooks
        return notebooks.filter(n => n.isShared);
      case 'ALL':
      default:
        return notebooks;
    }
  }, [notebooks, activeFilter]);

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    const fingerprint = createVisualFingerprint(newTitle.trim());

    onAddNotebook({
      id: Date.now().toString(),
      title: newTitle.trim(),
      createdAt: Date.now(),
      sources: [],
      summary: '',
      isGeneratingSummary: false,
      visualFingerprint: fingerprint,
      generatedMedia: [],
      isShared: false
    });
    setNewTitle(''); setShowAddModal(false);
  };

  const getEmptyStateMessage = () => {
    if (activeFilter === 'INTELLIGENCE') return "No intelligence-heavy vaults identified.";
    if (activeFilter === 'SHARED') return "No vaults shared with your unit.";
    return "Vault is currently empty.";
  };

  return (
    <div className="flex-1 flex flex-col pt-safe bg-black h-full overflow-hidden relative">
      <header className="px-6 py-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <AxiomLogo size={30} />
          <div className="flex flex-col">
            <span className="font-axiom text-lg font-bold tracking-[0.25em] shimmer-text">AXIOM</span>
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-500 -mt-1">Grounded Intel</span>
          </div>
        </div>
        <div className="w-9 h-9 rounded-full border border-white/10 overflow-hidden bg-[#111214] flex items-center justify-center p-[1px]">
          <img src="https://picsum.photos/seed/axiom-user/100" alt="avatar" className="w-full h-full object-cover rounded-full" />
        </div>
      </header>

      <div className="px-6 mb-6 shrink-0">
        <div className="flex gap-6 text-[10px] font-black uppercase tracking-[0.15em] text-zinc-500 border-b border-white/5">
          <button 
            onClick={() => setActiveFilter('ALL')}
            className={`pb-3 transition-all ${activeFilter === 'ALL' ? 'text-white border-b-2 border-[#4DA3FF]' : 'hover:text-white'}`}
          >
            All Vaults
          </button>
          <button 
            onClick={() => setActiveFilter('INTELLIGENCE')}
            className={`pb-3 transition-all ${activeFilter === 'INTELLIGENCE' ? 'text-white border-b-2 border-[#4DA3FF]' : 'hover:text-white'}`}
          >
            Intelligence
          </button>
          <button 
            onClick={() => setActiveFilter('SHARED')}
            className={`pb-3 transition-all ${activeFilter === 'SHARED' ? 'text-white border-b-2 border-[#4DA3FF]' : 'hover:text-white'}`}
          >
            Shared
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-6 flex flex-col gap-4 pb-48">
        {filteredNotebooks.length > 0 ? (
          filteredNotebooks.map(notebook => {
            const fingerprint = notebook.visualFingerprint;
            return (
              <div 
                key={notebook.id} onClick={() => onSelect(notebook)}
                style={{ background: `linear-gradient(135deg, ${fingerprint.bgColor}99, ${fingerprint.bgColorAlt}66), #0B0D10` }}
                className="w-full p-5 rounded-[28px] flex items-center justify-between group active:scale-[0.98] transition-all border border-white/5 shadow-[0_8px_20px_rgba(0,0,0,0.4)] shrink-0 animate-in fade-in slide-in-from-bottom-2 duration-500"
              >
                <div className="flex items-center gap-4 overflow-hidden">
                  <div className="w-12 h-12 bg-black/40 backdrop-blur-md rounded-2xl shrink-0 flex items-center justify-center border border-white/5">
                    <NotebookIconRenderer icon={fingerprint.icon} color={fingerprint.accent} />
                  </div>
                  <div className="overflow-hidden">
                    <h3 className="text-base font-bold text-white leading-tight truncate font-tech">{notebook.title}</h3>
                    <div className="text-zinc-400 text-[9px] mt-1 font-black uppercase tracking-widest opacity-60">
                      {notebook.sources.length} units • {new Date(notebook.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); onJumpToStudio(notebook); }}
                  className="w-10 h-10 shrink-0 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white active:bg-white active:text-black transition-all group-hover:bg-[#4DA3FF] group-hover:border-[#4DA3FF]"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>
                </button>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center opacity-30 animate-in fade-in duration-500">
             <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
               <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/></svg>
             </div>
             <p className="text-[10px] font-tech font-bold uppercase tracking-widest">{getEmptyStateMessage()}</p>
          </div>
        )}
        
        <div className="mt-2 flex flex-col gap-4">
           <button 
            onClick={() => setShowAddModal(true)} 
            className="bg-white text-black py-4 rounded-full flex items-center justify-center gap-3 font-black text-xs uppercase tracking-widest active:scale-95 transition-all shadow-[0_8px_25px_rgba(255,255,255,0.08)] pulse-blue"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
            Initialize Vault
          </button>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl flex items-center justify-center p-6 z-[100] animate-in fade-in zoom-in-95 duration-300">
          <div className="bg-[#111214] w-full max-w-sm rounded-[32px] p-6 border border-white/10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-right from-[#4DA3FF] to-transparent"></div>
            <h2 className="text-lg font-axiom font-bold mb-4 text-white text-center">New Vault</h2>
            <input 
              autoFocus type="text" placeholder="Project codename..." value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 text-white text-base font-tech outline-none mb-6 focus:ring-2 focus:ring-[#4DA3FF]/50 transition-all text-center"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <div className="flex gap-3">
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-3 text-zinc-500 font-bold text-[10px] uppercase tracking-widest hover:text-white transition-colors">Discard</button>
              <button onClick={handleCreate} disabled={!newTitle.trim()} className="flex-1 bg-white text-black py-3 rounded-full font-bold text-[10px] uppercase tracking-widest disabled:opacity-50 transition-all hover:scale-[1.02]">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotebookList;
