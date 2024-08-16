import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SideBarComponent } from './side-bar.component';
import { appConfig } from '../../app.config';

describe('SideBarComponent', () => {
	let component: SideBarComponent;
	let fixture: ComponentFixture<SideBarComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [SideBarComponent],
			providers: appConfig.providers
		}).compileComponents();

		fixture = TestBed.createComponent(SideBarComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
