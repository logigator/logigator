import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';

import { HexBinDecConverterComponent } from './hex-bin-dec-converter.component';

describe('HexBinDecConverterComponent', () => {
	let component: HexBinDecConverterComponent;
	let fixture: ComponentFixture<HexBinDecConverterComponent>;

	beforeEach(waitForAsync(() => {
		TestBed.configureTestingModule({
			declarations: [ HexBinDecConverterComponent ]
		})
			.compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(HexBinDecConverterComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
