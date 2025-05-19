import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Music, Volume2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Chapter {
  id: number;
  title: string;
  audioUrl: string;
  duration: number; // in seconds
  size?: number; // in bytes
}

interface GlobalAudioPlayerProps {
  chapters: Chapter[];
  currentChapterIndex?: number;
  onChapterChange?: (index: number) => void;
}

const GlobalAudioPlayer: React.FC<GlobalAudioPlayerProps> = ({ 
  chapters, 
  currentChapterIndex: externalChapterIndex,
  onChapterChange 
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [internalChapterIndex, setInternalChapterIndex] = useState(0);
  const [volume, setVolume] = useState(80);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [emptyAudioFile, setEmptyAudioFile] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Use external chapter index if provided, otherwise use internal state
  const currentChapterIndex = externalChapterIndex !== undefined ? externalChapterIndex : internalChapterIndex;
  
  // Function to update chapter index that respects external control
  const updateChapterIndex = (index: number) => {
    if (onChapterChange) {
      onChapterChange(index);
    } else {
      setInternalChapterIndex(index);
    }
  };

  // Get current chapter
  const currentChapter = chapters[currentChapterIndex] || null;
  
  // State to track the accurate duration after Web Audio API processing
  const [accurateDuration, setAccurateDuration] = useState<number | null>(null);

  // Effect to load and set up the audio element when the current chapter changes
  useEffect(() => {
    if (!currentChapter) return;
    
    // Reset error states when changing chapters
    setErrorMessage(null);
    setEmptyAudioFile(false);
    
    // Check if this is an empty audio file (size 0 bytes)
    if (currentChapter.size !== undefined && currentChapter.size === 0) {
      setEmptyAudioFile(true);
      setIsLoading(false);
      setErrorMessage("This audio file is empty. It may have failed to generate due to API limitations.");
      return; // Don't try to load the audio if we know it's empty
    }
    
    // Function to get accurate duration using Web Audio API
    const getAccurateDuration = async (audioUrl: string): Promise<number> => {
      try {
        // Create audio context
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) {
          console.warn('Web Audio API not supported in this browser');
          return 0;
        }
        
        const audioContext = new AudioContext();
        
        // Fetch the audio file
        const response = await fetch(audioUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
        }
        
        // Get the audio data as ArrayBuffer
        const arrayBuffer = await response.arrayBuffer();
        
        // Decode the audio data
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        // Return the actual duration in seconds
        return audioBuffer.duration;
      } catch (error) {
        console.error('Error getting accurate duration:', error);
        return 0;
      }
    };
    
    // Function declarations for event handlers
    const handleTimeUpdate = (event: Event) => {
      const audio = event.target as HTMLAudioElement;
      if (audio) setCurrentTime(audio.currentTime);
    };
    
    const handleLoadedData = async () => {
      setIsLoading(false);
      
      // If the duration is 0, it's likely an empty or corrupted file
      if (audioRef.current && audioRef.current.duration === 0) {
        setEmptyAudioFile(true);
        setErrorMessage("Audio file appears to be empty or corrupted.");
        return;
      }
      
      // Get accurate duration using Web Audio API
      try {
        const accurateDuration = await getAccurateDuration(currentChapter.audioUrl);
        if (accurateDuration > 0) {
          // Update accurate duration state
          setAccurateDuration(accurateDuration);
          
          // Update chapter duration in state if different from the server estimate
          if (Math.abs(currentChapter.duration - accurateDuration) > 5) {
            console.log(`Correcting audio duration from ${currentChapter.duration}s to ${accurateDuration.toFixed(2)}s`);
            // Create a copy of the current chapter with the updated duration
            const updatedChapter = {
              ...currentChapter,
              duration: accurateDuration
            };
            
            // Update the chapter in the array
            const updatedChapters = [...chapters];
            updatedChapters[currentChapterIndex] = updatedChapter;
            
            // Here we would ideally update the parent component with the accurate chapters
            // Since we don't have a prop for this, we'll use the local state
          }
        }
      } catch (err) {
        console.warn('Could not get accurate duration, using estimate:', err);
      }
    };
    
    const handleLoadError = (error: Event) => {
      console.error('Error loading audio file:', error);
      setIsLoading(false);
      setErrorMessage("Failed to load audio file. The file may be missing or corrupted.");
    };
    
    const handleEnded = () => {
      // Auto-advance to next chapter if available
      if (currentChapterIndex < chapters.length - 1) {
        setCurrentChapterIndex(prevIndex => prevIndex + 1);
      } else {
        setIsPlaying(false);
        setCurrentTime(0);
      }
    };
    
    // Clean up any existing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeEventListener('timeupdate', handleTimeUpdate);
      audioRef.current.removeEventListener('loadeddata', handleLoadedData);
      audioRef.current.removeEventListener('error', handleLoadError);
      audioRef.current.removeEventListener('ended', handleEnded);
    }
    
    try {
      // Create new audio element
      audioRef.current = new Audio(currentChapter.audioUrl);
      const audio = audioRef.current;
      
      // Set volume
      audio.volume = volume / 100;
      
      // Initialize state
      setIsLoading(true);
      setCurrentTime(0);
      setIsPlaying(false);
      
      // Add event listeners
      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('loadeddata', handleLoadedData);
      audio.addEventListener('error', handleLoadError);
      audio.addEventListener('ended', handleEnded);
      
      return () => {
        audio.pause();
        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('loadeddata', handleLoadedData);
        audio.removeEventListener('error', handleLoadError);
        audio.removeEventListener('ended', handleEnded);
      };
    } catch (err) {
      console.error('Error creating audio element:', err);
      setIsLoading(false);
      setErrorMessage("Failed to create audio player. Please check console for details.");
      return undefined;
    }
  }, [currentChapter, currentChapterIndex, chapters.length, volume]);

  // Toggle play/pause
  const togglePlayback = () => {
    if (!audioRef.current || !currentChapter) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    
    setIsPlaying(!isPlaying);
  };

  // Handle seeking
  const handleSeek = (value: number[]) => {
    if (!audioRef.current) return;
    
    const newTime = value[0];
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Handle volume change
  const handleVolumeChange = (value: number[]) => {
    if (!audioRef.current) return;
    
    const newVolume = value[0];
    audioRef.current.volume = newVolume / 100;
    setVolume(newVolume);
  };

  // Play previous chapter
  const playPreviousChapter = () => {
    if (currentChapterIndex > 0) {
      updateChapterIndex(currentChapterIndex - 1);
    } else {
      // If at first chapter, restart current chapter
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        setCurrentTime(0);
      }
    }
  };

  // Play next chapter
  const playNextChapter = () => {
    if (currentChapterIndex < chapters.length - 1) {
      updateChapterIndex(currentChapterIndex + 1);
    }
  };

  // Format time (seconds) to mm:ss
  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  // If no chapters available, render a placeholder
  if (chapters.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500">
        <Music className="mx-auto h-8 w-8 mb-2 text-gray-300" />
        <p>No audio content available</p>
      </div>
    );
  }

  return (
    <Card className="audio-player p-4 bg-gradient-to-r from-indigo-50 to-sky-50 border-indigo-100">
      <div className="flex flex-col space-y-3">
        {/* Error message display */}
        {errorMessage && (
          <Alert variant="destructive" className="mb-2">
            <AlertCircle className="h-4 w-4 mr-2" />
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}
        
        {/* Empty audio file warning */}
        {emptyAudioFile && !errorMessage && (
          <Alert variant="warning" className="mb-2 bg-amber-50 border-amber-200">
            <AlertCircle className="h-4 w-4 mr-2 text-amber-500" />
            <AlertDescription>
              This audio file is empty due to API quota limitations. Please check your ElevenLabs API key and quota.
            </AlertDescription>
          </Alert>
        )}
        
        {/* Chapter title and navigation */}
        <div className="flex items-center justify-between">
          <div className="flex-1 overflow-hidden">
            <h3 className="text-sm font-medium text-gray-800 truncate">
              {currentChapter ? currentChapter.title : 'No chapter selected'}
            </h3>
            <p className="text-xs text-gray-500">
              Chapter {currentChapterIndex + 1} of {chapters.length}
            </p>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="w-full">
          <Slider
            value={[currentTime]}
            min={0}
            max={accurateDuration || currentChapter?.duration || 100}
            step={0.1}
            onValueChange={handleSeek}
            disabled={isLoading || !currentChapter || emptyAudioFile || !!errorMessage}
            className="h-1.5"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>
              {accurateDuration 
                ? formatTime(accurateDuration) 
                : formatTime(currentChapter?.duration || 0)}
              {accurateDuration && currentChapter && Math.abs(currentChapter.duration - accurateDuration) > 10 && (
                <span className="text-amber-500 ml-1">(corrected)</span>
              )}
            </span>
          </div>
        </div>
        
        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="icon"
              className="text-gray-600 hover:text-primary hover:bg-primary/10 rounded-full w-8 h-8"
              onClick={playPreviousChapter}
              disabled={isLoading || chapters.length <= 1 || emptyAudioFile || !!errorMessage}
            >
              <SkipBack className="h-4 w-4" />
            </Button>
            
            <Button
              variant="default"
              size="icon"
              className="bg-primary hover:bg-primary/90 text-white rounded-full w-10 h-10 flex items-center justify-center"
              onClick={togglePlayback}
              disabled={isLoading || !currentChapter || emptyAudioFile || !!errorMessage}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5" />
              )}
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              className="text-gray-600 hover:text-primary hover:bg-primary/10 rounded-full w-8 h-8"
              onClick={playNextChapter}
              disabled={isLoading || currentChapterIndex >= chapters.length - 1 || emptyAudioFile || !!errorMessage}
            >
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex items-center space-x-2 w-24">
            <Volume2 className="h-4 w-4 text-gray-500" />
            <Slider
              value={[volume]}
              min={0}
              max={100}
              step={1}
              onValueChange={handleVolumeChange}
              className="h-1"
            />
          </div>
        </div>
      </div>
    </Card>
  );
};

export default GlobalAudioPlayer;