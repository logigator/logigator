import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ImageExportComponent } from './image-export.component';

describe('ImageExportComponent', () => {
	let component: ImageExportComponent;
	let fixture: ComponentFixture<ImageExportComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [ ImageExportComponent ]
		})
			.compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(ImageExportComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
