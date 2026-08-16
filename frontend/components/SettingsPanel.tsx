'use client';

import { ModelOption, DeviceOption, TranscribeSettings } from '@/lib/types';

const MODELS: { value: ModelOption; label: string; note: string }[] = [
  { value: 'tiny',     label: 'Tiny',      note: '~1GB VRAM · fastest' },
  { value: 'base',     label: 'Base',      note: '~1GB VRAM · recommended' },
  { value: 'small',    label: 'Small',     note: '~2GB VRAM · balanced' },
  { value: 'medium',   label: 'Medium',    note: '~5GB VRAM · accurate' },
  { value: 'large-v2', label: 'Large v2',  note: '~10GB VRAM · very accurate' },
  { value: 'large-v3', label: 'Large v3',  note: '~10GB VRAM · best' },
];

const LANGUAGES = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'en',   label: 'English' },
  { value: 'fr',   label: 'French' },
  { value: 'de',   label: 'German' },
  { value: 'es',   label: 'Spanish' },
  { value: 'it',   label: 'Italian' },
  { value: 'pt',   label: 'Portuguese' },
  { value: 'nl',   label: 'Dutch' },
  { value: 'pl',   label: 'Polish' },
  { value: 'ru',   label: 'Russian' },
  { value: 'zh',   label: 'Chinese' },
  { value: 'ja',   label: 'Japanese' },
  { value: 'ko',   label: 'Korean' },
  { value: 'ar',   label: 'Arabic' },
  { value: 'tr',   label: 'Turkish' },
  { value: 'sv',   label: 'Swedish' },
  { value: 'da',   label: 'Danish' },
  { value: 'fi',   label: 'Finnish' },
  { value: 'no',   label: 'Norwegian' },
  { value: 'uk',   label: 'Ukrainian' },
  { value: 'cs',   label: 'Czech' },
  { value: 'ro',   label: 'Romanian' },
  { value: 'hu',   label: 'Hungarian' },
  { value: 'he',   label: 'Hebrew' },
  { value: 'hi',   label: 'Hindi' },
  { value: 'th',   label: 'Thai' },
  { value: 'vi',   label: 'Vietnamese' },
  { value: 'id',   label: 'Indonesian' },
];

const DEVICES: { value: DeviceOption; label: string }[] = [
  { value: 'auto', label: 'Auto (GPU if available)' },
  { value: 'cuda', label: 'GPU (CUDA)' },
  { value: 'cpu',  label: 'CPU' },
];

interface SettingsPanelProps {
  settings: TranscribeSettings;
  onChange: (s: Partial<TranscribeSettings>) => void;
  disabled?: boolean;
}

export function SettingsPanel({ settings, onChange, disabled }: SettingsPanelProps) {
  return (
    <div className="settings-panel">
      <div className="setting-group">
        <label htmlFor="model-select" className="setting-label">Model</label>
        <select
          id="model-select"
          className="setting-select"
          value={settings.model}
          onChange={(e) => onChange({ model: e.target.value as ModelOption })}
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
        <label htmlFor="language-select" className="setting-label">Language</label>
        <select
          id="language-select"
          className="setting-select"
          value={settings.language}
          onChange={(e) => onChange({ language: e.target.value })}
          disabled={disabled}
        >
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
      </div>

      <div className="setting-group">
        <label htmlFor="device-select" className="setting-label">Compute Device</label>
        <select
          id="device-select"
          className="setting-select"
          value={settings.device}
          onChange={(e) => onChange({ device: e.target.value as DeviceOption })}
          disabled={disabled}
        >
          {DEVICES.map((d) => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>
      </div>

      <div className="setting-group">
        <label htmlFor="pause-input" className="setting-label">
          Pause threshold
          <span className="setting-hint">{settings.pauseThreshold.toFixed(2)}s</span>
        </label>
        <input
          id="pause-input"
          type="range"
          min="0.2"
          max="2.0"
          step="0.05"
          value={settings.pauseThreshold}
          onChange={(e) => onChange({ pauseThreshold: parseFloat(e.target.value) })}
          disabled={disabled}
          className="setting-range"
        />
        <p className="setting-range-labels">
          <span>0.2s (tight)</span>
          <span>2.0s (loose)</span>
        </p>
      </div>
    </div>
  );
}
