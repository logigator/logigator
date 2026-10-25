import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../testing/configure-test-bed';
import { TranslationService } from '../translation/translation.service';
import { SiteLinks } from './site-links';

describe('SiteLinks', () => {
  beforeEach(() => {
    configureTestBed();
  });

  it('re-prefixes every destination when the document switches language', async () => {
    // The prefix is part of the path, so a switch that left the links behind
    // would send the next click back to the language just left.
    const links = TestBed.inject(SiteLinks);
    expect(links.home()).toBe('/en');
    expect(links.myProjects()).toBe('/en/my/projects');

    await TestBed.inject(TranslationService).setActiveLang('de');

    expect(links.home()).toBe('/de');
    expect(links.myProjects()).toBe('/de/my/projects');
  });
});
