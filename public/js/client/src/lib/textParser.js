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
export async function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            if (event.target && typeof event.target.result === 'string') {
                resolve(event.target.result);
            }
            else {
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
 * Parse text content into sections based on provided patterns
 *
 * @param text The text content to parse
 * @param patterns Array of regular expressions that identify section headings
 * @returns An object containing the sections with their content and pattern match information
 */
export function parseSections(text, patterns) {
    const sections = {};
    const patternMatches = {};
    // Handle empty text
    if (!text || text.trim().length === 0) {
        return { sections, patternMatches };
    }
    // Split text into lines
    const lines = text.split(/\r?\n/);
    let currentSection = null;
    let currentContent = [];
    let beforeFirstSection = [];
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
                }
                else if (!foundFirstSection && beforeFirstSection.length > 0) {
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
            }
            else {
                beforeFirstSection.push(line);
            }
        }
    }
    // Add the final section
    if (currentSection) {
        sections[currentSection] = currentContent;
    }
    else if (beforeFirstSection.length > 0) {
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
function extractSectionTitle(line, patternIndex) {
    // Clean up the title - remove excessive whitespace and punctuation
    let title = line.trim();
    // Try to extract meaningful parts for special section types
    if (/^\s*(chapter|CHAPTER)\s+(\d+|[IVXLCivxlc]+)/i.test(title)) {
        const match = title.match(/^\s*(chapter|CHAPTER)\s+(\d+|[IVXLCivxlc]+)(?:[:.]\s*(.*))?/i);
        if (match) {
            if (match[3]) {
                // Chapter with title: "Chapter 1: Introduction"
                return `${match[1]} ${match[2]}: ${match[3]}`;
            }
            else {
                // Just chapter number: "Chapter 1"
                return `${match[1]} ${match[2]}`;
            }
        }
    }
    else if (/^\s*(\d+|[IVXLCivxlc]+)\.\s+(.+)$/i.test(title)) {
        // Format like "1. The Beginning"
        const match = title.match(/^\s*(\d+|[IVXLCivxlc]+)\.\s+(.+)$/i);
        if (match) {
            return `Chapter ${match[1]}: ${match[2]}`;
        }
    }
    else if (/^\s*(\d+|[IVXLCivxlc]+)\s*$/i.test(title)) {
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
export function sectionsMapToArray(sections) {
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
export function formatSectionContent(content) {
    return content.join('\n');
}
/**
 * Display sections in the DOM
 *
 * @param sections Object mapping section titles to content arrays
 * @param outputElement The HTML element to display the sections in
 */
export function displaySections(sections, outputElement) {
    outputElement.innerHTML = ''; // Clear previous content
    for (const title in sections) {
        if (sections.hasOwnProperty(title)) {
            // Create section title element
            const sectionTitle = document.createElement('h2');
            sectionTitle.textContent = title;
            sectionTitle.className = 'text-lg font-semibold text-gray-800 mt-4 mb-2';
            outputElement.appendChild(sectionTitle);
            // Create container for section content
            const contentContainer = document.createElement('div');
            contentContainer.className = 'mb-4 text-gray-700';
            // Add each line of content as a paragraph
            const content = sections[title];
            if (content.length > 0) {
                // Join content lines with appropriate spacing for paragraphs
                for (const line of content) {
                    if (line.trim().length > 0) { // Skip empty lines
                        const paragraph = document.createElement('p');
                        paragraph.textContent = line;
                        paragraph.className = 'mb-2';
                        contentContainer.appendChild(paragraph);
                    }
                    else {
                        // Create spacing for empty lines
                        const spacer = document.createElement('div');
                        spacer.className = 'h-2';
                        contentContainer.appendChild(spacer);
                    }
                }
            }
            else {
                // Show placeholder for empty sections
                const emptyNotice = document.createElement('p');
                emptyNotice.textContent = 'No content in this section';
                emptyNotice.className = 'text-gray-400 italic';
                contentContainer.appendChild(emptyNotice);
            }
            outputElement.appendChild(contentContainer);
        }
    }
}
/**
 * Initialize event listeners for file input
 *
 * @param fileInputId The ID of the file input element
 * @param outputElementId The ID of the output element
 * @param patternString Optional regex pattern string for section detection
 */
export function initializeFileParser(fileInputId, outputElementId, patternString = "## Section \\d+") {
    document.addEventListener('DOMContentLoaded', () => {
        const fileInput = document.getElementById(fileInputId);
        const outputElement = document.getElementById(outputElementId);
        if (!fileInput || !outputElement) {
            console.error("Could not find required elements:", { fileInputId, outputElementId });
            return;
        }
        fileInput.addEventListener('change', async (event) => {
            const target = event.target;
            if (target.files && target.files.length > 0) {
                const file = target.files[0];
                try {
                    // Read the file
                    const text = await readFile(file);
                    // Create pattern from string
                    const pattern = new RegExp(patternString);
                    // Parse the text into sections
                    const { sections } = parseSections(text, [pattern]);
                    // Display the sections
                    displaySections(sections, outputElement);
                }
                catch (error) {
                    console.error("Error processing file:", error);
                    outputElement.innerHTML = `
                        <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                            <p class="font-medium">Error processing file</p>
                            <p class="text-sm">${error instanceof Error ? error.message : 'Unknown error'}</p>
                        </div>
                    `;
                }
            }
        });
    });
}
//# sourceMappingURL=textParser.js.map