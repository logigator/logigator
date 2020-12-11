import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';

import { TutorialWindowComponent } from './tutorial-window.component';

describe('TutorialWindowComponent', () => {
	let component: TutorialWindowComponent;
	let fixture: ComponentFixture<TutorialWindowComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [ TutorialWindowComponent ]
		})
			.compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(TutorialWindowComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
