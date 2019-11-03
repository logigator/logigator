import {Element} from './element';
import {LGraphics} from './rendering/l-graphics';

export interface ElementSprite {
	element?: Element;
	sprite: LGraphics;
}
