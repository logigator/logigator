import { describe, expect, it } from 'vitest';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  LG_DOCUMENT_VISIBILITIES,
  type LgDocumentVisibility
} from '@logigator/ui';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { TranslationService } from '../../translation/translation.service';
import { VisibilityPickerComponent } from './visibility-picker.component';

/**
 * The picker is stateless — the dialog owns the state — so the spec drives it
 * through a host that holds one, the way all four call sites bind it.
 */
@Component({
  imports: [VisibilityPickerComponent],
  template: `
    <app-visibility-picker
      labelledby="host-visibility-label"
      [visibility]="visibility()"
      (visibilityChange)="changed.push($event)"
    />
  `
})
class HostComponent {
  readonly visibility = signal<LgDocumentVisibility>('private');
  readonly changed: LgDocumentVisibility[] = [];
}

describe('VisibilityPickerComponent', () => {
  async function render(visibility: LgDocumentVisibility = 'private'): Promise<{
    el: HTMLElement;
    host: HostComponent;
    fixture: ComponentFixture<HostComponent>;
  }> {
    TestBed.resetTestingModule();
    configureTestBed();
    await TestBed.inject(TranslationService).setActiveLang('en');

    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.visibility.set(visibility);
    await fixture.whenStable();
    fixture.detectChanges();
    fixture.detectChanges();

    return {
      el: fixture.nativeElement as HTMLElement,
      host: fixture.componentInstance,
      fixture
    };
  }

  function segments(el: HTMLElement): HTMLButtonElement[] {
    return [
      ...el.querySelectorAll<HTMLButtonElement>('lg-select-button button')
    ];
  }

  it('draws every state, in the order the shared rule holds them', async () => {
    // The order is `LG_DOCUMENT_VISIBILITIES`'s rather than the template's: a
    // state added to the union appears here without this component changing,
    // and a picker that skipped one would be a state nobody can reach.
    const { el } = await render();

    expect(segments(el)).toHaveLength(LG_DOCUMENT_VISIBILITIES.length);
    expect(segments(el).map((segment) => segment.ariaPressed)).toEqual([
      'true',
      'false',
      'false'
    ]);
  });

  it('reports the segment that was picked, without moving itself', async () => {
    const { el, host } = await render('private');

    segments(el)[2].click();

    expect(host.changed).toEqual(['public']);
    // Still private: only a caller that acted on the report moves the control,
    // which is what lets the share dialog write the pick and then put the
    // picker back where the server says the document is.
    expect(segments(el)[0].ariaPressed).toBe('true');
  });

  it('shows the hint of the state it is on', async () => {
    const { el, host, fixture } = await render('private');
    const hint = () => el.querySelector('p')?.textContent?.trim() ?? '';
    const perState = [hint()];

    for (const visibility of LG_DOCUMENT_VISIBILITIES.slice(1)) {
      host.visibility.set(visibility);
      fixture.detectChanges();
      perState.push(hint());
    }

    // Three distinct sentences, none of them a key: the bundle loads
    // asynchronously, so a missing message would render the key itself.
    expect(new Set(perState).size).toBe(perState.length);
    for (const text of perState) expect(text).not.toContain('.hint');
  });
});
