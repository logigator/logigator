import {LGraphics} from './l-graphics';
import {Element} from '../../element';
import {ElementProviderService} from '../../../services/element-provider/element-provider.service';
import {getStaticDI} from '../../get-di';
import {WireGraphics} from './wire-graphics';
import {ComponentGraphics} from './component-graphics';
import {ButtonGraphics} from './button-graphics';
import {LeverGraphics} from './lever-graphics';
import {ElementTypeId} from '../../element-types/element-type-ids';

export abstract class LGraphicsResolver {

	private static get elementProviderService(): ElementProviderService {
		return getStaticDI(ElementProviderService);
	}

	public static getLGraphicsFromElement(scale: number, element: Element, parentProjectIdentifier?: string): LGraphics {
		if (element.typeId === ElementTypeId.WIRE) {
			return new WireGraphics(scale, element);
		} else if (element.typeId === ElementTypeId.BUTTON) {
			return new ButtonGraphics(scale, element, parentProjectIdentifier);
		} else if (element.typeId === ElementTypeId.LEVER) {
			return new LeverGraphics(scale, element, parentProjectIdentifier);
		} else {
			return new ComponentGraphics(scale, element);
		}
	}

	// wires are not supported !!
	public static getLGraphicsFromType(scale: number, elemTypeId: number): LGraphics {
		const elemType = this.elementProviderService.getElementById(elemTypeId);
		if (elemTypeId === ElementTypeId.BUTTON) {
			return new ButtonGraphics(scale, elemType);
		} else if (elemTypeId === ElementTypeId.LEVER) {
			return new LeverGraphics(scale, elemType);
		} else {
			return new ComponentGraphics(scale, elemType);
		}
	}

}
