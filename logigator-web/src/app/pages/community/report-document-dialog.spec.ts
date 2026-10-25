import { afterEach, describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { documentReportReasonSchema } from '@logigator/contract';
import { DialogConfig, DialogRef } from '@logigator/ui';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { TranslationService } from '../../translation/translation.service';
import {
  ReportDocumentDialog,
  type ReportDocumentData
} from './report-document-dialog';

const LINK = '11111111-1111-4111-8111-111111111111';
const REPORT_URL = `/api/community/projects/${LINK}/report`;

describe('ReportDocumentDialog', () => {
  let http: HttpTestingController;

  async function render(): Promise<{
    el: HTMLElement;
    fixture: ComponentFixture<ReportDocumentDialog>;
  }> {
    TestBed.resetTestingModule();
    const data: ReportDocumentData = { kind: 'projects', link: LINK };
    configureTestBed([
      { provide: DialogRef, useValue: new DialogRef<void>() },
      { provide: DialogConfig, useValue: { data } }
    ]);
    http = TestBed.inject(HttpTestingController);
    await TestBed.inject(TranslationService).setActiveLang('en');

    const fixture = TestBed.createComponent(ReportDocumentDialog);
    await settle(fixture);
    return { el: fixture.nativeElement, fixture };
  }

  /** A macrotask drains the HTTP chain, as in the shelf's dialog specs. */
  async function settle(
    fixture: ComponentFixture<ReportDocumentDialog>
  ): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function type(el: HTMLElement, id: string, value: string): void {
    const field = el.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      `#${id}`
    )!;
    field.value = value;
    field.dispatchEvent(new Event('input'));
  }

  /** Picks a reason through the dropdown, by its place in the contract. */
  async function pickReason(
    el: HTMLElement,
    fixture: ComponentFixture<ReportDocumentDialog>,
    reason: (typeof documentReportReasonSchema.options)[number]
  ): Promise<void> {
    el.querySelector<HTMLButtonElement>('#report-document-reason')!.click();
    await settle(fixture);
    const options =
      document.querySelectorAll<HTMLButtonElement>('[role="option"]');
    options[documentReportReasonSchema.options.indexOf(reason)]!.click();
    await settle(fixture);
  }

  function submit(el: HTMLElement): void {
    el.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
  }

  afterEach(() => {
    http.verify();
  });

  it('sends the reason and the trimmed explanation, leaving out a blank address', async () => {
    const { el, fixture } = await render();
    await pickReason(el, fixture, 'spam');
    type(el, 'report-document-explanation', '  Advertising.  ');
    type(el, 'report-document-email', '   ');
    submit(el);

    const request = http.expectOne(REPORT_URL);
    expect(request.request.body).toEqual({
      reason: 'spam',
      explanation: 'Advertising.'
    });
    request.flush({ received: true });
    await settle(fixture);

    // The form gives way to the confirmation: nothing is left to send twice.
    expect(el.querySelector('form')).toBeNull();
    expect(el.querySelector('[role="status"]')).not.toBeNull();
  });

  it('sends the address when one is given', async () => {
    const { el, fixture } = await render();
    await pickReason(el, fixture, 'copyright');
    type(el, 'report-document-explanation', 'My circuit.');
    type(el, 'report-document-email', ' me@example.com ');
    submit(el);

    const request = http.expectOne(REPORT_URL);
    expect(request.request.body).toMatchObject({
      contactEmail: 'me@example.com'
    });
    request.flush({ received: true });
    await settle(fixture);
  });

  it('sends nothing without a reason or with a blank explanation', async () => {
    const { el, fixture } = await render();
    type(el, 'report-document-explanation', 'Something.');
    submit(el);
    await settle(fixture);
    http.expectNone(REPORT_URL);

    await pickReason(el, fixture, 'other');
    type(el, 'report-document-explanation', '   ');
    submit(el);
    await settle(fixture);
    http.expectNone(REPORT_URL);
    expect(el.querySelector('form')).not.toBeNull();
  });

  it('keeps the form after a refused report, so it can be sent again', async () => {
    const { el, fixture } = await render();
    await pickReason(el, fixture, 'harassment');
    type(el, 'report-document-explanation', 'Insults in the description.');
    submit(el);

    http
      .expectOne(REPORT_URL)
      .flush(
        { code: 'rate_limited', message: 'Too many attempts.' },
        { status: 429, statusText: 'Too Many Requests' }
      );
    await settle(fixture);

    expect(el.querySelector('form')).not.toBeNull();
    expect(el.querySelector('lg-message')).not.toBeNull();
  });
});
