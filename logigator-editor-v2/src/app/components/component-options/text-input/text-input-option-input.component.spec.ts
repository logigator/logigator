import { beforeEach, describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TextInputOptionInputComponent } from './text-input-option-input.component';
import { TextInputComponentOption } from './text-input.component-option';
import { configureTestBed } from '../../../../testing/configure-test-bed';

describe('TextInputOptionInputComponent', () => {
  let fixture: ComponentFixture<TextInputOptionInputComponent>;

  beforeEach(() => {
    configureTestBed([], [TextInputOptionInputComponent]);

    fixture = TestBed.createComponent(TextInputOptionInputComponent);
    fixture.componentRef.setInput(
      'option',
      new TextInputComponentOption('components.options.label', 'A')
    );
    fixture.detectChanges();
  });

  it('creates without error', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
