import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info, Plus, Trash2 } from 'lucide-react';

interface Chapter {
  title: string;
  text: string;
}

interface ManualChapterSplitSectionProps {
  text: string;
  onChaptersCreated: (chapters: Chapter[]) => void;
}

export function ManualChapterSplitSection({ text, onChaptersCreated }: ManualChapterSplitSectionProps) {
  // Initial chapter with all text
  const [chapters, setChapters] = useState<Chapter[]>([
    { title: 'Chapter 1', text: text || '' }
  ]);
  
  // Add a new chapter
  const addChapter = () => {
    setChapters([...chapters, { title: `Chapter ${chapters.length + 1}`, text: '' }]);
  };
  
  // Remove a chapter
  const removeChapter = (index: number) => {
    // Don't allow removing the last chapter
    if (chapters.length <= 1) return;
    
    // Merge the text with the previous chapter if available
    const updatedChapters = [...chapters];
    if (index > 0) {
      updatedChapters[index - 1].text += ' ' + updatedChapters[index].text;
    } else if (index === 0 && chapters.length > 1) {
      // If removing the first chapter, merge with the second
      updatedChapters[1].text = updatedChapters[0].text + ' ' + updatedChapters[1].text;
    }
    
    // Remove the chapter
    updatedChapters.splice(index, 1);
    
    // Update chapter titles to maintain sequence
    const renamedChapters = updatedChapters.map((chapter, idx) => ({
      ...chapter,
      title: chapter.title.startsWith('Chapter ') ? `Chapter ${idx + 1}` : chapter.title
    }));
    
    setChapters(renamedChapters);
  };
  
  // Update chapter title
  const updateChapterTitle = (index: number, title: string) => {
    const updatedChapters = [...chapters];
    updatedChapters[index].title = title;
    setChapters(updatedChapters);
  };
  
  // Update chapter text
  const updateChapterText = (index: number, text: string) => {
    const updatedChapters = [...chapters];
    updatedChapters[index].text = text;
    setChapters(updatedChapters);
  };
  
  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Filter out empty chapters
    const nonEmptyChapters = chapters.filter(chapter => chapter.text.trim() !== '');
    onChaptersCreated(nonEmptyChapters.length > 0 ? nonEmptyChapters : [{ title: 'Chapter 1', text }]);
  };
  
  // Calculate stats for validation
  const totalCharacters = chapters.reduce((sum, chapter) => sum + chapter.text.length, 0);
  const originalCharacters = text.length;
  const characterDiff = Math.abs(totalCharacters - originalCharacters);
  const diffPercentage = originalCharacters > 0 ? (characterDiff / originalCharacters) * 100 : 0;
  
  // Warning threshold - if more than 5% of characters are missing or added
  const showWarning = diffPercentage > 5;
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Manual Chapter Split</CardTitle>
          <CardDescription>
            Split your text into chapters manually by dividing the content below.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {showWarning && (
            <Alert className="mb-6 bg-amber-50 border-amber-200">
              <Info className="h-4 w-4 text-amber-500" />
              <AlertTitle className="text-amber-800">Content Changed</AlertTitle>
              <AlertDescription className="text-amber-700">
                The total text content has changed by approximately {diffPercentage.toFixed(1)}%. 
                Original: {originalCharacters.toLocaleString()} characters, 
                Current: {totalCharacters.toLocaleString()} characters.
              </AlertDescription>
            </Alert>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-8">
            {chapters.map((chapter, index) => (
              <div key={index} className="space-y-3 pb-6 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Label htmlFor={`chapter-title-${index}`} className="text-sm font-medium text-gray-700">
                      Chapter Title
                    </Label>
                    <Input
                      id={`chapter-title-${index}`}
                      value={chapter.title}
                      onChange={(e) => updateChapterTitle(index, e.target.value)}
                      className="mt-1"
                      required
                    />
                  </div>
                  
                  <div className="ml-4">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removeChapter(index)}
                      disabled={chapters.length <= 1}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div>
                  <Label htmlFor={`chapter-text-${index}`} className="text-sm font-medium text-gray-700">
                    Chapter Content
                  </Label>
                  <Textarea
                    id={`chapter-text-${index}`}
                    value={chapter.text}
                    onChange={(e) => updateChapterText(index, e.target.value)}
                    className="mt-1 h-40"
                    placeholder="Enter chapter text here..."
                    required
                  />
                  <div className="text-right text-xs text-gray-500 mt-1">
                    {chapter.text.length.toLocaleString()} characters
                  </div>
                </div>
              </div>
            ))}
            
            <div className="flex justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={addChapter}
                className="flex items-center gap-1"
              >
                <Plus className="h-4 w-4" /> Add Chapter
              </Button>
              
              <Button type="submit">
                Continue with Chapters
              </Button>
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex justify-between border-t pt-6">
          <div className="text-sm text-gray-500">
            Total: {chapters.length} chapters, {totalCharacters.toLocaleString()} characters
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}