import { beforeEach, describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ComponentListCategoryComponent } from './component-list-category.component';
import { appConfig } from '../../../app.config';
import { MobileUiService } from '../../../layout/mobile-ui.service';
import { WorkModeService } from '../../../work-mode/work-mode.service';
import { WorkMode } from '../../../work-mode/work-mode.enum';
import { andComponentConfig } from '../../../components/component-types/and/and.config';

describe('ComponentListCategoryComponent', () => {
  let component: ComponentListCategoryComponent;
  let fixture: ComponentFixture<ComponentListCategoryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ComponentListCategoryComponent],
      providers: appConfig.providers
    }).compileComponents();

    fixture = TestBed.createComponent(ComponentListCategoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('arms placement and closes the open mobile sheet on selection', () => {
    const mobileUi = TestBed.inject(MobileUiService);
    const workMode = TestBed.inject(WorkModeService);
    mobileUi.open('palette');

    component.selectComponent(andComponentConfig);

    expect(workMode.mode()).toBe(WorkMode.COMPONENT_PLACEMENT);
    expect(workMode.selectedComponentType()).toBe(andComponentConfig.type);
    expect(mobileUi.activeSheet()).toBeNull();
  });
});
