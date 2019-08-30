import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';
import { ToolbarComponent } from './components/toolbar/toolbar.component';
import { SettingsInfoBoxComponent } from './components/settings-info-box/settings-info-box.component';
import { ContructionBoxComponent } from './components/contruction-box/contruction-box.component';
import { AllWorkAreasComponent } from './components/work-area/all-work-areas/all-work-areas.component';
import { WorkAreaComponent } from './components/work-area/work-area/work-area.component';

@NgModule({
	declarations: [
		AppComponent,
		ToolbarComponent,
		SettingsInfoBoxComponent,
		ContructionBoxComponent,
		AllWorkAreasComponent,
		WorkAreaComponent
	],
	imports: [
		BrowserModule
	],
	providers: [],
	bootstrap: [AppComponent]
})
export class AppModule { }
