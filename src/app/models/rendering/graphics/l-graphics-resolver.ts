import {LGraphics} from './l-graphics';
import {Element} from '../../element';
import {ElementProviderService} from '../../../services/element-provider/element-provider.service';
import {getStaticDI} from '../../get-di';
import {WireGraphics} from './wire-graphics';
import {ComponentGraphics} from './component-graphics';
import {ButtonGraphics} from './button-graphics';
import {LeverGraphics} from './lever-graphics';
import {ElementTypeId} from '../../element-types/element-type-ids';
import {TextGraphics} from './text-graphics';
import {InputOutputGraphics} from './input-output-graphics';

export abstract class LGraphicsResolver {

	private static get elementProviderService(): ElementProviderService {
		return getStaticDI(ElementProviderService);
	}

	public static getLGraphicsFromElement(scale: number, element: Element, parentProjectIdentifier?: string): LGraphics {
		switch (element.typeId) {
			case ElementTypeId.WIRE:
				return new WireGraphics(scale, element);
			case ElementTypeId.BUTTON:
				return new ButtonGraphics(scale, element, parentProjectIdentifier);
			case ElementTypeId.LEVER:
				return new LeverGraphics(scale, element, parentProjectIdentifier);
			case ElementTypeId.INPUT:
			case ElementTypeId.OUTPUT:
				return new InputOutputGraphics(scale, element);
			default:
				return new ComponentGraphics(scale, element);
		}
	}

	// wires and text are not supported !!
	public static getLGraphicsFromType(scale: number, elemTypeId: number): LGraphics {
		const elemType = this.elementProviderService.getElementById(elemTypeId);
		switch (elemTypeId) {
			case ElementTypeId.BUTTON:
				return new ButtonGraphics(scale, elemType);
			case ElementTypeId.LEVER:
				return new LeverGraphics(scale, elemType);
			case ElementTypeId.INPUT:
			case ElementTypeId.OUTPUT:
				return new InputOutputGraphics(scale, elemType);
			default:
				return new ComponentGraphics(scale, elemType);
		}
	}

}
