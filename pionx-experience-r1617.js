/* Shared modal and media behaviour. No provider calls or private state in this module. */
(() => {
 'use strict';
 const ar=()=>document.documentElement.lang==='ar',t=(en,arabic)=>ar()?arabic:en;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let returnFocus=null,locked=false,previousOverflow='';
 document.addEventListener('focusin',event=>{const modal=document.getElementById('demoDialog');if(!locked&&!modal?.contains(event.target))returnFocus=event.target;});
 function modalState(){
  const modal=document.getElementById('demoDialog');if(!modal)return;
  if(modal.parentElement!==document.body)document.body.append(modal);
  if(!modal.hidden&&!locked){locked=true;if(!modal.contains(document.activeElement))returnFocus=document.activeElement;previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';document.getElementById('appShell')?.setAttribute('inert','');}
  if(modal.hidden&&locked){locked=false;document.body.style.overflow=previousOverflow;document.getElementById('appShell')?.removeAttribute('inert');if(returnFocus?.isConnected&&!modal.contains(returnFocus))returnFocus.focus({preventScroll:true});returnFocus=null;}
 }
 function mediaMarkup(src,poster,card=false){return `<div class="px-film17${card?' px-film-card17':''}"><video data-film17 data-src="${src}" ${card?'data-preview17':''} muted playsinline loop preload="none" poster="${poster}" aria-label="${t('Architectural film preview','معاينة فيلم معماري')}"></video><div class="px-film-shade17"></div><span class="px-film-caption17">PIONX / ${t('ARCHITECTURAL FILM','فيلم معماري')}</span><button type="button" class="px-film-toggle17" data-film-toggle17 aria-label="${t('Play architectural film','تشغيل الفيلم المعماري')}">▶</button></div>`;}
 window.PIONXMedia17={markup:mediaMarkup};
 function mediaHydrate(){
  const visual=document.querySelector('.px-home-visual1616');if(visual&&!visual.dataset.film17){visual.dataset.film17='true';visual.innerHTML=mediaMarkup('assets/media-r1617/pionx-architecture-film.mp4','assets/media-r1617/film-poster.jpg');}
  const hero=document.querySelector('#publicSite .mnml-hero-wrap');
  if(hero&&!hero.querySelector('.px-public-film17')){const wrapper=document.createElement('div');wrapper.className='px-public-film17';wrapper.innerHTML=mediaMarkup('assets/media-r1617/pionx-architecture-film.mp4','assets/media-r1617/film-poster.jpg');hero.querySelector('.mnml-hero-actions')?.after(wrapper);}
  for(const card of document.querySelectorAll('a.px-tool-card1616[href="#video"],a.px-tool-card1616[href="#film"]')){
   const article=document.createElement('article');for(const attribute of [...card.attributes])if(attribute.name!=='href')article.setAttribute(attribute.name,attribute.value);
   const link=document.createElement('a');link.className='px-card-link17';link.href=card.getAttribute('href');const footer=card.lastElementChild;link.append(...footer.childNodes);footer.remove();
   while(card.firstChild)article.append(card.firstChild);const preview=document.createElement('div');preview.innerHTML=mediaMarkup('assets/media-r1617/pionx-motion-preview.mp4','assets/media-r1617/motion-poster.jpg',true);article.prepend(preview.firstElementChild);article.append(link);card.replaceWith(article);
  }
  for(const video of document.querySelectorAll('video[data-film17]')){
   if(video.dataset.bound17)continue;video.dataset.bound17='true';video.muted=true;const button=video.parentElement.querySelector('[data-film-toggle17]');let pausedByUser=false;
   const label=()=>{button.textContent=video.paused?'▶':'Ⅱ';button.setAttribute('aria-label',video.paused?t('Play architectural film','تشغيل الفيلم المعماري'):t('Pause architectural film','إيقاف الفيلم المعماري'));};
   const play=()=>{if(!video.getAttribute('src'))video.src=video.dataset.src;video.play().then(label).catch(label);};
   button.onclick=event=>{event.preventDefault();event.stopPropagation();if(video.paused){pausedByUser=false;play();}else{pausedByUser=true;video.pause();label();}};
   video.addEventListener('pause',label);video.addEventListener('play',label);video.addEventListener('error',()=>{video.pause();button.textContent='▶';button.disabled=true;button.setAttribute('aria-label',t('Film unavailable; showing the still preview','الفيلم غير متاح؛ تظهر المعاينة الثابتة'));});
   const autoplay=()=>!reduced.matches&&!navigator.connection?.saveData&&matchMedia('(min-width:761px)').matches;
   if(video.hasAttribute('data-preview17')){video.parentElement.addEventListener('pointerenter',()=>{if(autoplay()&&!pausedByUser)play();});video.parentElement.addEventListener('pointerleave',()=>video.pause());}
   else if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting&&autoplay()&&!pausedByUser)play();else video.pause();}},{threshold:.25});observer.observe(video);}
   else if(autoplay())play();
   label();
  }
 }
 let scheduled=false;function hydrate(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;modalState();mediaHydrate();});}
 function start(){new MutationObserver(hydrate).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});hydrate();}
 reduced.addEventListener?.('change',()=>{if(reduced.matches)document.querySelectorAll('video[data-film17]').forEach(v=>v.pause());});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)document.querySelectorAll('video[data-film17]').forEach(v=>v.pause());});
 window.addEventListener('pionx:language',hydrate);window.addEventListener('pagehide',()=>document.querySelectorAll('video[data-film17]').forEach(v=>v.pause()));
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
