/**
 * Client-side EPUB Parser using EPUB.js
 * Handles parsing of EPUB files in the browser
 */
import * as epubjs from 'epubjs';

export interface EpubChapter {
  id: string;
  href: string;
  title: string;
  level: number;
  text?: string;
  index: number;
}

export interface EpubParseResult {
  title: string;
  author: string;
  chapters: EpubChapter[];
  toc: any[];
  metadata: any;
  success: boolean;
  content?: string;
  coverUrl?: string;
  error?: string;
}

/**
 * Parse EPUB file client-side
 * 
 * @param file EPUB file to parse
 * @returns Promise with the parsed EPUB data
 */
export async function parseEpubFile(file: File): Promise<EpubParseResult> {
  try {
    // Convert file to array buffer
    const arrayBuffer = await file.arrayBuffer();
    
    // Create book object
    const book = epubjs.default(arrayBuffer);
    
    // Open the book
    await book.ready;
    
    // Get metadata
    const metadata = await book.loaded.metadata;
    const title = metadata.title || 'Untitled';
    const author = metadata.creator || 'Unknown Author';
    
    // Get table of contents
    const toc = await book.loaded.navigation;
    const navItems = toc.toc || [];
    
    // Get cover
    let coverUrl = '';
    try {
      const cover = book.packaging.metadata.cover;
      if (cover) {
        const coverHref = book.packaging.manifest.find((item: any) => item.id === cover)?.href;
        if (coverHref) {
          coverUrl = await book.archive.createUrl(coverHref, { base64: true });
        }
      }
    } catch (e) {
      console.error('Error extracting cover:', e);
    }
    
    // Process chapters
    const chapters: EpubChapter[] = [];
    const fullTextContent: string[] = [];
    
    try {
      // Get spine items (actual content order)
      const spine = book.spine?.items || [];
      
      // Process each spine item as a chapter
      for (let i = 0; i < spine.length; i++) {
        const item = spine[i];
        const href = item.href;
        const id = item.idref;
        
        // Find matching TOC item for title
        const tocItem = findTocItemByHref(navItems, href) || { title: `Chapter ${i + 1}` };
        
        // Get content
        const section = await book.load(item.href);
        
        // Extract text content from HTML
        const doc = new DOMParser().parseFromString(section.contents, 'text/html');
        const textContent = extractTextFromHtml(doc);
        
        // Determine heading level (for indentation in UI)
        const level = determineHeadingLevel(tocItem.title || '', i);
        
        // Add to chapters array
        chapters.push({
          id,
          href,
          title: tocItem.title || `Chapter ${i + 1}`,
          level,
          text: textContent,
          index: i
        });
        
        // Add to full text content with proper chapter heading
        fullTextContent.push(`## ${tocItem.title || `Chapter ${i + 1}`}\n${textContent}`);
      }
    } catch (err) {
      console.error('Error processing chapters:', err);
    }
    
    // Combine the text content with chapter markers
    const content = fullTextContent.join('\n\n');
    
    return {
      title,
      author,
      chapters,
      toc: navItems,
      metadata,
      success: true,
      content,
      coverUrl
    };
  } catch (error) {
    console.error('Error parsing EPUB:', error);
    return {
      title: '',
      author: '',
      chapters: [],
      toc: [],
      metadata: {},
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error parsing EPUB file'
    };
  }
}

/**
 * Helper function to find TOC item by href
 */
function findTocItemByHref(toc: any[], href: string): any | null {
  for (const item of toc) {
    if (item.href && (item.href === href || href.includes(item.href))) {
      return item;
    }
    if (item.subitems && item.subitems.length) {
      const found = findTocItemByHref(item.subitems, href);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Extract readable text content from HTML
 */
function extractTextFromHtml(doc: Document): string {
  // Remove script and style elements
  const scripts = doc.querySelectorAll('script, style');
  scripts.forEach(el => el.remove());
  
  // Extract content from body
  const bodyElement = doc.body;
  if (!bodyElement) return '';
  
  // Get all headings for potential chapter identification
  const headings = bodyElement.querySelectorAll('h1, h2, h3, h4, h5, h6');
  const paragraphs = bodyElement.querySelectorAll('p');
  
  let textContent = '';
  
  // Process headings (might be chapter titles)
  headings.forEach(heading => {
    const headingText = heading.textContent?.trim();
    if (headingText) {
      // Add heading with appropriate markdown emphasis
      textContent += `\n### ${headingText}\n\n`;
    }
  });
  
  // If no headings found, just get all text
  if (headings.length === 0 || textContent.length === 0) {
    // Get all paragraphs
    paragraphs.forEach(p => {
      const paragraphText = p.textContent?.trim();
      if (paragraphText) {
        textContent += paragraphText + '\n\n';
      }
    });
    
    // If still no content, get all text
    if (textContent.length === 0) {
      textContent = bodyElement.textContent?.trim() || '';
      // Clean up whitespace
      textContent = textContent.replace(/\s+/g, ' ').trim();
    }
  }
  
  return textContent;
}

/**
 * Determine heading level for UI indentation
 */
function determineHeadingLevel(title: string, index: number): number {
  // Check if title contains chapter or part indicators
  if (/^(chapter|part|section)\s+\d+/i.test(title)) {
    return 1;
  } else if (/^(chapter|part|section)/i.test(title)) {
    return 1;
  } else if (index === 0) {
    // First item might be front matter
    return 0;
  }
  
  // Default level for items without clear hierarchy
  return 2;
}