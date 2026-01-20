
export interface Source {
  id: string;
  type: 'text' | 'url' | 'pdf';
  title: string;
  content: string;
}

export interface Notebook {
  id: string;
  title: string;
  emoji: string;
  createdAt: number;
  sources: Source[];
  summary?: string;
  keywords?: string[];
  audioOverviewUrl?: string;
  color: string;
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
