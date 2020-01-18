import { BrowserModule } from '@angular/platform-browser';
import {Injector, NgModule} from '@angular/core';
import { AppComponent } from './app.component';
import { ToolbarComponent } from './components/toolbar/toolbar.component';
import { SettingsInfoBoxComponent } from './components/settings-info-box/settings-info-box.component';
import { ConstructionBoxComponent } from './components/construction-box/construction-box.component';
import { WorkAreaComponent } from './components/work-area/work-area.component';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {ConstructionBoxCategoryComponent} from './components/construction-box-category/construction-box-category.component';
import { TopBarComponent } from './components/top-bar/top-bar.component';
import { FileDropdownComponent } from './components/top-bar-dropdowns/file-dropdown/file-dropdown.component';
import { EditDropdownComponent } from './components/top-bar-dropdowns/edit-dropdown/edit-dropdown.component';
import { ViewDropdownComponent } from './components/top-bar-dropdowns/view-dropdown/view-dropdown.component';
import { HelpDropdownComponent } from './components/top-bar-dropdowns/help-dropdown/help-dropdown.component';
import { SettingsDropdownComponent } from './components/top-bar-dropdowns/settings-dropdown/settings-dropdown.component';
import { ShortcutTextPipe } from './pipes/shortcut-text/shortcut-text.pipe';
// tslint:disable-next-line:max-line-length
import { SingleShortcutConfigComponent } from './components/popup-contents/shortcut-config/single-shortcut-config/single-shortcut-config.component';
import { ShortcutConfigComponent } from './components/popup-contents/shortcut-config/shortcut-config/shortcut-config.component';
import { WindowWorkAreaComponent } from './components/window-work-area/window-work-area.component';
import {HTTP_INTERCEPTORS, HttpClientModule} from '@angular/common/http';
import { ReloadQuestionComponent } from './components/popup-contents/relaod-question/reload-question.component';
import { NewComponentComponent } from './components/popup-contents/new-component/new-component.component';
import { OpenProjectComponent } from './components/popup-contents/open/open-project.component';
import { SaveAsComponent } from './components/popup-contents/save-as/save-as.component';
import {ToastContainerModule, ToastrModule} from 'ngx-toastr';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {MissingTranslationHandler, TranslateLoader, TranslateModule} from '@ngx-translate/core';
import {CacheBustingTranslationLoader} from './models/translation/cache-busting-translate-loader';
import {AppMissingTranslationHandler} from './models/translation/missing-translation-handler';
import { OutsideNgZoneEventDirective } from './directives/outside-ng-zone-event/outside-ng-zone-event.directive';
import { UnsavedChangesComponent } from './components/popup-contents/unsaved-changes/unsaved-changes.component';
// #!electron
import { NgxElectronModule } from 'ngx-electron';
import { WorkAreaContainerComponent } from './components/work-area-container/work-area-container.component';
import { ShareProjectComponent } from './components/popup-contents/share-project/share-project.component';
import {setStaticDIInjector} from './models/get-di';
import {CredentialsInterceptor} from './interceptors/credentials';
import {SiPipe} from './pipes/si/si.pipe';
import { ToolbarItemTooltipDirective } from './directives/toolbar-item-tooltip/toolbar-item-tooltip.directive';
import { ToolbarItemTooltipComponent } from './components/toolbar-item-tooltip/toolbar-item-tooltip.component';
import { TextComponent } from './components/popup-contents/text/text.component';
import { StatusBarComponent } from './components/status-bar/status-bar.component';
import {
	LogigatorSharedCompsModule,
	SharedCompsAuthService,
	SharedCompsThemingService
} from '@logigator/logigator-shared-comps';
import {ThemingService} from './services/theming/theming.service';
import {UserService} from './services/user/user.service';
import { RomEditComponent } from './components/popup-contents/rom-edit/rom-edit.component';
import {WorkerCommunicationService} from './services/simulation/worker-communication/worker-communication-service';
// #!web
import {WorkerCommunicationWasmService} from './services/simulation/worker-communication/worker-communication-wasm.service';
// #!electron
import {WorkerCommunicationNodeService} from './services/simulation/worker-communication/worker-communication-node.service';

@NgModule({
	declarations: [
		AppComponent,
		ToolbarComponent,
		SettingsInfoBoxComponent,
		ConstructionBoxComponent,
		ConstructionBoxCategoryComponent,
		WorkAreaComponent,
		TopBarComponent,
		FileDropdownComponent,
		EditDropdownComponent,
		ViewDropdownComponent,
		HelpDropdownComponent,
		SettingsDropdownComponent,
		ShortcutTextPipe,
		SingleShortcutConfigComponent,
		ShortcutConfigComponent,
		WindowWorkAreaComponent,
		ReloadQuestionComponent,
		NewComponentComponent,
		OpenProjectComponent,
		SaveAsComponent,
		OutsideNgZoneEventDirective,
		UnsavedChangesComponent,
		WorkAreaContainerComponent,
		ShareProjectComponent,
		SiPipe,
		ToolbarItemTooltipDirective,
		ToolbarItemTooltipComponent,
		TextComponent,
		ToolbarItemTooltipComponent,
		StatusBarComponent,
		RomEditComponent
	],
	entryComponents: [
		ShortcutConfigComponent,
		ReloadQuestionComponent,
		NewComponentComponent,
		OpenProjectComponent,
		SaveAsComponent,
		UnsavedChangesComponent,
		ShareProjectComponent,
		TextComponent,
		ToolbarItemTooltipComponent,
		RomEditComponent
	],
	imports: [
		// #!electron
		NgxElectronModule,
		BrowserModule,
		FormsModule,
		HttpClientModule,
		ReactiveFormsModule,
		BrowserAnimationsModule,
		ToastContainerModule,
		ToastrModule.forRoot({
			positionClass: 'toastr-position',
			easeTime: 100,
			timeOut: 5000,
			tapToDismiss: true
		}),
		TranslateModule.forRoot({
			loader: {
				provide: TranslateLoader,
				useClass: CacheBustingTranslationLoader,
			},
			missingTranslationHandler: {
				provide: MissingTranslationHandler,
				useClass: AppMissingTranslationHandler
			}
		}),
		LogigatorSharedCompsModule.forRoot({
			themingService: {
				provide: SharedCompsThemingService,
				useExisting: ThemingService
			},
			authService: {
				provide: SharedCompsAuthService,
				useExisting: UserService
			}
		})
	],
	providers: [
		{
			provide: HTTP_INTERCEPTORS,
			useClass: CredentialsInterceptor,
			multi: true
		},
		// #!if ELECTRON === 'false'
		{
			provide: WorkerCommunicationService,
			useClass: WorkerCommunicationWasmService
		},
		// #!endif
		// #!if ELECTRON === 'true'
		{
			provide: WorkerCommunicationService,
			useClass: WorkerCommunicationNodeService
		}
		// #!endif
	],
	bootstrap: [AppComponent]
})
export class AppModule {
	constructor(private injector: Injector) {
		setStaticDIInjector(injector);
	}
}
