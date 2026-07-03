import { beforeEach, describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TitleBarComponent } from './title-bar.component';
import { DialogService } from '@logigator/ui';
import { configureTestBed } from '../../../testing/configure-test-bed';

describe('TitleBarComponent', () => {
  let component: TitleBarComponent;
  let fixture: ComponentFixture<TitleBarComponent>;

  beforeEach(() => {
    configureTestBed(
      [{ provide: DialogService, useValue: { open: () => null } }],
      [TitleBarComponent]
    );

    fixture = TestBed.createComponent(TitleBarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
