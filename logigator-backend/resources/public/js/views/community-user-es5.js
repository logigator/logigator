"use strict";function asyncGeneratorStep(e,t,n,r,o,a,i){try{var c=e[a](i),u=c.value}catch(s){return void n(s)}c.done?t(u):Promise.resolve(u).then(r,o)}function _asyncToGenerator(e){return function(){var t=this,n=arguments;return new Promise((function(r,o){var a=e.apply(t,n);function i(e){asyncGeneratorStep(a,r,o,i,c,"next",e)}function c(e){asyncGeneratorStep(a,r,o,i,c,"throw",e)}i(void 0)}))}}function communityUser(){var e,t=document.querySelector(".view-community-user").getAttribute("data-type"),n=document.querySelector(".view-community-user").getAttribute("data-user"),r=document.querySelector(".view-community-user__list"),o=document.querySelectorAll(".view-community-user__page-button"),a=[0,0,0,0,0,0,0];function i(){var t,n,r=document.querySelector(".partial-community-user-list"),i=Number(Bem.data(r,"total-pages"));e=Number(Bem.data(r,"current-page")),a[0]=e>0?0:void 0,a[1]=e>0?e-1:void 0,a[2]=void 0,a[3]=void 0,a[4]=void 0,0===e?(t=0,n=i>3?3:i-1):e===i-1?(t=Math.max(i-3,0),n=i-1):(t=e-1,n=e+1);for(var c=t,u=2;c<=n;c++,u++)a[u]=c;a[5]=e<i-1?e+1:void 0,a[6]=e<i-1?i-1:void 0,o.forEach((function(t,n){n<=1||n>=5?t.disabled=void 0===a[n]:(Bem.setState(t,"hidden",void 0===a[n]),Bem.setState(t,"active",a[n]===e),t.innerHTML=a[n]+1)}))}function c(){return(c=_asyncToGenerator(regeneratorRuntime.mark((function e(o){var a,c,u;return regeneratorRuntime.wrap((function(e){for(;;)switch(e.prev=e.next){case 0:return a=new URLSearchParams({page:o,tab:t}).toString(),e.next=4,fetch("/community/user/".concat(n,"?").concat(a));case 4:return c=e.sent,e.next=7,c.text();case 7:r.innerHTML=e.sent,u=[location.protocol,"//",location.host,location.pathname].join(""),window.history.pushState({},"",u+"?"+a),i();case 11:case"end":return e.stop()}}),e)})))).apply(this,arguments)}i(),o.forEach((function(e,t){e.addEventListener("click",(function(){void 0===a[t]||Bem.hasState(e,"active")||function(e){c.apply(this,arguments)}(a[t])}))}))}communityUser();
//# sourceMappingURL=community-user-es5.js.map
