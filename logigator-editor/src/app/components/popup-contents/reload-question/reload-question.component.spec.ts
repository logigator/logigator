import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';

import { ReloadQuestionComponent } from './reload-question.component';

describe('ReloadQuestionComponent', () => {
	let component: ReloadQuestionComponent;
	let fixture: ComponentFixture<ReloadQuestionComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [ ReloadQuestionComponent ]
		})
			.compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(ReloadQuestionComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
