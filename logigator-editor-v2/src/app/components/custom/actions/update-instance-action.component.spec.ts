import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UpdateInstanceActionComponent } from './update-instance-action.component';
import { ComponentActionContext } from '../../component-action';
import { appConfig } from '../../../app.config';

describe('UpdateInstanceActionComponent', () => {
	let fixture: ComponentFixture<UpdateInstanceActionComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [UpdateInstanceActionComponent],
			providers: appConfig.providers
		}).compileComponents();

		fixture = TestBed.createComponent(UpdateInstanceActionComponent);
		fixture.componentRef.setInput('context', {
			component: { config: { type: 1 } },
			project: {}
		} as unknown as ComponentActionContext);
		fixture.detectChanges();
	});

	it('should create (button hidden for an unresolved type)', () => {
		// detectChanges above evaluated the `updatable()` computed via the template.
		expect(fixture.componentInstance).toBeTruthy();
	});
});
