import React from 'react';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Eye, BookOpen } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TextPreviewSectionProps {
  text: string;
  chapters: { title: string; text: string }[];
}

const TextPreviewSection: React.FC<TextPreviewSectionProps> = ({ text, chapters }) => {
  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <CardTitle className="font-bold text-xl text-gray-800 flex items-center">
            <Eye className="h-5 w-5 text-primary mr-2" />
            Text Preview
          </CardTitle>
          <div className="text-xs text-gray-500 flex items-center">
            <BookOpen className="h-3.5 w-3.5 mr-1" />
            <span>{chapters.length} chapters detected</span>
          </div>
        </div>
        
        <ScrollArea className="border border-gray-200 rounded-lg p-4 h-64 font-serif text-gray-800 bg-gray-50">
          {text ? (
            chapters.length > 0 ? (
              <div>
                <h3 className="font-medium mb-2">{chapters[0].title}</h3>
                <div className="whitespace-pre-line">{chapters[0].text}</div>
              </div>
            ) : (
              <p>{text}</p>
            )
          ) : (
            <p className="text-gray-400 text-center my-12">Upload a file or paste text to preview content</p>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default TextPreviewSection;
