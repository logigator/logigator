import { Component, ViewEncapsulation } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { PopupContentComp } from '../../popup/popup-content-comp';

@Component({
	selector: 'app-help',
	templateUrl: './help.component.html',
	styleUrls: ['./help.component.scss'],
	encapsulation: ViewEncapsulation.None
})
export class HelpComponent extends PopupContentComp {
	public helpToRender = 'get-started';

	constructor(private translate: TranslateService) {
		super();
	}

	public get currentLang(): string {
		return this.translate.currentLang;
	}

	get markdownUrl(): string {
		return `assets/help/${this.currentLang}/${this.helpToRender}.md`;
	}

	public get githubEditUrl(): string {
		return `https://github.com/logigator/logigator/tree/master/logigator-editor/src/assets/help/${this.currentLang}/${this.helpToRender}.md`;
	}
}
