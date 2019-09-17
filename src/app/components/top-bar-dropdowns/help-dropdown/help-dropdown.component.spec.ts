import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { HelpDropdownComponent } from './help-dropdown.component';

describe('HelpDropdownComponent', () => {
  let component: HelpDropdownComponent;
  let fixture: ComponentFixture<HelpDropdownComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ HelpDropdownComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(HelpDropdownComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
