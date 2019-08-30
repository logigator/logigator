import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ContructionBoxComponent } from './contruction-box.component';

describe('ContructionBoxComponent', () => {
	let component: ContructionBoxComponent;
	let fixture: ComponentFixture<ContructionBoxComponent>;

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [ ContructionBoxComponent ]
		})
			.compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(ContructionBoxComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
