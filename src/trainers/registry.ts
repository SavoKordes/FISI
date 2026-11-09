import type { Level, Task, Trainer } from './types';
import { Rng } from './lib/rng';
import { subnetTrainer } from './subnet';
import { ipv6Trainer } from './ipv6';
import { numbersTrainer } from './numbers';
import { raidTrainer } from './raid';
import { transferTrainer } from './transfer';
import { backupTrainer } from './backup';
import { availabilityTrainer } from './availability';
import { economicsTrainer } from './economics';

export const TRAINERS: Trainer[] = [subnetTrainer, ipv6Trainer, numbersTrainer, raidTrainer, transferTrainer, backupTrainer, availabilityTrainer, economicsTrainer];

export function getTrainer(id: string): Trainer | undefined {
  return TRAINERS.find((t) => t.id === id);
}

/**
 * Erzeugt eine Aufgabe reproduzierbar aus (Trainer, Aufgabentyp, Level, Seed).
 * typeId "mix" wählt den Aufgabentyp ebenfalls per Seed.
 */
export function generateTask(trainer: Trainer, typeId: string, level: Level, seed: number): Task {
  const rng = new Rng(seed);
  const type = typeId === 'mix' ? rng.pick(trainer.types) : trainer.types.find((t) => t.id === typeId) ?? trainer.types[0];
  const body = type.gen(rng, level);
  return { ...body, trainer: trainer.id, type: type.id, level, seed };
}
