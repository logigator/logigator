import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { LgFormField } from './form-field';

function field(inputs: Record<string, unknown>) {
  const f = TestBed.createComponent(LgFormField);
  for (const [name, value] of Object.entries(inputs)) {
    f.componentRef.setInput(name, value);
  }
  f.detectChanges();
  return f;
}

describe('LgFormField', () => {
  it('shows the error instead of the hint while both are set', () => {
    const f = field({
      inputId: 'email',
      hint: 'We never share it.',
      error: 'Enter a valid address.'
    });
    const messages = f.nativeElement.querySelectorAll(
      'p'
    ) as NodeListOf<HTMLElement>;
    expect(messages.length).toBe(1);
    expect(messages[0].textContent?.trim()).toBe('Enter a valid address.');
    expect(messages[0].getAttribute('role')).toBe('alert');
  });

  it('names the visible message from the control, and nothing when there is none', () => {
    const f = field({ inputId: 'email', hint: 'We never share it.' });
    expect(f.componentInstance.describedBy()).toBe('email-message');
    expect((f.nativeElement.querySelector('p') as HTMLElement).id).toBe(
      'email-message'
    );

    f.componentRef.setInput('hint', undefined);
    f.detectChanges();
    expect(f.componentInstance.describedBy()).toBeUndefined();
    expect(f.nativeElement.querySelector('p')).toBeNull();
  });

  it('points the label at the projected control', () => {
    const f = field({ inputId: 'email', label: 'Email' });
    const label = f.nativeElement.querySelector('label') as HTMLLabelElement;
    expect(label.getAttribute('for')).toBe('email');
  });
});
