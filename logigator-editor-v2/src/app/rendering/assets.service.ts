import { Injectable } from '@angular/core';
import { Assets } from 'pixi.js';
import robotoUrl from '@assets/roboto-regular-webfont.woff2';

@Injectable({
  providedIn: 'root'
})
export class AssetsService {
  constructor() {
    if (!Assets.resolver.hasKey('Roboto')) {
      Assets.add({
        alias: 'Roboto',
        src: robotoUrl
      });
    }
  }

  async init() {
    await Assets.load(['Roboto']);
  }
}
