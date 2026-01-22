
export interface Source {
  id: string;
  type: 'text' | 'url' | 'pdf';
  title: string;
  content: string;
  indexed?: boolean;
}

export interface TranscriptSegment {
  id: string;
  speaker: 'Alex' | 'Jordan';
  startMs: number;
  endMs: number;
  text: string;
}

export interface AudioChapter {
  id: string;
  title: string;
  startMs: number;
  endMs: number;
  summary: string;
}

export interface GeneratedMedia {
  id: string;
  type: 'AUDIO' | 'FLASHCARDS' | 'QUIZ' | 'INFOGRAPHIC' | 'SLIDE_DECK';
  title: string;
  duration?: string;
  sourceCount: number;
  createdAt: number;
  artworkUrl?: string;
  transcript?: TranscriptSegment[];
  chapters?: AudioChapter[];
  audioBase64?: string;
}

export type HostPersonality = 'neutral' | 'curious' | 'analytical' | 'warm' | 'debate' | 'visionary';

export type PodcastJobState = 
  | 'QUEUED' 
  | 'PREFLIGHT'
  | 'OUTLINING' 
  | 'SCRIPTING' 
  | 'SYNTHESIZING' 
  | 'FINALIZING' 
  | 'READY' 
  | 'FAILED'
  | 'INDEXING';

export type GenerationMode = 'PRIMARY' | 'OPTIMIZED' | 'FAILSAFE';

/**
 * 🎛 Waveform Mode (System Presence)
 * Invariant: Always mounted, indicates system activity.
 */
export type WaveformMode = 'idle' | 'thinking' | 'speaking';

export enum TTSEngine {
  GEMINI = 'GEMINI',
  SILENCE = 'SILENCE'
}

export interface PodcastJob {
  jobId: string;
  notebookId: string;
  state: PodcastJobState;
  progress: number;
  mode: GenerationMode;
  activeEngine: TTSEngine | null;
  audio?: {
    audio: string;
    chapters: AudioChapter[];
    transcript: TranscriptSegment[];
    artworkUrl?: string;
  };
  error?: string;
  createdAt: number;
  personality: HostPersonality;
  completedChunks: number;
  totalChunks: number;
  partialAudioBuffers?: string[];
  partialTranscript?: TranscriptSegment[];
}

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

export interface NotebookVisualFingerprint {
  category: NotebookCategory;
  icon: NotebookIcon;
  bgColor: string;
  bgColorAlt: string;
  accent: string;
  assignedAt: number;
}

export interface Notebook {
  id: string;
  title: string;
  createdAt: number;
  sources: Source[];
  summary?: string;
  keywords?: string[];
  audioOverviewUrl?: string;
  chapters?: AudioChapter[];
  hostPersonality?: HostPersonality;
  generatedMedia?: GeneratedMedia[];
  isGeneratingSummary?: boolean; 
  visualFingerprint: NotebookVisualFingerprint;
  isShared?: boolean;
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
