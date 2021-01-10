"use strict";function asyncGeneratorStep(e,n,t,r,a,i,o){try{var c=e[i](o),d=c.value}catch(u){return void t(u)}c.done?n(d):Promise.resolve(d).then(r,a)}function _asyncToGenerator(e){return function(){var n=this,t=arguments;return new Promise((function(r,a){var i=e.apply(n,t);function o(e){asyncGeneratorStep(i,r,a,o,c,"next",e)}function c(e){asyncGeneratorStep(i,r,a,o,c,"throw",e)}o(void 0)}))}}function imageChangeHandling(){var e,n,t;function r(e){var t=new FileReader;t.readAsDataURL(e),t.onload=function(e){n.replace(e.target.result)}}document.addEventListener("popup-opened",(function(a){var i=a.detail.querySelector(".partial-change-image-popup");i&&(e||(e=i,function(){var a=Bem.element(e,"file"),i=Bem.element(e,"upload-container");function o(e,n){e.preventDefault(),e.stopPropagation(),Bem.setState(i,"dragging",n)}i.addEventListener("click",(function(){return a.click()})),i.addEventListener("dragstart",(function(e){return o(e,!0)})),i.addEventListener("dragenter",(function(e){return o(e,!0)})),i.addEventListener("dragover",(function(e){return o(e,!0)})),i.addEventListener("dragend",(function(e){return o(e,!1)})),i.addEventListener("dragexit",(function(e){return o(e,!1)})),i.addEventListener("dragleave",(function(e){return o(e,!1)})),i.addEventListener("drop",(function(e){e.preventDefault(),e.stopPropagation(),Bem.setState(i,"dragging",!1),e.dataTransfer.files&&r(e.dataTransfer.files[0])})),a.addEventListener("change",(function(e){e.target.files&&e.target.files.length>0&&r(e.target.files[0])})),t=Bem.element(e,"img").src,n=new Cropper(Bem.element(e,"img"),{aspectRatio:1,zoomable:!1,toggleDragModeOnDblclick:!1,dragMode:"none"});var c=!1;Bem.element(e,"save").addEventListener("click",(function(){c||(c=!0,n.getCroppedCanvas({imageSmoothingEnabled:!0,imageSmoothingQuality:"high",width:256,height:256}).toBlob(function(){var n=_asyncToGenerator(regeneratorRuntime.mark((function n(t){var r;return regeneratorRuntime.wrap((function(n){for(;;)switch(n.prev=n.next){case 0:return(r=new FormData).append("image",t),n.next=4,fetch("/my/account/profile/update-image",{method:"POST",body:r});case 4:n.sent.ok?location.reload():Bem.setState(Bem.element(e,"save-error"),"show",!0);case 6:case"end":return n.stop()}}),n)})));return function(e){return n.apply(this,arguments)}}(),"image/png"))}))}()),t&&n.replace(t))}))}imageChangeHandling();
//# sourceMappingURL=my-account-profile-es5.js.map
