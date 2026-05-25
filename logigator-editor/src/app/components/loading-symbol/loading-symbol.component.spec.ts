import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoadingSymbolComponent } from './loading-symbol.component';

describe('LoadingSymbolComponent', () => {
	let component: LoadingSymbolComponent;
	let fixture: ComponentFixture<LoadingSymbolComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [LoadingSymbolComponent]
		}).compileComponents();
	});

	beforeEach(() => {
		fixture = TestBed.createComponent(LoadingSymbolComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
