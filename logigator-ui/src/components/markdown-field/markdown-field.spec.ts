import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApplicationRef, Component, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { LgTextarea } from '../textarea/textarea';
import { formFieldClasses, FORM_FIELD_INVALID } from '../../tokens/form-field';
import { LgMarkdownField } from './markdown-field';

@Component({
  imports: [LgMarkdownField, LgTextarea, ReactiveFormsModule],
  template: `<form [formGroup]="form">
    <label id="bio-label" for="bio">Bio</label>
    <lg-markdown-field
      [value]="bio()"
      [maxLength]="max()"
      [invalid]="invalid()"
      labelledBy="bio-label"
    >
      <textarea
        lgTextarea
        id="bio"
        rows="6"
        [invalid]="invalid()"
        formControlName="bio"
      ></textarea>
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
  readonly invalid = signal(false);
}

type Fixture = ReturnType<typeof render>;

function render() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  return fixture;
}

function host(fixture: Fixture): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function control(fixture: Fixture) {
  return fixture.componentInstance.form.controls.bio;
}

function textarea(fixture: Fixture): HTMLTextAreaElement {
  return host(fixture).querySelector('textarea')!;
}

/** The rich surface, or `null` while its chunk is still on the way. */
function surface(fixture: Fixture): HTMLElement | null {
  return host(fixture).querySelector('.lg-rich-surface');
}

/**
 * Renders with the rich editor up.
 *
 * Its module is a dynamic `import()` resolved after the first render, so
 * there is no synchronous point at which it exists: the fixture is ticked
 * until the surface it builds is in the DOM.
 */
async function renderRich(initial = ''): Promise<Fixture> {
  const fixture = render();
  if (initial) {
    control(fixture).setValue(initial);
    fixture.detectChanges();
  }
  const app = TestBed.inject(ApplicationRef);
  for (let attempt = 0; attempt < 100 && !surface(fixture); attempt++) {
    app.tick();
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  expect(surface(fixture), 'the rich editor never mounted').not.toBeNull();
  fixture.detectChanges();
  return fixture;
}

/** Lets an edit made through the editor reach the form and the view. */
async function settle(fixture: Fixture): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  TestBed.inject(ApplicationRef).tick();
  fixture.detectChanges();
}

/**
 * The counter. Selected by `aria-hidden`, which is a real property of it —
 * the rich surface beside it renders the author's own paragraphs, so a bare
 * `p` now finds their text first.
 */
function counter(fixture: Fixture): string {
  return (
    host(fixture).querySelector('p[aria-hidden="true"]')?.textContent?.trim() ??
    ''
  );
}

/** The toolbar button whose accessible name is `label`. */
function toolButton(fixture: Fixture, label: string): HTMLButtonElement {
  const button = Array.from(host(fixture).querySelectorAll('button')).find(
    (candidate) => candidate.getAttribute('aria-label') === label
  );
  expect(button, `no toolbar button labelled ${label}`).toBeDefined();
  return button as HTMLButtonElement;
}

/** The link row's address field, or `null` while the row is not up. */
function linkInput(fixture: Fixture): HTMLInputElement | null {
  return host(fixture).querySelector('input[type=url]');
}

/** The mode control's option reading `label`. */
function modeButton(fixture: Fixture, label: string): HTMLButtonElement {
  const button = Array.from(host(fixture).querySelectorAll('button')).find(
    (candidate) => candidate.textContent?.trim() === label
  );
  expect(button, `no mode button labelled ${label}`).toBeDefined();
  return button as HTMLButtonElement;
}

afterEach(() => {
  vi.restoreAllMocks();
  // `Object.defineProperty` is not a spy, so `restoreAllMocks` leaves it in
  // place — and jsdom has no `execCommand` of its own, so a stub left behind
  // makes every later test take the browser path into a detached element.
  delete (document as Partial<Document>).execCommand;
});

describe('LgMarkdownField, editing the source', () => {
  it('writes a formatting change back through the bound control', () => {
    // The field owns no value: what reaches the form is the `input` event the
    // browser would have raised, which is what the value accessor listens for.
    const fixture = render();
    control(fixture).setValue('a word here');
    fixture.detectChanges();

    const field = textarea(fixture);
    field.setSelectionRange(2, 6);
    toolButton(fixture, 'Bold').click();
    fixture.detectChanges();

    expect(control(fixture).value).toBe('a **word** here');
  });

  it('marks the control dirty but not touched', () => {
    // A toolbar click is an edit, not a blur; marking it touched would light
    // up the dialog's validation messages in the middle of typing.
    const fixture = render();
    control(fixture).setValue('word');
    fixture.detectChanges();

    textarea(fixture).setSelectionRange(0, 4);
    toolButton(fixture, 'Italic').click();

    expect(control(fixture).dirty).toBe(true);
    expect(control(fixture).touched).toBe(false);
  });

  it('prefers the browser insertion, which keeps the undo stack', () => {
    const fixture = render();
    control(fixture).setValue('word');
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
    control(fixture).setValue('a'.repeat(99));
    fixture.detectChanges();

    textarea(fixture).setSelectionRange(0, 99);
    toolButton(fixture, 'Bold').click();

    expect(control(fixture).value).toBe('a'.repeat(99));
  });

  it('fences the lines the selection covers', () => {
    const fixture = render();
    control(fixture).setValue('one\ntwo');
    fixture.detectChanges();

    const field = textarea(fixture);
    field.setSelectionRange(0, 7);
    toolButton(fixture, 'Code block').click();
    fixture.detectChanges();

    expect(control(fixture).value).toBe('```\none\ntwo\n```');
  });

  it('unfences lines that already are', () => {
    const fixture = render();
    control(fixture).setValue('```\none\n```');
    fixture.detectChanges();

    const field = textarea(fixture);
    field.setSelectionRange(0, 11);
    toolButton(fixture, 'Code block').click();
    fixture.detectChanges();

    expect(control(fixture).value).toBe('one');
  });

  it('leaves the control’s own wiring alone', () => {
    // `lg-form-field` hands the consumer an `aria-describedby` to bind; the
    // field must not mint ids or reach into the projected control's ARIA.
    const fixture = render();
    const field = textarea(fixture);
    expect(field.id).toBe('bio');
    expect(field.getAttribute('aria-describedby')).toBeNull();
  });

  it('gives every toolbar button type=button', () => {
    // All four call sites sit in a form whose submit is Save.
    const fixture = render();
    for (const button of host(fixture).querySelectorAll('button')) {
      expect(button.getAttribute('type')).toBe('button');
    }
  });

  it('offers the full toolbar, grouped', () => {
    const fixture = render();
    const labels = Array.from(
      host(fixture).querySelectorAll('[role=group] button')
    )
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
      'Code block',
      'Divider',
      'Table'
    ]);
    // A rule between groups, and never a trailing one.
    expect(host(fixture).querySelectorAll('lg-divider').length).toBe(4);
  });

  it('shows no pressed state where there is no document to read it from', () => {
    // A textarea knows where the selection is, not what it is inside. A
    // toggle drawn as off would be a claim the source view cannot make.
    const fixture = render();
    expect(toolButton(fixture, 'Bold').getAttribute('aria-pressed')).toBeNull();
  });
});

describe('LgMarkdownField, counting', () => {
  it('counts what is bound, and follows what is typed', () => {
    const fixture = render();
    control(fixture).setValue('abcd');
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

    control(fixture).setValue('typed');
    fixture.detectChanges();

    expect(counter(fixture)).toBe('5 / 100');
  });

  it('counts an emoji the way the cap that stops you counts it', () => {
    // Two, not one: `maxlength` and the contract both count UTF-16 units, so
    // a counter showing code points would disagree with what refuses the
    // next keystroke.
    const fixture = render();
    control(fixture).setValue('\u{1f551}');
    fixture.detectChanges();

    expect(counter(fixture)).toBe('2 / 100');
  });
});

describe('LgMarkdownField, editing the document', () => {
  it('renders the stored markdown as the document it describes', async () => {
    const fixture = await renderRich('hello _world_');
    expect(surface(fixture)?.innerHTML).toBe('<p>hello <em>world</em></p>');
  });

  it('leaves a document nobody edited byte for byte as it was', async () => {
    // The whole bargain of keeping markdown as the value: opening the rich
    // editor parses it, and parsing reports nothing. `_world_` is the proof —
    // the serializer writes emphasis as `*`, so anything that round-tripped
    // this document on the way in would have rewritten it.
    const fixture = await renderRich('hello _world_\n\n* a\n* b');
    await settle(fixture);

    expect(control(fixture).value).toBe('hello _world_\n\n* a\n* b');
    expect(control(fixture).dirty).toBe(false);
  });

  it('serializes an edit back through the bound control', async () => {
    const fixture = await renderRich('hello world');
    toolButton(fixture, 'Heading 1').click();
    await settle(fixture);

    expect(control(fixture).value).toBe('# hello world');
  });

  it('spells what it writes the way the source toolbar does', async () => {
    // remark's own defaults are not this project's: it rules with `***` and
    // bullets with `*`. A field whose two halves disagreed about that would
    // re-spell a description the moment one word of it was touched.
    const fixture = await renderRich('one');
    toolButton(fixture, 'Bulleted list').click();
    await settle(fixture);
    expect(control(fixture).value).toBe('- one');

    toolButton(fixture, 'Divider').click();
    await settle(fixture);
    expect(control(fixture).value).toContain('---');
  });

  it('leaves an inline marker an author already chose where it is', async () => {
    // Milkdown carries each mark's own marker on the mark, so `_one_` comes
    // back as `_one_` even when the document around it is rewritten. A list's
    // bullet is *not* carried that way and is re-spelled to the configured
    // one — which is why that option is set to what the source toolbar
    // writes, so the only documents it changes are ones pasted from
    // elsewhere.
    const fixture = await renderRich('_one_\n\n* a\n* b');
    toolButton(fixture, 'Heading 3').click();
    await settle(fixture);

    expect(control(fixture).value).toBe('### _one_\n\n- a\n- b');
  });

  it('makes a code block, and turns one back into a paragraph', async () => {
    // Inline code was the only thing the toolbar could reach; a description
    // explaining a circuit has more than one line of it to show.
    const fixture = await renderRich('const x = 1;');
    toolButton(fixture, 'Code block').click();
    await settle(fixture);
    expect(control(fixture).value).toBe('```\nconst x = 1;\n```');

    toolButton(fixture, 'Code block').click();
    await settle(fixture);
    expect(control(fixture).value).toBe('const x = 1;');
  });

  it('never writes markup into the value', async () => {
    // The renderer that draws a description produces no HTML an author wrote,
    // so a `<br />` in the markdown reaches the reader as those six
    // characters. Milkdown's empty-line plugin emits exactly that for a blank
    // paragraph, and is left out for this reason.
    const fixture = await renderRich('one');
    toolButton(fixture, 'Divider').click();
    await settle(fixture);

    expect(control(fixture).value).not.toContain('<br');
  });

  it('shows which tools are on where the caret is', async () => {
    const fixture = await renderRich('hello world');
    expect(toolButton(fixture, 'Heading 1').getAttribute('aria-pressed')).toBe(
      'false'
    );

    toolButton(fixture, 'Heading 1').click();
    await settle(fixture);

    expect(toolButton(fixture, 'Heading 1').getAttribute('aria-pressed')).toBe(
      'true'
    );
  });

  it('turns a heading it is already in back into a paragraph', async () => {
    // Every tool toggles, because every tool now shows whether it is on: a
    // pressed button that only ever added would be lying about what a second
    // press does.
    const fixture = await renderRich('hello world');
    toolButton(fixture, 'Heading 2').click();
    await settle(fixture);
    expect(control(fixture).value).toBe('## hello world');

    toolButton(fixture, 'Heading 2').click();
    await settle(fixture);
    expect(control(fixture).value).toBe('hello world');
  });

  it('names itself through the label, which no `for` can reach', async () => {
    // The projected textarea carries the id the `<label>` points at and is
    // hidden while the rich surface shows, so the name has to come the other
    // way round or the control has none at all.
    const fixture = await renderRich('hello');
    expect(surface(fixture)?.getAttribute('aria-labelledby')).toBe('bio-label');
    expect(surface(fixture)?.getAttribute('role')).toBe('textbox');
  });
});

describe('LgMarkdownField, the table row', () => {
  it('is absent until the caret is in a table', async () => {
    const fixture = await renderRich('hello');
    expect(
      host(fixture).querySelector('[aria-label="Table"][role=group]')
    ).toBeNull();

    toolButton(fixture, 'Table').click();
    await settle(fixture);

    expect(
      host(fixture).querySelector('[aria-label="Table"][role=group]')
    ).not.toBeNull();
  });

  it('adds a row to the table the caret is in', async () => {
    const fixture = await renderRich('');
    toolButton(fixture, 'Table').click();
    await settle(fixture);
    const before = control(fixture).value.split('\n').length;

    toolButton(fixture, 'Insert row below').click();
    await settle(fixture);

    expect(control(fixture).value.split('\n').length).toBe(before + 1);
  });

  it('writes the column alignment GFM’s delimiter row carries', async () => {
    const fixture = await renderRich('');
    toolButton(fixture, 'Table').click();
    await settle(fixture);

    toolButton(fixture, 'Align center').click();
    await settle(fixture);

    expect(control(fixture).value).toContain(':-');
    expect(
      toolButton(fixture, 'Align center').getAttribute('aria-pressed')
    ).toBe('true');
  });

  it('aligns the column, not the cell the caret happens to be in', async () => {
    // GFM has no per-cell alignment — the delimiter row aligns a column — so
    // the serializer reads the attribute off the header row alone and a
    // plugin syncs body cells back to it. Writing to one cell was therefore
    // either overwritten or never written out, and the button did nothing
    // from a body cell at all.
    const fixture = await renderRich('');
    toolButton(fixture, 'Table').click();
    await settle(fixture);

    toolButton(fixture, 'Align center').click();
    await settle(fixture);

    // The caret's column, header and body alike — and only that column.
    const rows = Array.from(surface(fixture)!.querySelectorAll('tr'));
    expect(rows.length).toBeGreaterThan(1);
    const column = (index: number) =>
      rows.map((row) => (row.children[index] as HTMLElement).style.textAlign);

    expect(column(0)).toEqual(rows.map(() => 'center'));
    expect(column(1)).not.toContain('center');
    expect(control(fixture).value).toContain(':-:');
  });

  it('takes the whole table away', async () => {
    const fixture = await renderRich('keep me');
    toolButton(fixture, 'Table').click();
    await settle(fixture);
    expect(control(fixture).value).toContain('|');

    toolButton(fixture, 'Delete table').click();
    await settle(fixture);

    expect(control(fixture).value).not.toContain('|');
    expect(control(fixture).value).toContain('keep me');
  });
});

describe('LgMarkdownField, the link row', () => {
  it('is absent until the caret is in a link', async () => {
    const fixture = await renderRich('hello');
    expect(linkInput(fixture)).toBeNull();

    toolButton(fixture, 'Link').click();
    await settle(fixture);

    expect(linkInput(fixture)?.value).toBe('https://');
  });

  it('points the link at what is typed into it', async () => {
    // A link's words are in the document and typed there; its destination is
    // not anywhere a caret can reach, so without this row the toolbar could
    // make a link and never say where it went.
    const fixture = await renderRich('hello');
    toolButton(fixture, 'Link').click();
    await settle(fixture);

    const input = linkInput(fixture)!;
    input.value = 'https://example.com/a';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await settle(fixture);

    expect(control(fixture).value).toContain('(https://example.com/a)');
  });

  it('makes a link where nothing is selected, rather than nothing at all', async () => {
    // `toggleMark` on a collapsed caret only records a stored mark: nothing
    // becomes a link and the button looks broken. A word to hang it on is the
    // same bargain the source view strikes, and it is the consumer's word.
    const fixture = await renderRich('hello');
    toolButton(fixture, 'Link').click();
    await settle(fixture);

    expect(control(fixture).value).toContain('[link](https://)');
  });

  it('takes the link off and keeps the words', async () => {
    const fixture = await renderRich('hello');
    toolButton(fixture, 'Link').click();
    await settle(fixture);
    expect(control(fixture).value).toContain('](');

    toolButton(fixture, 'Remove link').click();
    await settle(fixture);

    // The words a link carried are words either way; only the destination goes.
    expect(control(fixture).value).not.toContain('](');
    expect(control(fixture).value).toContain('link');
    expect(linkInput(fixture)).toBeNull();
  });
});

describe('LgMarkdownField, one box for two surfaces', () => {
  it('keeps the projected control in flow while the document shows', async () => {
    // Not `hidden`, which would take it out of layout: its `rows` is what
    // gives the field its natural height, and a field that measured itself
    // from whichever surface happened to be up would change size every time
    // the mode was switched — which is the whole reason it stays here.
    const fixture = await renderRich('hello');
    expect(textarea(fixture).closest('[hidden]')).toBeNull();
  });

  it('wears the chrome the projected control wears', async () => {
    // One definition, so the box an author types into is the box they were
    // just looking at in the other mode. Angular's own `ng-*` state classes
    // and whatever the consumer put on the textarea are not part of it.
    const fixture = await renderRich('hello');
    const chrome = formFieldClasses(undefined, false).split(' ');

    for (const className of chrome) {
      expect(Array.from(textarea(fixture).classList), className).toContain(
        className
      );
      expect(Array.from(surface(fixture)!.classList), className).toContain(
        className
      );
    }
  });

  it('carries a validity the consumer sets onto both surfaces', async () => {
    // The chrome is handed to ProseMirror as a function, and it reads one
    // only when it updates — which a validity change does not cause on its
    // own. A field that showed a red border in one mode and not the other
    // would be disagreeing with itself about the value.
    const fixture = await renderRich('hello');
    const errorClass = FORM_FIELD_INVALID.split(' ')[0]!;
    expect(surface(fixture)!.classList).not.toContain(errorClass);

    fixture.componentInstance.invalid.set(true);
    await settle(fixture);

    expect(surface(fixture)!.classList).toContain(errorClass);
    expect(textarea(fixture).classList).toContain(errorClass);
  });
});

describe('LgMarkdownField, switching surfaces', () => {
  it('keeps the textarea in the DOM in both modes', async () => {
    // Hidden, never removed: its id is what the field's label points at, and
    // its value is the form's, in both modes.
    const fixture = await renderRich('hello');
    expect(textarea(fixture)).not.toBeNull();

    modeButton(fixture, 'Markdown').click();
    await settle(fixture);
    expect(textarea(fixture)).not.toBeNull();
    expect(surface(fixture)).not.toBeNull();
  });

  it('arrives at the top of the source, not the bottom', async () => {
    // Every write this control has had was programmatic — the form's, then
    // the document's — and each leaves the caret at the end, so focusing it
    // scrolled the reader to the bottom of their own text.
    const fixture = await renderRich('one\n\ntwo\n\nthree');
    expect(textarea(fixture).selectionStart).toBe(
      control(fixture).value.length
    );

    modeButton(fixture, 'Markdown').click();
    await settle(fixture);

    expect(textarea(fixture).selectionStart).toBe(0);
    expect(textarea(fixture).selectionEnd).toBe(0);
  });

  it('leaves the source caret where it was while the document is edited', async () => {
    // A rich keystroke is not an edit to this control, so it must not walk
    // its caret along — otherwise the switch above would have nothing left to
    // arrive at but the end.
    const fixture = await renderRich('a long first paragraph');
    const field = textarea(fixture);
    field.setSelectionRange(6, 6);

    toolButton(fixture, 'Heading 2').click();
    await settle(fixture);

    expect(control(fixture).value).toBe('## a long first paragraph');
    expect(textarea(fixture).selectionStart).toBe(6);
  });

  it('clamps a kept caret to a document that got shorter', async () => {
    const fixture = await renderRich('a long first paragraph');
    const field = textarea(fixture);
    field.setSelectionRange(22, 22);

    toolButton(fixture, 'Heading 2').click();
    await settle(fixture);
    // Undo the heading, which makes the value shorter than the caret's offset.
    toolButton(fixture, 'Heading 2').click();
    await settle(fixture);

    expect(textarea(fixture).selectionStart).toBeLessThanOrEqual(
      control(fixture).value.length
    );
  });

  it('re-reads the source on the way in, and rewrites nothing on the way out', async () => {
    // One direction only. Source is the value, so leaving it needs no
    // conversion; entering the document does, because the text may have been
    // pasted in wholesale since it was last parsed.
    const fixture = await renderRich('first');
    modeButton(fixture, 'Markdown').click();
    await settle(fixture);

    const field = textarea(fixture);
    field.value = 'second _word_';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    await settle(fixture);

    modeButton(fixture, 'Rich text').click();
    await settle(fixture);

    expect(surface(fixture)?.innerHTML).toBe('<p>second <em>word</em></p>');
    // Re-parsed, not re-serialized: what is stored is still what was typed.
    expect(control(fixture).value).toBe('second _word_');
  });

  it('offers no mode control until there is a mode to switch to', () => {
    // Before the chunk lands — and forever, where it fails to — the field is
    // a textarea with a toolbar, and a control offering a surface that will
    // not appear would be a control that does nothing.
    const fixture = render();
    expect(host(fixture).querySelector('lg-select-button')).toBeNull();
  });
});
