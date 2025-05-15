/**
 * Client-side EPUB Parser using EPUB.js
 * Handles parsing of EPUB files in the browser
 */
import ePub from 'epubjs';

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
    // Create array buffer from file
    const arrayBuffer = await file.arrayBuffer();
    
    // Initialize the book using the constructor
    // @ts-ignore - epubjs types are not fully compatible with our usage
    const book = new ePub(arrayBuffer);
    await book.ready;
    
    // Get metadata
    const metadata = await book.loaded.metadata;
    const title = metadata.title || 'Untitled';
    const author = metadata.creator || 'Unknown Author';
    
    // Get the table of contents
    const toc = await book.loaded.navigation;
    
    // Extract the cover URL if available
    let coverUrl: string | undefined = undefined;
    try {
      // Try to get cover from metadata or package
      const coverHref = book.packaging?.manifest?.['cover-image']?.href || 
                       book.packaging?.manifest?.['cover']?.href;
      
      if (coverHref) {
        const coverBlob = await book.resources.get(coverHref);
        if (coverBlob) {
          coverUrl = URL.createObjectURL(await coverBlob.blob());
        }
      }
    } catch (error) {
      console.warn('Could not extract cover image:', error);
    }
    
    // Extract chapters from navigation
    const chapters: EpubChapter[] = [];
    let index = 0;
    
    // Process each TOC item
    // @ts-ignore - toc might not have an iterable toc property
    const tocItems = toc.toc || [];
    for (const item of tocItems) {
      // Get the chapter ID from the href
      const href = item.href || '';
      const id = href.split('#')[0] || `chapter-${index}`;
      
      // Determine heading level for UI indentation
      // @ts-ignore - level might not exist on NavItem
      const level = item.level || 0;
      
      // Create the chapter object
      const chapter: EpubChapter = {
        id,
        href,
        title: item.label || `Chapter ${index + 1}`,
        level,
        index: index++
      };
      
      // Add to chapters array
      chapters.push(chapter);
    }
    
    // If no TOC found, try to use spine items
    if (chapters.length === 0 && book.spine) {
      // @ts-ignore - epubjs types are incomplete
      const spineItems = book.spine.items || [];
      for (let i = 0; i < spineItems.length; i++) {
        // @ts-ignore - epubjs types are incomplete
        const spineItem = spineItems[i];
        const id = spineItem.idref || `spine-${i}`;
        const href = spineItem.href || '';
        
        chapters.push({
          id,
          href,
          title: `Chapter ${i + 1}`,
          level: 0,
          index: i
        });
      }
    }
    
    // Extract text content for each chapter
    let fullContent = '';
    for (const chapter of chapters) {
      try {
        if (chapter.href) {
          // Get the chapter content
          const chapterDoc = await book.load(chapter.href);
          
          // Extract text content from HTML
          if (chapterDoc && chapterDoc.contents) {
            const text = extractTextFromHtml(chapterDoc.document);
            chapter.text = text.trim();
            fullContent += `${chapter.text}\n\n`;
          }
        }
      } catch (error) {
        console.warn(`Could not extract content for chapter: ${chapter.title}`, error);
      }
    }
    
    // Return the result
    return {
      title,
      author,
      chapters,
      toc,
      metadata,
      content: fullContent,
      coverUrl,
      success: true
    };
    
  } catch (error) {
    console.error('Error parsing EPUB file:', error);
    return {
      title: '',
      author: '',
      chapters: [],
      toc: [],
      metadata: null,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error parsing EPUB file'
    };
  }
}

/**
 * Extract readable text content from HTML
 */
function extractTextFromHtml(doc: Document): string {
  // Get all text nodes
  const walker = doc.createTreeWalker(
    doc.body,
    NodeFilter.SHOW_TEXT,
    null
  );
  
  let text = '';
  let node;
  while (node = walker.nextNode()) {
    // Skip text in script and style elements
    const parent = node.parentNode;
    if (parent && 
        parent.nodeName !== 'SCRIPT' && 
        parent.nodeName !== 'STYLE') {
      
      // Check if the parent is a heading element
      const isHeading = parent.nodeName.match(/^H[1-6]$/);
      
      // Add newlines for paragraphs and headings
      if (parent.nodeName === 'P' || isHeading) {
        if (text.length > 0 && !text.endsWith('\n\n')) {
          text += '\n\n';
        }
      }
      
      // Format headings with markdown syntax
      if (isHeading) {
        const level = parseInt(parent.nodeName.substring(1));
        // Add markdown heading markers based on level (##, ###, etc.)
        const prefix = '#'.repeat(Math.min(level + 1, 6)) + ' ';
        text += prefix;
      }
      
      // Add the text content
      text += node.textContent ? node.textContent.trim() : '';
      
      // Add a newline after paragraphs and headings
      if (parent.nodeName === 'P' || isHeading) {
        text += '\n\n';
      } else if (parent.nodeName === 'BR') {
        text += '\n';
      }
    }
  }
  
  // Clean up extra whitespace
  return text
    .replace(/\n{3,}/g, '\n\n')  // Replace 3 or more newlines with 2
    .replace(/[ \t]+/g, ' ')     // Replace multiple spaces/tabs with a single space
    .trim();
}