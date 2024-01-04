import {
	Component,
	ElementRef,
	NgZone,
	OnDestroy,
	OnInit,
	Renderer2,
	ViewChild
} from '@angular/core';
import { WorkArea } from '../../classes/work-area/work-area';
import { Project } from '../../classes/project/project';

@Component({
	selector: 'app-work-area',
	templateUrl: './work-area.component.html',
	styleUrls: ['./work-area.component.scss']
})
export class WorkAreaComponent extends WorkArea implements OnInit, OnDestroy {
	@ViewChild('pixiCanvasContainer', { static: true })
	private _pixiCanvasContainer!: ElementRef<HTMLDivElement>;

	constructor(
		private renderer2: Renderer2,
		private ngZone: NgZone
	) {
		super();
	}

	ngOnInit() {
		this.ngZone.runOutsideAngular(() => {
			this.addTickerFunction();
			this.preventContextMenu(this._pixiCanvasContainer, this.renderer2);
			this.initPixi(this._pixiCanvasContainer, this.renderer2);
			this.ticker.startAllContSim();
		});
	}

	getIdentifier(): string {
		return '0';
	}

	public get allProjects(): Project[] {
		return [];
	}

	public get isSimulationMode(): boolean {
		return false;
	}

	ngOnDestroy(): void {
		super.destroy();
	}
}
