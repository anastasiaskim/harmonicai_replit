import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface TTSState {
  isProcessing: boolean;
  audioUrls: string[];
  error: string | null;
  progress: number;
  selectedVoice: string;
  playbackRate: number;
  volume: number;
  isPlaying: boolean;
  currentAudioIndex: number;
  recentConversions: {
    id: string;
    text: string;
    audioUrl: string;
    timestamp: number;
  }[];
  settings: {
    autoPlay: boolean;
    saveHistory: boolean;
    highQuality: boolean;
  };
}

const initialState: TTSState = {
  isProcessing: false,
  audioUrls: [],
  error: null,
  progress: 0,
  selectedVoice: 'default',
  playbackRate: 1,
  volume: 1,
  isPlaying: false,
  currentAudioIndex: 0,
  recentConversions: [],
  settings: {
    autoPlay: true,
    saveHistory: true,
    highQuality: true,
  },
};

const ttsSlice = createSlice({
  name: 'tts',
  initialState,
  reducers: {
    startProcessing: (state) => {
      state.isProcessing = true;
      state.error = null;
      state.progress = 0;
    },
    setProgress: (state, action: PayloadAction<number>) => {
      state.progress = action.payload;
    },
    setAudioUrls: (state, action: PayloadAction<{ urls: string[]; text: string }>) => {
      state.audioUrls = action.payload.urls;
      state.isProcessing = false;
      state.progress = 100;
      
      // Add to recent conversions if enabled
      if (state.settings.saveHistory) {
        state.recentConversions.unshift({
          id: Date.now().toString(),
          text: action.payload.text,
          audioUrl: action.payload.urls[0],
          timestamp: Date.now(),
        });
        
        // Keep only the last 10 conversions
        if (state.recentConversions.length > 10) {
          state.recentConversions.pop();
        }
      }
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.isProcessing = false;
    },
    setVoice: (state, action: PayloadAction<string>) => {
      state.selectedVoice = action.payload;
    },
    setPlaybackRate: (state, action: PayloadAction<number>) => {
      state.playbackRate = action.payload;
    },
    setVolume: (state, action: PayloadAction<number>) => {
      state.volume = action.payload;
    },
    togglePlayback: (state) => {
      state.isPlaying = !state.isPlaying;
    },
    setCurrentAudioIndex: (state, action: PayloadAction<number>) => {
      state.currentAudioIndex = action.payload;
    },
    updateSettings: (state, action: PayloadAction<Partial<TTSState['settings']>>) => {
      state.settings = { ...state.settings, ...action.payload };
    },
    clearHistory: (state) => {
      state.recentConversions = [];
    },
    reset: (state) => {
      state.isProcessing = false;
      state.audioUrls = [];
      state.error = null;
      state.progress = 0;
      state.isPlaying = false;
      state.currentAudioIndex = 0;
    },
  },
});

export const {
  startProcessing,
  setProgress,
  setAudioUrls,
  setError,
  setVoice,
  setPlaybackRate,
  setVolume,
  togglePlayback,
  setCurrentAudioIndex,
  updateSettings,
  clearHistory,
  reset,
} = ttsSlice.actions;

export default ttsSlice.reducer; 