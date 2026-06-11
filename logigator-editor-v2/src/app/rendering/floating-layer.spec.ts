import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FederatedPointerEvent, Point } from 'pixi.js';
import { configureTestBed } from '../../testing/configure-test-bed';
import { makeAnd, makeButton, makeLever } from '../../testing/factories';
import { Component } from '../components/component';
import { Project } from '../project/project';
import { WorkMode } from '../work-mode/work-mode.enum';
import { FloatingLayer } from './floating-layer';

function downEvent(x: number, y: number): FederatedPointerEvent {
  return {
    button: 0,
    getLocalPosition: () => new Point(x, y)
  } as unknown as FederatedPointerEvent;
}

describe('FloatingLayer in SIMULATION mode', () => {
  let project: Project;
  let layer: FloatingLayer;
  let emissions: Component[];
  let tickerValues: string[];

  beforeEach(() => {
    configureTestBed();
    project = new Project();
    layer = new FloatingLayer(project);
    emissions = [];
    tickerValues = [];
    project.userInput$.subscribe((component) => emissions.push(component));
    project.ticker$.subscribe((value) => tickerValues.push(value));
  });

  afterEach(() => {
    layer.destroy({ children: true });
    project.destroy({ children: true });
  });

  it('emits userInput$ for a clicked button', () => {
    const button = makeButton(2, 2);
    project.addComponent(button);
    layer.mode = WorkMode.SIMULATION;

    layer.emit('pointerdown', downEvent(2.4, 2.6));

    expect(emissions).toEqual([button]);
  });

  it('emits userInput$ for a clicked lever', () => {
    const lever = makeLever(0, 0);
    project.addComponent(lever);
    layer.mode = WorkMode.SIMULATION;

    layer.emit('pointerdown', downEvent(0.5, 0.5));

    expect(emissions).toEqual([lever]);
  });

  it('emits nothing for other components or empty canvas', () => {
    project.addComponent(makeAnd(2, undefined, 2, 2));
    layer.mode = WorkMode.SIMULATION;

    layer.emit('pointerdown', downEvent(3, 3)); // inside the AND body
    layer.emit('pointerdown', downEvent(20, 20)); // empty canvas

    expect(emissions).toEqual([]);
  });

  it('starts no drag session in simulation mode', () => {
    layer.mode = WorkMode.SIMULATION;
    tickerValues.length = 0;

    layer.emit('pointerdown', downEvent(5, 5));

    // A drag session would turn the ticker 'on' (see _startDrag).
    expect(tickerValues).not.toContain('on');
  });

  it('entering simulation mode cancels an active drag', () => {
    layer.mode = WorkMode.WIRE_DRAWING;
    layer.emit('pointerdown', downEvent(5, 5));
    expect(tickerValues).toContain('on');
    tickerValues.length = 0;

    layer.mode = WorkMode.SIMULATION;

    expect(tickerValues).toContain('off');
  });
});
