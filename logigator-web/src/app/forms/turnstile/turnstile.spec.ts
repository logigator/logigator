import { beforeEach, describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../../testing/configure-test-bed';
import {
  FakeTurnstile,
  provideFakeTurnstile
} from '../../../testing/fake-turnstile';
import { ThemingService } from '../../theming/theming.service';
import { Turnstile } from './turnstile';

describe('Turnstile', () => {
  let fake: FakeTurnstile;
  let fixture: ComponentFixture<Turnstile>;

  async function render(
    siteKey: string | null = 'fake-site-key'
  ): Promise<Turnstile> {
    fake = new FakeTurnstile();
    configureTestBed([provideFakeTurnstile(fake, siteKey)], [Turnstile]);
    fixture = TestBed.createComponent(Turnstile);
    fixture.componentRef.setInput('action', 'register');
    await settle();
    return fixture.componentInstance;
  }

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('renders under the form’s action, so a token cannot serve another form', async () => {
    await render();
    expect(fake.only().action).toBe('register');
  });

  it('renders with the site key the deployment reports', async () => {
    await render('deployment-site-key');
    expect(fake.only().sitekey).toBe('deployment-site-key');
  });

  it('runs no challenge where the deployment has none', async () => {
    const widget = await render(null);

    expect(fake.widgets.size).toBe(0);
    expect(widget.token()).toBeNull();
  });

  it('holds a token only until the challenge expires or fails', async () => {
    const widget = await render();

    fake.solve('first');
    expect(widget.token()).toBe('first');
    fake.only()['expired-callback']();
    expect(widget.token()).toBeNull();

    fake.solve('second');
    fake.only()['error-callback']();
    expect(widget.token()).toBeNull();
  });

  it('drops a spent token and asks the widget for a fresh one', async () => {
    const widget = await render();
    fake.solve('spent');

    widget.reset();

    expect(widget.token()).toBeNull();
    expect(fake.resets).toEqual([...fake.widgets.keys()]);
  });

  it('renders again in the new theme, without the old widget’s token', async () => {
    const widget = await render();
    const theming = TestBed.inject(ThemingService);
    const before = theming.theme();
    const other = before === 'dark' ? 'light' : 'dark';
    fake.solve('before');

    theming.setTheme(other);
    await settle();

    expect(fake.only().theme).toBe(other);
    expect(widget.token()).toBeNull();
    // The theme lives in a cookie the next spec would read.
    theming.setTheme(before);
  });

  it('takes its widget off the page with it', async () => {
    await render();
    fixture.destroy();
    expect(fake.widgets.size).toBe(0);
  });
});
