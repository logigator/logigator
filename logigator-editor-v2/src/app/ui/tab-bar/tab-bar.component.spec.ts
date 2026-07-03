import { beforeEach, describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TabBarComponent } from './tab-bar.component';
import { configureTestBed } from '../../../testing/configure-test-bed';

describe('TabBarComponent', () => {
  let component: TabBarComponent;
  let fixture: ComponentFixture<TabBarComponent>;

  beforeEach(() => {
    configureTestBed([], [TabBarComponent]);

    fixture = TestBed.createComponent(TabBarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
