import React, { useRef, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import {
  togglePlayback,
  setVolume,
  setPlaybackRate,
  setCurrentAudioIndex,
} from '../../store/slices/ttsSlice';
import {
  Box,
  IconButton,
  Slider,
  Typography,
  Tooltip,
  Stack,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  SkipNext,
  SkipPrevious,
  VolumeUp,
  Speed,
} from '@mui/icons-material';

interface AudioPlayerProps {
  className?: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ className }) => {
  const dispatch = useAppDispatch();
  const audioRef = useRef<HTMLAudioElement>(null);
  const {
    audioUrls,
    isPlaying,
    currentAudioIndex,
    volume,
    playbackRate,
  } = useAppSelector((state) => state.tts);

  const currentAudio = audioUrls[currentAudioIndex];

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.playbackRate = playbackRate;
    }
  }, [volume, playbackRate]);

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(console.error);
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, currentAudio]);

  const handlePlayPause = () => {
    dispatch(togglePlayback());
  };

  const handleVolumeChange = (_: Event, newValue: number | number[]) => {
    dispatch(setVolume(newValue as number));
  };

  const handlePlaybackRateChange = (_: Event, newValue: number | number[]) => {
    dispatch(setPlaybackRate(newValue as number));
  };

  const handlePrevious = () => {
    if (currentAudioIndex > 0) {
      dispatch(setCurrentAudioIndex(currentAudioIndex - 1));
    }
  };

  const handleNext = () => {
    if (currentAudioIndex < audioUrls.length - 1) {
      dispatch(setCurrentAudioIndex(currentAudioIndex + 1));
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const progress = (audioRef.current.currentTime / audioRef.current.duration) * 100;
      // Update progress in the store if needed
    }
  };

  const handleEnded = () => {
    if (currentAudioIndex < audioUrls.length - 1) {
      dispatch(setCurrentAudioIndex(currentAudioIndex + 1));
    } else {
      dispatch(togglePlayback());
    }
  };

  if (!currentAudio) return null;

  return (
    <Box
      className={className}
      sx={{
        backgroundColor: 'background.paper',
        borderRadius: 2,
        p: 2,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
      }}
    >
      <audio
        ref={audioRef}
        src={currentAudio}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
      />
      
      <Stack spacing={2}>
        {/* Playback Controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          <IconButton
            onClick={handlePrevious}
            disabled={currentAudioIndex === 0}
            size="large"
          >
            <SkipPrevious />
          </IconButton>
          
          <IconButton
            onClick={handlePlayPause}
            size="large"
            sx={{
              backgroundColor: 'primary.main',
              color: 'primary.contrastText',
              '&:hover': {
                backgroundColor: 'primary.dark',
              },
            }}
          >
            {isPlaying ? <Pause /> : <PlayArrow />}
          </IconButton>
          
          <IconButton
            onClick={handleNext}
            disabled={currentAudioIndex === audioUrls.length - 1}
            size="large"
          >
            <SkipNext />
          </IconButton>
        </Box>

        {/* Volume Control */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <VolumeUp color="action" />
          <Slider
            value={volume}
            onChange={handleVolumeChange}
            min={0}
            max={1}
            step={0.01}
            sx={{ width: 100 }}
          />
        </Box>

        {/* Playback Rate Control */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Tooltip title="Playback Speed">
            <Speed color="action" />
          </Tooltip>
          <Slider
            value={playbackRate}
            onChange={handlePlaybackRateChange}
            min={0.5}
            max={2}
            step={0.1}
            sx={{ width: 100 }}
          />
          <Typography variant="body2" color="text.secondary">
            {playbackRate}x
          </Typography>
        </Box>

        {/* Track Progress */}
        <Box sx={{ width: '100%' }}>
          <Slider
            value={audioRef.current?.currentTime || 0}
            max={audioRef.current?.duration || 100}
            sx={{
              '& .MuiSlider-thumb': {
                width: 12,
                height: 12,
                transition: '0.3s cubic-bezier(.47,1.64,.41,.8)',
                '&:before': {
                  boxShadow: '0 2px 12px 0 rgba(0,0,0,0.4)',
                },
                '&:hover, &.Mui-focusVisible': {
                  boxShadow: '0px 0px 0px 8px rgb(0 0 0 / 16%)',
                },
                '&.Mui-active': {
                  width: 20,
                  height: 20,
                },
              },
            }}
          />
        </Box>
      </Stack>
    </Box>
  );
}; 