
import React, { useState } from 'react';
import { Notebook } from '../types';
import { COLORS } from '../constants';

interface NotebookListProps {
  notebooks: Notebook[];
  onSelect: (notebook: Notebook) => void;
  onAddNotebook: (notebook: Notebook) => void;
  onJumpToStudio: (notebook: Notebook) => void;
}

const NotebookList: React.FC<NotebookListProps> = ({ notebooks, onSelect, onAddNotebook, onJumpToStudio }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    onAddNotebook({
      id: Date.now().toString(),
      title: newTitle.trim(),
      emoji: '📁',
      createdAt: Date.now(),
      sources: [],
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      summary: 'Add sources to generate a summary.',
    });
    setNewTitle('');
    setShowAddModal(false);
  };

  return (
    <div className="flex-1 flex flex-col pt-safe bg-black overflow-hidden h-full relative">
      <header className="px-5 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
             <div className="w-4 h-4 bg-black rounded-sm"></div>
          </div>
          <span className="text-blue-500 text-[9px] font-bold px-1.5 py-0.5 bg-blue-500/20 rounded-md">PRO</span>
        </div>
        <div className="w-9 h-9 rounded-full border-2 border-zinc-800 overflow-hidden shadow-lg">
          <img src="https://picsum.photos/seed/user/100" alt="avatar" className="w-full h-full object-cover" />
        </div>
      </header>

      <div className="px-5 mb-6 shrink-0">
        <h1 className="text-2xl font-bold tracking-tight mb-6">Notebooks</h1>
        <div className="flex gap-5 text-xs font-semibold">
          <button className="text-white border-b-2 border-white pb-1.5">Recent</button>
          <button className="text-zinc-500 pb-1.5">Shared</button>
          <button className="text-zinc-500 pb-1.5">Title</button>
          <button className="text-zinc-500 pb-1.5">Downloaded</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-5 flex flex-col gap-4 pb-48">
        {notebooks.map(notebook => (
          <div 
            key={notebook.id}
            onClick={() => onSelect(notebook)}
            className={`w-full ${notebook.color} p-5 rounded-[24px] flex items-center justify-between group active:scale-[0.98] transition-all text-left border border-white/5 shadow-xl shrink-0`}
          >
            <div className="flex items-center gap-4 overflow-hidden">
              <div className="w-12 h-12 bg-black/40 rounded-xl shrink-0 flex items-center justify-center text-2xl">
                {notebook.emoji}
              </div>
              <div className="overflow-hidden">
                <h3 className="text-lg font-bold text-white leading-tight truncate pr-2">{notebook.title}</h3>
                <div className="text-zinc-400 text-xs mt-1 font-medium">
                  {notebook.sources.length} sources • {new Date(notebook.createdAt).toLocaleDateString('en-US')}
                </div>
              </div>
            </div>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onJumpToStudio(notebook);
              }}
              className="w-10 h-10 shrink-0 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white active:bg-white active:text-black transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>
            </button>
          </div>
        ))}

        <div className="flex justify-center mt-2">
          <button 
             onClick={() => setShowAddModal(true)}
             className="bg-white text-black px-7 py-3.5 rounded-full flex items-center gap-2.5 font-bold shadow-2xl active:scale-95 transition-all text-base"
           >
             <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
             Create New
           </button>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-6 z-[100]">
          <div className="bg-[#1A1D23] w-full max-w-xs rounded-[32px] p-6 border border-white/10 shadow-2xl">
            <h2 className="text-lg font-bold mb-4">New Notebook</h2>
            <input 
              autoFocus
              type="text" 
              placeholder="Give it a name..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full bg-zinc-800/50 border border-white/5 rounded-xl p-3.5 text-white text-sm outline-none mb-4 focus:ring-2 focus:ring-blue-500/50"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <div className="flex gap-3">
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-3 text-zinc-400 font-bold text-sm">Cancel</button>
              <button onClick={handleCreate} disabled={!newTitle.trim()} className="flex-1 bg-white text-black py-3 rounded-full font-bold text-sm disabled:opacity-50">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotebookList;
