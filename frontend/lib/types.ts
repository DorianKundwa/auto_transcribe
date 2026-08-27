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

export interface VoiceboxDspSettings {
  deliveryPreset: 'studio_neutral' | 'broadcast_warmth' | 'podcast_clarity' | 'cinematic_narrator' | 'soft_whisper' | 'high_energy';
  warmth: number;       // -100 to 100
  clarity: number;      // -100 to 100
  pitchShift: number;   // -6 to +6 semitones
  reverb: number;       // 0 to 100
  compression: boolean;
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
  dsp?: VoiceboxDspSettings;
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
  has_dvector?: boolean;
  neural_encoder?: string;
  neural_dim?: number;
  training_epochs?: number;
  final_loss?: number;
  speaker_similarity?: number;
  formant_alignment?: number;
  training_mode?: string;
  created_at: number;
  is_custom: boolean;
}

export interface TrainingProgressEvent {
  stage: 'profiling' | 'optimizing' | 'finalizing' | 'complete' | 'error';
  pct: number;
  epoch?: number;
  total_epochs?: number;
  loss?: number;
  speaker_similarity?: number;
  formant_alignment?: number;
  message?: string;
  voice_id?: string;
  voice_record?: CustomVoice;
  error?: string;
}


