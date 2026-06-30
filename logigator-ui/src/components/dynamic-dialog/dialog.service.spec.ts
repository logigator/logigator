import { afterEach, describe, expect, it } from 'vitest';
import {
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { DialogService } from './dialog.service';
import { DialogConfig } from './dialog-config';
import { DialogRef } from './dialog-ref';

@Component({
  selector: 'lg-test-dialog-child',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p class="child">{{ wordSize() }}/{{ label() }}</p>`
})
class TestDialogChild {
  // `required` so a failure to setInput-before-init throws on first read.
  readonly wordSize = input.required<number>();
  readonly label = input('default');
  readonly data = input<unknown>();
  readonly saved = output<string>();
}

@Component({
  selector: 'lg-test-config-child',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="name">{{ name }}</span>
    <button class="self-close" (click)="ref.close()">close</button>
  `
})
class ConfigReadingChild {
  protected readonly ref = inject(DialogRef);
  private readonly config = inject(DialogConfig);
  protected readonly name = (this.config.data as { name?: string })?.name;
}

function container(): Element | null {
  return document.querySelector('.cdk-overlay-container');
}

function panel(): HTMLElement | null {
  return document.querySelector('.cdk-overlay-container [role=dialog]');
}

/** Open a dialog and run one CD pass so the container's ngAfterViewInit fires. */
function open(config: DialogConfig = {}): DialogRef {
  const ref = TestBed.inject(DialogService).open(TestDialogChild, config);
  TestBed.inject(ApplicationRef).tick();
  return ref;
}

describe('DialogService', () => {
  afterEach(() => {
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((el) => el.remove());
  });

  it('renders the child component inside a centred dialog panel', () => {
    open({ header: 'Editor', inputValues: { wordSize: 8 } });
    expect(panel()).not.toBeNull();
    expect(container()?.querySelector('h2')?.textContent).toContain('Editor');
    expect(container()?.querySelector('.child')?.textContent).toContain('8');
  });

  it('applies inputValues via setInput before the child reads a required input', () => {
    expect(() =>
      open({ inputValues: { wordSize: 16, label: 'rom' } })
    ).not.toThrow();
    expect(container()?.querySelector('.child')?.textContent).toBe('16/rom');
  });

  it('emits onChildComponentLoaded with the real instance after inputs are applied', () => {
    const ref = TestBed.inject(DialogService).open(TestDialogChild, {
      inputValues: { wordSize: 4 }
    });
    let instance: unknown;
    ref.onChildComponentLoaded.subscribe((i) => (instance = i));
    TestBed.inject(ApplicationRef).tick();
    expect(instance).toBeInstanceOf(TestDialogChild);
    expect((instance as TestDialogChild).wordSize()).toBe(4);

    // The reported instance's outputs are subscribable (the HexEditor contract).
    let saved: string | undefined;
    (instance as TestDialogChild).saved.subscribe((v) => (saved = v));
    (instance as TestDialogChild).saved.emit('bytes');
    expect(saved).toBe('bytes');
  });

  it('replays the loaded instance to a late subscriber', () => {
    const ref = open({ inputValues: { wordSize: 2 } });
    let instance: unknown;
    ref.onChildComponentLoaded.subscribe((i) => (instance = i));
    expect(instance).toBeInstanceOf(TestDialogChild);
  });

  it('provides the config (with data) and ref to the child injector', () => {
    const ref = TestBed.inject(DialogService).open(ConfigReadingChild, {
      data: { name: 'demo' }
    });
    TestBed.inject(ApplicationRef).tick();
    expect(container()?.querySelector('.name')?.textContent).toContain('demo');
    // The child can close itself via the injected ref.
    let closed = false;
    ref.onClose.subscribe(() => (closed = true));
    (container()?.querySelector('.self-close') as HTMLButtonElement).click();
    expect(closed).toBe(true);
  });

  it('closes and resolves onClose with the result', async () => {
    const ref = open({ inputValues: { wordSize: 1 } });
    const closed = firstValueFrom(ref.onClose);
    ref.close('done');
    expect(await closed).toBe('done');
    expect(panel()).toBeNull();
  });

  it('closes (undefined) on the close button', () => {
    const ref = open({ header: 'X', inputValues: { wordSize: 1 } });
    const results: (string | undefined)[] = [];
    ref.onClose.subscribe((r) => results.push(r as string | undefined));
    (
      container()?.querySelector('[aria-label=Close]') as HTMLButtonElement
    ).click();
    expect(results).toEqual([undefined]);
    expect(panel()).toBeNull();
  });

  it('closes on Escape', () => {
    const ref = open({ inputValues: { wordSize: 1 } });
    let closed = false;
    ref.onClose.subscribe(() => (closed = true));
    panel()!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    expect(closed).toBe(true);
  });

  it('ignores backdrop clicks unless dismissableMask is set', () => {
    const ref = open({ inputValues: { wordSize: 1 } });
    let closed = false;
    ref.onClose.subscribe(() => (closed = true));
    (document.querySelector('.cdk-overlay-backdrop') as HTMLElement).click();
    expect(closed).toBe(false);
    expect(panel()).not.toBeNull();
  });

  it('closes on backdrop click when dismissableMask is true', () => {
    const ref = open({ inputValues: { wordSize: 1 }, dismissableMask: true });
    let closed = false;
    ref.onClose.subscribe(() => (closed = true));
    (document.querySelector('.cdk-overlay-backdrop') as HTMLElement).click();
    expect(closed).toBe(true);
  });
});
