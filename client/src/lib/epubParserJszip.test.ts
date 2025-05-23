import { parseEpubFile, loadChapterContent, EpubParseResult, EpubChapter } from './epubParserJszip';
import JSZip from 'jszip';

// Mock EPUB file content
const mockEpubContent = {
  'META-INF/container.xml': `<?xml version="1.0" encoding="UTF-8"?>
    <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
      <rootfiles>
        <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
      </rootfiles>
    </container>`,
  'OEBPS/content.opf': `<?xml version="1.0" encoding="UTF-8"?>
    <package version="3.0" xmlns="http://www.idpf.org/2007/opf">
      <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
        <dc:title>Test Book</dc:title>
        <dc:creator>Test Author</dc:creator>
      </metadata>
      <manifest>
        <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
        <item id="chapter2" href="chapter2.xhtml" media-type="application/xhtml+xml"/>
      </manifest>
      <spine toc="ncx">
        <itemref idref="chapter1"/>
        <itemref idref="chapter2"/>
      </spine>
    </package>`,
  'OEBPS/chapter1.xhtml': `<!DOCTYPE html>
    <html>
      <body>
        <h1>Chapter 1</h1>
        <p>This is the first chapter content.</p>
      </body>
    </html>`,
  'OEBPS/chapter2.xhtml': `<!DOCTYPE html>
    <html>
      <body>
        <h1>Chapter 2</h1>
        <p>This is the second chapter content.</p>
      </body>
    </html>`
};

// Helper function to create a mock EPUB file
async function createMockEpubFile(): Promise<File> {
  const zip = new JSZip();
  
  // Add all mock content to the zip
  Object.entries(mockEpubContent).forEach(([path, content]) => {
    zip.file(path, content);
  });
  
  // Generate the zip file
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  return new File([zipBlob], 'test.epub', { type: 'application/epub+zip' });
}

describe('EPUB Parser', () => {
  let mockEpubFile: File;

  beforeAll(async () => {
    mockEpubFile = await createMockEpubFile();
  });

  test('should parse EPUB metadata correctly', async () => {
    const result = await parseEpubFile(mockEpubFile);
    
    expect(result.success).toBe(true);
    expect(result.title).toBe('Test Book');
    expect(result.author).toBe('Test Author');
    expect(result.chapters).toHaveLength(2);
  });

  test('should extract chapters in correct order', async () => {
    const result = await parseEpubFile(mockEpubFile);
    
    expect(result.chapters[0].title).toBe('Chapter 1');
    expect(result.chapters[1].title).toBe('Chapter 2');
    expect(result.chapters[0].source).toBe('spine');
  });

  test('should load chapter content correctly', async () => {
    const result = await parseEpubFile(mockEpubFile);
    const chapter = result.chapters[0];
    
    if (!result.zipInstance || !result.opfDirWithSlash) {
      throw new Error('Missing zip instance or OPF directory');
    }

    const content = await loadChapterContent(result.zipInstance, result.opfDirWithSlash, chapter);
    
    expect(content.text).toContain('This is the first chapter content');
    expect(content.htmlContent).toContain('<h1>Chapter 1</h1>');
  });

  test('should handle invalid EPUB files gracefully', async () => {
    const invalidFile = new File(['invalid content'], 'invalid.epub', { type: 'application/epub+zip' });
    const result = await parseEpubFile(invalidFile);
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  test('should extract chapters from headings when NCX is not available', async () => {
    // Create a modified mock EPUB without NCX
    const modifiedContent = { ...mockEpubContent };
    modifiedContent['OEBPS/content.opf'] = modifiedContent['OEBPS/content.opf'].replace('toc="ncx"', '');
    
    const zip = new JSZip();
    Object.entries(modifiedContent).forEach(([path, content]) => {
      zip.file(path, content);
    });
    
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const modifiedFile = new File([zipBlob], 'modified.epub', { type: 'application/epub+zip' });
    
    const result = await parseEpubFile(modifiedFile);
    
    expect(result.success).toBe(true);
    expect(result.chapters).toHaveLength(2);
    expect(result.chapters[0].source).toBe('spine');
  });
}); 