import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import IntroSection from '@/components/IntroSection';
import FileUploadSection from '@/components/FileUploadSection';
import VoiceSelectionSection from '@/components/VoiceSelectionSection';
import GenerateSection from '@/components/GenerateSection';
import TextPreviewSection from '@/components/TextPreviewSection';
import ChaptersSection from '@/components/ChaptersSection';

import ChapterDownloadSection from '@/components/ChapterDownloadSection';

import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { extractBookTitle } from '@/lib/chapterDetection';

type Chapter = {
  title: string;
  text: string;
};

type FileMetadata = {
  key: string;
  name: string;
  size: number;
  url: string;
  mimeType: string;
};

interface ProcessedResult {
  text: string;
  chapters: Chapter[];
  charCount: number;
  fileMetadata?: FileMetadata | null;
  wasChunked: boolean;
  patternMatchCounts?: Record<string, number>;
}

interface Voice {
  id: number;
  voiceId: string;
  name: string;
  description: string;
  gender?: string;
  accent?: string;
  style?: string;
}

type GeneratedChapter = {
  id: number;
  title: string;
  audioUrl: string;
  duration: number; // in seconds
  size: number; // in bytes
};

type GenerationProgress = {
  current: number;
  total: number;
  status: 'idle' | 'generating' | 'complete' | 'error';
};

type ChapterStatus = 'idle' | 'processing' | 'ready' | 'failed';
type ChapterProgress = { status: ChapterStatus; percent: number; error?: string };

const Home = () => {
  const [text, setText] = React.useState<string>('');
  const [chapters, setChapters] = React.useState<Chapter[]>([]);
  const [fileMetadata, setFileMetadata] = React.useState<FileMetadata | null>(null);
  const [selectedVoice, setSelectedVoice] = React.useState<string>('rachel');
  const [isGenerating, setIsGenerating] = React.useState<boolean>(false);
  const [generatedChapters, setGeneratedChapters] = React.useState<GeneratedChapter[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [bookTitle, setBookTitle] = React.useState<string>('Untitled Book');
  const [wasChunked, setWasChunked] = React.useState<boolean>(true);
  const [originalText, setOriginalText] = React.useState<string>('');
  const [generationProgress, setGenerationProgress] = React.useState<GenerationProgress>({
    current: 0,
    total: 0,
    status: 'idle'
  });
  const [chapterProgress, setChapterProgress] = React.useState<ChapterProgress[]>([]);

  const { toast } = useToast();

  // Fetch available voices from the API
  const { data: voices, isLoading: isLoadingVoices } = useQuery({
    queryKey: ['/api/voices'],
  });

  // Function to handle file uploads and text processing
  const handleTextProcessed = async (
    result: ProcessedResult | null,
    error?: string
  ) => {
    if (result) {
      setText(result.text);
      setChapters(result.chapters);
      setFileMetadata(result.fileMetadata || null);
      setError(null);
      setWasChunked(result.wasChunked);
      setOriginalText(result.text);
      
      // Try to extract a book title from the text
      const detectedTitle = extractBookTitle(result.text);
      setBookTitle(detectedTitle);
      
      console.log(`Extracted book title: "${detectedTitle}"`);
      console.log(`Detected ${result.chapters.length} chapters in the text`);
      console.log(`Was chunking successful? ${result.wasChunked ? 'Yes' : 'No'}`);
      
      if (result.patternMatchCounts) {
        console.log('Pattern match counts:', result.patternMatchCounts);
      }
      
      // Show success message about extracted chapters
      if (result.wasChunked) {
        toast({
          title: "Text Processing Complete",
          description: `Extracted ${result.chapters.length} chapters from "${detectedTitle}"`,
        });
        
        // Auto-convert the extracted text to speech if we have a valid file
        if (result.text && result.chapters.length > 0) {
          toast({
            title: "Starting Audio Conversion",
            description: "Now converting text to speech automatically...",
          });
          
          // Trigger the audio generation
          await handleGenerateAudiobook();
        }
      } else {
        // If chapters couldn't be automatically detected
        toast({
          title: "Processing as Single Chapter",
          description: "We couldn't detect multiple chapters in your text. Processing as a single chapter.",
          variant: "default",
        });
        
        // Set a single chapter with the entire text
        const singleChapter = { title: 'Complete Text', text: result.text };
        setChapters([singleChapter]);
        setWasChunked(true); // Consider it as "processed" so we can proceed
        
        // If we have text, proceed to audio generation
        if (result.text) {
          setTimeout(() => handleGenerateAudiobook(), 500);
        }
      }
    } else if (error) {
      setError(error);
      toast({
        title: "Error",
        description: error,
        variant: "destructive",
      });
    }
  };

  // Function to handle voice selection
  const handleVoiceSelect = (voiceId: string) => {
    setSelectedVoice(voiceId);
  };
  


  // Function to generate audiobook
  const handleGenerateAudiobook = async () => {
    // Check if we have content to convert
    if (!text || chapters.length === 0) {
      return;
    }

    // Don't start another conversion if one is already in progress
    if (isGenerating) {
      toast({
        title: "Processing",
        description: "Conversion is already in progress. Please wait.",
      });
      return;
    }

    setIsGenerating(true);
    setError(null);
    
    // Filter out chapters with empty text
    const nonEmptyChapters = chapters.filter(ch => ch.text && ch.text.trim().length > 0);
    if (nonEmptyChapters.length === 0) {
      toast({
        title: "No Content",
        description: "All chapters are empty. Please upload or select content with text.",
        variant: "destructive",
      });
      setIsGenerating(false);
      return;
    }
    // Initialize per-chapter progress
    setChapterProgress(nonEmptyChapters.map(() => ({ status: 'idle', percent: 0 })));
    // Temporary array to collect processed chapters
    const processedChapters: GeneratedChapter[] = [];

    try {
      toast({
        title: "Processing Audiobook",
        description: `Starting to process ${nonEmptyChapters.length} chapters...`,
      });
      for (let i = 0; i < nonEmptyChapters.length; i++) {
        const chapter = nonEmptyChapters[i];
        // Set chapter to processing
        setChapterProgress(prev => {
          const updated = [...prev];
          updated[i] = { status: 'processing', percent: 0 };
          return updated;
        });
        toast({
          title: "Processing Chapter",
          description: `Converting chapter ${i+1} of ${nonEmptyChapters.length}: "${chapter.title}"`,
        });
        try {
          const response = await fetch('/api/text-to-speech', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              chapters: [{ title: chapter.title, text: chapter.text }],
              voiceId: selectedVoice,
            }),
          });
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(
              errorData.error || `Failed to generate audio for chapter "${chapter.title}"`
            );
          }
          const data = await response.json();
          if (data.success && data.chapters && data.chapters.length > 0) {
            const generatedChapter = data.chapters[0];
            processedChapters.push(generatedChapter);
            setChapterProgress(prev => {
              const updated = [...prev];
              updated[i] = { status: 'ready', percent: 100 };
              return updated;
            });
            if (generatedChapter.size === 0) {
              toast({
                title: "API Limitation",
                description: "ElevenLabs API quota exceeded. Using empty audio file as placeholder.",
                variant: "destructive",
              });
              try {
                const secretsResponse = await fetch('/api/check-secret?key=ELEVENLABS_API_KEY');
                if (secretsResponse.ok) {
                  const secretsData = await secretsResponse.json();
                  if (!secretsData.exists) {
                    toast({
                      title: "API Key Missing",
                      description: "Please provide a valid ElevenLabs API key to generate audio.",
                      variant: "destructive",
                    });
                  } else if (secretsData.isValid === false) {
                    toast({
                      title: "API Key Invalid",
                      description: "The ElevenLabs API key appears to be invalid or has expired.",
                      variant: "destructive",
                    });
                  }
                }
              } catch (secretErr) {
                console.error("Error checking API key status:", secretErr);
              }
            }
          } else {
            setChapterProgress(prev => {
              const updated = [...prev];
              updated[i] = { status: 'failed', percent: 100, error: `Failed to process chapter "${chapter.title}"` };
              return updated;
            });
            throw new Error(`Failed to process chapter "${chapter.title}"`);
          }
        } catch (err: any) {
          setChapterProgress(prev => {
            const updated = [...prev];
            updated[i] = { status: 'failed', percent: 100, error: err.message || 'Failed to generate audiobook' };
            return updated;
          });
          setError(err.message || 'Failed to generate audiobook');
          toast({
            title: "Generation Failed",
            description: err.message || 'An error occurred while generating the audiobook.',
            variant: "destructive",
          });
        }
        setGeneratedChapters([...processedChapters]);
      }
      toast({
        title: "Audiobook Generated",
        description: `Successfully created ${processedChapters.length} audio chapters.`,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to generate audiobook');
      toast({
        title: "Generation Failed",
        description: err.message || 'An error occurred while generating the audiobook.',
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-50 flex flex-col">
      <Header />
      
      <main className="container mx-auto px-4 md:px-6 py-8 flex-grow">
        <IntroSection />
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column - Input & Settings */}
          <div className="lg:col-span-5 space-y-6">
            <FileUploadSection onTextProcessed={handleTextProcessed} />
            
            <VoiceSelectionSection 
              voices={(voices as Voice[]) || []} 
              isLoading={isLoadingVoices}
              selectedVoice={selectedVoice}
              onVoiceSelect={handleVoiceSelect}
            />
            
            <GenerateSection 
              onGenerate={handleGenerateAudiobook}
              isGenerating={isGenerating}
              isDisabled={!text || chapters.length === 0}
              progress={generationProgress}
            />
          </div>
          
          {/* Right Column - Preview & Results */}
          <div className="lg:col-span-7">
            <TextPreviewSection 
              text={text}
              chapters={chapters}
              fileMetadata={fileMetadata}
              error={error}
              wasChunked={wasChunked}
            />

            
            {/* Show chapter download section when chapters are available and chunking was successful */}
            {chapters.length > 0 && wasChunked && (
              <ChapterDownloadSection
                chapters={chapters}
                bookTitle={bookTitle}
              />
            )}
            
            {generatedChapters.length > 0 && (
              <ChaptersSection 
                chapters={generatedChapters}
                chapterProgress={chapterProgress}
              />
            )}
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Home;
