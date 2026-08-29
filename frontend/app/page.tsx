'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { AudioUploader } from '@/components/AudioUploader';
import { SettingsPanel } from '@/components/SettingsPanel';
import { TtsPanel } from '@/components/TtsPanel';
import { ProgressPanel } from '@/components/ProgressPanel';
import { AudioPlayer, AudioPlayerHandle } from '@/components/AudioPlayer';
import { TranscriptEditor } from '@/components/TranscriptEditor';
import { ExportPanel } from '@/components/ExportPanel';
import { useTranscription } from '@/hooks/useTranscription';
import { Segment, TranscribeSettings, TtsSettings, AppMode, TranscriptResult } from '@/lib/types';
import { getWavDownloadUrl } from '@/lib/api';
import {
  loadSavedMode,
  saveMode,
  loadSavedScriptDraft,
  saveScriptDraft,
  loadSavedTtsSettings,
  saveTtsSettings,
  loadSavedTranscribeSettings,
  saveTranscribeSettings,
  loadSavedActiveState,
  saveActiveState,
  saveHistoryItem,
} from '@/lib/storage';
import {
  Mic2,
  Sparkles,
  RefreshCw,
  ExternalLink,
  FileAudio,
  CheckCircle2,
  RotateCcw,
  HardDrive,
} from 'lucide-react';

const DEFAULT_TRANSCRIBE_SETTINGS: TranscribeSettings = {
  model: 'base',
  language: 'auto',
  device: 'auto',
  pauseThreshold: 0.75,
};

const DEFAULT_TTS_SETTINGS: TtsSettings = {
  mode: 'single',
  voice: 'default',
  voiceBlend: [
    { voice: 'default', weight: 60 },
    { voice: 'chatterbox_michael', weight: 40 },
  ],
  langCode: 'en',
  speed: 1.0,
  exaggeration: 0.5,
  model: 'base',
  device: 'auto',
  pauseThreshold: 0.75,
};

export default function HomePage() {
  const [mode, setMode] = useState<AppMode>('tts');
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [script, setScript] = useState('');
  const [transcribeSettings, setTranscribeSettings] = useState<TranscribeSettings>(DEFAULT_TRANSCRIBE_SETTINGS);
  const [ttsSettings, setTtsSettings] = useState<TtsSettings>(DEFAULT_TTS_SETTINGS);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [persistedResult, setPersistedResult] = useState<TranscriptResult | null>(null);
  const [persistedJobId, setPersistedJobId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isHydrated, setIsHydrated] = useState(false);
  const [savedBadge, setSavedBadge] = useState(false);
  const playerRef = useRef<AudioPlayerHandle>(null);

  const tx = useTranscription();

  // ---------------------------------------------------------------------------
  // Local Storage Hydration on Client Mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    try {
      const savedMode = loadSavedMode('tts');
      const savedScript = loadSavedScriptDraft('');
      const savedTts = loadSavedTtsSettings(DEFAULT_TTS_SETTINGS);
      const savedTranscribe = loadSavedTranscribeSettings(DEFAULT_TRANSCRIBE_SETTINGS);
      const savedActive = loadSavedActiveState();

      setMode(savedMode);
      setScript(savedScript);
      setTtsSettings(savedTts);
      setTranscribeSettings(savedTranscribe);

      if (savedActive && savedActive.segments && savedActive.segments.length > 0) {
        setSegments(savedActive.segments);
        if (savedActive.result) {
          setPersistedResult(savedActive.result);
          if (savedActive.result.job_id) {
            setPersistedJobId(savedActive.result.job_id);
          }
        }
        if (savedActive.mode) {
          setMode(savedActive.mode);
        }
      }
    } catch (e) {
      console.warn('[AutoTranscribe] Storage hydration warning:', e);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  // Flash autosave indicator on changes
  const triggerSaveIndicator = useCallback(() => {
    setSavedBadge(true);
    const t = setTimeout(() => setSavedBadge(false), 1800);
    return () => clearTimeout(t);
  }, []);

  const handleModeChange = (newMode: AppMode) => {
    if (newMode === mode) return;
    setMode(newMode);
    saveMode(newMode);
    tx.reset();
  };

  const handleScriptChange = (val: string) => {
    setScript(val);
    saveScriptDraft(val);
  };

  const handleTtsSettingsChange = (partial: Partial<TtsSettings>) => {
    setTtsSettings((prev) => {
      const updated = { ...prev, ...partial };
      saveTtsSettings(updated);
      return updated;
    });
  };

  const handleTranscribeSettingsChange = (partial: Partial<TranscribeSettings>) => {
    setTranscribeSettings((prev) => {
      const updated = { ...prev, ...partial };
      saveTranscribeSettings(updated);
      return updated;
    });
  };

  const handleFileSelected = useCallback((f: File, dur: number) => {
    setFile(f);
    setDuration(dur);
    tx.reset();
    setSegments([]);
    setPersistedResult(null);
    setPersistedJobId(null);
    saveActiveState(null);
  }, [tx]);

  const handleClear = useCallback(() => {
    setFile(null);
    setDuration(0);
    tx.reset();
    setSegments([]);
    setPersistedResult(null);
    setPersistedJobId(null);
    saveActiveState(null);
  }, [tx]);

  const handleClearTranscript = useCallback(() => {
    if (segments.length > 0 && !window.confirm('Are you sure you want to clear the active transcript?')) {
      return;
    }
    setSegments([]);
    setPersistedResult(null);
    setPersistedJobId(null);
    tx.reset();
    saveActiveState(null);
  }, [segments.length, tx]);

  const handleTranscribe = useCallback(async () => {
    if (!file) return;
    setSegments([]);
    setPersistedResult(null);
    setPersistedJobId(null);
    await tx.startTranscription(file, transcribeSettings);
  }, [file, transcribeSettings, tx]);

  const handleGenerateTts = useCallback(async () => {
    if (!script.trim()) return;
    setSegments([]);
    setPersistedResult(null);
    setPersistedJobId(null);
    await tx.startTTS(script, ttsSettings);
  }, [script, ttsSettings, tx]);

  // When transcription/TTS completes, populate and persist
  const prevResultRef = useRef(tx.result);
  useEffect(() => {
    if (tx.result && tx.result !== prevResultRef.current) {
      prevResultRef.current = tx.result;
      setSegments(tx.result.segments);
      setPersistedResult(tx.result);
      if (tx.result.job_id) {
        setPersistedJobId(tx.result.job_id);
      }

      saveActiveState({
        result: tx.result,
        segments: tx.result.segments,
        mode,
        timestamp: Date.now(),
      });

      saveHistoryItem({
        id: tx.result.job_id || `job_${Date.now()}`,
        timestamp: Date.now(),
        title: mode === 'tts' ? (script.slice(0, 45) || 'TTS Speech') : (file?.name || 'Audio Transcription'),
        mode,
        duration: tx.result.duration,
        language: tx.result.language,
        segmentsCount: tx.result.segments.length,
        jobId: tx.result.job_id,
        hasWav: tx.result.has_wav || mode === 'tts',
      });

      triggerSaveIndicator();
    }
  }, [tx.result, mode, script, file, triggerSaveIndicator]);

  // Segment edits persistence
  const handleSegmentsChange = useCallback((newSegs: Segment[]) => {
    setSegments(newSegs);
    const activeRes = tx.result || persistedResult;
    saveActiveState({
      result: activeRes ? { ...activeRes, segments: newSegs } : null,
      segments: newSegs,
      mode,
      timestamp: Date.now(),
    });
    triggerSaveIndicator();
  }, [tx.result, persistedResult, mode, triggerSaveIndicator]);

  const handleSeek = useCallback((time: number) => {
    playerRef.current?.seekTo(time);
  }, []);

  const isProcessing = tx.status === 'uploading' || tx.status === 'processing';
  const canRun =
    mode === 'transcribe'
      ? !!file && !isProcessing
      : !!script.trim() && !isProcessing;

  const showProgress = tx.status !== 'idle';
  const isComplete = tx.status === 'complete';
  const showEditor = segments.length > 0;

  // Persistent audio source for player
  const activeJobId = tx.result?.job_id || persistedJobId;
  const playerFile = mode === 'transcribe' ? file : null;
  const playerSrc =
    mode === 'tts' && activeJobId
      ? getWavDownloadUrl(activeJobId)
      : null;
  const showPlayer = (isComplete || segments.length > 0) && (!!playerFile || !!playerSrc);
  const activeResultObj = tx.result || persistedResult;

  return (
    <div className="app-layout">
      {/* Header */}
      <header className="app-header">
        <div className="header-inner">
          <div className="header-brand">
            <div className="brand-icon">
              {mode === 'tts' ? <Sparkles size={20} /> : <Mic2 size={20} />}
            </div>
            <span className="brand-name">AutoTranscribe</span>
            <span className="brand-tag">Chatterbox TTS + WhisperX</span>
          </div>

          {/* Mode Switcher */}
          <div className="mode-tabs">
            <button
              id="mode-tab-tts"
              type="button"
              className={`mode-tab ${mode === 'tts' ? 'active' : ''}`}
              onClick={() => handleModeChange('tts')}
              disabled={isProcessing}
            >
              <Sparkles size={15} />
              Script → TTS
            </button>
            <button
              id="mode-tab-transcribe"
              type="button"
              className={`mode-tab ${mode === 'transcribe' ? 'active' : ''}`}
              onClick={() => handleModeChange('transcribe')}
              disabled={isProcessing}
            >
              <Mic2 size={15} />
              Audio → Transcribe
            </button>
          </div>

          <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {isHydrated && (
              <div
                className="storage-indicator"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '0.75rem',
                  color: savedBadge ? 'var(--success)' : 'var(--text-3)',
                  transition: 'color 0.25s ease',
                  userSelect: 'none',
                }}
                title="Your script, settings, and active transcripts are automatically persisted in local storage."
              >
                <HardDrive size={13} />
                <span>{savedBadge ? 'Persisted' : 'Local Storage Active'}</span>
              </div>
            )}

            <a
              href="https://github.com/resemble-ai/chatterbox"
              target="_blank"
              rel="noopener noreferrer"
              className="header-link"
              aria-label="Chatterbox TTS repository"
              title="Chatterbox TTS GitHub"
            >
              <ExternalLink size={18} />
            </a>
          </div>
        </div>
      </header>

      <main className="app-main">
        {/* Left column: Controls + Settings + Progress */}
        <aside className="app-sidebar">
          {mode === 'transcribe' ? (
            <>
              <section className="sidebar-section">
                <h2 className="section-title">Audio File</h2>
                <AudioUploader
                  onFileSelected={handleFileSelected}
                  onClear={handleClear}
                  disabled={isProcessing}
                  selectedFile={file}
                  duration={duration}
                />
              </section>

              <section className="sidebar-section">
                <h2 className="section-title">WhisperX Settings</h2>
                <SettingsPanel
                  settings={transcribeSettings}
                  onChange={handleTranscribeSettingsChange}
                  disabled={isProcessing}
                />
              </section>

              <button
                id="transcribe-btn"
                className={`transcribe-btn ${isProcessing ? 'loading' : ''}`}
                onClick={handleTranscribe}
                disabled={!canRun}
              >
                {isProcessing ? (
                  <>
                    <RefreshCw size={18} className="spin" />
                    Transcribing…
                  </>
                ) : (
                  <>
                    <Mic2 size={18} />
                    Transcribe Audio
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <section className="sidebar-section">
                <h2 className="section-title">Chatterbox TTS Script</h2>
                <TtsPanel
                  script={script}
                  onScriptChange={handleScriptChange}
                  settings={ttsSettings}
                  onSettingsChange={handleTtsSettingsChange}
                  disabled={isProcessing}
                />
              </section>

              <button
                id="tts-generate-btn"
                className={`transcribe-btn ${isProcessing ? 'loading' : ''}`}
                onClick={handleGenerateTts}
                disabled={!canRun}
              >
                {isProcessing ? (
                  <>
                    <RefreshCw size={18} className="spin" />
                    Synthesizing & Aligning…
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    Synthesize & Align Timestamps
                  </>
                )}
              </button>
            </>
          )}

          {showProgress && (
            <section className="sidebar-section">
              <ProgressPanel
                stage={tx.stage}
                pct={tx.pct}
                stageLabel={tx.stageLabel}
                error={tx.error}
                stageIndex={tx.stageIndex}
                mode={mode}
              />
            </section>
          )}
        </aside>

        {/* Right column: Audio Player + Interactive Transcript Editor */}
        <div className="app-content">
          {showPlayer && (
            <section className="content-section">
              <AudioPlayer
                ref={playerRef}
                file={playerFile}
                src={playerSrc}
                onTimeUpdate={setCurrentTime}
              />
            </section>
          )}

          {showEditor && (
            <>
              <section className="content-section editor-header-section" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <h2 className="section-title" style={{ margin: 0 }}>
                    {mode === 'tts' ? 'Aligned Script & Timestamps' : 'Transcript'}
                  </h2>
                  <button
                    onClick={handleClearTranscript}
                    className="btn-clear-transcript"
                    title="Clear active transcript and start new"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 8px',
                      fontSize: '0.75rem',
                      color: 'var(--text-3)',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <RotateCcw size={12} />
                    <span>Clear / New</span>
                  </button>
                </div>

                <ExportPanel
                  segments={segments}
                  language={activeResultObj?.language}
                  duration={activeResultObj?.duration}
                  filename={
                    mode === 'transcribe'
                      ? file?.name
                      : ttsSettings.mode === 'blend'
                      ? `chatterbox_blend_${ttsSettings.voiceBlend.map((b) => b.voice).join('_')}`
                      : `chatterbox_${ttsSettings.voice}`
                  }
                  jobId={activeJobId ?? undefined}
                  hasWav={activeResultObj?.has_wav || mode === 'tts'}
                />
              </section>

              <section className="content-section content-section--grow">
                <TranscriptEditor
                  segments={segments}
                  onChange={handleSegmentsChange}
                  currentTime={currentTime}
                  onSeek={handleSeek}
                />
              </section>
            </>
          )}

          {!showEditor && !isProcessing && (
            <div className="empty-state">
              <div className="empty-icon">
                {mode === 'tts' ? <Sparkles size={46} /> : <FileAudio size={46} />}
              </div>
              <h2 className="empty-title">
                {mode === 'tts'
                  ? 'Generate Speech & Word Timestamps'
                  : 'Ready to transcribe audio'}
              </h2>
              <p className="empty-sub">
                {mode === 'tts' ? (
                  <>
                    Enter a script on the left, pick a <strong>Chatterbox voice</strong>, and click{' '}
                    <strong>Synthesize & Align Timestamps</strong>. You'll get a downloadable 24kHz WAV audio file and precise word-level timestamps (SRT, VTT, JSON, TXT).
                  </>
                ) : (
                  <>
                    Upload an audio file on the left and click <strong>Transcribe Audio</strong> to get started with WhisperX alignment.
                  </>
                )}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
