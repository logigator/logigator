import { beforeEach, describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StatusBarComponent } from './status-bar.component';
import { configureTestBed } from '../../../testing/configure-test-bed';

describe('StatusBarComponent', () => {
  let component: StatusBarComponent;
  let fixture: ComponentFixture<StatusBarComponent>;

  beforeEach(() => {
    configureTestBed([], [StatusBarComponent]);

    fixture = TestBed.createComponent(StatusBarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
