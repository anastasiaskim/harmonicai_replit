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
}

/**
 * Parse EPUB file client-side using JSZip and cheerio
 * 
 * @param file EPUB file to parse
 * @returns Promise with the parsed EPUB data
 */
export async function parseEpubFile(file: File): Promise<EpubParseResult> {
  try {
    // Load the file using JSZip
    const zip = new JSZip();
    const content = await zip.loadAsync(file);
    
    // Find the container.xml file
    const containerXml = await content.file('META-INF/container.xml')?.async('text');
    if (!containerXml) {
      throw new Error('Invalid EPUB: Missing container.xml');
    }
    
    // Parse container.xml to find the OPF file path
    const $container = cheerio.load(containerXml);
    const opfPath = $container('rootfile').attr('full-path');
    if (!opfPath) {
      throw new Error('Invalid EPUB: Cannot find OPF file path');
    }
    
    // Get the OPF directory path for resolving relative paths
    const opfDir = opfPath.split('/').slice(0, -1).join('/');
    const opfDirWithSlash = opfDir ? `${opfDir}/` : '';
    
    // Load and parse the OPF file
    const opfData = await content.file(opfPath)?.async('text');
    if (!opfData) {
      throw new Error('Invalid EPUB: Missing OPF file');
    }
    
    const $opf = cheerio.load(opfData, { xmlMode: true });
    
    // Extract basic metadata
    const title = $opf('title').text() || 'Untitled';
    const author = $opf('creator').text() || 'Unknown Author';
    
    // Find the NCX file
    const ncxId = $opf('spine').attr('toc');
    let ncxPath: string | undefined;
    
    if (ncxId) {
      // Find the NCX file path using its ID
      $opf('manifest item').each((_, item) => {
        const $item = $opf(item);
        if ($item.attr('id') === ncxId) {
          ncxPath = $item.attr('href');
          return false; // Break the loop
        }
      });
    }
    
    // If NCX path wasn't found, look for any NCX file
    if (!ncxPath) {
      $opf('manifest item').each((_, item) => {
        const $item = $opf(item);
        const mediaType = $item.attr('media-type');
        const href = $item.attr('href');
        if (mediaType === 'application/x-dtbncx+xml' && href) {
          ncxPath = href;
          return false; // Break the loop
        }
      });
    }
    
    const chapters: EpubChapter[] = [];
    let fullContent = '';
    
    // Process NCX file if found
    if (ncxPath) {
      // Resolve the full path
      const fullNcxPath = ncxPath.startsWith('/') ? 
        ncxPath.substring(1) : opfDirWithSlash + ncxPath;
      
      const ncxData = await content.file(fullNcxPath)?.async('text');
      if (ncxData) {
        // Parse NCX to extract the table of contents
        const $ncx = cheerio.load(ncxData, { xmlMode: true });
        
        // Process each navPoint to extract chapters
        let index = 0;
        $ncx('navPoint').each((_, navPoint) => {
          const $navPoint = $ncx(navPoint);
          const navLevel = parseInt($navPoint.attr('class')?.replace('level', '') || '1', 10);
          const id = $navPoint.attr('id') || `nav-${index}`;
          const labelNode = $navPoint.find('navLabel text');
          const contentNode = $navPoint.find('content');
          
          if (labelNode.length && contentNode.length) {
            const title = labelNode.text().trim();
            let href = contentNode.attr('src') || '';
            
            // Handle fragment identifiers
            const hrefParts = href.split('#');
            href = hrefParts[0];
            
            chapters.push({
              id,
              href,
              title,
              level: navLevel - 1, // Normalize to 0-based level
              index: index++,
              source: 'ncx'
            });
          }
        });
      }
    }
    
    // If no chapters found, fall back to manifest items
    if (chapters.length === 0) {
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
    }
    
    // Extract content from chapters
    for (const chapter of chapters) {
      try {
        if (chapter.href) {
          // Resolve the full path
          const fullHref = chapter.href.startsWith('/') ? 
            chapter.href.substring(1) : opfDirWithSlash + chapter.href;
          
          // Load the chapter HTML
          const chapterData = await content.file(fullHref)?.async('text');
          if (chapterData) {
            const $chapter = cheerio.load(chapterData);
            
            // Extract text and look for heading tags
            let chapterTitle = chapter.title;
            const h1 = $chapter('h1').first().text().trim();
            if (h1 && !chapterTitle.includes(h1)) {
              chapterTitle = h1;
              chapter.title = h1;
            }
            
            // Remove script and style tags
            $chapter('script, style').remove();
            
            // Extract text
            const text = $chapter('body').text().trim();
            chapter.text = text;
            fullContent += `${text}\n\n`;
            
            // If we don't have a real title, try to find headings in the content for better titles
            if (chapter.title.startsWith('Chapter ') && !h1) {
              // Look for any heading to use as title
              for (let i = 2; i <= 6; i++) {
                const heading = $chapter(`h${i}`).first().text().trim();
                if (heading) {
                  chapter.title = heading;
                  break;
                }
              }
            }
          }
        }
      } catch (error) {
        console.warn(`Could not extract content for chapter: ${chapter.title}`, error);
      }
    }
    
    // Find cover image if it exists
    let coverUrl: string | undefined = undefined;
    try {
      // Try to get cover from metadata
      let coverPath: string | undefined;
      
      // Method 1: Look for cover image in manifest using meta property
      const coverId = $opf('meta[name="cover"]').attr('content');
      if (coverId) {
        $opf('manifest item').each((_, item) => {
          const $item = $opf(item);
          if ($item.attr('id') === coverId) {
            coverPath = $item.attr('href');
            return false; // Break the loop
          }
        });
      }
      
      // Method 2: Look for cover image by id
      if (!coverPath) {
        $opf('manifest item').each((_, item) => {
          const $item = $opf(item);
          const id = $item.attr('id');
          if (id === 'cover' || id === 'cover-image') {
            coverPath = $item.attr('href');
            return false; // Break the loop
          }
        });
      }
      
      // Method 3: Look for image with "cover" in the properties
      if (!coverPath) {
        $opf('manifest item').each((_, item) => {
          const $item = $opf(item);
          const properties = $item.attr('properties');
          if (properties && properties.includes('cover-image')) {
            coverPath = $item.attr('href');
            return false; // Break the loop
          }
        });
      }
      
      // If cover path found, extract the image
      if (coverPath) {
        const fullCoverPath = coverPath.startsWith('/') ? 
          coverPath.substring(1) : opfDirWithSlash + coverPath;
        
        const coverData = await content.file(fullCoverPath)?.async('blob');
        if (coverData) {
          coverUrl = URL.createObjectURL(coverData);
        }
      }
    } catch (error) {
      console.warn('Could not extract cover image:', error);
    }
    
    // Return the result
    return {
      title,
      author,
      chapters,
      metadata: {
        title,
        author,
        opfPath
      },
      content: fullContent,
      coverUrl,
      success: true
    };
    
  } catch (error) {
    console.error('Error parsing EPUB file:', error);
    // Return error result with proper types
    return {
      title: '',
      author: '',
      chapters: [],
      metadata: null,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error parsing EPUB file'
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
      index: index++
    });
  });
  
  return chapters;
}