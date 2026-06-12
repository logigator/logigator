import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Container, Point } from 'pixi.js';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { Project } from '../../project/project';
import { Component } from '../../components/component';
import { Wire } from '../../wires/wire';
import { ConnectionPoint } from '../../connection-points/connection-point';
import { WireDrawingSession } from './wire-drawing.session';
import { textComponentConfig } from '../../components/component-types/text/text.config';
import { TextComponent } from '../../components/component-types/text/text.component';
import { andComponentConfig } from '../../components/component-types/and/and.config';
import { AndComponent } from '../../components/component-types/and/and.component';
import { makeMoveEvent } from '../../../testing/factories';

describe('WireDrawingSession + TextComponent (ignoresWireCollision)', () => {
  let project: Project;
  let dragLayer: Container<Component | Wire | ConnectionPoint>;
  let session: WireDrawingSession;

  beforeEach(() => {
    configureTestBed();
    project = new Project();
    dragLayer = new Container();
  });

  afterEach(() => {
    session?.onCancel();
    dragLayer.destroy();
    project.destroy({ children: true });
  });

  it('drawing a wire across a TEXT body reports no collision', () => {
    const text = new TextComponent({
      direction: textComponentConfig.options.direction.clone(),
      fontSize: textComponentConfig.options.fontSize.clone(),
      text: textComponentConfig.options.text.clone()
    });
    text.position.set(3, 0);
    project.addComponent(text);

    // Start at (0,0), move right to (6,0) — passes through TEXT body at (3,0).
    session = new WireDrawingSession(project, dragLayer, new Point(0, 0));
    session.onMove(makeMoveEvent(6, 0));

    expect(session.canEnd()).toBe(true);
  });

  it('drawing a wire across a normal component body does report collision', () => {
    const and = new AndComponent({
      direction: andComponentConfig.options.direction.clone(),
      numInputs: andComponentConfig.options.numInputs.clone()
    });
    and.position.set(3, 0);
    project.addComponent(and);

    // AND body occupies (3,0)–(5,2); wire from (0,0)→(6,0) intersects it.
    session = new WireDrawingSession(project, dragLayer, new Point(0, 0));
    session.onMove(makeMoveEvent(6, 0));

    expect(session.canEnd()).toBe(false);
  });
});
