import React, { useState } from 'react';
import { BookOpen, Download, Play, Clock, Music, FileAudio, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import GlobalAudioPlayer from './GlobalAudioPlayer';

interface Chapter {
  id: number;
  title: string;
  audioUrl: string;
  duration: number; // in seconds
  size: number; // in bytes
}

interface ChaptersSectionProps {
  chapters: Chapter[];
}

const ChaptersSection: React.FC<ChaptersSectionProps> = ({ chapters }) => {
  const [selectedChapterIndex, setSelectedChapterIndex] = useState(0);

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

  // Calculate total duration
  const totalDuration = chapters.reduce((sum, chapter) => sum + chapter.duration, 0);
  const totalDurationFormatted = formatDuration(totalDuration);

  // Calculate total size
  const totalSize = chapters.reduce((sum, chapter) => sum + chapter.size, 0);

  // Function to handle download all chapters
  const handleDownloadAll = () => {
    // In a real app, this would trigger multiple downloads or a zip file
    chapters.forEach(chapter => {
      window.open(chapter.audioUrl, '_blank');
    });
  };

  // Function to play a specific chapter
  const playChapter = (index: number) => {
    setSelectedChapterIndex(index);
  };

  return (
    <section>
      <h2 className="font-bold text-xl text-gray-800 mb-4 flex items-center">
        <BookOpen className="h-5 w-5 text-primary mr-2" />
        Your Audiobook Chapters
      </h2>
      
      {/* Global Audio Player */}
      <div className="mb-6">
        <GlobalAudioPlayer 
          chapters={chapters}
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
      
      {/* Chapter list */}
      <div className="space-y-2">
        {chapters.map((chapter, index) => (
          <div 
            key={chapter.id} 
            className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:border-primary/30 transition-colors duration-200"
          >
            <div className="p-3">
              <div className="flex justify-between items-center">
                <h3 className="font-medium text-gray-800 truncate flex-1">{chapter.title}</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-primary hover:text-primary-dark hover:bg-primary/10 h-8 mr-1"
                  onClick={() => playChapter(index)}
                >
                  <Play className="h-4 w-4 mr-1" />
                  Play
                </Button>
              </div>
              
              <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
                <div className="flex items-center">
                  <Clock className="h-3.5 w-3.5 mr-1 text-gray-400" />
                  {formatDuration(chapter.duration)}
                </div>
                <div className="flex items-center">
                  <span className="mr-1">Size:</span>
                  {formatFileSize(chapter.size)}
                </div>
                <a 
                  href={chapter.audioUrl}
                  download={`${chapter.title ? chapter.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'audio'}.mp3`}
                  className="text-teal-600 hover:text-teal-700 flex items-center"
                >
                  <Download className="h-3.5 w-3.5 mr-1" />
                  Download
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Download all button */}
      {chapters.length > 1 && (
        <div className="mt-6 text-center">
          <Button 
            onClick={handleDownloadAll}
            className="bg-teal-600 hover:bg-teal-700 text-white font-medium shadow-md transition-all"
          >
            <Download className="h-4 w-4 mr-2" />
            Download All Chapters
          </Button>
        </div>
      )}
    </section>
  );
};

export default ChaptersSection;
