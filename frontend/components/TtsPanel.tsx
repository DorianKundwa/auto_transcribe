'use client';

import { useState, useRef, useEffect } from 'react';
import { TtsSettings, VoiceBlendItem, ModelOption, DeviceOption } from '@/lib/types';
import { previewTtsVoice } from '@/lib/api';
import {
  Sparkles,
  Trash2,
  Sliders,
  Volume2,
  Play,
  Pause,
  Plus,
  X,
  Layers,
  User,
  Search,
  Check,
  RotateCcw,
  Loader2,
} from 'lucide-react';

export interface KokoroVoiceOption {
  id: string;
  name: string;
  gender: 'Female' | 'Male';
  lang: string;
  langCode: string;
  flag: string;
}

export const KOKORO_VOICES: KokoroVoiceOption[] = [
  // American English - Female
  { id: 'af_heart', name: 'Heart (Recommended)', gender: 'Female', lang: 'American English', langCode: 'a', flag: '🇺🇸' },
  { id: 'af_alloy', name: 'Alloy', gender: 'Female', lang: 'American English', langCode: 'a', flag: '🇺🇸' },
  { id: 'af_aoede', name: 'Aoede', gender: 'Female', lang: 'American English', langCode: 'a', flag: '🇺🇸' },
  { id: 'af_bella', name: 'Bella', gender: 'Female', lang: 'American English', langCode: 'a', flag: '🇺🇸' },
  { id: 'af_jessica', name: 'Jessica', gender: 'Female', lang: 'American English', langCode: 'a', flag: '🇺🇸' },
  { id: 'af_kore', name: 'Kore', gender: 'Female', lang: 'American English', langCode: 'a', flag: '🇺🇸' },
  { id: 'af_nicole', name: 'Nicole', gender: 'Female', lang: 'American English', langCode: 'a', flag: '🇺🇸' },
  { id: 'af_nova', name: 'Nova', gender: 'Female', lang: 'American English', langCode: 'a', flag: '🇺🇸' },
  { id: 'af_river', name: 'River', gender: 'Female', lang: 'American English', langCode: 'a', flag: '🇺🇸' },
  { id: 'af_sarah', name: 'Sarah', gender: 'Female', lang: 'American English', langCode: 'a', flag: '🇺🇸' },
  { id: 'af_sky', name: 'Sky', gender: 'Female', lang: 'American English', langCode: 'a', flag: '🇺🇸' },

  // American English - Male
  { id: 'am_adam', name: 'Adam', gender: 'Male', lang: 'American English', langCode: 'a', flag: '🇺🇸' },
  { id: 'am_echo', name: 'Echo', gender: 'Male', lang: 'American English', langCode: 'a', flag: '🇺🇸' },
  { id: 'am_eric', name: 'Eric', gender: 'Male', lang: 'American English', langCode: 'a', flag: '🇺🇸' },
  { id: 'am_fenrir', name: 'Fenrir', gender: 'Male', lang: 'American English', langCode: 'a', flag: '🇺🇸' },
  { id: 'am_liam', name: 'Liam', gender: 'Male', lang: 'American English', langCode: 'a', flag: '🇺🇸' },
  { id: 'am_michael', name: 'Michael', gender: 'Male', lang: 'American English', langCode: 'a', flag: '🇺🇸' },
  { id: 'am_onyx', name: 'Onyx', gender: 'Male', lang: 'American English', langCode: 'a', flag: '🇺🇸' },
  { id: 'am_puck', name: 'Puck', gender: 'Male', lang: 'American English', langCode: 'a', flag: '🇺🇸' },
  { id: 'am_santa', name: 'Santa', gender: 'Male', lang: 'American English', langCode: 'a', flag: '🇺🇸' },

  // British English - Female
  { id: 'bf_alice', name: 'Alice', gender: 'Female', lang: 'British English', langCode: 'b', flag: '🇬🇧' },
  { id: 'bf_emma', name: 'Emma', gender: 'Female', lang: 'British English', langCode: 'b', flag: '🇬🇧' },
  { id: 'bf_isabella', name: 'Isabella', gender: 'Female', lang: 'British English', langCode: 'b', flag: '🇬🇧' },
  { id: 'bf_lily', name: 'Lily', gender: 'Female', lang: 'British English', langCode: 'b', flag: '🇬🇧' },

  // British English - Male
  { id: 'bm_daniel', name: 'Daniel', gender: 'Male', lang: 'British English', langCode: 'b', flag: '🇬🇧' },
  { id: 'bm_fable', name: 'Fable', gender: 'Male', lang: 'British English', langCode: 'b', flag: '🇬🇧' },
  { id: 'bm_george', name: 'George', gender: 'Male', lang: 'British English', langCode: 'b', flag: '🇬🇧' },
  { id: 'bm_lewis', name: 'Lewis', gender: 'Male', lang: 'British English', langCode: 'b', flag: '🇬🇧' },

  // Spanish
  { id: 'ef_dora', name: 'Dora', gender: 'Female', lang: 'Spanish', langCode: 'e', flag: '🇪🇸' },
  { id: 'em_alex', name: 'Alex', gender: 'Male', lang: 'Spanish', langCode: 'e', flag: '🇪🇸' },
  { id: 'em_santa', name: 'Santa', gender: 'Male', lang: 'Spanish', langCode: 'e', flag: '🇪🇸' },

  // French
  { id: 'ff_siwis', name: 'Siwis', gender: 'Female', lang: 'French', langCode: 'f', flag: '🇫🇷' },

  // Hindi
  { id: 'hf_alpha', name: 'Alpha', gender: 'Female', lang: 'Hindi', langCode: 'h', flag: '🇮🇳' },
  { id: 'hf_beta', name: 'Beta', gender: 'Female', lang: 'Hindi', langCode: 'h', flag: '🇮🇳' },
  { id: 'hm_omega', name: 'Omega', gender: 'Male', lang: 'Hindi', langCode: 'h', flag: '🇮🇳' },
  { id: 'hm_psi', name: 'Psi', gender: 'Male', lang: 'Hindi', langCode: 'h', flag: '🇮🇳' },

  // Italian
  { id: 'if_sara', name: 'Sara', gender: 'Female', lang: 'Italian', langCode: 'i', flag: '🇮🇹' },
  { id: 'im_nicola', name: 'Nicola', gender: 'Male', lang: 'Italian', langCode: 'i', flag: '🇮🇹' },

  // Portuguese
  { id: 'pf_dora', name: 'Dora (BR)', gender: 'Female', lang: 'Portuguese', langCode: 'p', flag: '🇧🇷' },
  { id: 'pm_alex', name: 'Alex (BR)', gender: 'Male', lang: 'Portuguese', langCode: 'p', flag: '🇧🇷' },
  { id: 'pm_santa', name: 'Santa (BR)', gender: 'Male', lang: 'Portuguese', langCode: 'p', flag: '🇧🇷' },

  // Japanese
  { id: 'jf_alpha', name: 'Alpha', gender: 'Female', lang: 'Japanese', langCode: 'j', flag: '🇯🇵' },
  { id: 'jf_gongitsune', name: 'Gongitsune', gender: 'Female', lang: 'Japanese', langCode: 'j', flag: '🇯🇵' },
  { id: 'jf_nezumi', name: 'Nezumi', gender: 'Female', lang: 'Japanese', langCode: 'j', flag: '🇯🇵' },
  { id: 'jf_tebukuro', name: 'Tebukuro', gender: 'Female', lang: 'Japanese', langCode: 'j', flag: '🇯🇵' },
  { id: 'jm_kumo', name: 'Kumo', gender: 'Male', lang: 'Japanese', langCode: 'j', flag: '🇯🇵' },

  // Mandarin Chinese
  { id: 'zf_xiaobei', name: 'Xiaobei', gender: 'Female', lang: 'Mandarin Chinese', langCode: 'z', flag: '🇨🇳' },
  { id: 'zf_xiaoni', name: 'Xiaoni', gender: 'Female', lang: 'Mandarin Chinese', langCode: 'z', flag: '🇨🇳' },
  { id: 'zf_xiaoxiao', name: 'Xiaoxiao', gender: 'Female', lang: 'Mandarin Chinese', langCode: 'z', flag: '🇨🇳' },
  { id: 'zf_xiaoyi', name: 'Xiaoyi', gender: 'Female', lang: 'Mandarin Chinese', langCode: 'z', flag: '🇨🇳' },
  { id: 'zm_yunjian', name: 'Yunjian', gender: 'Male', lang: 'Mandarin Chinese', langCode: 'z', flag: '🇨🇳' },
  { id: 'zm_yunxi', name: 'Yunxi', gender: 'Male', lang: 'Mandarin Chinese', langCode: 'z', flag: '🇨🇳' },
  { id: 'zm_yunxia', name: 'Yunxia', gender: 'Male', lang: 'Mandarin Chinese', langCode: 'z', flag: '🇨🇳' },
  { id: 'zm_yunyang', name: 'Yunyang', gender: 'Male', lang: 'Mandarin Chinese', langCode: 'z', flag: '🇨🇳' },
];

const MODELS: { value: ModelOption; label: string; note: string }[] = [
  { value: 'tiny',     label: 'Tiny',      note: '~1GB VRAM · fastest' },
  { value: 'base',     label: 'Base',      note: '~1GB VRAM · recommended' },
  { value: 'small',    label: 'Small',     note: '~2GB VRAM · balanced' },
  { value: 'medium',   label: 'Medium',    note: '~5GB VRAM · accurate' },
  { value: 'large-v2', label: 'Large v2',  note: '~10GB VRAM · very accurate' },
  { value: 'large-v3', label: 'Large v3',  note: '~10GB VRAM · best' },
];

const DEVICES: { value: DeviceOption; label: string }[] = [
  { value: 'auto', label: 'Auto (GPU if available)' },
  { value: 'cuda', label: 'GPU (CUDA)' },
  { value: 'cpu',  label: 'CPU' },
];

const SAMPLE_SCRIPT =
  'Welcome to AutoTranscribe powered by Kokoro TTS and WhisperX! ' +
  'This pipeline generates natural high-fidelity speech from your script, ' +
  'creates a crystal-clear 24kHz audio track, and automatically aligns word-level timestamps.';

interface TtsPanelProps {
  script: string;
  onScriptChange: (val: string) => void;
  settings: TtsSettings;
  onSettingsChange: (partial: Partial<TtsSettings>) => void;
  disabled?: boolean;
}

export function TtsPanel({
  script,
  onScriptChange,
  settings,
  onSettingsChange,
  disabled = false,
}: TtsPanelProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showVoiceLibrary, setShowVoiceLibrary] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState<'All' | 'Female' | 'Male'>('All');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewVoiceId, setPreviewVoiceId] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
    };
  }, []);

  const wordCount = script.trim() ? script.trim().split(/\s+/).length : 0;
  const charCount = script.length;

  const handleVoiceChange = (voiceId: string) => {
    const voiceObj = KOKORO_VOICES.find((v) => v.id === voiceId);
    if (voiceObj) {
      onSettingsChange({
        voice: voiceObj.id,
        langCode: voiceObj.langCode,
      });
    } else {
      onSettingsChange({ voice: voiceId });
    }
  };

  const handlePlayPreview = async (voiceTarget?: string | VoiceBlendItem[]) => {
    try {
      // If already playing this preview, toggle pause
      if (previewAudioRef.current && isPlayingPreview) {
        previewAudioRef.current.pause();
        setIsPlayingPreview(false);
        return;
      }

      setPreviewLoading(true);
      const target =
        voiceTarget ??
        (settings.mode === 'blend' ? settings.voiceBlend : settings.voice);
      const targetKey =
        typeof target === 'string'
          ? target
          : target.map((v) => `${v.voice}:${v.weight}`).join(',');

      setPreviewVoiceId(targetKey);

      const url = await previewTtsVoice(
        target,
        settings.langCode,
        settings.speed,
        'Hello! This is Kokoro Text to Speech preview.',
      );

      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }

      const audio = new Audio(url);
      previewAudioRef.current = audio;

      audio.onplay = () => setIsPlayingPreview(true);
      audio.onended = () => {
        setIsPlayingPreview(false);
        setPreviewVoiceId(null);
      };
      audio.onpause = () => setIsPlayingPreview(false);

      await audio.play();
    } catch (err) {
      console.error('Failed to preview voice:', err);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Multi-voice blend helpers
  const handleAddBlendVoice = (voiceId: string) => {
    const exists = settings.voiceBlend.some((b) => b.voice === voiceId);
    if (exists) return;
    const newBlend: VoiceBlendItem[] = [
      ...settings.voiceBlend,
      { voice: voiceId, weight: 50 },
    ];
    onSettingsChange({ voiceBlend: newBlend });
  };

  const handleRemoveBlendVoice = (index: number) => {
    const newBlend = settings.voiceBlend.filter((_, i) => i !== index);
    onSettingsChange({ voiceBlend: newBlend });
  };

  const handleUpdateBlendWeight = (index: number, weight: number) => {
    const newBlend = [...settings.voiceBlend];
    newBlend[index] = { ...newBlend[index], weight };
    onSettingsChange({ voiceBlend: newBlend });
  };

  // Filtered voice list for the library modal
  const filteredVoices = KOKORO_VOICES.filter((v) => {
    const matchesSearch =
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.lang.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGender = genderFilter === 'All' || v.gender === genderFilter;
    return matchesSearch && matchesGender;
  });

  const totalBlendWeight = settings.voiceBlend.reduce((sum, v) => sum + (v.weight || 0), 0) || 1;

  return (
    <div className="tts-panel">
      {/* Script Input Area */}
      <div className="setting-group">
        <div className="script-header">
          <label htmlFor="script-textarea" className="setting-label">
            Script Text
          </label>
          <div className="script-actions">
            <button
              type="button"
              className="script-btn-secondary"
              onClick={() => onScriptChange(SAMPLE_SCRIPT)}
              disabled={disabled}
              title="Insert sample text"
            >
              <Sparkles size={13} />
              Sample
            </button>
            {script && (
              <button
                type="button"
                className="script-btn-secondary"
                onClick={() => onScriptChange('')}
                disabled={disabled}
                title="Clear text"
              >
                <Trash2 size={13} />
                Clear
              </button>
            )}
          </div>
        </div>

        <textarea
          id="script-textarea"
          className="script-textarea"
          rows={6}
          placeholder="Type or paste your script here… Kokoro TTS will synthesize voice and WhisperX will align precise timestamps for every word."
          value={script}
          onChange={(e) => onScriptChange(e.target.value)}
          disabled={disabled}
        />

        <div className="script-meta">
          <span>{wordCount} words · {charCount} chars</span>
          <span>~{Math.max(1, Math.round(wordCount / 2.5))} sec estimated</span>
        </div>
      </div>

      {/* Voice Selection Section */}
      <div className="setting-group">
        <div className="voice-mode-header">
          <label className="setting-label">
            <Volume2 size={14} className="inline-icon" /> Kokoro Voice Selection
          </label>

          {/* Voice Mode Toggle: Single vs Multi-Voice Blend */}
          <div className="voice-mode-toggle">
            <button
              type="button"
              className={`voice-mode-btn ${settings.mode === 'single' ? 'active' : ''}`}
              onClick={() => onSettingsChange({ mode: 'single' })}
              disabled={disabled}
            >
              <User size={13} />
              Single
            </button>
            <button
              type="button"
              className={`voice-mode-btn ${settings.mode === 'blend' ? 'active' : ''}`}
              onClick={() => {
                if (settings.voiceBlend.length === 0) {
                  onSettingsChange({
                    mode: 'blend',
                    voiceBlend: [
                      { voice: settings.voice || 'af_heart', weight: 60 },
                      { voice: 'am_adam', weight: 40 },
                    ],
                  });
                } else {
                  onSettingsChange({ mode: 'blend' });
                }
              }}
              disabled={disabled}
            >
              <Layers size={13} />
              Multi Blend
            </button>
          </div>
        </div>

        {/* SINGLE VOICE SELECTION */}
        {settings.mode === 'single' ? (
          <div className="single-voice-controls">
            <div className="voice-picker-row">
              <select
                id="voice-select"
                className="setting-select"
                value={settings.voice}
                onChange={(e) => handleVoiceChange(e.target.value)}
                disabled={disabled}
              >
                <optgroup label="🇺🇸 American English">
                  {KOKORO_VOICES.filter((v) => v.langCode === 'a').map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.flag} {v.name} ({v.gender})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="🇬🇧 British English">
                  {KOKORO_VOICES.filter((v) => v.langCode === 'b').map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.flag} {v.name} ({v.gender})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="🇪🇸 Spanish">
                  {KOKORO_VOICES.filter((v) => v.langCode === 'e').map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.flag} {v.name} ({v.gender})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="🇫🇷 French">
                  {KOKORO_VOICES.filter((v) => v.langCode === 'f').map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.flag} {v.name} ({v.gender})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="🇮🇳 Hindi">
                  {KOKORO_VOICES.filter((v) => v.langCode === 'h').map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.flag} {v.name} ({v.gender})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="🇮🇹 Italian">
                  {KOKORO_VOICES.filter((v) => v.langCode === 'i').map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.flag} {v.name} ({v.gender})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="🇧🇷 Portuguese">
                  {KOKORO_VOICES.filter((v) => v.langCode === 'p').map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.flag} {v.name} ({v.gender})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="🇯🇵 Japanese">
                  {KOKORO_VOICES.filter((v) => v.langCode === 'j').map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.flag} {v.name} ({v.gender})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="🇨🇳 Mandarin Chinese">
                  {KOKORO_VOICES.filter((v) => v.langCode === 'z').map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.flag} {v.name} ({v.gender})
                    </option>
                  ))}
                </optgroup>
              </select>

              {/* Preview Button for Single Voice */}
              <button
                type="button"
                id="voice-preview-btn"
                className={`voice-preview-btn ${previewVoiceId === settings.voice && isPlayingPreview ? 'playing' : ''}`}
                onClick={() => handlePlayPreview(settings.voice)}
                disabled={disabled || previewLoading}
                title="Listen to sample audio of this voice"
              >
                {previewLoading && previewVoiceId === settings.voice ? (
                  <Loader2 size={14} className="spin" />
                ) : isPlayingPreview && previewVoiceId === settings.voice ? (
                  <Pause size={14} />
                ) : (
                  <Play size={14} />
                )}
                <span>Preview</span>
              </button>
            </div>

            {/* Quick Browse Library Modal Button */}
            <button
              type="button"
              className="voice-library-link"
              onClick={() => setShowVoiceLibrary(true)}
            >
              <Search size={13} />
              Browse & Audition Voice Library ({KOKORO_VOICES.length} voices)
            </button>
          </div>
        ) : (
          /* MULTI-VOICE BLEND SELECTION */
          <div className="blend-voice-controls">
            <div className="blend-help-banner">
              <Layers size={14} />
              <span>Mix multiple Kokoro voices to create a unique custom voice identity.</span>
            </div>

            <div className="blend-list">
              {settings.voiceBlend.map((item, idx) => {
                const voiceObj = KOKORO_VOICES.find((v) => v.id === item.voice);
                const pct = Math.round((item.weight / totalBlendWeight) * 100);

                return (
                  <div key={item.voice + idx} className="blend-item-card">
                    <div className="blend-item-header">
                      <div className="blend-item-name">
                        <span className="blend-flag">{voiceObj?.flag || '🎙'}</span>
                        <span className="blend-title">{voiceObj?.name || item.voice}</span>
                        <span className="blend-gender">{voiceObj?.gender}</span>
                      </div>
                      <div className="blend-item-actions">
                        <span className="blend-pct-badge">{pct}%</span>
                        <button
                          type="button"
                          className="blend-remove-btn"
                          onClick={() => handleRemoveBlendVoice(idx)}
                          disabled={settings.voiceBlend.length <= 1}
                          title="Remove voice from blend"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>

                    <div className="blend-slider-wrap">
                      <input
                        type="range"
                        min="5"
                        max="100"
                        step="5"
                        value={item.weight}
                        onChange={(e) => handleUpdateBlendWeight(idx, parseFloat(e.target.value))}
                        className="setting-range blend-slider"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Blend Actions */}
            <div className="blend-actions-row">
              <button
                type="button"
                className="blend-add-btn"
                onClick={() => setShowVoiceLibrary(true)}
                disabled={disabled}
              >
                <Plus size={14} />
                Add Voice to Mix
              </button>

              <button
                type="button"
                id="blend-preview-btn"
                className={`voice-preview-btn ${isPlayingPreview ? 'playing' : ''}`}
                onClick={() => handlePlayPreview(settings.voiceBlend)}
                disabled={disabled || previewLoading || settings.voiceBlend.length === 0}
              >
                {previewLoading ? (
                  <Loader2 size={14} className="spin" />
                ) : isPlayingPreview ? (
                  <Pause size={14} />
                ) : (
                  <Play size={14} />
                )}
                <span>Preview Mix</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Speed Slider */}
      <div className="setting-group">
        <label htmlFor="speed-input" className="setting-label">
          Speech Speed
          <span className="setting-hint">{settings.speed.toFixed(1)}×</span>
        </label>
        <input
          id="speed-input"
          type="range"
          min="0.5"
          max="2.0"
          step="0.1"
          value={settings.speed}
          onChange={(e) => onSettingsChange({ speed: parseFloat(e.target.value) })}
          disabled={disabled}
          className="setting-range"
        />
        <p className="setting-range-labels">
          <span>0.5× (slow)</span>
          <span>1.0× (normal)</span>
          <span>2.0× (fast)</span>
        </p>
      </div>

      {/* Advanced Alignment Settings Toggle */}
      <button
        type="button"
        className="advanced-toggle-btn"
        onClick={() => setShowAdvanced((prev) => !prev)}
      >
        <Sliders size={14} />
        {showAdvanced ? 'Hide Alignment Settings' : 'WhisperX Alignment Settings'}
      </button>

      {showAdvanced && (
        <div className="advanced-settings-box">
          <div className="setting-group">
            <label htmlFor="tts-model-select" className="setting-label">
              WhisperX Model
            </label>
            <select
              id="tts-model-select"
              className="setting-select"
              value={settings.model}
              onChange={(e) => onSettingsChange({ model: e.target.value as ModelOption })}
              disabled={disabled}
            >
              {MODELS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label} — {m.note}
                </option>
              ))}
            </select>
          </div>

          <div className="setting-group">
            <label htmlFor="tts-device-select" className="setting-label">
              Compute Device
            </label>
            <select
              id="tts-device-select"
              className="setting-select"
              value={settings.device}
              onChange={(e) => onSettingsChange({ device: e.target.value as DeviceOption })}
              disabled={disabled}
            >
              {DEVICES.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>

          <div className="setting-group">
            <label htmlFor="tts-pause-input" className="setting-label">
              Pause threshold
              <span className="setting-hint">{settings.pauseThreshold.toFixed(2)}s</span>
            </label>
            <input
              id="tts-pause-input"
              type="range"
              min="0.2"
              max="2.0"
              step="0.05"
              value={settings.pauseThreshold}
              onChange={(e) => onSettingsChange({ pauseThreshold: parseFloat(e.target.value) })}
              disabled={disabled}
              className="setting-range"
            />
            <p className="setting-range-labels">
              <span>0.2s (tight)</span>
              <span>2.0s (loose)</span>
            </p>
          </div>
        </div>
      )}

      {/* VOICE LIBRARY MODAL / DRAWER */}
      {showVoiceLibrary && (
        <div className="voice-modal-overlay" onClick={() => setShowVoiceLibrary(false)}>
          <div className="voice-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="voice-modal-header">
              <div>
                <h3 className="voice-modal-title">Kokoro Voice Library</h3>
                <p className="voice-modal-sub">
                  Audition voices and select or add to your multi-voice mix.
                </p>
              </div>
              <button
                type="button"
                className="voice-modal-close"
                onClick={() => setShowVoiceLibrary(false)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Filter Bar */}
            <div className="voice-filter-bar">
              <div className="voice-search-wrap">
                <Search size={14} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search voices by name or language…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="voice-search-input"
                />
              </div>

              <div className="voice-gender-filter">
                {(['All', 'Female', 'Male'] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    className={`gender-filter-btn ${genderFilter === g ? 'active' : ''}`}
                    onClick={() => setGenderFilter(g)}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Voice Cards Grid */}
            <div className="voice-grid">
              {filteredVoices.map((v) => {
                const isSelectedSingle = settings.mode === 'single' && settings.voice === v.id;
                const isSelectedBlend = settings.mode === 'blend' && settings.voiceBlend.some((b) => b.voice === v.id);
                const isCurrentPlaying = previewVoiceId === v.id && isPlayingPreview;

                return (
                  <div
                    key={v.id}
                    className={`voice-card ${isSelectedSingle || isSelectedBlend ? 'selected' : ''}`}
                  >
                    <div className="voice-card-top">
                      <span className="voice-card-flag">{v.flag}</span>
                      <div className="voice-card-info">
                        <span className="voice-card-name">{v.name}</span>
                        <span className="voice-card-meta">{v.lang} · {v.gender}</span>
                      </div>
                    </div>

                    <div className="voice-card-actions">
                      <button
                        type="button"
                        className={`voice-card-preview-btn ${isCurrentPlaying ? 'playing' : ''}`}
                        onClick={() => handlePlayPreview(v.id)}
                        disabled={previewLoading}
                        title="Listen to sample"
                      >
                        {previewLoading && previewVoiceId === v.id ? (
                          <Loader2 size={13} className="spin" />
                        ) : isCurrentPlaying ? (
                          <Pause size={13} />
                        ) : (
                          <Play size={13} />
                        )}
                        <span>{isCurrentPlaying ? 'Playing' : 'Listen'}</span>
                      </button>

                      {settings.mode === 'single' ? (
                        <button
                          type="button"
                          className={`voice-card-select-btn ${isSelectedSingle ? 'active' : ''}`}
                          onClick={() => {
                            handleVoiceChange(v.id);
                            setShowVoiceLibrary(false);
                          }}
                        >
                          {isSelectedSingle ? (
                            <>
                              <Check size={13} /> Selected
                            </>
                          ) : (
                            'Select'
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={`voice-card-select-btn ${isSelectedBlend ? 'active' : ''}`}
                          onClick={() => {
                            if (!isSelectedBlend) {
                              handleAddBlendVoice(v.id);
                            }
                          }}
                          disabled={isSelectedBlend}
                        >
                          {isSelectedBlend ? (
                            <>
                              <Check size={13} /> In Mix
                            </>
                          ) : (
                            <>
                              <Plus size={13} /> Add to Mix
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="voice-modal-footer">
              <span>{filteredVoices.length} voices found</span>
              <button
                type="button"
                className="voice-modal-done-btn"
                onClick={() => setShowVoiceLibrary(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
