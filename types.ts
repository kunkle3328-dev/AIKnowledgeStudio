
export interface Source {
  id: string;
  type: 'text' | 'url' | 'pdf';
  title: string;
  content: string;
}

export interface AudioChapter {
  id: string;
  title: string;
  startTime: number; // in seconds
}

export interface GeneratedMedia {
  id: string;
  type: 'AUDIO' | 'FLASHCARDS' | 'QUIZ' | 'INFOGRAPHIC' | 'SLIDE_DECK';
  title: string;
  duration?: string;
  sourceCount: number;
  createdAt: number;
}

export type HostPersonality = 'neutral' | 'curious' | 'analytical' | 'warm' | 'debate';

export type NotebookCategory =
  | 'technology'
  | 'mobile'
  | 'science'
  | 'business'
  | 'design'
  | 'finance'
  | 'education'
  | 'research'
  | 'general';

export type NotebookIcon = 
  | 'smartphone' 
  | 'atom' 
  | 'chart' 
  | 'gavel' 
  | 'heart' 
  | 'brain' 
  | 'book' 
  | 'folder' 
  | 'spark' 
  | 'layers' 
  | 'note' 
  | 'grid' 
  | 'lightbulb'
  | 'chip'
  | 'briefcase'
  | 'palette'
  | 'trending-up'
  | 'book-open'
  | 'flask';

export interface Notebook {
  id: string;
  title: string;
  emoji: string; // Legacy support
  icon: NotebookIcon;
  category: NotebookCategory;
  createdAt: number;
  sources: Source[];
  summary?: string;
  keywords?: string[];
  audioOverviewUrl?: string;
  color: string;
  chapters?: AudioChapter[];
  hostPersonality?: HostPersonality;
  generatedMedia?: GeneratedMedia[];
  isGeneratingSummary?: boolean; 
}

export enum Tab {
  SOURCES = 'SOURCES',
  CHAT = 'CHAT',
  STUDIO = 'STUDIO'
}

export enum AppState {
  LIST = 'LIST',
  DETAIL = 'DETAIL'
}

export interface Message {
  role: 'user' | 'model';
  text: string;
}
