import { parseEpubFile, loadChapterContent } from './epubParserJszip';
import JSZip from 'jszip';

describe('epubParserJszip', () => {
  it('should throw on invalid/corrupted EPUB file', async () => {
    const badFile = new File([new Uint8Array([0, 1, 2, 3])], 'bad.epub', { type: 'application/epub+zip' });
    await expect(parseEpubFile(badFile)).resolves.toMatchObject({ success: false });
  });

  // You would add a valid EPUB file fixture for real tests
  // it('should parse metadata and chapters from a valid EPUB', async () => {
  //   const file = ... // Load a valid EPUB file as a File object
  //   const result = await parseEpubFile(file);
  //   expect(result.success).toBe(true);
  //   expect(result.title).toBeDefined();
  //   expect(result.author).toBeDefined();
  //   expect(result.chapters.length).toBeGreaterThan(0);
  // });

  // it('should lazy load chapter content', async () => {
  //   const file = ... // Load a valid EPUB file as a File object
  //   const result = await parseEpubFile(file);
  //   const chapter = result.chapters[0];
  //   const content = await loadChapterContent(result.zipInstance!, result.opfDirWithSlash!, chapter);
  //   expect(content.text.length).toBeGreaterThan(0);
  // });
}); 