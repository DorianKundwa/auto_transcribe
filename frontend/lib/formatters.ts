import { Segment } from './types';

// ─── Timestamp formatting ────────────────────────────────────────────────────

export function formatTimestamp(seconds: number): string {
  const totalSecs = Math.floor(Math.max(0, seconds));
  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  if (hours > 0) {
    return `[${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}]`;
  }
  return `[${minutes}:${String(secs).padStart(2, '0')}]`;
}

export function parseTimestamp(ts: string): number {
  // Accepts [M:SS] or [H:MM:SS]
  const clean = ts.replace(/[\[\]]/g, '');
  const parts = clean.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
}

// ─── SRT timestamp ───────────────────────────────────────────────────────────

function toSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds - Math.floor(seconds)) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

// ─── VTT timestamp ───────────────────────────────────────────────────────────

function toVttTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds - Math.floor(seconds)) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

// ─── Export generators ───────────────────────────────────────────────────────

export function toTxt(segments: Segment[]): string {
  return segments
    .map((s) => `${formatTimestamp(s.start)} ${s.text.trim()}`)
    .join('\n');
}

export function toSrt(segments: Segment[]): string {
  return segments
    .map((s, i) => {
      const start = toSrtTime(s.start);
      const end = toSrtTime(s.end);
      return `${i + 1}\n${start} --> ${end}\n${s.text.trim()}\n`;
    })
    .join('\n');
}

export function toVtt(segments: Segment[]): string {
  const body = segments
    .map((s) => {
      const start = toVttTime(s.start);
      const end = toVttTime(s.end);
      return `${start} --> ${end}\n${s.text.trim()}`;
    })
    .join('\n\n');
  return `WEBVTT\n\n${body}`;
}

export function toJson(segments: Segment[], language?: string, duration?: number): string {
  const payload = {
    language,
    duration,
    segments: segments.map((s) => ({
      start: s.start,
      end: s.end,
      text: s.text.trim(),
      words: s.words,
    })),
  };
  return JSON.stringify(payload, null, 2);
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
