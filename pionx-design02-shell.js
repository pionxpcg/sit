/* Design 02 shell: navigation only; the original route renderers retain every tool. */
(() => {
  'use strict';
  const app = document.getElementById('appShell');
  const view = document.getElementById('viewRoot');
  if (!app || !view) return;
  const groups = [
    ['Workspace','مساحة العمل',[
      ['home','Workspace','مساحة العمل','home'],['assistant','Talk to PIONX','تحدث مع PIONX','chat'],
      ['studio','Image Studio','استوديو الصور','image'],['video','Video Studio','استوديو الفيديو','video'],
      ['projects','Projects','المشاريع','project'],['renders','Renders','النتائج','image'],['tools','All tools','كل الأدوات','tools']
    ]],
    ['Library','المكتبة',[
      ['assets','Assets & references','الصور والمراجع','tools'],['albums','Albums','الألبومات','project'],
      ['flow','Flow boards','لوحات الأفكار','flow'],['consistency','Visual DNA','اتساق الصور','layers']
    ],false,true],
    ['Share & deliver','مشاركة وتسليم',[
      ['film','PIONX Film','فيلم المشروع','film'],['presentation','Presentations','العروض التقديمية','deck'],
      ['portfolio','Portfolio','ملف الأعمال','image'],['explore','Community','المجتمع','people']
    ],false,true],
    ['Account','الحساب',[
      ['profile','Profile','الملف الشخصي','people'],['billing','Billing & membership','المدفوعات والاشتراك','project'],['settings','Settings','الإعدادات','settings'],['plans','Plans & credits','الخطط والرصيد','project']
    ],false,true],
    ['Administration','الإدارة',[
      ['admin','Users & permissions','المستخدمون والصلاحيات','people'],['finance','Finance & operations','المالية والعمليات','project'],
      ['voiceadmin','Conversation settings','إعدادات المحادثة','chat'],['diagnostics','System diagnostics','فحص النظام','settings'],['sitecontent','Public site content','محتوى الموقع','deck']
    ],true,true]
  ];
  const aside = document.createElement('aside');
  aside.id = 'pionxDesignSidebar';
  aside.className = 'd02-sidebar';
  aside.setAttribute('aria-label', 'Workspace navigation');
  aside.innerHTML = '<a class="d02-brand" href="#home"><img src="assets/pionx-logo-transparent-r16.png" alt=""><span>PIONX <b>AI</b><small>ARCHITECTURE WORKSPACE</small></span></a><button type="button" class="d02-new-project" data-shell-new-project></button><nav class="d02-nav"></nav><footer class="d02-side-footer"><a href="about.html">About PIONX</a><a href="contact.html">Contact</a></footer>';
  const nav = aside.querySelector('nav');
  const nodes = [];
  for (const [en, ar, items, admin, collapsible] of groups) {
    const section = document.createElement(collapsible ? 'details' : 'section');
    section.className = 'd02-nav-section';
    if (admin) section.dataset.admin = 'true';
    section.innerHTML = collapsible ? '<summary></summary>' : '<h2></h2>';
    section._labels = [en, ar];
    for (const [route, title, arabic, icon, mode] of items) {
      const link = document.createElement('a');
      link.href = '#' + route;
      link.dataset.shellRoute = route;
      if (mode) link.dataset.consistencyMode = mode;
      link.className = 'd02-nav-link';
      const symbol = document.createElement('span'); symbol.className = 'd02-nav-icon'; symbol.innerHTML = window.PIONXIcons1616?.(icon) || ''; symbol.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span'); label.className = 'd02-nav-title';
      link.append(symbol, label); section.append(link);
      nodes.push({link, label, route, mode, titles: [title, arabic]});
    }
    nav.append(section);
  }
  app.prepend(aside);
  const topbar = app.querySelector('.topbar');
  const toggle = document.createElement('button');
  toggle.type = 'button'; toggle.id = 'd02MenuToggle'; toggle.className = 'd02-menu-toggle'; toggle.textContent = '☰';
  toggle.setAttribute('aria-controls', aside.id); toggle.setAttribute('aria-expanded', 'false');
  const crumb=document.createElement('div');crumb.className='d02-crumb';crumb.innerHTML='<span></span><span>/</span><strong></strong>';topbar?.prepend(crumb);
  topbar?.prepend(toggle);
  aside.querySelector('[data-shell-new-project]').onclick=()=>bridge()?.createProject?.();
  const shade = document.createElement('button'); shade.type = 'button'; shade.className = 'd02-sidebar-shade'; shade.setAttribute('aria-label', 'Close navigation'); shade.hidden = true; app.append(shade);
  function bridge() { return window.PIONXWorkspaceShellBridge; }
  function mobile() { return window.matchMedia('(max-width:900px)').matches; }
  function close() { const opened = aside.classList.contains('d02-open'); aside.classList.remove('d02-open'); shade.hidden = true; aside.inert = mobile(); toggle.setAttribute('aria-expanded', 'false'); if (opened && mobile()) toggle.focus(); }
  toggle.addEventListener('click', () => { const open = aside.classList.toggle('d02-open'); shade.hidden = !open; aside.inert = !open && mobile(); toggle.setAttribute('aria-expanded', String(open)); if (open) aside.querySelector('a:not([hidden])')?.focus(); });
  shade.addEventListener('click', close);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') close();
    if (e.key !== 'Tab' || !mobile() || !aside.classList.contains('d02-open')) return;
    const stops = [...aside.querySelectorAll('a,button,summary')].filter(el => !el.closest('[hidden]') && (!el.closest('details') || el.matches('summary') || el.closest('details').open));
    if (!stops.length) return; const first = stops[0], last = stops[stops.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  aside.addEventListener('click', e => {
    const link = e.target.closest('[data-shell-route],.d02-brand'); if (!link) return;
    const api = bridge(); if (!api) return;
    e.preventDefault(); if (!api.signedIn()) return;
    if (link.dataset.consistencyMode && api.consistencyMode) api.consistencyMode(link.dataset.consistencyMode);
    else api.go(link.dataset.shellRoute || 'home');
    close(); update();
  });
  let requested = false;
  function schedule() { if (requested) return; requested = true; requestAnimationFrame(() => { requested = false; update(); }); }
  let previousRoute='';
  function update() {
    const api = bridge(); const ar = document.documentElement.lang === 'ar';
    const authenticated = !!api?.signedIn();
    app.classList.toggle('d02-shell', authenticated);
    aside.hidden = !authenticated;
    aside.inert = mobile() && !aside.classList.contains('d02-open');
    const role = String(api?.role?.() || 'user').toLowerCase();
    const route = (location.hash || '#home').slice(1).split('?')[0];
    for (const section of nav.children) { section.querySelector('h2,summary').textContent = section._labels[ar ? 1 : 0]; section.hidden = section.dataset.admin === 'true' && role !== 'admin'; if(route!==previousRoute && section.tagName==='DETAILS' && section.querySelector('[data-shell-route="'+route+'"]'))section.open=true; }
    for (const item of nodes) {
      item.label.textContent = item.titles[ar ? 1 : 0];
      item.link.hidden = api?.hasRoute ? !api.hasRoute(item.route) : item.route === 'assistant';
      const active = item.route === route && (!item.mode || !api?.consistencyWorkflow || api.consistencyWorkflow() === item.mode);
      item.link.classList.toggle('active', active);
      if (active) item.link.setAttribute('aria-current', 'page'); else item.link.removeAttribute('aria-current');
    }
    previousRoute=route;
    const active=nodes.find(item=>item.route===route);crumb.children[0].textContent=ar?'مساحة العمل':'Workspace';crumb.querySelector('strong').textContent=active?.titles[ar?1:0]||route;
    const newButton=aside.querySelector('[data-shell-new-project]');newButton.innerHTML=(window.PIONXIcons1616?.('plus')||'')+'<span>'+(ar?'مشروع جديد':'New project')+'</span>';
    aside.setAttribute('aria-label', ar ? 'التنقل في مساحة العمل' : 'Workspace navigation');
    toggle.setAttribute('aria-label', ar ? 'فتح قائمة التنقل' : 'Open navigation');
    shade.setAttribute('aria-label', ar ? 'إغلاق قائمة التنقل' : 'Close navigation');
    const footer = aside.querySelector('footer');
    footer.children[0].textContent = ar ? 'عن بيونكس' : 'About PIONX'; footer.children[1].textContent = ar ? 'تواصل معنا' : 'Contact';
    if (!authenticated) close();
  }
  new MutationObserver(schedule).observe(view, {childList: true});
  new MutationObserver(schedule).observe(app, {attributes: true, attributeFilter: ['hidden']});
  new MutationObserver(schedule).observe(document.documentElement, {attributes: true, attributeFilter: ['lang', 'dir']});
  window.addEventListener('hashchange', schedule);
  window.addEventListener('resize', () => { if (!mobile()) close(); schedule(); });
  window.addEventListener('pionx-account-changed', schedule);
  window.PIONXDesignShell = {refresh: schedule, close};
  update();
})();
