
import React, { useState } from 'react';
import { Notebook } from '../types';
import { COLORS } from '../constants';

interface NotebookListProps {
  notebooks: Notebook[];
  onSelect: (notebook: Notebook) => void;
  onAddNotebook: (notebook: Notebook) => void;
}

const NotebookList: React.FC<NotebookListProps> = ({ notebooks, onSelect, onAddNotebook }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    const newNotebook: Notebook = {
      id: Date.now().toString(),
      title: newTitle.trim(),
      emoji: '📁',
      createdAt: Date.now(),
      sources: [],
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      summary: 'Start adding sources to generate an AI summary.',
    };
    onAddNotebook(newNotebook);
    setNewTitle('');
    setShowAddModal(false);
  };

  return (
    <div className="flex-1 flex flex-col pt-safe bg-black overflow-hidden h-full relative">
      <header className="px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
             <div className="w-4 h-4 bg-black rounded-sm"></div>
          </div>
          <span className="text-blue-500 text-xs font-bold px-2 py-0.5 bg-blue-500/10 rounded-full">PRO</span>
        </div>
        <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden">
          <img src="https://picsum.photos/seed/user/100" alt="avatar" />
        </div>
      </header>

      <div className="px-6 mt-2 mb-4 shrink-0">
        <h1 className="text-2xl font-bold">Notebooks</h1>
        <div className="flex gap-4 mt-6 text-sm overflow-x-auto no-scrollbar pb-2">
          <button className="text-white font-semibold border-b-2 border-white pb-1 whitespace-nowrap">Recent</button>
          <button className="text-zinc-500 pb-1 whitespace-nowrap">Shared</button>
          <button className="text-zinc-500 pb-1 whitespace-nowrap">Title</button>
          <button className="text-zinc-500 pb-1 whitespace-nowrap">Downloaded</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-6 flex flex-col gap-4 pb-48">
        {notebooks.map(notebook => (
          <button 
            key={notebook.id}
            onClick={() => onSelect(notebook)}
            className={`w-full ${notebook.color} p-5 rounded-3xl flex items-center justify-between group active:scale-[0.98] transition-all text-left border border-white/5 hover:border-white/20 shrink-0 shadow-lg`}
          >
            <div className="flex items-center gap-4 overflow-hidden">
              <div className="text-3xl bg-black/20 p-2 rounded-2xl shrink-0">{notebook.emoji}</div>
              <div className="overflow-hidden">
                <h3 className="text-lg font-semibold text-white group-hover:underline truncate">{notebook.title}</h3>
                <div className="text-zinc-400 text-xs mt-1 flex items-center gap-2">
                  <span>{notebook.sources.length} sources</span>
                  <span>•</span>
                  <span>{new Date(notebook.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
            <div className="w-10 h-10 shrink-0 rounded-full bg-white/10 flex items-center justify-center text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </div>
          </button>
        ))}
      </div>

      {/* Repositioned FAB to be above the bottom nav */}
      <div className="fixed bottom-24 left-0 right-0 flex justify-center pointer-events-none z-40">
        <button 
          onClick={() => setShowAddModal(true)}
          className="pointer-events-auto bg-white text-black px-8 py-4 rounded-full flex items-center gap-3 font-bold shadow-2xl shadow-white/30 active:scale-95 transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
          Create New
        </button>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 z-[100]">
          <div className="bg-zinc-900 w-full max-w-sm rounded-[40px] p-8 border border-white/10 shadow-2xl">
            <h2 className="text-xl font-bold mb-6">New Notebook</h2>
            <input 
              autoFocus
              type="text" 
              placeholder="Title (e.g. Physics Study)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full bg-zinc-800 border-none rounded-2xl p-4 text-white outline-none mb-6 focus:ring-2 focus:ring-white/20"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <div className="flex gap-3">
              <button 
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-4 text-zinc-400 font-bold"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreate}
                disabled={!newTitle.trim()}
                className="flex-1 bg-white text-black py-4 rounded-full font-bold disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotebookList;
