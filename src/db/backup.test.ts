import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { createBackup, parseBackup, restoreBackup } from './backup';

describe('Backup Export/Import', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });

  it('exportiert alle Tabellen ohne API-Key und stellt sie wieder her', async () => {
    await db.cardState.put({ id: 'net-x-01', starred: true, updatedAt: 1 });
    await db.reviewLog.add({ cardId: 'net-x-01', area: 'NET', topic: 'T', rating: 3, prevState: 0, ts: 5, durationMs: 1000 });
    await db.settings.bulkPut([{ key: 'newPerDay', value: 30 }, { key: 'apiKey', value: 'sk-geheim' }]);

    const json = JSON.stringify(await createBackup());
    expect(json).not.toContain('sk-geheim');

    await db.cardState.clear();
    await db.reviewLog.clear();
    await db.settings.put({ key: 'newPerDay', value: 5 });

    await restoreBackup(parseBackup(json), 'replace');
    expect(await db.cardState.get('net-x-01')).toMatchObject({ starred: true });
    expect(await db.reviewLog.count()).toBe(1);
    expect((await db.settings.get('newPerDay'))?.value).toBe(30);
    expect((await db.settings.get('apiKey'))?.value).toBe('sk-geheim'); // lokaler Key bleibt
  });

  it('merge ergänzt Protokolle ohne Duplikate', async () => {
    await db.reviewLog.add({ cardId: 'a', area: 'KA', topic: 'T', rating: 3, prevState: 0, ts: 1, durationMs: 1 });
    const b = await createBackup();
    await db.reviewLog.add({ cardId: 'b', area: 'KA', topic: 'T', rating: 1, prevState: 0, ts: 2, durationMs: 1 });
    await restoreBackup(b, 'merge');
    expect(await db.reviewLog.count()).toBe(2);
  });

  it('lehnt fremde Dateien ab', () => {
    expect(() => parseBackup('kein json')).toThrow(/JSON/);
    expect(() => parseBackup('{"format":"x"}')).toThrow(/kein Backup/);
    expect(() => parseBackup('{"format":"fisi-trainer-backup","version":99,"tables":{}}')).toThrow(/neueren/);
  });
});
