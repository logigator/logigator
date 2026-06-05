import {
	ChangeDetectionStrategy,
	Component,
	inject,
	signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { InputTextModule } from 'primeng/inputtext';
import { CheckboxModule } from 'primeng/checkbox';
import { Button } from 'primeng/button';
import { CustomComponentService } from '../../custom-component/custom-component.service';

/**
 * Collects the metadata for a new custom component (name, symbol, description,
 * visibility) and hands it to {@link CustomComponentService.createComponent},
 * which opens an empty editor tab. Limits mirror the backend's columns
 * (name ≤ 20, symbol ≤ 5).
 */
@Component({
	selector: 'app-new-component-dialog',
	imports: [FormsModule, InputTextModule, CheckboxModule, Button],
	templateUrl: './new-component-dialog.component.html',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewComponentDialogComponent {
	private readonly ref = inject(DynamicDialogRef);
	private readonly customComponentService = inject(CustomComponentService);

	protected readonly name = signal('');
	protected readonly symbol = signal('');
	protected readonly description = signal('');
	protected readonly isPublic = signal(false);
	protected readonly source = signal<'server' | 'browser'>('server');

	protected get canCreate(): boolean {
		return this.name().trim().length > 0 && this.symbol().trim().length > 0;
	}

	protected create(): void {
		if (!this.canCreate) return;
		// Fire-and-forget: a server create is async (POST) but the dialog closes
		// optimistically; failures surface via a toast from the service.
		void this.customComponentService
			.createComponent({
				name: this.name().trim(),
				symbol: this.symbol().trim(),
				description: this.description().trim(),
				isPublic: this.isPublic(),
				source: this.source()
			})
			.catch(() => undefined);
		this.ref.close();
	}
}
