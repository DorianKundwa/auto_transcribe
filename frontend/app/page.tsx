'use client';

import { useState, useCallback, useRef } from 'react';
import { AudioUploader } from '@/components/AudioUploader';
import { SettingsPanel } from '@/components/SettingsPanel';
import { TtsPanel } from '@/components/TtsPanel';
import { ProgressPanel } from '@/components/ProgressPanel';
import { AudioPlayer, AudioPlayerHandle } from '@/components/AudioPlayer';
import { TranscriptEditor } from '@/components/TranscriptEditor';
import { ExportPanel } from '@/components/ExportPanel';
import { useTranscription } from '@/hooks/useTranscription';
import { Segment, TranscribeSettings, TtsSettings, AppMode } from '@/lib/types';
import { getWavDownloadUrl } from '@/lib/api';
import { Mic2, Sparkles, RefreshCw, ExternalLink, Volume2, FileAudio } from 'lucide-react';

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
  const [mode, setMode] = useState<AppMode>('tts'); // Default to TTS or Transcribe
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [script, setScript] = useState('');
  const [transcribeSettings, setTranscribeSettings] = useState<TranscribeSettings>(DEFAULT_TRANSCRIBE_SETTINGS);
  const [ttsSettings, setTtsSettings] = useState<TtsSettings>(DEFAULT_TTS_SETTINGS);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const playerRef = useRef<AudioPlayerHandle>(null);

  const tx = useTranscription();

  const handleModeChange = (newMode: AppMode) => {
    if (newMode === mode) return;
    setMode(newMode);
    tx.reset();
    setSegments([]);
  };

  const handleFileSelected = useCallback((f: File, dur: number) => {
    setFile(f);
    setDuration(dur);
    tx.reset();
    setSegments([]);
  }, [tx]);

  const handleClear = useCallback(() => {
    setFile(null);
    setDuration(0);
    tx.reset();
    setSegments([]);
  }, [tx]);

  const handleTranscribe = useCallback(async () => {
    if (!file) return;
    setSegments([]);
    await tx.startTranscription(file, transcribeSettings);
  }, [file, transcribeSettings, tx]);

  const handleGenerateTts = useCallback(async () => {
    if (!script.trim()) return;
    setSegments([]);
    await tx.startTTS(script, ttsSettings);
  }, [script, ttsSettings, tx]);

  // When transcription/TTS completes, populate the editor
  const prevResultRef = useRef(tx.result);
  if (tx.result && tx.result !== prevResultRef.current) {
    prevResultRef.current = tx.result;
    setSegments(tx.result.segments);
  }

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

  // Determine audio source for player
  const playerFile = mode === 'transcribe' ? file : null;
  const playerSrc =
    mode === 'tts' && tx.result?.job_id
      ? getWavDownloadUrl(tx.result.job_id)
      : null;
  const showPlayer = isComplete && (!!playerFile || !!playerSrc);

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

          <div className="header-actions">
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
                  onChange={(partial) => setTranscribeSettings((s) => ({ ...s, ...partial }))}
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
                  onScriptChange={setScript}
                  settings={ttsSettings}
                  onSettingsChange={(partial) => setTtsSettings((s) => ({ ...s, ...partial }))}
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
              <section className="content-section editor-header-section">
                <h2 className="section-title">
                  {mode === 'tts' ? 'Aligned Script & Timestamps' : 'Transcript'}
                </h2>
                <ExportPanel
                  segments={segments}
                  language={tx.result?.language}
                  duration={tx.result?.duration}
                  filename={
                    mode === 'transcribe'
                      ? file?.name
                      : ttsSettings.mode === 'blend'
                      ? `chatterbox_blend_${ttsSettings.voiceBlend.map((b) => b.voice).join('_')}`
                      : `chatterbox_${ttsSettings.voice}`
                  }
                  jobId={tx.result?.job_id}
                  hasWav={tx.result?.has_wav || mode === 'tts'}
                />
              </section>

              <section className="content-section content-section--grow">
                <TranscriptEditor
                  segments={segments}
                  onChange={setSegments}
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
