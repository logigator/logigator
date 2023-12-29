import { Grid } from './grid';
import { ViewInteractionManager } from './view-interaction-manager';
import { Action } from '../action';
import { takeUntil } from 'rxjs/operators';
import { View } from './view';
import { Project } from '../project';
import { Element } from '../element';
import { ProjectType } from '../project-type';
import { LGraphicsResolver } from './graphics/l-graphics-resolver';
import { isUpdatable } from './graphics/l-graphics';
import { getStaticDI } from '../get-di';
import { ElementProviderService } from '../../services/element-provider/element-provider.service';

export class EditorView extends View {
	private _viewInteractionManager: ViewInteractionManager;

	constructor(
		project: Project,
		htmlContainer: HTMLElement,
		requestSingleFrameFn: () => Promise<void>
	) {
		super(project, htmlContainer, requestSingleFrameFn);

		this._viewInteractionManager = new ViewInteractionManager(this, project);

		this.applyOpenActions();

		this._project.changes
			.pipe(takeUntil(this._destroySubject))
			.subscribe((actions: Action[]) => this.applyActionsToView(actions));
	}

	isSimulationView(): boolean {
		return false;
	}

	public updateSelectedElementsScale() {
		this._viewInteractionManager.updateSelectionScale();
	}

	public updateSymbolUserDefinedElements() {
		const elementProvider = getStaticDI(ElementProviderService);
		for (const [id, sprite] of this.allElements) {
			if (
				isUpdatable(sprite) &&
				elementProvider.isUserElement(sprite.element.typeId)
			) {
				sprite.updateComponent(this.zoomPan.currentScale, sprite.element);
			}
		}
		this.requestSingleFrame();
	}

	public placeComponentOnView(element: Element) {
		const sprite = LGraphicsResolver.getLGraphicsFromElement(
			this.zoomPan.currentScale,
			element,
			this.project
		);
		sprite.position = Grid.getLocalChunkPixelPosForGridPos(element.pos);
		this.addToCorrectChunk(sprite, element.pos);
		this.allElements.set(element.id, sprite);
		this._viewInteractionManager.addNewElement(sprite);
	}

	public get projectType(): ProjectType {
		return this._project.type;
	}

	public override destroy() {
		this._viewInteractionManager.destroy();
		super.destroy();
	}
}
