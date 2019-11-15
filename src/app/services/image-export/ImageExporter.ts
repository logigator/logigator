import {Project} from '../../models/project';
import * as PIXI from 'pixi.js';
import {Element} from '../../models/element';
import {LGraphicsResolver} from '../../models/rendering/graphics/l-graphics-resolver';
import {Grid} from '../../models/rendering/grid';
import {getStaticDI} from '../../models/get-di';
import {ThemingService} from '../theming/theming.service';
import {environment} from '../../../environments/environment';

export class ImageExporter {

	private readonly _container: PIXI.Container;
	private readonly themingService = getStaticDI(ThemingService);

	constructor(private renderer: PIXI.Renderer, private project: Project) {
		this._container = new PIXI.Container();
		this._container.sortableChildren = true;

		for (const action of this.project.getOpenActions()) {
			switch (action.name) {
				case 'addComp':
					this.placeComp(action.element);
					break;
				case 'addWire':
					this.placeWire(action.element);
					break;
				case 'conWire':
					this.placeConnPoint(action.pos);
					break;
			}
		}
		this.addBackground();
	}

	public getBase64String(type: 'jpeg' | 'png'): string {
		const b64 =  this.renderer.extract.base64(this._container, 'image/' + type, 1);
		this._container.destroy();
		return b64;
	}

	private placeComp(element: Element) {
		const sprite = LGraphicsResolver.getLGraphicsFromElement(1, element);
		sprite.position = Grid.getPixelPosForGridPos(element.pos);
		sprite.zIndex = 10;
		this._container.addChild(sprite);
	}

	private placeWire(element: Element) {
		const graphics = LGraphicsResolver.getLGraphicsFromElement(1, element);
		graphics.position = Grid.getPixelPosForGridPosWire(element.pos);
		graphics.zIndex = 10;
		this._container.addChild(graphics);
	}

	private placeConnPoint(pos: PIXI.Point) {
		const pixelPos = Grid.getPixelPosForGridPosWire(pos);
		pixelPos.x -= 2.5;
		pixelPos.y -= 2.5;
		const graphics = new PIXI.Graphics();
		graphics.position = pixelPos;
		graphics.beginFill(this.themingService.getEditorColor('wire'));
		graphics.drawRect(0, 0, 5, 5);
		graphics.zIndex = 10;
		this._container.addChild(graphics);
	}

	private addBackground() {
		const background = new PIXI.Graphics();
		background.beginFill(this.themingService.getEditorColor('background'));
		const bounds = this._container.getBounds();
		background.drawRect(
			0,
			0,
			bounds.x + bounds.width + environment.gridPixelWidth,
			bounds.y + bounds.height + environment.gridPixelWidth
		);
		background.zIndex = 1;
		this._container.addChild(background);
	}
}

