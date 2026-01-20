
import React, { useState } from 'react';
import { Notebook, Tab, AppState, Source } from './types';
import NotebookList from './components/NotebookList';
import NotebookDetail from './components/NotebookDetail';
import AudioStudio from './components/AudioStudio';
import { MOCK_NOTEBOOKS } from './constants';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.LIST);
  const [notebooks, setNotebooks] = useState<Notebook[]>(MOCK_NOTEBOOKS);
  const [activeNotebookId, setActiveNotebookId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab | null>(null);

  const activeNotebook = notebooks.find(n => n.id === activeNotebookId) || null;

  const handleSelectNotebook = (notebook: Notebook) => {
    setActiveNotebookId(notebook.id);
    setAppState(AppState.DETAIL);
    setActiveTab(null);
  };

  const handleBack = () => {
    setAppState(AppState.LIST);
    setActiveNotebookId(null);
    setActiveTab(null);
  };

  const handleAddNotebook = (newNotebook: Notebook) => {
    setNotebooks(prev => [newNotebook, ...prev]);
    setActiveNotebookId(newNotebook.id);
    setAppState(AppState.DETAIL);
    setActiveTab(null);
  };

  const handleAddSource = (notebookId: string, source: Source) => {
    setNotebooks(prev => prev.map(n => 
      n.id === notebookId 
        ? { ...n, sources: [source, ...n.sources] }
        : n
    ));
  };

  const renderContent = () => {
    if (appState === AppState.LIST) {
      return <NotebookList notebooks={notebooks} onSelect={handleSelectNotebook} onAddNotebook={handleAddNotebook} />;
    }

    if (!activeNotebook) return null;

    if (activeTab === Tab.STUDIO) {
      return <AudioStudio notebook={activeNotebook} />;
    }

    return (
      <NotebookDetail 
        notebook={activeNotebook} 
        onBack={handleBack} 
        activeTab={activeTab as any}
        setActiveTab={setActiveTab as any}
        onAddSource={(source) => handleAddSource(activeNotebook.id, source)}
      />
    );
  };

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-black text-white relative overflow-hidden">
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {renderContent()}
      </div>

      {/* Persistent Bottom Tab Bar */}
      {activeNotebook && (
        <nav className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-xl border-t border-white/5 pb-safe z-50">
          <div className="flex items-center justify-around h-16 sm:h-20 px-4">
            <button 
              onClick={() => setActiveTab(Tab.SOURCES)}
              className={`flex flex-col items-center justify-center transition-all px-4 ${activeTab === Tab.SOURCES ? 'text-white' : 'text-zinc-500'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="3" x2="21" y1="9" y2="9"/><line x1="9" x2="9" y1="21" y2="9"/></svg>
              <span className="text-[10px] font-bold mt-1">Sources</span>
            </button>
            <button 
              onClick={() => setActiveTab(Tab.CHAT)}
              className={`flex flex-col items-center justify-center transition-all px-4 ${activeTab === Tab.CHAT ? 'text-white' : 'text-zinc-500'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>
              <span className="text-[10px] font-bold mt-1">Chat</span>
            </button>
            <button 
              onClick={() => setActiveTab(Tab.STUDIO)}
              className={`flex flex-col items-center justify-center transition-all px-4 ${activeTab === Tab.STUDIO ? 'text-white' : 'text-zinc-500'}`}
            >
              <div className={`p-1 rounded-full ${activeTab === Tab.STUDIO ? 'bg-zinc-800' : ''}`}>
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="M2 12h20"/><path d="m4.93 4.93 14.14 14.14"/><path d="m4.93 19.07 14.14-14.14"/></svg>
              </div>
              <span className="text-[10px] font-bold mt-1">Studio</span>
            </button>
          </div>
        </nav>
      )}
    </div>
  );
};

export default App;
