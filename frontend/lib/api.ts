import { ProgressEvent, TranscriptResult, Segment, TranscribeSettings } from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:8000';

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

  return { segments, language: raw.language, duration: raw.duration };
}

export async function deleteJob(jobId: string): Promise<void> {
  await fetch(`${API_BASE}/api/job/${jobId}`, { method: 'DELETE' });
}
