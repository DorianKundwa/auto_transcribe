import { ProgressEvent, TranscriptResult, Segment, TranscribeSettings, TtsSettings, VoiceBlendItem, CustomVoice, VoiceboxDspSettings, TrainingProgressEvent } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:8000';

export function getWavDownloadUrl(jobId: string): string {
  return `${API_BASE}/api/download/wav/${jobId}`;
}

export async function submitTranscription(
  file: File,
  settings: TranscribeSettings,
): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  form.append('model', settings.model);
  form.append('language', settings.language);
  form.append('device', settings.device);
  form.append('pause_threshold', String(settings.pauseThreshold));

  const res = await fetch(`${API_BASE}/api/transcribe`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? 'Upload failed');
  }

  const { job_id } = await res.json();
  return job_id;
}

export async function submitTTS(
  script: string,
  settings: TtsSettings,
): Promise<string> {
  const voicePayload =
    settings.mode === 'blend' && settings.voiceBlend.length > 0
      ? settings.voiceBlend
      : settings.voice;

  const res = await fetch(`${API_BASE}/api/tts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      script,
      voice: voicePayload,
      lang_code: settings.langCode,
      speed: settings.speed,
      exaggeration: settings.exaggeration ?? 0.5,
      cfg_weight: settings.cfg_weight ?? 0.5,
      model: settings.model,
      device: settings.device,
      pause_threshold: settings.pauseThreshold,
      dsp: settings.dsp
        ? {
            delivery_preset: settings.dsp.deliveryPreset,
            warmth: settings.dsp.warmth,
            clarity: settings.dsp.clarity,
            pitch_shift: settings.dsp.pitchShift,
            reverb: settings.dsp.reverb,
            compression: settings.dsp.compression,
          }
        : undefined,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? 'TTS request failed');
  }

  const { job_id } = await res.json();
  return job_id;
}

export async function previewTtsVoice(
  voice: string | VoiceBlendItem[],
  langCode: string,
  speed = 1.0,
  text?: string,
  exaggeration = 0.5,
  cfgWeight = 0.5,
  dsp?: VoiceboxDspSettings,
): Promise<string> {
  const res = await fetch(`${API_BASE}/api/tts/preview`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      voice,
      lang_code: langCode,
      speed,
      text,
      exaggeration,
      cfg_weight: cfgWeight,
      dsp: dsp
        ? {
            delivery_preset: dsp.deliveryPreset,
            warmth: dsp.warmth,
            clarity: dsp.clarity,
            pitch_shift: dsp.pitchShift,
            reverb: dsp.reverb,
            compression: dsp.compression,
          }
        : undefined,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? 'Preview failed');
  }

  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function inspectWatermark(jobId: string): Promise<{ has_watermark: boolean; score: number; engine?: string; error?: string }> {
  const res = await fetch(`${API_BASE}/api/tts/watermark/verify/${jobId}`);
  if (!res.ok) {
    throw new Error('Watermark inspection failed');
  }
  return res.json();
}

export function subscribeProgress(
  jobId: string,
  onEvent: (evt: ProgressEvent) => void,
  onError?: (err: Error) => void,
): () => void {
  const es = new EventSource(`${API_BASE}/api/progress/${jobId}`);

  es.onmessage = (e) => {
    try {
      const evt: ProgressEvent = JSON.parse(e.data);
      onEvent(evt);
      if (evt.stage === 'complete' || evt.stage === 'error') {
        es.close();
      }
    } catch {
      // ignore parse errors
    }
  };

  es.onerror = (e) => {
    es.close();
    onError?.(new Error('SSE connection lost'));
  };

  return () => es.close();
}

export async function fetchResult(jobId: string): Promise<TranscriptResult> {
  const res = await fetch(`${API_BASE}/api/result/${jobId}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? 'Failed to fetch result');
  }
  const raw = await res.json();

  // Attach client-side IDs to segments
  const segments: Segment[] = (raw.segments ?? []).map(
    (s: Omit<Segment, 'id'>, i: number) => ({
      ...s,
      id: `seg-${i}-${Date.now()}`,
    }),
  );

  return {
    segments,
    language: raw.language,
    duration: raw.duration,
    has_wav: raw.has_wav ?? false,
    job_id: jobId,
  };
}

export async function downloadWavFile(jobId: string, filename = 'speech.wav'): Promise<void> {
  const res = await fetch(getWavDownloadUrl(jobId));
  if (!res.ok) {
    throw new Error('Failed to download WAV file');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function getMp3DownloadUrl(jobId: string): string {
  return `${API_BASE}/api/download/mp3/${jobId}`;
}

export async function downloadMp3File(jobId: string, filename = 'speech.mp3'): Promise<void> {
  const res = await fetch(getMp3DownloadUrl(jobId));
  if (!res.ok) {
    throw new Error('Failed to download MP3 file');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function deleteJob(jobId: string): Promise<void> {
  await fetch(`${API_BASE}/api/job/${jobId}`, { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// Voice Cloning & Custom Voices API Client
// ---------------------------------------------------------------------------

export async function cloneVoice(
  audioBlobOrFile: Blob | File,
  name: string,
  gender: string = 'Male',
  langCode: string = 'a',
): Promise<CustomVoice> {
  const form = new FormData();
  const filename = audioBlobOrFile instanceof File ? audioBlobOrFile.name : 'recording.webm';
  form.append('file', audioBlobOrFile, filename);
  form.append('name', name);
  form.append('gender', gender);
  form.append('lang_code', langCode);

  const res = await fetch(`${API_BASE}/api/voices/clone`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? 'Voice cloning failed');
  }

  return await res.json();
}

export async function fetchCustomVoices(): Promise<CustomVoice[]> {
  const res = await fetch(`${API_BASE}/api/voices/custom`);
  if (!res.ok) {
    throw new Error('Failed to load custom voices');
  }
  return await res.json();
}

export async function deleteCustomVoice(voiceId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/voices/custom/${voiceId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error('Failed to delete custom voice');
  }
}

export function getCustomVoiceSampleUrl(voiceId: string): string {
  return `${API_BASE}/api/voices/sample/${voiceId}`;
}

export interface VoiceVerifyResult {
  similarity_pct: number;
  is_match: boolean;
  match_level: 'High' | 'Moderate' | 'Low';
  encoder: string;
}

export async function verifyVoiceSimilarity(
  fileOrBlob: Blob | File,
  voiceId?: string,
  secondFileOrBlob?: Blob | File,
): Promise<VoiceVerifyResult> {
  const form = new FormData();
  const filenameA = (fileOrBlob as File).name || 'sample_a.webm';
  form.append('file_a', fileOrBlob, filenameA);

  if (voiceId) {
    form.append('voice_id', voiceId);
  } else if (secondFileOrBlob) {
    const filenameB = (secondFileOrBlob as File).name || 'sample_b.webm';
    form.append('file_b', secondFileOrBlob, filenameB);
  }

  const res = await fetch(`${API_BASE}/api/voices/verify`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? 'Voice verification failed');
  }

  return await res.json();
}

export async function startVoiceTraining(
  fileOrBlob: Blob | File,
  name: string,
  gender?: string,
  langCode: string = 'a',
  epochs: number = 100,
): Promise<string> {
  const form = new FormData();
  const filename = (fileOrBlob as File).name || 'training_voice.webm';
  form.append('file', fileOrBlob, filename);
  form.append('name', name);
  if (gender) form.append('gender', gender);
  form.append('lang_code', langCode);
  form.append('epochs', String(epochs));

  const res = await fetch(`${API_BASE}/api/voices/train`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? 'Failed to start voice training');
  }

  const data = await res.json();
  return data.job_id;
}

export function subscribeVoiceTrainingProgress(
  jobId: string,
  onEvent: (evt: TrainingProgressEvent) => void,
  onError?: (err: Error) => void,
): () => void {
  const es = new EventSource(`${API_BASE}/api/progress/${jobId}`);

  es.onmessage = (e) => {
    try {
      const evt: TrainingProgressEvent = JSON.parse(e.data);
      onEvent(evt);
      if (evt.stage === 'complete' || evt.stage === 'error') {
        es.close();
      }
    } catch {
      // ignore parse errors
    }
  };

  es.onerror = () => {
    es.close();
    onError?.(new Error('Training SSE stream disconnected'));
  };

  return () => es.close();
}


