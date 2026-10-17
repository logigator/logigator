import { ApplicationRef, Component, input, model, output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NameMap } from '@logigator/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureTestBed } from '../../../../testing/configure-test-bed';
import { NameMapEditor } from './name-map-editor';
import { NameMapComponentOption } from './name-map.component-option';
import { NameMapOptionInputComponent } from './name-map-option-input.component';

@Component({ selector: 'app-fake-names-editor', template: '' })
class FakeNamesEditor implements NameMapEditor {
  public static last: FakeNamesEditor | null = null;

  public readonly keys = input.required<readonly string[]>();
  public readonly names = model.required<NameMap>();
  public readonly maxLength = input.required<number>();
  public readonly save = output<void>();

  constructor() {
    FakeNamesEditor.last = this;
  }
}

describe('NameMapOptionInputComponent', () => {
  let fixture: ComponentFixture<NameMapOptionInputComponent>;
  let commit: ReturnType<typeof vi.fn<(value: NameMap) => void>>;

  function render(option: NameMapComponentOption): HTMLElement {
    fixture = TestBed.createComponent(NameMapOptionInputComponent);
    fixture.componentRef.setInput('option', option);
    fixture.componentRef.setInput('commit', commit);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function makeOption(): NameMapComponentOption {
    return (
      new NameMapComponentOption(
        'components.def.GAMEPAD.options.names',
        ['up', 'down', 'a', 'b'],
        { up: 'Jump', b: 'Fire' },
        { maxLength: 8 }
      )
        // `b` is not shown, as for a switched-off group.
        .attachKeys(() => ['up', 'down', 'a'])
    );
  }

  /** Opens the dialog from the row and returns the hosted editor. */
  function openDialog(host: HTMLElement): FakeNamesEditor {
    host.querySelector('button')!.click();
    TestBed.inject(ApplicationRef).tick();
    const editor = FakeNamesEditor.last;
    if (!editor) throw new Error('the dialog hosts no editor');
    return editor;
  }

  /** The dialog's footer reads Cancel, then Save. */
  function dialogButton(which: 'save' | 'cancel'): HTMLElement {
    const buttons = document.querySelectorAll<HTMLElement>(
      '.cdk-overlay-container app-name-map-dialog button'
    );
    expect(buttons.length).toBe(2);
    return buttons[which === 'cancel' ? 0 : 1];
  }

  beforeEach(() => {
    configureTestBed([], [NameMapOptionInputComponent]);
    commit = vi.fn<(value: NameMap) => void>();
    FakeNamesEditor.last = null;
  });

  afterEach(() => {
    document.querySelector('.cdk-overlay-container')?.replaceChildren();
  });

  it('draws no row while no editor is attached', () => {
    const host = render(makeOption());
    expect(host.querySelector('button')).toBeNull();
  });

  it('hands the editor the shown keys and the current names', () => {
    const editor = openDialog(
      render(makeOption().attachEditor(FakeNamesEditor))
    );
    expect(editor.keys()).toEqual(['up', 'down', 'a']);
    expect(editor.names()).toEqual({ up: 'Jump', b: 'Fire' });
    expect(editor.maxLength()).toBe(8);
  });

  it('commits the edited draft once on Save, hidden names included', () => {
    const editor = openDialog(
      render(makeOption().attachEditor(FakeNamesEditor))
    );
    editor.names.set({ ...editor.names(), a: 'Run' });
    editor.names.set({ ...editor.names(), up: '' });
    dialogButton('save').click();

    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith({ up: '', b: 'Fire', a: 'Run' });
  });

  it('commits nothing on Cancel', () => {
    const editor = openDialog(
      render(makeOption().attachEditor(FakeNamesEditor))
    );
    editor.names.set({ a: 'Run' });
    dialogButton('cancel').click();

    expect(commit).not.toHaveBeenCalled();
    expect(document.querySelector('app-name-map-dialog')).toBeNull();
  });
});
