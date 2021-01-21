import {getStaticDI} from './app/models/get-di';
import {ShortcutsService} from './app/services/shortcuts/shortcuts.service';
import {environment} from './environments/environment';

window.addEventListener('error', event => {
	if (event instanceof ErrorEvent) {
		try {
			getStaticDI(ShortcutsService).disableShortcutListener();
		} finally {
			displayErrorPopup(event.error.message, event.error.stack);
		}
	}
});


function displayErrorPopup(message: string, stack: string) {
	const theme = document.body.classList.contains('theme-dark') ? 'dark' : 'light';
	const template = `
		<div class="global-error-popup">
			<div class="global-error-popup-content">
				<div class="global-error-popup-header">
					<div>A critical Error occurred!</div>
					<img src="assets/icons/${theme}/close.svg" class="global-error-popup-close" />
				</div>
				<div class="global-error-popup-body">
					<p class="global-error-popup-message">${message}</p>
					<pre class="global-error-popup-stack">${stack}</pre>
					<label>To help us identify the problem, please describe what you where doing when the error occurred.</label>
					<textarea class="global-error-popup-textarea"></textarea>
					<button class="btn-raised primary global-error-popup-send">Send Error Information</button>
				</div>
			</div>
		</div>
	`;

	const div = document.createElement('div');
	div.innerHTML = template;

	const popupElem = div.firstElementChild;
	document.body.insertAdjacentElement('beforeend', popupElem);

	popupElem.querySelector('.global-error-popup-close').addEventListener('click', () => {
		sendErrorReport();
	});

	popupElem.querySelector('.global-error-popup-send').addEventListener('click', () => {
		const userMessage = (popupElem.querySelector('.global-error-popup-textarea') as HTMLTextAreaElement).value;
		sendErrorReport(userMessage);
	});

	async function sendErrorReport(userMessage?: string) {
		await fetch(environment.api + '/report-error', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({message, stack, userMessage})
		});

		popupElem.remove();
		try {
			getStaticDI(ShortcutsService).enableShortcutListener();
		} catch {}
	}
}
