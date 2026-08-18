'use client';

import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Play, Pause, Volume2, VolumeX, SkipBack, SkipForward } from 'lucide-react';

function formatTime(secs: number): string {
  if (isNaN(secs) || secs < 0) return '0:00';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export interface AudioPlayerHandle {
  seekTo: (time: number) => void;
}

interface AudioPlayerProps {
  file?: File | null;
  src?: string | null;
  onTimeUpdate?: (time: number) => void;
}

export const AudioPlayer = forwardRef<AudioPlayerHandle, AudioPlayerProps>(
  ({ file, src, onTimeUpdate }, ref) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [playing, setPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [muted, setMuted] = useState(false);
    const [volume, setVolume] = useState(1);
    const [srcUrl, setSrcUrl] = useState<string | null>(null);
    const scrubRef = useRef(false);

    useImperativeHandle(ref, () => ({
      seekTo: (time: number) => {
        if (audioRef.current) {
          audioRef.current.currentTime = time;
          setCurrentTime(time);
        }
      },
    }));

    useEffect(() => {
      if (file) {
        const url = URL.createObjectURL(file);
        setSrcUrl(url);
        setPlaying(false);
        setCurrentTime(0);
        return () => URL.revokeObjectURL(url);
      } else if (src) {
        setSrcUrl(src);
        setPlaying(false);
        setCurrentTime(0);
      } else {
        setSrcUrl(null);
      }
    }, [file, src]);

    const togglePlay = useCallback(() => {
      const a = audioRef.current;
      if (!a) return;
      if (playing) {
        a.pause();
      } else {
        a.play().catch(() => {});
      }
    }, [playing]);

    const skip = useCallback((delta: number) => {
      if (audioRef.current) audioRef.current.currentTime += delta;
    }, []);

    const pct = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
      <div className="audio-player">
        <audio
          ref={audioRef}
          src={srcUrl ?? undefined}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onTimeUpdate={(e) => {
            if (!scrubRef.current) {
              const t = e.currentTarget.currentTime;
              setCurrentTime(t);
              onTimeUpdate?.(t);
            }
          }}
        />

        {/* Scrubber */}
        <div className="player-scrubber-wrap">
          <span className="player-time">{formatTime(currentTime)}</span>
          <div className="player-scrubber-track">
            <input
              type="range"
              className="player-scrubber"
              min={0}
              max={duration || 1}
              step={0.1}
              value={currentTime}
              onMouseDown={() => { scrubRef.current = true; }}
              onChange={(e) => setCurrentTime(parseFloat(e.target.value))}
              onMouseUp={(e) => {
                scrubRef.current = false;
                if (audioRef.current) {
                  audioRef.current.currentTime = parseFloat(
                    (e.target as HTMLInputElement).value,
                  );
                }
              }}
              style={{ '--pct': `${pct}%` } as React.CSSProperties}
            />
          </div>
          <span className="player-time">{formatTime(duration)}</span>
        </div>

        {/* Controls */}
        <div className="player-controls">
          <div className="player-btns">
            <button className="player-btn" onClick={() => skip(-10)} aria-label="Skip back 10s">
              <SkipBack size={16} />
            </button>
            <button className="player-btn player-btn--play" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
              {playing ? <Pause size={20} /> : <Play size={20} />}
            </button>
            <button className="player-btn" onClick={() => skip(10)} aria-label="Skip forward 10s">
              <SkipForward size={16} />
            </button>
          </div>

          {/* Volume */}
          <div className="player-volume">
            <button
              className="player-btn"
              onClick={() => {
                const newMuted = !muted;
                setMuted(newMuted);
                if (audioRef.current) audioRef.current.muted = newMuted;
              }}
              aria-label={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <input
              type="range"
              className="player-vol-slider"
              min={0}
              max={1}
              step={0.02}
              value={muted ? 0 : volume}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setVolume(v);
                setMuted(v === 0);
                if (audioRef.current) {
                  audioRef.current.volume = v;
                  audioRef.current.muted = v === 0;
                }
              }}
            />
          </div>
        </div>
      </div>
    );
  },
);

AudioPlayer.displayName = 'AudioPlayer';
