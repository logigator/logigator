import {getStaticDI} from './app/models/get-di';
import {ShortcutsService} from './app/services/shortcuts/shortcuts.service';

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
		popupElem.remove();
		try {
			getStaticDI(ShortcutsService).enableShortcutListener();
		} catch {}
	});

	popupElem.querySelector('.global-error-popup-send').addEventListener('click', () => {
		const userMsg = (popupElem.querySelector('.global-error-popup-textarea') as HTMLTextAreaElement).value;
		console.log(userMsg, message, stack);
		// TODO: send to server

		popupElem.remove();
		try {
			getStaticDI(ShortcutsService).enableShortcutListener();
		} catch {}
	});
}
