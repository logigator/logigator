import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { Rectangle } from 'pixi.js';
import { AppComponent } from './app.component';
import { PersistenceService } from './persistence/persistence.service';
import { configureTestBed } from '../testing/configure-test-bed';
import { ProjectService } from './project/project.service';
import { ProjectMetadataStore } from './persistence/project-metadata.store';
import { MobileUiService } from './layout/mobile-ui.service';
import { Project } from './project/project';
import { WorkMode } from './work-mode/work-mode.enum';
import { makeAnd } from '../testing/factories';

/** Forces the compact breakpoint before LayoutService reads matchMedia. */
function stubCompactMatchMedia(): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) =>
      ({
        matches: query.includes('max-width'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }) as unknown as MediaQueryList
  });
}

describe('AppComponent', () => {
  beforeEach(() => {
    configureTestBed(
      [
        {
          provide: Location,
          useValue: {
            path: () => '/',
            go: () => undefined,
            replaceState: () => undefined,
            subscribe: () => ({ unsubscribe: () => undefined })
          }
        },
        {
          provide: PersistenceService,
          useValue: {
            preloadBrowserMasters: vi.fn().mockResolvedValue(undefined),
            preloadComponentIdAliases: vi.fn().mockResolvedValue(undefined),
            preloadServerMasters: vi.fn().mockResolvedValue(undefined),
            createAndSetEmptyProject: vi.fn(),
            registerOpenProject: vi.fn()
          }
        }
      ],
      [AppComponent]
    );
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('renders the desktop shell at the default (non-compact) breakpoint', () => {
    // matchMedia is stubbed to matches:false (vitest.setup.ts), so isCompact is
    // false and the shell takes its desktop branch.
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('app-title-bar')).not.toBeNull();
    expect(el.querySelector('app-tool-bar')).not.toBeNull();
    expect(el.querySelector('app-board')).not.toBeNull();
    expect(el.querySelector('app-mobile-top-bar')).toBeNull();
    expect(el.querySelector('app-tool-hud')).toBeNull();
  });

  it('renders the mobile shell (and single board) when compact', () => {
    stubCompactMatchMedia();

    const fixture = TestBed.createComponent(AppComponent);
    expect(() => fixture.detectChanges()).not.toThrow();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('app-mobile-top-bar')).not.toBeNull();
    expect(el.querySelector('app-tool-hud')).not.toBeNull();
    expect(el.querySelector('app-title-bar')).toBeNull();
    // The canvas is never duplicated across the breakpoint branches.
    expect(el.querySelectorAll('app-board').length).toBe(1);
  });

  it('auto-opens the settings sheet on selection and closes it when selection clears', () => {
    stubCompactMatchMedia();

    // Creating the fixture sets the static DI injector (constructor), so a
    // standalone Project can be built afterwards.
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const mobileUi = TestBed.inject(MobileUiService);
    const projectService = TestBed.inject(ProjectService);
    const metadataStore = TestBed.inject(ProjectMetadataStore);

    const project = new Project();
    const comp = makeAnd();
    comp.position.set(0, 0);
    project.addComponent(comp);
    metadataStore.register(project, {
      id: 'p',
      name: 'P',
      type: 'project',
      source: 'browser',
      hash: '',
      isPublic: false
    });
    projectService.setMainProject(project);
    fixture.detectChanges();

    // Selecting a single component opens the settings sheet.
    project.selectionManager.commit(new Rectangle(0, 0, 3, 3), WorkMode.SELECT);
    fixture.detectChanges();
    expect(mobileUi.activeSheet()).toBe('settings');

    // Clearing the selection (e.g. opening the component editor switched tabs)
    // closes it rather than leaving a blank panel.
    project.selectionManager.clear();
    fixture.detectChanges();
    expect(mobileUi.activeSheet()).toBeNull();

    project.destroy({ children: true });
  });
});
