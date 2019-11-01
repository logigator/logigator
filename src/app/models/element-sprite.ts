import {Element} from './element';
import {WireGraphics} from './rendering/wire-graphics';
import * as PIXI from 'pixi.js';

export interface ElementSprite {
	element?: Element;
	sprite: PIXI.Sprite | WireGraphics;
}
