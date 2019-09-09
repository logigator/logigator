import * as PIXI from 'pixi.js';
import {Element} from './element';

export interface ElementSprite {
	element?: Element;
	sprite: PIXI.Sprite | PIXI.Graphics;
}
