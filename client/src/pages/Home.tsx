import { useState } from 'react';
import { TextUploadSection } from '@/components/TextUploadSection';
import { ChaptersSection } from '@/components/ChaptersSection';
import { 
  extractBookTitle, 
  type Chapter, 
  type ChunkingResult 
} from '@/lib/chapterDetection';

export default function Home() {
  const [step, setStep] = useState<'upload' | 'chapters' | 'voices'>('upload');
  const [textContent, setTextContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [bookTitle, setBookTitle] = useState<string>('');
  const [chapterResult, setChapterResult] = useState<ChunkingResult | null>(null);
  const [selectedChapters, setSelectedChapters] = useState<Chapter[]>([]);
  
  // Handle text upload
  const handleTextLoaded = (text: string, name: string) => {
    setTextContent(text);
    setFileName(name);
    
    // Try to extract a book title
    const extractedTitle = extractBookTitle(text);
    setBookTitle(extractedTitle);
  };
  
  // Handle chapter detection
  const handleChaptersDetected = (result: ChunkingResult) => {
    setChapterResult(result);
    setStep('chapters');
  };
  
  // Handle chapter selection
  const handleSelectChapters = (chapters: Chapter[]) => {
    setSelectedChapters(chapters);
    setStep('voices');
    
    // For now, just log the selection
    console.log('Selected chapters:', chapters);
  };
  
  return (
    <div className="container max-w-6xl mx-auto px-4 py-8">
      {step === 'upload' && (
        <TextUploadSection 
          onTextLoaded={handleTextLoaded}
          onChaptersDetected={handleChaptersDetected}
        />
      )}
      
      {step === 'chapters' && chapterResult && (
        <ChaptersSection
          chapters={chapterResult.chapters}
          wasChunked={chapterResult.wasChunked}
          aiDetection={chapterResult.aiDetection}
          confidenceLevels={chapterResult.confidenceLevels}
          onSelectChapters={handleSelectChapters}
        />
      )}
      
      {step === 'voices' && (
        <div className="text-center p-8">
          <h2 className="text-2xl font-bold">Voice Selection</h2>
          <p className="text-gray-500 mt-2">
            This part would be implemented to select voices for conversion
          </p>
          <pre className="mt-6 text-left bg-gray-100 p-4 rounded text-sm">
            {JSON.stringify(
              {
                bookTitle,
                fileName,
                chapterCount: selectedChapters.length,
                totalWords: selectedChapters.reduce((sum, ch) => sum + ch.text.split(/\s+/).length, 0)
              }, 
              null, 2
            )}
          </pre>
        </div>
      )}
    </div>
  );
}