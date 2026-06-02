import { ChangeDetectionStrategy, Component, Injector } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Rectangle } from 'pixi.js';
import { setStaticDIInjector } from '../utils/get-di';
import { appConfig } from '../app.config';
import { SelectionInspectorService } from './selection-inspector.service';
import { ProjectService } from './project.service';
import { ProjectMetadataStore } from '../persistence/project-metadata.store';
import { Project } from './project';
import { AndComponent } from '../components/component-types/and/and.component';
import { andComponentConfig } from '../components/component-types/and/and.config';
import { WorkMode } from '../work-mode/work-mode.enum';

function makeAnd(): AndComponent {
	return new AndComponent({
		direction: andComponentConfig.options.direction.clone(),
		numInputs: andComponentConfig.options.numInputs.clone(2)
	});
}

// A trivial host so the inspector's root effect flushes through a normal fixture
// change-detection pass, which — unlike TestBed.tick()/flushEffects() — does not
// trip the recursive-tick guard when the effect writes a signal.
@Component({
	selector: 'app-test-host',
	template: '',
	changeDetection: ChangeDetectionStrategy.OnPush
})
class TestHostComponent {}

describe('SelectionInspectorService', () => {
	let inspector: SelectionInspectorService;
	let projectService: ProjectService;
	let metadataStore: ProjectMetadataStore;
	let fixture: ComponentFixture<TestHostComponent>;
	let project: Project;
	let component: AndComponent;

	beforeEach(() => {
		TestBed.configureTestingModule({
			imports: [TestHostComponent],
			providers: appConfig.providers
		});
		setStaticDIInjector(TestBed.inject(Injector));
		inspector = TestBed.inject(SelectionInspectorService);
		projectService = TestBed.inject(ProjectService);
		metadataStore = TestBed.inject(ProjectMetadataStore);
		fixture = TestBed.createComponent(TestHostComponent);

		project = new Project();
		component = makeAnd();
		component.position.set(0, 0);
		project.addComponent(component);
		metadataStore.register(project, {
			id: 'p',
			name: 'P',
			type: 'project',
			source: 'browser',
			hash: '',
			isPublic: false
		});
		projectService.setMainProject(project);
		// Flush the inspector's effect so it subscribes to this project's selection.
		fixture.detectChanges();
	});

	afterEach(() => {
		project.destroy({ children: true });
	});

	function selectComponent(): void {
		project.selectionManager.commit(new Rectangle(0, 0, 3, 3), WorkMode.SELECT);
	}

	it('exposes the single selected component', () => {
		expect(inspector.selectedComponent()).toBeNull();
		selectComponent();
		expect(inspector.selectedComponent()).toBe(component);
	});

	it('clears the selected component when nothing is selected', () => {
		selectComponent();
		project.selectionManager.clear();
		expect(inspector.selectedComponent()).toBeNull();
	});

	it('routes a proxied option write through ChangeOptionAction (undoable + dirty)', () => {
		selectComponent();
		metadataStore.clearDirty(project);

		const proxied = inspector.inspectorOptions()!;
		// numInputs starts at 2; a proxy write must NOT mutate directly — it
		// dispatches an action that does, then the proxy reflects the new value.
		proxied['numInputs'].value = 3;

		expect(component.options.numInputs.value).toBe(3);
		expect(proxied['numInputs'].value).toBe(3);
		expect(metadataStore.isDirty(project)).toBeTrue();

		project.actionManager.undo();
		expect(component.options.numInputs.value).toBe(2);
	});
});
