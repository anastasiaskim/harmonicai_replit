import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { BookOpen, CheckCircle } from 'lucide-react';

const IntroSection: React.FC = () => {
  return (
    <section className="mb-12">
      <Card className="overflow-hidden">
        <div className="md:flex">
          <div className="md:flex-shrink-0">
            {/* A person listening to audiobooks with headphones on a comfortable couch */}
            <img 
              className="h-48 w-full object-cover md:w-64" 
              src="https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=400" 
              alt="Person listening to audiobooks" 
            />
          </div>
          <CardContent className="p-6">
            <div className="flex items-center">
              <BookOpen className="h-5 w-5 text-primary mr-2" />
              <h2 className="text-2xl font-bold text-gray-800">Create Your Audiobook</h2>
            </div>
            <p className="mt-3 text-gray-600">
              Transform your text files into high-quality audiobooks using advanced AI voices. Upload your text, select a voice, and enjoy your content in audio format.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <div className="bg-gray-100 rounded-full px-3 py-1 text-xs font-medium text-gray-700 flex items-center">
                <CheckCircle className="h-3 w-3 mr-1" />
                TXT, EPUB, PDF Support
              </div>
              <div className="bg-gray-100 rounded-full px-3 py-1 text-xs font-medium text-gray-700 flex items-center">
                <CheckCircle className="h-3 w-3 mr-1" />
                AI-powered Voices
              </div>
              <div className="bg-gray-100 rounded-full px-3 py-1 text-xs font-medium text-gray-700 flex items-center">
                <CheckCircle className="h-3 w-3 mr-1" />
                Chapter Detection
              </div>
              <div className="bg-gray-100 rounded-full px-3 py-1 text-xs font-medium text-gray-700 flex items-center">
                <CheckCircle className="h-3 w-3 mr-1" />
                MP3 Downloads
              </div>
            </div>
          </CardContent>
        </div>
      </Card>
    </section>
  );
};

export default IntroSection;
