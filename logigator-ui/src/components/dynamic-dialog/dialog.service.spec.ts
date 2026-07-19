import { afterEach, describe, expect, it } from 'vitest';
import {
  ApplicationRef,
  Component,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { DialogService } from './dialog.service';
import { DialogConfig } from './dialog-config';
import { DialogRef } from './dialog-ref';
import { LgDialogContent } from './dialog-content';

@Component({
  selector: 'lg-test-dialog-child',
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

interface ContractData {
  name: string;
}
type ContractResult = 'ok' | 'cancel';

@Component({
  selector: 'lg-test-contract-child',
  template: `<span class="c-name">{{ dialogData?.name }}</span>`
})
class ContractChild extends LgDialogContent<ContractData, ContractResult> {
  // `dialogData` and `dialogRef` come from the base, already typed — no casts.
  confirm(): void {
    this.dialogRef.close('ok');
  }
}

function container(): Element | null {
  return document.querySelector('.cdk-overlay-container');
}

function panel(): HTMLElement | null {
  return document.querySelector('.cdk-overlay-container [role=dialog]');
}

/** Open a dialog and run one CD pass so the container's ngAfterViewInit fires. */
function open(
  config: DialogConfig<unknown, TestDialogChild> = {}
): DialogRef<unknown, TestDialogChild> {
  const ref = TestBed.inject(DialogService).open<TestDialogChild, unknown>(
    TestDialogChild,
    config
  );
  TestBed.inject(ApplicationRef).tick();
  return ref;
}

// Type-level guard: `inputValues` is type-checked against the opened
// component's `input()` signals. This locks in `DialogInputs` — a regression
// that widens it back to `{}` (silently dropping every check) would let the
// `@ts-expect-error` lines compile clean and fail this build. Never invoked
// (the fake `svc` would deref null); it exists only to be type-checked.
// eslint-disable-next-line @typescript-eslint/no-unused-expressions
() => {
  const svc = null as unknown as DialogService;
  svc.open(TestDialogChild, { inputValues: { wordSize: 4, label: 'x' } });
  // @ts-expect-error wordSize must be a number
  svc.open(TestDialogChild, { inputValues: { wordSize: 'nope' } });
  // @ts-expect-error `saved` is an output, not a settable input
  svc.open(TestDialogChild, { inputValues: { saved: 'x' } });

  // A contract component (extends LgDialogContent) has its `data` and result
  // inferred from the component alone — no type arguments. The assignment holds
  // only if `onClose` is typed `ContractResult | undefined` (not `unknown`); the
  // `@ts-expect-error` lines hold only if `data` is checked against ContractData.
  const ref = svc.open(ContractChild, { data: { name: 'x' } });
  const result: Promise<ContractResult | undefined> = firstValueFrom(
    ref.onClose
  );
  void result;
  // @ts-expect-error `data` must match ContractData (name: string)
  svc.open(ContractChild, { data: { name: 42 } });
  // @ts-expect-error unknown data key rejected against ContractData
  svc.open(ContractChild, { data: { nope: true } });
};

describe('DialogService', () => {
  afterEach(() => {
    document
      .querySelectorAll('.cdk-overlay-container')
      .forEach((el) => el.remove());
  });

  it('feeds a contract component its typed data and closes with its result', async () => {
    const ref = TestBed.inject(DialogService).open(ContractChild, {
      data: { name: 'demo' }
    });
    TestBed.inject(ApplicationRef).tick();
    expect(container()?.querySelector('.c-name')?.textContent).toContain(
      'demo'
    );
    const closed = firstValueFrom(ref.onClose);
    ref.close('ok');
    expect(await closed).toBe('ok');
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

  it('ignores width sizing while fullscreen', () => {
    open({ width: '40rem', fullscreen: true, inputValues: { wordSize: 1 } });
    expect(panel()!.style.width).toBe('');
  });

  it('switches an open dialog between card and takeover when a fullscreen signal flips', () => {
    const fullscreen = signal(false);
    open({ width: '40rem', fullscreen, inputValues: { wordSize: 1 } });
    expect(panel()!.style.width).toBe('40rem');

    fullscreen.set(true);
    TestBed.inject(ApplicationRef).tick();
    expect(panel()!.style.width).toBe('');

    fullscreen.set(false);
    TestBed.inject(ApplicationRef).tick();
    expect(panel()!.style.width).toBe('40rem');
  });

  it('bodyClass replaces the default body scroll and padding classes', () => {
    open({ bodyClass: 'overflow-hidden', inputValues: { wordSize: 1 } });
    const body = container()?.querySelector('.child')?.closest('div');
    expect(body?.classList.contains('overflow-hidden')).toBe(true);
    expect(body?.classList.contains('overflow-auto')).toBe(false);
    expect(body?.classList.contains('px-5')).toBe(false);
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
