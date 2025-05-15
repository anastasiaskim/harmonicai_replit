import React from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileText, ArrowDown } from 'lucide-react';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Chapter } from '@/lib/chapterDetection';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface ChapterDownloadSectionProps {
  chapters: Chapter[];
  bookTitle?: string;
}

/**
 * Component for downloading individual chapters or all chapters as a zip file
 */
const ChapterDownloadSection: React.FC<ChapterDownloadSectionProps> = ({ 
  chapters, 
  bookTitle = 'book'
}) => {
  const [isDownloading, setIsDownloading] = React.useState(false);
  
  // Generate a safe filename from a chapter title
  const safeFileName = (title: string): string => {
    return title
      .replace(/[^a-z0-9]/gi, '_')
      .replace(/_+/g, '_')
      .toLowerCase();
  };

  // Download a single chapter as a text file
  const downloadChapter = (chapter: Chapter) => {
    const blob = new Blob([chapter.text], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, `${safeFileName(chapter.title)}.txt`);
  };

  // Download all chapters as a zip file
  const downloadAllChapters = async () => {
    if (chapters.length === 0) return;

    setIsDownloading(true);
    try {
      const zip = new JSZip();
      
      // Add each chapter as a text file to the zip
      chapters.forEach((chapter, index) => {
        // Create a safe filename with a numeric prefix for correct ordering
        const fileName = `${String(index + 1).padStart(2, '0')}_${safeFileName(chapter.title)}.txt`;
        zip.file(fileName, chapter.text);
      });
      
      // Generate the zip file
      const content = await zip.generateAsync({ type: 'blob' });
      
      // Use the book title if available, otherwise use a generic name
      const zipFileName = `${safeFileName(bookTitle)}_chapters.zip`;
      saveAs(content, zipFileName);
    } catch (error) {
      console.error('Error creating zip file:', error);
      alert('Failed to create zip file. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  // If there are no chapters, don't render anything
  if (!chapters || chapters.length === 0) {
    return null;
  }

  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <CardTitle className="font-bold text-xl text-gray-800 mb-4 flex items-center">
          <FileText className="h-5 w-5 text-primary mr-2" />
          Chapter Files
        </CardTitle>
        
        <div className="mb-4">
          <p className="text-gray-600 mb-2">
            The text has been automatically divided into {chapters.length} chapters.
            You can download individual chapters or get all chapters as a zip file.
          </p>
          
          <Button
            onClick={downloadAllChapters}
            disabled={isDownloading}
            className="bg-teal-600 hover:bg-teal-700 text-white font-medium transition-all mb-4"
          >
            {isDownloading ? (
              <>
                <ArrowDown className="h-4 w-4 mr-2 animate-bounce" />
                Creating Zip...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download All Chapters (.zip)
              </>
            )}
          </Button>
        </div>
        
        <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
          {chapters.map((chapter, index) => (
            <div 
              key={`chapter-${index}`}
              className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex-1 truncate">
                <span className="font-medium text-gray-700">{chapter.title}</span>
                <div className="text-xs text-gray-500">
                  {chapter.text.length.toLocaleString()} characters
                </div>
              </div>
              
              <Badge 
                variant="outline" 
                className="mr-2 text-xs bg-gray-100"
              >
                {Math.ceil(chapter.text.split(/\s+/).length / 150)} min read
              </Badge>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => downloadChapter(chapter)}
                className="text-teal-600 hover:text-teal-700 hover:bg-teal-50"
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default ChapterDownloadSection;