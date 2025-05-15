import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Music, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card } from '@/components/ui/card';

interface Chapter {
  id: number;
  title: string;
  audioUrl: string;
  duration: number; // in seconds
}

interface GlobalAudioPlayerProps {
  chapters: Chapter[];
}

const GlobalAudioPlayer: React.FC<GlobalAudioPlayerProps> = ({ chapters }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [volume, setVolume] = useState(80);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Get current chapter
  const currentChapter = chapters[currentChapterIndex] || null;

  // Effect to load and set up the audio element when the current chapter changes
  useEffect(() => {
    if (!currentChapter) return;
    
    // Function declarations for event handlers
    const handleTimeUpdate = (event: Event) => {
      const audio = event.target as HTMLAudioElement;
      if (audio) setCurrentTime(audio.currentTime);
    };
    
    const handleLoadedData = () => {
      setIsLoading(false);
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
      audioRef.current.removeEventListener('ended', handleEnded);
    }
    
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
    audio.addEventListener('ended', handleEnded);
    
    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadeddata', handleLoadedData);
      audio.removeEventListener('ended', handleEnded);
    };
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
      setCurrentChapterIndex(prevIndex => prevIndex - 1);
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
      setCurrentChapterIndex(prevIndex => prevIndex + 1);
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
            max={currentChapter?.duration || 100}
            step={0.1}
            onValueChange={handleSeek}
            disabled={isLoading || !currentChapter}
            className="h-1.5"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(currentChapter?.duration || 0)}</span>
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
              disabled={isLoading || chapters.length <= 1}
            >
              <SkipBack className="h-4 w-4" />
            </Button>
            
            <Button
              variant="default"
              size="icon"
              className="bg-primary hover:bg-primary/90 text-white rounded-full w-10 h-10 flex items-center justify-center"
              onClick={togglePlayback}
              disabled={isLoading || !currentChapter}
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
              disabled={isLoading || currentChapterIndex >= chapters.length - 1}
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