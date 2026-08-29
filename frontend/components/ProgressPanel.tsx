'use client';

import { ProgressStage, AppMode } from '@/lib/types';
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';

const TRANSCRIBE_STAGES: { key: ProgressStage; label: string }[] = [
  { key: 'uploading',     label: 'Uploading' },
  { key: 'loading_model', label: 'Loading model' },
  { key: 'transcribing',  label: 'Transcribing' },
  { key: 'aligning',      label: 'Aligning words' },
  { key: 'segmenting',    label: 'Segmenting' },
  { key: 'complete',      label: 'Complete' },
];

const TTS_STAGES: { key: ProgressStage; label: string }[] = [
  { key: 'generating_audio', label: 'Chatterbox TTS' },
  { key: 'loading_model',    label: 'Loading model' },
  { key: 'transcribing',     label: 'Transcribing' },
  { key: 'aligning',         label: 'Aligning words' },
  { key: 'segmenting',       label: 'Segmenting' },
  { key: 'complete',         label: 'Complete' },
];

interface ProgressPanelProps {
  stage: ProgressStage;
  pct: number;
  stageLabel: string;
  error?: string | null;
  stageIndex: number;
  mode?: AppMode;
}

export function ProgressPanel({
  stage,
  pct,
  stageLabel,
  error,
  stageIndex,
  mode = 'transcribe',
}: ProgressPanelProps) {
  const isError = stage === 'error';
  const isComplete = stage === 'complete';
  const stages = mode === 'tts' ? TTS_STAGES : TRANSCRIBE_STAGES;

  return (
    <div className="progress-panel">
      {/* Step indicators */}
      <div className="progress-steps">
        {stages.slice(0, -1).map((s, i) => {
          const done = stageIndex > i;
          const active = stageIndex === i && !isComplete;

          return (
            <div
              key={s.key}
              className={`progress-step ${done ? 'done' : ''} ${active ? 'active' : ''} ${
                isError && active ? 'error' : ''
              }`}
            >
              <div className="progress-step-circle">
                {done ? (
                  <CheckCircle size={14} />
                ) : active ? (
                  isError ? (
                    <AlertCircle size={14} />
                  ) : (
                    <Loader2 size={14} className="spin" />
                  )
                ) : (
                  <span className="progress-step-num">{i + 1}</span>
                )}
              </div>
              <span className="progress-step-label">{s.label}</span>
              {i < stages.length - 2 && (
                <div className={`progress-connector ${done ? 'done' : ''}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      {!isError && (
        <div className="progress-bar-container">
          <div
            className={`progress-bar-fill ${isComplete ? 'complete' : ''}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {/* Status text */}
      <div className="progress-status">
        {isError ? (
          <span className="progress-error-text">
            <AlertCircle size={14} />
            {error || 'Operation failed'}
          </span>
        ) : (
          <span className={`progress-stage-text ${isComplete ? 'complete' : ''}`}>
            {isComplete ? (
              <>
                <CheckCircle size={14} />
                {mode === 'tts' ? 'TTS synthesis & alignment complete' : 'Transcription complete'}
              </>
            ) : (
              <>
                <Loader2 size={14} className="spin" />
                {stageLabel} — {pct}%
              </>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
