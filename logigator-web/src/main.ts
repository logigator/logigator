import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig).catch((err: unknown) => {
  // Before the app exists there is no logging service and no toast surface;
  // the console is the only place a bootstrap failure can be reported.
  // eslint-disable-next-line no-console
  console.error(err);
});
