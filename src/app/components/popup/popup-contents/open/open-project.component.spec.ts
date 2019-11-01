import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { OpenProjectComponent } from './open-project.component';

describe('OpenComponent', () => {
	let component: OpenProjectComponent;
	let fixture: ComponentFixture<OpenProjectComponent>;

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [ OpenProjectComponent ]
		})
			.compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(OpenProjectComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
