import { beforeEach, describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PortsPanelComponent } from './ports-panel.component';
import { configureTestBed } from '../../../testing/configure-test-bed';

describe('PortsPanelComponent', () => {
  let component: PortsPanelComponent;
  let fixture: ComponentFixture<PortsPanelComponent>;

  beforeEach(() => {
    configureTestBed([], [PortsPanelComponent]);

    fixture = TestBed.createComponent(PortsPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create with no active project', () => {
    expect(component).toBeTruthy();
    expect(component['inputRows']()).toEqual([]);
    expect(component['outputRows']()).toEqual([]);
  });
});
