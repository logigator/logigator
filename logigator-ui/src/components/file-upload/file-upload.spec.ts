import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { LgFileUpload, LgFileSelectEvent } from './file-upload';

function setup() {
  const f = TestBed.createComponent(LgFileUpload);
  f.componentRef.setInput('chooseLabel', 'Choose');
  f.componentRef.setInput('chooseIcon', 'ph ph-cloud-arrow-up');
  f.detectChanges();
  const input = f.nativeElement.querySelector(
    'input[type=file]'
  ) as HTMLInputElement;
  const events: LgFileSelectEvent[] = [];
  f.componentInstance.onSelect.subscribe((e) => events.push(e));
  return { f, input, events };
}

describe('LgFileUpload', () => {
  it('labels the choose button', () => {
    const { f } = setup();
    const button = f.nativeElement.querySelector('button') as HTMLElement;
    expect(button.textContent).toContain('Choose');
  });

  it('emits the selected files and resets the input', () => {
    const { input, events } = setup();
    const file = new File(['{}'], 'circuit.json', {
      type: 'application/json'
    });
    Object.defineProperty(input, 'files', {
      value: [file],
      configurable: true
    });
    input.dispatchEvent(new Event('change'));
    expect(events).toHaveLength(1);
    expect(events[0].files[0].name).toBe('circuit.json');
    expect(input.value).toBe('');
  });
});
