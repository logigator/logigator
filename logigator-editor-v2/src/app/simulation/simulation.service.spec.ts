import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../testing/configure-test-bed';
import { makeAnd, makeButton, makeLever } from '../../testing/factories';
import { Component } from '../components/component';
import { romComponentConfig } from '../components/component-types/rom/rom.config';
import { ToastService } from '../logging/toast.service';
import { Project } from '../project/project';
import { ProjectService } from '../project/project.service';
import { WorkMode } from '../work-mode/work-mode.enum';
import { WorkModeService } from '../work-mode/work-mode.service';
import { SimulationService } from './simulation.service';

describe('SimulationService', () => {
  let service: SimulationService;
  let workModeService: WorkModeService;
  let toastService: ToastService;
  let project: Project;

  beforeEach(() => {
    configureTestBed();
    service = TestBed.inject(SimulationService);
    workModeService = TestBed.inject(WorkModeService);
    toastService = TestBed.inject(ToastService);
    project = new Project();
    TestBed.inject(ProjectService).setMainProject(project);
  });

  afterEach(() => {
    service.exit();
    project.destroy({ children: true });
  });

  it('enters simulation mode with a compilable circuit', () => {
    project.addComponent(makeAnd(2, undefined, 0, 0));

    service.enter();

    expect(workModeService.mode()).toBe(WorkMode.SIMULATION);
    expect(service.board).not.toBeNull();
    expect(service.applier).not.toBeNull();
  });

  it('refuses to enter on diagnostics and reports via toast', () => {
    const error = vi.spyOn(toastService, 'error');
    project.addComponent(
      Component.deserialize({ pos: [0, 0], options: {} }, romComponentConfig)
    );
    const previousMode = workModeService.mode();

    service.enter();

    expect(workModeService.mode()).toBe(previousMode);
    expect(error).toHaveBeenCalledOnce();
  });

  it('toggles a lever on canvas user input', () => {
    const lever = makeLever();
    project.addComponent(lever);
    service.enter();

    project.emitUserInput(lever);
    expect(lever.isOn).toBe(true);

    project.emitUserInput(lever);
    expect(lever.isOn).toBe(false);
  });

  it('flashes a button on canvas user input', () => {
    vi.useFakeTimers();
    try {
      const button = makeButton();
      project.addComponent(button);
      service.enter();

      project.emitUserInput(button);
      expect(button.pressed).toBe(true);

      vi.runAllTimers();
      expect(button.pressed).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('exit resets sim state and restores SELECT mode', () => {
    const lever = makeLever();
    project.addComponent(lever);
    service.enter();
    project.emitUserInput(lever);

    service.exit();

    expect(workModeService.mode()).toBe(WorkMode.SELECT);
    expect(lever.isOn).toBe(false);
    expect(service.board).toBeNull();
    expect(service.applier).toBeNull();
  });

  it('ignores user input after exit', () => {
    const lever = makeLever();
    project.addComponent(lever);
    service.enter();
    service.exit();

    project.emitUserInput(lever);

    expect(lever.isOn).toBe(false);
  });
});
