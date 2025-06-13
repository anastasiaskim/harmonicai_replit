import fs from 'fs';
import path from 'path';
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
  'OEBPS/chapter1.xhtml': '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Chapter 1</title></head><body><h1>Chapter 1</h1><p>This is the first chapter content.</p></body></html>',
  'OEBPS/chapter2.xhtml': `<!DOCTYPE html>
    <html>
      <body>
        <h1>Chapter 2</h1>
        <p>This is the second chapter content.</p>
      </body>
    </html>`
};

// Mock Blob class for Node.js environment
class MockBlob implements Blob {
  private buffer: Buffer;
  type: string;
  size: number;

  constructor(bits: Buffer[], options?: { type: string }) {
    this.buffer = bits[0];
    this.type = options?.type || 'application/octet-stream';
    this.size = this.buffer.length;
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    return this.buffer.buffer.slice(
      this.buffer.byteOffset,
      this.buffer.byteOffset + this.buffer.byteLength
    );
  }

  async text(): Promise<string> {
    return this.buffer.toString('utf-8');
  }

  slice(start?: number, end?: number, contentType?: string): Blob {
    const startIndex = start || 0;
    const endIndex = end || this.buffer.length;
    const slicedBuffer = this.buffer.slice(startIndex, endIndex);
    return new MockBlob([slicedBuffer], { type: contentType || this.type });
  }

  stream(): ReadableStream<Uint8Array> {
    return new ReadableStream({
      start: (controller) => {
        controller.enqueue(new Uint8Array(this.buffer));
        controller.close();
      }
    });
  }

  bytes(): Promise<Uint8Array> {
    return Promise.resolve(new Uint8Array(this.buffer));
  }
}

// Mock File class for Node.js environment
class MockFile implements File {
  private buffer: Buffer;
  name: string;
  type: string;
  lastModified: number;
  size: number;
  webkitRelativePath: string;
  bytes: () => Promise<Uint8Array>;

  constructor(bits: Buffer[], name: string, options?: { type: string }) {
    this.buffer = bits[0];
    this.name = name;
    this.type = options?.type || 'application/octet-stream';
    this.lastModified = Date.now();
    this.size = this.buffer.length;
    this.webkitRelativePath = '';
    this.bytes = async () => new Uint8Array(this.buffer);
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    return this.buffer.buffer.slice(
      this.buffer.byteOffset,
      this.buffer.byteOffset + this.buffer.byteLength
    );
  }

  slice(start?: number, end?: number, contentType?: string): MockBlob {
    const startIndex = start || 0;
    const endIndex = end || this.buffer.length;
    const slicedBuffer = this.buffer.slice(startIndex, endIndex);
    return new MockBlob([slicedBuffer], { type: contentType || this.type });
  }

  text(): Promise<string> {
    return Promise.resolve(this.buffer.toString('utf-8'));
  }

  stream(): ReadableStream<Uint8Array> {
    return new ReadableStream({
      start: (controller) => {
        controller.enqueue(new Uint8Array(this.buffer));
        controller.close();
      }
    });
  }
}

// Helper function to create a mock EPUB file
async function createMockEpubFile(): Promise<MockFile> {
  const zip = new JSZip();
  const mockContent = {
    'META-INF/container.xml': '<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
    'OEBPS/content.opf': '<?xml version="1.0" encoding="UTF-8"?><package version="3.0" xmlns="http://www.idpf.org/2007/opf"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Test Book</dc:title><dc:creator>Test Author</dc:creator></metadata><manifest><item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/><item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/><item id="chapter2" href="chapter2.xhtml" media-type="application/xhtml+xml"/></manifest><spine toc="ncx"><itemref idref="chapter1"/><itemref idref="chapter2"/></spine></package>',
    'OEBPS/chapter1.xhtml': '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Chapter 1</title></head><body><h1>Chapter 1</h1><p>This is the first chapter content.</p></body></html>',
    'OEBPS/chapter2.xhtml': '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Chapter 2</title></head><body><h1>Chapter 2</h1><p>This is the second chapter.</p></body></html>',
  };

  Object.entries(mockContent).forEach(([path, content]) => {
    console.log(`Adding file to zip: ${path}`);
    zip.file(path, content);
  });

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
  console.log(`Generated zip buffer size: ${zipBuffer.length} bytes`);
  console.log(`Generated zip buffer type: ${typeof zipBuffer}`);
  console.log(`Generated zip buffer instanceof Buffer: ${zipBuffer instanceof Buffer}`);

  return new MockFile([zipBuffer], 'test.epub', { type: 'application/epub+zip' });
}

describe('EPUB Parser', () => {
  let mockEpubFile: MockFile;

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
    const invalidFile = new MockFile([Buffer.from('invalid content')], 'invalid.epub', { type: 'application/epub+zip' });
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
    
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    const modifiedFile = new File([zipBuffer], 'modified.epub', { type: 'application/epub+zip' });
    
    const result = await parseEpubFile(modifiedFile);
    
    expect(result.success).toBe(true);
    expect(result.chapters).toHaveLength(2);
    expect(result.chapters[0].source).toBe('spine');
  });
}); 