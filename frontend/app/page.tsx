'use client';

import { useState, useCallback, useRef } from 'react';
import { AudioUploader } from '@/components/AudioUploader';
import { SettingsPanel } from '@/components/SettingsPanel';
import { ProgressPanel } from '@/components/ProgressPanel';
import { AudioPlayer, AudioPlayerHandle } from '@/components/AudioPlayer';
import { TranscriptEditor } from '@/components/TranscriptEditor';
import { ExportPanel } from '@/components/ExportPanel';
import { useTranscription } from '@/hooks/useTranscription';
import { Segment, TranscribeSettings } from '@/lib/types';
import { Mic2, RefreshCw, ExternalLink } from 'lucide-react';

const DEFAULT_SETTINGS: TranscribeSettings = {
  model: 'base',
  language: 'auto',
  device: 'auto',
  pauseThreshold: 0.75,
};

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);
  const [settings, setSettings] = useState<TranscribeSettings>(DEFAULT_SETTINGS);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const playerRef = useRef<AudioPlayerHandle>(null);

  const tx = useTranscription();

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
    await tx.startTranscription(file, settings);
  }, [file, settings, tx]);

  // When transcription completes, populate the editor
  const prevResultRef = useRef(tx.result);
  if (tx.result && tx.result !== prevResultRef.current) {
    prevResultRef.current = tx.result;
    setSegments(tx.result.segments);
  }

  const handleSeek = useCallback((time: number) => {
    playerRef.current?.seekTo(time);
  }, []);

  const isProcessing = tx.status === 'uploading' || tx.status === 'processing';
  const canTranscribe = !!file && !isProcessing;
  const showProgress = tx.status !== 'idle';
  const showPlayer = !!file && tx.status === 'complete';
  const showEditor = segments.length > 0;

  return (
    <div className="app-layout">
      {/* Header */}
      <header className="app-header">
        <div className="header-inner">
          <div className="header-brand">
            <div className="brand-icon">
              <Mic2 size={20} />
            </div>
            <span className="brand-name">AutoTranscribe</span>
            <span className="brand-tag">WhisperX</span>
          </div>
          <div className="header-actions">
            <a
              href="https://github.com/DorianKundwa/auto_transcribe"
              target="_blank"
              rel="noopener noreferrer"
              className="header-link"
              aria-label="GitHub repository"
            >
              <ExternalLink size={18} />
            </a>
          </div>
        </div>
      </header>

      <main className="app-main">
        {/* Left column: upload + settings + progress */}
        <aside className="app-sidebar">
          <section className="sidebar-section">
            <h2 className="section-title">Audio</h2>
            <AudioUploader
              onFileSelected={handleFileSelected}
              onClear={handleClear}
              disabled={isProcessing}
              selectedFile={file}
              duration={duration}
            />
          </section>

          <section className="sidebar-section">
            <h2 className="section-title">Settings</h2>
            <SettingsPanel
              settings={settings}
              onChange={(partial) => setSettings((s) => ({ ...s, ...partial }))}
              disabled={isProcessing}
            />
          </section>

          <button
            id="transcribe-btn"
            className={`transcribe-btn ${isProcessing ? 'loading' : ''}`}
            onClick={handleTranscribe}
            disabled={!canTranscribe}
          >
            {isProcessing ? (
              <>
                <RefreshCw size={18} className="spin" />
                Processing…
              </>
            ) : (
              <>
                <Mic2 size={18} />
                Transcribe
              </>
            )}
          </button>

          {showProgress && (
            <section className="sidebar-section">
              <ProgressPanel
                stage={tx.stage}
                pct={tx.pct}
                stageLabel={tx.stageLabel}
                error={tx.error}
                stageIndex={tx.stageIndex}
              />
            </section>
          )}
        </aside>

        {/* Right column: player + editor */}
        <div className="app-content">
          {showPlayer && (
            <section className="content-section">
              <AudioPlayer
                ref={playerRef}
                file={file!}
                onTimeUpdate={setCurrentTime}
              />
            </section>
          )}

          {showEditor && (
            <>
              <section className="content-section editor-header-section">
                <h2 className="section-title">Transcript</h2>
                <ExportPanel
                  segments={segments}
                  language={tx.result?.language}
                  duration={tx.result?.duration}
                  filename={file?.name}
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
                <Mic2 size={40} />
              </div>
              <h2 className="empty-title">Ready to transcribe</h2>
              <p className="empty-sub">
                Upload an audio file on the left and click <strong>Transcribe</strong> to get started.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
