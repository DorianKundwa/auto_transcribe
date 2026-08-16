import { useState, useCallback, useRef } from 'react';
import {
  submitTranscription,
  subscribeProgress,
  fetchResult,
  deleteJob,
} from '@/lib/api';
import { TranscribeSettings, TranscriptResult, ProgressStage, ProgressEvent } from '@/lib/types';

export type TranscriptionStatus = 'idle' | 'uploading' | 'processing' | 'complete' | 'error';

const STAGE_LABELS: Record<ProgressStage, string> = {
  uploading: 'Uploading audio…',
  loading_model: 'Loading WhisperX model…',
  transcribing: 'Transcribing audio…',
  aligning: 'Aligning words…',
  segmenting: 'Segmenting sentences…',
  complete: 'Complete!',
  error: 'Error',
};

const STAGE_ORDER: ProgressStage[] = [
  'uploading',
  'loading_model',
  'transcribing',
  'aligning',
  'segmenting',
  'complete',
];

export function useTranscription() {
  const [status, setStatus] = useState<TranscriptionStatus>('idle');
  const [stage, setStage] = useState<ProgressStage>('uploading');
  const [pct, setPct] = useState(0);
  const [stageLabel, setStageLabel] = useState('');
  const [result, setResult] = useState<TranscriptResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const jobIdRef = useRef<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  const startTranscription = useCallback(
    async (file: File, settings: TranscribeSettings) => {
      setStatus('uploading');
      setStage('uploading');
      setPct(0);
      setStageLabel(STAGE_LABELS.uploading);
      setError(null);
      setResult(null);

      try {
        const jobId = await submitTranscription(file, settings);
        jobIdRef.current = jobId;
        setStatus('processing');
        setStage('loading_model');
        setStageLabel(STAGE_LABELS.loading_model);

        const unsub = subscribeProgress(
          jobId,
          async (evt: ProgressEvent) => {
            setStage(evt.stage);
            setPct(evt.pct);
            setStageLabel(STAGE_LABELS[evt.stage] ?? evt.stage);

            if (evt.stage === 'complete') {
              try {
                const res = await fetchResult(jobId);
                setResult(res);
                setStatus('complete');
              } catch (fetchErr: unknown) {
                setError(String(fetchErr));
                setStatus('error');
              }
            } else if (evt.stage === 'error') {
              setError(evt.error ?? 'Unknown error');
              setStatus('error');
            }
          },
          (err) => {
            setError(err.message);
            setStatus('error');
          },
        );

        unsubRef.current = unsub;
      } catch (err: unknown) {
        setError(String(err));
        setStatus('error');
      }
    },
    [],
  );

  const reset = useCallback(() => {
    unsubRef.current?.();
    if (jobIdRef.current) {
      deleteJob(jobIdRef.current).catch(() => {});
      jobIdRef.current = null;
    }
    setStatus('idle');
    setStage('uploading');
    setPct(0);
    setStageLabel('');
    setError(null);
    setResult(null);
  }, []);

  const stageIndex = STAGE_ORDER.indexOf(stage);

  return {
    status,
    stage,
    pct,
    stageLabel,
    stageIndex,
    stageOrder: STAGE_ORDER,
    result,
    error,
    startTranscription,
    reset,
  };
}
