export interface Word {
  word: string;
  start: number;
  end: number;
  score?: number;
}

export interface Segment {
  id: string; // client-side unique ID
  start: number;
  end: number;
  text: string;
  words: Word[];
}

export interface TranscriptResult {
  segments: Segment[];
  language: string;
  duration: number;
  has_wav?: boolean;
  job_id?: string;
}

export type ProgressStage =
  | 'uploading'
  | 'generating_audio'
  | 'loading_model'
  | 'transcribing'
  | 'aligning'
  | 'segmenting'
  | 'complete'
  | 'error';

export interface ProgressEvent {
  stage: ProgressStage;
  pct: number;
  error?: string;
}

export type DeviceOption = 'auto' | 'cpu' | 'cuda';
export type ModelOption = 'tiny' | 'base' | 'small' | 'medium' | 'large-v2' | 'large-v3';

export interface TranscribeSettings {
  model: ModelOption;
  language: string; // 'auto' or ISO code
  device: DeviceOption;
  pauseThreshold: number;
}

export interface TtsSettings {
  voice: string;
  langCode: string;
  speed: number;
  model: ModelOption;
  device: DeviceOption;
  pauseThreshold: number;
}

export type AppMode = 'transcribe' | 'tts';

export interface EditAction {
  type: 'edit' | 'delete' | 'merge' | 'split' | 'add' | 'reorder';
  before: Segment[];
  after: Segment[];
}
