import { describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import type { ComponentSummary } from '@logigator/contract';
import { DialogConfig, DialogRef } from '@logigator/ui';
import { configureTestBed } from '../../../../testing/configure-test-bed';
import { TranslationService } from '../../../translation/translation.service';
import {
  MyDocumentsService,
  type MyDocumentRow
} from '../my-documents.service';
import {
  CreateDocumentDialog,
  type CreateDocumentData
} from './create-document-dialog';

const ID = '22222222-2222-4222-8222-222222222222';

function created(): ComponentSummary {
  return {
    id: ID,
    name: 'Adder',
    description: '',
    visibility: 'public',
    link: ID,
    version: 1,
    componentCount: 0,
    wireCount: 0,
    preview: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    lastEditedAt: '2026-01-01T00:00:00.000Z',
    symbol: 'ADD',
    numInputs: 0,
    numOutputs: 0,
    labels: []
  };
}

describe('CreateDocumentDialog', () => {
  let http: HttpTestingController;

  async function render(data: CreateDocumentData): Promise<{
    el: HTMLElement;
    fixture: ComponentFixture<CreateDocumentDialog>;
    ref: DialogRef<MyDocumentRow>;
  }> {
    TestBed.resetTestingModule();
    const ref = new DialogRef<MyDocumentRow>();
    configureTestBed([
      { provide: DialogRef, useValue: ref },
      { provide: DialogConfig, useValue: { data } }
    ]);
    http = TestBed.inject(HttpTestingController);
    await TestBed.inject(TranslationService).setActiveLang('en');

    const fixture = TestBed.createComponent(CreateDocumentDialog);
    await settle(fixture);
    return { el: fixture.nativeElement, fixture, ref };
  }

  /** See the share dialog's spec: a macrotask drains the HTTP chain. */
  async function settle(
    fixture: ComponentFixture<CreateDocumentDialog>
  ): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function type(el: HTMLElement, id: string, value: string): void {
    const input = el.querySelector<HTMLInputElement>(`#${id}`)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  function submit(el: HTMLElement): void {
    el.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
  }

  function fieldMessage(el: HTMLElement, id: string): string | null {
    const describedBy = el
      .querySelector(`#${id}`)!
      .getAttribute('aria-describedby');
    const texts = (describedBy ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .map((ref) => el.querySelector(`#${ref}`)?.textContent?.trim() ?? '');
    return texts.join(' ') || null;
  }

  it('flags every missing field and sends nothing', async () => {
    const { el, fixture } = await render({ kind: 'components' });
    const required = TestBed.inject(TranslationService).translate(
      'forms.errors.required'
    );

    submit(el);
    await settle(fixture);

    expect(fieldMessage(el, 'create-document-name')).toContain(required);
    expect(fieldMessage(el, 'create-document-symbol')).toContain(required);
    http.expectNone(() => true);
  });

  it('refuses a name of nothing but spaces', async () => {
    const { el, fixture } = await render({ kind: 'projects' });
    const nameRequired = TestBed.inject(TranslationService).translate(
      'forms.errors.nameRequired'
    );

    type(el, 'create-document-name', '   ');
    submit(el);
    await settle(fixture);

    expect(fieldMessage(el, 'create-document-name')).toContain(nameRequired);
    http.expectNone(() => true);
  });

  it('creates an empty document and puts it on the shelf', async () => {
    const { el, fixture, ref } = await render({ kind: 'components' });
    const shelf = TestBed.inject(MyDocumentsService);
    await resolveEmpty(shelf);
    const closed = firstValueFrom(ref.onClose);

    type(el, 'create-document-name', '  Adder ');
    type(el, 'create-document-symbol', 'ADD');
    submit(el);
    await settle(fixture);

    const request = http.expectOne('/api/components');
    expect(request.request.method).toBe('POST');
    // No `document`: the API makes the circuit empty.
    expect(request.request.body).toEqual({
      name: 'Adder',
      symbol: 'ADD',
      visibility: 'public'
    });
    request.flush(created());

    expect((await closed)?.id).toBe(ID);
    expect(shelf.rows()?.map((row) => row.id)).toEqual([ID]);
    expect(shelf.total()).toBe(1);
  });

  async function resolveEmpty(shelf: MyDocumentsService): Promise<void> {
    const pending = shelf.resolve('components', { page: 0, search: '' });
    http
      .expectOne((request) => request.url === '/api/components')
      .flush({ entries: [], page: 0, pageSize: 24, total: 0 });
    await pending;
  }
});
