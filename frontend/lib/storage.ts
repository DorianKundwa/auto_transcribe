import { AppMode, TranscribeSettings, TtsSettings, TranscriptResult, Segment } from './types';

const STORAGE_KEYS = {
  MODE: 'autotranscribe_mode',
  SCRIPT_DRAFT: 'autotranscribe_script_draft',
  TTS_SETTINGS: 'autotranscribe_tts_settings',
  TRANSCRIBE_SETTINGS: 'autotranscribe_transcribe_settings',
  ACTIVE_RESULT: 'autotranscribe_active_result',
  EDITED_SEGMENTS: 'autotranscribe_edited_segments',
  HISTORY: 'autotranscribe_history',
} as const;

export interface HistoryItem {
  id: string;
  timestamp: number;
  title: string;
  mode: AppMode;
  duration: number;
  language: string;
  segmentsCount: number;
  jobId?: string;
  hasWav?: boolean;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function getStoredItem<T>(key: string, defaultValue: T): T {
  if (!isBrowser()) return defaultValue;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return defaultValue;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`[AutoTranscribe Storage] Failed to load key "${key}":`, err);
    return defaultValue;
  }
}

export function setStoredItem<T>(key: string, value: T): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`[AutoTranscribe Storage] Failed to save key "${key}":`, err);
  }
}

export function removeStoredItem(key: string): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(key);
  } catch (err) {
    console.warn(`[AutoTranscribe Storage] Failed to remove key "${key}":`, err);
  }
}

// ---------------------------------------------------------------------------
// Typed Getters and Setters
// ---------------------------------------------------------------------------

export function loadSavedMode(defaultMode: AppMode = 'tts'): AppMode {
  return getStoredItem<AppMode>(STORAGE_KEYS.MODE, defaultMode);
}

export function saveMode(mode: AppMode): void {
  setStoredItem(STORAGE_KEYS.MODE, mode);
}

export function loadSavedScriptDraft(defaultScript = ''): string {
  return getStoredItem<string>(STORAGE_KEYS.SCRIPT_DRAFT, defaultScript);
}

export function saveScriptDraft(script: string): void {
  setStoredItem(STORAGE_KEYS.SCRIPT_DRAFT, script);
}

export function loadSavedTtsSettings(defaults: TtsSettings): TtsSettings {
  const saved = getStoredItem<Partial<TtsSettings>>(STORAGE_KEYS.TTS_SETTINGS, {});
  return {
    ...defaults,
    ...saved,
    // Ensure nested objects merge gracefully
    dsp: saved.dsp ? { ...defaults.dsp, ...saved.dsp } : defaults.dsp,
  };
}

export function saveTtsSettings(settings: TtsSettings): void {
  setStoredItem(STORAGE_KEYS.TTS_SETTINGS, settings);
}

export function loadSavedTranscribeSettings(defaults: TranscribeSettings): TranscribeSettings {
  const saved = getStoredItem<Partial<TranscribeSettings>>(STORAGE_KEYS.TRANSCRIBE_SETTINGS, {});
  return {
    ...defaults,
    ...saved,
  };
}

export function saveTranscribeSettings(settings: TranscribeSettings): void {
  setStoredItem(STORAGE_KEYS.TRANSCRIBE_SETTINGS, settings);
}

export interface StoredActiveState {
  result: TranscriptResult | null;
  segments: Segment[];
  mode: AppMode;
  timestamp: number;
}

export function loadSavedActiveState(): StoredActiveState | null {
  return getStoredItem<StoredActiveState | null>(STORAGE_KEYS.ACTIVE_RESULT, null);
}

export function saveActiveState(state: StoredActiveState | null): void {
  if (state === null) {
    removeStoredItem(STORAGE_KEYS.ACTIVE_RESULT);
  } else {
    setStoredItem(STORAGE_KEYS.ACTIVE_RESULT, state);
  }
}

export function loadSavedHistory(): HistoryItem[] {
  return getStoredItem<HistoryItem[]>(STORAGE_KEYS.HISTORY, []);
}

export function saveHistoryItem(item: HistoryItem): void {
  const current = loadSavedHistory();
  // Filter out any existing item with same id
  const filtered = current.filter((h) => h.id !== item.id);
  // Keep up to 25 most recent items
  const updated = [item, ...filtered].slice(0, 25);
  setStoredItem(STORAGE_KEYS.HISTORY, updated);
}

export function clearSavedHistory(): void {
  removeStoredItem(STORAGE_KEYS.HISTORY);
}

export function clearAllPersistedState(): void {
  removeStoredItem(STORAGE_KEYS.SCRIPT_DRAFT);
  removeStoredItem(STORAGE_KEYS.ACTIVE_RESULT);
  removeStoredItem(STORAGE_KEYS.EDITED_SEGMENTS);
}
