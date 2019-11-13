import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ToolbarItemTooltipComponent } from './toolbar-item-tooltip.component';

describe('ToolbarItemTooltipComponent', () => {
	let component: ToolbarItemTooltipComponent;
	let fixture: ComponentFixture<ToolbarItemTooltipComponent>;

	beforeEach(async(() => {
		TestBed.configureTestingModule({
			declarations: [ ToolbarItemTooltipComponent ]
		})
			.compileComponents();
	}));

	beforeEach(() => {
		fixture = TestBed.createComponent(ToolbarItemTooltipComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
