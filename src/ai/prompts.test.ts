import { describe, expect, it } from 'vitest';
import type { Card } from '../content/schema';
import { cardContext, examinerPrompt, gradePrompt, gradeUserMessage } from './prompts';
import { toCard } from '../pages/AiGenerate';

const card: Card = { id: 'net-x-01', area: 'NET', topic: 'VLAN', type: 'qa', front: 'Nennen Sie zwei Vorteile von VLANs.', back: '- Sicherheit\n- Broadcast-Domänen', difficulty: 1, examRelevance: 'hoch', source: 'builtin', points: 4 };

describe('Prompts', () => {
  it('Bewertung enthält Musterlösung, Punktzahl und Antwort', () => {
    const p = gradePrompt(4);
    expect(p).toContain('Punkte: X von 4');
    const m = gradeUserMessage(card, 'Mehr Sicherheit');
    expect(m).toContain('Musterlösung');
    expect(m).toContain('Broadcast-Domänen');
    expect(m).toContain('Mehr Sicherheit');
  });
  it('Kartenkontext markiert richtige MC-Antworten', () => {
    const mc: Card = { ...card, type: 'mc', choices: ['a', 'b'], correct: [1] };
    expect(cardContext(mc)).toContain('b) b (richtig)');
  });
  it('Fachgespräch-Prompt enthält die Projektbeschreibung', () => {
    expect(examinerPrompt('Backup mit Veeam')).toContain('Backup mit Veeam');
  });
});

describe('KI-Aufgabe → Karte', () => {
  it('offene Aufgabe', () => {
    const c = toCard({ front: ' F ', back: 'B', points: 6, difficulty: 7, choices: [], correct: [] }, 'KA', 'Backup', 0, 1000);
    expect(c).toMatchObject({ type: 'qa', front: 'F', difficulty: 3, points: 6, source: 'ai', area: 'KA', topic: 'Backup' });
    expect(c.id).toBe('ka-ki-rs-01');
    expect(c.tags).toContain('ki-generiert');
  });
  it('Multiple Choice mit ungültigen Indizes wird bereinigt bzw. zu qa', () => {
    const mc = toCard({ front: 'F', back: 'B', points: 2, difficulty: 1, choices: ['x', 'y', 'z'], correct: [2, 2, 9] }, 'WISO', 'T', 1);
    expect(mc.type).toBe('mc');
    expect(mc.correct).toEqual([2]);
    const broken = toCard({ front: 'F', back: 'B', points: 2, difficulty: 1, choices: ['x', 'y'], correct: [5] }, 'WISO', 'T', 2);
    expect(broken.type).toBe('qa');
    expect(broken.choices).toBeUndefined();
  });
});
