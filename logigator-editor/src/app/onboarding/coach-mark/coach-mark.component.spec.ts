import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { CoachMarkView } from '../coach-mark.model';
import { CoachMarkComponent } from './coach-mark.component';

const BASE: CoachMarkView = {
  title: 'Welcome',
  text: 'Body <strong>text</strong>',
  stepNumber: 3,
  totalSteps: 9,
  showNext: false,
  placement: 'center'
};

// Buttons render in a fixed order: [skip, (next)] — matching by order keeps the
// assertions independent of the resolved translation text.
function buttons(
  fixture: ComponentFixture<CoachMarkComponent>
): HTMLButtonElement[] {
  return Array.from(fixture.nativeElement.querySelectorAll('button'));
}

function render(view: CoachMarkView): ComponentFixture<CoachMarkComponent> {
  const fixture = TestBed.createComponent(CoachMarkComponent);
  fixture.componentRef.setInput('view', view);
  fixture.detectChanges();
  return fixture;
}

describe('CoachMarkComponent', () => {
  beforeEach(async () => {
    localStorage.clear();
    configureTestBed([], [CoachMarkComponent]);
    const transloco = TestBed.inject(TranslocoService);
    await firstValueFrom(transloco.load('en'));
    transloco.setActiveLang('en');
  });

  it('renders the title, markup body and step counter', () => {
    const el = render(BASE).nativeElement as HTMLElement;
    expect(el.textContent).toContain('Welcome');
    expect(el.querySelector('strong')?.textContent).toBe('text');
    expect(el.textContent).toContain('3 / 9');
  });

  it('shows Next only for steps that opt in', () => {
    expect(buttons(render(BASE))).toHaveLength(1); // skip only
    expect(buttons(render({ ...BASE, showNext: true }))).toHaveLength(2);
  });

  it('emits from the Skip and Next controls', () => {
    const fixture = render({ ...BASE, showNext: true });
    const skip = vi.fn();
    const next = vi.fn();
    fixture.componentInstance.skip.subscribe(skip);
    fixture.componentInstance.next.subscribe(next);

    const [skipBtn, nextBtn] = buttons(fixture);
    skipBtn.click();
    nextBtn.click();

    expect(skip).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledOnce();
  });
});
