'use client';

import { useState, useRef } from 'react';
import { Segment } from '@/lib/types';
import {
  toTxt, toSrt, toVtt, toJson, downloadFile,
} from '@/lib/formatters';
import { downloadWavFile, downloadMp3File } from '@/lib/api';
import { Copy, Download, ChevronDown, Check, Music } from 'lucide-react';

interface ExportPanelProps {
  segments: Segment[];
  language?: string;
  duration?: number;
  filename?: string;
  jobId?: string;
  hasWav?: boolean;
}

export function ExportPanel({
  segments,
  language,
  duration,
  filename = 'transcript',
  jobId,
  hasWav = false,
}: ExportPanelProps) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const [downloadingWav, setDownloadingWav] = useState(false);
  const [downloadingMp3, setDownloadingMp3] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const base = filename.replace(/\.[^.]+$/, '');

  const copyToClipboard = async () => {
    const txt = toTxt(segments);
    await navigator.clipboard.writeText(txt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadWav = async () => {
    if (!jobId) return;
    try {
      setDownloadingWav(true);
      await downloadWavFile(jobId, `${base || 'speech'}.wav`);
    } catch (err) {
      console.error('Failed to download WAV', err);
    } finally {
      setDownloadingWav(false);
    }
  };

  const handleDownloadMp3 = async () => {
    if (!jobId) return;
    try {
      setDownloadingMp3(true);
      await downloadMp3File(jobId, `${base || 'speech'}.mp3`);
    } catch (err) {
      console.error('Failed to download MP3', err);
    } finally {
      setDownloadingMp3(false);
    }
  };

  const exports = [
    {
      label: 'Download TXT',
      ext: 'txt',
      action: () => downloadFile(toTxt(segments), `${base}.txt`, 'text/plain'),
    },
    {
      label: 'Download SRT',
      ext: 'srt',
      action: () => downloadFile(toSrt(segments), `${base}.srt`, 'text/plain'),
    },
    {
      label: 'Download VTT',
      ext: 'vtt',
      action: () => downloadFile(toVtt(segments), `${base}.vtt`, 'text/vtt'),
    },
    {
      label: 'Download JSON',
      ext: 'json',
      action: () =>
        downloadFile(
          toJson(segments, language, duration),
          `${base}.json`,
          'application/json',
        ),
    },
  ];

  return (
    <div className="export-panel" ref={panelRef}>
      {hasWav && jobId && (
        <button
          id="download-mp3-btn"
          className="export-btn export-btn--wav"
          onClick={handleDownloadMp3}
          disabled={downloadingMp3}
          title="Download generated MP3 audio"
        >
          <Music size={15} />
          {downloadingMp3 ? 'Downloading…' : 'Download MP3'}
        </button>
      )}

      <button
        id="copy-transcript-btn"
        className="export-btn export-btn--copy"
        onClick={copyToClipboard}
        disabled={segments.length === 0}
      >
        {copied ? <Check size={15} /> : <Copy size={15} />}
        {copied ? 'Copied!' : 'Copy'}
      </button>

      <div className="export-dropdown">
        <button
          id="export-dropdown-btn"
          className="export-btn export-btn--download"
          onClick={() => setOpen((o) => !o)}
          disabled={segments.length === 0}
        >
          <Download size={15} />
          Export
          <ChevronDown size={13} className={`dropdown-chevron ${open ? 'open' : ''}`} />
        </button>

        {open && (
          <div className="export-menu" role="menu">
            {hasWav && jobId && (
              <>
                <button
                  key="mp3"
                  id="export-mp3-menu-btn"
                  className="export-menu-item"
                  role="menuitem"
                  onClick={() => {
                    handleDownloadMp3();
                    setOpen(false);
                  }}
                >
                  Download Audio
                  <span className="export-ext">.mp3</span>
                </button>
                <button
                  key="wav"
                  id="export-wav-menu-btn"
                  className="export-menu-item"
                  role="menuitem"
                  onClick={() => {
                    handleDownloadWav();
                    setOpen(false);
                  }}
                >
                  Download Audio
                  <span className="export-ext">.wav</span>
                </button>
              </>
            )}

            {exports.map((ex) => (
              <button
                key={ex.ext}
                id={`export-${ex.ext}-btn`}
                className="export-menu-item"
                role="menuitem"
                onClick={() => {
                  ex.action();
                  setOpen(false);
                }}
              >
                {ex.label}
                <span className="export-ext">.{ex.ext}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
