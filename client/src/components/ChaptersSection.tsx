import { useState } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AIChapterConfidence } from '@/components/AIChapterConfidence';
import { ApiKeyManagement } from '@/components/ApiKeyManagement';
import { estimateReadingTime, estimateAudioSize } from '@/lib/chapterDetection';

interface Chapter {
  title: string;
  text: string;
}

interface ChaptersSectionProps {
  chapters: Chapter[];
  wasChunked: boolean;
  aiDetection?: boolean;
  confidenceLevels?: Record<string, number>;
  onSelectChapters: (chapters: Chapter[]) => void;
}

export function ChaptersSection({ 
  chapters, 
  wasChunked, 
  aiDetection = false,
  confidenceLevels = {},
  onSelectChapters 
}: ChaptersSectionProps) {
  const [selectedChapters, setSelectedChapters] = useState<number[]>(
    chapters.map((_, index) => index)
  );
  
  // Toggle selection of a chapter
  const toggleChapter = (index: number) => {
    if (selectedChapters.includes(index)) {
      setSelectedChapters(selectedChapters.filter(i => i !== index));
    } else {
      setSelectedChapters([...selectedChapters, index].sort((a, b) => a - b));
    }
  };
  
  // Select all chapters
  const selectAll = () => {
    setSelectedChapters(chapters.map((_, index) => index));
  };
  
  // Deselect all chapters
  const deselectAll = () => {
    setSelectedChapters([]);
  };
  
  // Handle confirmation of chapter selection
  const handleConfirm = () => {
    const filtered = chapters.filter((_, index) => selectedChapters.includes(index));
    onSelectChapters(filtered);
  };
  
  // Calculate total selected content stats
  const selectedContent = chapters.filter((_, index) => selectedChapters.includes(index));
  const totalWords = selectedContent.reduce((sum, chapter) => {
    return sum + chapter.text.split(/\s+/).filter(Boolean).length;
  }, 0);
  const totalCharacters = selectedContent.reduce((sum, chapter) => sum + chapter.text.length, 0);
  const totalEstimatedReadingTime = Math.round(selectedContent.reduce((sum, chapter) => {
    return sum + estimateReadingTime(chapter.text);
  }, 0) / 60); // Convert to minutes
  const totalEstimatedAudioSize = Math.round(selectedContent.reduce((sum, chapter) => {
    return sum + estimateAudioSize(chapter.text);
  }, 0) / (1024 * 1024)); // Convert to MB
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Book Chapters</h2>
          <p className="text-gray-500 mt-1">
            {wasChunked ? 
              `${chapters.length} chapters detected` : 
              "No chapters detected, processing entire text as one chapter"
            }
            {aiDetection && (
              <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-700">
                AI Enhanced
              </Badge>
            )}
          </p>
        </div>
        
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={selectAll}
          >
            Select All
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={deselectAll}
          >
            Deselect All
          </Button>
        </div>
      </div>
      
      <Tabs defaultValue="chapters">
        <TabsList className="grid grid-cols-2 w-[400px]">
          <TabsTrigger value="chapters">Chapters</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        
        <TabsContent value="chapters" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <Accordion type="multiple" className="w-full border rounded-md">
                {chapters.map((chapter, index) => {
                  const isSelected = selectedChapters.includes(index);
                  const wordCount = chapter.text.split(/\s+/).filter(Boolean).length;
                  const readingTime = Math.round(estimateReadingTime(chapter.text) / 60); // Minutes
                  const audioSize = Math.round((estimateAudioSize(chapter.text) / 1024) * 10) / 10; // KB
                  
                  return (
                    <AccordionItem value={index.toString()} key={index} className="px-1">
                      <div className="flex items-center py-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleChapter(index)}
                          className="mr-3 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <AccordionTrigger className="hover:no-underline flex-1">
                          <div className="text-left">
                            <h3 className="text-sm font-medium text-gray-900">
                              {chapter.title}
                            </h3>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-500">
                              <span>{wordCount} words</span>
                              <span>{readingTime} min read</span>
                              <span>~{audioSize} KB audio</span>
                              {aiDetection && confidenceLevels && confidenceLevels[chapter.title] && (
                                <span className={`font-medium ${getConfidenceColor(confidenceLevels[chapter.title])}`}>
                                  {Math.round(confidenceLevels[chapter.title] * 100)}% confidence
                                </span>
                              )}
                            </div>
                          </div>
                        </AccordionTrigger>
                      </div>
                      <AccordionContent className="text-sm text-gray-700 border-t pt-2 mt-1 pb-3">
                        <p className="whitespace-pre-line">
                          {chapter.text.length > 500 
                            ? `${chapter.text.substring(0, 500)}...` 
                            : chapter.text
                          }
                        </p>
                        {chapter.text.length > 500 && (
                          <div className="mt-2 text-center">
                            <span className="text-xs text-gray-500">
                              Text is truncated for preview. Full text will be processed.
                            </span>
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </div>
            
            <div className="space-y-6">
              {/* AI Confidence Component */}
              {aiDetection && Object.keys(confidenceLevels || {}).length > 0 && (
                <AIChapterConfidence 
                  confidenceLevels={confidenceLevels || {}} 
                  usedAI={Boolean(aiDetection)}
                />
              )}
              
              {/* Statistics Card */}
              <div className="bg-white shadow-sm border rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Selection Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Chapters:</span>
                    <span className="font-medium">{selectedChapters.length} of {chapters.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Words:</span>
                    <span className="font-medium">{totalWords.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Characters:</span>
                    <span className="font-medium">{totalCharacters.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Estimated reading:</span>
                    <span className="font-medium">{totalEstimatedReadingTime} minutes</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Estimated audio size:</span>
                    <span className="font-medium">{totalEstimatedAudioSize} MB</span>
                  </div>
                </div>
              </div>
              
              <Button 
                onClick={handleConfirm}
                className="w-full"
                disabled={selectedChapters.length === 0}
              >
                Continue with Selection
              </Button>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="settings" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <ApiKeyManagement />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Helper function to get text color based on confidence level
function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'text-green-600';
  if (confidence >= 0.5) return 'text-yellow-600';
  return 'text-red-600';
}