'use client';

import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import { Segment } from '@/lib/types';
import { formatTimestamp, parseTimestamp } from '@/lib/formatters';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import {
  Undo2, Redo2, Plus, Trash2, Merge, Scissors,
  Check, X, Edit3,
} from 'lucide-react';

interface TranscriptLineProps {
  seg: Segment;
  idx: number;
  isActive: boolean;
  isEditing: boolean;
  onSeek: (time: number) => void;
  onStartEdit: (seg: Segment) => void;
  onSaveEdit: (segId: string, newText: string, newStartTs: string) => void;
  onCancelEdit: () => void;
  onDeleteSeg: (id: string) => void;
  onAddAfter: (id: string) => void;
  onMergeWithPrev: (id: string) => void;
  onSplit: (seg: Segment, before: string, after: string) => void;
}

const TranscriptLine = memo(function TranscriptLine({
  seg,
  idx,
  isActive,
  isEditing,
  onSeek,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDeleteSeg,
  onAddAfter,
  onMergeWithPrev,
  onSplit,
}: TranscriptLineProps) {
  const [editText, setEditText] = useState(seg.text);
  const [editTs, setEditTs] = useState(formatTimestamp(seg.start).replace(/[\[\]]/g, ''));
  const splitRef = useRef<HTMLTextAreaElement | null>(null);
  const activeRef = useRef<HTMLDivElement | null>(null);

  // Sync state when entering edit mode
  useEffect(() => {
    if (isEditing) {
      setEditText(seg.text);
      setEditTs(formatTimestamp(seg.start).replace(/[\[\]]/g, ''));
    }
  }, [isEditing, seg]);

  // Scroll into view when active
  useEffect(() => {
    if (isActive) {
      activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isActive]);

  const handleSplit = () => {
    if (!splitRef.current) return;
    const pos = splitRef.current.selectionStart;
    const before = editText.slice(0, pos).trim();
    const after = editText.slice(pos).trim();
    if (!before || !after) return;
    onSplit(seg, before, after);
  };

  return (
    <div
      ref={activeRef}
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
              onClick={handleSplit}
              title="Split at cursor"
            >
              <Scissors size={13} /> Split here
            </button>
            {idx > 0 && (
              <button
                className="edit-action-btn merge"
                onClick={() => onMergeWithPrev(seg.id)}
                title="Merge with line above"
              >
                <Merge size={13} /> Merge up
              </button>
            )}
            <button className="edit-action-btn delete" onClick={() => onDeleteSeg(seg.id)} title="Delete line">
              <Trash2 size={13} /> Delete
            </button>
            <button className="edit-action-btn add" onClick={() => onAddAfter(seg.id)} title="Add line below">
              <Plus size={13} /> Add below
            </button>
            <div className="edit-confirm-btns">
              <button className="edit-confirm save" onClick={() => onSaveEdit(seg.id, editText, editTs)} title="Save">
                <Check size={14} />
              </button>
              <button className="edit-confirm cancel" onClick={onCancelEdit} title="Cancel">
                <X size={14} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="view-mode" onClick={() => onSeek(seg.start)}>
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
            onClick={(e) => { e.stopPropagation(); onStartEdit(seg); }}
            aria-label="Edit line"
          >
            <Edit3 size={13} />
          </button>
        </div>
      )}
    </div>
  );
});

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
  const [activeId, setActiveId] = useState<string | null>(null);
  const undoRedo = useUndoRedo();

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

  const commit = useCallback((newSegs: Segment[]) => {
    undoRedo.push(newSegs);
    onChange(newSegs);
  }, [undoRedo, onChange]);

  const handleUndo = useCallback(() => {
    const prev = undoRedo.undo();
    if (prev) onChange(prev);
  }, [undoRedo, onChange]);

  const handleRedo = useCallback(() => {
    const next = undoRedo.redo();
    if (next) onChange(next);
  }, [undoRedo, onChange]);

  const handleStartEdit = useCallback((seg: Segment) => {
    setEditingId(seg.id);
  }, []);

  const handleSaveEdit = useCallback((segId: string, newText: string, newStartTs: string) => {
    const newStart = parseTimestamp(`[${newStartTs}]`);
    const newSegs = segments.map((s) =>
      s.id === segId
        ? { ...s, text: newText, start: newStart }
        : s
    );
    commit(newSegs);
    setEditingId(null);
  }, [segments, commit]);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  const handleDeleteSeg = useCallback((id: string) => {
    commit(segments.filter((s) => s.id !== id));
  }, [segments, commit]);

  const handleAddAfter = useCallback((id: string) => {
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
    setTimeout(() => {
      setEditingId(newSeg.id);
    }, 10);
  }, [segments, commit]);

  const handleMergeWithPrev = useCallback((id: string) => {
    const idx = segments.findIndex((s) => s.id === id);
    if (idx <= 0) return;
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
  }, [segments, commit]);

  const handleSplit = useCallback((seg: Segment, before: string, after: string) => {
    const wordCount = before.split(/\s+/).length;
    const totalWords = seg.words.length;
    let splitTime = seg.start;
    
    if (totalWords > 0 && wordCount > 0) {
      const splitIdx = Math.min(wordCount - 1, totalWords - 1);
      splitTime = seg.words[splitIdx]?.end ?? seg.start;
    } else {
      const ratio = wordCount / ((before + ' ' + after).split(/\s+/).length || 1);
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
  }, [segments, commit]);

  const handleSeek = useCallback((time: number) => {
    onSeek(time);
  }, [onSeek]);

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
            onClick={() => handleAddAfter(segments[segments.length - 1]?.id ?? '')}
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

        {segments.map((seg, idx) => (
          <TranscriptLine
            key={seg.id}
            seg={seg}
            idx={idx}
            isActive={seg.id === activeId}
            isEditing={seg.id === editingId}
            onSeek={handleSeek}
            onStartEdit={handleStartEdit}
            onSaveEdit={handleSaveEdit}
            onCancelEdit={handleCancelEdit}
            onDeleteSeg={handleDeleteSeg}
            onAddAfter={handleAddAfter}
            onMergeWithPrev={handleMergeWithPrev}
            onSplit={handleSplit}
          />
        ))}
      </div>
    </div>
  );
}

