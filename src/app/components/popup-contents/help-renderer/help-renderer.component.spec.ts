import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { HelpRendererComponent } from './help-renderer.component';

describe('HelpRendererComponent', () => {
	let component: HelpRendererComponent;
	let fixture: ComponentFixture<HelpRendererComponent>;

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [ HelpRendererComponent ]
		})
			.compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(HelpRendererComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
