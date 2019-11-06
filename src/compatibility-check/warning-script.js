(function () {
	if (!window) return;

	var el = document.createElement('div');
	var supports_grid = typeof el.style.grid === 'string';

	if(!window.Worker ||
		typeof WebAssembly !== "object" ||
		typeof WebAssembly.instantiate !== "function" ||
		!supports_grid ||
		!window.WebGL2RenderingContext ||
		/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
	) {
		document.getElementById('compatibility-warning').style.display = 'flex';
		var closeButtons = document.getElementsByClassName('comp-warning-close');
		for (var i = 0; i < closeButtons.length; i++) {
			closeButtons[i].addEventListener('click', function () {
				document.getElementById('compatibility-warning').style.display = 'none';
			});
		}
	}
})();
