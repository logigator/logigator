import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';

import { HelpWindowComponent } from './help-window.component';

describe('HelpWindowComponent', () => {
	let component: HelpWindowComponent;
	let fixture: ComponentFixture<HelpWindowComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [ HelpWindowComponent ]
		})
			.compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(HelpWindowComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
