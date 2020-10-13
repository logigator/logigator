document.addEventListener('DOMContentLoaded', function () {
	document.getElementById('compatibility-warning').style.display = 'block';
	if (!window) return;

	var el = document.createElement('div');

	if(window.Worker &&
		typeof WebAssembly === "object" &&
		typeof WebAssembly.instantiate === "function" &&
		typeof el.style.grid === 'string' &&
		(window.WebGLRenderingContext || window.WebGL2RenderingContext)
	) {
		document.getElementById('compatibility-warning').style.display = 'none';
	}

	if(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
		document.getElementById('compatibility-warning').style.display = 'block';
		document.getElementById('compatibility-warning-text1').innerText = 'Unfortunately, mobile support is not yet implemented.';
		document.getElementById('compatibility-warning-text2').innerText = 'Try using a desktop for the best experience.';
	}
});
