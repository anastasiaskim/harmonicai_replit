/**
 * Helper functions for file handling and processing
 */

/**
 * Checks if a file is of a valid type for audiobook conversion
 */
export const isValidFileType = (file: File): boolean => {
  const validTypes = [
    'text/plain',
    'application/epub+zip',
    'application/pdf',
  ];
  
  // Also check file extensions for cases where MIME type isn't reliable
  const validExtensions = ['.txt', '.epub', '.pdf'];
  const fileName = file.name.toLowerCase();
  
  return (
    validTypes.includes(file.type) ||
    validExtensions.some(ext => fileName.endsWith(ext))
  );
};

/**
 * Checks if a file is within the size limit
 */
export const isFileSizeValid = (file: File, maxSizeBytes: number = 5 * 1024 * 1024): boolean => {
  return file.size <= maxSizeBytes;
};

/**
 * Reads a text file and returns its contents
 */
export const readTextFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      if (!e.target || typeof e.target.result !== 'string') {
        reject(new Error('Failed to read file'));
        return;
      }
      resolve(e.target.result);
    };
    
    reader.onerror = () => {
      reject(new Error('Error reading file'));
    };
    
    reader.readAsText(file);
  });
};

/**
 * Formats a file size in bytes to a human-readable string
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * Formats a duration in seconds to mm:ss format
 */
export const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
};

/**
 * Generates a safe filename from a chapter title
 */
export const safeFileName = (title: string): string => {
  return `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp3`;
};
