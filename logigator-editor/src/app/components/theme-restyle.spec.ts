import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { BitmapText, Container, Graphics } from 'pixi.js';
import { configureTestBed } from '../../testing/configure-test-bed';
import { ComponentProviderService } from './component-provider.service';
import { ComponentConfig } from './component-config.model';
import { Component } from './component';
import { ledComponentConfig } from './component-types/led/led.config';
import { ThemingService } from '../theming/theming.service';
import { ThemeType } from '../theming/theme-type.enum';
import { LightTheme } from '../theming/themes/light.theme';
import { Project } from '../project/project';
import { makeAnd } from '../../testing/factories';

/** Builds an instance the way placement does: cloned default options. */
function instantiate(config: ComponentConfig): Component {
  const options = Object.fromEntries(
    Object.entries(config.options).map(([key, opt]) => [key, opt.clone()])
  );
  return config.create(options);
}

/** Flattens a visual tree in deterministic (draw-order) traversal. */
function flatten(node: Container, out: Container[] = []): Container[] {
  out.push(node);
  for (const child of node.children) {
    flatten(child as Container, out);
  }
  return out;
}

describe('in-place theme restyle', () => {
  let theming: ThemingService;
  let provider: ComponentProviderService;

  beforeEach(() => {
    configureTestBed();
    theming = TestBed.inject(ThemingService);
    provider = TestBed.inject(ComponentProviderService);
    theming.setActiveThemeType(ThemeType.DARK);
  });

  afterEach(() => {
    theming.setActiveThemeType(ThemeType.DARK);
  });

  function builtInConfigs(): ComponentConfig[] {
    return [
      ...provider.basicComponents(),
      ...provider.advancedComponents(),
      ...provider.ioComponents(),
      ...provider.portComponents()
    ];
  }

  // In-place restyling fails when a draw() bakes a theme color outside any
  // registered callback. A freshly built instance in the target theme is
  // ground truth: shared contexts are cached per (params, theme), so a
  // restyled tree must hold identical context references and tints node for
  // node.
  it('restyling into the other theme matches a fresh build for every built-in type', () => {
    for (const config of builtInConfigs()) {
      theming.setActiveThemeType(ThemeType.DARK);
      const restyled = instantiate(config);
      theming.setActiveThemeType(ThemeType.LIGHT);
      restyled.refreshTheme();
      const fresh = instantiate(config);

      const a = flatten(restyled);
      const b = flatten(fresh);
      expect(a.length, `type ${config.type}: tree size`).toBe(b.length);
      for (let i = 0; i < a.length; i++) {
        const at = `type ${config.type} node ${i} (${a[i].constructor.name})`;
        expect(a[i].constructor, at).toBe(b[i].constructor);
        expect(a[i].tint, `${at}: tint`).toBe(b[i].tint);
        if (a[i] instanceof Graphics) {
          expect((a[i] as Graphics).context, `${at}: context`).toBe(
            (b[i] as Graphics).context
          );
        }
        if (a[i] instanceof BitmapText) {
          // A draw() baking a theme color into the fill instead of using
          // white-base + tint restyles stale while its tint still matches.
          expect((a[i] as BitmapText).style.fill, `${at}: fill`).toEqual(
            (b[i] as BitmapText).style.fill
          );
        }
      }

      restyled.destroy({ children: true });
      fresh.destroy({ children: true });
    }
  });

  it('refreshTheme reuses the existing children instead of rebuilding', () => {
    const comp = makeAnd(2);
    const before = flatten(comp);
    theming.setActiveThemeType(ThemeType.LIGHT);
    comp.refreshTheme();
    const after = flatten(comp);
    expect(after.length).toBe(before.length);
    after.forEach((node, i) => expect(node).toBe(before[i]));
    comp.destroy({ children: true });
  });

  // The lit color derives from theme AND power state jointly; the restyler
  // must re-derive it, not reset to the unpowered look.
  it('a lit LED keeps its lit color across a restyle', () => {
    const led = instantiate(ledComponentConfig);
    led.setPortPowered(0, true);
    theming.setActiveThemeType(ThemeType.LIGHT);
    led.refreshTheme();
    const disc = led.children[0] as Graphics;
    expect(disc.tint).toBe(LightTheme.ledOn);
    led.destroy({ children: true });
  });

  it('Project.applyTheme restyles components without rebuilding them', () => {
    const project = new Project();
    const comp = makeAnd(2);
    project.addComponent(comp);
    const before = flatten(comp);
    theming.setActiveThemeType(ThemeType.LIGHT);
    project.applyTheme(false);
    const after = flatten(comp);
    expect(after.length).toBe(before.length);
    after.forEach((node, i) => expect(node).toBe(before[i]));
    project.destroy({ children: true });
  });
});
