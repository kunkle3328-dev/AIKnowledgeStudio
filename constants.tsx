
import { Notebook } from './types';

export const MOCK_NOTEBOOKS: Notebook[] = [
  {
    id: '1',
    title: 'One UI 8.5 DeX AI Overhaul',
    createdAt: 1768867200000,
    sources: [
      { id: 's1', type: 'text', title: 'Feature List', content: 'Samsung is planning a major overhaul for DeX in One UI 8.5. Key features include AI-driven window management, real-time multitasking summaries, and improved integration with Galaxy AI tools. The redesign aims to make desktop mode more fluid on tablets.' },
      { id: 's2', type: 'text', title: 'Hardware Requirements', content: 'Compatible devices will include Galaxy S24 series and onwards. NPU requirements are high for local AI processing.' }
    ],
    summary: 'One UI 8.5 introduces a transformative DeX experience centered on **AI productivity**. The update focuses on intelligent workspace automation, **Galaxy AI** deep integration, and cross-device fluidity. Users can expect advanced windowing logic that anticipates task requirements.',
    keywords: ['DeX', 'One UI 8.5', 'Galaxy AI', 'Multitasking'],
    generatedMedia: [
      { id: 'gm1', type: 'AUDIO', title: 'Neural Podcast: One UI 8.5', duration: '12:45', sourceCount: 2, createdAt: Date.now() - 15 * 24 * 60 * 60 * 1000 }
    ],
    visualFingerprint: {
      category: 'mobile',
      icon: 'smartphone',
      bgColor: '#0F172A',
      bgColorAlt: '#1E293B',
      accent: '#38BDF8',
      assignedAt: 1768867200000
    },
    isShared: true // Marked as shared
  },
  {
    id: '2',
    title: 'Quantum Physics Intro',
    createdAt: 1768780800000,
    sources: [],
    generatedMedia: [],
    visualFingerprint: {
      category: 'science',
      icon: 'atom',
      bgColor: '#3B0764',
      bgColorAlt: '#581C87',
      accent: '#D8B4FE',
      assignedAt: 1768780800000
    },
    isShared: false
  },
  {
    id: '3',
    title: 'Market Research Q3',
    createdAt: 1768694400000,
    sources: [],
    generatedMedia: [],
    visualFingerprint: {
      category: 'business',
      icon: 'briefcase',
      bgColor: '#064E3B',
      bgColorAlt: '#065F46',
      accent: '#6EE7B7',
      assignedAt: 1768694400000
    },
    isShared: false
  }
];
