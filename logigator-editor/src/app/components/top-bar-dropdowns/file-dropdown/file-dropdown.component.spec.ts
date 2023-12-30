import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { FileDropdownComponent } from './file-dropdown.component';

describe('FileDropdownComponent', () => {
	let component: FileDropdownComponent;
	let fixture: ComponentFixture<FileDropdownComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [FileDropdownComponent]
		}).compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(FileDropdownComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
