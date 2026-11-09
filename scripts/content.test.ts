import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { checkContent } from './content-check';

describe('Inhalte', () => {
  it('sind gegen das Zod-Schema gültig, ohne doppelte IDs oder Fragen', () => {
    const r = checkContent(join(__dirname, '..', 'src', 'content'));
    expect(r.errors).toEqual([]);
    expect(r.cards).toBeGreaterThan(0);
  });
});
