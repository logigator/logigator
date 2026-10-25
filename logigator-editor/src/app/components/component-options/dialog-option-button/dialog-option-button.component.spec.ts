import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../../../testing/configure-test-bed';
import { TranslationService } from '../../../translation/translation.service';
import { DialogOptionButtonComponent } from './dialog-option-button.component';

describe('DialogOptionButtonComponent', () => {
  const LABEL = 'components.def.GAMEPAD.options.names';

  function render(summary?: string): HTMLButtonElement {
    const fixture = TestBed.createComponent(DialogOptionButtonComponent);
    fixture.componentRef.setInput('label', LABEL);
    fixture.componentRef.setInput('summary', summary);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).querySelector('button')!;
  }

  beforeEach(() => {
    configureTestBed([], [DialogOptionButtonComponent]);
  });

  it('is named by the option label alone and described by its summary', () => {
    const label = TestBed.inject(TranslationService).translate(LABEL);
    const button = render('3 named');

    expect(button.getAttribute('aria-label')).toBe(label);
    const describedBy = button.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)?.textContent?.trim()).toBe(
      '3 named'
    );
  });

  it('carries no description without a summary', () => {
    expect(render().hasAttribute('aria-describedby')).toBe(false);
    expect(render('').hasAttribute('aria-describedby')).toBe(false);
  });
});
