import { afterEach, describe, expect, it, vi } from 'vitest';
import { Component, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { provideMarkdown } from 'ngx-markdown';
import { LgTextarea } from '../textarea/textarea';
import { LgMarkdownField } from './markdown-field';

@Component({
  imports: [LgMarkdownField, LgTextarea, ReactiveFormsModule],
  template: `<form [formGroup]="form">
    <lg-markdown-field [value]="bio()" [maxLength]="max()">
      <textarea lgTextarea id="bio" formControlName="bio"></textarea>
    </lg-markdown-field>
  </form>`
})
class Host {
  readonly form = new FormGroup({
    bio: new FormControl('', { nonNullable: true })
  });
  // A signal, the way the real call sites bind it: `control.value` is a plain
  // getter and this app is zoneless, so a binding on it would never update.
  readonly bio = toSignal(this.form.controls.bio.valueChanges, {
    initialValue: ''
  });
  readonly max = signal<number | undefined>(100);
}

function render() {
  TestBed.configureTestingModule({ providers: [provideMarkdown()] });
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  return fixture;
}

function textarea(fixture: ReturnType<typeof render>): HTMLTextAreaElement {
  return (fixture.nativeElement as HTMLElement).querySelector('textarea')!;
}

/**
 * The counter. Selected by `aria-hidden`, which is a real property of it —
 * the preview beside it renders the author's own paragraphs, so a bare `p`
 * now finds their text first.
 */
function counter(fixture: ReturnType<typeof render>): string {
  const host = fixture.nativeElement as HTMLElement;
  return host.querySelector('p[aria-hidden="true"]')?.textContent?.trim() ?? '';
}

/** The toolbar button whose accessible name is `label`. */
function toolButton(
  fixture: ReturnType<typeof render>,
  label: string
): HTMLButtonElement {
  const host = fixture.nativeElement as HTMLElement;
  const button = Array.from(host.querySelectorAll('button')).find(
    (candidate) => candidate.getAttribute('aria-label') === label
  );
  expect(button, `no toolbar button labelled ${label}`).toBeDefined();
  return button as HTMLButtonElement;
}

afterEach(() => {
  vi.restoreAllMocks();
  // `Object.defineProperty` is not a spy, so `restoreAllMocks` leaves it in
  // place — and jsdom has no `execCommand` of its own, so a stub left behind
  // makes every later test take the browser path into a detached element.
  delete (document as Partial<Document>).execCommand;
});

describe('LgMarkdownField', () => {
  it('writes a formatting change back through the bound control', () => {
    // The field owns no value: what reaches the form is the `input` event the
    // browser would have raised, which is what the value accessor listens for.
    const fixture = render();
    const control = fixture.componentInstance.form.controls.bio;
    control.setValue('a word here');
    fixture.detectChanges();

    const field = textarea(fixture);
    field.setSelectionRange(2, 6);
    toolButton(fixture, 'Bold').click();
    fixture.detectChanges();

    expect(control.value).toBe('a **word** here');
  });

  it('marks the control dirty but not touched', () => {
    // A toolbar click is an edit, not a blur; marking it touched would light
    // up the dialog's validation messages in the middle of typing.
    const fixture = render();
    const control = fixture.componentInstance.form.controls.bio;
    control.setValue('word');
    fixture.detectChanges();

    textarea(fixture).setSelectionRange(0, 4);
    toolButton(fixture, 'Italic').click();

    expect(control.dirty).toBe(true);
    expect(control.touched).toBe(false);
  });

  it('prefers the browser insertion, which keeps the undo stack', () => {
    const fixture = render();
    fixture.componentInstance.form.controls.bio.setValue('word');
    fixture.detectChanges();
    const field = textarea(fixture);
    field.setSelectionRange(0, 4);

    // jsdom has no execCommand, so the real path is only observable stubbed.
    const execCommand = vi.fn(function (this: Document) {
      field.value = '**word**';
      return true;
    });
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommand
    });

    toolButton(fixture, 'Bold').click();

    expect(execCommand).toHaveBeenCalledWith('insertText', false, '**word**');
  });

  it('refuses an insertion that would overrun the cap', () => {
    // `maxlength` bounds typing, never a scripted write, so the field has to
    // refuse this itself rather than let the column reject it later.
    const fixture = render();
    const control = fixture.componentInstance.form.controls.bio;
    control.setValue('a'.repeat(99));
    fixture.detectChanges();

    textarea(fixture).setSelectionRange(0, 99);
    toolButton(fixture, 'Bold').click();

    expect(control.value).toBe('a'.repeat(99));
  });

  it('gives every toolbar button type=button', () => {
    // All four call sites sit in a form whose submit is Save.
    const fixture = render();
    const host = fixture.nativeElement as HTMLElement;
    for (const button of host.querySelectorAll('button')) {
      expect(button.getAttribute('type')).toBe('button');
    }
  });

  it('counts what is bound, and follows what is typed', () => {
    const fixture = render();
    fixture.componentInstance.form.controls.bio.setValue('abcd');
    fixture.detectChanges();
    expect(counter(fixture)).toBe('4 / 100');

    const field = textarea(fixture);
    field.value = 'abcdefg';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    expect(counter(fixture)).toBe('7 / 100');
  });

  it('counts a programmatic write, which is what a save puts back', () => {
    // The account page redraws the form from the API's answer, where the bio
    // has been trimmed; the counter has to follow that, not the last keystroke.
    const fixture = render();
    const field = textarea(fixture);
    field.value = 'typed  ';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    fixture.componentInstance.form.controls.bio.setValue('typed');
    fixture.detectChanges();

    expect(counter(fixture)).toBe('5 / 100');
  });

  it('counts an emoji the way the cap that stops you counts it', () => {
    // Two, not one: `maxlength` and the contract both count UTF-16 units, so
    // a counter showing code points would disagree with what refuses the
    // next keystroke.
    const fixture = render();
    fixture.componentInstance.form.controls.bio.setValue('\u{1f551}');
    fixture.detectChanges();

    expect(counter(fixture)).toBe('2 / 100');
  });

  it('previews through the same rule the page renders under', () => {
    // Split is the default, so the preview is already up.
    const fixture = render();
    fixture.componentInstance.form.controls.bio.setValue(
      'A **bold** claim.\n\n<img src=x onerror="alert(1)">'
    );
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const rendered = host.querySelector('lg-markdown')!;
    expect(rendered.querySelector('strong')?.textContent).toBe('bold');
    // The preview is the page: an author sees the same refusal a reader would.
    expect(rendered.querySelector('img')).toBeNull();
    // The textarea is hidden, never removed, so the label still points at it.
    expect(host.querySelector('textarea')).not.toBeNull();
  });

  it('leaves the control’s own wiring alone', () => {
    // `lg-form-field` hands the consumer an `aria-describedby` to bind; the
    // field must not mint ids or reach into the projected control's ARIA.
    const fixture = render();
    const field = textarea(fixture);
    expect(field.id).toBe('bio');
    expect(field.getAttribute('aria-describedby')).toBeNull();
  });

  it('shows both panes by default, so typing is rendered as it happens', () => {
    const fixture = render();
    const host = fixture.nativeElement as HTMLElement;

    expect(
      host.querySelector('lg-markdown-field')?.getAttribute('data-view')
    ).toBe('split');
    expect(host.querySelector('textarea')).not.toBeNull();
    expect(host.querySelector('lg-markdown')).not.toBeNull();
  });

  it('follows the textarea live while split', () => {
    const fixture = render();
    const field = textarea(fixture);
    field.value = 'A **bold** claim.';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('lg-markdown strong')?.textContent).toBe('bold');
  });

  it('keeps the textarea in the DOM in every view', () => {
    // Hidden, never removed: its id is what the field's label points at, and
    // its value is the form's.
    const fixture = render();
    const host = fixture.nativeElement as HTMLElement;
    for (const label of ['Write', 'Split', 'Preview']) {
      const option = Array.from(host.querySelectorAll('button')).find(
        (button) => button.textContent?.trim() === label
      )!;
      option.click();
      fixture.detectChanges();
      expect(host.querySelector('textarea'), label).not.toBeNull();
    }
  });

  it('offers the full toolbar, grouped', () => {
    const fixture = render();
    const host = fixture.nativeElement as HTMLElement;
    const labels = Array.from(host.querySelectorAll('[role=group] button'))
      .map((button) => button.getAttribute('aria-label'))
      .filter((label): label is string => label !== null);

    expect(labels).toEqual([
      'Heading 1',
      'Heading 2',
      'Heading 3',
      'Bold',
      'Italic',
      'Code',
      'Link',
      'Bulleted list',
      'Numbered list',
      'Quote',
      'Divider',
      'Table'
    ]);
    // A rule between groups, and never a trailing one.
    expect(host.querySelectorAll('lg-divider').length).toBe(4);
  });

  it('still edits while split, and stops only in preview', () => {
    const fixture = render();
    const control = fixture.componentInstance.form.controls.bio;
    control.setValue('word');
    fixture.detectChanges();

    const field = textarea(fixture);
    field.setSelectionRange(0, 4);
    const bold = toolButton(fixture, 'Bold');
    bold.click();
    fixture.detectChanges();
    expect(control.value).toBe('**word**');

    const preview = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button')
    ).find((button) => button.textContent?.trim() === 'Preview')!;
    preview.click();
    fixture.detectChanges();

    expect(toolButton(fixture, 'Bold').getAttribute('aria-disabled')).toBe(
      'true'
    );
  });
});
