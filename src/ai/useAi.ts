import { useSettings } from '../db/settings';
import { aiReady } from './config';

/** true, wenn KI eingeschaltet und konfiguriert ist */
export function useAiReady(): boolean {
  return aiReady(useSettings());
}
