import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { checkContent } from './content-check';

describe('Inhalte', () => {
  it('sind gegen das Zod-Schema gültig, ohne doppelte IDs oder Fragen', () => {
    const r = checkContent(join(__dirname, '..', 'src', 'content'));
    expect(r.errors).toEqual([]);
    expect(r.cards).toBeGreaterThan(0);
  });

  it('Fragenpool: mindestens 500 Karten, alle Prüfungsbereiche abgedeckt', () => {
    const r = checkContent(join(__dirname, '..', 'src', 'content'));
    expect(r.cards).toBeGreaterThanOrEqual(500);
    expect(r.byArea.KA).toBeGreaterThanOrEqual(160);
    expect(r.byArea.NET).toBeGreaterThanOrEqual(160);
    expect(r.byArea.WISO).toBeGreaterThanOrEqual(100);
    expect(r.byArea.PROJ).toBeGreaterThanOrEqual(45);
  });
});
