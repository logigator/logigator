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

	constructor() {
		super();
	}

	ngOnInit() {
		console.log(this.inputFromOpener);
	}

	onInput(event: any) {
		this.selectionChange();
		this.hexInput.nativeElement.value = this.hexInput.nativeElement.value
			.split('')
			.map(c => c.toUpperCase())
			.filter(c => c.match(/[0-9A-F]/i))
			.reduce((previousValue, currentValue, currentIndex) => {
				return previousValue + currentValue + (currentIndex !== 0 && (currentIndex + 1) % 2 === 0 ? ' ' : '');
			}, '')
			.trimRight();

		let newLeftAddress = '';
		const lineCount = Math.ceil(this.hexInput.nativeElement.value.length / 48) || 1;
		for (let i = 0; i < lineCount; i++) {
			let hex = (i * 16).toString(16);
			while (hex.length < 8) hex = '0' + hex;
			newLeftAddress += hex + '\n';
		}
		if (event.inputType.startsWith('delete')) {
			this.hexInput.nativeElement.selectionStart = this.selectionStart;
			this.hexInput.nativeElement.selectionEnd = this.selectionEnd;
		}
		this.leftAddress = newLeftAddress;
		this.hexInput.nativeElement.style.height = 26 + Math.ceil(this.hexInput.nativeElement.value.length / 48) * 26 + 'px';
	}

	selectionChange() {
		this.selectionStart = this.hexInput.nativeElement.selectionStart;
		this.selectionEnd = this.hexInput.nativeElement.selectionEnd;
	}

}
