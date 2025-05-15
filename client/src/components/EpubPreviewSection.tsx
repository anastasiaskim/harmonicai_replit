import React, { useState } from 'react';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { BookOpen, List, FileText, ChevronRight } from 'lucide-react';
import { EpubParseResult, EpubChapter } from '@/lib/epubParserJszip';

interface EpubPreviewSectionProps {
  epubData: EpubParseResult;
  onSelectChapter: (content: string, title: string) => void;
  onUseAllContent: (content: string) => void;
}

const EpubPreviewSection: React.FC<EpubPreviewSectionProps> = ({
  epubData,
  onSelectChapter,
  onUseAllContent,
}) => {
  const [activeTab, setActiveTab] = useState('toc');
  const [selectedChapter, setSelectedChapter] = useState<EpubChapter | null>(null);
  
  // Format all chapters into a markdown string for processing
  const processAllContent = () => {
    let allContent = '';
    
    // Add book title as main heading
    allContent += `# ${epubData.title}\n\n`;
    
    // Process each chapter
    epubData.chapters.forEach(chapter => {
      if (chapter.text) {
        // Add chapter title as subheading
        allContent += `## ${chapter.title}\n\n`;
        allContent += `${chapter.text}\n\n`;
      }
    });
    
    onUseAllContent(allContent);
  };
  
  // Handle chapter selection
  const handleChapterClick = (chapter: EpubChapter) => {
    setSelectedChapter(chapter);
    
    // If the chapter has text already, we can process it immediately
    if (chapter.text) {
      const chapterContent = `## ${chapter.title}\n\n${chapter.text}`;
      onSelectChapter(chapterContent, chapter.title);
    }
  };
  
  return (
    <Card className="mt-6">
      <CardContent className="p-6">
        <CardTitle className="font-bold text-xl text-gray-800 mb-4 flex items-center">
          <BookOpen className="h-5 w-5 text-primary mr-2" />
          EPUB Preview: {epubData.title}
        </CardTitle>
        
        {/* Author information */}
        <div className="mb-4">
          <span className="text-sm text-gray-500">Author: </span>
          <span className="text-sm font-medium">{epubData.author || 'Unknown'}</span>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 mb-6 sm:grid-cols-3">
          <div className="bg-blue-50 p-3 rounded-md border border-blue-100">
            <div className="text-xs text-blue-500 font-medium">Chapters</div>
            <div className="text-xl font-bold text-blue-700">{epubData.chapters.length}</div>
          </div>
          <div className="bg-green-50 p-3 rounded-md border border-green-100">
            <div className="text-xs text-green-500 font-medium">Characters</div>
            <div className="text-xl font-bold text-green-700">
              {epubData.content ? epubData.content.length.toLocaleString() : 'N/A'}
            </div>
          </div>
          <div className="bg-purple-50 p-3 rounded-md border border-purple-100 col-span-2 sm:col-span-1">
            <div className="text-xs text-purple-500 font-medium">Format</div>
            <div className="text-xl font-bold text-purple-700">EPUB</div>
          </div>
        </div>
        
        {/* Metadata Information */}
        <div className="bg-gray-50 p-3 rounded-md border border-gray-200 mb-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Book Information</h3>
          <div className="grid grid-cols-1 gap-1 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Format:</span>
              <span className="font-medium">EPUB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Source:</span>
              <span className="font-medium">
                {epubData.chapters.some(ch => ch.id.startsWith('nav-')) ? 'NCX/OPF Metadata' : 'HTML Headings'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Chapters Detected:</span>
              <span className="font-medium">{epubData.chapters.length}</span>
            </div>
          </div>
        </div>
        
        {/* Cover image */}
        {epubData.coverUrl && (
          <div className="mb-6 flex justify-center">
            <img 
              src={epubData.coverUrl} 
              alt={`Cover for ${epubData.title}`} 
              className="max-h-64 rounded-md shadow-md border border-gray-200" 
            />
          </div>
        )}
        
        {/* Tabs for different views */}
        <Tabs defaultValue="toc" value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="toc" className="flex items-center">
              <List className="mr-2 h-4 w-4" />
              Table of Contents
            </TabsTrigger>
            <TabsTrigger value="content" className="flex items-center">
              <FileText className="mr-2 h-4 w-4" />
              Preview
            </TabsTrigger>
          </TabsList>
          
          {/* Table of Contents Tab */}
          <TabsContent value="toc" className="pt-4">
            <ScrollArea className="h-60 rounded-md border p-4">
              <div className="space-y-1">
                {/* Source indicator */}
                <div className="bg-blue-50 text-blue-700 text-xs p-2 mb-2 rounded-md border border-blue-100">
                  Source: {epubData.chapters.some(ch => ch.id.startsWith('nav-')) 
                    ? 'NCX/OPF Metadata' 
                    : epubData.chapters.some(ch => ch.id.startsWith('heading-'))
                      ? 'HTML Headings'
                      : 'Spine Items'
                  }
                </div>
                
                {epubData.chapters.map((chapter, index) => (
                  <div 
                    key={chapter.id || index}
                    className={`
                      p-2 rounded-md cursor-pointer transition-colors
                      ${selectedChapter?.id === chapter.id 
                        ? 'bg-primary text-white' 
                        : 'hover:bg-gray-100'
                      }
                    `}
                    style={{ 
                      marginLeft: `${chapter.level * 0.5}rem` 
                    }}
                    onClick={() => handleChapterClick(chapter)}
                  >
                    <div className="flex items-center">
                      <ChevronRight className="h-4 w-4 mr-1 flex-shrink-0" />
                      <span className="text-sm truncate">{chapter.title}</span>
                      
                      {/* Show badge for heading-based chapters */}
                      {chapter.id.startsWith('heading-') && (
                        <span className={`ml-2 text-xs px-1 rounded ${
                          selectedChapter?.id === chapter.id 
                            ? 'bg-white bg-opacity-20 text-white' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          H{chapter.level + 1}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            
            <div className="mt-4 flex justify-between">
              <Button 
                variant="outline" 
                size="sm"
                className="text-xs"
                onClick={() => setActiveTab('content')}
              >
                Preview Selected Chapter
              </Button>
              
              <Button 
                variant="default" 
                size="sm"
                className="text-xs"
                onClick={processAllContent}
              >
                Use Entire Book
              </Button>
            </div>
          </TabsContent>
          
          {/* Content Preview Tab */}
          <TabsContent value="content" className="pt-4 relative">
            {selectedChapter ? (
              <>
                <div className="bg-blue-50 p-2 rounded-md mb-3 border border-blue-100">
                  <h3 className="font-medium text-blue-700">{selectedChapter.title}</h3>
                </div>
                
                <ScrollArea className="h-60 rounded-md border p-4">
                  <div className="prose prose-sm max-w-none">
                    <p>{selectedChapter.text || 'Loading chapter content...'}</p>
                  </div>
                </ScrollArea>
                
                <div className="mt-4 flex justify-between">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="text-xs"
                    onClick={() => setActiveTab('toc')}
                  >
                    Back to Contents
                  </Button>
                  
                  {selectedChapter.text && (
                    <Button 
                      variant="default" 
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        const chapterContent = `## ${selectedChapter.title}\n\n${selectedChapter.text}`;
                        onSelectChapter(chapterContent, selectedChapter.title);
                      }}
                    >
                      Use This Chapter
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center p-10 bg-gray-50 rounded-md border border-gray-200">
                <BookOpen className="h-10 w-10 mx-auto text-gray-400 mb-2" />
                <p className="text-gray-500">Select a chapter from the Table of Contents to preview it here.</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-4"
                  onClick={() => setActiveTab('toc')}
                >
                  View Table of Contents
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default EpubPreviewSection;