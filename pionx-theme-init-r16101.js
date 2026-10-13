'use strict';
(function(){
  // Restore a protected destination before either the landing or workspace can paint.
  const protectedPages=new Set(['home','assistant','billing','voiceadmin','studio','consistency','flow','video','film','presentation','projects','renders','albums','assets','explore','portfolio','profile','settings','plans','admin','finance','diagnostics','sitecontent','tools']);
  const requested=(location.hash||'').slice(1).split('?')[0];
  let returning=false;try{returning=localStorage.getItem('pionx_session_hint')==='1';}catch{}
  if(protectedPages.has(requested)||returning){
    document.documentElement.setAttribute('data-px-route-boot','pending');
    window.PIONXRouteBoot1616={requested:protectedPages.has(requested)?requested:'home'};
  }
  try{
    const stored=localStorage.getItem('pionx-theme')||localStorage.getItem('pionx_theme');
    const theme=stored==='dark'?'dark':'light';
    document.documentElement.setAttribute('data-theme',theme);
    const meta=document.querySelector('meta[name=\"theme-color\"]');
    if(meta) meta.setAttribute('content',theme==='light'?'#ffffff':'#060911');
  }catch(_){
    document.documentElement.setAttribute('data-theme','light');
  }
})();
