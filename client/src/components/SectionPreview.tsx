import React, { useEffect, useRef } from 'react';
import { displaySections } from '@/lib/textParser';

interface SectionPreviewProps {
  sections: { [title: string]: string[] };
  maxHeight?: string;
}

/**
 * Component to display parsed sections with formatting
 */
const SectionPreview: React.FC<SectionPreviewProps> = ({ 
  sections, 
  maxHeight = '300px' 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // When sections change, update the display
    if (containerRef.current) {
      displaySections(sections, containerRef.current);
    }
  }, [sections]);
  
  return (
    <div className="border rounded-md p-4 bg-gray-50">
      <h3 className="text-sm font-medium mb-2 text-gray-700">Section Preview</h3>
      <div 
        ref={containerRef} 
        className="overflow-auto text-sm"
        style={{ maxHeight }}
      />
    </div>
  );
};

export default SectionPreview;