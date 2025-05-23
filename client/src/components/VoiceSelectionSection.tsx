import React, { useState } from 'react';
import { Card, CardContent, CardTitle, CardDescription } from './ui/card';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { Mic2, Play, Volume2, Filter } from 'lucide-react';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import axios from 'axios';

// Hardcoded ElevenLabs voices
const ELEVENLABS_VOICES = [
  {
    id: 1,
    voiceId: "rCmVtv8cYU60uhlsOo1M", // Ana
    name: "Ana",
    description: "Upbeat, young, female, English (British), Narrative & Story",
    gender: "female",
    accent: "English (British)",
    style: "Upbeat"
  },
  {
    id: 2,
    voiceId: "LruHrtVF6PSyGItzMNHS", // Benjamin
    name: "Benjamin - Deep, Warm, Calming",
    description: "Relaxed, middle-aged, male, English (American), Narrative & Story",
    gender: "male",
    accent: "English (American)",
    style: "Relaxed"
  },
  {
    id: 3,
    voiceId: "uju3wxzG5OhpWcoi3SMy", // Michael C. Vincent
    name: "Michael C. Vincent",
    description: "Confident, middle-aged, male, English (American), Narrative & Story",
    gender: "male",
    accent: "English (American)",
    style: "Confident"
  },
  {
    id: 4,
    voiceId: "5l5f8iK3YPeGga21rQIX", // Adeline
    name: "Adeline",
    description: "Middle-aged, female, English (American), Narrative & Story",
    gender: "female",
    accent: "English (American)",
    style: "Narrative & Story"
  }
];

interface Voice {
  id: number;
  voiceId: string;
  name: string;
  description: string;
  gender?: string;
  accent?: string;
  style?: string;
}

interface VoiceSelectionSectionProps {
  voices: Voice[];
  isLoading: boolean;
  selectedVoice: string;
  onVoiceSelect: (voiceId: string) => void;
}

const VoiceSelectionSection: React.FC<VoiceSelectionSectionProps> = ({
  voices: apiVoices,
  isLoading,
  selectedVoice,
  onVoiceSelect,
}) => {
  // For Phase 2, use hardcoded voices instead of API voices
  const voices = ELEVENLABS_VOICES;
  const { toast } = useToast();
  
  // State to track the currently previewing voice
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);

  // Add state for filters
  const [filters, setFilters] = useState({
    gender: 'all',
    accent: 'all',
    style: 'all'
  });

  // Add filtered voices logic
  const filteredVoices = voices.filter(voice => {
    if (filters.gender !== 'all' && voice.gender !== filters.gender) return false;
    if (filters.accent !== 'all' && voice.accent !== filters.accent) return false;
    if (filters.style !== 'all' && voice.style !== filters.style) return false;
    return true;
  });

  // Function to generate preview audio
  const generatePreview = async (voiceId: string, text: string): Promise<string> => {
    try {
      const response = await axios.post('/api/preview-voice', {
        voiceId,
        text
      });
      return response.data.audioUrl;
    } catch (error) {
      console.error('Error generating preview:', error);
      throw new Error('Failed to generate voice preview');
    }
  };

  // Function to play voice preview
  const previewVoice = async (voiceId: string) => {
    const previewText = "Hello, this is a preview of my voice.";
    
    // Stop any currently playing preview
    if (previewAudio) {
      previewAudio.pause();
      previewAudio.currentTime = 0;
    }
    
    try {
      setPreviewingVoice(voiceId);
      const audioUrl = await generatePreview(voiceId, previewText);
      const audio = new Audio(audioUrl);
      
      // Handle audio completion
      audio.onended = () => {
        setPreviewingVoice(null);
        setPreviewAudio(null);
      };
      
      // Handle audio errors
      audio.onerror = () => {
        setPreviewingVoice(null);
        setPreviewAudio(null);
        toast({
          title: "Error",
          description: "Failed to play voice preview",
          variant: "destructive"
        });
      };
      
      setPreviewAudio(audio);
      await audio.play();
    } catch (error) {
      setPreviewingVoice(null);
      toast({
        title: "Error",
        description: "Failed to preview voice",
        variant: "destructive"
      });
    }
  };

  // Get the currently selected voice object
  const selectedVoiceObj = voices.find(v => v.voiceId === selectedVoice) || voices[0];

  return (
    <Card>
      <CardContent className="p-6">
        <CardTitle className="font-bold text-xl text-gray-800 mb-2 flex items-center">
          <Mic2 className="h-5 w-5 text-primary mr-2" />
          Select Voice
        </CardTitle>
        
        <CardDescription className="text-gray-500 mb-4">
          Choose a voice for your audiobook narration
        </CardDescription>

        {/* Add filter UI */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center">
              <Filter className="h-4 w-4 mr-2" />
              Gender
            </Label>
            <Select
              value={filters.gender}
              onValueChange={(value) => setFilters(prev => ({ ...prev, gender: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Genders</SelectItem>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center">
              <Filter className="h-4 w-4 mr-2" />
              Accent
            </Label>
            <Select
              value={filters.accent}
              onValueChange={(value) => setFilters(prev => ({ ...prev, accent: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select accent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Accents</SelectItem>
                <SelectItem value="American">American</SelectItem>
                <SelectItem value="British">British</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center">
              <Filter className="h-4 w-4 mr-2" />
              Style
            </Label>
            <Select
              value={filters.style}
              onValueChange={(value) => setFilters(prev => ({ ...prev, style: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select style" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Styles</SelectItem>
                <SelectItem value="conversational">Conversational</SelectItem>
                <SelectItem value="authoritative">Authoritative</SelectItem>
                <SelectItem value="expressive">Expressive</SelectItem>
                <SelectItem value="storytelling">Storytelling</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <Tabs defaultValue="grid" className="mb-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="grid">Grid View</TabsTrigger>
            <TabsTrigger value="dropdown">Dropdown</TabsTrigger>
          </TabsList>
          
          <TabsContent value="grid" className="mt-4">
            <RadioGroup 
              value={selectedVoice} 
              onValueChange={onVoiceSelect}
              className="grid grid-cols-1 md:grid-cols-2 gap-3"
            >
              {filteredVoices.map((voice) => (
                <div 
                  key={voice.id} 
                  className={`flex flex-col p-4 rounded-lg border ${
                    voice.voiceId === selectedVoice 
                      ? 'border-primary bg-primary/5' 
                      : 'border-gray-200 hover:bg-gray-50'
                  } cursor-pointer transition-colors`}
                  onClick={() => onVoiceSelect(voice.voiceId)}
                >
                  <div className="flex items-start mb-2">
                    <RadioGroupItem 
                      value={voice.voiceId} 
                      id={`voice-${voice.voiceId}`} 
                      className="h-4 w-4 mt-1"
                    />
                    <div className="ml-3 flex-1">
                      <Label 
                        htmlFor={`voice-${voice.voiceId}`} 
                        className="font-medium text-gray-800 cursor-pointer"
                      >
                        {voice.name}
                      </Label>
                      <div className="flex space-x-2 mt-1">
                        {voice.gender && (
                          <span className="inline-block bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 text-xs">
                            {voice.gender}
                          </span>
                        )}
                        {voice.accent && (
                          <span className="inline-block bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 text-xs">
                            {voice.accent}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className={`ml-auto rounded-full h-8 w-8 p-1 ${
                        previewingVoice === voice.voiceId 
                          ? 'bg-primary/20 text-primary animate-pulse' 
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        previewVoice(voice.voiceId);
                      }}
                    >
                      {previewingVoice === voice.voiceId ? (
                        <Volume2 className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 ml-7">
                    {voice.description}
                  </p>
                </div>
              ))}
            </RadioGroup>
          </TabsContent>
          
          <TabsContent value="dropdown" className="mt-4">
            <div className="space-y-4">
              <Select 
                value={selectedVoice}
                onValueChange={onVoiceSelect}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a voice" />
                </SelectTrigger>
                <SelectContent>
                  {filteredVoices.map((voice) => (
                    <SelectItem key={voice.id} value={voice.voiceId}>
                      {voice.name} - {voice.accent} {voice.gender}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {selectedVoiceObj && (
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-gray-800">{selectedVoiceObj.name}</h3>
                      <div className="flex space-x-2 mt-1 mb-2">
                        {selectedVoiceObj.gender && (
                          <span className="inline-block bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 text-xs">
                            {selectedVoiceObj.gender}
                          </span>
                        )}
                        {selectedVoiceObj.accent && (
                          <span className="inline-block bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 text-xs">
                            {selectedVoiceObj.accent}
                          </span>
                        )}
                        {selectedVoiceObj.style && (
                          <span className="inline-block bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 text-xs">
                            {selectedVoiceObj.style}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{selectedVoiceObj.description}</p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex items-center"
                      onClick={() => previewVoice(selectedVoiceObj.voiceId)}
                    >
                      {previewingVoice === selectedVoiceObj.voiceId ? (
                        <Volume2 className="h-3 w-3 mr-1" />
                      ) : (
                        <Play className="h-3 w-3 mr-1" />
                      )}
                      <span className="text-xs">Preview</span>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default VoiceSelectionSection;
