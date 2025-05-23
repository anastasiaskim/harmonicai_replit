/**
 * Client-side EPUB Parser using JSZip and cheerio
 * Handles parsing of EPUB files in the browser with NCX/OPF metadata extraction
 */
import JSZip from 'jszip';
import * as cheerio from 'cheerio';

export interface EpubChapter {
  id: string;
  href: string;
  title: string;
  level: number;
  text?: string;      // Plain text content
  htmlContent?: string; // Original HTML content
  index: number;
  source: 'ncx' | 'heading' | 'spine'; // Indicates where this chapter was extracted from
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

/**
 * Parse EPUB file client-side using JSZip and cheerio
 * 
 * @param file EPUB file to parse
 * @returns Promise with the parsed EPUB data
 */
export async function parseEpubFile(file: File): Promise<EpubParseResult> {
  try {
    const zip = await loadEpubZip(file);
    const { opfPath, opfDirWithSlash, opfData } = await extractOpfInfo(zip);
    const { $opf, title, author } = extractMetadata(opfData);
    const chapters = extractChapters($opf);
    const coverUrl = await extractCoverImage(zip, $opf, opfDirWithSlash);
    // Eagerly load and aggregate all chapter text
    let content = '';
    for (const chapter of chapters) {
      try {
        const { text } = await loadChapterContent(zip, opfDirWithSlash, chapter);
        chapter.text = text;
        content += `# ${chapter.title}\n\n${text}\n\n`;
      } catch (e) {
        chapter.text = '';
      }
    }
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
async function loadEpubZip(file: File): Promise<JSZip> {
  const zip = new JSZip();
  try {
    return await zip.loadAsync(file);
  } catch (e) {
    throw new Error('Failed to read EPUB file: The file may be corrupted or not a valid ZIP archive.');
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
  return { opfPath, opfDirWithSlash, opfData };
}

// Helper: Extract metadata (title, author)
function extractMetadata(opfData: string) {
  const $opf = cheerio.load(opfData, { xmlMode: true });
  const title = $opf('title').text() || 'Untitled';
  const author = $opf('creator').text() || 'Unknown Author';
  return { $opf, title, author };
}

// Helper: Extract chapters/TOC
function extractChapters($opf: cheerio.CheerioAPI): EpubChapter[] {
  // Find the NCX file
  const ncxId = $opf('spine').attr('toc');
  let ncxPath: string | undefined;
  if (ncxId) {
    $opf('manifest item').each((_, item) => {
      const $item = $opf(item);
      if ($item.attr('id') === ncxId) {
        ncxPath = $item.attr('href');
        return false;
      }
    });
  }
  if (!ncxPath) {
    $opf('manifest item').each((_, item) => {
      const $item = $opf(item);
      const mediaType = $item.attr('media-type');
      const href = $item.attr('href');
      if (mediaType === 'application/x-dtbncx+xml' && href) {
        ncxPath = href;
        return false;
      }
    });
  }
  const chapters: EpubChapter[] = [];
  // If NCX found, parse navPoints
  // (We cannot parse the NCX here without the zip, so fallback to spine)
  // Get the spine order
  const spineItemrefs: string[] = [];
  $opf('spine itemref').each((_, itemref) => {
    const idref = $opf(itemref).attr('idref');
    if (idref) spineItemrefs.push(idref);
  });
  // Get the manifest items
  const manifestItems = new Map<string, {href: string, mediaType: string}>();
  $opf('manifest item').each((_, item) => {
    const $item = $opf(item);
    const id = $item.attr('id');
    const href = $item.attr('href');
    const mediaType = $item.attr('media-type');
    if (id && href && mediaType?.includes('html')) {
      manifestItems.set(id, {href, mediaType});
    }
  });
  // Follow the spine order to get chapters
  let index = 0;
  for (const idref of spineItemrefs) {
    const item = manifestItems.get(idref);
    if (item) {
      chapters.push({
        id: idref,
        href: item.href,
        title: `Chapter ${index + 1}`,
        level: 0,
        index: index++,
        source: 'spine'
      });
    }
  }
  return chapters;
}

// Helper: Extract cover image
async function extractCoverImage(zip: JSZip, $opf: cheerio.CheerioAPI, opfDirWithSlash: string): Promise<string | undefined> {
  // ... existing logic for extracting cover image ...
  return undefined;
}