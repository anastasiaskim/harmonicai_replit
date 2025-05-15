import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { ChevronRightIcon, BookOpenIcon, ListIcon } from 'lucide-react';
import { EpubChapter, EpubParseResult } from '@/lib/epubParser';

interface EpubPreviewSectionProps {
  epubData: EpubParseResult;
  onSelectChapter: (content: string, title: string) => void;
  onUseAllContent: (content: string) => void;
}

const EpubPreviewSection: React.FC<EpubPreviewSectionProps> = ({ 
  epubData, 
  onSelectChapter,
  onUseAllContent
}) => {
  const [selectedChapter, setSelectedChapter] = useState<EpubChapter | null>(
    epubData.chapters.length > 0 ? epubData.chapters[0] : null
  );
  const [activeTab, setActiveTab] = useState("toc");

  const handleChapterClick = (chapter: EpubChapter) => {
    setSelectedChapter(chapter);
    setActiveTab("preview");
  };

  const handleUseChapter = () => {
    if (selectedChapter && selectedChapter.text) {
      onSelectChapter(selectedChapter.text, selectedChapter.title);
    }
  };

  const handleUseAllContent = () => {
    if (epubData.content) {
      onUseAllContent(epubData.content);
    }
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpenIcon className="h-5 w-5 text-primary" />
          EPUB Preview: {epubData.title} {epubData.author ? `by ${epubData.author}` : ''}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="toc">
              <ListIcon className="mr-1 h-4 w-4" />
              Table of Contents
            </TabsTrigger>
            <TabsTrigger value="preview">
              <BookOpenIcon className="mr-1 h-4 w-4" />
              Chapter Preview
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="toc" className="mt-0">
            <div className="flex flex-col gap-4">
              <ScrollArea className="h-[300px] rounded-md border p-4">
                {epubData.chapters.map((chapter, index) => (
                  <div 
                    key={`${chapter.id}-${index}`} 
                    className={`
                      py-2 px-3 rounded-md cursor-pointer mb-1
                      ${selectedChapter?.id === chapter.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-gray-100'}
                      ${chapter.level > 0 ? `ml-${chapter.level * 4}` : ''}
                    `}
                    onClick={() => handleChapterClick(chapter)}
                  >
                    <div className="flex items-center gap-2">
                      <ChevronRightIcon className="h-4 w-4" />
                      <span className="flex-1 truncate">{chapter.title}</span>
                    </div>
                  </div>
                ))}
              </ScrollArea>
              
              <div className="flex justify-between mt-2">
                <Button variant="outline" onClick={handleUseAllContent}>
                  Use All Content
                </Button>
                <div className="text-xs text-gray-500">
                  {epubData.chapters.length} chapters detected
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="preview" className="mt-0">
            <div className="flex flex-col gap-4">
              <div className="py-2 px-4 bg-primary/5 rounded-md">
                <h3 className="font-medium text-primary">{selectedChapter?.title || 'Select a chapter'}</h3>
              </div>
              
              <ScrollArea className="h-[250px] rounded-md border p-4">
                {selectedChapter ? (
                  <div className="prose prose-sm">
                    {(selectedChapter.text || 'No content available for this chapter')
                      .split('\n')
                      .map((paragraph, i) => 
                        paragraph.trim() ? <p key={i}>{paragraph}</p> : null
                      )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    Select a chapter from the Table of Contents
                  </div>
                )}
              </ScrollArea>
              
              <div className="flex justify-end mt-2">
                <Button 
                  onClick={handleUseChapter}
                  disabled={!selectedChapter}
                >
                  Use This Chapter
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default EpubPreviewSection;