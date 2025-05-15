/**
 * Text Parser Module
 * 
 * This module provides functionality for reading text files, parsing them into
 * sections based on patterns, and displaying the sections in the DOM.
 */

/**
 * Read a file and extract its content as text
 * 
 * @param file The file to read
 * @returns A promise that resolves with the file content as a string
 */
export async function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      if (event.target && typeof event.target.result === 'string') {
        resolve(event.target.result);
      } else {
        reject(new Error("Failed to read file."));
      }
    };
    
    reader.onerror = () => {
      reject(new Error("Error reading file."));
    };
    
    reader.readAsText(file);
  });
}

/**
 * Parse text content into sections based on a pattern
 * 
 * @param text The text content to parse
 * @param pattern Regular expression pattern to identify section titles
 * @returns Object with sections mapped by title
 */
export function parseSections(text: string, pattern: RegExp): { [title: string]: string[] } {
  const lines = text.split(/\r?\n/);
  const sections: { [title: string]: string[] } = {};
  let currentSection = 'Default Section';
  let currentContent: string[] = [];
  
  // Process each line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if line matches the section title pattern
    if (pattern.test(line)) {
      // If we have content for the previous section, store it
      if (currentContent.length > 0) {
        sections[currentSection] = currentContent;
      }
      
      // Start a new section
      currentSection = line;
      currentContent = [];
    } else {
      // Add line to current section content
      currentContent.push(line);
    }
  }
  
  // Add the last section
  if (currentContent.length > 0) {
    sections[currentSection] = currentContent;
  }
  
  return sections;
}

/**
 * Display sections in the DOM
 * 
 * @param sections Object mapping section titles to content arrays
 * @param outputElement The HTML element to display the sections in
 */
export function displaySections(sections: { [title: string]: string[] }, outputElement: HTMLElement): void {
  outputElement.innerHTML = ''; // Clear previous content
  
  for (const title in sections) {
    if (sections.hasOwnProperty(title)) {
      // Create section title element
      const sectionTitle = document.createElement('h2');
      sectionTitle.textContent = title;
      sectionTitle.className = 'section-title';
      outputElement.appendChild(sectionTitle);
      
      // Create container for section content
      const contentContainer = document.createElement('div');
      contentContainer.className = 'section-content';
      
      // Add each line of content as a paragraph
      const content = sections[title];
      for (const line of content) {
        if (line.trim().length > 0) { // Skip empty lines
          const paragraph = document.createElement('p');
          paragraph.textContent = line;
          contentContainer.appendChild(paragraph);
        } else {
          // Create spacing for empty lines
          const spacer = document.createElement('div');
          spacer.className = 'spacer';
          contentContainer.appendChild(spacer);
        }
      }
      
      outputElement.appendChild(contentContainer);
    }
  }
}

// Main execution and event listener setup
document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('fileInput') as HTMLInputElement;
  const outputElement = document.getElementById('output') as HTMLDivElement;
  
  if (!fileInput || !outputElement) {
    console.error("Could not find required elements");
    return;
  }
  
  fileInput.addEventListener('change', async (event) => {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      const file = target.files[0];
      
      try {
        // Display loading indicator
        outputElement.innerHTML = '<div class="loading">Processing file...</div>';
        
        // Read the file
        const text = await readFile(file);
        
        // Create pattern for section titles (## Section X)
        const pattern = new RegExp("^## Section \\d+$");
        
        // Parse the text into sections
        const sections = parseSections(text, pattern);
        
        // Display the sections
        displaySections(sections, outputElement);
        
        // Show summary
        const sectionCount = Object.keys(sections).length;
        const summaryElement = document.createElement('div');
        summaryElement.className = 'summary';
        summaryElement.textContent = `File processed successfully. Found ${sectionCount} section(s).`;
        outputElement.prepend(summaryElement);
        
      } catch (error) {
        console.error("Error processing file:", error);
        outputElement.innerHTML = `
          <div class="error">
            <h3>Error processing file</h3>
            <p>${error instanceof Error ? error.message : 'Unknown error'}</p>
          </div>
        `;
      }
    }
  });
});