'use client';

import { useCallback, useState } from 'react';
import { Upload, Music, X, FileAudio } from 'lucide-react';

const ALLOWED_TYPES = [
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav',
  'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/aac',
  'audio/flac', 'audio/x-flac', 'audio/ogg', 'audio/webm',
];
const ALLOWED_EXT = ['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg', '.webm'];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

interface AudioUploaderProps {
  onFileSelected: (file: File, duration: number) => void;
  onClear: () => void;
  disabled?: boolean;
  selectedFile?: File | null;
  duration?: number;
}

export function AudioUploader({
  onFileSelected,
  onClear,
  disabled,
  selectedFile,
  duration = 0,
}: AudioUploaderProps) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFile = (f: File): boolean => {
    const ext = '.' + f.name.split('.').pop()?.toLowerCase();
    const validType = ALLOWED_TYPES.includes(f.type) || ALLOWED_EXT.includes(ext);
    if (!validType) {
      setError(`Unsupported format. Use: ${ALLOWED_EXT.join(', ')}`);
      return false;
    }
    if (f.size > 2 * 1024 * 1024 * 1024) { // 2GB
      setError('File too large (max 2 GB)');
      return false;
    }
    setError(null);
    return true;
  };

  const processFile = useCallback((f: File) => {
    if (!validateFile(f)) return;

    const audio = new Audio();
    audio.src = URL.createObjectURL(f);
    audio.onloadedmetadata = () => {
      onFileSelected(f, audio.duration);
      URL.revokeObjectURL(audio.src);
    };
    audio.onerror = () => {
      // If we can't read duration, still accept the file
      onFileSelected(f, 0);
      URL.revokeObjectURL(audio.src);
    };
  }, [onFileSelected]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const f = e.dataTransfer.files[0];
    if (f) processFile(f);
  }, [disabled, processFile]);

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
    e.target.value = '';
  }, [processFile]);

  if (selectedFile) {
    return (
      <div className="upload-success">
        <div className="upload-success-icon">
          <FileAudio size={24} />
        </div>
        <div className="upload-success-info">
          <p className="upload-filename">{selectedFile.name}</p>
          <p className="upload-meta">
            {formatFileSize(selectedFile.size)}
            {duration > 0 && <> · {formatDuration(duration)}</>}
          </p>
        </div>
        {!disabled && (
          <button className="upload-clear-btn" onClick={onClear} aria-label="Remove file">
            <X size={16} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      <label
        htmlFor="audio-upload"
        className={`dropzone ${dragging ? 'dropzone--dragging' : ''} ${disabled ? 'dropzone--disabled' : ''}`}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <div className="dropzone-icon">
          <Upload size={28} />
        </div>
        <p className="dropzone-title">Drop audio file here</p>
        <p className="dropzone-sub">
          or <span className="dropzone-link">browse files</span>
        </p>
        <p className="dropzone-hint">{ALLOWED_EXT.join(', ')} · up to 2 GB</p>
        <input
          id="audio-upload"
          type="file"
          accept={ALLOWED_EXT.join(',')}
          className="sr-only"
          onChange={onInputChange}
          disabled={disabled}
        />
      </label>
      {error && <p className="upload-error">{error}</p>}
    </div>
  );
}
