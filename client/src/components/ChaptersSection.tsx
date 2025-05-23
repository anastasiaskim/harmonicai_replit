import React, { useState, useRef } from 'react';
import { BookOpen, Download, Play, Clock, Music, FileAudio, AlertTriangle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import GlobalAudioPlayer from './GlobalAudioPlayer';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";

interface Chapter {
  id: number;
  title: string;
  audioUrl: string;
  duration: number; // in seconds
  size: number; // in bytes
}

interface ChaptersSectionProps {
  chapters: Chapter[];
  chapterProgress?: { status: string; percent: number; error?: string }[];
}

const ChaptersSection: React.FC<ChaptersSectionProps> = ({ chapters, chapterProgress = [] }) => {
  const [selectedChapterIndex, setSelectedChapterIndex] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const globalPlayerRef = useRef<HTMLDivElement>(null);

  // Maintain chapter durations in state
  const [chapterDurations, setChapterDurations] = React.useState<number[]>(
    chapters.map((ch) => ch.duration)
  );

  // Update durations if chapters prop changes (e.g., new book loaded)
  React.useEffect(() => {
    setChapterDurations(chapters.map((ch) => ch.duration));
  }, [chapters]);

  // Handler to update duration from GlobalAudioPlayer
  const handleDurationUpdate = (chapterIndex: number, duration: number) => {
    setChapterDurations((prev) => {
      if (prev[chapterIndex] === duration) return prev;
      const updated = [...prev];
      updated[chapterIndex] = duration;
      return updated;
    });
  };

  // Calculate overall progress
  const overallProgress = React.useMemo(() => {
    if (!chapterProgress.length) return 0;
    const totalProgress = chapterProgress.reduce((sum, progress) => sum + progress.percent, 0);
    return Math.round(totalProgress / chapterProgress.length);
  }, [chapterProgress]);

  // Calculate overall status
  const overallStatus = React.useMemo(() => {
    if (!chapterProgress.length) return 'idle';
    if (chapterProgress.some(p => p.status === 'failed')) return 'failed';
    if (chapterProgress.some(p => p.status === 'processing')) return 'processing';
    if (chapterProgress.every(p => p.status === 'ready')) return 'ready';
    return 'idle';
  }, [chapterProgress]);

  // Function to format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Function to format duration
  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };

  // Calculate total duration using updated durations
  const totalDuration = chapterDurations.reduce((sum, d) => sum + d, 0);
  const totalDurationFormatted = formatDuration(totalDuration);

  // Calculate total size
  const totalSize = chapters.reduce((sum, chapter) => sum + chapter.size, 0);

  // Function to fetch audio file as blob
  const fetchAudioBlob = async (url: string): Promise<Blob | null> => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch ${url}`);
      return await response.blob();
    } catch (error) {
      console.error('Error fetching audio file:', error);
      return null;
    }
  };

  // Function to handle download all chapters as a zip file
  const handleDownloadAll = async () => {
    try {
      setIsDownloading(true);
      
      // Create a new JSZip instance
      const zip = new JSZip();
      
      // Add each chapter audio to the zip
      const downloadPromises = chapters.map(async (chapter, index) => {
        const blob = await fetchAudioBlob(chapter.audioUrl);
        if (!blob) return;
        
        // Format chapter number with leading zeros
        const chapterNumber = String(index + 1).padStart(2, '0');
        const fileName = `${chapterNumber}_${chapter.title.replace(/[^\w\s-]/gi, '_').toLowerCase()}.mp3`;
        
        // Add the blob to the zip
        zip.file(fileName, blob);
      });
      
      // Wait for all downloads to complete
      await Promise.all(downloadPromises);
      
      // Generate the zip file
      const content = await zip.generateAsync({ type: 'blob' });
      
      // Save the zip file
      saveAs(content, 'audiobook_chapters.zip');
    } catch (error) {
      console.error('Error creating zip file:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  // Function to play a specific chapter
  const playChapter = (index: number) => {
    setSelectedChapterIndex(index);
    
    // Scroll to the player component when a chapter is selected
    if (globalPlayerRef.current) {
      globalPlayerRef.current.scrollIntoView({ behavior: 'smooth' });
    }
    
    // Find any audio elements on the page and pause them
    const audioElements = document.querySelectorAll('audio');
    audioElements.forEach(audio => audio.pause());
    
    // Wait a short time for animations to complete
    setTimeout(() => {
      // Find the play button in the global player and click it
      const playButton = globalPlayerRef.current?.querySelector('button[aria-label="Play"]');
      if (playButton instanceof HTMLButtonElement) {
        playButton.click();
      }
    }, 100);
  };

  // Get status badge color and icon
  const getStatusBadgeProps = (status: string) => {
    switch (status) {
      case 'processing':
        return {
          className: 'bg-blue-100 text-blue-700',
          icon: <span className="animate-spin inline-block h-3 w-3 border-2 border-blue-400 border-t-transparent rounded-full mr-1"></span>,
          text: 'Processing'
        };
      case 'ready':
        return {
          className: 'bg-green-100 text-green-700',
          icon: null,
          text: 'Ready'
        };
      case 'failed':
        return {
          className: 'bg-red-100 text-red-700',
          icon: <AlertTriangle className="h-3 w-3 mr-1" />,
          text: 'Failed'
        };
      default:
        return {
          className: 'bg-gray-100 text-gray-700',
          icon: null,
          text: 'Pending'
        };
    }
  };

  return (
    <section>
      <h2 className="font-bold text-xl text-gray-800 mb-4 flex items-center">
        <BookOpen className="h-5 w-5 text-primary mr-2" />
        Your Audiobook Chapters
      </h2>
      
      {/* Overall Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">Overall Progress</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-gray-400" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Progress across all chapters</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <span className="text-sm text-gray-600">{overallProgress}%</span>
        </div>
        <Progress value={overallProgress} className="h-2" />
        <div className="mt-1 text-xs text-gray-500">
          {overallStatus === 'processing' && 'Processing chapters...'}
          {overallStatus === 'ready' && 'All chapters ready'}
          {overallStatus === 'failed' && 'Some chapters failed to process'}
          {overallStatus === 'idle' && 'Waiting to start...'}
        </div>
      </div>
      
      {/* Global Audio Player */}
      <div className="mb-6" ref={globalPlayerRef}>
        <GlobalAudioPlayer 
          chapters={chapters.map((ch, i) => ({ ...ch, duration: chapterDurations[i] }))}
          currentChapterIndex={selectedChapterIndex}
          onChapterChange={setSelectedChapterIndex}
          onDurationUpdate={handleDurationUpdate}
        />
        {chapters.length > 0 && chapters[0].size === 0 && (
          <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-700">
            <div className="flex space-x-2">
              <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
              <div>
                <p className="font-medium">Audio generation issues</p>
                <p>The audio files couldn't be generated due to ElevenLabs API limitations. Please check your API key.</p>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Audiobook stats */}
      {chapters.length > 0 && (
        <div className="flex items-center justify-between mb-4 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
          <div className="flex items-center">
            <Music className="h-4 w-4 mr-1.5 text-gray-500" />
            <span>{chapters.length} chapter{chapters.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center">
            <Clock className="h-4 w-4 mr-1.5 text-gray-500" />
            <span>Total: {totalDurationFormatted}</span>
          </div>
          <div className="flex items-center">
            <FileAudio className="h-4 w-4 mr-1.5 text-gray-500" />
            <span>{formatFileSize(totalSize)}</span>
          </div>
        </div>
      )}
      
      {/* Chapter list with scrolling */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin' }}>
        {chapters.map((chapter, index) => {
          const chapterStatus = chapterProgress[index]?.status || 'idle';
          const statusProps = getStatusBadgeProps(chapterStatus);
          const isChapterReady = chapterStatus === 'ready';
          
          return (
            <div 
              key={chapter.id} 
              className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:border-primary/30 transition-colors duration-200"
            >
              <div className="p-3">
                <div className="flex justify-between items-center">
                  <h3 className="font-medium text-gray-800 truncate flex-1">{chapter.title}</h3>
                  {/* Per-chapter status badge with tooltip */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <span className={`ml-2 text-xs px-2 py-1 rounded-full font-semibold flex items-center ${statusProps.className}`}>
                          {statusProps.icon}
                          {statusProps.text}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {chapterProgress[index]?.error ? (
                          <p className="text-red-600">{chapterProgress[index].error}</p>
                        ) : (
                          <p>{statusProps.text}</p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`text-primary hover:text-primary-dark hover:bg-primary/10 h-8 mr-1 transition-all duration-200 ${
                      !isChapterReady ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    onClick={() => isChapterReady && playChapter(index)}
                    disabled={!isChapterReady}
                  >
                    <Play className="h-4 w-4 mr-1" />
                    Play
                  </Button>
                </div>
                {/* Per-chapter progress bar */}
                {chapterProgress[index] && chapterProgress[index].status === 'processing' && (
                  <div className="w-full bg-gray-100 rounded h-2 mt-2">
                    <div
                      className="bg-blue-400 h-2 rounded transition-all duration-300"
                      style={{ width: `${chapterProgress[index].percent}%` }}
                    ></div>
                  </div>
                )}
                {/* Error message if failed */}
                {chapterProgress[index] && chapterProgress[index].status === 'failed' && chapterProgress[index].error && (
                  <div className="text-xs text-red-600 mt-1">{chapterProgress[index].error}</div>
                )}
                <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
                  <div className="flex items-center">
                    <Clock className="h-3.5 w-3.5 mr-1 text-gray-400" />
                    {formatDuration(chapterDurations[index])}
                  </div>
                  <div className="flex items-center">
                    <span className="mr-1">Size:</span>
                    {formatFileSize(chapter.size)}
                  </div>
                  <a 
                    href={isChapterReady ? chapter.audioUrl : undefined}
                    download={isChapterReady ? `${chapter.title ? chapter.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'audio'}.mp3` : undefined}
                    className={`text-teal-600 hover:text-teal-700 flex items-center transition-all duration-200 ${
                      !isChapterReady ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
                    }`}
                  >
                    <Download className="h-3.5 w-3.5 mr-1" />
                    Download
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Download all button */}
      <div className="mt-4 flex justify-end">
        <Button
          variant="outline"
          size="sm"
          className="text-sm"
          onClick={handleDownloadAll}
          disabled={isDownloading || !chapters.every((_, i) => chapterProgress[i]?.status === 'ready')}
        >
          {isDownloading ? (
            <>
              <span className="animate-spin inline-block h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2"></span>
              Downloading...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Download All Chapters
            </>
          )}
        </Button>
      </div>
    </section>
  );
};

export default ChaptersSection;
