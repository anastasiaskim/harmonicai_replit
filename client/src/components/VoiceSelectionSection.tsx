import React, { useState } from 'react';
import { Card, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Mic2, Play, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Hardcoded ElevenLabs voices
const ELEVENLABS_VOICES = [
  {
    id: 1,
    voiceId: "rachel",
    name: "Rachel",
    description: "Warm, natural female voice with clear enunciation",
    gender: "female",
    accent: "American",
    style: "conversational"
  },
  {
    id: 2,
    voiceId: "thomas",
    name: "Thomas",
    description: "Deep, authoritative male voice ideal for non-fiction",
    gender: "male", 
    accent: "American", 
    style: "authoritative"
  },
  {
    id: 3,
    voiceId: "emily",
    name: "Emily",
    description: "Soft, expressive voice perfect for fiction narratives",
    gender: "female", 
    accent: "British", 
    style: "expressive"
  },
  {
    id: 4,
    voiceId: "james",
    name: "James",
    description: "British accent with rich tone for narratives and storytelling",
    gender: "male", 
    accent: "British", 
    style: "storytelling"
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
  
  // State to track the currently previewing voice
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  
  // Function to play voice preview (in a real app, this would fetch a sample from ElevenLabs)
  const playVoicePreview = (voiceId: string) => {
    // Show the voice as previewing
    setPreviewingVoice(voiceId);
    
    // This is a placeholder - in a real implementation, we would fetch and play 
    // an audio sample from the ElevenLabs API
    setTimeout(() => {
      alert(`Playing preview of ${voiceId} voice. In a real implementation, this would play a sample audio clip.`);
      setPreviewingVoice(null);
    }, 500);
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
              {voices.map((voice) => (
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
                        playVoicePreview(voice.voiceId);
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
                  {voices.map((voice) => (
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
                      onClick={() => playVoicePreview(selectedVoiceObj.voiceId)}
                    >
                      <Play className="h-3 w-3 mr-1" />
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
