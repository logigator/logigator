import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

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
import { PopupComponent } from './components/popup/popup/popup.component';
import { SingleShortcutConfigComponent } from './components/popup/popup-contents/shortcut-config/single-shortcut-config/single-shortcut-config.component';
import { ShortcutConfigComponent } from './components/popup/popup-contents/shortcut-config/shortcut-config/shortcut-config.component';
import { WindowWorkAreaComponent } from './components/window-work-area/window-work-area.component';
import {HttpClientModule} from '@angular/common/http';
import { ReloadQuestionComponent } from './components/popup/popup-contents/relaod-question/reload-question.component';

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
		PopupComponent,
		SingleShortcutConfigComponent,
		ShortcutConfigComponent,
		PopupComponent,
		WindowWorkAreaComponent,
		ReloadQuestionComponent
	],
	entryComponents: [
		PopupComponent,
		ShortcutConfigComponent,
		ReloadQuestionComponent
	],
	imports: [
		BrowserModule,
		FormsModule,
		HttpClientModule,
		ReactiveFormsModule
	],
	providers: [],
	bootstrap: [AppComponent]
})
export class AppModule { }
