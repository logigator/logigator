"use strict";function imageChangeHandling(){let e,t,a;function n(e){const a=new FileReader;a.readAsDataURL(e),a.onload=e=>{t.replace(e.target.result)}}document.addEventListener("popup-opened",i=>{const r=i.detail.querySelector(".partial-change-image-popup");r&&(e||(e=r,function(){const i=Bem.element(e,"file"),r=Bem.element(e,"upload-container");function d(e,t){e.preventDefault(),e.stopPropagation(),Bem.setState(r,"dragging",t)}r.addEventListener("click",()=>i.click()),r.addEventListener("dragstart",e=>d(e,!0)),r.addEventListener("dragenter",e=>d(e,!0)),r.addEventListener("dragover",e=>d(e,!0)),r.addEventListener("dragend",e=>d(e,!1)),r.addEventListener("dragexit",e=>d(e,!1)),r.addEventListener("dragleave",e=>d(e,!1)),r.addEventListener("drop",e=>{e.preventDefault(),e.stopPropagation(),Bem.setState(r,"dragging",!1),e.dataTransfer.files&&n(e.dataTransfer.files[0])}),i.addEventListener("change",e=>{e.target.files&&e.target.files.length>0&&n(e.target.files[0])}),a=Bem.element(e,"img").src,t=new Cropper(Bem.element(e,"img"),{aspectRatio:1});let o=!1;Bem.element(e,"save").addEventListener("click",()=>{o||(o=!0,t.getCroppedCanvas({imageSmoothingEnabled:!0,imageSmoothingQuality:"high",width:256,height:256}).toBlob(async e=>{const t=new FormData;t.append("image",e),await fetch("/my/account/profile/update-image",{method:"POST",redirect:"follow",body:t}),location.reload()}))})}()),a&&t.replace(a))})}imageChangeHandling();
//# sourceMappingURL=my-account-profile-es2015.js.map
