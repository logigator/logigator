import * as fs from 'fs';
import {ProjectElement} from '../models/request/api/project-element';
import {Wire} from '../models/RenderElements/wire';
import {RenderElement} from '../models/render-element';
import {Not} from '../models/RenderElements/not';
import {Image} from '../models/image';

export class ImageService {
	public async generateImage() {
		const elements = this.convertToRenderElements(JSON.parse(await fs.promises.readFile('import.json', {encoding: 'utf8'})));

		const image = new Image(elements, {x: 1000, y: 1000});

		await fs.promises.writeFile('output.png', image.canvas.toBuffer());
	}

	public convertToRenderElements(elements: ProjectElement[]): RenderElement[] {
		const converted: RenderElement[] = [];
		for (const element of elements) {
			switch (element.t) {
				case 0:
					converted.push(new Wire(element));
					break;
				case 1:
					converted.push(new Not(element));
					break;
			}
		}
		return converted;
	}
}
