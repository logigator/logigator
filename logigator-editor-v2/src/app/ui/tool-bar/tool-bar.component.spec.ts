import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ToolBarComponent } from './tool-bar.component';
import { appConfig } from '../../app.config';

describe('ToolBarComponent', () => {
	let component: ToolBarComponent;
	let fixture: ComponentFixture<ToolBarComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [ToolBarComponent],
			providers: appConfig.providers
		}).compileComponents();

		fixture = TestBed.createComponent(ToolBarComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
