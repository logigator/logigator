import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApplicationRef, signal, Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { configureTestBed } from '../../testing/configure-test-bed';
import { Component } from '../components/component';
import { ComponentInspection } from '../components/component-inspection';
import { Project } from '../project/project';
import { ProjectService } from '../project/project.service';
import { SimulationService } from '../simulation/simulation.service';
import { WorkModeService } from '../work-mode/work-mode.service';
import { InspectionService } from './inspection.service';
import { OpenInspection } from './inspection-presenter';
import { WindowInspectionPresenter } from './window-inspection.presenter';

class TestInspection extends ComponentInspection {
  readonly renderer = {} as Type<unknown>;
  readonly title = signal('test');
  readonly frames = vi.fn();
  readonly destroyed = vi.fn();

  override onFrame(): void {
    this.frames();
  }

  override destroy(): void {
    this.destroyed();
  }
}

/** Records presenter calls and keeps the dismissed callbacks triggerable. */
class StubPresenter {
  readonly shown: OpenInspection[] = [];
  readonly focused: OpenInspection[] = [];
  readonly closed: OpenInspection[] = [];
  readonly dismissers = new Map<OpenInspection, () => void>();

  show(entry: OpenInspection, dismissed: () => void): void {
    this.shown.push(entry);
    this.dismissers.set(entry, dismissed);
  }

  focus(entry: OpenInspection): void {
    this.focused.push(entry);
  }

  close(entry: OpenInspection): void {
    this.closed.push(entry);
  }
}

/** A component stand-in with just what openFor reads: identity and a config. */
function makeInspectable(inspection: TestInspection | null): Component {
  return {
    config: inspection ? { inspection: () => inspection } : {}
  } as unknown as Component;
}

describe('InspectionService', () => {
  let service: InspectionService;
  let presenter: StubPresenter;
  let frame$: Subject<void>;
  let workMode: WorkModeService;

  function flushEffects(): void {
    TestBed.inject(ApplicationRef).tick();
  }

  beforeEach(() => {
    presenter = new StubPresenter();
    frame$ = new Subject<void>();
    configureTestBed([
      { provide: WindowInspectionPresenter, useValue: presenter },
      { provide: SimulationService, useValue: { frame$ } }
    ]);
    service = TestBed.inject(InspectionService);
    workMode = TestBed.inject(WorkModeService);
  });

  it('opens an inspection through the config factory, once per component', () => {
    const inspection = new TestInspection();
    const component = makeInspectable(inspection);

    service.openFor(component);
    expect(service.open()).toHaveLength(1);
    expect(presenter.shown).toHaveLength(1);
    expect(presenter.shown[0].inspection).toBe(inspection);

    // A second open focuses the existing view instead of duplicating it.
    service.openFor(component);
    expect(service.open()).toHaveLength(1);
    expect(presenter.focused).toEqual([presenter.shown[0]]);
  });

  it('ignores components without an inspection factory', () => {
    service.openFor(makeInspectable(null));
    expect(service.open()).toHaveLength(0);
    expect(presenter.shown).toHaveLength(0);
  });

  it('fans frame$ out to every open inspection', () => {
    const first = new TestInspection();
    const second = new TestInspection();
    service.openFor(makeInspectable(first));
    service.openFor(makeInspectable(second));

    frame$.next();
    expect(first.frames).toHaveBeenCalledTimes(1);
    expect(second.frames).toHaveBeenCalledTimes(1);
  });

  it('close() tears down the presenter view and destroys the inspection', () => {
    const inspection = new TestInspection();
    service.openFor(makeInspectable(inspection));

    service.close(service.open()[0]);
    expect(presenter.closed).toHaveLength(1);
    expect(inspection.destroyed).toHaveBeenCalledTimes(1);
    expect(service.open()).toHaveLength(0);
  });

  it('a presenter dismissal removes and destroys without re-closing the view', () => {
    const inspection = new TestInspection();
    service.openFor(makeInspectable(inspection));
    const entry = presenter.shown[0];

    presenter.dismissers.get(entry)!();
    expect(service.open()).toHaveLength(0);
    expect(inspection.destroyed).toHaveBeenCalledTimes(1);
    expect(presenter.closed).toHaveLength(0);
  });

  it('closes everything when the simulation ends', () => {
    workMode.setSimulationMode(true);
    flushEffects();
    service.openFor(makeInspectable(new TestInspection()));
    service.openFor(makeInspectable(new TestInspection()));

    workMode.setSimulationMode(false);
    flushEffects();
    expect(service.open()).toHaveLength(0);
    expect(presenter.closed).toHaveLength(2);
  });

  it('opens inspections from the active project inspect taps while simulating', () => {
    const project = new Project();
    TestBed.inject(ProjectService).setMainProject(project);
    const inspection = new TestInspection();
    const component = makeInspectable(inspection);

    // Before simulation, taps go nowhere.
    project.emitInspectRequest(component);
    expect(service.open()).toHaveLength(0);

    workMode.setSimulationMode(true);
    flushEffects();
    project.emitInspectRequest(component);
    expect(service.open()).toHaveLength(1);

    workMode.setSimulationMode(false);
    flushEffects();
    project.emitInspectRequest(component);
    expect(service.open()).toHaveLength(0);

    project.destroy({ children: true });
  });
});
