import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { checkContent } from './content-check';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'content');
const r = checkContent(root);
for (const w of r.warnings) console.warn('⚠ ' + w);
for (const e of r.errors) console.error('✗ ' + e);
console.log(`${r.files} Dateien, ${r.cards} Karten`, r.byArea);
if (r.errors.length) {
  console.error(`${r.errors.length} Fehler – Build abgebrochen.`);
  process.exit(1);
}
console.log('✓ Inhalte gültig');
