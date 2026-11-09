/** Netzplan-Berechnung (Vorgangsknotennetz, Start bei 0) */

export type Activity = { id: string; duration: number; preds: string[] };
export type Scheduled = Activity & { faz: number; fez: number; saz: number; sez: number; gp: number; fp: number; succs: string[] };

export function schedule(acts: Activity[]): { rows: Scheduled[]; end: number } {
  const byId = new Map(acts.map((a) => [a.id, a]));
  const succs = new Map<string, string[]>(acts.map((a) => [a.id, []]));
  for (const a of acts) for (const p of a.preds) succs.get(p)!.push(a.id);
  // topologische Reihenfolge (Eingabe ist bereits sortiert, zur Sicherheit prüfen)
  const order: string[] = [];
  const seen = new Set<string>();
  const visit = (id: string, stack: Set<string>) => {
    if (seen.has(id)) return;
    if (stack.has(id)) throw new Error('Zyklus im Netzplan');
    stack.add(id);
    for (const p of byId.get(id)!.preds) visit(p, stack);
    stack.delete(id);
    seen.add(id);
    order.push(id);
  };
  for (const a of acts) visit(a.id, new Set());

  const faz = new Map<string, number>();
  const fez = new Map<string, number>();
  for (const id of order) {
    const a = byId.get(id)!;
    const start = Math.max(0, ...a.preds.map((p) => fez.get(p)!));
    faz.set(id, start);
    fez.set(id, start + a.duration);
  }
  const end = Math.max(...acts.map((a) => fez.get(a.id)!));
  const saz = new Map<string, number>();
  const sez = new Map<string, number>();
  for (const id of [...order].reverse()) {
    const s = succs.get(id)!;
    const latestEnd = s.length ? Math.min(...s.map((x) => saz.get(x)!)) : end;
    sez.set(id, latestEnd);
    saz.set(id, latestEnd - byId.get(id)!.duration);
  }
  const rows = acts.map((a) => {
    const s = succs.get(a.id)!;
    const fp = (s.length ? Math.min(...s.map((x) => faz.get(x)!)) : end) - fez.get(a.id)!;
    return { ...a, succs: s, faz: faz.get(a.id)!, fez: fez.get(a.id)!, saz: saz.get(a.id)!, sez: sez.get(a.id)!, gp: saz.get(a.id)! - faz.get(a.id)!, fp };
  });
  return { rows, end };
}

/** alle kritischen Pfade (Folgen von Vorgängen mit GP = 0 vom Start bis zum Ende) */
export function criticalPaths(rows: Scheduled[], end: number): string[][] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const out: string[][] = [];
  const walk = (id: string, path: string[]) => {
    const r = byId.get(id)!;
    const next = r.succs.map((s) => byId.get(s)!).filter((s) => s.gp === 0 && s.faz === r.fez);
    if (r.fez === end && (!r.succs.length || !next.length)) {
      out.push([...path, id]);
      return;
    }
    for (const n of next) walk(n.id, [...path, id]);
  };
  for (const r of rows) if (!r.preds.length && r.gp === 0) walk(r.id, []);
  return out;
}
