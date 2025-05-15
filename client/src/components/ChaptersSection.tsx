import React from 'react';
import { BookOpen, Download, Music, Clock, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import AudioPlayer from './AudioPlayer';
import AIChapterConfidence from './AIChapterConfidence';

interface Chapter {
  id: number;
  title: string;
  audioUrl: string;
  duration: number; // in seconds
  size: number; // in bytes
}

interface ChaptersSectionProps {
  chapters: Chapter[];
  wasChunked?: boolean; // Added for confidence display
  patternMatchCounts?: Record<string, number>; // Added for confidence display
}

const ChaptersSection: React.FC<ChaptersSectionProps> = ({ 
  chapters,
  wasChunked = true, // Default to true for backward compatibility
  patternMatchCounts = {}
}) => {
  // Function to format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Function to format duration in mm:ss format
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Function to handle download all chapters
  const handleDownloadAll = () => {
    // In a real app, this would trigger multiple downloads or a zip file
    chapters.forEach(chapter => {
      window.open(chapter.audioUrl, '_blank');
    });
  };

  // Calculate total duration
  const totalDuration = chapters.reduce((total, chapter) => total + chapter.duration, 0);
  const totalSize = chapters.reduce((total, chapter) => total + chapter.size, 0);

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-xl text-gray-800 flex items-center">
          <BookOpen className="h-5 w-5 text-primary mr-2" />
          Your Audiobook Chapters
        </h2>
        
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="text-xs">
            <Clock className="h-3 w-3 mr-1" />
            {formatDuration(totalDuration)} total
          </Badge>
          <Badge variant="outline" className="text-xs">
            <FileText className="h-3 w-3 mr-1" />
            {chapters.length} chapter{chapters.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      </div>
      
      {/* AI Confidence Indicator */}
      <AIChapterConfidence 
        wasChunked={wasChunked}
        patternMatchCounts={patternMatchCounts}
        chaptersCount={chapters.length}
      />
      
      <div className="space-y-4">
        {chapters.map((chapter) => (
          <Card
            key={chapter.id} 
            className="overflow-hidden transition-all duration-200 hover:shadow-md"
          >
            <div className="p-4">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-medium text-gray-800">{chapter.title}</h3>
                <Badge variant="secondary" className="text-xs">
                  <Music className="h-3 w-3 mr-1 text-primary" />
                  {formatDuration(chapter.duration)}
                </Badge>
              </div>
              
              <AudioPlayer 
                audioUrl={chapter.audioUrl}
                duration={chapter.duration}
              />
              
              <div className="flex justify-between items-center mt-3">
                <div className="text-xs text-gray-500 flex items-center">
                  <span className="mr-1">Size:</span>
                  {formatFileSize(chapter.size)}
                </div>
                <a 
                  href={chapter.audioUrl}
                  download={`${chapter.title ? chapter.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'audio'}.mp3`}
                  className="text-primary hover:text-primary/80 flex items-center text-sm font-medium"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download MP3
                </a>
              </div>
            </div>
          </Card>
        ))}
      </div>
      
      {chapters.length > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Total size: <span className="font-medium">{formatFileSize(totalSize)}</span>
          </div>
          
          <Button 
            onClick={handleDownloadAll}
            className="bg-primary hover:bg-primary/90"
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
