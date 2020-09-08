import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';

import { SingleShortcutConfigComponent } from './single-shortcut-config.component';

describe('SingleShortcutConfigComponent', () => {
	let component: SingleShortcutConfigComponent;
	let fixture: ComponentFixture<SingleShortcutConfigComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [ SingleShortcutConfigComponent ]
		})
			.compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(SingleShortcutConfigComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
