/**
 * Client-side EPUB Parser using JSZip and cheerio
 * Handles parsing of EPUB files in the browser with NCX/OPF metadata extraction
 */
import JSZip from 'jszip';
import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';

// Logger utility
const DEBUG = import.meta.env.MODE === 'development';

const logger = {
  debug: (...args: any[]) => {
    if (DEBUG) {
      console.log('[EPUB Parser]', ...args);
    }
  },
  error: (...args: any[]) => {
    console.error('[EPUB Parser]', ...args);
  }
};

export interface EpubChapter {
  id: string;
  href: string;
  title: string;
  level: number;
  text?: string;      // Plain text content
  htmlContent?: string; // Original HTML content
  index: number;
  source: 'ncx' | 'heading' | 'spine'; // Indicates where this chapter was extracted from
  loadError?: string;  // Error message if chapter failed to load
}

export interface EpubParseResult {
  title: string;
  author: string;
  chapters: EpubChapter[];
  metadata: any;
  success: boolean;
  content?: string;
  coverUrl?: string;
  error?: string;
  zipInstance?: JSZip;
  opfDirWithSlash?: string;
}

// Type definition for valid input types
type EpubInput = 
  | File 
  | Blob 
  | Buffer 
  | { arrayBuffer: () => Promise<ArrayBuffer> }
  | { bits: Buffer[] }
  | Buffer[];

// Type guards
function isBufferArray(input: EpubInput): input is Buffer[] {
  return Array.isArray(input) && input.length > 0 && Buffer.isBuffer(input[0]);
}

function isBitsArray(input: EpubInput): input is { bits: Buffer[] } {
  return !Array.isArray(input) && 'bits' in input && Array.isArray(input.bits) && input.bits.length > 0 && Buffer.isBuffer(input.bits[0]);
}

function hasArrayBuffer(input: EpubInput): input is { arrayBuffer: () => Promise<ArrayBuffer> } {
  return !Array.isArray(input) && 'arrayBuffer' in input && typeof input.arrayBuffer === 'function';
}

/**
 * Parse EPUB file client-side using JSZip and cheerio
 * Supports various input types including File, Blob, Buffer, and custom buffer formats
 * 
 * @param input EPUB file or data to parse. Can be:
 *   - File: Standard browser File object
 *   - Blob: Standard browser Blob object
 *   - Buffer: Node.js Buffer
 *   - { arrayBuffer: () => Promise<ArrayBuffer> }: Object with arrayBuffer method
 *   - { bits: Buffer[] }: Object containing array of Buffers
 *   - Buffer[]: Array of Buffers
 * @returns Promise with the parsed EPUB data
 */
export async function parseEpubFile(input: EpubInput): Promise<EpubParseResult> {
  try {
    logger.debug('Starting parseEpubFile...');
    const zip = await loadEpubZip(input);
    logger.debug('Zip loaded successfully.');
    const { opfPath, opfDirWithSlash, opfData } = await extractOpfInfo(zip);
    logger.debug('OPF info extracted:', { opfPath, opfDirWithSlash });
    const { $opf, title, author } = extractMetadata(opfData);
    logger.debug('Metadata extracted:', { title, author });
    const chapters = extractChapters($opf);
    logger.debug('Chapters extracted:', chapters);
    const coverUrl = await extractCoverImage(zip, $opf, opfDirWithSlash);
    logger.debug('Cover URL extracted:', coverUrl);
    
    // Track chapter loading errors
    const chapterErrors: string[] = [];
    
    // Eagerly load and aggregate all chapter text
    let content = '';
    for (const chapter of chapters) {
      try {
        const { text } = await loadChapterContent(zip, opfDirWithSlash, chapter);
        chapter.text = text;
        content += `# ${chapter.title}\n\n${text}\n\n`;
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Unknown error loading chapter';
        chapter.text = '';
        chapter.loadError = errorMessage;
        chapterErrors.push(`Chapter "${chapter.title}": ${errorMessage}`);
      }
    }

    // If any chapters failed to load, include the errors in the result
    if (chapterErrors.length > 0) {
      logger.debug('Some chapters failed to load:', chapterErrors);
      return {
        title,
        author,
        chapters,
        metadata: { title, author, opfPath },
        coverUrl,
        content,
        success: false,
        zipInstance: zip,
        opfDirWithSlash,
        error: `Some chapters failed to load:\n${chapterErrors.join('\n')}`
      };
    }

    logger.debug('All chapters loaded successfully.');
    return {
      title,
      author,
      chapters,
      metadata: { title, author, opfPath },
      coverUrl,
      content,
      success: true,
      zipInstance: zip,
      opfDirWithSlash
    };
  } catch (error) {
    logger.error('Error in parseEpubFile:', error);
    return {
      title: '',
      author: '',
      chapters: [],
      metadata: null,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error parsing EPUB file',
      zipInstance: undefined,
      opfDirWithSlash: undefined
    };
  }
}

/**
 * Create heading-based chapters from flat HTML content
 * Used as a fallback when NCX/OPF metadata doesn't provide chapter information
 * 
 * @param html The HTML content
 * @returns Array of chapters
 */
export function extractChaptersFromHeadings(html: string): EpubChapter[] {
  const $ = cheerio.load(html);
  const chapters: EpubChapter[] = [];
  let index = 0;
  
  // Find all heading elements
  $('h1, h2, h3, h4, h5, h6').each((i, elem) => {
    const $heading = $(elem);
    const title = $heading.text().trim();
    const tagName = elem.tagName.toLowerCase();
    const level = parseInt(tagName.substring(1)) - 1; // h1 -> 0, h2 -> 1, etc.
    
    // Extract content until the next heading
    let text = '';
    let node = $heading[0].nextSibling;
    while (node) {
      if (node.type === 'tag' && /^h[1-6]$/.test(node.tagName.toLowerCase())) {
        break;
      }
      if (node.type === 'text' || node.type === 'tag') {
        text += $(node).text() + '\n';
      }
      node = node.nextSibling;
    }
    
    chapters.push({
      id: `heading-${i}`,
      href: `#${$heading.attr('id') || ''}`,
      title,
      level,
      text: text.trim(),
      index: index++,
      source: 'heading'
    });
  });
  
  return chapters;
}

export async function loadChapterContent(zip: JSZip, opfDirWithSlash: string, chapter: EpubChapter): Promise<{text: string, htmlContent: string}> {
  if (!chapter.href) throw new Error('Chapter does not have a valid href.');
  const fullHref = chapter.href.startsWith('/') ? chapter.href.substring(1) : opfDirWithSlash + chapter.href;
  const chapterFile = zip.file(fullHref);
  if (!chapterFile) throw new Error(`Chapter file not found at path ${fullHref}`);
  let chapterData;
  try {
    chapterData = await chapterFile.async('text');
  } catch (e) {
    throw new Error(`Failed to read chapter file at path ${fullHref}`);
  }
  const $chapter = cheerio.load(chapterData);
  $chapter('script, style').remove();
  const htmlContent = $chapter('body').html() || '';
  const text = $chapter('body').text().trim();
  return { text, htmlContent };
}

// Helper: Load and validate EPUB zip
async function loadEpubZip(file: EpubInput): Promise<JSZip> {
  logger.debug('Loading EPUB zip file...');
  logger.debug('File argument type:', typeof file);
  logger.debug('File argument constructor:', file && file.constructor && file.constructor.name);
  logger.debug('File argument keys:', file && Object.keys(file));
  logger.debug('File argument:', file);

  let arrayBuffer: ArrayBuffer;

  try {
    if (Buffer.isBuffer(file)) {
      logger.debug('Processing single Buffer input');
      // Validate buffer properties before access
      if (!file.buffer || typeof file.byteOffset !== 'number' || typeof file.byteLength !== 'number') {
        throw new Error('Invalid Buffer: Missing required properties');
      }
      // Use slice to create a view without copying
      arrayBuffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
      logger.debug('Single buffer size:', file.byteLength);
    } else if (isBufferArray(file)) {
      logger.debug('Processing Buffer array input');
      logger.debug('Number of buffer segments:', file.length);
      
      // Validate all buffers before processing
      for (let i = 0; i < file.length; i++) {
        const buffer = file[i];
        if (!buffer || !buffer.buffer || typeof buffer.byteOffset !== 'number' || typeof buffer.byteLength !== 'number') {
          throw new Error(`Invalid Buffer at index ${i}: Missing required properties`);
        }
      }
      
      // Calculate total size needed
      const totalSize = file.reduce((acc, buffer) => acc + buffer.byteLength, 0);
      logger.debug('Total size needed:', totalSize);
      
      // Pre-allocate a single buffer
      const combinedBuffer = new Uint8Array(totalSize);
      
      // Copy segments efficiently
      let offset = 0;
      for (let i = 0; i < file.length; i++) {
        const buffer = file[i];
        const segmentSize = buffer.byteLength;
        logger.debug(`Copying segment ${i + 1}/${file.length}, size: ${segmentSize}, offset: ${offset}`);
        
        try {
          // Use set with direct buffer view to avoid unnecessary copies
          combinedBuffer.set(
            new Uint8Array(buffer.buffer, buffer.byteOffset, segmentSize),
            offset
          );
          offset += segmentSize;
        } catch (error) {
          logger.error(`Error copying buffer segment ${i + 1}:`, error);
          throw new Error(`Failed to copy buffer segment ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      arrayBuffer = combinedBuffer.buffer;
      logger.debug('Successfully combined all buffer segments');
    } else if (isBitsArray(file)) {
      logger.debug('Processing bits array input');
      logger.debug('Number of bits segments:', file.bits.length);
      
      // Validate all bits buffers before processing
      for (let i = 0; i < file.bits.length; i++) {
        const buffer = file.bits[i];
        if (!buffer || !buffer.buffer || typeof buffer.byteOffset !== 'number' || typeof buffer.byteLength !== 'number') {
          throw new Error(`Invalid bits Buffer at index ${i}: Missing required properties`);
        }
      }
      
      // Calculate total size needed
      const totalSize = file.bits.reduce((acc, buffer) => acc + buffer.byteLength, 0);
      logger.debug('Total size needed:', totalSize);
      
      // Pre-allocate a single buffer
      const combinedBuffer = new Uint8Array(totalSize);
      
      // Copy segments efficiently
      let offset = 0;
      for (let i = 0; i < file.bits.length; i++) {
        const buffer = file.bits[i];
        const segmentSize = buffer.byteLength;
        logger.debug(`Copying bits segment ${i + 1}/${file.bits.length}, size: ${segmentSize}, offset: ${offset}`);
        
        try {
          // Use set with direct buffer view to avoid unnecessary copies
          combinedBuffer.set(
            new Uint8Array(buffer.buffer, buffer.byteOffset, segmentSize),
            offset
          );
          offset += segmentSize;
        } catch (error) {
          logger.error(`Error copying bits segment ${i + 1}:`, error);
          throw new Error(`Failed to copy bits segment ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      arrayBuffer = combinedBuffer.buffer;
      logger.debug('Successfully combined all bits segments');
    } else if (hasArrayBuffer(file)) {
      logger.debug('Processing ArrayBuffer input');
      arrayBuffer = await file.arrayBuffer();
      logger.debug('ArrayBuffer size:', arrayBuffer.byteLength);
    } else {
      throw new Error('Unsupported file type for EPUB loading');
    }

    logger.debug('Final ArrayBuffer size:', arrayBuffer.byteLength);
    
    // Enhanced ArrayBuffer validation
    if (!arrayBuffer) {
      throw new Error('Invalid file: ArrayBuffer is null or undefined');
    }
    
    if (!(arrayBuffer instanceof ArrayBuffer)) {
      throw new Error(`Invalid file: Expected ArrayBuffer but got ${Object.prototype.toString.call(arrayBuffer)}`);
    }
    
    if (arrayBuffer.byteLength === 0) {
      throw new Error('Invalid file: ArrayBuffer has zero length');
    }
    
    // Attempt to load the zip file with enhanced error handling
    try {
      const zip = await JSZip.loadAsync(arrayBuffer);
      
      // Validate the loaded zip file
      if (!zip || typeof zip.files !== 'object') {
        throw new Error('Invalid zip file: Failed to load or parse zip structure');
      }
      
      logger.debug('Successfully loaded zip file');
      return zip;
    } catch (error) {
      logger.error('Error loading zip file:', error);
      
      // Enhance error message with more context
      let errorMessage = 'Failed to load zip file';
      
      if (error instanceof Error) {
        // Preserve the original error stack and message
        errorMessage = `${errorMessage}: ${error.message}`;
        
        // Add specific error handling for common issues
        if (error.message.includes('corrupt')) {
          errorMessage += ' - The file appears to be corrupted';
        } else if (error.message.includes('format')) {
          errorMessage += ' - The file format is not a valid zip archive';
        } else if (error.message.includes('memory')) {
          errorMessage += ' - Insufficient memory to process the file';
        }
        
        // Create a new error with the enhanced message but preserve the stack
        const enhancedError = new Error(errorMessage);
        enhancedError.stack = error.stack;
        throw enhancedError;
      } else {
        // Handle non-Error objects
        throw new Error(`${errorMessage}: ${String(error)}`);
      }
    }
  } catch (error) {
    // Log the full error details for debugging
    logger.error('Error in loadEpubZip:', {
      error,
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined
    });
    
    // Rethrow with enhanced context
    if (error instanceof Error) {
      const enhancedError = new Error(`Failed to load EPUB file: ${error.message}`);
      enhancedError.stack = error.stack;
      throw enhancedError;
    }
    throw error;
  }
}

// Helper: Extract and validate container.xml and OPF
async function extractOpfInfo(zip: JSZip): Promise<{ opfPath: string, opfDirWithSlash: string, opfData: string }> {
  const containerFile = zip.file('META-INF/container.xml');
  if (!containerFile) throw new Error('Invalid EPUB: Missing META-INF/container.xml. This file is required for EPUB structure.');
  let containerXml;
  try {
    containerXml = await containerFile.async('text');
  } catch (e) {
    throw new Error('Failed to read container.xml: The file may be corrupted or unreadable.');
  }
  let opfPath;
  try {
    const $container = cheerio.load(containerXml);
    opfPath = $container('rootfile').attr('full-path');
  } catch (e) {
    throw new Error('Failed to parse container.xml: Invalid XML structure.');
  }
  if (!opfPath) throw new Error('Invalid EPUB: Cannot find OPF file path in container.xml.');
  const opfDir = opfPath.split('/').slice(0, -1).join('/');
  const opfDirWithSlash = opfDir ? `${opfDir}/` : '';
  const opfFile = zip.file(opfPath);
  if (!opfFile) throw new Error(`Invalid EPUB: Missing OPF file at path ${opfPath}.`);
  let opfData;
  try {
    opfData = await opfFile.async('text');
  } catch (e) {
    throw new Error('Failed to read OPF file: The file may be corrupted or unreadable.');
  }
  // Debug logs
  logger.debug('OPF Path:', opfPath);
  logger.debug('OPF Directory with Slash:', opfDirWithSlash);
  logger.debug('OPF Data:', opfData);
  return { opfPath, opfDirWithSlash, opfData };
}

// Helper: Extract metadata (title, author)
function extractMetadata(opfData: string) {
  const $opf = cheerio.load(opfData, { xmlMode: true });
  // Debug: log the OPF XML
  // eslint-disable-next-line no-console
  logger.debug('OPF XML:', opfData);
  
  // Try with 'dc:' prefix first, then fall back to non-prefixed selectors
  const title = $opf('dc\\:title').first().text() || $opf('title').first().text() || 'Untitled';
  const author = $opf('dc\\:creator').first().text() || $opf('creator').first().text() || 'Unknown Author';
  
  // eslint-disable-next-line no-console
  logger.debug('Extracted title:', title, 'author:', author);
  return { $opf, title, author };
}

// Helper: Extract chapters/TOC
function extractChapters($opf: CheerioAPI): EpubChapter[] {
  const chapters: EpubChapter[] = [];
  const spine = $opf('spine');
  const manifest = $opf('manifest');
  const manifestItems = new Map<string, { href: string, title?: string }>();
  manifest.find('item').each((_, item) => {
    const id = $opf(item).attr('id');
    const href = $opf(item).attr('href');
    if (id && href) {
      manifestItems.set(id, { href });
    }
  });
  spine.find('itemref').each((index, itemref) => {
    const idref = $opf(itemref).attr('idref');
    if (idref && manifestItems.has(idref)) {
      const { href } = manifestItems.get(idref)!;
      chapters.push({
        id: idref,
        href,
        title: `Chapter ${index + 1}`,
        level: 0,
        index,
        source: 'spine'
      });
    }
  });
  // Debug logs
  logger.debug('Manifest Items:', Array.from(manifestItems.entries()));
  logger.debug('Extracted Chapters:', chapters);
  return chapters;
}

// Helper: Extract cover image
async function extractCoverImage(zip: JSZip, $opf: CheerioAPI, opfDirWithSlash: string): Promise<string | undefined> {
  // ... existing logic for extracting cover image ...
  return undefined;
}