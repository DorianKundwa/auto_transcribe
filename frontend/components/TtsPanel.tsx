'use client';

import { useState, useRef, useEffect } from 'react';
import { TtsSettings, VoiceBlendItem, ModelOption, DeviceOption, CustomVoice, VoiceboxDspSettings, TrainingProgressEvent } from '@/lib/types';
import { previewTtsVoice, fetchCustomVoices, cloneVoice, deleteCustomVoice, getCustomVoiceSampleUrl, startVoiceTraining, subscribeVoiceTrainingProgress } from '@/lib/api';
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
  Download,
  Loader2,
  Mic,
  Square,
  UploadCloud,
  FileAudio,
  Radio,
  Info,
  CheckCircle2,
  AlertCircle,
  Wand2,
  Cpu,
  Zap,
  Activity,
  Gauge,
} from 'lucide-react';

export interface ChatterboxVoiceOption {
  id: string;
  name: string;
  gender: 'Female' | 'Male';
  lang: string;
  langCode: string;
  flag: string;
  isCustom?: boolean;
}

export const CHATTERBOX_VOICES: ChatterboxVoiceOption[] = [
  // American English - Female
  { id: 'default', name: 'Chatterbox Default (Recommended)', gender: 'Female', lang: 'American English', langCode: 'en', flag: '✨' },
  { id: 'chatterbox_grace', name: 'Grace', gender: 'Female', lang: 'American English', langCode: 'en', flag: '🇺🇸' },
  { id: 'chatterbox_bella', name: 'Bella', gender: 'Female', lang: 'American English', langCode: 'en', flag: '🇺🇸' },
  { id: 'chatterbox_nicole', name: 'Nicole', gender: 'Female', lang: 'American English', langCode: 'en', flag: '🇺🇸' },
  { id: 'chatterbox_sarah', name: 'Sarah', gender: 'Female', lang: 'American English', langCode: 'en', flag: '🇺🇸' },
  { id: 'chatterbox_sky', name: 'Sky', gender: 'Female', lang: 'American English', langCode: 'en', flag: '🇺🇸' },
  { id: 'chatterbox_emma', name: 'Emma', gender: 'Female', lang: 'American English', langCode: 'en', flag: '🇺🇸' },

  // American English - Male
  { id: 'chatterbox_adam', name: 'Adam', gender: 'Male', lang: 'American English', langCode: 'en', flag: '🇺🇸' },
  { id: 'chatterbox_michael', name: 'Michael', gender: 'Male', lang: 'American English', langCode: 'en', flag: '🇺🇸' },
  { id: 'chatterbox_liam', name: 'Liam', gender: 'Male', lang: 'American English', langCode: 'en', flag: '🇺🇸' },
  { id: 'chatterbox_eric', name: 'Eric', gender: 'Male', lang: 'American English', langCode: 'en', flag: '🇺🇸' },
  { id: 'chatterbox_david', name: 'David', gender: 'Male', lang: 'American English', langCode: 'en', flag: '🇺🇸' },

  // British English - Female
  { id: 'chatterbox_alice', name: 'Alice', gender: 'Female', lang: 'British English', langCode: 'en', flag: '🇬🇧' },
  { id: 'chatterbox_lily', name: 'Lily', gender: 'Female', lang: 'British English', langCode: 'en', flag: '🇬🇧' },
  { id: 'chatterbox_charlotte', name: 'Charlotte', gender: 'Female', lang: 'British English', langCode: 'en', flag: '🇬🇧' },

  // British English - Male
  { id: 'chatterbox_daniel', name: 'Daniel', gender: 'Male', lang: 'British English', langCode: 'en', flag: '🇬🇧' },
  { id: 'chatterbox_george', name: 'George', gender: 'Male', lang: 'British English', langCode: 'en', flag: '🇬🇧' },
  { id: 'chatterbox_lewis', name: 'Lewis', gender: 'Male', lang: 'British English', langCode: 'en', flag: '🇬🇧' },

  // Spanish
  { id: 'chatterbox_elena', name: 'Elena', gender: 'Female', lang: 'Spanish', langCode: 'es', flag: '🇪🇸' },
  { id: 'chatterbox_mateo', name: 'Mateo', gender: 'Male', lang: 'Spanish', langCode: 'es', flag: '🇪🇸' },

  // French
  { id: 'chatterbox_camille', name: 'Camille', gender: 'Female', lang: 'French', langCode: 'fr', flag: '🇫🇷' },
  { id: 'chatterbox_lucas', name: 'Lucas', gender: 'Male', lang: 'French', langCode: 'fr', flag: '🇫🇷' },

  // German
  { id: 'chatterbox_greta', name: 'Greta', gender: 'Female', lang: 'German', langCode: 'de', flag: '🇩🇪' },
  { id: 'chatterbox_felix', name: 'Felix', gender: 'Male', lang: 'German', langCode: 'de', flag: '🇩🇪' },

  // Italian
  { id: 'chatterbox_giulia', name: 'Giulia', gender: 'Female', lang: 'Italian', langCode: 'it', flag: '🇮🇹' },
  { id: 'chatterbox_marco', name: 'Marco', gender: 'Male', lang: 'Italian', langCode: 'it', flag: '🇮🇹' },

  // Portuguese
  { id: 'chatterbox_mariana', name: 'Mariana', gender: 'Female', lang: 'Portuguese', langCode: 'pt', flag: '🇧🇷' },
  { id: 'chatterbox_thiago', name: 'Thiago', gender: 'Male', lang: 'Portuguese', langCode: 'pt', flag: '🇧🇷' },

  // Japanese
  { id: 'chatterbox_sakura', name: 'Sakura', gender: 'Female', lang: 'Japanese', langCode: 'ja', flag: '🇯🇵' },
  { id: 'chatterbox_ren', name: 'Ren', gender: 'Male', lang: 'Japanese', langCode: 'ja', flag: '🇯🇵' },

  // Mandarin Chinese
  { id: 'chatterbox_mei', name: 'Mei', gender: 'Female', lang: 'Mandarin Chinese', langCode: 'zh', flag: '🇨🇳' },
  { id: 'chatterbox_bo', name: 'Bo', gender: 'Male', lang: 'Mandarin Chinese', langCode: 'zh', flag: '🇨🇳' },

  // Hindi
  { id: 'chatterbox_priya', name: 'Priya', gender: 'Female', lang: 'Hindi', langCode: 'hi', flag: '🇮🇳' },
  { id: 'chatterbox_aarav', name: 'Aarav', gender: 'Male', lang: 'Hindi', langCode: 'hi', flag: '🇮🇳' },

  // Arabic
  { id: 'chatterbox_layla', name: 'Layla', gender: 'Female', lang: 'Arabic', langCode: 'ar', flag: '🇸🇦' },
  { id: 'chatterbox_tariq', name: 'Tariq', gender: 'Male', lang: 'Arabic', langCode: 'ar', flag: '🇸🇦' },

  // Russian
  { id: 'chatterbox_anya', name: 'Anya', gender: 'Female', lang: 'Russian', langCode: 'ru', flag: '🇷🇺' },
  { id: 'chatterbox_dmitri', name: 'Dmitri', gender: 'Male', lang: 'Russian', langCode: 'ru', flag: '🇷🇺' },

  // Korean
  { id: 'chatterbox_jiwoo', name: 'Jiwoo', gender: 'Female', lang: 'Korean', langCode: 'ko', flag: '🇰🇷' },
  { id: 'chatterbox_minho', name: 'Minho', gender: 'Male', lang: 'Korean', langCode: 'ko', flag: '🇰🇷' },
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
  'Welcome to AutoTranscribe powered by Resemble AI Chatterbox TTS and WhisperX! ' +
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
  const [showCloneStudio, setShowCloneStudio] = useState(false);

  // Custom voices
  const [customVoices, setCustomVoices] = useState<CustomVoice[]>([]);
  const [loadingCustomVoices, setLoadingCustomVoices] = useState(false);

  // Voice library filters
  const [searchQuery, setSearchQuery] = useState('');
  const [libraryTab, setLibraryTab] = useState<'All' | 'Custom' | 'Female' | 'Male'>('All');
  
  // Audio preview playback state
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewVoiceId, setPreviewVoiceId] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Voice cloning studio state
  const [cloneMode, setCloneMode] = useState<'upload' | 'record'>('record');
  const [cloneName, setCloneName] = useState('');
  const [cloneGender, setCloneGender] = useState<'Male' | 'Female' | 'auto'>('auto');
  const [cloneLangCode, setCloneLangCode] = useState('a');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isCloning, setIsCloning] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [cloneSuccess, setCloneSuccess] = useState<string | null>(null);
  const [lastClonedVoice, setLastClonedVoice] = useState<CustomVoice | null>(null);

  // Enhanced Deep Neural Voice Training state
  const [trainingMode, setTrainingMode] = useState<'deep' | 'quick'>('deep');
  const [trainingEpochs, setTrainingEpochs] = useState(100);
  const [isTraining, setIsTraining] = useState(false);
  const [trainingEvent, setTrainingEvent] = useState<TrainingProgressEvent | null>(null);

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Load custom voices on mount
  const refreshCustomVoices = async () => {
    try {
      setLoadingCustomVoices(true);
      const list = await fetchCustomVoices();
      setCustomVoices(list);
    } catch (e) {
      console.warn('Could not load custom voices:', e);
    } finally {
      setLoadingCustomVoices(false);
    }
  };

  useEffect(() => {
    refreshCustomVoices();
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Combined voice options
  const allVoiceOptions: ChatterboxVoiceOption[] = [
    ...customVoices.map((cv) => ({
      id: cv.id,
      name: `${cv.name} (Cloned)`,
      gender: cv.gender,
      lang: cv.lang,
      langCode: cv.langCode,
      flag: '✨',
      isCustom: true,
    })),
    ...CHATTERBOX_VOICES,
  ];

  const wordCount = script.trim() ? script.trim().split(/\s+/).length : 0;
  const charCount = script.length;

  const handleVoiceChange = (voiceId: string) => {
    const voiceObj = allVoiceOptions.find((v) => v.id === voiceId);
    if (voiceObj) {
      onSettingsChange({
        voice: voiceObj.id,
        langCode: voiceObj.langCode,
      });
    } else {
      onSettingsChange({ voice: voiceId });
    }
  };

  const [showVoiceboxStudio, setShowVoiceboxStudio] = useState(true);

  const currentDsp: VoiceboxDspSettings = settings.dsp || {
    deliveryPreset: 'studio_neutral',
    warmth: 0,
    clarity: 0,
    pitchShift: 0,
    reverb: 0,
    compression: false,
  };

  const handleUpdateDsp = (updates: Partial<VoiceboxDspSettings>) => {
    onSettingsChange({
      dsp: {
        ...currentDsp,
        ...updates,
      },
    });
  };

  const handleInsertTag = (tag: string) => {
    const textarea = document.getElementById('script-textarea') as HTMLTextAreaElement | null;
    if (!textarea) {
      onScriptChange(script + (script.length > 0 && !script.endsWith(' ') ? ' ' : '') + tag);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = script.substring(0, start);
    const after = script.substring(end);
    const needsLeadingSpace = start > 0 && !before.endsWith(' ') && !before.endsWith('\n');
    const needsTrailingSpace = after.length > 0 && !after.startsWith(' ') && !after.startsWith('\n');
    const inserted = `${needsLeadingSpace ? ' ' : ''}${tag}${needsTrailingSpace ? ' ' : ''}`;
    const newScript = `${before}${inserted}${after}`;
    onScriptChange(newScript);
    setTimeout(() => {
      textarea.focus();
      const newPos = start + inserted.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 15);
  };

  const handlePlayPreview = async (voiceTarget?: string | VoiceBlendItem[]) => {
    try {
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

      const targetVoiceObj = allVoiceOptions.find(
        (v) => v.id === (typeof target === 'string' ? target : target[0]?.voice)
      );
      const activeLangCode = targetVoiceObj?.langCode || settings.langCode || 'a';

      const previewText = script.trim()
        ? script.trim().slice(0, 180)
        : 'Hello! This is a voice preview with Voicebox studio effects.';

      const url = await previewTtsVoice(
        target,
        activeLangCode,
        settings.speed,
        previewText,
        settings.exaggeration,
        settings.dsp,
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

  // Recording methods
  const startRecording = async () => {
    try {
      setRecordedBlob(null);
      setRecordedAudioUrl(null);
      setCloneError(null);
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      let mimeType = '';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        }
      }
      const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const actualMime = mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMime });
        setRecordedBlob(audioBlob);
        const url = URL.createObjectURL(audioBlob);
        setRecordedAudioUrl(url);
        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(200);
      setIsRecording(true);
      setRecordSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Microphone access error:', err);
      setCloneError(err.message || 'Could not access microphone. Please check browser permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleCloneSubmit = async () => {
    const audioData = cloneMode === 'record' ? recordedBlob : uploadedFile;
    if (!audioData) {
      setCloneError('Please record your voice or select an audio file first.');
      return;
    }

    const nameToUse = cloneName.trim() || 'My Voice';

    try {
      setIsCloning(true);
      setCloneError(null);
      setCloneSuccess(null);

      const newVoice = await cloneVoice(
        audioData,
        nameToUse,
        cloneGender,
        cloneLangCode,
      );

      setLastClonedVoice(newVoice);
      setCloneSuccess(`Voice "${newVoice.name}" cloned & optimized successfully!`);
      await refreshCustomVoices();

      // Automatically select newly cloned voice
      onSettingsChange({
        voice: newVoice.id,
        langCode: newVoice.langCode,
      });

      // Preview synthesized voice
      setTimeout(() => {
        handlePlayPreview(newVoice.id);
      }, 600);
    } catch (err: any) {
      console.error('Cloning failed:', err);
      setCloneError(err.message || 'Voice cloning failed.');
    } finally {
      setIsCloning(false);
    }
  };

  const handleStartTraining = async () => {
    const audioData = cloneMode === 'record' ? recordedBlob : uploadedFile;
    if (!audioData) {
      setCloneError('Please record your voice or select an audio file first.');
      return;
    }

    const nameToUse = cloneName.trim() || 'My Trained Voice';
    const epochsToRun = trainingMode === 'deep' ? 100 : 20;

    try {
      setIsTraining(true);
      setCloneError(null);
      setCloneSuccess(null);
      setTrainingEvent({
        stage: 'profiling',
        pct: 5,
        epoch: 0,
        total_epochs: epochsToRun,
        message: 'Initializing multi-stage deep neural training pipeline…',
        speaker_similarity: 60.0,
        formant_alignment: 50.0,
      });

      const jobId = await startVoiceTraining(
        audioData,
        nameToUse,
        cloneGender,
        cloneLangCode,
        epochsToRun,
      );

      const unsubscribe = subscribeVoiceTrainingProgress(
        jobId,
        async (evt) => {
          setTrainingEvent(evt);
          if (evt.stage === 'complete') {
            setIsTraining(false);
            if (evt.voice_record) {
              setLastClonedVoice(evt.voice_record);
              setCloneSuccess(`Neural voice "${evt.voice_record.name}" successfully trained in ${epochsToRun} epochs!`);
              await refreshCustomVoices();
              onSettingsChange({
                voice: evt.voice_record.id,
                langCode: evt.voice_record.langCode,
              });
              setTimeout(() => {
                handlePlayPreview(evt.voice_record!.id);
              }, 600);
            }
          } else if (evt.stage === 'error') {
            setIsTraining(false);
            setCloneError(evt.error || 'Deep neural voice training failed.');
          }
        },
        (err) => {
          setIsTraining(false);
          setCloneError(err.message || 'Training connection interrupted.');
        }
      );
    } catch (err: any) {
      console.error('Training failed:', err);
      setIsTraining(false);
      setCloneError(err.message || 'Could not start training.');
    }
  };

  const handleDeleteVoice = async (voiceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this custom cloned voice?')) return;
    try {
      await deleteCustomVoice(voiceId);
      await refreshCustomVoices();
      if (settings.voice === voiceId) {
        onSettingsChange({ voice: 'af_heart', langCode: 'a' });
      }
    } catch (err) {
      console.error('Failed to delete voice:', err);
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
  const filteredVoices = allVoiceOptions.filter((v) => {
    const matchesSearch =
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.lang.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.id.toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesTab = true;
    if (libraryTab === 'Custom') matchesTab = !!v.isCustom;
    else if (libraryTab === 'Female') matchesTab = v.gender === 'Female';
    else if (libraryTab === 'Male') matchesTab = v.gender === 'Male';

    return matchesSearch && matchesTab;
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
          placeholder="Type or paste your script here… Synthesize speech with Chatterbox TTS or your cloned voice, with tags like [laugh] or [sigh], and WhisperX will align precise word timestamps."
          value={script}
          onChange={(e) => onScriptChange(e.target.value)}
          disabled={disabled}
        />

        {/* Paralinguistic Expression Tags Bar */}
        <div className="paralinguistic-tags-bar">
          <span className="paralinguistic-title">Chatterbox Tags:</span>
          {[
            { tag: '[laugh]', label: '😂 Laugh' },
            { tag: '[chuckle]', label: '😄 Chuckle' },
            { tag: '[sigh]', label: '😮‍💨 Sigh' },
            { tag: '[gasp]', label: '😲 Gasp' },
            { tag: '[whisper]', label: '🤫 Whisper' },
            { tag: '[cough]', label: '😷 Cough' },
            { tag: '[groan]', label: '😩 Groan' },
            { tag: '[snicker]', label: '😏 Snicker' },
            { tag: '[pause:0.5s]', label: '⏱️ Pause 0.5s' },
            { tag: '[pause:1.0s]', label: '⏱️ Pause 1.0s' },
          ].map((t) => (
            <button
              key={t.tag}
              type="button"
              className="paralinguistic-tag-btn"
              onClick={() => handleInsertTag(t.tag)}
              title={`Insert ${t.tag} at cursor`}
              disabled={disabled}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="script-meta">
          <span>{wordCount} words · {charCount} chars</span>
          <span>~{Math.max(1, Math.round(wordCount / 2.5))} sec estimated</span>
        </div>
      </div>

      {/* Voice Selection Section */}
      <div className="setting-group">
        <div className="voice-mode-header">
          <label className="setting-label">
            <Volume2 size={14} className="inline-icon" /> Voice Selection
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
                      { voice: settings.voice || 'default', weight: 60 },
                      { voice: 'chatterbox_michael', weight: 40 },
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
                {customVoices.length > 0 && (
                  <optgroup label="✨ Custom Cloned Voices">
                    {customVoices.map((v) => (
                      <option key={v.id} value={v.id}>
                        ✨ {v.name} ({v.gender} · Cloned)
                      </option>
                    ))}
                  </optgroup>
                )}

                <optgroup label="🇺🇸 American English">
                  {CHATTERBOX_VOICES.filter((v) => v.langCode === 'en').map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.flag} {v.name} ({v.gender})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="🇪🇸 Spanish">
                  {CHATTERBOX_VOICES.filter((v) => v.langCode === 'es').map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.flag} {v.name} ({v.gender})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="🇫🇷 French">
                  {CHATTERBOX_VOICES.filter((v) => v.langCode === 'fr').map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.flag} {v.name} ({v.gender})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="🇩🇪 German">
                  {CHATTERBOX_VOICES.filter((v) => v.langCode === 'de').map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.flag} {v.name} ({v.gender})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="🇮🇹 Italian">
                  {CHATTERBOX_VOICES.filter((v) => v.langCode === 'it').map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.flag} {v.name} ({v.gender})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="🇧🇷 Portuguese">
                  {CHATTERBOX_VOICES.filter((v) => v.langCode === 'pt').map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.flag} {v.name} ({v.gender})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="🇯🇵 Japanese">
                  {CHATTERBOX_VOICES.filter((v) => v.langCode === 'ja').map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.flag} {v.name} ({v.gender})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="🇨🇳 Mandarin Chinese">
                  {CHATTERBOX_VOICES.filter((v) => v.langCode === 'zh').map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.flag} {v.name} ({v.gender})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="🇮🇳 Hindi">
                  {CHATTERBOX_VOICES.filter((v) => v.langCode === 'hi').map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.flag} {v.name} ({v.gender})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="🇸🇦 Arabic">
                  {CHATTERBOX_VOICES.filter((v) => v.langCode === 'ar').map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.flag} {v.name} ({v.gender})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="🇷🇺 Russian">
                  {CHATTERBOX_VOICES.filter((v) => v.langCode === 'ru').map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.flag} {v.name} ({v.gender})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="🇰🇷 Korean">
                  {CHATTERBOX_VOICES.filter((v) => v.langCode === 'ko').map((v) => (
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

            {/* Quick Actions Row: Clone Voice & Browse Library */}
            <div className="voice-quick-actions">
              <button
                type="button"
                className="voice-clone-action-btn"
                onClick={() => setShowCloneStudio(true)}
              >
                <Mic size={13} />
                <span>🎙️ Clone Voice</span>
              </button>

              <button
                type="button"
                className="voice-library-link"
                onClick={() => setShowVoiceLibrary(true)}
              >
                <Search size={13} />
                <span>Audition Voices ({allVoiceOptions.length})</span>
              </button>
            </div>

            {/* Emotion Exaggeration Slider */}
            <div className="speed-control-group" style={{ marginTop: '12px' }}>
              <div className="slider-header">
                <span className="setting-label">Emotion Exaggeration</span>
                <span className="slider-val">{(settings.exaggeration ?? 0.5).toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.5"
                step="0.05"
                value={settings.exaggeration ?? 0.5}
                onChange={(e) => onSettingsChange({ exaggeration: parseFloat(e.target.value) })}
                className="setting-range"
                disabled={disabled}
              />
            </div>
          </div>
        ) : (
          /* MULTI-VOICE BLEND SELECTION */
          <div className="blend-voice-controls">
            <div className="blend-help-banner">
              <Layers size={14} />
              <span>Mix multiple voices (including your cloned voices!) to create a unique custom hybrid timbre.</span>
            </div>

            <div className="blend-list">
              {settings.voiceBlend.map((item, idx) => {
                const voiceObj = allVoiceOptions.find((v) => v.id === item.voice);
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
                className="blend-add-btn"
                onClick={() => setShowCloneStudio(true)}
                disabled={disabled}
              >
                <Mic size={14} />
                Clone New Voice
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

      {/* ------------------------------------------------------------- */}
      {/* VOICEBOX STUDIO AUDIO FX & DELIVERY CONTROLS */}
      {/* ------------------------------------------------------------- */}
      <div className="voicebox-studio-box">
        <div className="voicebox-studio-header" onClick={() => setShowVoiceboxStudio(!showVoiceboxStudio)}>
          <div className="voicebox-studio-title">
            <Wand2 size={15} className="text-accent" />
            <span>Voicebox Studio FX & Delivery</span>
            <span className="voicebox-badge">Voicebox OS</span>
          </div>
          <button type="button" className="voicebox-toggle-btn">
            {showVoiceboxStudio ? 'Hide FX Rack' : 'Open FX Rack'}
          </button>
        </div>

        {showVoiceboxStudio && (
          <div className="voicebox-studio-body">
            {/* Delivery Preset Selector */}
            <div className="setting-group">
              <label className="setting-label">Delivery Style Preset</label>
              <div className="delivery-presets-grid">
                {[
                  { id: 'studio_neutral', label: 'Studio Neutral', icon: '🎙️', desc: 'Clean & transparent' },
                  { id: 'broadcast_warmth', label: 'Broadcast Warmth', icon: '📻', desc: 'Deep proximity warmth' },
                  { id: 'podcast_clarity', label: 'Podcast Crisp', icon: '✨', desc: 'Enhanced air & presence' },
                  { id: 'cinematic_narrator', label: 'Cinematic Narrator', icon: '🎬', desc: 'Deep resonant room' },
                  { id: 'soft_whisper', label: 'Soft Whisper', icon: '🤫', desc: 'Intimate soft delivery' },
                  { id: 'high_energy', label: 'High Energy', icon: '⚡', desc: 'Forward punchy attack' },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`delivery-preset-card ${(settings.dsp?.deliveryPreset || 'studio_neutral') === p.id ? 'active' : ''}`}
                    onClick={() => handleUpdateDsp({ deliveryPreset: p.id as any })}
                  >
                    <span className="preset-card-icon">{p.icon}</span>
                    <span className="preset-card-title">{p.label}</span>
                    <span className="preset-card-desc">{p.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Studio FX Sliders */}
            <div className="voicebox-sliders-grid">
              {/* Vocal Warmth */}
              <div className="voicebox-slider-group">
                <div className="slider-label-row">
                  <span>Vocal Warmth</span>
                  <span className="slider-val">{(settings.dsp?.warmth || 0) > 0 ? `+${settings.dsp?.warmth || 0}` : settings.dsp?.warmth || 0}%</span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  step="5"
                  value={settings.dsp?.warmth || 0}
                  onChange={(e) => handleUpdateDsp({ warmth: parseFloat(e.target.value) })}
                  className="setting-range"
                />
              </div>

              {/* Clarity & Air */}
              <div className="voicebox-slider-group">
                <div className="slider-label-row">
                  <span>Clarity & Air</span>
                  <span className="slider-val">{(settings.dsp?.clarity || 0) > 0 ? `+${settings.dsp?.clarity || 0}` : settings.dsp?.clarity || 0}%</span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  step="5"
                  value={settings.dsp?.clarity || 0}
                  onChange={(e) => handleUpdateDsp({ clarity: parseFloat(e.target.value) })}
                  className="setting-range"
                />
              </div>

              {/* Pitch Transpose */}
              <div className="voicebox-slider-group">
                <div className="slider-label-row">
                  <span>Pitch Shift</span>
                  <span className="slider-val">{(settings.dsp?.pitchShift || 0) > 0 ? `+${settings.dsp?.pitchShift || 0}` : settings.dsp?.pitchShift || 0} st</span>
                </div>
                <input
                  type="range"
                  min="-6"
                  max="6"
                  step="0.5"
                  value={settings.dsp?.pitchShift || 0}
                  onChange={(e) => handleUpdateDsp({ pitchShift: parseFloat(e.target.value) })}
                  className="setting-range"
                />
              </div>

              {/* Studio Reverb */}
              <div className="voicebox-slider-group">
                <div className="slider-label-row">
                  <span>Studio Reverb</span>
                  <span className="slider-val">{settings.dsp?.reverb || 0}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={settings.dsp?.reverb || 0}
                  onChange={(e) => handleUpdateDsp({ reverb: parseFloat(e.target.value) })}
                  className="setting-range"
                />
              </div>
            </div>

            {/* Broadcast Compressor Toggle */}
            <div className="voicebox-toggle-row">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.dsp?.compression ?? false}
                  onChange={(e) => handleUpdateDsp({ compression: e.target.checked })}
                />
                <span>Broadcast Dynamic Compressor & Peak Limiter</span>
              </label>
            </div>
          </div>
        )}
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

      {/* ------------------------------------------------------------- */}
      {/* VOICE CLONING STUDIO MODAL */}
      {/* ------------------------------------------------------------- */}
      {showCloneStudio && (
        <div className="voice-modal-overlay" onClick={() => !isCloning && setShowCloneStudio(false)}>
          <div className="voice-modal-content clone-studio-modal" onClick={(e) => e.stopPropagation()}>
            <div className="voice-modal-header">
              <div className="clone-modal-title-wrap">
                <div className="clone-badge-icon">
                  <Mic size={18} />
                </div>
                <div>
                  <h3 className="voice-modal-title">Voice Cloning Studio</h3>
                  <p className="voice-modal-sub">
                    Record your microphone or upload a 3–15 second audio sample to clone any voice locally.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="voice-modal-close"
                onClick={() => !isCloning && setShowCloneStudio(false)}
                disabled={isCloning}
              >
                <X size={18} />
              </button>
            </div>

            <div className="clone-modal-body">
              {/* Mode Selector */}
              <div className="clone-mode-tabs">
                <button
                  type="button"
                  className={`clone-tab-btn ${cloneMode === 'record' ? 'active' : ''}`}
                  onClick={() => setCloneMode('record')}
                  disabled={isCloning || isRecording}
                >
                  <Mic size={14} />
                  Record Microphone
                </button>
                <button
                  type="button"
                  className={`clone-tab-btn ${cloneMode === 'upload' ? 'active' : ''}`}
                  onClick={() => setCloneMode('upload')}
                  disabled={isCloning || isRecording}
                >
                  <UploadCloud size={14} />
                  Upload Audio File
                </button>
              </div>

              {/* Mode 1: Microphone Recorder */}
              {cloneMode === 'record' ? (
                <div className="recorder-container">
                  {!isRecording && !recordedBlob ? (
                    <div className="record-prompt-card">
                      <div className="mic-pulse-ring idle">
                        <Mic size={32} />
                      </div>
                      <p className="record-instruction">
                        Click <strong>Start Recording</strong> and speak clearly into your microphone for 5 to 10 seconds.
                      </p>
                      <button
                        type="button"
                        className="record-primary-btn"
                        onClick={startRecording}
                        disabled={isCloning}
                      >
                        <Radio size={16} />
                        Start Recording
                      </button>
                    </div>
                  ) : isRecording ? (
                    <div className="record-active-card">
                      <div className="mic-pulse-ring recording">
                        <div className="live-dot" />
                        <Mic size={32} />
                      </div>
                      <div className="record-timer-display">
                        00:{recordSeconds < 10 ? `0${recordSeconds}` : recordSeconds}
                      </div>
                      <p className="record-recording-text">Recording your voice sample…</p>
                      <button
                        type="button"
                        className="record-stop-btn"
                        onClick={stopRecording}
                      >
                        <Square size={16} />
                        Stop Recording
                      </button>
                    </div>
                  ) : (
                    <div className="record-review-card">
                      <div className="record-review-header">
                        <CheckCircle2 size={16} className="text-success" />
                        <span>Voice sample recorded ({recordSeconds} seconds)</span>
                      </div>

                      {recordedAudioUrl && (
                        <audio controls src={recordedAudioUrl} className="review-audio-player" />
                      )}

                      <div className="record-review-actions">
                        {recordedAudioUrl && (
                          <a
                            href={recordedAudioUrl}
                            download={`recorded_voice_sample.${recordedBlob?.type.includes('mp4') ? 'mp4' : recordedBlob?.type.includes('wav') ? 'wav' : 'webm'}`}
                            className="record-download-btn"
                            title="Download this recording directly to your computer"
                          >
                            <Download size={13} />
                            <span>Download Recording</span>
                          </a>
                        )}
                        <button
                          type="button"
                          className="record-again-btn"
                          onClick={startRecording}
                          disabled={isCloning}
                        >
                          <RotateCcw size={13} />
                          <span>Re-record</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Mode 2: Audio File Upload */
                <div className="uploader-container">
                  <label className="file-drop-zone">
                    <input
                      type="file"
                      accept="audio/*,.mp3,.wav,.m4a,.flac,.ogg,.webm"
                      className="hidden-file-input"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setUploadedFile(e.target.files[0]);
                          setCloneError(null);
                        }
                      }}
                      disabled={isCloning}
                    />
                    <FileAudio size={36} className="drop-icon" />
                    <span className="drop-title">
                      {uploadedFile ? uploadedFile.name : 'Click or drag audio sample here'}
                    </span>
                    <span className="drop-sub">Supports MP3, WAV, M4A, FLAC, OGG (3–30 sec)</span>
                  </label>
                  {uploadedFile && (
                    <div className="selected-file-badge">
                      <span>{uploadedFile.name} ({(uploadedFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                      <button
                        type="button"
                        className="clear-file-btn"
                        onClick={() => setUploadedFile(null)}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Voice Metadata Inputs */}
              <div className="clone-form-grid">
                <div className="setting-group">
                  <label className="setting-label">Voice Name</label>
                  <input
                    type="text"
                    placeholder="e.g. My Voice, John (Podcast), Narrator"
                    className="setting-input"
                    value={cloneName}
                    onChange={(e) => setCloneName(e.target.value)}
                    disabled={isCloning}
                  />
                </div>

                <div className="setting-group">
                  <label className="setting-label">Vocal Timbre Profile</label>
                  <select
                    className="setting-select"
                    value={cloneGender}
                    onChange={(e) => setCloneGender(e.target.value as any)}
                    disabled={isCloning}
                  >
                    <option value="auto">Auto-detect from audio</option>
                    <option value="Male">Male Vocal Resonance</option>
                    <option value="Female">Female Vocal Resonance</option>
                  </select>
                </div>

                <div className="setting-group">
                  <label className="setting-label">Language / Accent Base</label>
                  <select
                    className="setting-select"
                    value={cloneLangCode}
                    onChange={(e) => setCloneLangCode(e.target.value)}
                    disabled={isCloning}
                  >
                    <option value="a">🇺🇸 American English</option>
                    <option value="b">🇬🇧 British English</option>
                    <option value="e">🇪🇸 Spanish</option>
                    <option value="f">🇫🇷 French</option>
                    <option value="h">🇮🇳 Hindi</option>
                    <option value="i">🇮🇹 Italian</option>
                    <option value="p">🇧🇷 Portuguese</option>
                    <option value="j">🇯🇵 Japanese</option>
                    <option value="z">🇨🇳 Mandarin Chinese</option>
                  </select>
                </div>
              </div>

              {/* Training Mode Selector */}
              <div className="setting-group">
                <label className="setting-label">Training & Optimization Engine</label>
                <div className="training-mode-grid">
                  <div
                    className={`training-mode-card ${trainingMode === 'deep' ? 'active' : ''}`}
                    onClick={() => !isTraining && !isCloning && setTrainingMode('deep')}
                  >
                    <div className="training-mode-icon-title">
                      <Cpu size={15} className="text-accent" />
                      <span className="training-card-title">🧠 Deep Neural Training (100 Epochs)</span>
                      <span className="training-badge-rec">Recommended</span>
                    </div>
                    <p className="training-card-desc">
                      Multi-stage PyTorch AdamW gradient optimization. Thoroughly studies vocal tract formants (F1–F4), glottal resonance, and 256-D d-vectors for near-perfect speaker likeness.
                    </p>
                  </div>

                  <div
                    className={`training-mode-card ${trainingMode === 'quick' ? 'active' : ''}`}
                    onClick={() => !isTraining && !isCloning && setTrainingMode('quick')}
                  >
                    <div className="training-mode-icon-title">
                      <Zap size={15} className="text-warning" />
                      <span className="training-card-title">⚡ Quick Calibration (20 Epochs)</span>
                    </div>
                    <p className="training-card-desc">
                      Fast 20-epoch acoustic fitting. Suitable for rapid sketches.
                    </p>
                  </div>
                </div>
              </div>

              {/* Live Deep Training Telemetry Dashboard */}
              {isTraining && trainingEvent && (
                <div className="live-training-dashboard">
                  <div className="training-dashboard-header">
                    <div className="training-pulse-dot" />
                    <span className="training-dash-title">
                      {trainingMode === 'deep' ? 'Deep Neural Model Training in Progress' : 'Quick Voice Calibration in Progress'}
                    </span>
                    <span className="training-epoch-badge">
                      Epoch {trainingEvent.epoch || 0} / {trainingEvent.total_epochs || (trainingMode === 'deep' ? 100 : 20)}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="training-progress-container">
                    <div className="training-bar-track">
                      <div
                        className="training-bar-fill"
                        style={{ width: `${trainingEvent.pct}%` }}
                      />
                    </div>
                    <div className="training-pct-text">{trainingEvent.pct}% Complete</div>
                  </div>

                  {/* Telemetry Metrics Grid */}
                  <div className="telemetry-metrics-grid">
                    <div className="telemetry-card">
                      <div className="telemetry-label">
                        <Activity size={12} />
                        <span>Speaker Similarity</span>
                      </div>
                      <div className="telemetry-value text-accent">
                        {trainingEvent.speaker_similarity?.toFixed(1) || '60.0'}%
                      </div>
                    </div>

                    <div className="telemetry-card">
                      <div className="telemetry-label">
                        <Gauge size={12} />
                        <span>Formant Alignment</span>
                      </div>
                      <div className="telemetry-value text-success">
                        {trainingEvent.formant_alignment?.toFixed(1) || '50.0'}%
                      </div>
                    </div>

                    <div className="telemetry-card">
                      <div className="telemetry-label">
                        <Cpu size={12} />
                        <span>Optimization Loss</span>
                      </div>
                      <div className="telemetry-value text-warning">
                        {trainingEvent.loss !== undefined ? trainingEvent.loss.toFixed(4) : '0.0000'}
                      </div>
                    </div>
                  </div>

                  <p className="training-status-msg">
                    <Loader2 size={12} className="spin" />
                    <span>{trainingEvent.message || 'Optimizing latent style tensor…'}</span>
                  </p>
                </div>
              )}

              {/* Feedback messages */}
              {cloneError && (
                <div className="clone-alert error">
                  <AlertCircle size={15} />
                  <span>{cloneError}</span>
                </div>
              )}

              {cloneSuccess && (
                <div className="clone-alert success">
                  <CheckCircle2 size={15} />
                  <span>{cloneSuccess}</span>
                </div>
              )}

              {/* Acoustic Analysis & Manifold Fitting Insights Card */}
              {lastClonedVoice && (
                <div className="clone-analysis-card">
                  <div className="analysis-card-header">
                    <Sparkles size={14} className="text-accent" />
                    <span className="analysis-title">
                      {lastClonedVoice.training_epochs ? `🧠 ${lastClonedVoice.training_epochs}-Epoch Deep Trained Voice Profile` : 'SV2TTS Neural Manifold Fitting Results'}
                    </span>
                  </div>
                  <div className="analysis-grid">
                    <div className="analysis-item">
                      <span className="analysis-label">Speaker Similarity</span>
                      <span className="analysis-val text-accent">
                        {lastClonedVoice.speaker_similarity ? `${lastClonedVoice.speaker_similarity}% Match` : 'High'}
                      </span>
                    </div>
                    <div className="analysis-item">
                      <span className="analysis-label">Median Pitch (F0)</span>
                      <span className="analysis-val">{lastClonedVoice.median_pitch ? `${lastClonedVoice.median_pitch} Hz` : 'Calculated'}</span>
                    </div>
                    <div className="analysis-item">
                      <span className="analysis-label">Neural Embedding</span>
                      <span className="analysis-val">256-D d-Vector</span>
                    </div>
                    <div className="analysis-item">
                      <span className="analysis-label">Formant Alignment</span>
                      <span className="analysis-val text-success">
                        {lastClonedVoice.formant_alignment ? `${lastClonedVoice.formant_alignment}%` : 'Optimal'}
                      </span>
                    </div>
                    <div className="analysis-item full-width">
                      <span className="analysis-label">Vocal Tract Formants</span>
                      <span className="analysis-val">
                        F1: {lastClonedVoice.f1 || 550} Hz · F2: {lastClonedVoice.f2 || 1600} Hz · F3: {lastClonedVoice.f3 || 2650} Hz
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="voice-modal-footer">
              <button
                type="button"
                className="script-btn-secondary"
                onClick={() => setShowCloneStudio(false)}
                disabled={isCloning || isTraining}
              >
                Cancel
              </button>

              <button
                type="button"
                className="clone-submit-btn"
                onClick={handleStartTraining}
                disabled={isCloning || isTraining || (cloneMode === 'record' ? !recordedBlob : !uploadedFile)}
              >
                {isTraining || isCloning ? (
                  <>
                    <Loader2 size={15} className="spin" />
                    <span>Training Neural Voice Model ({trainingEvent?.pct || 0}%)…</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={15} />
                    <span>{trainingMode === 'deep' ? 'Start Deep Neural Training (100 Epochs)' : 'Start Quick Calibration'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* VOICE LIBRARY MODAL / BROWSER */}
      {/* ------------------------------------------------------------- */}
      {showVoiceLibrary && (
        <div className="voice-modal-overlay" onClick={() => setShowVoiceLibrary(false)}>
          <div className="voice-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="voice-modal-header">
              <div>
                <h3 className="voice-modal-title">Voice Library</h3>
                <p className="voice-modal-sub">
                  Audition Chatterbox and custom cloned voices, or add them to your multi-voice mix.
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
                {(['All', 'Custom', 'Female', 'Male'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={`gender-filter-btn ${libraryTab === tab ? 'active' : ''}`}
                    onClick={() => setLibraryTab(tab)}
                  >
                    {tab === 'Custom' ? `✨ Cloned (${customVoices.length})` : tab}
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
                    className={`voice-card ${isSelectedSingle || isSelectedBlend ? 'selected' : ''} ${v.isCustom ? 'custom-voice-card' : ''}`}
                  >
                    <div className="voice-card-top">
                      <span className="voice-card-flag">{v.flag}</span>
                      <div className="voice-card-info">
                        <div className="voice-card-name-row">
                          <span className="voice-card-name">{v.name}</span>
                          {v.isCustom && (
                            <>
                              <span className="custom-voice-pill">Cloned</span>
                              <span className="custom-voice-pill sv2tts-pill">SV2TTS</span>
                            </>
                          )}
                        </div>
                        <span className="voice-card-meta">
                          {v.lang} · {v.gender}
                          {v.isCustom && customVoices.find((cv) => cv.id === v.id)?.median_pitch
                            ? ` · ${customVoices.find((cv) => cv.id === v.id)?.median_pitch} Hz`
                            : ''}
                        </span>
                      </div>
                      {v.isCustom && (
                        <div className="voice-card-top-actions">
                          <a
                            href={getCustomVoiceSampleUrl(v.id)}
                            download={`${v.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_sample.wav`}
                            className="voice-card-download-btn"
                            title="Download reference audio sample (.wav)"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Download size={13} />
                          </a>
                          <button
                            type="button"
                            className="voice-card-delete-btn"
                            onClick={(e) => handleDeleteVoice(v.id, e)}
                            title="Delete this custom voice"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
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
                        <span>{isCurrentPlaying ? 'Playing' : 'Preview'}</span>
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
              <button
                type="button"
                className="voice-clone-footer-btn"
                onClick={() => {
                  setShowVoiceLibrary(false);
                  setShowCloneStudio(true);
                }}
              >
                <Mic size={14} />
                <span>Clone New Voice</span>
              </button>

              <div className="footer-right-actions">
                <span className="voice-count-text">{filteredVoices.length} voices found</span>
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
        </div>
      )}
    </div>
  );
}
