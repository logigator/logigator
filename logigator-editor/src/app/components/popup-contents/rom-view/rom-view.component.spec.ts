import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';

import { RomViewComponent } from './rom-edit.component';

describe('RomEditComponent', () => {
	let component: RomViewComponent;
	let fixture: ComponentFixture<RomViewComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [ RomViewComponent ]
		})
			.compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(RomViewComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
