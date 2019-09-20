import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ViewDropdownComponent } from './view-dropdown.component';

describe('ViewDropdownComponent', () => {
  let component: ViewDropdownComponent;
  let fixture: ComponentFixture<ViewDropdownComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ViewDropdownComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ViewDropdownComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
