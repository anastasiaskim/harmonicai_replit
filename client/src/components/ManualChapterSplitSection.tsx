import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Card } from '@/components/ui/card';
import { AlertTriangle, Scissors, Save, Plus, Trash2, Wand2, BookOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { parseSections, formatSectionContent } from '@/lib/textParser';
import { CHAPTER_PATTERNS } from '@/lib/chapterDetection';

interface Chapter {
  title: string;
  text: string;
}

interface ManualChapterSplitSectionProps {
  originalText: string;
  onSplitComplete: (chapters: Chapter[]) => void;
}

const ManualChapterSplitSection: React.FC<ManualChapterSplitSectionProps> = ({
  originalText,
  onSplitComplete
}) => {
  const [chapters, setChapters] = useState<Chapter[]>([
    { title: 'Chapter 1', text: originalText || '' }
  ]);
  const [isAutoDetecting, setIsAutoDetecting] = useState<boolean>(false);
  const { toast } = useToast();
  
  // Initialize with one chapter containing all the text
  useEffect(() => {
    if (originalText) {
      setChapters([{ title: 'Chapter 1', text: originalText }]);
    }
  }, [originalText]);

  // Add a new chapter at the end
  const addChapter = () => {
    // Split the text of the last chapter in half
    const lastChapter = chapters[chapters.length - 1];
    const lastChapterText = lastChapter.text;
    const splitPoint = Math.floor(lastChapterText.length / 2);
    
    // Create two new texts
    const firstHalf = lastChapterText.substring(0, splitPoint);
    const secondHalf = lastChapterText.substring(splitPoint);
    
    // Update the last chapter and add a new one
    const updatedChapters = [...chapters];
    updatedChapters[updatedChapters.length - 1].text = firstHalf;
    
    setChapters([
      ...updatedChapters,
      { title: `Chapter ${chapters.length + 1}`, text: secondHalf }
    ]);
  };

  // Remove a chapter
  const removeChapter = (index: number) => {
    if (chapters.length <= 1) {
      toast({
        title: "Cannot Remove",
        description: "You must have at least one chapter.",
        variant: "destructive"
      });
      return;
    }

    const updatedChapters = chapters.filter((_, i) => i !== index);
    setChapters(updatedChapters);
  };

  // Update a chapter title
  const updateChapterTitle = (index: number, newTitle: string) => {
    const updatedChapters = [...chapters];
    updatedChapters[index].title = newTitle;
    setChapters(updatedChapters);
  };

  // Update a chapter text
  const updateChapterText = (index: number, newText: string) => {
    const updatedChapters = [...chapters];
    updatedChapters[index].text = newText;
    setChapters(updatedChapters);
  };

  // Try to automatically detect chapters based on common patterns
  const tryAutoDetect = () => {
    if (!originalText) return;
    
    setIsAutoDetecting(true);
    
    try {
      // First try to detect sections using our parser
      const { sections, patternMatches } = parseSections(originalText, CHAPTER_PATTERNS);
      
      // Convert the sections to chapters
      const detectedChapters: Chapter[] = Object.entries(sections).map(([title, contentLines]) => ({
        title,
        text: formatSectionContent(contentLines)
      }));
      
      // Only update if we found more than one section
      if (detectedChapters.length > 1) {
        setChapters(detectedChapters);
        toast({
          title: "Chapters Auto-Detected",
          description: `Found ${detectedChapters.length} potential chapters in your text.`,
        });
      } else {
        // If we couldn't find chapters through pattern matching, try a simpler split
        const roughSplit = splitByHeuristics(originalText);
        if (roughSplit.length > 1) {
          setChapters(roughSplit);
          toast({
            title: "Basic Split Applied",
            description: `Split text into ${roughSplit.length} equal parts. Review and adjust as needed.`,
          });
        } else {
          toast({
            title: "No Chapters Detected",
            description: "Couldn't automatically detect chapters. Try splitting manually.",
            variant: "destructive"
          });
        }
      }
    } catch (err) {
      toast({
        title: "Detection Failed",
        description: "Error while trying to detect chapters. Try splitting manually.",
        variant: "destructive"
      });
    } finally {
      setIsAutoDetecting(false);
    }
  };
  
  // Fallback approach: split text into roughly equal chunks
  const splitByHeuristics = (text: string): Chapter[] => {
    // If text is short, don't split
    if (text.length < 2000) {
      return [{ title: 'Chapter 1', text }];
    }
    
    // Determine how many chunks to create based on text length
    const chunkCount = Math.min(
      Math.max(2, Math.floor(text.length / 5000)),
      10
    );
    
    // Split into roughly equal chunks
    const chunkSize = Math.ceil(text.length / chunkCount);
    const chunks: Chapter[] = [];
    
    let currentPosition = 0;
    for (let i = 0; i < chunkCount; i++) {
      // Try to find a natural break point (paragraph or sentence end)
      let endPosition = Math.min(currentPosition + chunkSize, text.length);
      
      // If we're not at the end, try to find a paragraph break
      if (endPosition < text.length) {
        // Look for paragraph break within 20% of ideal chunk size
        const searchWindowStart = Math.max(
          currentPosition + Math.floor(chunkSize * 0.8),
          currentPosition + 100
        );
        const searchWindowEnd = Math.min(
          currentPosition + Math.ceil(chunkSize * 1.2),
          text.length
        );
        
        const searchArea = text.substring(searchWindowStart, searchWindowEnd);
        
        // Look for double newline (paragraph break)
        const paragraphBreak = searchArea.indexOf('\n\n');
        if (paragraphBreak !== -1) {
          endPosition = searchWindowStart + paragraphBreak + 2;
        } else {
          // Look for a single newline
          const lineBreak = searchArea.indexOf('\n');
          if (lineBreak !== -1) {
            endPosition = searchWindowStart + lineBreak + 1;
          } else {
            // Look for a sentence end (period, question mark, exclamation)
            const sentenceMatch = searchArea.match(/[.!?]\s/);
            if (sentenceMatch && sentenceMatch.index !== undefined) {
              endPosition = searchWindowStart + sentenceMatch.index + 2;
            }
          }
        }
      }
      
      // Extract the chunk
      const chunkText = text.substring(currentPosition, endPosition).trim();
      chunks.push({
        title: `Chapter ${i + 1}`,
        text: chunkText
      });
      
      currentPosition = endPosition;
    }
    
    return chunks;
  };
  
  // Save the manual split
  const saveSplit = () => {
    if (chapters.some(chapter => !chapter.text.trim())) {
      toast({
        title: "Empty Chapter",
        description: "Some chapters have no content. Please add content or remove empty chapters.",
        variant: "destructive"
      });
      return;
    }

    onSplitComplete(chapters);
    toast({
      title: "Chapters Saved",
      description: `Successfully created ${chapters.length} chapters manually.`
    });
  };

  return (
    <div className="mb-8">
      <div className="bg-amber-50 border border-amber-200 rounded-md p-4 mb-6">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-800">Automatic Chapter Detection Failed</h3>
            <p className="text-sm text-amber-700 mt-1">
              We couldn't automatically detect chapters in your text. You can manually split your text into chapters below.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold flex items-center">
          <Scissors className="h-5 w-5 mr-2 text-primary" />
          Manual Chapter Split
        </h2>
        <div className="flex space-x-3">
          <Button 
            variant="outline" 
            size="sm"
            onClick={tryAutoDetect}
            disabled={isAutoDetecting}
            className="text-xs"
          >
            <Wand2 className="h-3.5 w-3.5 mr-1" />
            {isAutoDetecting ? 'Detecting...' : 'Auto Detect'}
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={addChapter}
            className="text-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Chapter
          </Button>
          <Button
            onClick={saveSplit}
            size="sm"
            className="bg-primary hover:bg-primary/90 text-xs"
          >
            <Save className="h-3.5 w-3.5 mr-1" />
            Save Chapters
          </Button>
        </div>
      </div>
      
      <div className="mb-4 text-xs text-gray-500">
        <div className="flex items-center">
          <BookOpen className="h-3.5 w-3.5 mr-1 text-gray-400" />
          <span>
            <span className="font-medium">Tip:</span> Try the "Auto Detect" button to find chapter boundaries, 
            then adjust as needed. You can also split text manually or add more chapters.
          </span>
        </div>
        <div className="mt-1 ml-4">
          <span className="font-medium text-primary">Current chapters:</span>{" "}
          {chapters.length === 1 ? (
            <span>Single chapter (entire text)</span>
          ) : (
            <span>
              {chapters.length} chapters - {chapters.map(c => c.title.split(":")[0]).join(", ")}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {chapters.map((chapter, index) => (
          <Card key={index} className="p-4">
            <div className="flex justify-between items-center mb-3">
              <div className="flex-1 mr-4">
                <Label htmlFor={`chapter-title-${index}`} className="mb-1.5 block text-xs">
                  Chapter Title
                </Label>
                <Input
                  id={`chapter-title-${index}`}
                  value={chapter.title}
                  onChange={(e) => updateChapterTitle(index, e.target.value)}
                  className="text-sm"
                  maxLength={100}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => removeChapter(index)}
                className="h-8 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            
            <Separator className="my-3" />
            
            <div>
              <div className="flex justify-between items-center">
                <Label htmlFor={`chapter-content-${index}`} className="mb-1.5 block text-xs">
                  Chapter Content
                </Label>
                <div className="text-xs text-slate-500">
                  {chapter.text.length.toLocaleString()} characters
                  {chapter.text.length > 0 && (
                    <span> • approx. {Math.ceil(chapter.text.split(/\s+/).length / 200)} min read</span>
                  )}
                </div>
              </div>
              <Textarea
                id={`chapter-content-${index}`}
                value={chapter.text}
                onChange={(e) => updateChapterText(index, e.target.value)}
                rows={6}
                className="text-sm resize-y"
              />
              <div className="mt-2 text-xs">
                <div className="flex justify-between">
                  <div>
                    <span className="text-slate-600 font-medium">Preview: </span>
                    <span className="text-slate-500">
                      {chapter.text.length > 0 
                        ? chapter.text.substring(0, 100) + (chapter.text.length > 100 ? '...' : '')
                        : 'No content in this chapter'}
                    </span>
                  </div>
                  <div className="flex space-x-2">
                    {chapter.text.split(/\s+/).length > 5 && (
                      <span className="text-xs text-slate-500 px-1.5 py-0.5 bg-slate-50 rounded border border-slate-100">
                        {chapter.text.split(/\s+/).length.toLocaleString()} words
                      </span>
                    )}
                    {chapter.text.split(/\r?\n/).length > 1 && (
                      <span className="text-xs text-slate-500 px-1.5 py-0.5 bg-slate-50 rounded border border-slate-100">
                        {chapter.text.split(/\r?\n/).length.toLocaleString()} paragraphs
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ManualChapterSplitSection;