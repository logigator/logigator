import * as PIXI from 'pixi.js';
import {Component} from './component';

export interface ComponentSprite {
	component?: Component;
	sprite: PIXI.Sprite;
}
