'use client';

import { useState, useRef } from 'react';
import { Segment } from '@/lib/types';
import {
  toTxt, toSrt, toVtt, toJson, downloadFile,
} from '@/lib/formatters';
import { Copy, Download, ChevronDown, Check } from 'lucide-react';

interface ExportPanelProps {
  segments: Segment[];
  language?: string;
  duration?: number;
  filename?: string;
}

export function ExportPanel({ segments, language, duration, filename = 'transcript' }: ExportPanelProps) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const base = filename.replace(/\.[^.]+$/, '');

  const copyToClipboard = async () => {
    const txt = toTxt(segments);
    await navigator.clipboard.writeText(txt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
