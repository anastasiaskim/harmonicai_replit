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
      // Instead of showing a toast, use our UI to display this message
      setError("Please upload a valid text file before generating an audiobook");
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
    
    // Temporary array to collect processed chapters
    const processedChapters: GeneratedChapter[] = [];

    try {
      // Process each chapter individually to avoid the 50,000 character limit
      toast({
        title: "Processing Audiobook",
        description: `Starting to process ${chapters.length} chapters...`,
      });
      
      // Process chapters one by one to avoid size limitations
      for (let i = 0; i < chapters.length; i++) {
        const chapter = chapters[i];
        
        toast({
          title: "Processing Chapter",
          description: `Converting chapter ${i+1} of ${chapters.length}: "${chapter.title}"`,
        });
        
        // Send individual chapter for processing
        // Using the full text-to-speech API instead of the quick conversion endpoint
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
        // Check if we got valid chapter data with non-zero audio files
        if (data.success && data.chapters && data.chapters.length > 0) {
          // Check if we have a valid audio file (more than 0 bytes in size)
          const generatedChapter = data.chapters[0];
          processedChapters.push(generatedChapter);
          
          // If the audio file is empty (0 bytes), show a warning but continue
          if (generatedChapter.size === 0) {
            toast({
              title: "API Limitation",
              description: "ElevenLabs API quota exceeded. Using empty audio file as placeholder.",
              variant: "warning",
            });
            
            // Check if ELEVENLABS_API_KEY is available or expired
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
          throw new Error(`Failed to process chapter "${chapter.title}"`);
        }
        
        // Update UI with progress
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
              <ChaptersSection chapters={generatedChapters} />
            )}
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Home;
