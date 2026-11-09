import { db, TABLES, type TableName } from './db';
import { PRIVATE_SETTING_KEYS } from './settings';

export const BACKUP_FORMAT = 'fisi-trainer-backup';
export const BACKUP_VERSION = 1;

export type Backup = {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  tables: Partial<Record<TableName, unknown[]>>;
};

export async function createBackup(): Promise<Backup> {
  const tables: Backup['tables'] = {};
  for (const t of TABLES) {
    let rows = await db.table(t).toArray();
    if (t === 'settings') rows = rows.filter((r) => !PRIVATE_SETTING_KEYS.includes(r.key));
    tables[t] = rows;
  }
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), tables };
}

export function parseBackup(text: string): Backup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Die Datei ist kein gültiges JSON.');
  }
  const b = data as Partial<Backup>;
  if (!b || b.format !== BACKUP_FORMAT || typeof b.tables !== 'object' || b.tables === null) {
    throw new Error('Die Datei ist kein Backup des FISI-Trainers.');
  }
  if (typeof b.version !== 'number' || b.version > BACKUP_VERSION) {
    throw new Error('Das Backup stammt aus einer neueren App-Version. Bitte App aktualisieren.');
  }
  for (const [name, rows] of Object.entries(b.tables)) {
    if (!(TABLES as readonly string[]).includes(name)) throw new Error(`Unbekannte Tabelle im Backup: ${name}`);
    if (!Array.isArray(rows)) throw new Error(`Tabelle ${name} ist keine Liste.`);
  }
  return b as Backup;
}

/** mode "replace": Lokale Daten werden durch das Backup ersetzt (der API-Key bleibt erhalten).
 *  mode "merge": Backup-Einträge überschreiben gleiche Schlüssel, Lernprotokolle werden ergänzt. */
export async function restoreBackup(backup: Backup, mode: 'replace' | 'merge' = 'replace') {
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      const rows = (backup.tables[t] ?? []) as Record<string, unknown>[];
      const table = db.table(t);
      if (mode === 'replace') {
        if (t === 'settings') {
          await table.where('key').noneOf(PRIVATE_SETTING_KEYS as string[]).delete();
        } else {
          await table.clear();
        }
        await table.bulkPut(rows.filter((r) => !(t === 'settings' && PRIVATE_SETTING_KEYS.includes(r.key as never))));
      } else {
        const autoInc = table.schema.primKey.auto;
        if (autoInc) {
          // Protokolle: Duplikate über Zeitstempel+Schlüssel vermeiden
          const existing = new Set((await table.toArray()).map((r) => JSON.stringify({ ...r, id: undefined })));
          const fresh = rows
            .map((r) => ({ ...r, id: undefined }))
            .filter((r) => !existing.has(JSON.stringify(r)))
            .map(({ id: _id, ...rest }) => rest);
          await table.bulkAdd(fresh);
        } else {
          await table.bulkPut(rows.filter((r) => !(t === 'settings' && PRIVATE_SETTING_KEYS.includes(r.key as never))));
        }
      }
    }
  });
}

export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
