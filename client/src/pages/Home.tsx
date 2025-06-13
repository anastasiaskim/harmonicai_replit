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
import { extractBookTitle, Chapter as TextChapter } from '@/lib/chapterDetection';
import axios from 'axios';
import { supabase } from '@/lib/supabaseClient';
import LoginModal from '@/components/LoginModal';
import { useState, useEffect, useRef } from 'react';
import { Session } from '@supabase/supabase-js';
import { GeneratedChapter, AudioChapter } from '@/types/audio';

type FileMetadata = {
  key: string;
  name: string;
  size: number;
  url: string;
  mimeType: string;
};

interface ProcessedResult {
  text: string;
  chapters: TextChapter[];
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

type GenerationProgress = {
  current: number;
  total: number;
  status: 'idle' | 'generating' | 'complete' | 'error';
};

type ChapterStatus = 'idle' | 'processing' | 'ready' | 'failed';
type ChapterProgress = { status: ChapterStatus; percent: number; error?: string };

const Home = () => {
  const [text, setText] = React.useState<string>('');
  const [chapters, setChapters] = React.useState<TextChapter[]>([]);
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
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const cancelTokenRef = useRef<AbortController | null>(null);

  const { toast } = useToast();

  // Initialize session and set up auth state listener
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    // Cleanup subscription on unmount
    return () => subscription.unsubscribe();
  }, []);

  // Fetch available voices from the API
  const { data: voices, isLoading: isLoadingVoices } = useQuery({
    queryKey: ['/api/voices'],
    queryFn: async () => {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/voices`);
      return res.data;
    },
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
    if (!text || !selectedVoice) return;
    
    setIsGenerating(true);
    setError(null);
    cancelTokenRef.current = new AbortController();
    setIsCancelling(false);
    
    let accessToken: string;

    // Try to refresh the session before proceeding
    try {
      const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        throw refreshError;
      }
      if (!refreshedSession?.access_token) {
        throw new Error('No access token available after refresh');
      }
      setSession(refreshedSession);
      accessToken = refreshedSession.access_token;
    } catch (refreshErr) {
      console.error('Error refreshing session:', refreshErr);
      setLoginModalOpen(true);
      toast({
        title: 'Session Expired',
        description: 'Please log in again to continue.',
        variant: 'destructive',
      });
      setIsGenerating(false);
      return;
    }

    // Don't start another conversion if one is already in progress
    if (isGenerating) {
      toast({
        title: 'Processing',
        description: 'Conversion is already in progress. Please wait.',
      });
      return;
    }

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

    // Initialize progress tracking
    setGenerationProgress({
      current: 0,
      total: nonEmptyChapters.length,
      status: 'generating'
    });
    
    // Initialize per-chapter progress based on nonEmptyChapters
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
        // Update overall progress
        setGenerationProgress(prev => ({
          ...prev,
          current: i,
          status: 'generating'
        }));

        // Set chapter to processing
        setChapterProgress(prev => {
          const updated = [...prev];
          updated[i] = { status: 'processing', percent: 0 };
          return updated;
        });

        toast({
          title: "Processing Chapter",
          description: `Converting chapter ${i + 1} of ${nonEmptyChapters.length}: "${chapter.title}"`,
        });

        try {
          const response = await axios.post(
            `${import.meta.env.VITE_API_URL}/api/text-to-speech`,
            {
              text: chapter.text,
              voiceId: selectedVoice,
              title: chapter.title,
              chapters: [{
                title: chapter.title,
                text: chapter.text
              }]
            },
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              signal: cancelTokenRef.current.signal
            }
          );

          const data = response.data;
          if (data.success && data.jobId) {
            let jobComplete = false;
            let retryCount = 0;
            const maxRetries = 12; // Reduced from 30 to 12
            const baseDelay = 1000; // 1 second
            const maxDelay = 3000; // 3 seconds max delay
            
            while (!jobComplete && retryCount < maxRetries && !isCancelling) {
              try {
                const jobStatusResponse = await axios.get(
                  `${import.meta.env.VITE_API_URL}/api/tts-job/${data.jobId}`,
                  {
                    headers: {
                      'Authorization': `Bearer ${accessToken}`,
                    },
                    signal: cancelTokenRef.current.signal
                  }
                );
                
                const jobStatus = jobStatusResponse.data;
                
                if (jobStatus.status === 'completed' && jobStatus.audioUrls?.length > 0) {
                  const generatedChapter = {
                    id: i,
                    title: chapter.title,
                    audioUrl: jobStatus.audioUrls[0],
                    duration: 0,
                    size: 0
                  };
                  processedChapters.push(generatedChapter);
                  jobComplete = true;
                } else if (jobStatus.status === 'failed') {
                  throw new Error(jobStatus.error || 'Job failed');
                }
                
                // Update chapter progress with more detailed status
                setChapterProgress(prev => {
                  const updated = [...prev];
                  updated[i] = { 
                    status: jobStatus.status === 'completed' ? 'ready' : 'processing',
                    percent: jobStatus.progress || 0
                  };
                  return updated;
                });

                // Show progress toast with retry count
                toast({
                  title: "Processing Chapter",
                  description: `Chapter ${i + 1}/${nonEmptyChapters.length}: ${jobStatus.progress || 0}% complete (Attempt ${retryCount + 1}/${maxRetries})`,
                  duration: 2000
                });
                
                if (!jobComplete) {
                  // Exponential backoff with jitter
                  const exponentialDelay = Math.min(baseDelay * Math.pow(1.5, retryCount), maxDelay);
                  const jitter = Math.random() * 500; // Add up to 0.5 seconds of random jitter
                  await new Promise(resolve => setTimeout(resolve, exponentialDelay + jitter));
                  retryCount++;
                }
              } catch (jobError) {
                if (isCancelling) {
                  throw new Error('Operation cancelled by user');
                }
                
                console.error('Error checking job status:', jobError);
                if (axios.isAxiosError(jobError) && !jobError.response) {
                  const exponentialDelay = Math.min(baseDelay * Math.pow(1.5, retryCount), maxDelay);
                  await new Promise(resolve => setTimeout(resolve, exponentialDelay));
                  retryCount++;
                  continue;
                }
                throw jobError;
              }
            }

            if (!jobComplete && !isCancelling) {
              throw new Error(`Job timed out after ${maxRetries} attempts`);
            }
          }
        } catch (error) {
          if (isCancelling) {
            toast({
              title: "Operation Cancelled",
              description: "The audiobook generation was cancelled.",
              variant: "destructive"
            });
          } else {
            console.error('Error processing chapter:', error);
            setChapterProgress(prev => {
              const updated = [...prev];
              updated[i] = { 
                status: 'failed', 
                percent: 0, 
                error: error instanceof Error ? error.message : 'Unknown error' 
              };
              return updated;
            });
            throw error;
          }
        }
      }

      // Update generated chapters state once after all processing is complete
      setGeneratedChapters(processedChapters);

      // ✅ mark overall job complete
      setGenerationProgress(prev => ({
        ...prev,
        current: processedChapters.length,
        status: 'complete'
      }));
      toast({
        title: "Audiobook Generated",
        description: `Successfully created ${processedChapters.length} audio chapters.`,
      });
    } catch (error) {
      console.error('Error generating audiobook:', error);
      setError(error instanceof Error ? error.message : 'An error occurred while generating the audiobook');
      setGenerationProgress(prev => ({ ...prev, status: 'error' }));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCancelGeneration = () => {
    setIsCancelling(true);
    if (cancelTokenRef.current) {
      cancelTokenRef.current.abort();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <LoginModal isOpen={loginModalOpen} onClose={() => setLoginModalOpen(false)} />
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-8 space-y-8">
        <IntroSection />
        <FileUploadSection onTextProcessed={handleTextProcessed} />
        <VoiceSelectionSection
          selectedVoice={selectedVoice}
          onVoiceSelect={handleVoiceSelect}
          voices={voices}
          isLoading={isLoadingVoices}
        />
        <GenerateSection
          isGenerating={isGenerating}
          onGenerate={handleGenerateAudiobook}
          onCancel={handleCancelGeneration}
          isDisabled={!text || chapters.length === 0}
          progress={generationProgress}
        />
        <TextPreviewSection
          text={text}
          chapters={chapters}
        />
        <ChaptersSection
          chapters={chapters.map((ch, index) => ({
            id: index,
            title: ch.title,
            text: ch.text,
            audioUrl: '',
            duration: 0,
            size: 0
          }))}
          chapterProgress={chapterProgress}
        />
        <ChapterDownloadSection
          chapters={generatedChapters}
          bookTitle={text ? `Generated Audiobook - ${new Date().toLocaleDateString()}` : undefined}
        />
      </main>
      <Footer />
    </div>
  );
};

export default Home;
