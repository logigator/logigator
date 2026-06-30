import { beforeEach, describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EditComponentActionComponent } from './edit-component-action.component';
import { ComponentActionContext } from '../../component-action';
import { configureTestBed } from '../../../../testing/configure-test-bed';

describe('EditComponentActionComponent', () => {
  let fixture: ComponentFixture<EditComponentActionComponent>;

  beforeEach(() => {
    configureTestBed([], [EditComponentActionComponent]);

    fixture = TestBed.createComponent(EditComponentActionComponent);
    fixture.componentRef.setInput('context', {
      component: { config: { type: 1 } },
      project: {}
    } as unknown as ComponentActionContext);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
