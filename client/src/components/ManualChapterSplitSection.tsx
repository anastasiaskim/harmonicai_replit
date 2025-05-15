import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Card } from '@/components/ui/card';
import { AlertTriangle, Scissors, Save, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();

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
              <Label htmlFor={`chapter-content-${index}`} className="mb-1.5 block text-xs">
                Chapter Content
              </Label>
              <Textarea
                id={`chapter-content-${index}`}
                value={chapter.text}
                onChange={(e) => updateChapterText(index, e.target.value)}
                rows={6}
                className="text-sm resize-y"
              />
              <div className="text-xs text-slate-500 mt-1 text-right">
                {chapter.text.length.toLocaleString()} characters
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ManualChapterSplitSection;