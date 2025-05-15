import React from 'react';
import { BookOpen, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AudioPlayer from './AudioPlayer';

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
  // Function to format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Function to handle download all chapters
  const handleDownloadAll = () => {
    // In a real app, this would trigger multiple downloads or a zip file
    chapters.forEach(chapter => {
      window.open(chapter.audioUrl, '_blank');
    });
  };

  return (
    <section>
      <h2 className="font-bold text-xl text-gray-800 mb-4 flex items-center">
        <BookOpen className="h-5 w-5 text-primary mr-2" />
        Your Audiobook Chapters
      </h2>
      
      <div className="space-y-4">
        {chapters.map((chapter) => (
          <div 
            key={chapter.id} 
            className="bg-white rounded-xl shadow-md overflow-hidden hover:translate-y-[-3px] transition-transform duration-200"
          >
            <div className="p-4">
              <h3 className="font-medium text-gray-800">{chapter.title}</h3>
              
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
                  className="text-teal-600 hover:text-teal-700 flex items-center text-sm font-medium"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download MP3
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
      
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
