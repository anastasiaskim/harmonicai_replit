/**
 * Text Parser Module
 * Provides utilities for reading and parsing text files into sections
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
            reject(new Error("Failed to read file."));
        };

        reader.readAsText(file);
    });
}

/**
 * Section object representing a parsed section from the text
 */
export interface Section {
    title: string;
    content: string[];
}

/**
 * Parse text content into sections based on provided patterns
 * 
 * @param text The text content to parse
 * @param patterns Array of regular expressions that identify section headings
 * @returns An object containing the sections with their content and pattern match information
 */
export function parseSections(
    text: string, 
    patterns: RegExp[]
): { 
    sections: { [title: string]: string[] };
    patternMatches: { [title: string]: number };
} {
    const sections: { [title: string]: string[] } = {};
    const patternMatches: { [title: string]: number } = {};
    
    // Handle empty text
    if (!text || text.trim().length === 0) {
        return { sections, patternMatches };
    }
    
    // Split text into lines
    const lines = text.split(/\r?\n/);
    
    let currentSection: string | null = null;
    let currentContent: string[] = [];
    let beforeFirstSection: string[] = [];
    let foundFirstSection = false;

    // Process each line
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        let isHeading = false;
        
        // Check against all patterns
        for (let j = 0; j < patterns.length; j++) {
            const pattern = patterns[j];
            if (pattern.test(line)) {
                isHeading = true;
                
                // If we already have a section, save it
                if (currentSection) {
                    sections[currentSection] = currentContent;
                } else if (!foundFirstSection && beforeFirstSection.length > 0) {
                    // Save content before first section as "Introduction"
                    sections["Introduction"] = beforeFirstSection;
                }
                
                // Start a new section
                currentSection = extractSectionTitle(line, j);
                currentContent = [];
                patternMatches[currentSection] = j;
                foundFirstSection = true;
                break;
            }
        }
        
        // If this wasn't a heading, add to current section or pre-section content
        if (!isHeading) {
            if (foundFirstSection) {
                currentContent.push(line);
            } else {
                beforeFirstSection.push(line);
            }
        }
    }
    
    // Add the final section
    if (currentSection) {
        sections[currentSection] = currentContent;
    } else if (beforeFirstSection.length > 0) {
        // If we didn't find any sections, treat the whole content as "Chapter 1"
        sections["Chapter 1"] = beforeFirstSection;
    }
    
    return { sections, patternMatches };
}

/**
 * Extract a clean title from a section heading
 * 
 * @param line The heading line
 * @param patternIndex The index of the pattern that matched
 * @returns A clean section title
 */
function extractSectionTitle(line: string, patternIndex: number): string {
    // Clean up the title - remove excessive whitespace and punctuation
    let title = line.trim();
    
    // Try to extract meaningful parts for special section types
    if (/^\s*(chapter|CHAPTER)\s+(\d+|[IVXLCivxlc]+)/i.test(title)) {
        const match = title.match(/^\s*(chapter|CHAPTER)\s+(\d+|[IVXLCivxlc]+)(?:[:.]\s*(.*))?/i);
        if (match) {
            if (match[3]) {
                // Chapter with title: "Chapter 1: Introduction"
                return `${match[1]} ${match[2]}: ${match[3]}`;
            } else {
                // Just chapter number: "Chapter 1"
                return `${match[1]} ${match[2]}`;
            }
        }
    } else if (/^\s*(\d+|[IVXLCivxlc]+)\.\s+(.+)$/i.test(title)) {
        // Format like "1. The Beginning"
        const match = title.match(/^\s*(\d+|[IVXLCivxlc]+)\.\s+(.+)$/i);
        if (match) {
            return `Chapter ${match[1]}: ${match[2]}`;
        }
    } else if (/^\s*(\d+|[IVXLCivxlc]+)\s*$/i.test(title)) {
        // Just a number or Roman numeral
        const match = title.match(/^\s*(\d+|[IVXLCivxlc]+)\s*$/i);
        if (match) {
            return `Chapter ${match[1]}`;
        }
    }
    
    // For other patterns, just use the line as is
    return title;
}

/**
 * Convert a sections map to an array of section objects
 * 
 * @param sections Object mapping section titles to content arrays
 * @returns Array of section objects
 */
export function sectionsMapToArray(sections: { [title: string]: string[] }): Section[] {
    return Object.entries(sections).map(([title, content]) => ({
        title,
        content
    }));
}

/**
 * Format a section's content into a single string
 * 
 * @param content Array of content lines
 * @returns Single formatted string
 */
export function formatSectionContent(content: string[]): string {
    return content.join('\n');
}