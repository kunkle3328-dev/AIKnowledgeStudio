
import React from 'react';
import { Notebook } from './types';

export const COLORS = [
  'bg-[#0D1B3E]', // Deep Navy Blue
  'bg-[#1A0B2E]', // Deep Purple
  'bg-[#051F15]', // Deep Forest Green
  'bg-[#2D1605]', // Deep Bronze
  'bg-[#2D0516]', // Deep Maroon
];

export const MOCK_NOTEBOOKS: Notebook[] = [
  {
    id: '1',
    title: 'One UI 8.5 DeX AI Overhaul',
    emoji: '📱',
    createdAt: 1768867200000, // Jan 20, 2026
    sources: [
      { id: 's1', type: 'text', title: 'Feature List', content: 'Samsung is planning a major overhaul for DeX in One UI 8.5. Key features include AI-driven window management, real-time multitasking summaries, and improved integration with Galaxy AI tools. The redesign aims to make desktop mode more fluid on tablets.' },
      { id: 's2', type: 'text', title: 'Hardware Requirements', content: 'Compatible devices will include Galaxy S24 series and onwards. NPU requirements are high for local AI processing.' }
    ],
    summary: 'One UI 8.5 introduces a transformative DeX experience centered on **AI productivity**. The update focuses on intelligent workspace automation, **Galaxy AI** deep integration, and cross-device fluidity. Users can expect advanced windowing logic that anticipates task requirements.',
    keywords: ['DeX', 'One UI 8.5', 'Galaxy AI', 'Multitasking'],
    color: COLORS[0]
  },
  {
    id: '2',
    title: 'Quantum Physics Intro',
    emoji: '⚛️',
    createdAt: 1768780800000, // Jan 19, 2026
    sources: [],
    color: COLORS[1]
  },
  {
    id: '3',
    title: 'Market Research Q3',
    emoji: '📈',
    createdAt: 1768694400000, // Jan 18, 2026
    sources: [],
    color: COLORS[2]
  }
];
