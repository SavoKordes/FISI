import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { cardFileSchema, type CardFile } from '../src/content/schema';

export type CheckResult = { files: number; cards: number; errors: string[]; warnings: string[]; byArea: Record<string, number> };

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.json') ? [p] : [];
  });
}

const normalize = (s: string) =>
  s.toLowerCase().replace(/[`*_>#|\-–—„“"'.,:;!?()[\]{}]/g, ' ').replace(/\s+/g, ' ').trim();

export function checkContent(root: string): CheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const ids = new Map<string, string>();
  const fronts = new Map<string, string>();
  const byArea: Record<string, number> = {};
  let cards = 0;
  const paths = walk(root);
  for (const path of paths) {
    const rel = relative(root, path);
    let json: unknown;
    try {
      json = JSON.parse(readFileSync(path, 'utf8'));
    } catch (e) {
      errors.push(`${rel}: ungültiges JSON (${(e as Error).message})`);
      continue;
    }
    const parsed = cardFileSchema.safeParse(json);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) errors.push(`${rel}: ${issue.path.join('.')}: ${issue.message}`);
      continue;
    }
    const file: CardFile = parsed.data;
    const folder = rel.split(/[\\/]/)[0];
    if (folder !== file.area.toLowerCase()) errors.push(`${rel}: Datei liegt im Ordner "${folder}", area ist ${file.area}`);
    for (const c of file.cards) {
      cards++;
      byArea[file.area] = (byArea[file.area] ?? 0) + 1;
      if (!c.id.startsWith(file.area.toLowerCase() + '-')) errors.push(`${rel}: ${c.id} passt nicht zur area ${file.area}`);
      if (ids.has(c.id)) errors.push(`${rel}: doppelte ID ${c.id} (auch in ${ids.get(c.id)})`);
      ids.set(c.id, rel);
      const key = normalize(c.front);
      if (fronts.has(key)) errors.push(`${rel}: ${c.id} hat dieselbe Frage wie ${fronts.get(key)}`);
      fronts.set(key, c.id);
      if (c.type === 'mc' && new Set(c.choices).size !== c.choices!.length) errors.push(`${rel}: ${c.id} hat doppelte Antwortoptionen`);
      if (c.type !== 'mc' && c.type !== 'order' && c.choices) warnings.push(`${rel}: ${c.id} hat choices, ist aber ${c.type}`);
    }
  }
  return { files: paths.length, cards, errors, warnings, byArea };
}
