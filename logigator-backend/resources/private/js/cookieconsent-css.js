// Standalone consent bundle only: the server-rendered pages ship the banner
// styles inside the layout css, while the editor loads the bundle directly —
// so the bundle pulls in its matching stylesheet itself.

(function () {
	var link = document.createElement('link');
	link.rel = 'stylesheet';
	link.href = '/css/cookieconsent.css';
	document.head.appendChild(link);
})();
