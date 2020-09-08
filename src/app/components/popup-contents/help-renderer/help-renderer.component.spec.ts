import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';

import { HelpRendererComponent } from './help-renderer.component';

describe('HelpRendererComponent', () => {
	let component: HelpRendererComponent;
	let fixture: ComponentFixture<HelpRendererComponent>;

	beforeEach(waitForAsync(() => {
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
