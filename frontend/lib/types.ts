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

export interface VoiceBlendItem {
  voice: string;
  weight: number; // e.g. 50 (percentage or ratio)
}

export interface TtsSettings {
  mode: 'single' | 'blend';
  voice: string;                  // active single voice ID
  voiceBlend: VoiceBlendItem[];    // multi-selected voices with weights
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

export interface CustomVoice {
  id: string;
  name: string;
  gender: 'Female' | 'Male';
  lang: string;
  langCode: string;
  flag: string;
  duration: number;
  median_pitch?: number;
  f1?: number;
  f2?: number;
  f3?: number;
  spectral_centroid?: number;
  warmth_score?: number;
  matched_anchors?: Array<{ name: string; weight: number }>;
  created_at: number;
  is_custom: boolean;
}

