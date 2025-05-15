import React from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import IntroSection from '@/components/IntroSection';
import FileUploadSection from '@/components/FileUploadSection';
import VoiceSelectionSection from '@/components/VoiceSelectionSection';
import GenerateSection from '@/components/GenerateSection';
import TextPreviewSection from '@/components/TextPreviewSection';
import ChaptersSection from '@/components/ChaptersSection';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';

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

  const { toast } = useToast();

  // Fetch available voices from the API
  const { data: voices, isLoading: isLoadingVoices } = useQuery({
    queryKey: ['/api/voices'],
  });

  // Function to handle file uploads and text processing
  const handleTextProcessed = (
    result: { 
      text: string; 
      chapters: Chapter[]; 
      charCount: number;
      fileMetadata?: FileMetadata | null;
    } | null,
    error?: string
  ) => {
    if (result) {
      setText(result.text);
      setChapters(result.chapters);
      setFileMetadata(result.fileMetadata || null);
      setError(null);
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
    if (!text || chapters.length === 0) {
      toast({
        title: "No content",
        description: "Please upload a file or paste text first.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/text-to-speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          voice: selectedVoice,
          chapters,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate audiobook');
      }

      const data = await response.json();
      setGeneratedChapters(data.chapters);
      
      toast({
        title: "Audiobook Generated",
        description: `Successfully created ${data.chapters.length} audio chapters.`,
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
            />
            
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
