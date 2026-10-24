import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { Rectangle } from 'pixi.js';
import { DialogRef, DialogService } from '@logigator/ui';
import { configureTestBed } from '../../../../testing/configure-test-bed';
import { makeRom } from '../../../../testing/factories';
import { ChangeOptionAction } from '../../../actions/actions/change-option.action';
import { ProjectMetadataStore } from '../../../persistence/project-metadata.store';
import { Project } from '../../../project/project';
import { ProjectService } from '../../../project/project.service';
import { TranslationService } from '../../../translation/translation.service';
import { ComponentSettingsComponent } from '../../../ui/component-settings/component-settings.component';
import { HexEditorComponent } from '../../../ui/hex-editor/hex-editor.component';
import { WorkMode } from '../../../work-mode/work-mode.enum';

describe('MemoryDataOptionInputComponent in the settings panel', () => {
  let project: Project;

  beforeEach(() => {
    configureTestBed([], [ComponentSettingsComponent]);
  });

  afterEach(() => {
    document.querySelector('.cdk-overlay-container')?.replaceChildren();
    project.destroy({ children: true });
  });

  it('keeps the row’s word count in step after a save, an undo and a resize', async () => {
    // The summary is checked as the reader sees it, so the bundle is loaded.
    const transloco = TestBed.inject(TranslocoService);
    await firstValueFrom(transloco.load('en'));
    transloco.setActiveLang('en');

    project = new Project();
    // Two-bit address, four-bit words: only word 0 is set.
    const rom = makeRom(2, 4, btoa(String.fromCharCode(0x01)));
    project.addComponent(rom);
    TestBed.inject(ProjectMetadataStore).register(project, {
      id: 'p',
      name: 'P',
      type: 'project',
      source: 'browser',
      visibility: 'private'
    });
    TestBed.inject(ProjectService).setMainProject(project);
    project.selectionManager.commit(
      new Rectangle(-1, -1, 20, 20),
      WorkMode.SELECT
    );
    const fixture = TestBed.createComponent(ComponentSettingsComponent);
    fixture.detectChanges();
    const appRef = TestBed.inject(ApplicationRef);
    const translation = TestBed.inject(TranslationService);
    const set = (count: number, total: number) =>
      translation.translate('components.options.memory.summary', {
        count,
        total
      });

    const row = (
      fixture.nativeElement as HTMLElement
    ).querySelector<HTMLElement>('app-memory-data-option-input button')!;
    const summary = () =>
      document
        .getElementById(row.getAttribute('aria-describedby') ?? '')
        ?.textContent?.trim();
    expect(summary()).toBe(set(1, 4));

    const open = vi.spyOn(TestBed.inject(DialogService), 'open');
    row.click();
    appRef.tick();
    const ref = open.mock.results[0].value as DialogRef<
      unknown,
      HexEditorComponent
    >;
    let editor: HexEditorComponent | undefined;
    ref.onChildComponentLoaded.subscribe((loaded) => (editor = loaded));
    // Words 0 and 2 set, as the editor's Save hands them over.
    editor!.saved.emit(new Uint8Array([0x01, 0x01]));
    appRef.tick();
    expect(summary()).toBe(set(2, 4));

    project.actionManager.undo();
    appRef.tick();
    expect(summary()).toBe(set(1, 4));

    project.actionManager.push(
      new ChangeOptionAction(rom.id, 'wordSize', 4, 1)
    );
    appRef.tick();
    // One-bit words over the same byte: only word 0 is set, of 4.
    expect(summary()).toBe(set(1, 4));
    project.actionManager.push(
      new ChangeOptionAction(rom.id, 'addressSize', 2, 3)
    );
    appRef.tick();
    expect(summary()).toBe(set(1, 8));
  });
});
