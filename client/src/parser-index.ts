/**
 * Text Parser - Standalone module
 * 
 * This file serves as the entry point for the text parser module when used outside 
 * of the React application. It exposes the core parsing functionality.
 */

import {
  readFile,
  parseSections,
  formatSectionContent,
  displaySections,
  initializeFileParser
} from './lib/textParser';

// Make functions available in the global scope
(window as any).TextParser = {
  readFile,
  parseSections,
  formatSectionContent,
  displaySections,
  initializeFileParser
};

// Initialize the parser when the document is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('Text Parser module loaded');
  
  // Find parser elements on the page
  const fileInput = document.getElementById('fileInput');
  const outputElement = document.getElementById('output');
  
  // If both elements exist, initialize the parser
  if (fileInput && outputElement) {
    initializeFileParser('fileInput', 'output');
  }
});