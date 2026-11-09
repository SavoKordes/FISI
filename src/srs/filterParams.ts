import { AREAS, RELEVANCE } from '../content/constants';
import type { Area, Relevance } from '../content/schema';
import type { CardFilter } from './queue';

const list = (v: string | null) => (v ? v.split(',').filter(Boolean) : []);

export function filterToParams(f: CardFilter, extra: Record<string, string | number | boolean | undefined> = {}): string {
  const p = new URLSearchParams();
  if (f.areas?.length) p.set('area', f.areas.join(','));
  if (f.topics?.length) p.set('topic', f.topics.join(','));
  if (f.difficulty?.length) p.set('diff', f.difficulty.join(','));
  if (f.relevance?.length) p.set('rel', f.relevance.join(','));
  if (f.weakOnly) p.set('weak', '1');
  if (f.starredOnly) p.set('star', '1');
  if (f.search) p.set('q', f.search);
  for (const [k, v] of Object.entries(extra)) if (v !== undefined && v !== false) p.set(k, String(v === true ? 1 : v));
  return p.toString();
}

export function paramsToFilter(p: URLSearchParams): CardFilter {
  return {
    areas: list(p.get('area')).filter((a): a is Area => (AREAS as readonly string[]).includes(a)),
    topics: list(p.get('topic')),
    difficulty: list(p.get('diff')).map(Number).filter((d): d is 1 | 2 | 3 => d === 1 || d === 2 || d === 3),
    relevance: list(p.get('rel')).filter((r): r is Relevance => (RELEVANCE as readonly string[]).includes(r)),
    weakOnly: p.get('weak') === '1',
    starredOnly: p.get('star') === '1',
    search: p.get('q') ?? undefined,
  };
}
