import {Grid} from './grid';
import {ProjectsService} from '../../services/projects/projects.service';
import {ViewInteractionManager} from './view-interaction-manager';
import {Action} from '../action';
import {ProjectInteractionService} from '../../services/project-interaction/project-interaction.service';
import {filter, takeUntil} from 'rxjs/operators';
import {View} from './view';
import {Project} from '../project';
import {Element} from '../element';
import {ProjectType} from '../project-type';
import {getStaticDI} from '../get-di';
import {LGraphicsResolver} from './graphics/l-graphics-resolver';

export class EditorView extends View {

	private _viewInteractionManager: ViewInteractionManager;

	constructor(project: Project, htmlContainer: HTMLElement, requestSingleFrameFn: () => Promise<void>) {
		super(project, htmlContainer, requestSingleFrameFn);

		this._viewInteractionManager = new ViewInteractionManager(this);

		this.applyOpenActions();

		getStaticDI(ProjectsService).onProjectChanges$(this.projectId).pipe(
			takeUntil(this._destroySubject)
		).subscribe((actions: Action[]) => this.applyActionsToView(actions));

		getStaticDI(ProjectInteractionService).onZoomChangeClick$.pipe(
			filter(_ => this.projectId === getStaticDI(ProjectsService).currProject.id),
			takeUntil(this._destroySubject)
		).subscribe((dir => this.onZoomClick(dir)));
	}

	isSimulationView(): boolean {
		return false;
	}

	public updateSelectedElementsScale() {
		this._viewInteractionManager.updateSelectionScale();
	}

	public placeComponentOnView(element: Element) {
		const sprite = LGraphicsResolver.getLGraphicsFromElement(this.zoomPan.currentScale, element);
		sprite.position = Grid.getLocalChunkPixelPosForGridPos(element.pos);
		sprite.name = element.id.toString();
		this.addToCorrectChunk(sprite, element.pos);
		this.allElements.set(element.id, sprite);
		this._viewInteractionManager.addNewElement(sprite);
	}

	public get projectType(): ProjectType {
		return this._project.type;
	}

	public destroy() {
		this._viewInteractionManager.destroy();
		super.destroy();
	}

}
