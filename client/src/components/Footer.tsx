import React from 'react';
import { Link } from 'wouter';
import { Headphones } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="mt-12 bg-gray-900 text-white py-6">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="text-center md:text-left mb-4 md:mb-0">
            <h3 className="flex items-center justify-center md:justify-start">
              <Headphones className="h-5 w-5 text-primary mr-2" />
              <span className="font-bold">AudioBook Creator</span>
            </h3>
            <p className="text-sm text-gray-300 mt-1">Convert your text to professional-sounding audiobooks</p>
          </div>
          
          <div className="flex flex-col space-y-2 md:flex-row md:space-y-0 md:space-x-6 text-sm text-gray-300">
            <Link href="#" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="#" className="hover:text-white transition-colors">Terms of Service</Link>
            <Link href="#" className="hover:text-white transition-colors">Help & Support</Link>
          </div>
        </div>
        
        <div className="mt-6 pt-6 border-t border-gray-700 text-xs text-gray-400 text-center">
          <p>© {new Date().getFullYear()} AudioBook Creator. All rights reserved.</p>
          <p className="mt-1">Powered by ElevenLabs Text-to-Speech Technology</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
