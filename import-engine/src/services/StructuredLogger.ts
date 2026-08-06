import type { ImportLogEntry, ImportLogLevel } from '../models/PackageInspection';

/**
 * Structured logger for the import pipeline.
 * UI and tests consume entries — no console side-effects required.
 */
export class StructuredLogger {
  private readonly entries: ImportLogEntry[] = [];

  log(
    level: ImportLogLevel,
    event: ImportLogEntry['event'],
    message: string,
    data?: Record<string, unknown>
  ): void {
    this.entries.push({
      timestamp: new Date().toISOString(),
      level,
      event,
      message,
      data,
    });
  }

  info(event: ImportLogEntry['event'], message: string, data?: Record<string, unknown>): void {
    this.log('info', event, message, data);
  }

  warn(event: ImportLogEntry['event'], message: string, data?: Record<string, unknown>): void {
    this.log('warn', event, message, data);
  }

  error(event: ImportLogEntry['event'], message: string, data?: Record<string, unknown>): void {
    this.log('error', event, message, data);
  }

  getEntries(): readonly ImportLogEntry[] {
    return this.entries;
  }

  snapshot(): ImportLogEntry[] {
    return [...this.entries];
  }
}
