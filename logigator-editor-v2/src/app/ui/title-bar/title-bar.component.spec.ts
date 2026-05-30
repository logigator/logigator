import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TitleBarComponent } from './title-bar.component';
import { DialogService } from 'primeng/dynamicdialog';
import { appConfig } from '../../app.config';

describe('TitleBarComponent', () => {
	let component: TitleBarComponent;
	let fixture: ComponentFixture<TitleBarComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [TitleBarComponent],
			providers: [
				...appConfig.providers,
				{ provide: DialogService, useValue: { open: () => null } }
			]
		}).compileComponents();

		fixture = TestBed.createComponent(TitleBarComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
