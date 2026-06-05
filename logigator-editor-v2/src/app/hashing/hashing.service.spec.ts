import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { HashingService } from './hashing.service';

describe('HashingService', () => {
  let service: HashingService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(HashingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('hashUrl returns a string containing the original URI', () => {
    const uri = 'path/to/file.js';
    expect(service.hashUrl(uri)).toContain(uri);
  });

  it('uses "?" as separator when URI has no query string', () => {
    expect(service.hashUrl('path/to/file.js')).toContain('?v=');
  });

  it('uses "&" as separator when URI already has a query string', () => {
    expect(service.hashUrl('/foo?bar=1')).toContain('&v=');
  });

  it('returns a consistent hash across multiple calls on the same instance', () => {
    const first = service.hashUrl('path/a.js');
    const second = service.hashUrl('path/b.js');
    const hashFromFirst = first.split('?v=')[1];
    const hashFromSecond = second.split('?v=')[1];
    expect(hashFromFirst).toBe(hashFromSecond);
  });

  it('returned string starts with the original URI', () => {
    const uri = 'path/to/file.js';
    expect(service.hashUrl(uri).startsWith(uri)).toBe(true);
  });

  it('appends a non-empty hash value after v=', () => {
    const result = service.hashUrl('path/to/file.js');
    const hash = result.split('?v=')[1];
    expect(hash).toBeTruthy();
  });
});
