
import { NotebookCategory, NotebookIcon } from '../types';

export type NotebookIconSpec = {
  icon: NotebookIcon;
  bgColor: string;       // gradient start
  bgColorAlt: string;    // gradient end
  accent: string;        // glow / icon tint
};

export const iconMap: Record<NotebookCategory, NotebookIconSpec> = {
  technology: {
    icon: 'chip',
    bgColor: '#1E3A8A',
    bgColorAlt: '#2563EB',
    accent: '#60A5FA',
  },
  mobile: {
    icon: 'smartphone',
    bgColor: '#0F172A',
    bgColorAlt: '#1E293B',
    accent: '#38BDF8',
  },
  science: {
    icon: 'atom',
    bgColor: '#3B0764',
    bgColorAlt: '#581C87',
    accent: '#D8B4FE',
  },
  business: {
    icon: 'briefcase',
    bgColor: '#064E3B',
    bgColorAlt: '#065F46',
    accent: '#6EE7B7',
  },
  design: {
    icon: 'palette',
    bgColor: '#312E81',
    bgColorAlt: '#4338CA',
    accent: '#A5B4FC',
  },
  finance: {
    icon: 'trending-up',
    bgColor: '#052E16',
    bgColorAlt: '#14532D',
    accent: '#4ADE80',
  },
  education: {
    icon: 'book-open',
    bgColor: '#1F2933',
    bgColorAlt: '#374151',
    accent: '#FCD34D',
  },
  research: {
    icon: 'flask',
    bgColor: '#312E81',
    bgColorAlt: '#4C1D95',
    accent: '#C4B5FD',
  },
  general: {
    icon: 'folder',
    bgColor: '#1F2937',
    bgColorAlt: '#374151',
    accent: '#9CA3AF',
  },
};
