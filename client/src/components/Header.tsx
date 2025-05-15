import React from 'react';
import { Headphones } from 'lucide-react';

const Header: React.FC = () => {
  return (
    <header className="bg-gray-900 text-white py-4 shadow-lg">
      <div className="container mx-auto px-4 md:px-6 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Headphones className="h-6 w-6 text-primary" />
          <h1 className="text-xl md:text-2xl font-bold">AudioBook Creator</h1>
        </div>
        <div className="flex items-center">
          <span className="hidden md:inline-block text-gray-300 text-sm mr-2">Powered by</span>
          <span className="text-teal-400 font-semibold">ElevenLabs</span>
        </div>
      </div>
    </header>
  );
};

export default Header;
