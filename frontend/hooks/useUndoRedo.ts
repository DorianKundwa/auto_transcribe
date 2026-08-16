import { useCallback, useRef, useState } from 'react';
import { Segment } from '@/lib/types';

export interface UndoRedoState {
  canUndo: boolean;
  canRedo: boolean;
  push: (segments: Segment[]) => void;
  undo: () => Segment[] | null;
  redo: () => Segment[] | null;
}

export function useUndoRedo(maxHistory = 50): UndoRedoState {
  const past = useRef<Segment[][]>([]);
  const future = useRef<Segment[][]>([]);
  const [, forceRender] = useState(0);

  const push = useCallback((segments: Segment[]) => {
    past.current = [...past.current.slice(-maxHistory + 1), segments];
    future.current = [];
    forceRender((n) => n + 1);
  }, [maxHistory]);

  const undo = useCallback((): Segment[] | null => {
    if (past.current.length < 2) return null;
    const current = past.current.pop()!;
    future.current = [current, ...future.current];
    const prev = past.current[past.current.length - 1];
    forceRender((n) => n + 1);
    return prev;
  }, []);

  const redo = useCallback((): Segment[] | null => {
    if (future.current.length === 0) return null;
    const next = future.current.shift()!;
    past.current = [...past.current, next];
    forceRender((n) => n + 1);
    return next;
  }, []);

  return {
    canUndo: past.current.length >= 2,
    canRedo: future.current.length > 0,
    push,
    undo,
    redo,
  };
}
