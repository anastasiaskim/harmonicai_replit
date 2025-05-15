import React, { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Mic, PlayCircle, PauseCircle, Download, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface QuickConversionSectionProps {
  selectedVoice: string;
  onVoiceSelect: (voiceId: string) => void;
  voices: any[];
}

const QuickConversionSection: React.FC<QuickConversionSectionProps> = ({ 
  selectedVoice, 
  onVoiceSelect,
  voices 
}) => {
  const [title, setTitle] = useState<string>('');
  const [text, setText] = useState<string>('');
  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleConvert = async () => {
    if (!text || !title) {
      setError('Please provide both a title and text for the conversion');
      return;
    }

    if (text.length > 5000) {
      setError('Text is too long. Maximum 5000 characters allowed for quick conversion.');
      return;
    }

    setIsConverting(true);
    setError(null);
    setAudioUrl(null);

    try {
      const response = await fetch('/api/convert-to-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          voiceId: selectedVoice,
          title,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to convert text to audio');
      }

      const data = await response.json();
      setAudioUrl(data.audioUrl);
    } catch (err: any) {
      setError(err.message || 'An error occurred during conversion');
    } finally {
      setIsConverting(false);
    }
  };

  const togglePlayPause = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    
    setIsPlaying(!isPlaying);
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="font-bold text-xl text-gray-800 flex items-center">
          <Mic className="h-5 w-5 text-primary mr-2" />
          Quick TTS Conversion
        </CardTitle>
        <CardDescription>
          Convert a small text snippet to speech for testing
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input 
              id="title" 
              placeholder="Enter a title for the audio" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="voice">Voice</Label>
            <Select value={selectedVoice} onValueChange={onVoiceSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Select a voice" />
              </SelectTrigger>
              <SelectContent>
                {voices.map((voice) => (
                  <SelectItem key={voice.id} value={voice.voiceId}>
                    {voice.name} - {voice.gender}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="text">Text to Convert (max 5000 characters)</Label>
          <Textarea 
            id="text" 
            placeholder="Enter text to convert to speech..." 
            className="min-h-[100px]"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="text-xs text-right text-gray-500">
            {text.length}/5000 characters
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="flex justify-between">
        <Button
          onClick={handleConvert}
          disabled={isConverting || !text || !title}
        >
          {isConverting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Converting...
            </>
          ) : (
            'Convert to Audio'
          )}
        </Button>
        
        {audioUrl && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={togglePlayPause}>
              {isPlaying ? (
                <PauseCircle className="h-4 w-4 mr-2" />
              ) : (
                <PlayCircle className="h-4 w-4 mr-2" />
              )}
              {isPlaying ? 'Pause' : 'Play'}
            </Button>
            
            <Button variant="outline" asChild>
              <a href={audioUrl} download target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4 mr-2" />
                Download
              </a>
            </Button>
            
            {/* Hidden audio element */}
            <audio 
              ref={audioRef} 
              src={audioUrl} 
              onEnded={handleAudioEnded}
              style={{ display: 'none' }}
            />
          </div>
        )}
      </CardFooter>
    </Card>
  );
};

export default QuickConversionSection;