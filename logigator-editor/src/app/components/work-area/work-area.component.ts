import {
	Component,
	ElementRef,
	NgZone,
	OnInit,
	Renderer2,
	ViewChild
} from '@angular/core';
import { WorkArea } from '../../classes/work-area/work-area';
import { ProjectMeta } from '../../classes/project/project-meta';

@Component({
	selector: 'app-work-area',
	templateUrl: './work-area.component.html',
	styleUrls: ['./work-area.component.scss']
})
export class WorkAreaComponent extends WorkArea implements OnInit {
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
			this.initPixi(this._pixiCanvasContainer, this.renderer2);
			this.ticker.singleFrame(this.getIdentifier());
		});
	}

	getIdentifier(): string {
		return '0';
	}

	public get allProjects(): ProjectMeta[] {
		return [];
	}

	public get isSimulationMode(): boolean {
		return false;
	}
}
