import { BrowserModule } from '@angular/platform-browser';
import { Injector, NgModule } from '@angular/core';
import { AppComponent } from './app.component';
import { ToolbarComponent } from './components/toolbar/toolbar.component';
import { SettingsInfoBoxComponent } from './components/settings-info-box/settings-info-box.component';
import { ConstructionBoxComponent } from './components/construction-box/construction-box.component';
import { WorkAreaComponent } from './components/work-area/work-area.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ConstructionBoxCategoryComponent } from './components/construction-box-category/construction-box-category.component';
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
import { HttpClientModule } from '@angular/common/http';
import { ReloadQuestionComponent } from './components/popup-contents/reload-question/reload-question.component';
import { NewComponentComponent } from './components/popup-contents/new-component/new-component.component';
import { OpenProjectComponent } from './components/popup-contents/open/open-project.component';
import { SaveAsComponent } from './components/popup-contents/save-as/save-as.component';
import { ToastContainerDirective, ToastrModule } from 'ngx-toastr';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import {
	MissingTranslationHandler,
	TranslateLoader,
	TranslateModule
} from '@ngx-translate/core';
import { CacheBustingTranslationLoader } from './models/translation/cache-busting-translate-loader';
import { AppMissingTranslationHandler } from './models/translation/missing-translation-handler';
import { OutsideNgZoneEventDirective } from './directives/outside-ng-zone-event/outside-ng-zone-event.directive';
import { UnsavedChangesComponent } from './components/popup-contents/unsaved-changes/unsaved-changes.component';
import { WorkAreaContainerComponent } from './components/work-area-container/work-area-container.component';
import { ShareProjectComponent } from './components/popup-contents/share-project/share-project.component';
import { setStaticDIInjector } from './models/get-di';
import { ToolbarItemTooltipDirective } from './directives/toolbar-item-tooltip/toolbar-item-tooltip.directive';
import { ToolbarItemTooltipComponent } from './components/toolbar-item-tooltip/toolbar-item-tooltip.component';
import { TextComponent } from './components/popup-contents/text/text.component';
import { StatusBarComponent } from './components/status-bar/status-bar.component';
import { RomEditComponent } from './components/popup-contents/rom-edit/rom-edit.component';
import { WorkerCommunicationService } from './services/simulation/worker-communication/worker-communication-service-model';
import { WorkerCommunicationWasmService } from './services/simulation/worker-communication/worker-communication-wasm.service';
import { HelpComponent } from './components/popup-contents/help/help.component';
import { TutorialWindowComponent } from './components/tutorial-window/tutorial-window.component';
import { SwitchComponent } from './components/switch/switch.component';
import { PopupComponent } from './components/popup/popup.component';
import { InputComponent } from './components/input/input.component';
import { InputErrorComponent } from './components/input-error/input-error.component';
import { FileInputComponent } from './components/file-input/file-input.component';
import { SiPipe } from './pipes/si/si.pipe';
import { RomViewComponent } from './components/element-inspection/rom-view/rom-view.component';
import { HexBinDecConverterComponent } from './components/popup-contents/hex-bin-dec-converter/hex-bin-dec-converter.component';
import { StorageService } from './services/storage/storage.service';
import { CookieStorageService } from './services/storage/cookie-storage.service';
import { EditComponentPlugsComponent } from './components/popup-contents/edit-component-plugs/edit-component-plugs.component';
import { LoadingSymbolComponent } from './components/loading-symbol/loading-symbol.component';
import { ImageExportComponent } from './components/popup-contents/image-export/image-export.component';
import { AutoFontSizeDirective } from './directives/auto-font-size/auto-font-size.directive';
import { MarkdownModule } from 'ngx-markdown';

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
		ToolbarItemTooltipDirective,
		ToolbarItemTooltipComponent,
		TextComponent,
		ToolbarItemTooltipComponent,
		StatusBarComponent,
		RomEditComponent,
		RomViewComponent,
		HelpComponent,
		TutorialWindowComponent,
		SwitchComponent,
		PopupComponent,
		InputComponent,
		InputErrorComponent,
		FileInputComponent,
		SiPipe,
		HexBinDecConverterComponent,
		EditComponentPlugsComponent,
		LoadingSymbolComponent,
		ImageExportComponent,
		AutoFontSizeDirective
	],
	imports: [
		BrowserModule,
		FormsModule,
		MarkdownModule.forRoot(),
		HttpClientModule,
		ReactiveFormsModule,
		BrowserAnimationsModule,
		ToastContainerDirective,
		ToastrModule.forRoot({
			positionClass: 'toastr-position',
			easeTime: 100,
			timeOut: 5000,
			tapToDismiss: true
		}),
		TranslateModule.forRoot({
			loader: {
				provide: TranslateLoader,
				useClass: CacheBustingTranslationLoader
			},
			missingTranslationHandler: {
				provide: MissingTranslationHandler,
				useClass: AppMissingTranslationHandler
			}
		})
	],
	providers: [
		{
			provide: WorkerCommunicationService,
			useClass: WorkerCommunicationWasmService
		},
		{
			provide: StorageService,
			useClass: CookieStorageService
		}
	],
	bootstrap: [AppComponent]
})
export class AppModule {
	constructor(private injector: Injector) {
		setStaticDIInjector(injector);
	}
}
