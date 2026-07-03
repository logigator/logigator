import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { LgFileUpload, LgFileSelectEvent } from './file-upload';

function setup(inputs: Record<string, unknown> = {}) {
  const f = TestBed.createComponent(LgFileUpload);
  f.componentRef.setInput('chooseLabel', 'Choose');
  f.componentRef.setInput('chooseIcon', 'ph ph-cloud-arrow-up');
  for (const [key, value] of Object.entries(inputs)) {
    f.componentRef.setInput(key, value);
  }
  f.detectChanges();
  const host = f.nativeElement as HTMLElement;
  const zone = host.querySelector('[role=button]') as HTMLElement;
  const input = host.querySelector('input[type=file]') as HTMLInputElement;
  const events: LgFileSelectEvent[] = [];
  f.componentInstance.onSelect.subscribe((e) => events.push(e));
  return { f, zone, input, events };
}

function dropEvent(files: File[]): Event {
  const event = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', { value: { files } });
  return event;
}

describe('LgFileUpload', () => {
  it('labels the drop zone', () => {
    const { zone } = setup();
    expect(zone.textContent).toContain('Choose');
    expect(zone.getAttribute('aria-label')).toBe('Choose');
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

  it('emits dropped files', () => {
    const { zone, events } = setup();
    const file = new File(['{}'], 'circuit.json', {
      type: 'application/json'
    });
    zone.dispatchEvent(dropEvent([file]));
    expect(events).toHaveLength(1);
    expect(events[0].files[0].name).toBe('circuit.json');
  });

  it('filters dropped files against accept and caps at fileLimit', () => {
    const { zone, events } = setup({
      accept: 'application/json',
      fileLimit: 1
    });
    const json = (name: string) =>
      new File(['{}'], name, { type: 'application/json' });
    zone.dispatchEvent(
      dropEvent([
        new File(['x'], 'notes.txt', { type: 'text/plain' }),
        json('a.json'),
        json('b.json')
      ])
    );
    expect(events).toHaveLength(1);
    expect(events[0].files.map((f) => f.name)).toEqual(['a.json']);
  });

  it('highlights while a drag hovers the zone', () => {
    const { f, zone } = setup();
    const over = new Event('dragover', { cancelable: true });
    zone.dispatchEvent(over);
    f.detectChanges();
    expect(zone.className).toContain('border-primary');
    expect(over.defaultPrevented).toBe(true);

    zone.dispatchEvent(new Event('dragleave'));
    f.detectChanges();
    expect(zone.className).not.toContain('border-primary');
  });
});
