import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PortsPanelComponent } from './ports-panel.component';
import { appConfig } from '../../app.config';

describe('PortsPanelComponent', () => {
  let component: PortsPanelComponent;
  let fixture: ComponentFixture<PortsPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PortsPanelComponent],
      providers: appConfig.providers
    }).compileComponents();

    fixture = TestBed.createComponent(PortsPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create with no active project', () => {
    expect(component).toBeTruthy();
    expect(component.inputRows()).toEqual([]);
    expect(component.outputRows()).toEqual([]);
  });
});
