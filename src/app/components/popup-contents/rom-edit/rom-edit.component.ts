import {Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {PopupContentComp} from '@logigator/logigator-shared-comps';

@Component({
	selector: 'app-rom-edit',
	templateUrl: './rom-edit.component.html',
	styleUrls: ['./rom-edit.component.scss']
})
export class RomEditComponent extends PopupContentComp<string> implements OnInit {

	@ViewChild('hexInput', {static: true})
	hexInput: ElementRef<HTMLTextAreaElement>;

	leftAddress = '00000000';

	selectionStart: number;
	selectionEnd: number;
	rows = 1;

	constructor() {
		super();
	}

	ngOnInit() {
		this.hexInput.nativeElement.value = '';

		if (!this.inputFromOpener) return;
		const raw = atob(this.inputFromOpener);
		let hex = '';
		for (let i = 0; i < raw.length; i++ ) {
			const _hex = raw.charCodeAt(i).toString(16).toUpperCase();
			hex += (_hex.length === 2 ? _hex : '0' + _hex) + ' ';

		}
		this.rows = Math.ceil(hex.length / 48) || 1;
		this.calcLeftAddresses(this.rows);
		this.hexInput.nativeElement.value = hex;
	}

	onInput(event: any) {
		this.selectionChange();
		this.hexInput.nativeElement.value = this.hexInput.nativeElement.value
			.split('')
			.map(c => c.toUpperCase())
			.filter(c => c.match(/[0-9A-F]/im))
			.reduce((previousValue, currentValue, currentIndex) => {
				return previousValue + currentValue + (currentIndex !== 0 && (currentIndex + 1) % 2 === 0 ? ' ' : '');
			}, '')
			.trimRight();

		this.rows = Math.ceil(this.hexInput.nativeElement.value.length / 48) || 1;
		this.calcLeftAddresses(this.rows);
		if (event.inputType.startsWith('delete')) {
			this.hexInput.nativeElement.selectionStart = this.selectionStart;
			this.hexInput.nativeElement.selectionEnd = this.selectionEnd;
		}
	}

	private calcLeftAddresses(lineCount: number) {
		let newLeftAddress = '';
		for (let i = 0; i < lineCount; i++) {
			let hexAddr = (i * 16).toString(16).toUpperCase();
			while (hexAddr.length < 8) hexAddr = '0' + hexAddr;
			newLeftAddress += hexAddr + '\n';
		}
		this.leftAddress = newLeftAddress;
	}

	selectionChange() {
		this.selectionStart = this.hexInput.nativeElement.selectionStart;
		this.selectionEnd = this.hexInput.nativeElement.selectionEnd;
	}

	public cancel() {
		this.requestClose.emit(false);
	}

	public save() {
		const hex = this.hexInput.nativeElement.value.replace(/ /g, '');
		let base64 = '';
		for (let i = 0; i < hex.length; i++) {
			base64 += !(i - 1 & 1) ? String.fromCharCode(parseInt(hex.substring(i - 1, i + 1), 16)) : '';
		}
		this.requestClose.emit(btoa(base64));
	}

}
