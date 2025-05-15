import React from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileText, ArrowDown, Loader2, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Chapter } from '@/lib/chapterDetection';
import { useToast } from '@/hooks/use-toast';
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
  const [downloadSuccess, setDownloadSuccess] = React.useState(false);
  const [downloadingChapter, setDownloadingChapter] = React.useState<number | null>(null);
  const { toast } = useToast();
  
  // Generate a safe filename from a chapter title
  const safeFileName = (title: string): string => {
    // Ensure filename is valid and not too long (fixes ENAMETOOLONG errors)
    // Remove invalid characters and replace spaces/special chars with underscores
    const cleanTitle = title
      .replace(/[^a-z0-9]/gi, '_')   // Replace non-alphanumeric with underscore
      .replace(/_+/g, '_')           // Replace multiple underscores with single
      .toLowerCase()
      .trim();
      
    // Limit filename length to avoid errors
    return cleanTitle.substring(0, 50);  // Limit to 50 chars (reasonable file name length)
  };

  // Download a single chapter as a text file
  const downloadChapter = async (chapter: Chapter, index: number) => {
    setDownloadingChapter(index);
    
    try {
      // Create a formatted text file with proper formatting
      let content = `${chapter.title}\n`;
      content += '='.repeat(chapter.title.length) + '\n\n';
      content += chapter.text;
      
      // Create and download the file
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      saveAs(blob, `${safeFileName(chapter.title)}.txt`);
      
      toast({
        title: "Chapter Downloaded",
        description: `Successfully saved "${chapter.title}" as a text file.`,
      });
    } catch (error) {
      console.error('Error downloading chapter:', error);
      toast({
        title: "Download Failed",
        description: "Could not download the chapter. Please try again.",
        variant: "destructive"
      });
    } finally {
      setDownloadingChapter(null);
    }
  };

  // Download all chapters as a zip file
  const downloadAllChapters = async () => {
    if (chapters.length === 0) return;

    setIsDownloading(true);
    setDownloadSuccess(false);
    
    try {
      const zip = new JSZip();
      
      // Create a table of contents file
      let tocContent = `${bookTitle}\nTable of Contents\n\n`;
      chapters.forEach((chapter, index) => {
        tocContent += `${index + 1}. ${chapter.title}\n`;
      });
      zip.file("00_table_of_contents.txt", tocContent);
      
      // Add each chapter as a text file to the zip
      chapters.forEach((chapter, index) => {
        // Create a safe filename with a numeric prefix for correct ordering
        const fileName = `${String(index + 1).padStart(2, '0')}_${safeFileName(chapter.title)}.txt`;
        
        // Format chapter content with proper headers
        let content = `${chapter.title}\n`;
        content += '='.repeat(chapter.title.length) + '\n\n';
        content += chapter.text;
        
        zip.file(fileName, content);
      });
      
      // Track and report progress during zip generation
      toast({
        title: "Creating Zip File",
        description: `Packaging ${chapters.length} chapters...`,
      });
      
      // Generate the zip file
      const content = await zip.generateAsync({ 
        type: 'blob',
        compression: "DEFLATE", // Use compression to reduce file size
        compressionOptions: {
          level: 6 // Balanced between speed and compression ratio
        }
      });
      
      // Use the book title if available, otherwise use a generic name
      const zipFileName = `${safeFileName(bookTitle)}_chapters.zip`;
      saveAs(content, zipFileName);
      
      setDownloadSuccess(true);
      toast({
        title: "Download Complete",
        description: `All ${chapters.length} chapters have been saved as ${zipFileName}`,
      });
    } catch (error) {
      console.error('Error creating zip file:', error);
      toast({
        title: "Zip Creation Failed",
        description: "Could not create the zip file. Please try again or download chapters individually.",
        variant: "destructive"
      });
    } finally {
      setIsDownloading(false);
      // Reset success state after a delay
      if (downloadSuccess) {
        setTimeout(() => setDownloadSuccess(false), 3000);
      }
    }
  };

  // If there are no chapters, don't render anything
  if (!chapters || chapters.length === 0) {
    return null;
  }

  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <CardTitle className="font-bold text-xl text-gray-800 mb-2 flex items-center">
          <FileText className="h-5 w-5 text-primary mr-2" />
          Chapter Files
        </CardTitle>
        
        <CardDescription className="text-gray-600 mb-4">
          The text has been automatically divided into {chapters.length} chapters based on detected headings.
        </CardDescription>
        
        <div className="mb-6">
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 mb-4">
            <h4 className="text-sm font-medium text-gray-800 mb-1">Book Information</h4>
            <p className="text-gray-600 text-sm mb-1">
              <span className="font-medium">Title:</span> {bookTitle}
            </p>
            <p className="text-gray-600 text-sm">
              <span className="font-medium">Chapters:</span> {chapters.length}
            </p>
            <p className="text-gray-600 text-sm">
              <span className="font-medium">Total Characters:</span> {chapters.reduce((sum, ch) => sum + ch.text.length, 0).toLocaleString()}
            </p>
          </div>
          
          <Button
            onClick={downloadAllChapters}
            disabled={isDownloading}
            className="bg-teal-600 hover:bg-teal-700 text-white font-medium transition-all w-full"
          >
            {isDownloading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating Zip File...
              </>
            ) : downloadSuccess ? (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Download Successful!
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download All Chapters (.zip)
              </>
            )}
          </Button>
          
          <p className="text-xs text-gray-500 mt-2 text-center">
            Includes table of contents and all {chapters.length} formatted chapter files
          </p>
        </div>
        
        <h3 className="font-medium text-sm text-gray-700 mb-2">Individual Chapters</h3>
        
        <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
          {chapters.map((chapter, index) => (
            <div 
              key={`chapter-${index}`}
              className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex-1 truncate">
                <span className="font-medium text-gray-700">{chapter.title}</span>
                <div className="flex items-center text-xs text-gray-500 mt-0.5">
                  <span>{chapter.text.length.toLocaleString()} chars</span>
                  <span className="mx-1">•</span>
                  <span>{Math.ceil(chapter.text.split(/\s+/).length / 150)} min read</span>
                </div>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                disabled={downloadingChapter === index}
                onClick={() => downloadChapter(chapter, index)}
                className="text-teal-600 hover:text-teal-700 hover:bg-teal-50"
              >
                {downloadingChapter === index ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default ChapterDownloadSection;