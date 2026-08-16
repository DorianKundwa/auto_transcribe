'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Segment } from '@/lib/types';
import { formatTimestamp, parseTimestamp } from '@/lib/formatters';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import {
  Undo2, Redo2, Plus, Trash2, Merge, Scissors,
  Check, X, Edit3,
} from 'lucide-react';

interface TranscriptEditorProps {
  segments: Segment[];
  onChange: (segments: Segment[]) => void;
  currentTime: number;
  onSeek: (time: number) => void;
}

export function TranscriptEditor({
  segments,
  onChange,
  currentTime,
  onSeek,
}: TranscriptEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editTs, setEditTs] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const undoRedo = useUndoRedo();
  const activeRef = useRef<HTMLDivElement | null>(null);

  // Initialise undo history on first load
  const initialised = useRef(false);
  useEffect(() => {
    if (!initialised.current && segments.length > 0) {
      undoRedo.push(segments);
      initialised.current = true;
    }
  }, [segments, undoRedo]);

  // Track active segment from playback
  useEffect(() => {
    if (segments.length === 0) return;
    // Binary search for the active segment
    let lo = 0, hi = segments.length - 1, found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (segments[mid].start <= currentTime) {
        found = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    if (found >= 0) {
      const seg = segments[found];
      if (currentTime <= seg.end + 1) {
        setActiveId(seg.id);
      }
    }
  }, [currentTime, segments]);

  // Scroll active line into view
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeId]);

  const commit = useCallback((newSegs: Segment[]) => {
    undoRedo.push(newSegs);
    onChange(newSegs);
  }, [undoRedo, onChange]);

  const handleUndo = () => {
    const prev = undoRedo.undo();
    if (prev) onChange(prev);
  };
  const handleRedo = () => {
    const next = undoRedo.redo();
    if (next) onChange(next);
  };

  // Start editing a segment
  const startEdit = (seg: Segment) => {
    setEditingId(seg.id);
    setEditText(seg.text);
    setEditTs(formatTimestamp(seg.start).replace(/[\[\]]/g, ''));
  };

  const saveEdit = (seg: Segment) => {
    const newStart = parseTimestamp(`[${editTs}]`);
    const newSegs = segments.map((s) =>
      s.id === seg.id
        ? { ...s, text: editText, start: newStart }
        : s,
    );
    commit(newSegs);
    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);

  const deleteSeg = (id: string) => {
    commit(segments.filter((s) => s.id !== id));
  };

  const addAfter = (id: string) => {
    const idx = segments.findIndex((s) => s.id === id);
    const ref = segments[idx];
    const newSeg: Segment = {
      id: `seg-new-${Date.now()}`,
      start: ref ? ref.end + 0.1 : 0,
      end: ref ? ref.end + 2 : 2,
      text: '',
      words: [],
    };
    const newSegs = [...segments];
    newSegs.splice(idx + 1, 0, newSeg);
    commit(newSegs);
    // Immediately open edit mode for new segment
    setTimeout(() => {
      setEditingId(newSeg.id);
      setEditText('');
      setEditTs(formatTimestamp(newSeg.start).replace(/[\[\]]/g, ''));
    }, 10);
  };

  const mergeWithPrev = (id: string) => {
    const idx = segments.findIndex((s) => s.id === id);
    if (idx === 0) return;
    const prev = segments[idx - 1];
    const curr = segments[idx];
    const merged: Segment = {
      ...prev,
      end: curr.end,
      text: `${prev.text.trim()} ${curr.text.trim()}`.trim(),
      words: [...prev.words, ...curr.words],
    };
    const newSegs = [...segments];
    newSegs.splice(idx - 1, 2, merged);
    commit(newSegs);
  };

  const splitAtCursor = (seg: Segment, textareEl: HTMLTextAreaElement) => {
    const pos = textareEl.selectionStart;
    const before = seg.text.slice(0, pos).trim();
    const after = seg.text.slice(pos).trim();
    if (!before || !after) return;

    // Estimate split time from word timestamps
    const wordCount = before.split(/\s+/).length;
    const totalWords = seg.words.length;
    let splitTime = seg.start;
    if (totalWords > 0 && wordCount > 0) {
      const splitIdx = Math.min(wordCount - 1, totalWords - 1);
      splitTime = seg.words[splitIdx]?.end ?? seg.start;
    } else {
      const ratio = wordCount / (seg.text.split(/\s+/).length || 1);
      splitTime = seg.start + (seg.end - seg.start) * ratio;
    }

    const segA: Segment = { ...seg, text: before, end: splitTime, words: seg.words.slice(0, wordCount) };
    const segB: Segment = {
      ...seg,
      id: `seg-split-${Date.now()}`,
      start: splitTime,
      text: after,
      words: seg.words.slice(wordCount),
    };
    const newSegs = segments.map((s) => (s.id === seg.id ? segA : s));
    const idx = newSegs.findIndex((s) => s.id === seg.id);
    newSegs.splice(idx + 1, 0, segB);
    commit(newSegs);
    setEditingId(null);
  };

  const splitRef = useRef<HTMLTextAreaElement | null>(null);

  return (
    <div className="transcript-editor">
      {/* Toolbar */}
      <div className="transcript-toolbar">
        <div className="toolbar-group">
          <button
            className="toolbar-btn"
            onClick={handleUndo}
            disabled={!undoRedo.canUndo}
            title="Undo"
          >
            <Undo2 size={15} />
            <span>Undo</span>
          </button>
          <button
            className="toolbar-btn"
            onClick={handleRedo}
            disabled={!undoRedo.canRedo}
            title="Redo"
          >
            <Redo2 size={15} />
            <span>Redo</span>
          </button>
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-group">
          <button
            className="toolbar-btn"
            onClick={() => addAfter(segments[segments.length - 1]?.id ?? '')}
            title="Add line at end"
          >
            <Plus size={15} />
            <span>Add line</span>
          </button>
        </div>

        <div className="transcript-count">
          {segments.length} segment{segments.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Lines */}
      <div className="transcript-lines" role="list">
        {segments.length === 0 && (
          <div className="transcript-empty">
            No transcript yet. Upload an audio file and click Transcribe.
          </div>
        )}

        {segments.map((seg, idx) => {
          const isActive = seg.id === activeId;
          const isEditing = seg.id === editingId;

          return (
            <div
              key={seg.id}
              ref={isActive ? (el) => { activeRef.current = el; } : undefined}
              className={`transcript-line ${isActive ? 'active' : ''} ${isEditing ? 'editing' : ''}`}
              role="listitem"
            >
              {isEditing ? (
                <div className="edit-mode">
                  <input
                    className="edit-ts-input"
                    value={editTs}
                    onChange={(e) => setEditTs(e.target.value)}
                    placeholder="0:00"
                    aria-label="Timestamp"
                  />
                  <textarea
                    ref={splitRef}
                    className="edit-text-input"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={2}
                    autoFocus
                    aria-label="Transcript text"
                  />
                  <div className="edit-actions">
                    <button
                      className="edit-action-btn split"
                      onClick={() => splitRef.current && splitAtCursor(seg, splitRef.current)}
                      title="Split at cursor"
                    >
                      <Scissors size={13} /> Split here
                    </button>
                    {idx > 0 && (
                      <button
                        className="edit-action-btn merge"
                        onClick={() => mergeWithPrev(seg.id)}
                        title="Merge with line above"
                      >
                        <Merge size={13} /> Merge up
                      </button>
                    )}
                    <button className="edit-action-btn delete" onClick={() => deleteSeg(seg.id)} title="Delete line">
                      <Trash2 size={13} /> Delete
                    </button>
                    <button className="edit-action-btn add" onClick={() => addAfter(seg.id)} title="Add line below">
                      <Plus size={13} /> Add below
                    </button>
                    <div className="edit-confirm-btns">
                      <button className="edit-confirm save" onClick={() => saveEdit(seg)} title="Save">
                        <Check size={14} />
                      </button>
                      <button className="edit-confirm cancel" onClick={cancelEdit} title="Cancel">
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="view-mode" onClick={() => { onSeek(seg.start); }}>
                  <button
                    className="segment-ts"
                    onClick={(e) => { e.stopPropagation(); onSeek(seg.start); }}
                    aria-label={`Seek to ${formatTimestamp(seg.start)}`}
                  >
                    {formatTimestamp(seg.start)}
                  </button>
                  <span className="segment-text">{seg.text}</span>
                  <button
                    className="segment-edit-btn"
                    onClick={(e) => { e.stopPropagation(); startEdit(seg); }}
                    aria-label="Edit line"
                  >
                    <Edit3 size={13} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
