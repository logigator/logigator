// @ts-strict-ignore
import { getStaticDI } from './app/models/get-di';
import { ShortcutsService } from './app/services/shortcuts/shortcuts.service';
import { environment } from './environments/environment';
import { ProjectSaveManagementService } from './app/services/project-save-management/project-save-management.service';
import { ProjectsService } from './app/services/projects/projects.service';
import { ProjectLocalFile } from './app/models/project-local-file';

let active = false;

window.addEventListener('error', (event) => {
	if (event instanceof ErrorEvent && !active) {
		try {
			getStaticDI(ShortcutsService).disableShortcutListener();
		} finally {
			active = true;
			displayErrorPopup(event);
		}
	}
});

function displayErrorPopup(event: ErrorEvent) {
	const theme = document.body.classList.contains('theme-dark')
		? 'dark'
		: 'light';

	const trace =
		event.error?.stack
			?.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;') ?? 'Stack trace not available.';

	const template = `
		<div class="global-error-popup">
			<div class="global-error-popup-content">
				<div class="global-error-popup-header">
					<div>A critical Error occurred!</div>
					<img src="assets/icons/${theme}/close.svg" alt="close" class="global-error-popup-close" />
				</div>
				<div class="global-error-popup-body">
					<p class="global-error-popup-message">${
						event.message ?? 'Message not available.'
					}</p>
					<pre class="global-error-popup-stack">${trace}</pre>
					<label>To help us identify the problem, please describe what you where doing when the error occurred.</label>
					<textarea class="global-error-popup-textarea" maxlength="512"></textarea>
					<button class="btn-raised primary global-error-popup-send">Send Error Information</button>
				</div>
			</div>
		</div>
	`;

	const div = document.createElement('div');
	div.innerHTML = template;

	const popupElem = div.firstElementChild;
	document.body.insertAdjacentElement('beforeend', popupElem);

	popupElem
		.querySelector('.global-error-popup-close')
		.addEventListener('click', () => {
			popupElem.remove();
			try {
				getStaticDI(ShortcutsService).enableShortcutListener();
			} catch (e) {
				console.error(e);
			}
			active = false;
		});

	popupElem
		.querySelector('.global-error-popup-send')
		.addEventListener('click', async (mEvent: MouseEvent) => {
			(mEvent.target as HTMLButtonElement).disabled = true;
			const userMessage = (
				popupElem.querySelector(
					'.global-error-popup-textarea'
				) as HTMLTextAreaElement
			).value;
			await sendErrorReport(userMessage);

			popupElem.remove();
			try {
				getStaticDI(ShortcutsService).enableShortcutListener();
			} catch (e) {
				console.error(e);
			}
			active = false;
		});

	async function sendErrorReport(userMessage?: string) {
		let projectData: ProjectLocalFile;
		try {
			const projectsService = getStaticDI(ProjectsService);
			const projectSaveManagementService = getStaticDI(
				ProjectSaveManagementService
			);
			projectData = await projectSaveManagementService.generateFileToExport(
				projectsService.mainProject
			);
		} catch (e) {
			console.error(e);
		}

		await fetch(environment.api + '/report-error', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				...(event.lineno && { line: event.lineno }),
				...(event.colno && { col: event.colno }),
				...(event.filename && { file: event.filename }),
				...(event.message && { message: event.message }),
				...(event.error?.stack && { stack: event.error.stack }),
				...(projectData && { project: projectData }),
				...(userMessage && { userMessage })
			})
		});
	}
}
