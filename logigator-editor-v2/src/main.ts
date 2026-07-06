import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, appConfig).catch((err) => {
  // The Angular app never came up, so the runtime GlobalErrorHandler and
  // ToastService are unavailable. Log the full error and show a bare DOM
  // banner so the user isn't left staring at a blank page.
  // eslint-disable-next-line no-console
  console.error('[bootstrap] failed to start the editor', err);
  showBootstrapFailureBanner();
});

function showBootstrapFailureBanner(): void {
  const banner = document.createElement('div');
  banner.setAttribute('role', 'alert');
  banner.style.cssText = [
    'position:fixed',
    'inset:0',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'padding:2rem',
    'font-family:system-ui,sans-serif',
    'text-align:center',
    'background:#1a1a1a',
    'color:#f5f5f5',
    'z-index:2147483647'
  ].join(';');
  banner.innerHTML =
    '<div><h1 style="font-size:1.25rem;margin:0 0 .5rem">The editor failed to load</h1>' +
    '<p style="margin:0;opacity:.8">Please reload the page. If the problem persists, ' +
    'check your browser console for details.</p></div>';
  document.body.appendChild(banner);
}
