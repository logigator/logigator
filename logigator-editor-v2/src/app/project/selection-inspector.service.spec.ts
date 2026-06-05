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

// A trivial host whose change-detection pass flushes the inspector's
// `toObservable` subscription effect, so the active project's selection stream
// is live before the assertions run.
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
});
