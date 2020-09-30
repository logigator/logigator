"use strict";function siteHeaderPartial(e){const t=e.querySelector(".partial-settings-dropdown"),n=Bem.element(e,"dropdown-background");let r=!1;Bem.element(e,"dropdown-trigger").addEventListener("click",()=>{r=!r,Bem.setState(t,"open",r),Bem.setState(n,"shown",r)}),n.addEventListener("click",()=>{r=!1,Bem.setState(t,"open",r),Bem.setState(n,"shown",r)}),Bem.element(e,"burger-menu").addEventListener("click",()=>setBurgerMenuState())}function popupPartial(e){let t=Bem.hasState(e,"open");const n=Bem.data(e,"triggers");if(n){n.split("::").forEach(n=>{document.querySelector(n).addEventListener("click",()=>{t||(Bem.setState(e,"open",!0),t=!0)})})}Bem.elements(e,"close").forEach(n=>{n.addEventListener("click",()=>{Bem.setState(e,"open",!1),t=!1})})}function burgerMenuBackgroundElement(e){e.addEventListener("click",()=>setBurgerMenuState(!1))}function formValidationForGlobalForms(e){e.querySelector('button[type="submit"]')&&startFormValidation(e)}window.Bem={bemClass(e){if(1===e.classList.length)return e.classList[0];for(let t=0;t<e.classList.length;t++)if(!e.classList[t].includes("--"))return e.classList[t]},element(e,t){const n=Bem.bemClass(e);return e.querySelector(".".concat(n,"__").concat(t))},elements(e,t){const n=Bem.bemClass(e);return e.querySelectorAll(".".concat(n,"__").concat(t))},setState(e,t,n){n?e.classList.add("is-".concat(t)):e.classList.remove("is-".concat(t))},hasState:(e,t)=>e.classList.contains("is-".concat(t)),toggleState(e,t){e.classList.toggle("is-".concat(t))},hasModifier(e,t){const n=Bem.bemClass(e);return e.classList.contains("".concat(n,"--").concat(t))},data:(e,t)=>e.getAttribute("data-".concat(t)),hasData:(e,t)=>e.hasAttribute("data-".concat(t))},window.setBurgerMenuState=function(e){const t=document.querySelector(".partial-burger-menu"),n=document.querySelector(".partial-burger-menu__background");void 0!==e?(Bem.setState(t,"open",e),Bem.setState(n,"open",e)):(e=!Bem.hasState(t,"open"),Bem.setState(t,"open",e),Bem.setState(n,"open",e))},window.debounceFunction=function(e,t){let n;return function(){const r=this,o=arguments,a=function(){n=null,e.apply(r,o)};clearTimeout(n),n=setTimeout(a,t)}},window.startFormValidation=function(e){const t={isNotEmpty:e=>null!=e&&""!==e,minLength:(e,t)=>e&&e.length>=Number(t),maxLength:(e,t)=>e&&e.length<=Number(t)},n=e.querySelector('button[type="submit"]'),r=e.elements,o=function(e){const t=[];for(const n of e){if(n instanceof HTMLButtonElement)continue;const e={formContainer:n.closest("div[form-container]"),element:n,touched:!1,valid:!1,errors:[]},r=e.formContainer.querySelector("div[form-errors]").children;for(const t of r)e.errors.push({errorName:t.getAttribute("data-error"),valData:t.getAttribute("data-val-data"),errorMessage:t});t.push(e)}return t}(r);for(const e of o)a(e),e.element.addEventListener("input",()=>{e.touched=!0,a(e)});function a(e){e.valid=!0,e.errors.forEach(n=>{const o=!t[n.errorName]||t[n.errorName](e.element.value,n.valData,r);o||(e.valid=!1),Bem.setState(n.errorMessage,"shown",!o&&e.touched)}),Bem.setState(e.formContainer,"invalid",!e.valid&&e.touched),n.disabled=!o.every(e=>e.valid)}},window.openDynamicPopup=async function(e,t){const n=await fetch(e);t.innerHTML=await n.text(),function e(){const n=t.querySelector(".partial-popup");Bem.elements(n,"close").forEach(e=>{e.addEventListener("click",()=>{for(;t.firstChild;)t.removeChild(t.lastChild)})});const r=n.querySelector("form");if(!r)return;r.addEventListener("submit",async n=>{n.preventDefault();let o=r.action;n.submitter.hasAttribute("formaction")&&(o=n.submitter.getAttribute("formaction"));const a=await fetch(o,{method:r.method,headers:{"Content-Type":"application/x-www-form-urlencoded"},redirect:"follow",body:new URLSearchParams(new FormData(r))});a.redirected?(t.innerHTML=await a.text(),e()):location.reload()})}()},siteHeaderPartial(document.querySelector(".partial-site-header")),document.querySelectorAll(".partial-popup").forEach(e=>popupPartial(e)),burgerMenuBackgroundElement(document.querySelector(".partial-burger-menu__background")),document.querySelectorAll("form").forEach(e=>formValidationForGlobalForms(e));
//# sourceMappingURL=global-es2015.js.map
