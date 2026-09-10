/* eslint-disable no-console, @typescript-eslint/no-empty-function */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { LoggingService } from './logging.service';
import { LogLevel } from './log-level.enum';
import { environment } from '../../environments/environment';

describe('LoggingService', () => {
  let service: LoggingService;
  const originalVerbosity = environment.loggingVerbosity;

  beforeEach(() => {
    // Suppress output; the assertions are on the spy calls.
    vi.spyOn(console, 'error')
      .mockImplementation(() => {})
      .mockClear();
    vi.spyOn(console, 'warn')
      .mockImplementation(() => {})
      .mockClear();
    vi.spyOn(console, 'log')
      .mockImplementation(() => {})
      .mockClear();
    vi.spyOn(console, 'info')
      .mockImplementation(() => {})
      .mockClear();
    vi.spyOn(console, 'debug')
      .mockImplementation(() => {})
      .mockClear();

    // Print everything so the per-level assertions below aren't gated out.
    environment.loggingVerbosity = LogLevel.Debug;

    TestBed.configureTestingModule({});
    service = TestBed.inject(LoggingService);
  });

  afterEach(() => {
    environment.loggingVerbosity = originalVerbosity;
  });

  describe('error', () => {
    it('passes the context and message to console.error', () => {
      service.error('err-msg', 'err-ctx');
      expect(console.error).toHaveBeenCalledWith(
        '%c[%s]',
        'color:#888',
        'err-ctx',
        'err-msg'
      );
    });
  });

  describe('warn', () => {
    it('passes the context and message to console.warn', () => {
      service.warn('warn-msg', 'warn-ctx');
      expect(console.warn).toHaveBeenCalledWith(
        '%c[%s]',
        'color:#888',
        'warn-ctx',
        'warn-msg'
      );
    });
  });

  describe('log', () => {
    it('passes the context and message to console.log', () => {
      service.log('log-msg', 'log-ctx');
      expect(console.log).toHaveBeenCalledWith(
        '%c[%s]',
        'color:#888',
        'log-ctx',
        'log-msg'
      );
    });
  });

  describe('info', () => {
    it('passes the context and message to console.info', () => {
      service.info('info-msg', 'info-ctx');
      expect(console.info).toHaveBeenCalledWith(
        '%c[%s]',
        'color:#888',
        'info-ctx',
        'info-msg'
      );
    });
  });

  describe('debug', () => {
    it('passes the context and message to console.debug', () => {
      service.debug('debug-msg', 'debug-ctx');
      expect(console.debug).toHaveBeenCalledWith(
        '%c[%s]',
        'color:#888',
        'debug-ctx',
        'debug-msg'
      );
    });
  });

  describe('verbosity gating', () => {
    it('drops messages below the configured verbosity', () => {
      environment.loggingVerbosity = LogLevel.Warn;

      service.debug('d', 'ctx');
      service.info('i', 'ctx');
      service.log('l', 'ctx');
      expect(console.debug).not.toHaveBeenCalled();
      expect(console.info).not.toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalled();

      service.warn('w', 'ctx');
      service.error('e', 'ctx');
      expect(console.warn).toHaveBeenCalledOnce();
      expect(console.error).toHaveBeenCalledOnce();
    });

    it('suppresses everything at Silent', () => {
      environment.loggingVerbosity = LogLevel.Silent;
      service.error('e', 'ctx');
      service.warn('w', 'ctx');
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  describe('recent-log buffer', () => {
    it('keeps only the most recent entries', () => {
      for (let i = 0; i < 150; i++) service.warn(`line ${i}`, 'ctx');
      const lines = service.recentLogs().split('\n');
      expect(lines.length).toBe(100);
      expect(lines[0]).toContain('line 50');
      expect(lines.at(-1)).toContain('line 149');
    });

    it('records regardless of console verbosity but excludes debug', () => {
      environment.loggingVerbosity = LogLevel.Silent;
      service.debug('a debug line', 'ctx');
      service.error('an error line', 'ctx');
      const logs = service.recentLogs();
      // Silent suppresses the console, but the error is still buffered.
      expect(logs).toContain('[ERROR][ctx] an error line');
      // Debug entries are deliberately not retained.
      expect(logs).not.toContain('a debug line');
    });

    it('serializes an Error to its stack', () => {
      service.error(new Error('kaboom'), 'ctx');
      expect(service.recentLogs()).toContain('kaboom');
    });

    it('prefixes each entry with a UTC time-of-day timestamp', () => {
      service.error('an error line', 'ctx');
      const line = service.recentLogs().split('\n').at(-1);
      expect(line).toMatch(
        /^\d{2}:\d{2}:\d{2}\.\d{3} \[ERROR]\[ctx] an error line$/
      );
    });

    it('collapses consecutive duplicates despite differing timestamps', () => {
      for (let i = 0; i < 3; i++) service.warn('same line', 'ctx');
      const lines = service
        .recentLogs()
        .split('\n')
        .filter((l) => l.includes('same line'));
      expect(lines.length).toBe(1);
    });
  });

  describe('time', () => {
    it('logs the elapsed time at debug level when stopped', () => {
      const stop = service.time('do work', 'ctx');
      expect(console.debug).not.toHaveBeenCalled();
      stop();
      expect(console.debug).toHaveBeenCalledWith(
        '%c[%s]',
        'color:#888',
        'ctx',
        expect.stringMatching(/^do work took [\d.]+ ms$/)
      );
    });
  });
});
