import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { configureTestBed } from '../../testing/configure-test-bed';
import { BuiltInComponentType } from '../components/component-type.enum';
import { WorkMode } from './work-mode.enum';
import { WorkModeService } from './work-mode.service';

describe('WorkModeService', () => {
  let service: WorkModeService;

  beforeEach(() => {
    configureTestBed();
    service = TestBed.inject(WorkModeService);
  });

  it('switches modes and clears the selected component type', () => {
    service.setMode(WorkMode.COMPONENT_PLACEMENT);
    service.setSelectedComponentType(BuiltInComponentType.AND);

    service.setMode(WorkMode.SELECT);

    expect(service.mode()).toBe(WorkMode.SELECT);
    expect(service.selectedComponentType()).toBeNull();
  });

  it('throws when SIMULATION is requested through setMode', () => {
    expect(() => service.setMode(WorkMode.SIMULATION)).toThrowError();
    expect(service.mode()).not.toBe(WorkMode.SIMULATION);
  });

  it('ignores mode and component-type changes while simulating', () => {
    service.setSimulationMode(true);

    service.setMode(WorkMode.ERASE);
    service.setSelectedComponentType(BuiltInComponentType.AND);

    expect(service.mode()).toBe(WorkMode.SIMULATION);
    expect(service.selectedComponentType()).toBeNull();
  });

  it('enters and leaves simulation via setSimulationMode', () => {
    service.setMode(WorkMode.COMPONENT_PLACEMENT);
    service.setSelectedComponentType(BuiltInComponentType.AND);

    service.setSimulationMode(true);
    expect(service.mode()).toBe(WorkMode.SIMULATION);
    expect(service.selectedComponentType()).toBeNull();

    service.setSimulationMode(false);
    expect(service.mode()).toBe(WorkMode.SELECT);
  });
});