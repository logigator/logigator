import {Grid} from './grid';
import {ViewInteractionManager} from './view-interaction-manager';
import {Action} from '../action';
import {takeUntil} from 'rxjs/operators';
import {View} from './view';
import {Project} from '../project';
import {Element} from '../element';
import {ProjectType} from '../project-type';
import {LGraphicsResolver} from './graphics/l-graphics-resolver';

export class EditorView extends View {

	private _viewInteractionManager: ViewInteractionManager;

	constructor(project: Project, htmlContainer: HTMLElement, requestSingleFrameFn: () => Promise<void>) {
		super(project, htmlContainer, requestSingleFrameFn);

		this._viewInteractionManager = new ViewInteractionManager(this, project);

		this.applyOpenActions();

		this._project.changes.pipe(
			takeUntil(this._destroySubject)
		).subscribe((actions: Action[]) => this.applyActionsToView(actions));
	}

	isSimulationView(): boolean {
		return false;
	}

	public updateSelectedElementsScale() {
		this._viewInteractionManager.updateSelectionScale();
	}

	public placeComponentOnView(element: Element) {
		const sprite = LGraphicsResolver.getLGraphicsFromElement(this.zoomPan.currentScale, element, this.project);
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
