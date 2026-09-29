import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Point } from 'pixi.js';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { makeButton } from '../../../testing/factories';
import {
  FakeSimulationWorker,
  ManualFrameScheduler
} from '../../../testing/fake-simulation-worker';
import { environment } from '../../../environments/environment';
import { Component } from '../../components/component';
import { ComponentProviderService } from '../../components/component-provider.service';
import { ButtonComponent } from '../../components/component-types/button/button.component';
import { outputComponentConfig } from '../../components/component-types/output/output.config';
import { CustomComponent } from '../../components/custom/custom-component';
import { CustomComponentRegistry } from '../../components/custom/custom-component-registry.service';
import { SubCircuitWatch } from '../../components/custom/sub-circuit-watch';
import { Project } from '../../project/project';
import { ProjectService } from '../../project/project.service';
import { RendererService } from '../../rendering/renderer.service';
import { EditorSettingsService } from '../../settings/editor-settings.service';
import { SimulationService } from '../../simulation/simulation.service';
import {
  FRAME_SCHEDULER,
  SIMULATION_WORKER_FACTORY
} from '../../simulation/worker/simulation-worker.service';
import { Wire } from '../../wires/wire';
import { WireDirection } from '@logigator/core';
import { SubCircuitWatchComponent } from './sub-circuit-watch.component';

/** Wire spanning the two given half-grid termination points (axis-aligned). */
function wireBetween(a: Point, b: Point): Wire {
  const horizontal = a.y === b.y;
  const wire = new Wire(
    horizontal ? WireDirection.HORIZONTAL : WireDirection.VERTICAL,
    horizontal ? Math.abs(b.x - a.x) : Math.abs(b.y - a.y)
  );
  wire.position.set(Math.min(a.x, b.x), Math.min(a.y, b.y));
  return wire;
}

function outPlug(index: number, pos: [number, number]): Component {
  return Component.deserialize(
    { pos, options: { label: '', index } },
    outputComponentConfig
  );
}

function serializeBody(components: Component[], wires: Wire[]) {
  const body = {
    components: components.map((c) => {
      const s = Component.serialize(c);
      return {
        type: s.type,
        pos: s.pos,
        ...(s.direction ? { direction: s.direction } : {}),
        options: s.options
      };
    }),
    wires: wires.map((w) => {
      const s = Wire.serialize(w);
      return { pos: s.pos, direction: s.direction, length: s.length };
    })
  };
  components.forEach((c) => c.destroy({ children: true }));
  wires.forEach((w) => w.destroy());
  return body;
}

/** A pointer event carrying the fields the PointerController reads. */
function pointer(type: string, clientX: number, clientY: number): Event {
  const event = new MouseEvent(type, { clientX, clientY, button: 0 });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  Object.defineProperty(event, 'pointerType', { value: 'mouse' });
  return event;
}

describe('SubCircuitWatchComponent', () => {
  let simulation: SimulationService;
  let fakeWorker: FakeSimulationWorker;
  let project: Project;
  let watch: SubCircuitWatch;
  let fixture: ComponentFixture<SubCircuitWatchComponent>;
  let canvas: HTMLCanvasElement;

  beforeEach(async () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {
          /* empty */
        }
        disconnect(): void {
          /* empty */
        }
      }
    );
    configureTestBed(
      [
        {
          provide: SIMULATION_WORKER_FACTORY,
          useValue: () => {
            fakeWorker = new FakeSimulationWorker();
            return fakeWorker.asWorker();
          }
        },
        { provide: FRAME_SCHEDULER, useValue: new ManualFrameScheduler() },
        // No lease ever arrives, so nothing is drawn; input still runs.
        {
          provide: RendererService,
          useValue: { acquire: () => new Promise(() => undefined) }
        }
      ],
      [SubCircuitWatchComponent]
    );
    simulation = TestBed.inject(SimulationService);
    TestBed.inject(EditorSettingsService).autoStartSimulation.set(false);
    project = new Project();
    TestBed.inject(ProjectService).setMainProject(project);

    // Outer = [button, Box(button), plug, plug]: a button on the outer level
    // and another one level down.
    const registry = TestBed.inject(CustomComponentRegistry);
    const provider = TestBed.inject(ComponentProviderService);
    const innerButton = makeButton(0, 0);
    const innerPlug = outPlug(0, [8, 0]);
    const box = registry.registerSnapshot({
      kind: 'snapshot',
      source: 'browser',
      name: 'Box',
      symbol: 'BX',
      description: '',
      numInputs: 0,
      numOutputs: 1,
      labels: ['O'],
      circuit: serializeBody(
        [innerButton, innerPlug],
        [
          wireBetween(
            innerButton.connectionPoints[0],
            innerPlug.connectionPoints[0]
          )
        ]
      )
    });
    const outerButton = makeButton(0, 0);
    const nested = Component.deserialize(
      { pos: [0, 6], options: {} },
      provider.getComponent(box)!
    );
    const plug0 = outPlug(0, [10, 0]);
    const plug1 = outPlug(1, [10, 6]);
    const outer = registry.registerSnapshot({
      kind: 'snapshot',
      source: 'browser',
      name: 'Outer',
      symbol: 'OU',
      description: '',
      numInputs: 0,
      numOutputs: 2,
      labels: ['A', 'B'],
      circuit: serializeBody(
        [outerButton, nested, plug0, plug1],
        [
          wireBetween(
            outerButton.connectionPoints[0],
            plug0.connectionPoints[0]
          ),
          wireBetween(nested.connectionPoints[0], plug1.connectionPoints[0])
        ]
      )
    });
    const instance = Component.deserialize(
      { pos: [0, 0], options: {} },
      provider.getComponent(outer)!
    ) as CustomComponent;
    project.addComponent(instance);
    simulation.enter();
    await vi.waitFor(() => expect(simulation.state()).toBe('ready'));

    watch = instance.config.inspection!(instance) as SubCircuitWatch;
    fixture = TestBed.createComponent(SubCircuitWatchComponent);
    fixture.componentRef.setInput('inspection', watch);
    fixture.detectChanges();
    canvas = fixture.nativeElement.querySelector('canvas');
  });

  afterEach(() => {
    fixture.destroy();
    watch.destroy();
    simulation.exit();
    project.destroy({ children: true });
    vi.unstubAllGlobals();
  });

  /** Client coordinates of a grid point on the visible level's canvas. */
  function clientAt(gx: number, gy: number): [number, number] {
    const level = watch.activeLevel().session.project;
    const factor = level.scale.x * environment.gridSize;
    const rect = canvas.getBoundingClientRect();
    return [
      rect.left + level.position.x + gx * factor,
      rect.top + level.position.y + gy * factor
    ];
  }

  function press(gx: number, gy: number): void {
    canvas.dispatchEvent(pointer('pointerdown', ...clientAt(gx, gy)));
  }

  /** Cont levels sent to one engine unit, in order. */
  function levels(unit: number): boolean[] {
    return fakeWorker
      .postedOfKind('triggerInput')
      .filter((msg) => msg.componentIndex === unit && msg.event === 0)
      .map((msg) => msg.state[0]);
  }

  function copyButton(): ButtonComponent {
    return watch
      .activeLevel()
      .session.components.find(
        (component) => component instanceof ButtonComponent
      ) as ButtonComponent;
  }

  it('holds an inner button for the gesture, without panning', () => {
    const button = copyButton();
    const levelProject = watch.activeLevel().session.project;
    const start = levelProject.position.clone();

    press(0.5, 0.5);
    expect(button.held).toBe(true);
    expect(levels(0)).toEqual([true]);

    canvas.dispatchEvent(pointer('pointermove', ...clientAt(20, 20)));
    expect(button.held).toBe(true);
    expect(levelProject.position).toEqual(start);

    canvas.dispatchEvent(pointer('pointerup', ...clientAt(20, 20)));
    expect(button.held).toBe(false);
    expect(levels(0)).toEqual([true, false]);
  });

  it('releases a hold whose level another pushes over, on its own unit', () => {
    const outerButton = copyButton();
    press(0.5, 0.5);

    // The body at index 1 is the nested box.
    watch.activate(watch.activeLevel().session.components[1]);
    fixture.detectChanges();

    expect(watch.levels()).toHaveLength(2);
    expect(outerButton.held).toBe(false);
    expect(levels(0)).toEqual([true, false]);
    // The release reached the outer button's unit, not the new level's.
    expect(levels(1)).toEqual([]);
  });

  it('releases a hold whose level is popped, exactly once', () => {
    watch.activate(watch.activeLevel().session.components[1]);
    fixture.detectChanges();
    press(0.5, 0.5);
    expect(levels(1)).toEqual([true]);

    watch.navigateTo(0);
    fixture.detectChanges();
    canvas.dispatchEvent(pointer('pointerup', ...clientAt(0.5, 0.5)));

    expect(levels(1)).toEqual([true, false]);
  });
});
