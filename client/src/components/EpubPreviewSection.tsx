import React, { useState } from 'react';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { BookOpen, List, FileText, ChevronRight } from 'lucide-react';
import { EpubParseResult, EpubChapter, loadChapterContent } from '@/lib/epubParserJszip';

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
  const [chapterContentCache, setChapterContentCache] = useState<Record<string, {text: string, htmlContent: string}>>({});
  const [isLoadingChapter, setIsLoadingChapter] = useState(false);
  
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
  
  // Handle chapter selection with lazy loading
  const handleChapterClick = async (chapter: EpubChapter) => {
    setSelectedChapter(chapter);
    setActiveTab('content');
    // If already cached, do nothing
    if (chapterContentCache[chapter.id]) return;
    // If no zipInstance or opfDirWithSlash, cannot load
    if (!epubData.zipInstance || !epubData.opfDirWithSlash) return;
    setIsLoadingChapter(true);
    try {
      const content = await loadChapterContent(epubData.zipInstance, epubData.opfDirWithSlash, chapter);
      setChapterContentCache(prev => ({ ...prev, [chapter.id]: content }));
    } catch (e) {
      setChapterContentCache(prev => ({ ...prev, [chapter.id]: { text: 'Failed to load chapter content.', htmlContent: '' } }));
    } finally {
      setIsLoadingChapter(false);
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
              <span className="text-gray-500">Chapter Sources:</span>
              <span className="font-medium flex gap-1">
                {epubData.chapters.filter(ch => ch.source === 'ncx').length > 0 && (
                  <span className="bg-green-100 text-green-700 text-xs px-1 rounded">
                    NCX: {epubData.chapters.filter(ch => ch.source === 'ncx').length}
                  </span>
                )}
                {epubData.chapters.filter(ch => ch.source === 'heading').length > 0 && (
                  <span className="bg-blue-100 text-blue-700 text-xs px-1 rounded">
                    Headings: {epubData.chapters.filter(ch => ch.source === 'heading').length}
                  </span>
                )}
                {epubData.chapters.filter(ch => ch.source === 'spine').length > 0 && (
                  <span className="bg-purple-100 text-purple-700 text-xs px-1 rounded">
                    Spine: {epubData.chapters.filter(ch => ch.source === 'spine').length}
                  </span>
                )}
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
                {/* Source indicators */}
                <div className="bg-gray-50 text-gray-700 text-xs p-2 mb-2 rounded-md border border-gray-200">
                  <div className="font-medium mb-1">Chapter Sources:</div>
                  <div className="flex flex-wrap gap-1">
                    {epubData.chapters.filter(ch => ch.source === 'ncx').length > 0 && (
                      <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full">
                        NCX: {epubData.chapters.filter(ch => ch.source === 'ncx').length}
                      </span>
                    )}
                    {epubData.chapters.filter(ch => ch.source === 'heading').length > 0 && (
                      <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full">
                        Headings: {epubData.chapters.filter(ch => ch.source === 'heading').length}
                      </span>
                    )}
                    {epubData.chapters.filter(ch => ch.source === 'spine').length > 0 && (
                      <span className="bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded-full">
                        Spine: {epubData.chapters.filter(ch => ch.source === 'spine').length}
                      </span>
                    )}
                  </div>
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
                      
                      {/* Show source badge with different colors based on source */}
                      <span className={`ml-2 text-xs px-1 rounded ${
                        selectedChapter?.id === chapter.id 
                          ? 'bg-white bg-opacity-20 text-white' 
                          : chapter.source === 'ncx'
                            ? 'bg-green-100 text-green-700'
                            : chapter.source === 'heading'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-purple-100 text-purple-700'
                      }`}>
                        {chapter.source === 'ncx' 
                          ? 'NCX' 
                          : chapter.source === 'heading'
                            ? `H${chapter.level + 1}`
                            : 'Spine'
                        }
                      </span>
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
              isLoadingChapter ? (
                <div className="flex items-center justify-center h-40">
                  <span className="animate-spin inline-block h-8 w-8 border-4 border-blue-400 border-t-transparent rounded-full mr-2"></span>
                  <span className="text-blue-600 font-medium">Loading chapter content...</span>
                </div>
              ) : (
                <>
                  <div className="bg-blue-50 p-2 rounded-md mb-3 border border-blue-100">
                    <h3 className="font-medium text-blue-700">{selectedChapter.title}</h3>
                  </div>
                  <ScrollArea className="h-60 rounded-md border p-4">
                    <div className="prose prose-sm max-w-none">
                      {chapterContentCache[selectedChapter.id]?.htmlContent ? (
                        <div dangerouslySetInnerHTML={{ __html: chapterContentCache[selectedChapter.id].htmlContent }} />
                      ) : (
                        <p>{chapterContentCache[selectedChapter.id]?.text || 'No content available.'}</p>
                      )}
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
                    {chapterContentCache[selectedChapter.id]?.text && (
                      <Button 
                        variant="default" 
                        size="sm"
                        className="text-xs"
                        onClick={() => {
                          const chapterContent = `## ${selectedChapter.title}\n\n${chapterContentCache[selectedChapter.id]?.text || ''}`;
                          onSelectChapter(chapterContent, selectedChapter.title);
                        }}
                      >
                        Use This Chapter
                      </Button>
                    )}
                  </div>
                </>
              )
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