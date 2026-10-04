import { beforeEach, describe, expect, it } from 'vitest';
import { Graphics, GraphicsContext } from 'pixi.js';
import { configureTestBed } from '../../../../testing/configure-test-bed';
import { makeButton } from '../../../../testing/factories';
import { BuiltInComponentType } from '@logigator/core';
import { ButtonGraphics } from '../../../rendering/graphics/button.graphics';
import { ButtonComponent } from './button.component';
import { buttonComponentConfig } from './button.config';

/** The context the button's body is currently drawn with. */
function bodyContext(button: ButtonComponent): GraphicsContext {
  const body = button.children.find(
    (child): child is Graphics =>
      child instanceof Graphics && child.context instanceof ButtonGraphics
  );
  expect(body).toBeDefined();
  return body!.context;
}

describe('ButtonComponent', () => {
  beforeEach(() => {
    configureTestBed();
  });

  it('has the BUTTON type id, fixed at 205 by the document format', () => {
    expect(buttonComponentConfig.type).toBe(BuiltInComponentType.BUTTON);
    expect(buttonComponentConfig.type).toBe(205);
  });

  it('exposes exactly one output and no inputs', () => {
    const button = makeButton();
    expect(button.numInputs).toBe(0);
    expect(button.numOutputs).toBe(1);
    button.destroy({ children: true });
  });

  it('draws its held state, and clearSimState releases it', () => {
    const button = makeButton();
    const released = bodyContext(button);

    button.setHeld(true);
    expect(bodyContext(button)).not.toBe(released);

    button.clearSimState();
    expect(button.held).toBe(false);
    expect(bodyContext(button)).toBe(released);
    button.destroy({ children: true });
  });
});
