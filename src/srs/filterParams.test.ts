import { describe, expect, it } from 'vitest';
import { filterToParams, paramsToFilter } from './filterParams';

describe('Filter ↔ URL', () => {
  it('Roundtrip', () => {
    const f = { areas: ['KA', 'NET'] as const, topics: ['IPv6', 'RAID & Speicher'], difficulty: [1, 3] as const, relevance: ['hoch'] as const, weakOnly: true, starredOnly: false, search: 'dhcp' };
    const s = filterToParams({ ...f, areas: [...f.areas], difficulty: [...f.difficulty], relevance: [...f.relevance] }, { cram: true, extra: undefined });
    const back = paramsToFilter(new URLSearchParams(s));
    expect(back).toEqual({ ...f, areas: ['KA', 'NET'], difficulty: [1, 3], relevance: ['hoch'] });
    expect(new URLSearchParams(s).get('cram')).toBe('1');
  });
  it('ignoriert ungültige Werte', () => {
    const f = paramsToFilter(new URLSearchParams('area=KA,XX&diff=1,7&rel=super'));
    expect(f.areas).toEqual(['KA']);
    expect(f.difficulty).toEqual([1]);
    expect(f.relevance).toEqual([]);
  });
});
