import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { ShortcutConfigComponent } from './shortcut-config.component';

describe('ShortcutConfigComponent', () => {
	let component: ShortcutConfigComponent;
	let fixture: ComponentFixture<ShortcutConfigComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [ShortcutConfigComponent]
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(ShortcutConfigComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
