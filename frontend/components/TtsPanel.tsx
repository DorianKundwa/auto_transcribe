'use client';

import { TtsSettings, ModelOption, DeviceOption } from '@/lib/types';
import { Sparkles, Trash2, Sliders, Volume2 } from 'lucide-react';
import { useState } from 'react';

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

      {/* Voice Selection */}
      <div className="setting-group">
        <label htmlFor="voice-select" className="setting-label">
          <Volume2 size={14} className="inline-icon" /> Kokoro Voice
        </label>
        <select
          id="voice-select"
          className="setting-select"
          value={settings.voice}
          onChange={(e) => handleVoiceChange(e.target.value)}
          disabled={disabled}
        >
          {/* Group voices by language/country */}
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
    </div>
  );
}
