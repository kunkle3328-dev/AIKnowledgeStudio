
import { NotebookCategory } from '../types';

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

export function classifyNotebook(
  title: string,
  sources: string[] = []
): NotebookCategory {
  const text = `${title} ${sources.join(' ')}`.toLowerCase();

  for (const [category, keywords] of Object.entries(keywordMap)) {
    if (keywords.some(k => text.includes(k))) {
      return category as NotebookCategory;
    }
  }

  return 'general';
}
