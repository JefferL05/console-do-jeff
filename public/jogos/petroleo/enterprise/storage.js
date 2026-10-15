import { KEY, decode } from './persistence.js';

export const SLOTS = [KEY, `${KEY}-slot-2`, `${KEY}-slot-3`];
export const ACTIVE_SLOT = `${KEY}-active-slot`;
export function slotKey(slot) {
  if (!Number.isInteger(slot) || slot < 0 || slot >= SLOTS.length) throw new Error('Espaço de campanha inválido.');
  return SLOTS[slot];
}
export function writeSlot(storage, slot, raw) {
  if (!decode(raw)) throw new Error('A campanha não passou na validação. O save anterior foi preservado.');
  const key = slotKey(slot), previous = storage.getItem(key);
  // Back up only a validated predecessor. A corrupt primary must never replace
  // the last good backup. Identical autosaves do not rotate the backup.
  if (previous !== raw && previous && decode(previous)) storage.setItem(`${key}:backup`, previous);
  storage.setItem(key, raw);
}
export function restoreSlot(storage, slot) {
  const key = slotKey(slot), raw = storage.getItem(`${key}:backup`);
  if (!raw || !decode(raw)) throw new Error('Nenhuma cópia de recuperação válida neste espaço.');
  storage.setItem(key, raw); return decode(raw);
}
export function importSlot(storage, slot, raw) {
  if (typeof raw !== 'string' || raw.length > 1e6 || !decode(raw)) throw new Error('Arquivo inválido ou incompatível. Nenhum save foi alterado.');
  writeSlot(storage, slot, raw); return decode(raw);
}
export function slotSummary(storage, slot) {
  const key = slotKey(slot), raw = storage.getItem(key), state = raw ? decode(raw) : null;
  return { empty: raw === null, valid: !!state, season: state?.campaign.season, wealth: state?.campaign.cash, backup: !!decode(storage.getItem(`${key}:backup`)) };
}
