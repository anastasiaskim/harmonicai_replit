/**
 * Logger Service
 * 
 * Provides centralized logging functionality with different log levels,
 * formatting, and file output capabilities.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createWriteStream, WriteStream } from 'fs';

// Log levels
export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG',
  TRACE = 'TRACE'
}

// Log entry interface
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  error?: Error;
  source?: string;
}

// Logger configuration
interface LoggerConfig {
  level: LogLevel;
  filePath?: string;
  maxFileSize?: number;
  maxFiles?: number;
  format?: 'json' | 'text';
  includeTimestamp?: boolean;
  includeSource?: boolean;
}

class Logger {
  private config: LoggerConfig;
  private fileStream: WriteStream | null = null;
  private currentFileSize: number = 0;
  private logFileIndex: number = 0;
  private source: string;

  constructor(config: Partial<LoggerConfig> = {}, source: string = 'app') {
    this.config = {
      level: config.level || LogLevel.INFO,
      filePath: config.filePath || path.join(process.cwd(), 'logs'),
      maxFileSize: config.maxFileSize || 5 * 1024 * 1024, // 5MB
      maxFiles: config.maxFiles || 5,
      format: config.format || 'text',
      includeTimestamp: config.includeTimestamp ?? true,
      includeSource: config.includeSource ?? true
    };
    this.source = source;
    this.initializeFileStream();
  }

  /**
   * Initialize the file stream for logging
   */
  private initializeFileStream(): void {
    if (!this.config.filePath) return;

    // Create logs directory if it doesn't exist
    const logDir = path.dirname(this.config.filePath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    // Find the next available log file index
    while (fs.existsSync(this.getLogFilePath())) {
      this.logFileIndex++;
    }

    // Create write stream
    this.fileStream = createWriteStream(this.getLogFilePath(), { flags: 'a' });
    this.currentFileSize = fs.existsSync(this.getLogFilePath()) 
      ? fs.statSync(this.getLogFilePath()).size 
      : 0;
  }

  /**
   * Get the current log file path
   */
  private getLogFilePath(): string {
    const basePath = this.config.filePath!;
    const ext = path.extname(basePath);
    const baseName = path.basename(basePath, ext);
    return path.join(
      path.dirname(basePath),
      `${baseName}${this.logFileIndex ? `-${this.logFileIndex}` : ''}${ext}`
    );
  }

  /**
   * Rotate log files if necessary
   */
  private rotateLogFile(): void {
    if (!this.fileStream || !this.config.filePath) return;

    // Close current stream
    this.fileStream.end();

    // Remove old log files if we've exceeded maxFiles
    const logDir = path.dirname(this.config.filePath);
    const baseName = path.basename(this.config.filePath, path.extname(this.config.filePath));
    const logFiles = fs.readdirSync(logDir)
      .filter(file => file.startsWith(baseName))
      .sort();

    while (logFiles.length >= this.config.maxFiles!) {
      const oldestFile = logFiles.shift();
      if (oldestFile) {
        fs.unlinkSync(path.join(logDir, oldestFile));
      }
    }

    // Reset file index and create new stream
    this.logFileIndex = 0;
    this.initializeFileStream();
  }

  /**
   * Format log entry based on configuration
   */
  private formatLogEntry(entry: LogEntry): string {
    if (this.config.format === 'json') {
      return JSON.stringify(entry) + '\n';
    }

    // Text format
    let formatted = '';
    
    if (this.config.includeTimestamp) {
      formatted += `[${entry.timestamp}] `;
    }
    
    formatted += `${entry.level}`;
    
    if (this.config.includeSource && entry.source) {
      formatted += ` [${entry.source}]`;
    }
    
    formatted += `: ${entry.message}`;
    
    if (entry.context) {
      formatted += `\nContext: ${JSON.stringify(entry.context, null, 2)}`;
    }
    
    if (entry.error) {
      formatted += `\nError: ${entry.error.message}`;
      if (entry.error.stack) {
        formatted += `\nStack: ${entry.error.stack}`;
      }
    }
    
    return formatted + '\n';
  }

  /**
   * Write log entry to file
   */
  private writeToFile(entry: LogEntry): void {
    if (!this.fileStream) return;

    const formattedEntry = this.formatLogEntry(entry);
    const entrySize = Buffer.byteLength(formattedEntry);

    // Check if we need to rotate the log file
    if (this.currentFileSize + entrySize > this.config.maxFileSize!) {
      this.rotateLogFile();
    }

    this.fileStream.write(formattedEntry);
    this.currentFileSize += entrySize;
  }

  /**
   * Log a message with the specified level
   */
  private log(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): void {
    // Check if we should log this level
    if (this.getLogLevelValue(level) > this.getLogLevelValue(this.config.level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error,
      source: this.source
    };

    // Write to console with appropriate color
    const consoleMessage = this.formatLogEntry(entry);
    switch (level) {
      case LogLevel.ERROR:
        console.error(consoleMessage);
        break;
      case LogLevel.WARN:
        console.warn(consoleMessage);
        break;
      default:
        console.log(consoleMessage);
    }

    // Write to file if configured
    if (this.config.filePath) {
      this.writeToFile(entry);
    }
  }

  /**
   * Get numeric value for log level
   */
  private getLogLevelValue(level: LogLevel): number {
    return Object.values(LogLevel).indexOf(level);
  }

  /**
   * Log an error message
   */
  error(message: string, context?: Record<string, any>, error?: Error): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log an info message
   */
  info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log a debug message
   */
  debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log a trace message
   */
  trace(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.TRACE, message, context);
  }

  /**
   * Create a new logger instance with a specific source
   */
  createLogger(source: string): Logger {
    return new Logger(this.config, source);
  }

  /**
   * Close the logger and its file stream
   */
  close(): void {
    if (this.fileStream) {
      this.fileStream.end();
      this.fileStream = null;
    }
  }
}

// Create and export a default logger instance
export const logger = new Logger({
  level: process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
  filePath: path.join(process.cwd(), 'logs', 'app.log'),
  format: 'text',
  includeTimestamp: true,
  includeSource: true
});

// Export the Logger class for custom instances
export default Logger; 