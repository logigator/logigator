import {Component, Input, OnInit} from '@angular/core';
import {ThemingService} from '../../services/theming/theming.service';

@Component({
	selector: 'app-loading-symbol',
	templateUrl: './loading-symbol.component.html',
	styleUrls: ['./loading-symbol.component.scss']
})
export class LoadingSymbolComponent implements OnInit {

	@Input()
	public text: string;

	currTheme: string;

	constructor(private theme: ThemingService) { }

	ngOnInit(): void {
		this.currTheme = this.theme.currentTheme;
	}

}
