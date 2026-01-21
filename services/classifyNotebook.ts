
import { NotebookCategory, NotebookVisualFingerprint } from '../types';
import { iconMap } from './icons';

const keywordMap: Record<NotebookCategory, string[]> = {
  technology: ['ai', 'software', 'api', 'code', 'developer', 'cloud', 'chip', 'processor'],
  mobile: ['android', 'ios', 'samsung', 'pixel', 'one ui', 'dex', 'mobile', 'smartphone'],
  science: ['physics', 'quantum', 'biology', 'chemistry', 'neuroscience', 'atom', 'experiment'],
  business: ['market', 'strategy', 'startup', 'sales', 'revenue', 'business', 'briefcase'],
  design: ['ui', 'ux', 'design', 'figma', 'layout', 'typography', 'palette'],
  finance: ['finance', 'stocks', 'trading', 'investment', 'earnings', 'bank', 'economy'],
  education: ['course', 'lesson', 'learning', 'study', 'curriculum', 'book'],
  research: ['paper', 'study', 'analysis', 'experiment', 'dataset', 'flask', 'thesis'],
  general: [],
};

export function createVisualFingerprint(title: string): NotebookVisualFingerprint {
  const text = title.toLowerCase();
  let category: NotebookCategory = 'general';

  for (const [cat, keywords] of Object.entries(keywordMap)) {
    if (keywords.some(k => text.includes(k))) {
      category = cat as NotebookCategory;
      break;
    }
  }

  const spec = iconMap[category];

  return {
    category,
    icon: spec.icon,
    bgColor: spec.bgColor,
    bgColorAlt: spec.bgColorAlt,
    accent: spec.accent,
    assignedAt: Date.now()
  };
}
