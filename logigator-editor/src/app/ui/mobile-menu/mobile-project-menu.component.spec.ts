import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { MenuItem } from '@logigator/ui';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { MobileProjectMenuComponent } from './mobile-project-menu.component';
import { EditorMenuService } from '../editor-menu.service';
import { MobileUiService } from '../../layout/mobile-ui.service';

describe('MobileProjectMenuComponent', () => {
  const command = vi.fn();
  const nestedCommand = vi.fn();

  beforeEach(() => {
    command.mockClear();
    nestedCommand.mockClear();
    configureTestBed(
      [
        {
          provide: EditorMenuService,
          useValue: {
            compactItems: signal<MenuItem[]>([
              { label: 'Leaf', command },
              {
                label: 'Group',
                items: [{ label: 'Nested', command: nestedCommand }]
              }
            ])
          }
        }
      ],
      [MobileProjectMenuComponent]
    );
  });

  it('closes the sheet and still runs the command when an action is tapped', () => {
    const mobileUi = TestBed.inject(MobileUiService);
    mobileUi.open('project');

    const fixture = TestBed.createComponent(MobileProjectMenuComponent);
    fixture.detectChanges();
    const buttons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button')
    );

    buttons.find((b) => b.textContent?.includes('Leaf'))!.click();

    expect(command).toHaveBeenCalledTimes(1);
    expect(mobileUi.activeSheet()).toBeNull();
  });

  it('wraps nested items so submenu actions close the sheet too', () => {
    const mobileUi = TestBed.inject(MobileUiService);
    mobileUi.open('project');

    const fixture = TestBed.createComponent(MobileProjectMenuComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const buttons = () => Array.from(el.querySelectorAll('button'));

    buttons()
      .find((b) => b.textContent?.includes('Group'))!
      .click();
    fixture.detectChanges();
    buttons()
      .find((b) => b.textContent?.includes('Nested'))!
      .click();

    expect(nestedCommand).toHaveBeenCalledTimes(1);
    expect(mobileUi.activeSheet()).toBeNull();
  });
});
