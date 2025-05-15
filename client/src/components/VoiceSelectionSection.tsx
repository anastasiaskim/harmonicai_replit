import React from 'react';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Mic2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface Voice {
  id: number;
  voiceId: string;
  name: string;
  description: string;
}

interface VoiceSelectionSectionProps {
  voices: Voice[];
  isLoading: boolean;
  selectedVoice: string;
  onVoiceSelect: (voiceId: string) => void;
}

const VoiceSelectionSection: React.FC<VoiceSelectionSectionProps> = ({
  voices,
  isLoading,
  selectedVoice,
  onVoiceSelect,
}) => {
  // Function to play voice preview (in a real app, this would fetch a sample from ElevenLabs)
  const playVoicePreview = (voiceId: string) => {
    // This is a placeholder - in a real implementation, we would fetch and play 
    // an audio sample from the ElevenLabs API
    alert(`Playing preview of ${voiceId} voice. In a real implementation, this would play a sample audio clip.`);
  };

  return (
    <Card>
      <CardContent className="p-6">
        <CardTitle className="font-bold text-xl text-gray-800 mb-4 flex items-center">
          <Mic2 className="h-5 w-5 text-primary mr-2" />
          Select Voice
        </CardTitle>
        
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center p-3 rounded-lg border border-gray-200">
                <Skeleton className="h-4 w-4 rounded-full" />
                <div className="ml-3 space-y-1.5 flex-1">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-3 w-full" />
                </div>
                <Skeleton className="h-8 w-8 rounded-full" />
              </div>
            ))}
          </div>
        ) : (
          <RadioGroup 
            value={selectedVoice} 
            onValueChange={onVoiceSelect}
            className="space-y-3"
          >
            {voices.map((voice) => (
              <div 
                key={voice.id} 
                className="flex items-center p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer"
              >
                <RadioGroupItem 
                  value={voice.voiceId} 
                  id={`voice-${voice.voiceId}`} 
                  className="h-4 w-4"
                />
                <Label 
                  htmlFor={`voice-${voice.voiceId}`} 
                  className="ml-3 flex flex-col cursor-pointer flex-1"
                >
                  <span className="font-medium text-gray-800">{voice.name}</span>
                  <span className="text-xs text-gray-500">{voice.description}</span>
                </Label>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="ml-auto bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full h-8 w-8 p-1"
                  onClick={(e) => {
                    e.preventDefault();
                    playVoicePreview(voice.voiceId);
                  }}
                >
                  <Play className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </RadioGroup>
        )}
      </CardContent>
    </Card>
  );
};

export default VoiceSelectionSection;
