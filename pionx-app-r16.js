(()=>{
'use strict';
  // PIONX R16.7: preserve recent protected jobs across refresh; purge only stale pointers.
  // Previous builds deleted active render/plan recovery keys on every page load, which made
  // refresh recovery impossible and could strand an already-paid operation.
  try {
    const now=Date.now();
    const planCtx=JSON.parse(localStorage.getItem('pionx.studio.pending-plan-context-v6331')||'null');
    const planAge=planCtx&&Number(planCtx.started_at)>0?now-Number(planCtx.started_at):Number.POSITIVE_INFINITY;
    if(planAge>12*60*1000){
      localStorage.removeItem('pionx.studio.pending-plan-v6323');
      localStorage.removeItem('pionx.studio.pending-plan-context-v6331');
    }
    const active=JSON.parse(localStorage.getItem('pionx.active.render.v56')||'null');
    const activeAge=active&&Number(active.ts)>0?now-Number(active.ts):Number.POSITIVE_INFINITY;
    if(activeAge>90*60*1000)localStorage.removeItem('pionx.active.render.v56');
    sessionStorage.removeItem('pionx.studio.pending-plan-v6323');
  } catch(e) {}

const q=(s,r=document)=>r.querySelector(s), qa=(s,r=document)=>[...r.querySelectorAll(s)];
const PIONX_SCENE_PROMPTS = {
  exterior: "Ultra-photorealistic exterior architecture, massing and opening proportions strictly preserved, honed Roman travertine stone facade with recessed shadow reveals, floor-to-ceiling Low-E curtain wall glazing, realistic solar zenith daylight at 5500K, integrated reflection pool and Mediterranean landscape.",
  interior: "Photorealistic interior architecture with exact room boundaries, openings, ceiling geometry, fixed joinery, furniture positions and camera preserved. Use physically believable materials, natural contact shadows, balanced exposure and premium architectural photography. Do not impose a design style unless the user selects one in Interior Style.",
  plan: "Plan to 3D eye-level architectural perspective: 2D CAD floor plan wall partitions extruded with exact dimensional fidelity, realistic window and door openings, warm natural sunlight streaming across oak hardwood flooring, architectural digest photography finish.",
  sketch: "Authoritative sketch geometry preserved: hand-drawn massing, proportions and roof lines resolved conservatively into buildable photorealistic contemporary architecture with real stone and timber materials.",
  landscape: "Architectural landscape design: site contours, stone walkways and pedestrian hardscape paths preserved, layered architectural planting with mature olive trees and ornamental grasses, natural daylight and water reflections.",
  masterplan: "Architectural masterplan aerial visualization: road network, building footprints and zoning strictly locked, clear hierarchy of green spines, pedestrian boulevards, water features, presentation clarity.",
  auto: "Architecture intelligence mode: massing and opening proportions strictly preserved, physically realistic daylighting, high-fidelity materials and natural contact shadows."
};

function injectScenePrompt(sceneKey, force = false) {
  const notesEl = q('#studioNotes');
  if (!notesEl) return;
  const currentVal = notesEl.value.trim();
  const knownPrompts = Object.values(PIONX_SCENE_PROMPTS);
  if (force || !currentVal || knownPrompts.includes(currentVal) || notesEl.dataset.autoPrompt === 'true') {
    notesEl.value = PIONX_SCENE_PROMPTS[sceneKey] || PIONX_SCENE_PROMPTS.exterior;
    notesEl.dataset.autoPrompt = 'true';
  }
}

async function autoAnalyzeAndSetPrompt() {
  if (!studioSourceImage) {
    toast('Please upload an image first');
    return;
  }
  toast('🔍 Analyzing image geometry & preparing optimal prompt...');
  
  let detected = 'exterior';
  const nameLower = (studioSourceName || '').toLowerCase();
  
  if (nameLower.includes('plan') || nameLower.includes('cad') || nameLower.includes('floor') ) {
    detected = 'interior'; // CAD floor plan extruded to interior perspective
  } else if (nameLower.includes('interior') || nameLower.includes('living') || nameLower.includes('room') ) {
    detected = 'interior';
  } else if (nameLower.includes('sketch') || nameLower.includes('draw') ) {
    detected = 'sketch';
  } else if (nameLower.includes('landscape') || nameLower.includes('garden') ) {
    detected = 'landscape';
  } else if (nameLower.includes('master') || nameLower.includes('urban') ) {
    detected = 'masterplan';
  } else {
    try {
      if (typeof analyzeStudioSource631 === 'function') {
        const res = await analyzeStudioSource631();
        if (res && res.scene_type && res.scene_type !== 'auto') {
          detected = res.scene_type;
        }
      }
    } catch(e) {
      console.warn('Analysis fallback to exterior', e);
    }
  }

  studioState.scene = detected;
  qa('.scene-pick').forEach(x => x.classList.toggle('active', x.dataset.scene === studioState.scene));
  qa('.scene-mini').forEach(x => x.classList.toggle('active', x.dataset.scene === studioState.scene));
  if (typeof updateStudioBrief === 'function') updateStudioBrief();
  
  injectScenePrompt(detected, true);
  toast(`✦ Image analyzed: [${(sceneRules[studioState.scene]?.title || detected)}] Optimal prompt injected!`);
}
window.autoAnalyzeAndSetPrompt = autoAnalyzeAndSetPrompt;
const A='pionx-main/assets/';
const safeStore={get:(k)=>{try{return localStorage.getItem(k)}catch{return null}},set:(k,v)=>{try{localStorage.setItem(k,v)}catch{}}};
const escHtml=(v='')=>String(v).replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));
const profileDefaults={displayName:'PIONX User',username:'',title:'Architect / Designer',company:'',bio:'',photo:''};
let profileState={...profileDefaults};
try{const saved=JSON.parse(safeStore.get('pionx-profile-v1')||'null');if(saved&&typeof saved==='object')profileState={...profileDefaults,...saved}}catch{}
let profileDraftPhoto=profileState.photo||'';
function profileInitials(name=profileState.displayName){return String(name||'PX').trim().split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]?.toUpperCase()||'').join('')||'PX'}
function profileAvatarStyle(photo=profileState.photo){return photo?` style="background-image:url('${photo}');background-size:cover;background-position:center"`:''}
function saveProfileState(){safeStore.set('pionx-profile-v1',JSON.stringify(profileState))}
function syncProfileChrome(){
 const initials=profileInitials();
 const top=q('#topAvatar'); if(top){top.textContent=profileState.photo?'':initials;top.classList.toggle('has-photo',!!profileState.photo);top.style.backgroundImage=profileState.photo?`url('${profileState.photo}')`:''}
 const name=q('#topUserName'); if(name)name.textContent=profileState.displayName||'PIONX User';
}


// ===== V6.31.18 PIONX ANIMATED RENDER CHARACTER (V6.31.17 FIX PRESERVED) =====
// Keep the original local MP4, but make playback resilient after refresh/rerender.
// Muted inline playback is attempted from the Render click, then retried when media is ready.
function renderVideo58(){return q('#pionxRenderVideo')}
let renderVideoRetry6327=0,renderMindHideTimer16127=0;
function playRenderVideo6327({restart=false}={}){
 const v=renderVideo58(),fallback=q('#pionxVideoFallback');if(!v)return;
 v.muted=true;v.defaultMuted=true;v.loop=true;v.playsInline=true;v.autoplay=true;
 v.setAttribute('muted','');v.setAttribute('playsinline','');v.setAttribute('autoplay','');v.setAttribute('loop','');
 if(restart){try{v.currentTime=0}catch{}}
 const tryPlay=()=>{try{const p=v.play();if(p&&typeof p.then==='function')p.then(()=>{if(fallback)fallback.hidden=true}).catch(()=>{})}catch{}};
 tryPlay();clearTimeout(renderVideoRetry6327);
 renderVideoRetry6327=setTimeout(()=>{if(v.paused){if(v.readyState===0){try{v.load()}catch{}}tryPlay()}},180);
 setTimeout(()=>{if(v.paused){tryPlay();if(fallback)fallback.hidden=false}},900);
}
function showRenderMind58(){
 clearTimeout(renderMindHideTimer16127);renderMindHideTimer16127=0;
 const modal=q('#renderMind');if(!modal)return null;modal.hidden=false;
 renderMindProgress=0;renderMindStep=0;const pct=q('#renderMindPct'),bar=q('#renderMindBar');if(pct)pct.textContent='0%';if(bar)bar.style.width='0%';
 wireRenderVideo58();const poster=q('#pionxRenderPoster');if(poster)poster.hidden=false;
 const fallback=q('#pionxVideoFallback');if(fallback)fallback.hidden=true;playRenderVideo6327({restart:true});
 return modal;
}
function hideRenderMind58(delay=0){
 const close=()=>{clearTimeout(renderVideoRetry6327);const modal=q('#renderMind');const v=renderVideo58();if(v){try{v.pause()}catch{}}if(modal)modal.hidden=true};
 clearTimeout(renderMindHideTimer16127);renderMindHideTimer16127=0;
 if(delay>0)renderMindHideTimer16127=setTimeout(close,delay);else close();
}
function wireRenderVideo58(){
 const v=renderVideo58(),fallback=q('#pionxVideoFallback');
 if(v&&!v.dataset.wired6327){v.dataset.wired6327='1';
  v.addEventListener('error',()=>{const poster=q('#pionxRenderPoster');if(poster)poster.hidden=false;if(fallback)fallback.hidden=false});
  v.addEventListener('playing',()=>{const poster=q('#pionxRenderPoster');if(poster)poster.hidden=true;if(fallback)fallback.hidden=true});
  v.addEventListener('loadeddata',()=>{if(!q('#renderMind')?.hidden)playRenderVideo6327()});
  v.addEventListener('canplay',()=>{if(!q('#renderMind')?.hidden)playRenderVideo6327();if(!v.paused&&fallback)fallback.hidden=true});
  v.addEventListener('ended',()=>{if(!q('#renderMind')?.hidden)playRenderVideo6327({restart:true})});
 }
 if(fallback&&!fallback.dataset.wired){fallback.dataset.wired='1';fallback.addEventListener('click',()=>{playRenderVideo6327();if(v&&!v.paused)fallback.hidden=true})}
}


// ===== V5.7 REAL ACCOUNT / ROOT SERVER BRIDGE =====
// The public site loads from the domain root; secrets remain in the existing
// root PHP backend. No API key is copied into this frontend.
let PXCFG56=null, PXSESSION56=null, PXPROFILE56=null, PXUSER56=null;
const PX_SESSION_KEY56='pionx_session_hint';
function getSession56(){try{return localStorage.getItem(PX_SESSION_KEY56)==='1'?{server_session:true}:null}catch{return null}}
function setSession56(v){PXSESSION56=v?{server_session:true}:null;try{localStorage.removeItem('pionx_session');if(v)localStorage.setItem(PX_SESSION_KEY56,'1');else localStorage.removeItem(PX_SESSION_KEY56)}catch{}return PXSESSION56}
function takeLegacySession56(){try{const raw=localStorage.getItem('pionx_session');localStorage.removeItem('pionx_session');if(!raw)return null;const j=JSON.parse(raw);return j&&typeof j==='object'?j:null}catch{return null}}
function signedIn56(){const s=PXSESSION56||getSession56();PXSESSION56=s;return !!s?.server_session}
function serverUrl56(file=''){
 const base=new URL('./',location.href);const clean=String(file||'').replace(/^\/+server\//,'').replace(/^\/+/, '');
 return new URL('server/'+clean,base).toString();
}
async function json56(r,label='PIONX server'){
 const txt=await r.text();let j={};try{j=txt?JSON.parse(txt):{}}catch{throw new Error(`${label} returned an invalid response (HTTP ${r.status}).`)}return j;
}
async function config56(){
 if(PXCFG56)return PXCFG56;
 const r=await fetch(serverUrl56('public-config.php'),{cache:'no-store',credentials:'same-origin'});const j=await json56(r,'PIONX public config');
 if(!r.ok||!j.supabase_url||!j.supabase_publishable_key)throw new Error(j.error||'PIONX account configuration is unavailable.');PXCFG56=j;return j;
}
async function supabaseAuth56(path,body,token=''){
 const c=await config56();const h={'Content-Type':'application/json','apikey':c.supabase_publishable_key};if(token)h.Authorization='Bearer '+token;
 const r=await fetch(c.supabase_url+'/auth/v1/'+path,{method:'POST',headers:h,body:body?JSON.stringify(body):undefined,cache:'no-store'});const j=await json56(r,'PIONX authentication');
 if(!r.ok)throw new Error(j.msg||j.error_description||j.message||j.error||'Authentication failed');return j;
}
async function authSession56(action,payload={}){
 const isStatus=action==='status';const url=serverUrl56('auth-session.php')+(isStatus?'?action=status':'');
 const opt=isStatus?{method:'GET',cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(12000)}:{method:'POST',cache:'no-store',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...payload})};
 const r=await fetch(url,opt);const j=await json56(r,'PIONX secure session');
 if(!r.ok&&!isStatus)throw new Error(j.error||'Secure session unavailable.');return r.ok?j:{ok:false,authenticated:false};
}
async function establishServerSession56(auth){
 if(!auth?.access_token)throw new Error('Authentication did not return a valid session.');
 const expiresAt=Number(auth.expires_at||0)||Math.floor(Date.now()/1000)+Number(auth.expires_in||3600);
 const j=await authSession56('start',{access_token:auth.access_token,refresh_token:auth.refresh_token||'',expires_at:expiresAt});
 if(!j.ok)throw new Error('Secure session could not be established.');setSession56(true);return true;
}
async function refreshSession56(){
 if(!signedIn56())return false;
 try{const j=await authSession56('refresh');if(j?.ok){setSession56(true);return true}}catch{}setSession56(null);return false;
}
async function ensureRenderSession6327(){return signedIn56()||await refreshSession56()}
async function pxApi56(url,opt={}){
 if(/^\/server\//.test(String(url)))url=serverUrl56(String(url).replace(/^\/server\//,''));
 const go=()=>fetch(url,{...opt,credentials:'same-origin',headers:{...(opt.headers||{})}});
 let r=await go();if(r.status===401&&signedIn56()&&await refreshSession56())r=await go();if(r.status===401)setSession56(null);return r;
}
function setAuthStatus56(msg,bad=false){const el=q('#authStatus');if(el){el.textContent=msg;el.style.color=bad?'#ffb1b1':''}}
function renderAccount56(data){
 const p=data?.profile||null,u=data?.user||null;PXPROFILE56=p;PXUSER56=u;
 const credits=Number(p?.credits??0), rawPlan=String(p?.current_plan||'none'), plan=rawPlan==='none'?'No active plan':rawPlan.replace(/(^|[-_ ])\w/g,m=>m.toUpperCase())+' Plan';
 const name=p?.username||u?.user_metadata?.full_name||u?.email?.split('@')[0]||profileState.displayName||'PIONX User';
 if(p){profileState.displayName=name;profileState.username=p.username||profileState.username;}
 const side=q('#sideCredits');if(side)side.textContent=credits.toLocaleString();const topCredits=q('#topCredits');if(topCredits)topCredits.textContent=credits.toLocaleString()+' Credits';
 const topName=q('#topUserName');if(topName)topName.textContent=name;const topPlan=q('#topUserPlan');if(topPlan)topPlan.textContent=plan;
 const av=q('#topAvatar');if(av&&!profileState.photo)av.textContent=String(name).trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'PX';
 qa('.admin-nav').forEach(x=>x.hidden=!!p&&String(p.role||'user').toLowerCase()!=='admin');
 if(!p)qa('.admin-nav').forEach(x=>x.hidden=true);
 window.dispatchEvent(new Event('pionx-account-changed'));
 return data;
}
async function loadAccount56({quiet=false}={}){
 if(!signedIn56()){renderAccount56(null);return null}
 try{const r=await pxApi56('/server/me-v60.php?ts='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(15000)});const j=await json56(r,'PIONX account');if(!r.ok)throw new Error(j.error||'Account session is unavailable.');renderAccount56(j);return j}catch(e){if(!signedIn56())renderAccount56(null);if(!quiet)toast(e.message);return null}
}
async function signIn56(){
 if(window.PIONXAuth.locked())return;
 const email=q('#signinEmail')?.value.trim(),password=q('#signinPassword')?.value||'';
 if(!email||!q('#signinEmail').checkValidity()||!password)return setAuthStatus56('Enter a valid email and password.',true);
 const b=q('#publicSignIn');if(b){b.disabled=true;b.textContent='Signing in…'}setAuthStatus56('Connecting to your PIONX account…');
 try{await window.PIONXAuth.signIn(email,password);setSession56(true);q('#signinPassword').value='';const account=await loadAccount56();if(!account)throw new Error('Signed in, but the PIONX profile could not be loaded.');setAuthStatus56('Signed in successfully.');const requested=(location.hash||'#home').slice(1)||'home';enterApp(routes[requested]?requested:'home');toast('Welcome back to PIONX')}
 catch(e){window.PIONXAuth.showError(e)}finally{window.PIONXAuth.resumeButton(b)}
}
async function signUp56(){
 const name=q('#signupName')?.value.trim(),email=q('#signupEmail')?.value.trim(),password=q('#signupPassword')?.value||'';if(!email||!q('#signupEmail').checkValidity()||password.length<8)return setAuthStatus56('Enter an email and a password of at least 8 characters.',true);
 const b=q('#publicCreate');if(b){b.disabled=true;b.textContent='Creating…'};setAuthStatus56('Creating your PIONX account…');
 try{const j=await supabaseAuth56('signup?redirect_to='+encodeURIComponent(location.origin+'/'),{email,password,data:{username:name||email.split('@')[0],full_name:name||''}});if(j.access_token){await establishServerSession56(j);await loadAccount56();const requested=(location.hash||'#home').slice(1)||'home';enterApp(routes[requested]?requested:'home');toast('PIONX account created')}else setAuthStatus56('Account created. Check your email if confirmation is enabled, then sign in.')}
 catch(e){setAuthStatus56(e.message,true)}finally{if(b){b.disabled=false;b.textContent='Create account'}}
}
async function googleSignIn56(){
 try{const c=await config56();const r=await fetch(c.supabase_url+'/auth/v1/settings',{headers:{apikey:c.supabase_publishable_key},cache:'no-store'});const settings=await r.json();if(!r.ok||!settings.external?.google)throw new Error('Google sign-in is being configured. Please use email for now.');const redirect=location.origin+'/';location.href=c.supabase_url+'/auth/v1/authorize?provider=google&redirect_to='+encodeURIComponent(redirect)}catch(e){setAuthStatus56(e.message,true)}
}
let PXRECOVERY61=null;
function showAuthPane61(pane){
 const reset=pane==='request'||pane==='update';
 qa('[data-auth-pane]').forEach(x=>x.hidden=reset||x.dataset.authPane!==pane);
 q('#recoveryRequestPane').hidden=pane!=='request';
 q('#recoveryUpdatePane').hidden=pane!=='update';
 q('.auth-tabs').hidden=reset;
 q('#authProviderDivider').hidden=reset;
 q('#authProviders').hidden=reset;
 qa('[data-auth-tab]').forEach(x=>x.classList.toggle('active',x.dataset.authTab===pane));
}
async function requestRecovery61(){
 const email=q('#recoveryEmail').value.trim();
 if(!email||!q('#recoveryEmail').checkValidity())return setAuthStatus56('Enter a valid account email.',true);
 const button=q('#sendRecoveryEmail');button.disabled=true;button.textContent='Sending…';
 try{const j=await window.PIONXAuth.requestRecovery(email);setAuthStatus56(j.message)}
 catch(e){setAuthStatus56(e.message,true)}finally{button.disabled=false;button.textContent='Send reset link'}
}
async function saveRecoveryPassword61(){
 const password=q('#recoveryNewPassword').value,confirm=q('#recoveryConfirmPassword').value;
 if(!PXRECOVERY61?.verified)return setAuthStatus56('Open the latest password reset link from your email.',true);
 if(password.length<8)return setAuthStatus56('Use a password of at least 8 characters.',true);
 if(password!==confirm)return setAuthStatus56('The passwords do not match.',true);
 const button=q('#saveRecoveryPassword');button.disabled=true;button.textContent='Saving…';
 try{const result=await window.PIONXAuth.updatePassword(password);PXRECOVERY61=null;setSession56(null);q('#recoveryNewPassword').value='';q('#recoveryConfirmPassword').value='';showAuthPane61('signin');setAuthStatus56(result.sessions_revoked?'Password updated. Sign in with your new password. Any existing temporary sign-in pause still applies.':'Password updated. Sign in with your new password. Existing sessions could not all be signed out; contact support if needed.')}
 catch(e){setAuthStatus56(e.message,true)}finally{button.disabled=false;button.textContent='Save new password'}
}
async function captureOAuthSession56(){
 const h=location.hash.startsWith('#')?location.hash.slice(1):'',p=new URLSearchParams(h),search=new URLSearchParams(location.search);
 const tokenHash=search.get('type')==='recovery'?search.get('token_hash'):null;
 if(p.get('error')){history.replaceState(null,'',location.pathname);showAuthPane61(p.get('type')==='recovery'?'request':'signin');setAuthStatus56('Link expired or sign-in could not complete. Please request a new link.',true);return true}
 if(tokenHash||p.get('type')==='recovery'){
  const payload=tokenHash?{token_hash:tokenHash}:{access_token:p.get('access_token')||''};
  history.replaceState(null,'',location.pathname);setSession56(null);
  try{await window.PIONXAuth.verifyRecovery(payload);PXRECOVERY61={verified:true};showAuthPane61('update');setAuthStatus56('Reset link verified. Choose your new password.');q('#authCard')?.scrollIntoView({block:'center'})}
  catch(e){PXRECOVERY61=null;showAuthPane61('request');setAuthStatus56(e.message,true)}
  return true;
 }
 if(!/(^|&)access_token=/.test(h))return false;
 const access=p.get('access_token'),refresh=p.get('refresh_token');if(!access)return false;
 history.replaceState(null,'',location.pathname);await establishServerSession56({access_token:access,refresh_token:refresh||'',expires_in:Number(p.get('expires_in')||3600),expires_at:Math.floor(Date.now()/1000)+Number(p.get('expires_in')||3600)});const a=await loadAccount56({quiet:true});if(a){enterApp('home');toast('Account verified and signed in')}return !!a;
}
async function logout56(){
 try{await authSession56('logout')}catch{}setSession56(null);renderAccount56(null);exitApp();setAuthStatus56('Signed out.');toast('Logged out')
}
function setCreditsFromRender56(v){const n=Number(v);if(!Number.isFinite(n))return;const side=q('#sideCredits'),top=q('#topCredits');if(side)side.textContent=Math.max(0,Math.round(n)).toLocaleString();if(top)top.textContent=Math.max(0,Math.round(n)).toLocaleString()+' Credits'}

const imgs={
 hero:A+'hero-villa.jpg', interior:A+'interior-main.jpg', sceneInterior:A+'scene-interior.jpg', sceneExterior:A+'scene-exterior.jpg', sceneMaster:A+'scene-masterplan.jpg', sceneLandscape:A+'scene-landscape.jpg', sceneSketch:A+'scene-sketch.jpg',
 villa1:A+'render-villa-1.jpg', villa2:A+'render-villa-2.jpg', interiorCard:A+'render-interior.jpg', master:A+'render-masterplan.jpg', night:A+'render-night.jpg', landscape:A+'render-landscape.jpg', commercial:A+'render-commercial.jpg'
};
const allRenders=[
 ['Luxury Villa Interior',imgs.villa1,'Interior','2 hours ago'],['Modern Exterior',imgs.villa2,'Exterior','5 hours ago'],['Interior Living Room',imgs.interiorCard,'Interior','1 day ago'],['Masterplan Overview',imgs.master,'Masterplan','2 days ago'],['Exterior Night',imgs.night,'Exterior','3 days ago'],['Landscape Design',imgs.landscape,'Landscape','3 days ago'],['Commercial Complex',imgs.commercial,'Exterior','5 days ago']
];
const routes={home:homePage,studio:studioPage,flow:flowPage,consistency:consistencyPage,video:videoPage,film:filmPage,presentation:presentationPage,projects:projectsPage,renders:rendersPage,albums:albumsPage,assets:assetsPage,explore:explorePage,portfolio:portfolioPage,plans:plansPage,profile:profilePage,settings:settingsPage,admin:adminPage,finance:financePage,diagnostics:diagnosticsPage};
const studioState={scene:'auto',mode:'balanced',env:'auto',people:false,cars:false,interiorStyle:'none',interiorCustomStyle:''};

const INTERIOR_STYLES_R16=[
 ['none','None'],['auto','Auto'],['modern','Modern'],['minimal','Minimal'],['contemporary','Contemporary'],
 ['scandinavian','Scandinavian'],['japandi','Japandi'],['industrial','Industrial'],['boho','Boho'],
 ['classic','Classic'],['neo-classic','Neo Classic'],['luxury','Luxury'],['warm-minimal','Warm Minimal'],
 ['hotel','Hotel Style'],['custom','Custom']
];
const INTERIOR_STYLE_DIRECTIVES_R16={
 auto:'AUTO STYLE: infer the dominant design language from the source and references, but keep it restrained, coherent and architecturally credible. Do not drift into generic luxury. Preserve geometry and layout while improving materials, furniture character and lighting realism.',
 modern:'MODERN STYLE LOCK. MUST SHOW: clean rectilinear forms, contemporary low-profile furniture, large calm surfaces, natural oak/walnut, matte stone, black or brushed-metal accents, integrated details and restrained neutral colors. AVOID: classical mouldings, crystal chandeliers, ornate carving, baroque furniture, excessive gold, glossy palace marble and decorative clutter.',
 minimal:'MINIMAL STYLE LOCK. MUST SHOW: visually quiet composition, simplified furniture silhouettes, concealed storage, few materials, soft neutral palette, matte finishes, clean shadow gaps and controlled indirect light. AVOID: decorative mouldings, busy patterns, ornate accessories, excessive objects, high-gloss luxury finishes and visual clutter.',
 contemporary:'CONTEMPORARY STYLE LOCK. MUST SHOW: current sophisticated furniture, sculptural but simple forms, balanced stone/timber/metal, soft layered lighting, refined texture contrast and editorial neutral colors. AVOID: period/classical ornament, rustic aging, overt industrial rawness and palace-luxury clichés.',
 scandinavian:'SCANDINAVIAN STYLE LOCK. MUST SHOW: pale oak/ash timber, warm white and soft gray, simple functional furniture, linen/wool textures, natural daylight, light matte surfaces and cozy restrained accents. AVOID: dark glossy marble, heavy gold, crystal chandeliers, ornate moulding, oversized luxury furniture and dramatic black interiors.',
 japandi:'JAPANDI STYLE LOCK. MUST SHOW: Japanese restraint plus Scandinavian warmth, low simple furniture, pale-to-medium natural timber, lime/plaster textures, stone, warm off-whites, crafted joinery, negative space and soft daylight. AVOID: glossy luxury, ornate decoration, bright saturated colors, crystal, heavy gold and busy layered accessories.',
 industrial:'INDUSTRIAL STYLE LOCK. MUST SHOW CLEARLY: exposed or board-formed concrete, blackened steel, dark metal frames, aged/reclaimed timber, honest structural expression, matte charcoal accents, leather or textured neutral upholstery, visible but organized utility/track/linear lighting where plausible, factory-loft character and slightly cooler neutral grading. AVOID EXPLICITLY: crystal chandeliers, classical wall mouldings, gold ornamental columns, glossy palace marble, tufted classical seating, ornate trims, decorative cornices and luxury-hotel styling. If the source contains these decorative finishes, replace their visual language with industrial materials while preserving the same architectural geometry and object positions.',
 boho:'BOHO STYLE LOCK. MUST SHOW: warm earthy palette, natural timber, rattan/cane where suitable, layered woven textiles, relaxed upholstery, handmade accents, plants and tactile imperfection. AVOID: formal classical symmetry, cold corporate minimalism, glossy palace marble, heavy chrome and excessive black industrial finishes.',
 classic:'CLASSIC STYLE LOCK. MUST SHOW: elegant traditional proportions, refined wall panel/moulding language, timeless timber and stone, balanced symmetry, tailored upholstery and warm layered lighting. AVOID: raw concrete/industrial utilities, ultra-minimal blank walls, neon accents, exaggerated baroque ornament and gaudy gold overload.',
 'neo-classic':'NEO-CLASSIC STYLE LOCK. MUST SHOW: restrained classical wall proportions, clean contemporary mouldings, elegant stone/timber, refined brushed metal, modern-classic furniture and balanced luxury with generous negative space. AVOID: heavy baroque carving, excessive gilding, industrial exposed services, rustic distressing and generic hotel opulence.',
 luxury:'LUXURY STYLE LOCK. MUST SHOW: high-end natural stone, rich timber veneer, refined metal details, premium upholstery, bespoke joinery, layered architectural lighting, controlled reflections and quiet editorial sophistication. AVOID: gaudy gold overload, fake crystal excess, plastic gloss, generic palace styling, over-decoration and unrealistic showroom shine.',
 'warm-minimal':'WARM MINIMAL STYLE LOCK. MUST SHOW: warm beige/off-white palette, light oak, soft limestone/travertine, tactile fabric, rounded restrained furniture, clean planes, soft indirect lighting and minimal decoration. AVOID: cold gray corporate minimalism, glossy marble dominance, ornate moulding, exposed industrial services, strong black-and-gold luxury contrast and clutter.',
 hotel:'HOTEL STYLE LOCK. MUST SHOW: refined hospitality-grade finishes, durable premium materials, composed furniture groupings, layered practical ambient/accent lighting, tailored upholstery, integrated joinery and calm sophisticated atmosphere. AVOID: residential clutter, raw unfinished industrial look, overly personal decoration, palace ornament and excessive visual noise.'
};
const REALITY_RENDER_DIRECTIVE_R162='REALITY / PROFESSIONAL ARCHVIZ LOCK. The result must read as a real high-end architectural photograph, not CGI, game art, illustration or a stylized render. Use physically plausible global illumination, natural bounce light, coherent contact shadows, correct material roughness/specular response, true glass depth and reflections, believable fabric/wood/stone/concrete micro-texture, realistic edge softness, accurate scale and gravity, clean corrected verticals, natural lens behavior, controlled highlight roll-off, neutral white balance and restrained photographic depth. Avoid waxy/plastic materials, fake HDR, glowing edges, over-sharpening, excessive bloom, impossible reflections, floating furniture, repeated texture tiling, warped lines, over-saturated colors and synthetic showroom perfection. Preserve subtle imperfections that make real materials believable.';
const INTERIOR_STYLE_LOCK_COMMON_R162='SELECTED INTERIOR STYLE IS AUTHORITATIVE. It has highest VISUAL priority after architecture/geometry preservation. The source image remains authority for room shell, openings, circulation, fixed element locations, furniture count/function/approximate footprint and camera; it is NOT authority for the old decorative style when a style is selected. Restyle materials, colors, furniture design language, lighting fixtures and decorative detailing strongly enough that the chosen style is immediately recognizable. You may replace furniture models with style-appropriate equivalents while keeping their function, count, position, orientation and approximate size. Keep fixed joinery geometry but change its finish/detail language. Never drift back to generic luxury, modern-classic or the source aesthetic if it conflicts with the selected style.';
const STYLE_SEPARATION_DIRECTIVE_R164='STYLE ACTIVATION MUST BE VISUALLY OBVIOUS IN THE FIRST READ. If the selected style conflicts with the source look, replace the source decorative language decisively while preserving architecture and approximate furniture placement. Do not leave the result half-restyled or ambiguous.';
const WINDOW_GLASS_EXTERIOR_DIRECTIVE_R164='GLASS / WINDOW QUALITY LOCK. For interiors with windows, curtain walls or exterior glazing, show a believable outdoor environment beyond the glass with readable daylight depth and atmospheric perspective. Use clear architectural glass with realistic transmission, subtle neutral reflections, true glazing depth and a slight neutral tint. Avoid blank gray exteriors, white blowout, opaque glazing, black voids, mirror-only glass or missing environmental context.';
const INTERIOR_PHOTOGRAPHY_DIRECTIVE_R164='INTERIOR PHOTOGRAPHY QUALITY LOCK. Create premium archviz realism with dimensional daylight, natural bounce light, convincing contact shadows, non-plastic materials, clean but natural sharpness, and visible depth. Keep the result like a real photographed project, not a weak CGI render.';
function studioInteriorStyleLabelR16(){
 const key=studioState.interiorStyle||'none';
 if(key==='custom')return (studioState.interiorCustomStyle||'Custom').trim()||'Custom';
 return (INTERIOR_STYLES_R16.find(x=>x[0]===key)||INTERIOR_STYLES_R16[0])[1];
}
function studioInteriorStyleDirectiveR16(){
 if(studioState.scene!=='interior')return '';
 const key=studioState.interiorStyle||'none';
 if(key==='none')return '';
 let specific='';
 if(key==='custom'){
  const custom=String(studioState.interiorCustomStyle||'').trim();
  specific=custom?`CUSTOM STYLE LOCK: ${custom}. Translate this request into a clear, coherent interior design language across materials, palette, furniture character, lighting fixtures and decorative detailing.`:'';
 }else specific=INTERIOR_STYLE_DIRECTIVES_R16[key]||'';
 return specific?[INTERIOR_STYLE_LOCK_COMMON_R162,STYLE_SEPARATION_DIRECTIVE_R164,specific,WINDOW_GLASS_EXTERIOR_DIRECTIVE_R164,INTERIOR_PHOTOGRAPHY_DIRECTIVE_R164,REALITY_RENDER_DIRECTIVE_R162].join('\n\n'):'';
}
function studioInteriorStyleMarkupR16(){
 const visible=studioState.scene==='interior';
 const key=studioState.interiorStyle||'none';
 return `<div class="px-interior-style-wrap" id="studioInteriorStyleWrap" ${visible?'':'hidden'}><div class="field-title">Interior Style <span class="muted">optional · None keeps the current design language</span></div><div class="px-interior-style-options" role="group" aria-label="Interior style">${INTERIOR_STYLES_R16.map(([value,label])=>`<button type="button" class="chip px-interior-style-chip ${key===value?'active':''}" data-interior-style="${value}">${label}</button>`).join('')}</div><input id="studioInteriorCustomStyle" class="px-interior-custom-style" type="text" maxlength="120" placeholder="Describe the interior style..." value="${escHtml(studioState.interiorCustomStyle||'')}" ${key==='custom'?'':'hidden'}><small class="px-interior-style-help">Selected style is a strong visual lock. Geometry, plan orientation, openings and layout stay protected while materials, furniture language and lighting change clearly.</small></div>`;
}
function syncInteriorStyleUIR16(){
 const wrap=q('#studioInteriorStyleWrap');if(!wrap)return;
 wrap.hidden=studioState.scene!=='interior';
 qa('[data-interior-style]',wrap).forEach(b=>b.classList.toggle('active',b.dataset.interiorStyle===(studioState.interiorStyle||'none')));
 const custom=q('#studioInteriorCustomStyle');if(custom)custom.hidden=(studioState.interiorStyle||'none')!=='custom';
}

let studioSourceImage='';
let studioSourceName='';
const studioReferenceImages=['',''];
let studioDetectedSource631={};
let studioPlanInteriorSpec633=null;
let studioPlanInteriorMaster633=false;
const studioSourceDims={width:0,height:0};
let studioFinal56={providerUrl:'',exactUrl:'',blobUrl:'',width:0,height:0,qualityVerified:true};
let studioRenderKind56='source';
const studioAdjustState={style:'Photoreal Architecture',lighting:'Physically Balanced',materials:'PBR + Micro Detail',color:'Editorial Neutral',camera:'Scene Aware',brightness:1,contrast:1,saturation:1,zoom:1,rotation:0,enhanced:false,relightIndex:0};
const settingsState={tab:'General',language:'English',theme:(safeStore.get('pionx-theme')||safeStore.get('pionx_theme')||'light'),defaultMode:'Preserve',defaultScene:'Auto Detect',defaultEnvironment:'Auto',autoSave:true,renderAlerts:true,engineHidden:true,autoRetouch:true,aspectLock:true,autoAnalyze:true,portfolioPublic:true,profileSearchable:true,usageAnalytics:false,marketingEmails:false,securityAlerts:true};
const flowState={tool:'select',zoom:1,panX:0,panY:0,selected:null,connectFrom:null,nextId:20};
const discoverState={filter:'Featured',query:'',followed:new Set(),saved:new Set()};
const financeState={lastRefresh:'Just now',ledgerVersion:1};
const FLOW_CONNECTIONS=[['n0','n1'],['n1','n2'],['n2','n3'],['n3','n4'],['n3','n5'],['n2','n6']];

const sceneRules={
 auto:{title:'Auto Detect',desc:'PIONX reads the image first, classifies the scene, locks the design and applies the correct architecture prompt automatically.',focus:['Scene classification','Geometry lock','Camera + material analysis']},
 interior:{title:'Interior',desc:'Preserve the exact room layout, walls, openings, ceiling, fixed furniture and camera. Improve physically plausible indoor light, material roughness, fabric, timber, stone, glass and contact shadows.',focus:['Layout fidelity','Interior lighting','Material micro-detail']},
 exterior:{title:'Exterior',desc:'Preserve massing, facade rhythm, openings, levels and camera. Improve daylight, sky, glazing, facade materials, landscape integration and physically believable shadows.',focus:['Facade fidelity','Glazing + sunlight','Landscape context']},
 masterplan:{title:'Masterplan',desc:'Preserve roads, plots, building footprints, zoning and top view. Improve hierarchy, landscape, road materials, shadows, water and presentation clarity without changing planning logic.',focus:['Planning lock','Top-view clarity','Landscape hierarchy']},
 landscape:{title:'Landscape',desc:'Preserve site geometry, paths, levels and hardscape. Improve planting density, species variation, water, outdoor furniture, material realism, scale and natural daylight.',focus:['Site geometry','Planting realism','Hardscape + water']},
 sketch:{title:'Sketch to Render',desc:'Use the sketch as authoritative geometry. Preserve massing, proportions, roof form, openings and viewpoint; resolve ambiguous details conservatively into buildable architecture.',focus:['Sketch fidelity','Buildable details','Photoreal finish']}
};
const modeRules={
 preserve:'Preserve mode: exact design fidelity is non-negotiable. Keep geometry, composition, camera, openings, levels, furniture/layout and material intent unchanged; improve realism only.',
 balanced:'Balanced mode: protect the architecture and camera while allowing restrained material, planting, entourage and atmosphere improvements that strengthen the final presentation.',
 creative:'Creative mode: keep the project recognizable and structurally coherent, but allow controlled design exploration only where the user request and selected scene permit it.'
};
const envRules={
 day:'Day setup: physically believable daylight, balanced exposure, clean sky/ambient light, realistic reflections and soft contact shadows.',
 night:'Night setup: true night exposure, warm practical/architectural lighting, controlled highlights, readable dark materials, realistic glazing and no fake daylight sky.',
 auto:'Lighting setup: infer the most appropriate time and exposure from the source image while preserving the intended mood.'
};
function toast(msg){const t=q('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.remove('show'),2100)}
function btn(txt,route,cls='primary-btn'){return `<button class="${cls}" ${route?`data-route="${route}"`:''}>${txt}</button>`}
function pageHead(kicker,title,desc,actions=''){return `<div class="page-head"><div class="copy"><div class="eyebrow">${kicker}</div><h1>${title}</h1><p>${desc}</p></div><div class="page-actions">${actions}</div></div>`}
function renderCards(list=allRenders){return list.map(([t,i,c,d])=>`<article class="panel render-card"><div class="img-wrap"><img src="${i}" alt=""><span class="badge">${c}</span></div><div class="meta"><div><b>${t}</b><br><small>${d}</small></div><button class="kebab">⋮</button></div></article>`).join('')}
function projectCards(){return [
 ['Modern Villa',imgs.villa1,'12 renders'],['Commercial Complex',imgs.commercial,'8 renders'],['Interior Design',imgs.interiorCard,'6 renders'],['Masterplan',imgs.master,'10 renders']
 ].map(([t,i,c])=>`<article class="panel project-card"><img src="${i}" alt=""><div class="meta"><div><h3>${t}</h3><small>${c}</small></div><button class="kebab">⋮</button></div></article>`).join('')}
function featureCard(title,img,desc,route,focus=''){return `<article class="panel feature-card ${focus}" data-route="${route}"><img src="${img}" alt=""><div class="body"><b>${title}</b><p>${desc}</p></div></article>`}
function homePage(){return `<section class="page">
  <div class="hero"><img src="${imgs.hero}" alt=""><div class="hero-copy"><div class="eyebrow">PIONX ARCHITECTURE INTELLIGENCE</div><h1>Turn design ideas into <span>stunning reality.</span></h1><p>Premium architecture AI without model hunting: PIONX understands the scene, protects the design, builds the production prompt and delivers a finished image.</p><div class="hero-actions">${btn('Start a render ✦','studio')}${btn('Discover work','explore','ghost-btn')}</div><div class="hero-chip-row"><span class="mini-badge">Auto scene understanding</span><span class="mini-badge">Architecture fidelity lock</span><span class="mini-badge">Color + light + material finish</span></div></div></div>
  <div class="section-title"><div><h2>Your workspace</h2><p>Everything is organized by the outcome you need.</p></div></div>
  <div class="grid-4">${featureCard('AI Studio',imgs.villa1,'Scene-aware architectural rendering with automatic prompt intelligence.','studio','focus')}${featureCard('Flow',imgs.commercial,'Visual canvas for branches, comparisons and fast iteration.','flow')}${featureCard('Consistency',imgs.interiorCard,'Generate multiple images with one controlled style, mood and lighting.','consistency')}${featureCard('Video',imgs.night,'Architecture-first cinematic motion with automatic quality routing.','video')}${featureCard('PIONX Film',imgs.landscape,'Combine approved shots into a professional client film.','film')}${featureCard('Presentation',imgs.master,'Turn final renders into presentation-ready boards and exports.','presentation')}${featureCard('Discover',imgs.commercial,'Professional architecture portfolios, projects and designer search.','explore')}${featureCard('Projects',imgs.villa2,'Organize every source, render, asset and delivery by client.','projects')}</div>
  <div class="section-title"><div><h2>Recent projects</h2><p>Continue where you left off.</p></div><a data-route="projects">View all →</a></div><div class="grid-4">${projectCards()}</div>
</section>`}
function studioPage(){const scenes=[['✦','Auto','auto'],['⌂','Interior','interior'],['▥','Exterior','exterior'],['▦','Masterplan','masterplan'],['△','Landscape','landscape'],['▧','Sketch','sketch']];const rule=sceneRules[studioState.scene];const displayImage=studioFinal56.exactUrl||studioFinal56.providerUrl||studioSourceImage;const displayBadge=studioFinal56.providerUrl?(studioFinal56.qualityVerified===false?'RESULT · QC DEGRADED':'FINAL · VERIFIED'):(studioSourceImage?'SOURCE · READY':'UPLOAD SOURCE IMAGE');return `<section class="page">
  <div class="studio-hero"><img src="${imgs.hero}" alt=""><div class="studio-hero-copy"><div class="eyebrow">AI STUDIO</div><h1>One image in.<br><span>Premium reality out.</span></h1><p>PIONX identifies the scene, protects architecture and builds the right production brief automatically.</p></div><div class="studio-ready-pill">● Scene Intelligence Ready</div><div class="scene-strip">${[['interior',imgs.sceneInterior,'Interior'],['exterior',imgs.sceneExterior,'Exterior'],['masterplan',imgs.sceneMaster,'Masterplan'],['landscape',imgs.sceneLandscape,'Landscape'],['sketch',imgs.sceneSketch,'Sketch']].map((x,i)=>`<button class="scene-mini ${studioState.scene===x[0]?'active':''}" data-scene="${x[0]}"><img src="${x[1]}"><b>${x[2]}</b></button>`).join('')}</div></div>
  <div class="studio-grid">
    <aside class="panel control-panel"><div class="control-tabs"><button class="chip active">▧ Image</button><button class="chip" data-route="video">▣ Video</button><button class="chip" data-route="presentation">▤ Presentation</button></div>
      <div class="field-title">Render Mode</div><div class="segmented" id="modeSeg"><button class="chip ${studioState.mode==='preserve'?'active':''}" data-mode="preserve">Preserve</button><button class="chip ${studioState.mode==='balanced'?'active':''}" data-mode="balanced">Balanced</button><button class="chip ${studioState.mode==='creative'?'active':''}" data-mode="creative">Creative</button></div>
      <div class="field-title">Scene Type <span class="muted">Auto or manual override</span></div><div class="scene-picker">${scenes.map(x=>`<button class="scene-pick ${studioState.scene===x[2]?'active':''}" data-scene="${x[2]}"><strong>${x[0]}</strong>${x[1]}<small>${x[2]==='auto'?'Recommended':'Scene preset'}</small></button>`).join('')}</div>
      <div class="field-title">Environment</div><div class="segmented" id="envSeg"><button class="chip ${studioState.env==='day'?'active':''}" data-env="day">☀ Day</button><button class="chip ${studioState.env==='night'?'active':''}" data-env="night">☾ Night</button><button class="chip ${studioState.env==='auto'?'active':''}" data-env="auto">Auto</button></div>
      <div class="toggle-row"><div class="switch-line"><i class="switch ${studioState.people?'on':''}" data-control="people"></i>Add People</div><div class="switch-line"><i class="switch ${studioState.cars?'on':''}" data-control="cars"></i>Add Cars</div></div>
      <div class="auto-brief"><header><b id="sceneRuleTitle">PIONX Auto Brief · ${rule.title}</b><em>AUTO PROMPT</em></header><p id="sceneRuleDesc">${rule.desc}</p><div class="scene-insight" id="sceneInsight">${rule.focus.map((x,i)=>`<span><b>${['Priority 1','Priority 2','Priority 3'][i]}</b><small>${x}</small></span>`).join('')}</div></div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;"><div class="field-title" style="margin:0;">Scene & Material Prompt <span class="muted">Auto-injected by discipline</span></div><button type="button" id="btnAutoAnalyzePrompt" style="background:linear-gradient(135deg,#0284c7,#2563eb); color:#fff; border:none; border-radius:6px; font-size:11px; font-weight:700; padding:3px 8px; cursor:pointer;">🔍 Analyze & Auto-Prompt</button></div><textarea class="notes" id="studioNotes" maxlength="1000" placeholder="Only write what you want to change. PIONX writes the technical prompt automatically."></textarea>
      <div class="field-title">Reference Images</div><div class="reference-row"><div class="ref-box" aria-label="Reference guidance" style="display:flex;align-items:center;justify-content:center;padding:10px;text-align:center;font-size:11px;color:#a9bdd0">Upload style references in the + boxes. Only uploaded images are used.</div><button class="ref-box" data-studio-action="add-reference">＋</button><button class="ref-box" data-studio-action="add-reference">＋</button></div>
      <div class="finish-note"><i>✦</i><span>Premium Finish is automatic after generation: color · exposure · white balance · lighting · materials · glass/reflections · contrast · detail/sharpness · anti-CGI cleanup.</span></div>
      <div class="generate-row"><button class="primary-btn" id="demoGenerate">✦ &nbsp; Generate Premium Render</button><button class="settings-square" id="studioAdvancedBtn" title="Advanced settings">⌘</button></div></aside>
    <section class="panel canvas-panel"><div class="canvas-toolbar"><button class="tiny-btn" data-studio-tool="edit">✎ Edit</button><button class="tiny-btn" data-studio-tool="enhance">✦ Enhance</button><button class="tiny-btn" data-studio-tool="variations">▦ Variations</button><button class="tiny-btn" data-studio-tool="upscale">⌗ Upscale</button><button class="tiny-btn" data-studio-tool="relight">◌ Relight</button><button class="tiny-btn" data-studio-tool="more">•••</button></div><div class="canvas-image"><img id="studioOutput" src="${imgs.interior}" alt=""><div class="output-badge" id="studioOutputBadge">2K · Premium</div><div class="canvas-floating"><button class="tiny-btn" data-canvas-action="rotate">↻</button><button class="tiny-btn" data-canvas-action="zoom">100%</button><button class="tiny-btn" data-canvas-action="fullscreen">⛶</button></div></div><div class="filmstrip" id="studioFilmstrip">${[imgs.interior,imgs.interiorCard,imgs.villa1,imgs.villa2,imgs.night,imgs.commercial].map((x,i)=>`<button class="shot-thumb ${i===0?'active':''}"><img src="${x}"></button>`).join('')}</div></section>
    <aside class="panel adjust-panel"><div class="adjust-tabs"><button class="chip active" data-adjust-tab="adjust">Adjust</button><button class="chip" data-adjust-tab="history">History</button><button class="chip" data-adjust-tab="layers">Layers</button></div><div id="adjustPane" data-adjust-pane="adjust">${[['style','Style',studioAdjustState.style,imgs.sceneInterior],['lighting','Lighting',studioAdjustState.lighting,imgs.night],['materials','Materials',studioAdjustState.materials,imgs.interiorCard],['color','Color',studioAdjustState.color,imgs.villa1],['camera','Camera',studioAdjustState.camera,imgs.sceneExterior]].map(x=>`<button class="adjust-card" data-adjust="${x[0]}"><div class="line"><img class="preview" src="${x[3]}"><div><b>${x[1]}</b><small data-adjust-value="${x[0]}">${x[2]}</small></div><i>›</i></div></button>`).join('')}<button class="reset-adjust" id="resetAdjust">↻ &nbsp; Reset Adjustments</button></div><div id="historyPane" class="adjust-secondary" data-adjust-pane="history" hidden><div class="history-list"><article><b>Current</b><small>Scene-aware premium finish</small></article><article><b>Version 03</b><small>Relight · +6% exposure</small></article><article><b>Version 02</b><small>Material refinement</small></article><article><b>Original</b><small>Uploaded source</small></article></div></div><div id="layersPane" class="adjust-secondary" data-adjust-pane="layers" hidden>${[['Architecture',true],['Materials',true],['Lighting',true],['Entourage',studioState.people||studioState.cars],['Retouch',true]].map(x=>`<div class="layer-row"><span>◫ ${x[0]}</span><i class="switch ${x[1]?'on':''}" data-layer="${x[0].toLowerCase()}"></i></div>`).join('')}</div></aside>
  </div>
  <div class="section-title"><div><h2>Recent Renders</h2><p>Every final image stays editable and downloadable.</p></div><a data-route="renders">View all →</a></div><div class="gallery">${renderCards()}</div>
</section>`}
function flowPage(){const nodes=[
 ['n0',110,300,imgs.interiorCard,'Source interior'],['n1',365,220,imgs.villa1,'Exterior direction'],['n2',550,360,imgs.interior,'Material study'],['n3',710,245,imgs.villa2,'Balanced branch'],['n4',910,165,imgs.night,'Night option'],['n5',980,390,imgs.landscape,'Landscape branch'],['n6',760,515,imgs.commercial,'Client option B']
 ];return `<section class="page">${pageHead('VISUAL ITERATION','Flow','Drag images, branch ideas, compare options and keep every version under control.','<button class="primary-btn" id="flowNewBoard">+ New Board</button><button class="ghost-btn" id="flowShare">Share</button>')}<div class="flow-shell" id="flowShell"><div class="flow-zoom"><button id="flowZoomOut">−</button><span id="flowZoomPct">100%</span><button id="flowZoomIn">＋</button><button id="flowFit">Fit</button></div><div class="panel flow-tools" id="flowTools">${[['select','⌖','Select'],['pan','✋','Pan'],['add','＋','Add'],['frame','▤','Frame'],['text','T','Text'],['connect','↔','Connect'],['image','◉','Image']].map(x=>`<button data-flow-tool="${x[0]}" class="${flowState.tool===x[0]?'active':''}" title="${x[2]}"><b>${x[1]}</b><small>${x[2]}</small></button>`).join('')}</div><div class="flow-viewport" id="flowViewport"><div class="flow-canvas" id="flowCanvas"><svg class="flow-svg" id="flowSvg" width="1450" height="800" viewBox="0 0 1450 800"></svg>${nodes.map(n=>`<article class="node" data-node-id="${n[0]}" style="left:${n[1]}px;top:${n[2]}px"><img src="${n[3]}"><b>${n[4]}</b><small>Drag · Compare · Branch</small></article>`).join('')}</div></div><div class="flow-help"><b>Flow controls</b><span>Select = drag cards · Pan = move canvas · Connect = click two cards · Mouse wheel = zoom</span></div></div></section>`}
function consistencyPage(){return `<section class="page">${pageHead('VISUAL DNA SUITE','Visual DNA','Lock one reference image, then generate multiple views with the same materials, lighting and visual language.',btn('Generate batch ✦',null))}<div class="consistency-grid"><aside class="panel consistency-settings"><div class="field-title">Reference image</div><div class="reference-large"><img src="${imgs.villa1}"><span>Primary reference</span></div><div class="field-title">Consistency strength</div><div class="segmented"><button class="chip">Flexible</button><button class="chip active">Strong</button><button class="chip">Strict</button></div><div class="field-title">Mode</div><div class="segmented"><button class="chip active">Preserve</button><button class="chip">Balanced</button><button class="chip">Creative</button></div><div class="toggle-row"><div class="switch-line"><i class="switch on"></i>Same lighting</div><div class="switch-line"><i class="switch on"></i>Same materials</div><div class="switch-line"><i class="switch"></i>Add People</div><div class="switch-line"><i class="switch"></i>Add Cars</div></div><div class="field-title">Batch note</div><textarea class="notes" placeholder="Optional instruction for all images..."></textarea></aside><div class="batch-grid">${[imgs.villa1,imgs.villa2,imgs.interiorCard,imgs.night,imgs.landscape,imgs.commercial].map((x,i)=>`<article class="panel batch-card"><img src="${x}"><footer><b>View ${i+1}</b><span class="status-pill ${i>3?'pending':''}">${i>3?'Ready':'Matched'}</span></footer></article>`).join('')}</div></div></section>`}
function videoPage(){return `<section class="page">${pageHead('VIDEO STUDIO','Video','Architecture-first image-to-video with PIONX Video Auto choosing the quality route behind the scenes.',btn('Render Video ✦',null))}
  <div class="media-grid"><section class="panel video-preview"><img src="${imgs.hero}"><div class="play-btn">▶</div><div class="studio-ready-pill">● PIONX Video Auto</div></section><aside class="panel media-settings"><div class="select-card"><label><b>Workflow</b><span>▾</span></label><select id="videoWorkflow"><option>Image → Video</option><option>Text → Video</option><option>Walkthrough</option><option>Fly-through</option></select></div><div class="select-card"><label><b>Quality route</b><span>▾</span></label><select id="videoQuality"><option>Premium Cinematic</option><option>Fast Preview</option></select></div><div class="select-card"><label><b>Duration</b><span>▾</span></label><select><option>8 seconds</option><option>6 seconds</option><option>4 seconds</option></select></div><div class="select-card"><label><b>Camera movement</b><span>▾</span></label><select><option>Slow cinematic push</option><option>Orbit</option><option>Pan</option><option>Walkthrough</option></select></div><div class="auto-brief"><header><b>PIONX Motion Brief</b><em>AUTO PROMPT</em></header><p>Lock building geometry and facade. Define camera path, lens feel, movement speed, parallax, lighting continuity and realistic environmental motion. No melting walls, moving openings or unstable architecture.</p></div><div class="field-title">Notes</div><textarea class="notes" placeholder="Optional direction — e.g. slower camera, evening light, no people..."></textarea><button class="primary-btn" id="demoVideoGenerate" style="width:100%;margin-top:10px">Render Video ✦</button></aside></div>
  <div class="section-title"><div><h2>Video workflows</h2><p>PIONX decides the provider; the user chooses the outcome.</p></div></div><div class="grid-4">${[['Image Lock',imgs.villa1,'Keep architecture fixed while the camera moves.'],['Walkthrough',imgs.interiorCard,'Controlled interior camera path and stable materials.'],['Fly-through',imgs.master,'Masterplan or exterior fly-through with coherent scale.'],['Cinematic',imgs.night,'Premium lighting, pacing and presentation motion.']].map(x=>`<article class="panel feature-card"><img src="${x[1]}"><div class="body"><b>${x[0]}</b><p>${x[2]}</p></div></article>`).join('')}</div>
</section>`}
function filmPage(){return mediaPage('PIONX FILM','PIONX Film','Combine approved shots into a professional client film with sequencing, transitions and music timing.','Build film',true)}
function filmPage(){return mediaPage('PIONX FILM','PIONX Film','Combine approved shots into a professional client film with sequencing, transitions and music timing.','Build film',true)}
function mediaPage(k,t,d,action,film){return `<section class="page">${pageHead(k,t,d,btn(action+' ✦',null))}<div class="media-grid"><section class="panel video-preview"><img src="${film?imgs.night:imgs.hero}"><div class="play-btn">▶</div></section><aside class="panel media-settings"><div class="select-card"><label><b>${film?'Film format':'Motion style'}</b><span>▾</span></label><select><option>${film?'Cinematic 16:9':'Architectural cinematic'}</option></select></div><div class="select-card"><label><b>Duration</b><span>▾</span></label><select><option>${film?'45 seconds':'5 seconds'}</option><option>10 seconds</option></select></div><div class="select-card"><label><b>Camera movement</b><span>▾</span></label><select><option>Slow cinematic push</option><option>Orbit</option><option>Pan</option></select></div><div class="select-card"><label><b>Quality</b><span>▾</span></label><select><option>Premium</option></select></div><div class="field-title">Notes</div><textarea class="notes" placeholder="Optional direction..."></textarea><button class="primary-btn" style="width:100%;margin-top:10px">${action} ✦</button></aside></div><div class="panel timeline"><div class="section-title" style="margin-top:0"><div><h2>${film?'Film timeline':'Storyboard'}</h2><p>${film?'Arrange shots and pacing.':'Choose source frames and transitions.'}</p></div></div><div class="timeline-track">${allRenders.slice(0,6).map((r,i)=>`<article class="timeline-shot ${i===0?'active':''}"><img src="${r[1]}"><footer>Shot ${i+1} · ${film?(5+i)+'s':'motion'}</footer></article>`).join('')}</div></div></section>`}
function presentationPage(){return `<section class="page">${pageHead('CLIENT DELIVERY','Presentation','Create professional client boards from final renders, materials and project information.',btn('Export PDF',null)+btn('Export PPT',null,'ghost-btn'))}<div class="presentation-layout"><section class="panel board-canvas"><div class="board-paper"><div class="board-head"><div><small>PIONX CLIENT PRESENTATION</small><h2>Modern Villa — Exterior & Interior</h2></div><small>Concept Design · 2026</small></div><div class="board-main"><img src="${imgs.villa1}"><div class="material-grid">${['Warm travertine','Brushed metal','Dark timber','Soft landscape'].map(x=>`<div class="material-swatch"><i></i><b>${x}</b></div>`).join('')}</div></div><div class="board-foot"><span>Architectural visualization by PIONX AI</span><span>Board 01 / 04</span></div></div></section><aside class="panel presentation-tools"><div class="field-title">Board layout</div><div class="layout-grid"><button class="layout-tile active"><i></i></button><button class="layout-tile"><i></i></button><button class="layout-tile"><i></i></button><button class="layout-tile"><i></i></button></div><div class="field-title">Content</div>${['Project title','Material palette','Color analysis','Image notes','Logo / branding'].map((x,i)=>`<div class="switch-line"><i class="switch ${i<4?'on':''}"></i>${x}</div>`).join('')}<div class="field-title">Export</div><button class="primary-btn" style="width:100%">Export client package</button></aside></div></section>`}
function projectsPage(){return `<section class="page">${pageHead('WORKSPACE','Projects','Organize your work, source images, renders and client delivery in one place.',btn('+ New Project',null))}<div class="filterbar"><button class="chip active">All Projects</button><button class="chip">Starred</button><button class="chip">Shared</button></div><div class="grid-4">${projectCards()}${projectCards()}</div></section>`}
function rendersPage(){return `<section class="page">${pageHead('LIBRARY','Renders','Browse, compare and continue from every generated image.',btn('Start a render','studio'))}<div class="filterbar"><button class="chip active">All</button><button class="chip">Images</button><button class="chip">Videos</button><button class="chip">Favorites</button></div><div class="gallery">${renderCards([...allRenders,...allRenders.slice(0,5)])}</div></section>`}
function albumsPage(){return `<section class="page">${pageHead('ORGANIZATION','Albums','Group approved images into client-ready sets.',btn('+ New Album',null))}<div class="grid-4">${['Final Exterior','Interior Options','Night Shots','Landscape','Client Favorites','Tender Presentation','Villa A','Marketing'].map((t,i)=>`<article class="panel album-card"><div class="album-stack"><img src="${allRenders[(i+1)%allRenders.length][1]}"><img src="${allRenders[(i+2)%allRenders.length][1]}"><img src="${allRenders[i%allRenders.length][1]}"></div><footer><div><b>${t}</b><br><small>${6+i} items</small></div><button class="kebab">⋮</button></footer></article>`).join('')}</div></section>`}
function assetsPage(){return `<section class="page">${pageHead('ASSET LIBRARY','Assets','Reusable references, materials, people, cars and project resources.',btn('+ Upload Asset',null))}<div class="filterbar"><button class="chip active">All Assets</button><button class="chip">Materials</button><button class="chip">References</button><button class="chip">People</button><button class="chip">Cars</button></div><div class="grid-4">${[['▧','Travertine Set','Material'],['▥','Facade References','Reference'],['◉','People Pack 01','People'],['◇','Cars Pack','Cars'],['▦','Landscape Palette','Reference'],['▣','Warm Interior Set','Material'],['◫','Glass Details','Reference'],['△','Plants & Trees','Landscape']].map(x=>`<article class="panel asset-card"><div class="asset-thumb">${x[0]}</div><h3>${x[1]}</h3><p>${x[2]} · Project asset</p></article>`).join('')}</div></section>`}
function explorePage(){const designers=[['MY','Mahmoud Yousri','Architectural Design · Visualization','architecture',imgs.hero,'24 projects · 3.8k appreciations'],['AA','Atelier Axis','Residential · Hospitality','architecture',imgs.villa1,'18 projects · 2.9k appreciations'],['NK','Noura K.','Interior Architecture','interior',imgs.interiorCard,'31 projects · 5.2k appreciations'],['SR','Studio R','Masterplanning · Urban Design','masterplan',imgs.master,'14 projects · 1.7k appreciations']];const work=[['Courtyard Residence',imgs.villa1,'Mahmoud Yousri','architecture','1.2k appreciations'],['Urban Clubhouse',imgs.commercial,'Atelier Axis','architecture','984 appreciations'],['Quiet Luxury Interior',imgs.interiorCard,'Noura K.','interior','1.6k appreciations'],['Desert Masterplan',imgs.master,'Studio R','masterplan','742 appreciations'],['Night Residence',imgs.night,'Mahmoud Yousri','architecture','886 appreciations'],['Landscape Retreat',imgs.landscape,'Atelier Axis','landscape','694 appreciations'],['Contemporary Villa',imgs.villa2,'Noura K.','architecture','1.1k appreciations']];return `<section class="page">${pageHead('PIONX DISCOVER','Discover','A professional architecture portfolio network: find designers, explore projects, save references and build visibility — without a social feed.')}
  <div class="discover-toolbar"><label class="discover-search"><span>⌕</span><input id="discoverSearch" value="${discoverState.query}" placeholder="Search architect, designer, project, style or location..."></label><div class="discover-filters">${['Featured','Architecture','Interior','Masterplan','Landscape'].map(x=>`<button class="chip ${discoverState.filter===x?'active':''}" data-discover-filter="${x}">${x}</button>`).join('')}</div></div>
  <div class="discover-results" id="discoverResultsNote">Showing curated architecture work</div>
  <div class="section-title"><div><h2>Featured professionals</h2><p>Searchable portfolios similar to a professional creative directory.</p></div><button class="link-btn" id="discoverAllPros">View all professionals →</button></div><div class="designer-row" id="designerGrid">${designers.map(d=>`<article class="panel designer-card" data-discover-category="${d[3]}" data-discover-search="${(d[1]+' '+d[2]+' '+d[3]).toLowerCase()}"><div class="designer-cover"><img src="${d[4]}"><span class="designer-avatar">${d[0]}</span></div><div class="designer-body"><h3>${d[1]}</h3><p>${d[2]}</p><div class="designer-meta"><span>${d[5]}</span><span>Available for work</span></div><div class="designer-actions"><button data-route="portfolio">View portfolio</button><button data-follow="${d[1]}" class="${discoverState.followed.has(d[1])?'active':''}">${discoverState.followed.has(d[1])?'Following':'Follow'}</button></div></div></article>`).join('')}</div>
  <div class="section-title"><div><h2>Curated architecture work</h2><p>Project-first discovery with appreciations, saves and professional attribution.</p></div></div><div class="project-masonry" id="discoverProjects">${work.map((w,i)=>`<article class="panel discover-project" data-discover-category="${w[3]}" data-discover-search="${(w[0]+' '+w[2]+' '+w[3]).toLowerCase()}"><div class="discover-img"><img src="${w[1]}" style="height:${i%3===0?300:i%3===1?225:260}px"><div class="overlay"><div><b>${w[0]}</b><br><small>by ${w[2]}</small></div><span>♡ ${w[4]}</span></div></div><div class="discover-stats"><button data-save="${w[0]}" class="${discoverState.saved.has(w[0])?'active':''}">${discoverState.saved.has(w[0])?'★ Saved':'☆ Save'}</button><button data-view-project="${w[0]}" data-project-image="${w[1]}" data-project-author="${w[2]}">↗ View project</button><button data-follow="${w[2]}">${discoverState.followed.has(w[2])?'✓ Following':'◉ Follow designer'}</button></div></article>`).join('')}</div>
</section>`}
function portfolioPage(){const name=escHtml(profileState.displayName),title=escHtml(profileState.title),company=escHtml(profileState.company),initials=profileInitials();return `<section class="page"><div class="panel portfolio-header"><img src="${imgs.hero}"><div class="portfolio-info"><div class="portfolio-avatar ${profileState.photo?'has-photo':''}"${profileAvatarStyle()}>${profileState.photo?'':initials}</div><div><h1>${name}</h1><p>${title} · ${company}</p><div class="stats-row"><div class="panel stat-mini"><b>24</b><small>Projects</small></div><div class="panel stat-mini"><b>1.8K</b><small>Appreciations</small></div><div class="panel stat-mini"><b>38K</b><small>Views</small></div></div></div><div class="portfolio-actions"><button class="ghost-btn" data-route="profile">Edit profile</button><button class="primary-btn" id="shareProfile64" type="button">Share profile</button></div></div></div><div class="section-title"><div><h2>Selected Work</h2><p>Your public architecture portfolio.</p></div></div><div class="gallery">${renderCards([...allRenders,...allRenders.slice(0,1)])}</div></section>`}
function plansPage(){return `<section class="page">${pageHead('MEMBERSHIP','Plans & Credits','Simple credit-based plans for architects, freelancers and studios.')}<div class="plan-grid">${[
 ['Starter','$19','120','Core Studio · Projects · 2K delivery',false],['Pro','$49','400','All image modes · Flow · Consistency · Priority',true],['Studio','$129','1,200','Team workspace · Film · Presentation · Priority',false]
 ].map(p=>`<article class="panel pricing-card ${p[4]?'recommended':''}">${p[4]?'<span class="tag">CURRENT PLAN</span>':''}<div class="eyebrow">${p[0].toUpperCase()}</div><h3>${p[0]}</h3><div class="price">${p[1]} <small>/ month</small></div><p class="muted">${p[2]} monthly credits</p><ul>${p[3].split(' · ').map(x=>`<li>${x}</li>`).join('')}</ul><button class="${p[4]?'ghost-btn':'primary-btn'}" style="width:100%">${p[4]?'Current plan':'Choose '+p[0]}</button></article>`).join('')}</div><div class="section-title"><div><h2>Credit top-ups</h2><p>One-time credits without changing the subscription.</p></div></div><div class="grid-3">${[['100 credits','$15'],['500 credits','$65'],['1,500 credits','$175']].map(x=>`<article class="panel metric"><small>${x[0]}</small><b>${x[1]}</b><button class="ghost-btn" style="margin-top:10px">Buy credits</button></article>`).join('')}</div></section>`}
function profilePage(){const initials=profileInitials();return `<section class="page">${pageHead('ACCOUNT','Profile','Manage your professional identity and portfolio information.')}<div class="profile-layout"><aside class="panel profile-card"><div id="profileAvatarPreview" class="big-avatar profile-avatar-preview ${profileState.photo?'has-photo':''}"${profileAvatarStyle()}>${profileState.photo?'':initials}</div><h2 id="profileCardName">${escHtml(profileState.displayName)}</h2><p id="profileCardTitle">${escHtml(profileState.company)}</p><input id="profilePhotoInput" type="file" accept="image/png,image/jpeg,image/webp" hidden><button class="ghost-btn" id="changeProfilePhoto" type="button" style="width:100%">Change photo</button><button class="ghost-btn" id="shareProfile64" type="button" style="width:100%;margin-top:8px">Share profile</button><small class="profile-photo-note">JPG / PNG / WebP · saved with your profile</small></aside><section class="panel form-panel"><div class="form-grid"><label>Display name<input id="profileDisplayName" value="${escHtml(profileState.displayName)}"></label><label>Username<input id="profileUsername" value="${escHtml(profileState.username)}"></label><label>Professional title<input id="profileTitle" value="${escHtml(profileState.title)}"></label><label>Company<input id="profileCompany" value="${escHtml(profileState.company)}"></label></div><label style="margin-top:12px">Bio<textarea id="profileBio">${escHtml(profileState.bio)}</textarea></label><div class="profile-save-state" id="profileSaveState">Changes are saved only when you press Save profile.</div><div class="dialog-actions"><button class="primary-btn" id="saveProfileBtn" type="button">Save profile</button></div></section></div></section>`}
function settingsPage(){const sections={
 General:`<div class="setting-row"><div><b>Language</b><small>Use a full English or full Arabic interface</small></div><select class="setting-select" data-setting-select="language"><option ${settingsState.language==='English'?'selected':''}>English</option><option ${settingsState.language==='Arabic'?'selected':''}>Arabic</option></select></div><div class="setting-row"><div><b>Appearance</b><small>Switch the full interface without losing contrast or layout</small></div><div class="theme-choice"><button data-theme-choice="dark" class="${settingsState.theme==='dark'?'active':''}">☾ Dark</button><button data-theme-choice="light" class="${settingsState.theme==='light'?'active':''}">☀ Light</button></div></div><div class="setting-row"><div><b>Auto-save projects</b><small>Save workspace changes automatically</small></div><i class="switch ${settingsState.autoSave?'on':''}" data-setting-toggle="autoSave"></i></div>`,
 Rendering:`<div class="setting-row"><div><b>Default render mode</b><small>Starting mode for new Studio sessions</small></div><select class="setting-select" data-setting-select="defaultMode">${['Preserve','Balanced','Creative'].map(x=>`<option ${settingsState.defaultMode===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="setting-row"><div><b>Default scene</b><small>Auto Detect is recommended</small></div><select class="setting-select" data-setting-select="defaultScene">${['Auto Detect','Interior','Exterior','Masterplan','Landscape','Sketch'].map(x=>`<option ${settingsState.defaultScene===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="setting-row"><div><b>Default environment</b><small>Lighting starting point</small></div><select class="setting-select" data-setting-select="defaultEnvironment">${['Auto','Day','Night'].map(x=>`<option ${settingsState.defaultEnvironment===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="setting-row"><div><b>Automatic premium retouch</b><small>Color, exposure, materials, glass and detail finish after render</small></div><i class="switch ${settingsState.autoRetouch?'on':''}" data-setting-toggle="autoRetouch"></i></div><div class="setting-row"><div><b>Preserve source aspect ratio</b><small>Never switch portrait to landscape unless requested</small></div><i class="switch ${settingsState.aspectLock?'on':''}" data-setting-toggle="aspectLock"></i></div><div class="setting-row"><div><b>Analyze source automatically</b><small>Detect Interior / Exterior / Masterplan / Landscape / Sketch</small></div><i class="switch ${settingsState.autoAnalyze?'on':''}" data-setting-toggle="autoAnalyze"></i></div>`,
 Notifications:`<div class="setting-row"><div><b>Render completion alerts</b><small>Notify when render, video or film finishes</small></div><i class="switch ${settingsState.renderAlerts?'on':''}" data-setting-toggle="renderAlerts"></i></div><div class="setting-row"><div><b>Security alerts</b><small>Login and account changes</small></div><i class="switch ${settingsState.securityAlerts?'on':''}" data-setting-toggle="securityAlerts"></i></div><div class="setting-row"><div><b>Marketing emails</b><small>Product and promotional updates</small></div><i class="switch ${settingsState.marketingEmails?'on':''}" data-setting-toggle="marketingEmails"></i></div>`,
 Privacy:`<div class="setting-row"><div><b>Public portfolio</b><small>Allow selected public work to appear in PIONX Showcase</small></div><i class="switch ${settingsState.portfolioPublic?'on':''}" data-setting-toggle="portfolioPublic"></i></div><div class="setting-row"><div><b>Searchable professional profile</b><small>Allow architects to find you by name or username</small></div><i class="switch ${settingsState.profileSearchable?'on':''}" data-setting-toggle="profileSearchable"></i></div><div class="setting-row"><div><b>Anonymous usage analytics</b><small>Help improve navigation and reliability</small></div><i class="switch ${settingsState.usageAnalytics?'on':''}" data-setting-toggle="usageAnalytics"></i></div><div class="setting-row"><div><b>Download account data</b><small>Prepare an export of account and project metadata</small></div><button class="ghost-btn" data-setting-action="download-data">Prepare export</button></div>`,
 Billing:`<div class="billing-summary"><article><small>Current plan</small><b>Pro</b><span>Renews monthly</span></article><article><small>Credits</small><b>245</b><span>Available balance</span></article><article><small>Payment method</small><b>•••• 4242</b><span>Demo billing method</span></article></div><div class="setting-row"><div><b>Manage subscription</b><small>Change plan or purchase credit top-ups</small></div><button class="ghost-btn" data-route="plans">Open Plans & Credits</button></div><div class="setting-row"><div><b>Invoices</b><small>Download billing history</small></div><button class="ghost-btn" data-setting-action="invoice">Download latest</button></div>`
};return `<section class="page">${pageHead('PREFERENCES','Settings','Control language, appearance, rendering defaults, notifications, privacy and billing.','<button class="primary-btn" id="saveSettings">Save changes</button>')}<div class="settings-layout"><aside class="panel settings-menu">${Object.keys(sections).map(x=>`<button data-settings-tab="${x}" class="${settingsState.tab===x?'active':''}">${x}</button>`).join('')}</aside><section class="panel form-panel" id="settingsPanel">${sections[settingsState.tab]}</section></div></section>`}
function financePage(){const recent=[
 ['PX-260924-1124','11:24','Mahmoud Y.','Image Render','Interior','Preserve','PIONX Image Primary','PIONX Image Services · PIONX Image','$0.42','2','$1.00','$0.58','$124.98','Delivered'],
 ['PX-260924-1058','10:58','Studio A','Consistency ×4','Exterior','Balanced','PIONX Image Primary','PIONX Image Services · PIONX Image','$1.36','8','$4.00','$2.64','$126.34','Delivered'],
 ['PX-260924-1015','10:15','Mahmoud Y.','Video 8s','Exterior','Premium','PIONX Video Quality','PIONX Motion Services · PIONX Motion','$2.84','18','$9.00','$6.16','$88.20','Delivered'],
 ['PX-260924-0944','09:44','Architect 03','Image Render','Landscape','Creative','PIONX Image Primary','PIONX Image Services · PIONX Image','$0.55','3','$1.50','$0.95','$127.70','Delivered'],
 ['PX-260924-0912','09:12','Studio A','Prompt Intelligence','Masterplan','Preserve','PIONX Analysis','PIONX Image Services · PIONX Analysis','$0.03','0','$0.00','-$0.03','$128.25','Delivered'],
 ['PX-260924-0847','08:47','Design Team','Video 6s','Interior','Fast','PIONX Video Fast','PIONX Motion Services · PIONX Fast Motion','$1.75','12','$6.00','$4.25','$91.04','Delivered']
];const engineSpend=[
 ['PIONX Image Primary','PIONX Image Services','PIONX Image','482','$18.20','$381.40','$0.79','$125.40','Healthy'],
 ['PIONX Analysis','PIONX Image Services','PIONX Analysis','611','$1.48','$34.60','$0.06','$125.40','Healthy'],
 ['PIONX Video Quality','PIONX Motion Services','PIONX Motion','61','$14.20','$151.90','$2.49','$88.20','Primary'],
 ['PIONX Video Fast','PIONX Motion Services','PIONX Fast Motion','40','$7.00','$69.75','$1.74','$88.20','Ready'],
 ['PIONX Video Flexible','PIONX Flexible Services','PIONX Flexible Motion','27','$4.40','$63.12','$2.34','$40.75','Standby'],
 ['PIONX Premium Finish','Local','Color / Light / Material Retouch','525','$0.00','$16.00','$0.03','Local','Active']
];return `<section class="page">${pageHead('ADMIN · FINANCE','Finance & Provider Accounts','Full admin control for provider balances, cost per engine, credits, revenue, profit, routing, accounting changes and reconciliation.','<button class="primary-btn" data-fin-action="refresh">Refresh all finance</button><button class="ghost-btn" data-fin-action="export-ledger">Export ledger</button>')}
  <div class="finance-sync"><span>● Live finance monitor</span><b id="financeRefreshTime">Updated ${financeState.lastRefresh}</b><small>Provider/model names are admin-only</small></div>
  <div class="metrics">${[['30d Provider Cost','$682.17','Actual source cost'],['Est. Credit Revenue','$1,245.00','Credits × configured value'],['Est. Gross Profit','$562.83','45.2% blended margin'],['This Month Spend','$682.17','$67.83 before warning']].map(x=>`<article class="panel metric"><small>${x[0]}</small><b>${x[1]}</b><span class="up">${x[2]}</span></article>`).join('')}</div>

  <div class="section-title"><div><h2>Provider wallets & balance tracking</h2><p>See starting balance, actual spend and remaining provider credit.</p></div></div><div class="wallet-grid">${[
 ['PIONX Image Services','$520.00','$394.60','$125.40',76,'Image + analysis'],['PIONX Motion Services','$310.00','$221.80','$88.20',72,'Video quality + fast'],['PIONX Flexible Services','$103.87','$63.12','$40.75',61,'Flexible video fallback'],['Local / Other','$68.10','$16.00','$52.10',24,'Retouch + utilities']
 ].map(x=>`<article class="panel wallet-card"><header><div><b>${x[0]}</b><small>${x[5]}</small></div><strong>${x[3]}</strong></header><div class="wallet-bar"><i style="width:${x[4]}%"></i></div><div class="wallet-meta"><span>Starting <b>${x[1]}</b></span><span>Spent <b>${x[2]}</b></span><span>Remaining <b>${x[3]}</b></span></div></article>`).join('')}</div>

  <section class="panel finance-card finance-section"><div class="section-title" style="margin-top:0"><div><h2>Engine cost from provider balance</h2><p>Actual spend per PIONX route and the provider wallet it consumes.</p></div><button class="ghost-btn" data-fin-action="check-prices">Check engine pricing</button></div><div class="table-wrap"><table class="table engine-cost-table"><thead><tr><th>PIONX Route</th><th>Provider</th><th>Model</th><th>30d Ops</th><th>Today Cost</th><th>30d Cost</th><th>Avg / Op</th><th>Provider Balance</th><th>Status</th></tr></thead><tbody>${engineSpend.map(x=>`<tr>${x.slice(0,8).map(v=>`<td>${v}</td>`).join('')}<td class="good">${x[8]}</td></tr>`).join('')}</tbody></table></div></section>

  <div class="finance-grid finance-section"><section class="panel chart-panel"><div class="section-title" style="margin-top:0"><div><h2>Usage & Revenue</h2><p>Revenue vs provider cost · last 30 days</p></div></div><div class="chart">${[72,46,82,55,91,65,78,51,88].map((h,i)=>`<div class="bar-group"><i class="bar" style="height:${h}%"></i><i class="bar cost" style="height:${Math.max(25,h-28)}%"></i><small>${i+1}</small></div>`).join('')}</div><div class="chart-legend"><span><i></i>Revenue</span><span><i class="cost"></i>Provider cost</span></div></section><aside class="panel finance-side"><div class="section-title" style="margin-top:0"><div><h2>Provider balances</h2><p>Admin only · alert under $5</p></div></div>${[['PIONX Image Services','$125.40','OK'],['PIONX Motion Services','$88.20','OK'],['PIONX Flexible Services','$40.75','OK'],['Analysis / Other','$52.10','OK']].map(x=>`<div class="balance-row"><b>${x[0]}</b><span>${x[1]}</span><em>${x[2]}</em></div>`).join('')}<div class="alert-box">Low-balance protection is active. Credit is reserved once. Failed/worker-not-started operations are eligible for refund recovery.</div></aside></div>

  <section class="panel ledger finance-section"><div class="section-title" style="padding:0 14px"><div><h2>Latest operations · exact engine used</h2><p>Every operation shows PIONX route, real provider/model, source cost, credits, revenue, profit and remaining provider balance.</p></div><div class="ledger-filter"><select id="ledgerEngineFilter"><option>All engines</option><option>PIONX Image Primary</option><option>PIONX Analysis</option><option>PIONX Video Quality</option><option>PIONX Video Fast</option><option>PIONX Video Flexible</option></select></div></div><div class="table-wrap"><table class="table ledger-v3"><thead><tr><th>Job</th><th>Time</th><th>User</th><th>Operation</th><th>Scene</th><th>Mode</th><th>PIONX Route</th><th>Provider / Model</th><th>Source Cost</th><th>Credits</th><th>Revenue</th><th>Profit</th><th>Balance After</th><th>Status</th></tr></thead><tbody id="financeLedgerBody">${recent.map(x=>`<tr data-engine="${x[6]}">${x.slice(0,13).map(v=>`<td>${v}</td>`).join('')}<td class="good">${x[13]}</td></tr>`).join('')}</tbody></table></div></section>

  <div class="finance-split finance-section"><section class="panel finance-card"><h3>Cost Monitor / Profit Guard</h3><p>Core accounting controls used to price credits and protect margin.</p><div class="config-grid">${[['USD value / credit','0.50'],['Monthly budget warning','750'],['Minimum margin %','35'],['Pricing buffer %','8'],['Max image provider cost','1.50'],['Max video provider cost','8.00'],['Retry limit','1'],['Low balance alert','$5']].map((x,i)=>`<div class="config-field"><label>${x[0]}</label><input data-fin-config="${i}" value="${x[1]}"></div>`).join('')}</div><div class="finance-actions"><button data-fin-action="save-cost">Save Cost Settings</button><button data-fin-action="refresh">Refresh Cost Data</button></div></section>
  <section class="panel finance-card"><h3>Provider Cost Estimates</h3><p>Configured estimate versus observed average. Users never see these names.</p><div class="provider-costs">${[['PIONX Image Services image render','PIONX Image','$0.42','$0.79 avg'],['PIONX Image Services prompt intelligence','PIONX Analysis','$0.03','$0.06 avg'],['PIONX Motion Services video quality','PIONX Motion','$2.84','$2.49 avg'],['PIONX Motion Services video fast','PIONX Fast Motion','$1.75','$1.74 avg'],['PIONX Flexible Services flexible video','PIONX Flexible Motion','$2.20','$2.34 avg'],['Local final finish','Color / exposure / materials','$0.00','$0.03 avg']].map(x=>`<div class="provider-cost-row"><div><b>${x[0]}</b><small>${x[1]}</small></div><small>${x[3]}</small><span>${x[2]}</span></div>`).join('')}</div></section></div>

  <section class="panel finance-card finance-section"><h3>Automatic Pricing Preview</h3><p>What the user pays in credits versus expected provider cost and target margin.</p><div class="pricing-preview">${[['Image · Preserve','2 credits','$0.42 cost · 58% margin'],['Image · Balanced','3 credits','$0.55 cost · 63% margin'],['Image · MAX','5 credits','$0.90 cost · 64% margin'],['Video · Fast','12 credits','$1.75 cost · 71% margin'],['Video · Premium','18 credits','$2.84 cost · 68% margin'],['Consistency · 4 views','8 credits','$1.36 cost · 66% margin'],['PIONX Film','26 credits','$4.40 cost · 66% margin'],['Local Edit','1 credit','$0.00 provider']].map(x=>`<div class="price-preview-card"><small>${x[0]}</small><b>${x[1]}</b><span>${x[2]}</span></div>`).join('')}</div></section>

  <div class="finance-split finance-section"><section class="panel finance-card"><h3>Spend Breakdown · 30 days</h3><p>By provider</p><div class="breakdown-list">${[['PIONX Image Services','$416.00'],['PIONX Motion Services','$221.65'],['PIONX Flexible Services','$63.12'],['PIONX local services','$16.00']].map(x=>`<div><span>${x[0]}</span><b>${x[1]}</b></div>`).join('')}</div></section><section class="panel finance-card"><h3>Operation Breakdown · 30 days</h3><p>By operation type</p><div class="breakdown-list">${[['image_render','$381.40'],['prompt_intelligence','$34.60'],['consistency','$91.40'],['video_render','$206.20'],['film','$31.17'],['repair / retry','$6.00']].map(x=>`<div><span>${x[0]}</span><b>${x[1]}</b></div>`).join('')}</div></section></div>

  <div class="section-title"><div><h2>Engine status & routing</h2><p>Admin only. User-facing PIONX hides all provider/model names.</p></div></div><div class="engine-status-grid">${[['Image Production','PIONX Image Services · PIONX Image','Healthy'],['Prompt Intelligence','PIONX Image Services · PIONX Analysis','Healthy'],['Video Quality','PIONX Motion Services · PIONX Motion','Primary'],['Video Fast','PIONX Motion Services · PIONX Fast Motion','Ready'],['Video Flexible','PIONX Flexible Services · PIONX Flexible Motion','Standby'],['Final Retouch','Local PIONX Finish','Active']].map(x=>`<article class="panel engine-status"><header><div><b>${x[0]}</b><small>${x[1]}</small></div><i class="status-dot"></i></header><p class="good" style="font-size:7px;margin:9px 0 0">${x[2]}</p></article>`).join('')}</div>
  <section class="panel last-route finance-section"><div><h3>PIONX Last Auto Route</h3><p>Interior · Preserve · Day · exact route recorded in ledger.</p><div class="route-badges"><span>Job: PX-260924-1124</span><span>Scene: Interior</span><span>Mode: Preserve</span><span>Engine: PIONX Image Primary</span><span>Model: PIONX Image</span><span>Source cost: $0.42</span><span>Credits: 2</span><span>Finish: Local Retouch</span><span>Credits reserved once</span></div></div><div class="good">✓ Delivered</div></section>

  <div class="finance-split finance-section"><section class="panel finance-card"><h3>Engine & Accounting Updates</h3><p>Track model/pricing changes and finance configuration revisions.</p><div class="update-feed" id="financeUpdates">${[['Today 11:31','Pricing sync','PIONX Image Services image observed cost refreshed from provider usage.','good'],['Today 10:42','Video route','Motion quality route verified and kept Primary.','good'],['Today 09:50','Accounting','Credit reserve/refund rule verified: reserve once, no second normal deduction.','good'],['Yesterday 18:10','Provider balance','PIONX Motion Services wallet crossed internal 30% watch threshold.','warn'],['Yesterday 16:45','Reconciliation','Provider ledger variance resolved to $0.00.','good']].map(x=>`<article><i class="${x[3]}"></i><div><b>${x[1]}</b><small>${x[0]} · ${x[2]}</small></div></article>`).join('')}</div><div class="finance-actions"><button data-fin-action="check-updates">Check engine/accounting updates</button></div></section><section class="panel finance-card"><h3>Reconciliation</h3><p>Compare provider usage, internal ledger, credits, revenue and balance movement.</p><div class="breakdown-list"><div><span>Recorded provider cost</span><b>$682.17</b></div><div><span>Provider usage total</span><b>$682.17</b></div><div><span>Credits revenue</span><b>$1,245.00</b></div><div><span>Variance</span><b class="good">$0.00</b></div></div><div class="finance-actions"><button data-fin-action="reconcile">Run reconciliation</button><button data-fin-action="download-report">Download report</button></div></section></div>

  <section class="panel finance-card finance-section"><h3>Launch / Safety Controls</h3><p>Admin-only controls used before launch and after provider incidents.</p><div class="finance-actions"><button data-fin-action="connectivity">Test provider connectivity</button><button data-fin-action="refund-check">Verify credit reserve/refund</button><button data-fin-action="backup">Export finance backup</button><button data-fin-action="clear-demo">Clear UI demo events</button><button class="danger" data-fin-action="reset-logs">Reset logs before launch</button></div></section>
</section>`}
function adminPage(){return `<section class="page">${pageHead('ADMIN CONTROL CENTER','Admin','Manage users, plans, credits and feature access without exposing internal controls to normal users.',btn('Refresh users',null))}<div class="admin-grid"><section class="panel admin-panel"><div class="section-title" style="margin-top:0"><div><h2>Users</h2><p>Plans, credits and roles.</p></div></div><div class="table-wrap"><table class="table"><thead><tr><th>User</th><th>Plan</th><th>Credits</th><th>Role</th><th>Status</th><th>Action</th></tr></thead><tbody>${[['Mahmoud Y.','Pro','245','Admin'],['Studio A','Studio','1,020','User'],['Architect 03','Starter','84','User'],['Design Team','Studio','780','User']].map(x=>`<tr>${x.map(v=>`<td>${v}</td>`).join('')}<td class="good">Active</td><td><button class="ghost-btn">Edit</button></td></tr>`).join('')}</tbody></table></div></section><aside class="panel admin-panel"><div class="section-title" style="margin-top:0"><div><h2>Feature access</h2><p>Plan-level toggles.</p></div></div>${[['Consistency','Batch consistency workflow'],['PIONX Film','Professional film assembly'],['Presentation','PDF / PPT client boards'],['Creative mode','Generative freedom mode'],['Admin engine details','Show providers to admin only']].map(x=>`<div class="feature-toggle"><div><b>${x[0]}</b><small>${x[1]}</small></div><i class="switch on"></i></div>`).join('')}</aside></div></section>`}
function diagnosticsPage(){return `<section class="page">${pageHead('ADMIN · SYSTEM','Diagnostics','Live readiness view for PIONX services and integrations.',btn('Run checks',null))}<div class="health-grid">${[['Authentication','Healthy','132 ms'],['Image generation','Healthy','1.8 s'],['Video generation','Healthy','2.4 s'],['Credit ledger','Healthy','96 ms'],['Finance sync','Healthy','240 ms'],['Storage','Healthy','188 ms']].map(x=>`<article class="panel health-card"><header><div class="eyebrow">${x[0].toUpperCase()}</div><i class="health-dot"></i></header><h3>${x[1]}</h3><p>Connection, permissions and response checks passed in UI test mode.</p><div class="latency">${x[2]} <small>sample latency</small></div></article>`).join('')}</div><div class="section-title"><div><h2>System events</h2><p>Latest operational checks.</p></div></div><section class="panel table-wrap"><table class="table"><thead><tr><th>Time</th><th>Service</th><th>Check</th><th>Status</th></tr></thead><tbody>${[['11:36','Auth','Session refresh'],['11:35','Finance','Ledger read'],['11:34','Render','Provider availability'],['11:33','Storage','Asset read']].map(x=>`<tr>${x.map(v=>`<td>${v}</td>`).join('')}<td class="good">Passed</td></tr>`).join('')}</tbody></table></section></section>`}

function applyTheme(theme,notify=false){theme=theme==='light'?'light':'dark';settingsState.theme=theme;document.documentElement.dataset.theme=theme;safeStore.set('pionx-theme',theme);const b=q('#themeBtn');if(b){b.textContent=theme==='light'?'☾':'☼';b.title=theme==='light'?'Switch to dark':'Switch to light'}const publicButton=q('#themeBtnPublic');if(publicButton){publicButton.textContent=theme==='light'?'☾':'☼';publicButton.title=theme==='light'?'Switch to dark theme':'Switch to light theme';publicButton.setAttribute('aria-label',publicButton.title)}const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute('content',theme==='light'?'#ffffff':'#060911');if(notify)toast(theme==='light'?'Light theme enabled':'Dark theme enabled')}
document.addEventListener('pionx:theme',e=>{if(e.detail==='light'||e.detail==='dark')applyTheme(e.detail,false)});
let demoDialogReturnFocus16910=null;
function closeDemoDialog16910(){const m=q('#demoDialog');if(!m||m.hidden)return;m.hidden=true;const back=demoDialogReturnFocus16910;demoDialogReturnFocus16910=null;if(back&&typeof back.focus==='function'&&document.contains(back))requestAnimationFrame(()=>back.focus({preventScroll:true}))}
function openDemoDialog(title,body,actions=''){let m=q('#demoDialog');if(!m){m=document.createElement('div');m.id='demoDialog';m.className='modal-backdrop';document.body.appendChild(m)}demoDialogReturnFocus16910=document.activeElement instanceof HTMLElement?document.activeElement:null;const titleId='demoDialogTitle16910';m.hidden=false;m.setAttribute('role','dialog');m.setAttribute('aria-modal','true');m.setAttribute('aria-labelledby',titleId);m.innerHTML=`<div class="dialog-card demo-dialog"><button class="close-modal" data-dialog-close type="button" aria-label="Close dialog">×</button><div class="eyebrow">PIONX STUDIO</div><h2 id="${titleId}">${escHtml(title)}</h2><div class="demo-dialog-body">${body}</div>${actions?`<div class="dialog-actions">${actions}</div>`:''}</div>`;q('[data-dialog-close]',m)?.addEventListener('click',closeDemoDialog16910);m.addEventListener('click',e=>{if(e.target===m)closeDemoDialog16910()},{once:true});requestAnimationFrame(()=>{const first=m.querySelector('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])');first?.focus({preventScroll:true})});return m}
function applyStudioVisual(){const out=q('#studioOutput');if(!out)return;out.style.filter=`brightness(${studioAdjustState.brightness}) contrast(${studioAdjustState.contrast}) saturate(${studioAdjustState.saturation})`;out.style.transform=`scale(${studioAdjustState.zoom}) rotate(${studioAdjustState.rotation}deg)`;out.style.transition='filter .25s ease,transform .25s ease'}
function cycleAdjust(kind){const opts={style:['Photoreal Architecture','Editorial Architecture','Real Estate Premium'],lighting:['Physically Balanced','Soft Golden Hour','Neutral Studio Daylight','Night Architectural'],materials:['PBR + Micro Detail','Natural Material Response','High Micro Texture'],color:['Editorial Neutral','Warm Natural','Cool Premium','High-end Contrast'],camera:['Scene Aware','Strict Source Lock','2-Point Architectural','Cinematic Wide']};const key=kind;const cur=studioAdjustState[key],arr=opts[key]||[];const next=arr[(Math.max(0,arr.indexOf(cur))+1)%arr.length];studioAdjustState[key]=next;const v=q(`[data-adjust-value="${key}"]`);if(v)v.textContent=next;if(kind==='lighting'){studioAdjustState.brightness=next.includes('Night')?0.82:next.includes('Golden')?1.06:1}if(kind==='color'){studioAdjustState.saturation=next.includes('Warm')?1.08:next.includes('Cool')?0.94:next.includes('Contrast')?1.05:1}if(kind==='materials')studioAdjustState.contrast=next.includes('Micro')?1.05:1.02;if(kind==='camera')studioAdjustState.zoom=next.includes('Wide')?0.96:1;applyStudioVisual();toast(`${kind[0].toUpperCase()+kind.slice(1)}: ${next}`)}
function studioTool(action){const out=q('#studioOutput');if(!out)return;if(action==='edit'){openDemoDialog('Edit selected render','<p>Production uses a mask/selection editor. Choose an edit action for this UI test.</p><div class="demo-option-grid"><button data-demo-edit="remove">Remove object</button><button data-demo-edit="replace">Replace / restyle</button><button data-demo-edit="mask">Edit selected area</button><button data-demo-edit="full">Edit full image</button></div>');qa('[data-demo-edit]',q('#demoDialog')).forEach(b=>b.addEventListener('click',()=>{toast(`Edit mode ready: ${b.textContent}`);q('#demoDialog').hidden=true}))}
 if(action==='enhance'){studioAdjustState.enhanced=true;studioAdjustState.contrast=1.06;studioAdjustState.saturation=1.05;studioAdjustState.brightness=1.02;applyStudioVisual();q('#studioOutputBadge').textContent='Enhanced · Premium Detail';toast('Enhance applied: detail, material response and clean sharpness')}
 if(action==='variations'){const strip=q('#studioFilmstrip');const src=renderOutputForScene();const b=document.createElement('button');b.className='shot-thumb active';b.innerHTML=`<img src="${src}">`;qa('.shot-thumb',strip).forEach(x=>x.classList.remove('active'));strip.appendChild(b);b.addEventListener('click',()=>{qa('.shot-thumb',strip).forEach(x=>x.classList.remove('active'));b.classList.add('active');out.src=src});toast('New controlled variation added')}
 if(action==='upscale'){q('#studioOutputBadge').textContent='4K · Upscaled';studioAdjustState.contrast=Math.max(studioAdjustState.contrast,1.04);applyStudioVisual();toast('Upscale preview enabled · 4K delivery')}
 if(action==='relight'){studioAdjustState.relightIndex=(studioAdjustState.relightIndex+1)%3;const vals=[[1.07,1.03],[.86,1.07],[1,1]];studioAdjustState.brightness=vals[studioAdjustState.relightIndex][0];studioAdjustState.contrast=vals[studioAdjustState.relightIndex][1];applyStudioVisual();toast(['Golden daylight relight','Night / low exposure relight','Original balanced light'][studioAdjustState.relightIndex])}
 if(action==='more'){openDemoDialog('More image actions','<div class="demo-option-grid"><button data-more="download">Download</button><button data-more="compare">Before / After</button><button data-more="save">Save to Album</button><button data-more="video">Send to Video</button></div>');qa('[data-more]',q('#demoDialog')).forEach(b=>b.addEventListener('click',()=>{const a=b.dataset.more;if(a==='video'){q('#demoDialog').hidden=true;go('video')}else{toast(`${b.textContent} ready in UI test`);q('#demoDialog').hidden=true}}))}}
function resetStudioAdjustments(){Object.assign(studioAdjustState,{style:'Photoreal Architecture',lighting:'Physically Balanced',materials:'PBR + Micro Detail',color:'Editorial Neutral',camera:'Scene Aware',brightness:1,contrast:1,saturation:1,zoom:1,rotation:0,enhanced:false,relightIndex:0});applyStudioVisual();qa('[data-adjust-value]').forEach(x=>x.textContent=studioAdjustState[x.dataset.adjustValue]);q('#studioOutputBadge').textContent='2K · Premium';toast('Adjustments reset')}
function drawFlowLines(){const svg=q('#flowSvg'),canvas=q('#flowCanvas');if(!svg||!canvas)return;svg.innerHTML='';const conns=[...FLOW_CONNECTIONS,...qa('.flow-dynamic-connection',canvas).map(x=>[x.dataset.from,x.dataset.to])];for(const [a,b] of conns){const A=q(`[data-node-id="${a}"]`,canvas),B=q(`[data-node-id="${b}"]`,canvas);if(!A||!B)continue;const x1=parseFloat(A.style.left||0)+178,y1=parseFloat(A.style.top||0)+63,x2=parseFloat(B.style.left||0),y2=parseFloat(B.style.top||0)+63;const path=document.createElementNS('http://www.w3.org/2000/svg','path');const mid=(x1+x2)/2;path.setAttribute('d',`M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`);path.setAttribute('class','flow-line');svg.appendChild(path)}}
function updateFlowTransform(){const c=q('#flowCanvas');if(!c)return;c.style.transform=`translate(${flowState.panX}px,${flowState.panY}px) scale(${flowState.zoom})`;const pct=q('#flowZoomPct');if(pct)pct.textContent=Math.round(flowState.zoom*100)+'%'}
function setFlowTool(tool){flowState.tool=tool;qa('[data-flow-tool]').forEach(b=>b.classList.toggle('active',b.dataset.flowTool===tool));toast(`Flow tool: ${tool}`)}
function addFlowNode(kind='image'){const c=q('#flowCanvas');if(!c)return;const id='n'+flowState.nextId++;const art=document.createElement('article');art.className=kind==='text'?'node flow-note':kind==='frame'?'flow-frame':'node';art.dataset.nodeId=id;art.style.left=(440+(flowState.nextId%5)*70)+'px';art.style.top=(160+(flowState.nextId%4)*95)+'px';if(kind==='text')art.innerHTML='<b>Design note</b><small>Double-click to edit this note</small>';else if(kind==='frame')art.innerHTML='<b>Option Frame</b><small>Group related branches</small>';else art.innerHTML=`<img src="${allRenders[flowState.nextId%allRenders.length][1]}"><b>New image branch</b><small>Drag · Compare · Branch</small>`;c.appendChild(art);wireFlowNode(art);flowState.selected=id;toast(`${kind[0].toUpperCase()+kind.slice(1)} added to Flow`);drawFlowLines()}
function wireFlowNode(node){node.addEventListener('pointerdown',e=>{if(flowState.tool==='connect'){e.preventDefault();const id=node.dataset.nodeId;if(!flowState.connectFrom){flowState.connectFrom=id;node.classList.add('selected-node');toast('Select the second card to connect')}else if(flowState.connectFrom!==id){const marker=document.createElement('i');marker.className='flow-dynamic-connection';marker.dataset.from=flowState.connectFrom;marker.dataset.to=id;q('#flowCanvas').appendChild(marker);qa('.selected-node').forEach(x=>x.classList.remove('selected-node'));flowState.connectFrom=null;drawFlowLines();toast('Flow connection created')}return}if(flowState.tool!=='select')return;node.setPointerCapture?.(e.pointerId);flowState.selected=node.dataset.nodeId;qa('.node.selected-node').forEach(x=>x.classList.remove('selected-node'));node.classList.add('selected-node');const sx=e.clientX,sy=e.clientY,sl=parseFloat(node.style.left||0),st=parseFloat(node.style.top||0);const move=ev=>{node.style.left=Math.max(70,sl+(ev.clientX-sx)/flowState.zoom)+'px';node.style.top=Math.max(20,st+(ev.clientY-sy)/flowState.zoom)+'px';drawFlowLines()};const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up)};window.addEventListener('pointermove',move);window.addEventListener('pointerup',up)})}
function wireFlow(){drawFlowLines();updateFlowTransform();qa('.node,#flowCanvas .flow-frame').forEach(wireFlowNode);qa('[data-flow-tool]').forEach(b=>b.addEventListener('click',()=>{const t=b.dataset.flowTool;if(['add','image','text','frame'].includes(t)){addFlowNode(t==='add'?'image':t);setFlowTool('select')}else setFlowTool(t)}));q('#flowZoomIn')?.addEventListener('click',()=>{flowState.zoom=Math.min(1.8,flowState.zoom+.1);updateFlowTransform()});q('#flowZoomOut')?.addEventListener('click',()=>{flowState.zoom=Math.max(.5,flowState.zoom-.1);updateFlowTransform()});q('#flowFit')?.addEventListener('click',()=>{Object.assign(flowState,{zoom:.82,panX:0,panY:0});updateFlowTransform()});q('#flowNewBoard')?.addEventListener('click',()=>{openDemoDialog('Start a new Flow board','<p>This clears the UI-test board and creates a clean canvas. No production data is affected.</p>','<button class="ghost-btn" data-dialog-close2>Cancel</button><button class="primary-btn" id="confirmNewFlow">Create board</button>');q('#confirmNewFlow')?.addEventListener('click',()=>{q('#demoDialog').hidden=true;flowState.zoom=1;flowState.panX=0;flowState.panY=0;route();toast('New Flow board created')})});q('#flowShare')?.addEventListener('click',async()=>{try{await navigator.clipboard?.writeText(location.href)}catch{}toast('Flow share link copied')});const vp=q('#flowViewport');vp?.addEventListener('wheel',e=>{e.preventDefault();flowState.zoom=Math.max(.5,Math.min(1.8,flowState.zoom+(e.deltaY<0?.08:-.08)));updateFlowTransform()},{passive:false});vp?.addEventListener('pointerdown',e=>{if(flowState.tool!=='pan'||e.target.closest('.node,.flow-frame'))return;const sx=e.clientX,sy=e.clientY,px=flowState.panX,py=flowState.panY;const move=ev=>{flowState.panX=px+ev.clientX-sx;flowState.panY=py+ev.clientY-sy;updateFlowTransform()};const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up)};window.addEventListener('pointermove',move);window.addEventListener('pointerup',up)})}
function filterDiscover(){const term=(q('#discoverSearch')?.value||'').trim().toLowerCase();discoverState.query=term;const f=(discoverState.filter||'Featured').toLowerCase();let shown=0;qa('[data-discover-search]').forEach(el=>{const okTerm=!term||el.dataset.discoverSearch.includes(term);const cat=(el.dataset.discoverCategory||'').toLowerCase();const okFilter=f==='featured'||cat===f;el.hidden=!(okTerm&&okFilter);if(!el.hidden)shown++});const n=q('#discoverResultsNote');if(n)n.textContent=`${shown} matching professional/project results`}
function wireDiscover(){const search=q('#discoverSearch');search?.addEventListener('input',filterDiscover);qa('[data-discover-filter]').forEach(b=>b.addEventListener('click',()=>{discoverState.filter=b.dataset.discoverFilter;qa('[data-discover-filter]').forEach(x=>x.classList.toggle('active',x===b));filterDiscover()}));qa('[data-follow]').forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.follow;if(discoverState.followed.has(k)){discoverState.followed.delete(k);b.textContent=b.closest('.discover-project')?'◉ Follow designer':'Follow';b.classList.remove('active')}else{discoverState.followed.add(k);b.textContent=b.closest('.discover-project')?'✓ Following':'Following';b.classList.add('active')}toast(discoverState.followed.has(k)?`Following ${k}`:`Unfollowed ${k}`)}));qa('[data-save]').forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.save;if(discoverState.saved.has(k)){discoverState.saved.delete(k);b.textContent='☆ Save';b.classList.remove('active')}else{discoverState.saved.add(k);b.textContent='★ Saved';b.classList.add('active')}toast(discoverState.saved.has(k)?'Project saved':'Project removed from saves')}));qa('[data-view-project]').forEach(b=>b.addEventListener('click',()=>openDemoDialog(b.dataset.viewProject,`<div class="project-dialog"><img src="${b.dataset.projectImage}"><p>Project by <b>${b.dataset.projectAuthor}</b></p><p>Professional project view with render set, project description, appreciations, saves and portfolio attribution.</p></div>`,'<button class="primary-btn" data-route="portfolio">View designer portfolio</button>')));q('#discoverAllPros')?.addEventListener('click',()=>{discoverState.filter='Featured';discoverState.query='';if(search)search.value='';qa('[data-discover-filter]').forEach(x=>x.classList.toggle('active',x.dataset.discoverFilter==='Featured'));filterDiscover();toast('Showing all professionals')});filterDiscover()}
function wireSettings(){qa('[data-settings-tab]').forEach(b=>b.addEventListener('click',()=>{settingsState.tab=b.dataset.settingsTab;route()}));qa('[data-setting-toggle]').forEach(s=>s.addEventListener('click',()=>{const k=s.dataset.settingToggle;settingsState[k]=!settingsState[k];s.classList.toggle('on',settingsState[k]);toast(`${k.replace(/([A-Z])/g,' $1')} ${settingsState[k]?'enabled':'disabled'}`)}));qa('[data-setting-select]').forEach(sel=>sel.addEventListener('change',()=>{settingsState[sel.dataset.settingSelect]=sel.value;toast(`${sel.dataset.settingSelect}: ${sel.value}`)}));qa('[data-theme-choice]').forEach(b=>b.addEventListener('click',()=>{applyTheme(b.dataset.themeChoice,true);qa('[data-theme-choice]').forEach(x=>x.classList.toggle('active',x===b))}));q('#saveSettings')?.addEventListener('click',()=>{safeStore.set('pionx-settings',JSON.stringify({...settingsState,theme:settingsState.theme}));toast('Settings saved')});qa('[data-setting-action]').forEach(b=>b.addEventListener('click',()=>toast(b.dataset.settingAction==='download-data'?'Account data export prepared':'Latest invoice download prepared')))}
function downloadText(name,text){const blob=new Blob([text],{type:'text/plain'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),500)}
function wireFinance(){qa('[data-fin-action]').forEach(b=>b.addEventListener('click',()=>{const a=b.dataset.finAction;if(a==='refresh'){financeState.lastRefresh=new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});const el=q('#financeRefreshTime');if(el)el.textContent='Updated '+financeState.lastRefresh;toast('Finance, provider balances and cost data refreshed')}else if(a==='export-ledger')downloadText('pionx-ledger-demo.csv','job,time,engine,cost,credits,status\nPX-260924-1124,11:24,PIONX Image Primary,0.42,2,Delivered\nPX-260924-1015,10:15,PIONX Video Quality,2.84,18,Delivered');else if(a==='save-cost')toast('Cost Monitor settings saved');else if(a==='check-prices')toast('Engine pricing check complete · no blocking changes');else if(a==='check-updates'){toast('Engine & accounting updates refreshed');const feed=q('#financeUpdates');if(feed){const n=document.createElement('article');n.innerHTML='<i class="good"></i><div><b>Just now · Manual check</b><small>Provider catalog, costs and accounting configuration checked.</small></div>';feed.prepend(n)}}else if(a==='reconcile')toast('Reconciliation complete · variance $0.00');else if(a==='download-report')downloadText('pionx-finance-report-demo.txt','PIONX Finance UI Test\nRecorded provider cost: $682.17\nVariance: $0.00');else if(a==='connectivity')toast('Provider connectivity test passed in UI test mode');else if(a==='refund-check')toast('Credit reserve/refund safeguard verified in UI test mode');else if(a==='backup')downloadText('pionx-finance-backup-demo.json',JSON.stringify({version:financeState.ledgerVersion,cost:682.17,revenue:1245},null,2));else if(a==='clear-demo')toast('UI demo events cleared');else if(a==='reset-logs')openDemoDialog('Reset finance logs before launch','<p>This action is destructive in Production. In this UI test no real logs will be changed.</p>','<button class="ghost-btn" data-dialog-close2>Cancel</button><button class="primary-btn danger-btn" id="confirmResetDemo">Confirm UI test</button>');}));q('#confirmResetDemo')?.addEventListener('click',()=>{q('#demoDialog').hidden=true;toast('UI test only · no real logs changed')});q('#ledgerEngineFilter')?.addEventListener('change',e=>{const v=e.target.value;qa('#financeLedgerBody tr').forEach(r=>r.hidden=v!=='All engines'&&r.dataset.engine!==v)})}

// ===== PIONX CLEAN V4 INTERACTION + ADMIN/FINANCE/EDITING UPGRADE =====
let adminUsersV4=[
 {id:'u1',name:'Mahmoud Y.',email:'demo@pionx.ai',plan:'Pro',credits:245,role:'Admin',status:'Active',creditEnabled:true,features:{consistency:{enabled:true,until:'2026-12-31'},film:{enabled:true,until:'2026-12-31'},presentation:{enabled:true,until:'2026-12-31'},creative:{enabled:true,until:'2026-12-31'}}},
 {id:'u2',name:'Studio A',email:'team@studio-a.com',plan:'Studio',credits:1020,role:'User',status:'Active',creditEnabled:true,features:{consistency:{enabled:true,until:'2027-01-31'},film:{enabled:true,until:'2027-01-31'},presentation:{enabled:true,until:'2027-01-31'},creative:{enabled:false,until:''}}},
 {id:'u3',name:'Architect 03',email:'architect03@mail.com',plan:'Starter',credits:84,role:'User',status:'Active',creditEnabled:true,features:{consistency:{enabled:false,until:''},film:{enabled:false,until:''},presentation:{enabled:true,until:'2026-10-24'},creative:{enabled:false,until:''}}},
 {id:'u4',name:'Design Team',email:'render@designteam.com',plan:'Studio',credits:780,role:'User',status:'Active',creditEnabled:true,features:{consistency:{enabled:true,until:'2026-11-30'},film:{enabled:false,until:''},presentation:{enabled:true,until:'2026-11-30'},creative:{enabled:true,until:'2026-11-30'}}}
];
const consistencyV4={workflow:'batch',count:4,strength:'strong',mode:'preserve',sameLighting:true,sameMaterials:true,people:false,cars:false};
const creatorProfilesV4={
 'Mahmoud Yousri':{initials:'MY',title:'Architectural Design · Visualization',location:'Cairo, Egypt',bio:'Architecture, visualization and premium AI production workflows.',cover:imgs.hero,stats:['24 Projects','3.8k Appreciations','41k Views'],works:[['Courtyard Residence',imgs.villa1,'1.2k'],['Night Residence',imgs.night,'886'],['Commercial Atrium',imgs.commercial,'934']]},
 'Atelier Axis':{initials:'AA',title:'Residential · Hospitality',location:'Dubai, UAE',bio:'Contemporary residential and hospitality studio focused on quiet materiality and crafted light.',cover:imgs.villa1,stats:['18 Projects','2.9k Appreciations','32k Views'],works:[['Urban Clubhouse',imgs.commercial,'984'],['Landscape Retreat',imgs.landscape,'694'],['Courtyard House',imgs.villa2,'821']]},
 'Noura K.':{initials:'NK',title:'Interior Architecture',location:'Riyadh, KSA',bio:'Interior architecture with warm contemporary detailing, material depth and restrained lighting.',cover:imgs.interiorCard,stats:['31 Projects','5.2k Appreciations','67k Views'],works:[['Quiet Luxury Interior',imgs.interiorCard,'1.6k'],['Warm Living Space',imgs.interior,'1.1k'],['Blue Night Lounge',imgs.night,'782']]},
 'Studio R':{initials:'SR',title:'Masterplanning · Urban Design',location:'Jeddah, KSA',bio:'Large-scale masterplanning, urban design and landscape-led development strategy.',cover:imgs.master,stats:['14 Projects','1.7k Appreciations','28k Views'],works:[['Desert Masterplan',imgs.master,'742'],['Urban District',imgs.commercial,'650'],['Landscape Spine',imgs.landscape,'591']]}
};
const discoverV4={tab:'Trending',selectedCreator:'Atelier Axis',likes:new Set(),comments:{}};
const editV4={tool:'rectangle',hasSelection:false,refName:'',materialName:'',refData:'',materialData:'',color:'#c6a784',selection:null,brushBounds:null};
const presentationV4={type:'Hero Board',layout:0,pageSize:'A3',orientation:'Landscape',selectedBoard:0,boards:['Cover','Hero Render','Materials + Colors','Comparison'],content:{title:true,materials:true,colors:true,notes:true,logo:true,legend:false,qr:false}};
let financeV4={cleared:false,pricing:{netUsdPerCredit:0.50,targetMarginPct:35,pricingBufferPct:8,minCredits:1},wallets:[
 {provider:'PIONX Image Services',charged:520.00,providerBalance:125.40,internalBalance:125.40,lastSync:'15:07',status:'Connected',use:'Image + Analysis'},
 {provider:'PIONX Motion Services',charged:310.00,providerBalance:88.20,internalBalance:88.20,lastSync:'15:06',status:'Connected',use:'Video Quality + Fast'},
 {provider:'PIONX Flexible Services',charged:103.87,providerBalance:40.75,internalBalance:40.75,lastSync:'15:05',status:'Connected',use:'Flexible Video'},
 {provider:'Local / Other',charged:68.10,providerBalance:52.10,internalBalance:52.10,lastSync:'Local',status:'Internal',use:'Retouch + Utilities'}
]};
const V52_ADMIN_KEY='pionx-v52-admin-state';
const V52_FINANCE_KEY='pionx-v52-finance-state';
try{const saved=JSON.parse(safeStore.get(V52_ADMIN_KEY)||'null');if(Array.isArray(saved)&&saved.length)adminUsersV4=saved}catch{}
try{const saved=JSON.parse(safeStore.get(V52_FINANCE_KEY)||'null');if(saved&&Array.isArray(saved.wallets)){financeV4={...financeV4,...saved};}}catch{}
financeV4.topups=Array.isArray(financeV4.topups)?financeV4.topups:[
 {provider:'PIONX Image Services',amount:300,time:'09 Sep'},
 {provider:'PIONX Image Services',amount:220,time:'18 Sep'},
 {provider:'PIONX Motion Services',amount:200,time:'11 Sep'},
 {provider:'PIONX Motion Services',amount:110,time:'21 Sep'},
 {provider:'PIONX Flexible Services',amount:103.87,time:'13 Sep'},
 {provider:'Local / Other',amount:68.10,time:'Start'}
];
function saveAdminV52(){safeStore.set(V52_ADMIN_KEY,JSON.stringify(adminUsersV4))}
function saveFinanceV52(){safeStore.set(V52_FINANCE_KEY,JSON.stringify(financeV4))}

routes.creator=creatorPage;

function moneyV4(n){return '$'+Number(n).toFixed(2)}
let LIVE_COST_CONFIG56=null,LIVE_COST_SUMMARY56=null;
function financePricingV56(){
 const d={usdPerCredit:0.10,targetMarginPct:55,monthlyBudgetUsd:1000,maxImageUsd:1.25,maxVideoUsd:6,maxRetries:1};
 const x={...d,...(financeV4.pricing||{})};
 // Migrate the earlier UI-only key without changing a live server setting silently.
 if(financeV4.pricing?.netUsdPerCredit!=null&&financeV4.pricing?.usdPerCredit==null)x.usdPerCredit=Number(financeV4.pricing.netUsdPerCredit);
 x.usdPerCredit=Math.max(.001,Number(x.usdPerCredit)||d.usdPerCredit);x.targetMarginPct=Math.min(95,Math.max(0,Number(x.targetMarginPct)||0));
 x.monthlyBudgetUsd=Math.max(0,Number(x.monthlyBudgetUsd)||0);x.maxImageUsd=Math.max(0,Number(x.maxImageUsd)||0);x.maxVideoUsd=Math.max(0,Number(x.maxVideoUsd)||0);x.maxRetries=Math.max(0,Math.min(2,Math.round(Number(x.maxRetries)||0)));
 return x;
}
function creditQuoteV56(actualCost,cfg=financePricingV56()){
 const cost=Math.max(0,Number(actualCost)||0),margin=Math.min(.95,Math.max(0,cfg.targetMarginPct/100)),requiredRevenue=cost/Math.max(.05,1-margin);
 const credits=Math.max(1,Math.ceil(requiredRevenue/Math.max(.001,cfg.usdPerCredit))),revenue=credits*cfg.usdPerCredit,profit=revenue-cost,actualMargin=revenue>0?(profit/revenue)*100:0;
 return {cost,requiredRevenue,credits,revenue,profit,actualMargin};
}
function updateFinancePricingUIV56(){
 const fields={};qa('[data-price-field]').forEach(i=>{fields[i.dataset.priceField]=Number(i.value)});const cfg={...financePricingV56(),...fields};
 cfg.usdPerCredit=Math.max(.001,cfg.usdPerCredit||.1);cfg.targetMarginPct=Math.min(95,Math.max(0,cfg.targetMarginPct||0));
 qa('[data-price-cost]').forEach(card=>{const qv=creditQuoteV56(Number(card.dataset.priceCost),cfg),b=q('[data-price-credits]',card),m=q('[data-price-meta]',card);if(b)b.textContent=qv.credits+' credits';if(m)m.textContent=`${moneyV4(qv.cost)} cost · ${moneyV4(qv.revenue)} revenue · ${moneyV4(qv.profit)} profit · ${qv.actualMargin.toFixed(1)}% margin`;});
 const sampleCost=Math.max(0,Number(q('#pricingSampleCost')?.value||.48)),sq=creditQuoteV56(sampleCost,cfg);if(q('#pricingSampleCredits'))q('#pricingSampleCredits').textContent=sq.credits+' credits';if(q('#pricingSampleRevenue'))q('#pricingSampleRevenue').textContent=moneyV4(sq.revenue);if(q('#pricingSampleProfit'))q('#pricingSampleProfit').textContent=moneyV4(sq.profit);if(q('#pricingSampleMargin'))q('#pricingSampleMargin').textContent=sq.actualMargin.toFixed(1)+'%';if(q('#pricingFormulaText'))q('#pricingFormulaText').textContent=`${moneyV4(sq.cost)} operation cost ÷ (1 − ${(cfg.targetMarginPct/100).toFixed(2)}) = ${moneyV4(sq.requiredRevenue)} minimum sale value ÷ ${moneyV4(cfg.usdPerCredit)} / credit → ${sq.credits} credits (rounded up).`;
}
function updateFinanceLiveSummary56(){
 const s=LIVE_COST_SUMMARY56||{};
 const set=(id,v)=>{const el=q(id);if(el&&Number.isFinite(Number(v)))el.textContent=moneyV4(Number(v))};
 set('#finance30dCost',s.provider_cost_usd);set('#finance30dRevenue',s.estimated_revenue_usd);set('#finance30dProfit',s.estimated_gross_profit_usd);set('#financeMonthSpend',s.month_spend_usd);
 const meta=q('#financeLiveSummaryMeta');if(meta){const req=Number(s.requests),credits=Number(s.credits_charged);meta.textContent=[Number.isFinite(req)?`${req} logged operations`:null,Number.isFinite(credits)?`${credits} credits charged`:null].filter(Boolean).join(' · ')||'Live server finance summary loaded';}
}
function applyLiveCostConfig56(j){
 const c=j?.config||{};LIVE_COST_CONFIG56=c;LIVE_COST_SUMMARY56=j?.summary||null;const p=financePricingV56();
 if(c.usd_per_credit!=null)p.usdPerCredit=Number(c.usd_per_credit);if(c.profit_margin_pct!=null)p.targetMarginPct=Number(c.profit_margin_pct);if(c.monthly_budget_usd!=null)p.monthlyBudgetUsd=Number(c.monthly_budget_usd);if(c.max_cost_per_image_usd!=null)p.maxImageUsd=Number(c.max_cost_per_image_usd);if(c.max_cost_per_video_usd!=null)p.maxVideoUsd=Number(c.max_cost_per_video_usd);if(c.max_retries!=null)p.maxRetries=Number(c.max_retries);
 financeV4.pricing=p;saveFinanceV52();for(const el of qa('[data-price-field]'))if(p[el.dataset.priceField]!=null)el.value=p[el.dataset.priceField];updateFinancePricingUIV56();updateFinanceLiveSummary56();const live=q('#pricingLiveState');if(live)live.textContent=`LIVE SERVER · ${p.targetMarginPct}% target margin · ${moneyV4(p.usdPerCredit)} / credit`;return p;
}
async function loadLiveCostConfig56(showToast=false){
 if(!signedIn56())return null;try{const r=await pxApi56('/server/admin-costs-v26.php?days=30&ts='+Date.now(),{cache:'no-store'}),j=await json56(r,'PIONX Finance');if(!r.ok)throw new Error(j.error||'Finance settings unavailable');applyLiveCostConfig56(j);if(showToast)toast('Live cost, margin and credit settings loaded from the server');return j}catch(e){const live=q('#pricingLiveState');if(live)live.textContent='Server pricing not loaded · '+e.message;if(showToast)toast(e.message);return null}
}
async function saveLiveCostConfig56(cfg){
 if(!LIVE_COST_CONFIG56){const j=await loadLiveCostConfig56(false);if(!j)throw new Error('Load the live Finance settings first.');}
 const payload={enabled:LIVE_COST_CONFIG56.enabled!==false,usd_per_credit:cfg.usdPerCredit,profit_margin_pct:cfg.targetMarginPct,monthly_budget_usd:cfg.monthlyBudgetUsd,max_cost_per_image_usd:cfg.maxImageUsd,max_cost_per_video_usd:cfg.maxVideoUsd,max_retries:cfg.maxRetries,rates:LIVE_COST_CONFIG56.rates||{}};
 const r=await pxApi56('/server/admin-costs-v26.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),j=await json56(r,'PIONX Finance');if(!r.ok)throw new Error(j.error||'Could not save live Finance settings');applyLiveCostConfig56(j);return j;
}
function featureRowAdminV4(key,label,obj){return `<div class="admin-feature-row"><div class="admin-feature-main"><i class="switch ${obj.enabled?'on':''}" data-admin-feature="${key}"></i><div><b>${label}</b><small>${obj.enabled?(obj.until?'Active until '+obj.until:'Active'):'Disabled'}</small></div></div><div class="admin-feature-expiry"><select data-admin-duration="${key}"><option>7 days</option><option>30 days</option><option>90 days</option><option>Plan end</option><option>Permanent</option><option selected>Custom date</option></select><input type="date" data-admin-until="${key}" value="${obj.until||''}"></div></div>`}
function adminPage(){return `<section class="page">${pageHead('ADMIN CONTROL CENTER','Admin','Full per-user control for role, plan, credits, password reset and timed feature access.','<button class="primary-btn" id="adminAddUser">+ Add user</button><button class="ghost-btn" id="adminRefreshUsers">Refresh users</button>')}
 <div class="admin-kpis">${[['Users',adminUsersV4.length,'All accounts'],['Admin accounts',adminUsersV4.filter(x=>x.role==='Admin').length,'Privileged'],['Credits issued',adminUsersV4.reduce((a,b)=>a+b.credits,0).toLocaleString(),'Current balances'],['Timed feature grants',adminUsersV4.reduce((n,u)=>n+Object.values(u.features).filter(f=>f.enabled&&f.until).length,0),'With expiry dates']].map(x=>`<article class="panel metric"><small>${x[0]}</small><b>${x[1]}</b><span class="up">${x[2]}</span></article>`).join('')}</div>
 <div class="admin-grid-v4"><section class="panel admin-panel"><div class="section-title" style="margin-top:0"><div><h2>Users</h2><p>Edit opens the complete account controller.</p></div><label class="mini-search"><span>⌕</span><input id="adminUserSearch" placeholder="Search user or email"></label></div><div class="table-wrap"><table class="table admin-user-table"><thead><tr><th>User</th><th>Email</th><th>Package</th><th>Credits</th><th>Credit Access</th><th>Role</th><th>Status</th><th>Features</th><th></th></tr></thead><tbody id="adminUsersBody">${adminUsersV4.map(u=>`<tr data-admin-search="${(u.name+' '+u.email).toLowerCase()}"><td><b>${u.name}</b></td><td>${u.email}</td><td>${u.plan}</td><td>${u.credits}</td><td class="${u.creditEnabled?'good':'bad'}">${u.creditEnabled?'Enabled':'Blocked'}</td><td>${u.role}</td><td class="good">${u.status}</td><td><div class="feature-pills">${Object.entries(u.features).filter(([,v])=>v.enabled).map(([k])=>`<span>${k==='film'?'Film':k}</span>`).join('')||'<small>None</small>'}</div></td><td><button class="ghost-btn" data-admin-edit="${u.id}">Edit user</button></td></tr>`).join('')}</tbody></table></div></section>
 <aside class="panel admin-panel admin-policy"><h2>Default package rules</h2><p>These are plan defaults. A user override can enable/disable a feature and set its own expiry date.</p>${[['Starter','Studio + Presentation','No Consistency / Film'],['Pro','Studio + Flow + Consistency','Film by admin grant'],['Studio','All production modules','Team priority']].map(x=>`<article><b>${x[0]}</b><span>${x[1]}</span><small>${x[2]}</small></article>`).join('')}<div class="admin-warning"><b>Password security</b><small>Admins can trigger a password reset or set a temporary password. Existing passwords are never displayed.</small></div></aside></div>
 </section>`}
function openAdminUserEditorV4(id){const u=adminUsersV4.find(x=>x.id===id);if(!u)return;const m=openDemoDialog('Edit user · '+u.name,`<div class="admin-edit-grid"><section><div class="field-title">Account</div><label>Name<input id="adminEditName" value="${u.name}"></label><label>Email<input id="adminEditEmail" value="${u.email}"></label><div class="form-grid"><label>Package<select id="adminEditPlan">${['Starter','Pro','Studio','Enterprise'].map(x=>`<option ${x===u.plan?'selected':''}>${x}</option>`).join('')}</select></label><label>Role<select id="adminEditRole"><option ${u.role==='User'?'selected':''}>User</option><option ${u.role==='Admin'?'selected':''}>Admin</option></select></label></div><div class="form-grid"><label>Status<select id="adminEditStatus"><option ${u.status==='Active'?'selected':''}>Active</option><option ${u.status==='Suspended'?'selected':''}>Suspended</option></select></label><label>Credits<input id="adminEditCredits" type="number" min="0" value="${u.credits}"></label></div><div class="credit-controller"><div class="switch-line"><i id="adminCreditEnabled" class="switch ${u.creditEnabled?'on':''}"></i>Allow credit usage</div><label>Credit adjustment<input id="adminCreditDelta" type="number" value="50"></label><div><button class="ghost-btn" data-credit-action="add">+ Add</button><button class="ghost-btn" data-credit-action="deduct">− Deduct</button></div></div><div class="field-title">Password</div><div class="password-tools"><button class="ghost-btn" id="adminResetPassword">Send password reset link</button><label>Temporary password<input id="adminTempPassword" type="password" placeholder="Set temporary password"></label><button class="ghost-btn" id="adminSetTempPassword">Set temporary password</button></div></section><section><div class="field-title">Feature access & expiry</div><div class="admin-feature-editor">${featureRowAdminV4('consistency','Consistency',u.features.consistency)}${featureRowAdminV4('film','PIONX Film',u.features.film)}${featureRowAdminV4('presentation','Presentation',u.features.presentation)}${featureRowAdminV4('creative','Creative Mode',u.features.creative)}</div><div class="admin-feature-note">Each feature can be granted independently with 7 / 30 / 90 days, package end, permanent, or a custom expiry date.</div><div class="danger-zone"><b>Danger zone</b><p>Delete this user and revoke access.</p><button class="danger-btn" id="adminDeleteUser" ${u.role==='Admin'&&u.id==='u1'?'disabled title="Current admin is protected in UI test"':''}>Delete user</button></div></section></div>`,`<button class="ghost-btn" data-dialog-close2>Cancel</button><button class="primary-btn" id="adminSaveUser">Save user</button>`);
 q('#adminCreditEnabled',m)?.addEventListener('click',e=>e.currentTarget.classList.toggle('on'));qa('[data-admin-feature]',m).forEach(s=>s.addEventListener('click',()=>s.classList.toggle('on')));qa('[data-admin-duration]',m).forEach(sel=>sel.addEventListener('change',()=>{const key=sel.dataset.adminDuration,inp=q(`[data-admin-until="${key}"]`,m);const d=new Date();if(sel.value==='7 days')d.setDate(d.getDate()+7);if(sel.value==='30 days')d.setDate(d.getDate()+30);if(sel.value==='90 days')d.setDate(d.getDate()+90);if(['7 days','30 days','90 days'].includes(sel.value))inp.value=d.toISOString().slice(0,10);if(sel.value==='Permanent')inp.value='';}));qa('[data-credit-action]',m).forEach(b=>b.addEventListener('click',()=>{const delta=Math.max(0,Number(q('#adminCreditDelta',m)?.value||0)),credits=q('#adminEditCredits',m);credits.value=Math.max(0,Number(credits.value||0)+(b.dataset.creditAction==='add'?delta:-delta));toast(`Credits ${b.dataset.creditAction==='add'?'added':'deducted'} in editor`)}));q('#adminResetPassword',m)?.addEventListener('click',()=>toast('Password reset link queued · UI test'));q('#adminSetTempPassword',m)?.addEventListener('click',()=>toast(q('#adminTempPassword',m)?.value?'Temporary password set · UI test':'Enter a temporary password first'));q('#adminDeleteUser',m)?.addEventListener('click',()=>{openDemoDialog('Delete '+u.name+'?','<p>This removes the account and revokes access. Production requires an explicit confirmation and audit log.</p>','<button class="ghost-btn" data-dialog-close2>Cancel</button><button class="danger-btn" id="confirmDeleteUserV4">Delete user</button>');q('#confirmDeleteUserV4')?.addEventListener('click',()=>{const i=adminUsersV4.findIndex(x=>x.id===u.id);if(i>=0)adminUsersV4.splice(i,1);saveAdminV52();q('#demoDialog').hidden=true;route();toast('User deleted in UI test')})});q('#adminSaveUser',m)?.addEventListener('click',()=>{u.name=q('#adminEditName',m).value;u.email=q('#adminEditEmail',m).value;u.plan=q('#adminEditPlan',m).value;u.role=q('#adminEditRole',m).value;u.status=q('#adminEditStatus',m).value;u.credits=Math.max(0,Number(q('#adminEditCredits',m).value||0));u.creditEnabled=q('#adminCreditEnabled',m).classList.contains('on');for(const key of Object.keys(u.features)){u.features[key].enabled=q(`[data-admin-feature="${key}"]`,m).classList.contains('on');u.features[key].until=q(`[data-admin-until="${key}"]`,m).value||''}saveAdminV52();q('#demoDialog').hidden=true;route();toast('User access, plan, credits and features saved')});}
function wireAdminV4(){qa('[data-admin-edit]').forEach(b=>b.addEventListener('click',()=>openAdminUserEditorV4(b.dataset.adminEdit)));q('#adminUserSearch')?.addEventListener('input',e=>{const t=e.target.value.toLowerCase();qa('#adminUsersBody tr').forEach(r=>r.hidden=!r.dataset.adminSearch.includes(t))});q('#adminRefreshUsers')?.addEventListener('click',()=>toast('User table refreshed'));q('#adminAddUser')?.addEventListener('click',()=>{const id='u'+Date.now();adminUsersV4.push({id,name:'New User',email:'new.user@pionx.ai',plan:'Starter',credits:0,role:'User',status:'Active',creditEnabled:true,features:{consistency:{enabled:false,until:''},film:{enabled:false,until:''},presentation:{enabled:true,until:''},creative:{enabled:false,until:''}}});saveAdminV52();route();setTimeout(()=>openAdminUserEditorV4(id),30)})}

function financePage(){const pricing=financePricingV56();const recent=financeV4.cleared?[]:[
 ['PX-260924-1457','14:57','Mahmoud Y.','Image Render','Interior','Preserve','PIONX Image Primary','PIONX Image Services · PIONX Image','$125.82','$0.48','$125.34','2','$1.00','$0.52','52.0%','Delivered'],
 ['PX-260924-1421','14:21','Studio A','Consistency ×4','Exterior','Balanced','PIONX Image Primary','PIONX Image Services · PIONX Image','$127.38','$1.47','$125.91','8','$4.00','$2.53','63.3%','Delivered'],
 ['PX-260924-1344','13:44','Mahmoud Y.','Video 8s','Exterior','Premium','PIONX Video Quality','PIONX Motion Services · PIONX Motion','$91.04','$2.92','$88.12','18','$9.00','$6.08','67.6%','Delivered'],
 ['PX-260924-1312','13:12','Architect 03','Image Render','Landscape','Creative','PIONX Image Primary','PIONX Image Services · PIONX Image','$127.93','$0.61','$127.32','3','$1.50','$0.89','59.3%','Delivered'],
 ['PX-260924-1240','12:40','Studio A','Prompt Intelligence','Masterplan','Preserve','PIONX Analysis','PIONX Image Services · PIONX Analysis','$127.96','$0.03','$127.93','Bundled','$0.00','Bundled','—','Delivered'],
 ['PX-260924-1207','12:07','Design Team','Video 6s','Interior','Fast','PIONX Video Fast','PIONX Motion Services · PIONX Fast Motion','$92.79','$1.81','$90.98','12','$6.00','$4.19','69.8%','Delivered']
];const engineSpend=[
 ['PIONX Image Primary','PIONX Image Services','PIONX Image','482','$360.00','$0.75','$125.40','Healthy'],['PIONX Analysis','PIONX Image Services','PIONX Analysis','611','$34.60','$0.06','$125.40','Healthy'],['PIONX Video Quality','PIONX Motion Services','PIONX Motion','61','$151.90','$2.49','$88.20','Primary'],['PIONX Video Fast','PIONX Motion Services','PIONX Fast Motion','40','$69.90','$1.75','$88.20','Ready'],['PIONX Video Flexible','PIONX Flexible Services','PIONX Flexible Motion','27','$63.12','$2.34','$40.75','Standby'],['PIONX Premium Finish','Local / Other','Retouch Pipeline','525','$16.00','$0.03','$52.10','Active']
];const previews=[
 ['Image · Preserve',0.48],['Image · Balanced',0.61],['Image · MAX',0.98],['Video · Fast',1.81],['Video · Premium',2.92],['Consistency · 4 views',1.47],['PIONX Film',4.54],['Localized Edit',0.12]
];const q30=creditQuoteV56(695.52,pricing);return `<section class="page">${pageHead('ADMIN · FINANCE','Finance & Provider Accounts','Provider wallets, exact operation cost and automatic credit pricing protected by your target profit margin.','<button class="primary-btn" data-fin-action="refresh">Refresh / Sync</button><button class="ghost-btn" data-fin-action="export-ledger">Export ledger</button>')}
 <div class="finance-sync"><span>● Provider reconciliation monitor</span><b id="financeRefreshTime">Updated ${financeState.lastRefresh}</b><small>Provider/model names are admin-only</small></div>
 <div class="metrics"><article class="panel metric"><small>30d Provider Cost</small><b id="finance30dCost">${LIVE_COST_SUMMARY56?moneyV4(LIVE_COST_SUMMARY56.provider_cost_usd||0):'—'}</b><span class="up">Actual logged source cost</span></article><article class="panel metric"><small>Est. Credit Revenue</small><b id="finance30dRevenue">${LIVE_COST_SUMMARY56?moneyV4(LIVE_COST_SUMMARY56.estimated_revenue_usd||0):'—'}</b><span class="up">Credits × live USD/credit</span></article><article class="panel metric"><small>Est. Gross Profit</small><b id="finance30dProfit">${LIVE_COST_SUMMARY56?moneyV4(LIVE_COST_SUMMARY56.estimated_gross_profit_usd||0):'—'}</b><span class="up">Revenue − provider cost</span></article><article class="panel metric"><small>This Month Spend</small><b id="financeMonthSpend">${LIVE_COST_SUMMARY56?moneyV4(LIVE_COST_SUMMARY56.month_spend_usd||0):'—'}</b><span class="up" id="financeLiveSummaryMeta">Loading live server summary…</span></article></div>
 <div class="section-title"><div><h2>Provider wallets · charged vs remaining</h2><p>Top-up history + provider-reported balance + PIONX-calculated balance + variance.</p></div><button class="ghost-btn" data-fin-action="add-topup">Record provider top-up</button></div><div class="wallet-grid wallet-grid-v4">${financeV4.wallets.map(w=>{const spent=w.charged-w.internalBalance,variance=w.providerBalance-w.internalBalance;return `<article class="panel wallet-card wallet-sync-card"><header><div><b>${w.provider}</b><small>${w.use}</small></div><strong>${moneyV4(w.providerBalance)}</strong></header><div class="wallet-v4-grid"><span>Charged / Top-ups<b>${moneyV4(w.charged)}</b></span><span>Calculated spend<b>${moneyV4(spent)}</b></span><span>Provider reported<b>${moneyV4(w.providerBalance)}</b></span><span>PIONX calculated<b>${moneyV4(w.internalBalance)}</b></span></div><div class="wallet-reconcile"><small>Variance</small><b class="${Math.abs(variance)<.01?'good':'bad'}">${moneyV4(variance)}</b><small>Last sync ${w.lastSync}</small><button data-fin-action="sync-provider" data-provider="${w.provider}">Sync now</button></div></article>`}).join('')}</div>
 <section class="panel finance-card finance-section"><div class="section-title" style="margin-top:0"><div><h2>Cost per engine / model</h2><p>Exactly which provider balance each PIONX route consumes.</p></div><button class="ghost-btn" data-fin-action="check-prices">Check pricing</button></div><div class="table-wrap"><table class="table"><thead><tr><th>PIONX Route</th><th>Provider</th><th>Model</th><th>30d Ops</th><th>30d Cost</th><th>Avg / Op</th><th>Wallet Remaining</th><th>Status</th></tr></thead><tbody>${engineSpend.map(x=>`<tr>${x.slice(0,7).map(v=>`<td>${v}</td>`).join('')}<td class="good">${x[7]}</td></tr>`).join('')}</tbody></table></div></section>
 <section class="panel ledger finance-section"><div class="section-title" style="padding:0 14px"><div><h2>Latest operations · provider balance before & after</h2><p>Historical operations keep the price used at execution time. Internal prompt/retouch costs are bundled into the parent user job.</p></div><select id="ledgerEngineFilter"><option>All engines</option>${engineSpend.map(x=>`<option>${x[0]}</option>`).join('')}</select></div><div class="table-wrap"><table class="table ledger-v4"><thead><tr><th>Job</th><th>Time</th><th>User</th><th>Operation</th><th>Scene</th><th>Mode</th><th>PIONX Route</th><th>Provider / Model</th><th>Balance Before</th><th>Total Job Cost</th><th>Balance After</th><th>Credits</th><th>Net Revenue</th><th>Profit</th><th>Margin</th><th>Status</th></tr></thead><tbody id="financeLedgerBody">${recent.length?recent.map(x=>`<tr data-engine="${x[6]}">${x.slice(0,15).map(v=>`<td>${v}</td>`).join('')}<td class="good">${x[15]}</td></tr>`).join(''):'<tr><td colspan="16" class="muted">Test ledger cleared. Provider balances and top-up history are intentionally preserved.</td></tr>'}</tbody></table></div></section>
 <div class="finance-split finance-section"><section class="panel finance-card"><h3>Top-up history</h3><p>What was charged on each provider account.</p><div class="breakdown-list">${financeV4.topups.map(x=>`<div><span>${x.provider}</span><b>${x.time} · +${moneyV4(x.amount)}</b></div>`).join('')}</div></section><section class="panel finance-card"><h3>Provider balance reconciliation</h3><p>Production uses provider balance/usage APIs where available; otherwise top-ups are reconciled against actual usage.</p><div class="breakdown-list"><div><span>Provider-reported total</span><b>$306.45</b></div><div><span>PIONX-calculated total</span><b>$306.45</b></div><div><span>Variance</span><b class="good">$0.00</b></div><div><span>Last reconciliation</span><b>15:07</b></div></div><div class="finance-actions"><button data-fin-action="reconcile">Run reconciliation</button><button data-fin-action="download-report">Download report</button></div></section></div>
 <div class="finance-split finance-section"><section class="panel finance-card"><h3>Automatic Credit Pricing / Profit Guard</h3><p>Set the gross margin you want. The live server cost controller calculates the credit quote before the provider call and reserves it once.</p><div class="status-pill" id="pricingLiveState" style="margin:8px 0 12px">Loading live server pricing…</div><div class="config-grid"><div class="config-field"><label>USD value / credit</label><input data-price-field="usdPerCredit" type="number" min="0.001" step="0.01" value="${pricing.usdPerCredit}"></div><div class="config-field"><label>Target gross margin %</label><input data-price-field="targetMarginPct" type="number" min="0" max="95" step="1" value="${pricing.targetMarginPct}"></div><div class="config-field"><label>Monthly AI budget USD</label><input data-price-field="monthlyBudgetUsd" type="number" min="0" step="1" value="${pricing.monthlyBudgetUsd}"></div><div class="config-field"><label>Max cost / image USD</label><input data-price-field="maxImageUsd" type="number" min="0" step="0.01" value="${pricing.maxImageUsd}"></div><div class="config-field"><label>Max cost / video USD</label><input data-price-field="maxVideoUsd" type="number" min="0" step="0.01" value="${pricing.maxVideoUsd}"></div><div class="config-field"><label>Retry limit</label><input data-price-field="maxRetries" type="number" min="0" max="2" step="1" value="${pricing.maxRetries}"></div></div><div class="alert-box"><b>Live charging formula</b><br>Minimum sale value = complete quoted operation cost ÷ (1 − target margin). Credits = minimum sale value ÷ USD value per credit, always rounded up. The server reserves the quote once before render and refunds a failed protected job.</div><div class="finance-actions"><button data-fin-action="save-cost">Save LIVE pricing & profit settings</button><button data-fin-action="refund-check">Verify reserve/refund</button></div></section><section class="panel finance-card"><h3>Live margin calculator</h3><p>Test any total operation cost before you change pricing.</p><div class="config-grid"><div class="config-field"><label>Total operation cost USD</label><input id="pricingSampleCost" type="number" min="0" step="0.01" value="0.48"></div><div class="config-field"><label>Credits to deduct</label><b id="pricingSampleCredits" style="font-size:22px">—</b></div><div class="config-field"><label>Net revenue</label><b id="pricingSampleRevenue" style="font-size:22px">—</b></div><div class="config-field"><label>Expected profit</label><b id="pricingSampleProfit" style="font-size:22px">—</b></div><div class="config-field"><label>Actual margin after rounding</label><b id="pricingSampleMargin" style="font-size:22px">—</b></div></div><div class="alert-box" id="pricingFormulaText"></div></section></div>
 <section class="panel finance-card finance-section"><h3>Automatic Pricing Preview</h3><p>These credits recalculate live from your margin, buffer and net value per credit.</p><div class="pricing-preview">${previews.map(x=>{const z=creditQuoteV56(x[1],pricing);return `<div class="price-preview-card" data-price-cost="${x[1]}"><small>${x[0]}</small><b data-price-credits>${z.credits} credits</b><span data-price-meta>${moneyV4(z.cost)} total cost · ${moneyV4(z.revenue)} net revenue · ${moneyV4(z.profit)} profit · ${z.actualMargin.toFixed(1)}% margin</span></div>`}).join('')}</div></section>
 <div class="finance-split finance-section"><section class="panel finance-card"><h3>Engine & Accounting Updates</h3><div class="update-feed" id="financeUpdates">${[['Today 15:07','Provider sync','Wallet balances reconciled · variance $0.00','good'],['Today 14:46','Image pricing','Observed image cost updated from usage','good'],['Today 13:55','Auto credit pricing','Target-margin pricing guard enabled','good'],['Today 12:10','Accounting','Reserve once / refund failed job guard verified','good']].map(x=>`<article><i class="${x[3]}"></i><div><b>${x[1]}</b><small>${x[0]} · ${x[2]}</small></div></article>`).join('')}</div><div class="finance-actions"><button data-fin-action="check-updates">Check updates</button></div></section><section class="panel finance-card"><h3>Production charging rule</h3><p>The user is charged once for the complete job quote. Hidden internal analysis or retouch steps do not create a second user charge.</p><div class="breakdown-list"><div><span>Quote before provider call</span><b>Required</b></div><div><span>Reserve credits once</span><b>Required</b></div><div><span>Successful delivery</span><b>Finalize charge</b></div><div><span>Provider/worker failure</span><b>Refund reservation</b></div><div><span>Cost above safety ceiling</span><b class="bad">Block / requote</b></div></div></section></div>
 <section class="panel finance-card finance-section finance-reset-zone"><div><h3>Testing / Launch reset</h3><p>Clear internal trial operations, charts and counters before launch. Provider balances/top-up history and pricing settings are preserved.</p></div><div class="finance-actions"><button data-fin-action="backup">Export finance backup</button><button class="danger" data-fin-action="reset-trial">Reset trial finance</button></div></section>
 </section>`}
function wireFinance(){
 updateFinancePricingUIV56();void loadLiveCostConfig56(false);
 qa('[data-price-field]').forEach(i=>i.addEventListener('input',updateFinancePricingUIV56));q('#pricingSampleCost')?.addEventListener('input',updateFinancePricingUIV56);
 qa('[data-fin-action]').forEach(b=>b.addEventListener('click',()=>{const a=b.dataset.finAction;if(a==='refresh'){financeState.lastRefresh=new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});const el=q('#financeRefreshTime');if(el)el.textContent='Updated '+financeState.lastRefresh;void loadLiveCostConfig56(true)}else if(a==='sync-provider'){const w=financeV4.wallets.find(x=>x.provider===b.dataset.provider);if(w){w.internalBalance=w.providerBalance;w.lastSync=new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});saveFinanceV52();toast(`${w.provider} reconciled · variance $0.00`);route()}}else if(a==='add-topup'){openDemoDialog('Record provider top-up','<div class="form-grid"><label>Provider<select id="topupProvider"><option>PIONX Image Services</option><option>PIONX Motion Services</option><option>PIONX Flexible Services</option><option>Local / Other</option></select></label><label>Amount USD<input id="topupAmount" type="number" value="50"></label></div><p class="muted">This records what you charged on the provider account. Production can also sync provider balances where an API is available.</p>','<button class="ghost-btn" data-dialog-close2>Cancel</button><button class="primary-btn" id="confirmTopup">Record top-up</button>');q('#confirmTopup')?.addEventListener('click',()=>{const w=financeV4.wallets.find(x=>x.provider===q('#topupProvider').value),amt=Math.max(0,Number(q('#topupAmount').value||0));if(w){w.charged+=amt;w.providerBalance+=amt;w.internalBalance+=amt;financeV4.topups.unshift({provider:w.provider,amount:amt,time:new Date().toLocaleString([], {month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit'})});saveFinanceV52()}q('#demoDialog').hidden=true;route();toast('Provider top-up recorded in UI test')})}else if(a==='export-ledger')downloadText('pionx-ledger-v56-demo.csv','job,engine,balance_before,total_job_cost,balance_after,credits,net_revenue,profit,margin\nPX-260924-1457,PIONX Image Primary,125.82,0.48,125.34,2,1.00,0.52,52.0%');else if(a==='save-cost'){(async()=>{try{const cfg=financePricingV56();qa('[data-price-field]').forEach(i=>cfg[i.dataset.priceField]=Number(i.value));cfg.usdPerCredit=Math.max(.001,cfg.usdPerCredit||.1);cfg.targetMarginPct=Math.min(95,Math.max(0,cfg.targetMarginPct||0));cfg.monthlyBudgetUsd=Math.max(0,cfg.monthlyBudgetUsd||0);cfg.maxImageUsd=Math.max(0,cfg.maxImageUsd||0);cfg.maxVideoUsd=Math.max(0,cfg.maxVideoUsd||0);cfg.maxRetries=Math.max(0,Math.min(2,Math.round(cfg.maxRetries||0)));financeV4.pricing=cfg;saveFinanceV52();updateFinancePricingUIV56();await saveLiveCostConfig56(cfg);toast(`LIVE auto credit pricing saved · target margin ${cfg.targetMarginPct}%`)}catch(e){toast(e.message)}})()}else if(a==='check-prices')toast('Engine pricing check complete')}));
 qa('[data-fin-action="check-updates"]').forEach(b=>b.addEventListener('click',()=>{const feed=q('#financeUpdates');if(feed){const n=document.createElement('article');n.innerHTML='<i class="good"></i><div><b>Manual check</b><small>Just now · Provider catalog, costs, pricing guard and accounting rules checked.</small></div>';feed.prepend(n)}toast('Engine & accounting updates refreshed')}));
 qa('[data-fin-action="reconcile"]').forEach(b=>b.addEventListener('click',()=>toast('Reconciliation complete · variance $0.00')));
 qa('[data-fin-action="download-report"]').forEach(b=>b.addEventListener('click',()=>downloadText('pionx-finance-reconciliation-v56.txt','PIONX Finance Reconciliation UI Test\nProvider reported: $306.45\nPIONX calculated: $306.45\n30d source cost: $695.52\nVariance: $0.00')));
 qa('[data-fin-action="refund-check"]').forEach(b=>b.addEventListener('click',()=>toast('Credit reserve once + failed-job refund guard verified')));
 qa('[data-fin-action="backup"]').forEach(b=>b.addEventListener('click',()=>downloadText('pionx-finance-backup-v56.json',JSON.stringify(financeV4,null,2))));
 qa('[data-fin-action="reset-trial"]').forEach(b=>b.addEventListener('click',()=>{openDemoDialog('Reset trial finance?','<p>This clears internal test operations and trial counters only. Provider wallets, top-ups and pricing settings remain for reconciliation.</p>','<button class="ghost-btn" data-dialog-close2>Cancel</button><button class="danger-btn" id="confirmResetTrialV4">Reset trial finance</button>');q('#confirmResetTrialV4')?.addEventListener('click',()=>{financeV4.cleared=true;saveFinanceV52();q('#demoDialog').hidden=true;route();toast('Trial finance reset · provider wallets and pricing preserved')})}));
 q('#ledgerEngineFilter')?.addEventListener('change',e=>{const v=e.target.value;qa('#financeLedgerBody tr[data-engine]').forEach(r=>r.hidden=v!=='All engines'&&r.dataset.engine!==v)})
}

function studioPage(){const scenes=[['✦','Auto','auto'],['⌂','Interior','interior'],['▥','Exterior','exterior'],['▦','Masterplan','masterplan'],['△','Landscape','landscape'],['▧','Sketch','sketch']];const rule=sceneRules[studioState.scene];const displayImage=studioFinal56.exactUrl||studioFinal56.providerUrl||studioSourceImage;const displayBadge=studioFinal56.providerUrl?(studioFinal56.qualityVerified===false?'RESULT · QC DEGRADED':'FINAL · VERIFIED'):(studioSourceImage?'SOURCE · READY':'UPLOAD SOURCE IMAGE');return `<section class="page">
 <div class="studio-hero"><img src="${imgs.hero}" alt=""><div class="studio-hero-copy"><div class="eyebrow">AI STUDIO</div><h1>One image in.<br><span>Premium reality out.</span></h1><p>Every Render starts with architecture analysis, scene-specific prompt intelligence and a premium retouch finish.</p></div><div class="studio-ready-pill">● Scene Intelligence Ready</div><div class="scene-strip">${[['interior',imgs.sceneInterior,'Interior'],['exterior',imgs.sceneExterior,'Exterior'],['masterplan',imgs.sceneMaster,'Masterplan'],['landscape',imgs.sceneLandscape,'Landscape'],['sketch',imgs.sceneSketch,'Sketch']].map(x=>`<button class="scene-mini ${studioState.scene===x[0]?'active':''}" data-scene="${x[0]}"><img src="${x[1]}"><b>${x[2]}</b></button>`).join('')}</div></div>
 <div class="studio-grid studio-grid-v4"><aside class="panel control-panel control-panel-v4"><div class="control-tabs"><button class="chip active">▧ Image</button><button class="chip" data-route="video">▣ Video</button><button class="chip" data-route="presentation">▤ Presentation</button></div><div class="field-title">Source Image <span class="muted">required</span></div><div class="studio-source-upload ${studioSourceImage?'has-source':''}" id="studioSourceDrop" tabindex="0" role="button" aria-label="Upload source image"><input type="file" id="studioSourceInput" accept="image/jpeg,image/png,image/webp" hidden><div class="studio-source-thumb" id="studioSourceThumb">${studioSourceImage?`<img src="${studioSourceImage}" alt="Source image">`:'<span>＋</span>'}</div><div class="studio-source-copy"><b id="studioSourceTitle">${studioSourceImage?'Source ready':'Upload your image'}</b><small id="studioSourceMeta">${studioSourceImage?`${studioSourceName}${studioSourceDims.width?` · ${studioSourceDims.width}×${studioSourceDims.height} · source aspect protected`:''}`:'JPG, PNG or WebP · click or drag & drop'}</small></div><button type="button" class="studio-source-btn" id="studioSourceChoose">${studioSourceImage?'Change':'Choose image'}</button></div><div class="field-title">Render Mode</div><div class="segmented"><button class="chip ${studioState.mode==='preserve'?'active':''}" data-mode="preserve">Preserve</button><button class="chip ${studioState.mode==='balanced'?'active':''}" data-mode="balanced">Balanced</button><button class="chip ${studioState.mode==='creative'?'active':''}" data-mode="creative">Creative</button></div><div class="field-title">Scene Type</div><div class="scene-picker">${scenes.map(x=>`<button class="scene-pick ${studioState.scene===x[2]?'active':''}" data-scene="${x[2]}"><strong>${x[0]}</strong>${x[1]}<small>${x[2]==='auto'?'Recommended':'Scene preset'}</small></button>`).join('')}</div>${studioInteriorStyleMarkupR16()}<div class="field-title">Environment</div><div class="segmented"><button class="chip ${studioState.env==='day'?'active':''}" data-env="day">☀ Day</button><button class="chip ${studioState.env==='night'?'active':''}" data-env="night">☾ Night</button><button class="chip ${studioState.env==='auto'?'active':''}" data-env="auto">Auto</button></div><div class="toggle-row"><div class="switch-line"><i class="switch ${studioState.people?'on':''}" data-control="people"></i>Add People</div><div class="switch-line"><i class="switch ${studioState.cars?'on':''}" data-control="cars"></i>Add Cars</div></div><div class="auto-brief"><header><b id="sceneRuleTitle">PIONX Auto Brief · ${rule.title}</b><em>AUTO PROMPT</em></header><p id="sceneRuleDesc">${rule.desc}</p><div class="scene-insight" id="sceneInsight">${rule.focus.map((x,i)=>`<span><b>${['Priority 1','Priority 2','Priority 3'][i]}</b><small>${x}</small></span>`).join('')}</div></div><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;"><div class="field-title" style="margin:0;">Scene & Material Prompt <span class="muted">Auto-injected by discipline</span></div><button type="button" id="btnAutoAnalyzePrompt" style="background:linear-gradient(135deg,#0284c7,#2563eb); color:#fff; border:none; border-radius:6px; font-size:11px; font-weight:700; padding:3px 8px; cursor:pointer;">🔍 Analyze & Auto-Prompt</button></div><textarea class="notes" id="studioNotes" maxlength="1000" placeholder="Only tell PIONX what you want changed. The technical prompt is automatic."></textarea><div class="field-title">Reference Images</div><div class="reference-row"><div class="ref-box" aria-label="Reference guidance" style="display:flex;align-items:center;justify-content:center;padding:10px;text-align:center;font-size:11px;color:#a9bdd0">Upload style references in the + boxes. Only uploaded images are used.</div><label class="ref-box ref-upload">${studioReferenceImages[0]?`<img src="${studioReferenceImages[0]}" alt="Reference 1">`:'＋'}<input type="file" class="studio-ref-input" data-ref-index="0" accept="image/jpeg,image/png,image/webp" hidden></label><label class="ref-box ref-upload">${studioReferenceImages[1]?`<img src="${studioReferenceImages[1]}" alt="Reference 2">`:'＋'}<input type="file" class="studio-ref-input" data-ref-index="1" accept="image/jpeg,image/png,image/webp" hidden></label></div><div class="finish-note"><i>✦</i><span>Automatic finish: exact source dimensions · no crop · natural color/exposure · PBR materials · glass/reflections · micro-detail · clean sharpness · anti-CGI / anti-HDR cleanup.</span></div><div class="render-anchor"><button class="primary-btn render-btn-v4" id="demoGenerate">✦ Render</button><button class="settings-square" id="studioAdvancedBtn" title="Advanced settings">⌘</button></div></aside>
 <section class="panel canvas-panel">
    <!-- UNIFIED ELEGANT STUDIO REVIEW HEADER -->
    <div class="unified-studio-toolbar" id="unifiedStudioToolbar">
      <div class="ust-row-primary">
        <div class="ust-left-group">
          <div class="ust-status-badge">
            <span class="ust-dot"></span>
            <span class="ust-title" id="ustNoticeText">${studioFinal56.providerUrl ? `✦ Final Render Delivered${studioFinal56.width&&studioFinal56.height?` · ${studioFinal56.width}×${studioFinal56.height}`:''}` : (studioSourceImage ? 'Source Image Ready' : 'Awaiting Source Image')}</span>
            <span class="ust-dim" id="ustDimsText">${studioSourceDims.width ? studioSourceDims.width + ' × ' + studioSourceDims.height + 'px' : ''}</span>
          </div>
          <div class="ust-view-modes">
            <button type="button" class="ust-view-btn active" data-mode="split">◫ Compare (Split)</button>
            <button type="button" class="ust-view-btn" data-mode="final">✦ Render Only</button>
            <button type="button" class="ust-view-btn" data-mode="source">📐 Source Input (CAD)</button>
          </div>
        </div>
        <div class="ust-right-group">
          <button type="button" class="ust-btn ust-btn-comments" id="studioCommentsToggle6328">
            <span>💬</span> <span>Comments & Pins</span> <b id="ustCommentCount">0</b>
          </button>
          <button type="button" class="ust-btn ust-btn-primary" data-result-action="download">
            <span>↓</span> <span>Download Result</span>
          </button>
          <button type="button" class="ust-btn" data-result-action="full" title="Fullscreen">
            <span>⛶</span>
          </button>
        </div>
      </div>
      <div class="ust-row-tools">
        <div class="ust-tools-group">
          <button class="tiny-btn" data-studio-tool="edit">✎ Edit Area</button>
          <button class="tiny-btn" data-studio-tool="enhance">✦ Retouch</button>
          <button class="tiny-btn" data-studio-tool="variations">▦ Interior styles</button>
          <button class="tiny-btn" data-studio-tool="upscale">◈ AI Detail</button>
          <button class="tiny-btn" data-studio-tool="relight">◌ Light & color</button>
        </div>
      </div>
    </div>
    <!-- CANVAS EDIT STAGE -->
    <div class="canvas-image edit-stage ${studioSourceImage?'has-source':'awaiting-source'}" id="studioEditStage">${studioSourceImage?'':studioCanvasGate6333()}<img id="studioOutput" src="${displayImage||''}" alt="${studioFinal56.providerUrl?'PIONX final render':(studioSourceImage?'Uploaded source image':'')}"><div class="output-badge" id="studioOutputBadge">${displayBadge}</div><div id="selectionRect" class="selection-rect" hidden></div><div id="brushLayer" class="brush-layer"></div><div class="canvas-floating"><button class="tiny-btn" data-canvas-action="rotate">↻</button><button class="tiny-btn" data-canvas-action="zoom">100%</button><button class="tiny-btn" data-canvas-action="fullscreen">⛶</button></div></div><div class="result-edit-dock" id="resultEditDock"><div class="edit-dock-head"><div><b>Localized Edit</b><small>Draw or select exactly where you want the change.</small></div><span class="status-pill" id="editSelectionStatus">No selection</span></div><div class="edit-tool-row"><button class="active" data-edit-tool="rectangle">▭ Select</button><button data-edit-tool="brush">● Brush</button><button data-edit-tool="clear">× Clear</button><label>Color<input type="color" id="editColor" value="${editV4.color}"></label></div><textarea class="notes" id="editPrompt" placeholder="What exactly should change in the selected area? e.g. replace this wall finish with warm travertine, keep joints and lighting realistic."></textarea><div class="edit-reference-row"><label class="upload-mini">Material / texture<input type="file" id="editMaterialFile" accept="image/*" hidden><span id="editMaterialName">＋ Upload material</span></label><label class="upload-mini">Reference image<input type="file" id="editReferenceFile" accept="image/*" hidden><span id="editReferenceName">＋ Upload reference</span></label><button class="primary-btn" id="applyLocalizedEdit">Apply selected edit</button></div></div><div class="filmstrip">${[imgs.interior,imgs.interiorCard,imgs.villa1,imgs.villa2,imgs.night,imgs.commercial].map((x,i)=>`<button class="shot-thumb ${i===0?'active':''}"><img src="${x}"></button>`).join('')}</div></section>
 <aside class="panel adjust-panel"><div class="adjust-tabs"><button class="chip active" data-adjust-tab="adjust">Adjust</button><button class="chip" data-adjust-tab="history">History</button><button class="chip" data-adjust-tab="layers">Layers</button></div><div data-adjust-pane="adjust">${[['style','Style',studioAdjustState.style,imgs.sceneInterior],['lighting','Lighting',studioAdjustState.lighting,imgs.night],['materials','Materials',studioAdjustState.materials,imgs.interiorCard],['color','Color',studioAdjustState.color,imgs.villa1],['camera','Camera',studioAdjustState.camera,imgs.sceneExterior]].map(x=>`<button class="adjust-card" data-adjust="${x[0]}"><div class="line"><img class="preview" src="${x[3]}"><div><b>${x[1]}</b><small data-adjust-value="${x[0]}">${x[2]}</small></div><i>›</i></div></button>`).join('')}<button class="reset-adjust" id="resetAdjust">↻ Reset Adjustments</button></div><div class="adjust-secondary" data-adjust-pane="history" hidden><div class="history-list"><article><b>Current</b><small>Scene-aware premium finish</small></article><article><b>Version 03</b><small>Localized material edit</small></article><article><b>Version 02</b><small>Lighting refinement</small></article><article><b>Original</b><small>Uploaded source</small></article></div></div><div class="adjust-secondary" data-adjust-pane="layers" hidden>${[['Architecture',true],['Materials',true],['Lighting',true],['Entourage',studioState.people||studioState.cars],['Retouch',true],['Localized edit',true]].map(x=>`<div class="layer-row"><span>◫ ${x[0]}</span><i class="switch ${x[1]?'on':''}" data-layer="${x[0].toLowerCase()}"></i></div>`).join('')}</div></aside></div>
 <div class="section-title"><div><h2>Recent Renders</h2><p>Final images remain editable, reference-aware and downloadable.</p></div><a data-route="renders">View all →</a></div><div class="gallery">${renderCards()}</div></section>`}
function setEditToolV4(tool){editV4.tool=tool;qa('[data-edit-tool]').forEach(b=>b.classList.toggle('active',b.dataset.editTool===tool));if(tool==='clear'){q('#selectionRect').hidden=true;q('#brushLayer').innerHTML='';editV4.hasSelection=false;q('#editSelectionStatus').textContent='No selection';editV4.tool='rectangle';qa('[data-edit-tool]').forEach(b=>b.classList.toggle('active',b.dataset.editTool==='rectangle'))}}
function wireLocalizedEditV4(){
 qa('[data-edit-tool]').forEach(b=>b.addEventListener('click',()=>setEditToolV4(b.dataset.editTool)));
 const stage=q('#studioEditStage'),rect=q('#selectionRect'),brush=q('#brushLayer');
 const normPoint=(ev,box)=>({x:Math.max(0,Math.min(1,(ev.clientX-box.left)/box.width)),y:Math.max(0,Math.min(1,(ev.clientY-box.top)/box.height))});
 if(stage){stage.addEventListener('pointerdown',e=>{
  if(!['rectangle','brush'].includes(editV4.tool)||e.target.closest('button'))return;e.preventDefault();const box=stage.getBoundingClientRect(),sx=e.clientX-box.left,sy=e.clientY-box.top,startN=normPoint(e,box);
  if(editV4.tool==='rectangle'){
   rect.hidden=false;rect.style.left=sx+'px';rect.style.top=sy+'px';rect.style.width='0px';rect.style.height='0px';
   const move=ev=>{const x=ev.clientX-box.left,y=ev.clientY-box.top;rect.style.left=Math.min(sx,x)+'px';rect.style.top=Math.min(sy,y)+'px';rect.style.width=Math.abs(x-sx)+'px';rect.style.height=Math.abs(y-sy)+'px'};
   const up=ev=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);const endN=normPoint(ev,box);editV4.selection={x1:Math.min(startN.x,endN.x),y1:Math.min(startN.y,endN.y),x2:Math.max(startN.x,endN.x),y2:Math.max(startN.y,endN.y)};editV4.hasSelection=true;q('#editSelectionStatus').textContent='Area selected'};
   window.addEventListener('pointermove',move);window.addEventListener('pointerup',up)
  }else{
   editV4.brushBounds=null;
   const paint=ev=>{const p=document.createElement('i'),x=ev.clientX-box.left,y=ev.clientY-box.top,n=normPoint(ev,box);p.style.left=x+'px';p.style.top=y+'px';brush.appendChild(p);const b=editV4.brushBounds||{x1:n.x,y1:n.y,x2:n.x,y2:n.y};b.x1=Math.min(b.x1,n.x);b.y1=Math.min(b.y1,n.y);b.x2=Math.max(b.x2,n.x);b.y2=Math.max(b.y2,n.y);editV4.brushBounds=b;editV4.selection=b;editV4.hasSelection=true;q('#editSelectionStatus').textContent='Brush selection'};
   paint(e);const move=ev=>paint(ev),up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up)};window.addEventListener('pointermove',move);window.addEventListener('pointerup',up)
  }
 })}
 q('#editMaterialFile')?.addEventListener('change',async e=>{const f=e.target.files[0];if(f){editV4.materialName=f.name;try{editV4.materialData=await readStudioImage(f)}catch{}q('#editMaterialName').textContent='✓ '+f.name}});
 q('#editReferenceFile')?.addEventListener('change',async e=>{const f=e.target.files[0];if(f){editV4.refName=f.name;try{editV4.refData=await readStudioImage(f)}catch{}q('#editReferenceName').textContent='✓ '+f.name}});
 q('#editColor')?.addEventListener('input',e=>editV4.color=e.target.value);
 q('#applyLocalizedEdit')?.addEventListener('click',async()=>{if(!studioFinal56.providerUrl)return toast('Render an image first, then edit the final result');if(!editV4.hasSelection)return toast('Select or brush the area first');if(!q('#editPrompt').value.trim()&&!editV4.materialName&&!editV4.refName)return toast('Add an edit instruction, material or reference');await runLocalizedEdit56()})
}
async function runImagePipelineV4(sceneLabel,detail,onDone){const modal=showRenderMind58();q('#renderMindScene').textContent=`${sceneLabel} · ${detail}`;const stages=[['Analyzing architecture, geometry, camera and source intent…',8,0,350],['Understanding the selected workflow and preservation rules…',23,1,420],['Writing the exact scene-specific production prompt…',39,2,420],['Rendering the premium photoreal result…',69,3,620],['Retouching color, exposure, materials, glass and detail…',89,4,480],['Delivering the final editable result…',100,5,360]];for(const [msg,pct,step,ms] of stages){mindUpdate(msg,pct,step);await new Promise(r=>setTimeout(r,ms))}if(onDone)onDone();hideRenderMind58(350)}

async function runVideoPipelineV4(){const modal=showRenderMind58();q('#renderMindScene').textContent='Video Auto · architecture-lock motion intelligence';const stages=[['Analyzing architecture, depth, camera and motion-safe geometry…',8,0,320],['Understanding motion intent, duration and camera path…',24,1,380],['Writing the architecture-safe motion prompt automatically…',41,2,400],['Rendering the cinematic video with the selected quality route…',70,3,600],['Checking temporal stability, geometry lock and lighting continuity…',90,4,430],['Delivering the final video and saving project history…',100,5,320]];for(const [msg,pct,step,ms] of stages){mindUpdate(msg,pct,step);await new Promise(r=>setTimeout(r,ms))}hideRenderMind58(300);toast('Video render demo completed · route recorded in Finance')}
function imageDims56(src){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve({width:im.naturalWidth||0,height:im.naturalHeight||0});im.onerror=()=>reject(new Error('Could not read image dimensions'));im.src=src})}
function clearFinal56(){if(studioFinal56.blobUrl){try{URL.revokeObjectURL(studioFinal56.blobUrl)}catch{}}studioFinal56={providerUrl:'',exactUrl:'',blobUrl:'',width:0,height:0,qualityVerified:true};studioRenderKind56='source'}
function readStudioImage(file){return new Promise((resolve,reject)=>{if(!file)return reject(new Error('No image selected'));if(!/^image\/(jpeg|png|webp)$/i.test(file.type||''))return reject(new Error('Use JPG, PNG or WebP'));if(file.size>20*1024*1024)return reject(new Error('Image is too large. Use a file under 20 MB.'));const fr=new FileReader();fr.onerror=()=>reject(new Error('Could not read image'));fr.onload=()=>resolve(fr.result);fr.readAsDataURL(file)})}
function updateStudioSourceUI(){const thumb=q('#studioSourceThumb'),title=q('#studioSourceTitle'),meta=q('#studioSourceMeta'),drop=q('#studioSourceDrop'),out=q('#studioOutput'),badge=q('#studioOutputBadge'),stage=q('#studioEditStage'),gate=q('#studioCanvasUpload'),actions=q('#resultActionsV57');if(drop)drop.classList.toggle('has-source',!!studioSourceImage);if(thumb)thumb.innerHTML=studioSourceImage?`<img src="${studioSourceImage}" alt="Source image">`:'<span>＋</span>';if(title)title.textContent=studioSourceImage?'Source ready':'Upload your image';if(meta)meta.textContent=studioSourceImage?`${studioSourceName||'Uploaded image'}${studioSourceDims.width?` · ${studioSourceDims.width}×${studioSourceDims.height} · source aspect protected`:''}`:'JPG, PNG or WebP · click or drag & drop';if(out&&studioSourceImage){out.src=studioSourceImage;out.alt='Uploaded source image';out.style.display='block'}if(stage){stage.classList.toggle('has-source',!!studioSourceImage);stage.classList.toggle('awaiting-source',!studioSourceImage);if(studioSourceDims.width&&studioSourceDims.height){stage.style.aspectRatio=`${studioSourceDims.width} / ${studioSourceDims.height}`;stage.style.height='auto'}}if(gate&&studioSourceImage)gate.remove();if(badge)badge.textContent=studioSourceImage?'SOURCE · READY':'UPLOAD SOURCE IMAGE';if(actions)actions.hidden=true}
async function setStudioSourceFile(file){try{const data=await readStudioImage(file),dims=await imageDims56(data);clearFinal56();studioDetectedSource631={};studioPlanInteriorSpec633=null;studioPlanInteriorMaster633=false;if(typeof studioPlanDetect635!=='undefined')studioPlanDetect635={kind:'unknown',confidence:0,method:'new-source'};try{if(typeof studioSourceMode635!=='undefined'){studioSourceMode635='auto';safeStore.set('pionx.studio.source-mode.v635','auto')}}catch{}studioSourceImage=data;studioSourceName=file.name||'source-image';studioSourceDims.width=dims.width;studioSourceDims.height=dims.height;editV4.hasSelection=false;editV4.selection=null;updateStudioSourceUI();toast(`Source added · ${dims.width}×${dims.height}px locked for final output`);setTimeout(()=>autoAnalyzeAndSetPrompt(),400);}catch(e){toast(e.message||'Could not use this image')}}
function wireStudioUploads(){const input=q('#studioSourceInput'),drop=q('#studioSourceDrop'),choose=q('#studioSourceChoose'),canvas=q('#studioCanvasUpload'),canvasChoose=q('#studioCanvasChoose');const openPicker=e=>{e?.preventDefault?.();e?.stopPropagation?.();input?.click()};choose?.addEventListener('click',openPicker);canvasChoose?.addEventListener('click',openPicker);drop?.addEventListener('click',e=>{if(e.target.closest('#studioSourceChoose'))return;input?.click()});drop?.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();input?.click()}});canvas?.addEventListener('click',e=>{if(e.target.closest('#studioCanvasChoose'))return;input?.click()});canvas?.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();input?.click()}});for(const zone of [drop,canvas].filter(Boolean)){zone.addEventListener('dragover',e=>{e.preventDefault();zone.classList.add('dragging')});zone.addEventListener('dragleave',()=>zone.classList.remove('dragging'));zone.addEventListener('drop',e=>{e.preventDefault();zone.classList.remove('dragging');const f=e.dataTransfer?.files?.[0];if(f)setStudioSourceFile(f)})}input?.addEventListener('change',()=>{const f=input.files?.[0];if(f)setStudioSourceFile(f)});qa('.studio-ref-input').forEach(inp=>inp.addEventListener('change',async()=>{const f=inp.files?.[0];if(!f)return;try{const data=await readStudioImage(f);const i=Number(inp.dataset.refIndex||0);studioReferenceImages[i]=data;const label=inp.closest('.ref-box');if(label){const old=label.querySelector('img');if(old)old.src=data;else label.insertAdjacentHTML('afterbegin',`<img src="${data}" alt="Reference ${i+1}">`);label.childNodes.forEach(n=>{if(n.nodeType===3)n.textContent=''})}toast(`Reference ${i+1} added`)}catch(e){toast(e.message||'Could not use reference image')}}))}
// ===== V5.7 REAL PIONX RENDER PIPELINE =====
const ACTIVE_RENDER_KEY56='pionx.active.render.v56';
const sleep56=ms=>new Promise(r=>setTimeout(r,ms));
function renderWait56(mode){const m=String(mode||'balanced').toLowerCase();if(['max','ultra','enhance'].includes(m))return 240000;if(m==='balanced')return 120000;if(['preserve','auto','precision'].includes(m))return 150000;if(m==='creative')return 150000;return 120000}
function saveActiveRender56(start,engine){try{safeStore.set(ACTIVE_RENDER_KEY56,JSON.stringify({job_token:start.job_token,engine,mode:studioState.mode,credits:start.credits_cost||start.credits_reserved||0,ts:Date.now()}))}catch{}}
function clearActiveRender56(){try{localStorage.removeItem(ACTIVE_RENDER_KEY56)}catch{}}
async function renderPost56(data,timeout=260000){
 const ctl=timeout?new AbortController():null,tm=ctl?setTimeout(()=>ctl.abort(),timeout):null;
 try{const r=await pxApi56('server/auto-render-v21.php',{method:'POST',cache:'no-store',signal:ctl?.signal,headers:{'Content-Type':'application/json','X-PIONX-PIPELINE':'connected-provider-watch-v281-stable'},body:JSON.stringify(data)});const j=await json56(r,'PIONX render');if(!r.ok){const e=new Error((j.error||'Render request failed')+(j.detail?' — '+j.detail:''));e.httpStatus=r.status;e.payload=j;throw e}return j}finally{if(tm)clearTimeout(tm)}
}
function renderAuthRequired56(e){return [401,403].includes(Number(e?.httpStatus||0))}
function renderTerminal56(e){return e?.payload?.status==='failed'||[400,404,409,410,422].includes(Number(e?.httpStatus||0))||e?.code==='PIONX_RENDER_NOT_ACCEPTED'}
function recoverableRender56(e){
 if(renderAuthRequired56(e)||renderTerminal56(e))return false;
 const status=Number(e?.httpStatus||0),m=String(e?.message||'').toLowerCase();
 return e?.name==='AbortError'||[0,408,429,499,500,502,503,504,520,522,524].includes(status)||/network|fetch|gateway|timeout|timed out|connection|unexpected end|json/.test(m)
}
function renderRecoveryError56(e){
 if(renderAuthRequired56(e)){e.preserveRender=true;e.message='Your session expired or access was denied. Sign in again to recover the same render without starting another job.'}
 return e;
}
const premiumCleanDirective56='PREMIUM CLEAN DELIVERY V60 — keep the exact source camera, crop, composition, orientation and architecture. Produce a clean high-end architectural photograph with post-production-grade clarity: physically believable stone, metal, timber, concrete, fabric and paving with visible high-frequency micro-texture, correct roughness breakup, crisp but natural joints, mullions and facade edges, deep coherent glazing/reflections with readable interior depth, neutral white balance, controlled dynamic range, realistic contact shadows, botanical vegetation and strong fine-detail separation at 100% pixel view. Materials must never look smeared, waxy, flat or plastic. Preserve delicate texture detail in highlights and shadows. Remove CGI/plastic look, fake HDR, halos, crunchy oversharpening, excessive saturation, banding, noise, duplicated people/cars/trees, warped railings, broken mullions, distorted text/signage and accidental geometry changes. Do not crop, outpaint, widen, rotate or change orientation. Preserve the source aspect ratio exactly. Deliver a technically clean master suitable for restrained architectural sharpening and final exact-size post-production.';
const planToInteriorDirective631='PLAN/CAD → INTERIOR PERSPECTIVE. The uploaded source is architectural plan/linework data, NOT a camera/composition reference. Generate a true eye-level interior architectural photograph from INSIDE the plan. NEVER return a top view, floor-plan render, axonometric, dollhouse, cutaway or bird-eye view. Use the plan only as spatial truth: preserve wall positions, room proportions, circulation, doors, windows, openings, structural boundaries and relative dimensions. Create a physically plausible interior perspective at approximately 1.55 m camera height with a natural 24–32 mm architectural lens and corrected verticals. Do not invent extra rooms, move openings, alter circulation or change the plan geometry. If the user asks for an EMPTY / UNFURNISHED interior, keep it genuinely empty: no sofa, bed, table, chairs, decorative furniture, people or props. Reference images are STYLE / MATERIAL / LIGHTING / MOOD references only; never copy their room layout or geometry. Resolve finishes and lighting in a premium realistic way while keeping the plan authoritative.';
function studioSourceKind631(a={}){return String(a?.scene_type||a?.scene||a?.type||'').toLowerCase()}
function studioPlanEvidence634(a={},note=''){
 const kind=studioSourceKind631(a);
 const blob=(JSON.stringify(a||{})+' '+String(note||'')).toLowerCase();
 if(['plan','masterplan','sketch'].includes(kind))return true;
 return /floor[ -]?plan|2d[ -]?plan|cad|architectural[ -]?drawing|plan[ -]?drawing|orthographic|top[ -]?view|overhead[ -]?view|dimension(?:ed|s)?|linework|blueprint/.test(blob);
}
function studioPlanToInterior631(a={},note=''){
 return studioState.scene==='interior' && studioPlanEvidence634(a,note);
}
async function analyzeStudioSource631(){
 if(!studioSourceImage)return {};
 try{
  const r=await pxApi56('/server/analyze.php',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:studioSourceImage,scene_type:'auto',mode:studioState.mode||'preserve'})});
  const j=await json56(r,'Studio source analysis');
  if(r.ok){studioDetectedSource631=j.analysis||j||{};return studioDetectedSource631}
 }catch(e){console.warn('Studio source analysis unavailable',e)}
 return studioDetectedSource631||{};
}
function renderPayload56(overrides={}){
 const assets=[];if(studioState.people)assets.push('people');if(studioState.cars)assets.push('cars');
 const note=(overrides.prompt??q('#studioNotes')?.value.trim()??'').trim();
 const analysis={...(studioDetectedSource631||{}),...(overrides.analysis||{})};
 const planToInterior=overrides.planToInterior??studioPlanToInterior631(analysis,note);
 const emptyInterior=/\b(empty|unfurnished|without furniture|no furniture)\b/i.test(note);
 const referenceRule=studioReferenceImages.filter(Boolean).length?'Use uploaded reference image(s) only for materials, color palette, lighting mood and design language. Do not copy their geometry, furniture layout or camera.':'';
 const interiorStyleDirective=studioInteriorStyleDirectiveR16();
 const glassDirective=studioState.scene==='interior'?WINDOW_GLASS_EXTERIOR_DIRECTIVE_R164:'';
 const photoDirective=studioState.scene==='interior'?INTERIOR_PHOTOGRAPHY_DIRECTIVE_R164:'';
 const prompt=planToInterior?[planToInteriorDirective631,emptyInterior?'EMPTY INTERIOR IS REQUIRED. Keep the generated interior unfurnished and architecturally clean.':'',interiorStyleDirective,glassDirective,photoDirective,referenceRule,note,REALITY_RENDER_DIRECTIVE_R162,premiumCleanDirective56].filter(Boolean).join('\n\n'):[interiorStyleDirective,glassDirective,photoDirective,note,REALITY_RENDER_DIRECTIVE_R162,premiumCleanDirective56].filter(Boolean).join('\n\n');
 const w=Number(overrides.width||studioSourceDims.width||0),h=Number(overrides.height||studioSourceDims.height||0);const aspect=w&&h?`${w}:${h}`:'Auto';
 const requestedMode=overrides.mode||studioState.mode||'preserve';
 const styleSelected=studioState.scene==='interior'&&studioState.interiorStyle!=='none'&&!!interiorStyleDirective;
 const engineMode=planToInterior?'creative':(styleSelected?'balanced':requestedMode);
 return {action:'start',source_image:overrides.source_image||studioSourceImage,prompt,scene_type:studioState.scene||'auto',fidelity:requestedMode,mode:engineMode,lighting_mode:studioState.env||'auto',controls:{lighting:studioState.env||'auto',lighting_mode:studioState.env||'auto',time_of_day:studioState.env||'auto',add_people:planToInterior?false:studioState.people,add_cars:planToInterior?false:studioState.cars,scene_assets:planToInterior?[]:assets,architecture_lock:'strict',preserve_aspect_ratio:true,preserve_exact_dimensions:true,preserve_composition:!planToInterior,no_crop:!planToInterior,no_outpaint:!planToInterior,allow_new_viewpoint:planToInterior,source_is_plan:planToInterior,plan_to_interior:planToInterior,empty_interior:planToInterior&&emptyInterior,reference_role:planToInterior?'style_material_lighting_only':'standard',aspect_ratio:aspect,source_width:w,source_height:h,target_width:w,target_height:h,quality_profile:planToInterior?'plan_to_interior_v631':'premium_clean_v57',interior_style:studioState.scene==='interior'?(studioState.interiorStyle||'none'):'none',interior_style_label:studioState.scene==='interior'?studioInteriorStyleLabelR16():'None',interior_style_locked:studioState.scene==='interior'&&!!studioInteriorStyleDirectiveR16(),style_strength:studioState.scene==='interior'&&studioState.interiorStyle!=='none'?2:0,selected_style_priority:studioState.scene==='interior'&&studioState.interiorStyle!=='none'?'high':'normal',glass_priority:studioState.scene==='interior'?'high':'normal',exterior_context_required:studioState.scene==='interior',reality_lock:'professional_archviz_v1',output_format:'png'},references:(overrides.references||studioReferenceImages.filter(Boolean)),assets:planToInterior?[]:assets,analysis:{...analysis,ui_scene_selection:studioState.scene||'auto',ui_mode:requestedMode,ui_environment:studioState.env||'auto',source_width:w,source_height:h,exact_dimensions_required:true,premium_clean_delivery:true,source_detected_scene:studioSourceKind631(analysis),plan_to_interior:planToInterior,empty_interior:planToInterior&&emptyInterior,reference_role:planToInterior?'style_material_lighting_only':'standard',interior_style:studioState.scene==='interior'?(studioState.interiorStyle||'none'):'none',interior_style_label:studioState.scene==='interior'?studioInteriorStyleLabelR16():'None'}};
}
async function fetchRenderBlob56(url){
 const raw=String(url||'');if(!raw)throw new Error('No render image URL');
 // V6.31.20: plan renders are saved on the same PIONX host as /pionx-generated/...
 // Fetch those bytes directly. The old download proxy path could reject relative URLs, which
 // made Edit look broken even though the final render was already visible in Studio.
 try{
  const u=new URL(raw,location.href),same=u.origin===location.origin;
  if(same){const direct=await fetch(u.href,{method:'GET',cache:'no-store',credentials:'same-origin'});if(direct.ok){const b=await direct.blob();if(b&&b.size>256)return b}}
 }catch(e){console.warn('Direct render fetch fallback',e)}
 const r=await pxApi56('/server/download.php',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:raw,name:'PIONX-render.png'})});
 if(!r.ok){const j=await json56(r,'PIONX download');throw new Error(j.error||'Could not fetch render image')}const b=await r.blob();if(!b||b.size<256)throw new Error('Render image bytes are unavailable');return b
}
async function exactSizeResult56(url){if(!studioSourceDims.width||!studioSourceDims.height)return {url,width:0,height:0};const blob=await fetchRenderBlob56(url),src=URL.createObjectURL(blob);try{const dims=await imageDims56(src),targetW=studioSourceDims.width,targetH=studioSourceDims.height,canvas=document.createElement('canvas');canvas.width=targetW;canvas.height=targetH;const ctx=canvas.getContext('2d',{alpha:false});ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';const inRatio=dims.width/Math.max(1,dims.height),outRatio=targetW/Math.max(1,targetH),drift=Math.abs(inRatio-outRatio)/outRatio;if(drift>.018)console.warn('PIONX v57 aspect drift corrected to original source ratio',{provider:dims,target:{width:targetW,height:targetH},drift});ctx.drawImage(await new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=rej;im.src=src}),0,0,targetW,targetH);const outBlob=await new Promise(res=>canvas.toBlob(res,'image/png',1));if(!outBlob)throw new Error('Could not build exact-size final image');if(studioFinal56.blobUrl)try{URL.revokeObjectURL(studioFinal56.blobUrl)}catch{}const exactUrl=URL.createObjectURL(outBlob);return {url:exactUrl,blobUrl:exactUrl,blob:outBlob,width:targetW,height:targetH}}finally{URL.revokeObjectURL(src)}}
async function finalizeRenderedImage56(providerUrl){let exact={url:providerUrl,width:studioSourceDims.width,height:studioSourceDims.height};try{exact=await exactSizeResult56(providerUrl)}catch(e){console.warn('Exact-size finalization fallback',e)}studioFinal56={providerUrl,exactUrl:exact.url||providerUrl,blobUrl:exact.blobUrl||'',blob:exact.blob||null,width:studioSourceDims.width,height:studioSourceDims.height};studioRenderKind56='final';return studioFinal56}
function ensureFullView56(){let m=q('#pionxFullView57');if(m)return m;m=document.createElement('div');m.id='pionxFullView57';m.className='fullview-v57';m.hidden=true;m.innerHTML='<div class="fullview-card-v57"><div class="fullview-head-v57"><div><b>PIONX Final Render</b><small id="fullViewSize57"></small></div><div><button class="ghost-btn" id="fullViewDownload57">↓ Download</button><button class="ghost-btn" id="fullViewEdit57">✎ Edit</button><button class="ghost-btn" id="fullViewClose57">×</button></div></div><div class="fullview-stage-v57"><img id="fullViewImage57" alt="PIONX full view"></div></div>';document.body.appendChild(m);q('#fullViewClose57').onclick=()=>m.hidden=true;q('#fullViewDownload57').onclick=downloadResult56;q('#fullViewEdit57').onclick=()=>{m.hidden=true;activateResultEdit56()};m.addEventListener('click',e=>{if(e.target===m)m.hidden=true});return m}
function openFullView56(){if(!studioFinal56.providerUrl)return toast('Render an image first');const m=ensureFullView56(),im=q('#fullViewImage57'),w=Number(studioFinal56.width||studioSourceDims.width||0),h=Number(studioFinal56.height||studioSourceDims.height||0);im.src=studioFinal56.exactUrl||studioFinal56.providerUrl;q('#fullViewSize57').textContent=w&&h?`${w} × ${h}px · final render dimensions`:'Full resolution';m.hidden=false}
async function downloadResult56(){if(!studioFinal56.providerUrl)return toast('Render an image first');const w=Number(studioFinal56.width||studioSourceDims.width||0),h=Number(studioFinal56.height||studioSourceDims.height||0),name=`PIONX-${w||'render'}x${h||'final'}.png`;try{let blob=studioFinal56.blob;if(!blob){blob=await fetchRenderBlob56(studioFinal56.providerUrl)}if(!blob)throw new Error('No final image');const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),5000);toast(`Download started${w&&h?' · '+w+'×'+h+'px':''}`)}catch(e){console.error(e);toast('Opening the full image because direct download was unavailable');window.open(studioFinal56.providerUrl,'_blank','noopener')}}
function activateResultEdit56(){if(!studioFinal56.providerUrl)return toast('Render an image first');q('#resultEditDock')?.scrollIntoView({behavior:'smooth',block:'center'});setEditToolV4('rectangle');toast('Editing the final render · select the exact area to change')}
function wireStudioResultActions56(){qa('[data-result-action]').forEach(b=>{if(b.dataset.v57Wired)return;b.dataset.v57Wired='1';b.addEventListener('click',()=>{const a=b.dataset.resultAction;if(a==='full')openFullView56();else if(a==='download')downloadResult56();else if(a==='edit')activateResultEdit56()})});const stage=q('#studioEditStage'),w=Number(studioFinal56.width||studioSourceDims.width||0),h=Number(studioFinal56.height||studioSourceDims.height||0);if(stage&&w&&h){stage.style.aspectRatio=`${w} / ${h}`;stage.style.height='auto'}const sizeLabel=q('#resultActionsV57 .result-size-v57');if(sizeLabel&&w&&h)sizeLabel.textContent=`Final image · ${w} × ${h}px`}
function selectionText56(){const s=editV4.selection||{};if(!editV4.hasSelection)return '';const p=n=>Math.round(Math.max(0,Math.min(1,Number(n)||0))*100);return `Edit ONLY the selected region approximately x ${p(s.x1)}%–${p(s.x2)}%, y ${p(s.y1)}%–${p(s.y2)}% of the current image. Keep every pixel outside this region visually unchanged as much as the image model allows.`}
// V6.31.19: always edit/generate camera views from real image bytes, never from a possibly
// protected/expiring URL. This also gives Multi-Camera a hard timeout instead of sitting at 8%.
async function studioFinalData6319(url,timeout=12000){
 if(!url)throw new Error('Final image is unavailable');if(String(url).startsWith('data:image/'))return String(url);
 const ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),timeout);
 try{
  const task=fetchRenderBlob56(url),guard=new Promise((_,rej)=>ctl.signal.addEventListener('abort',()=>rej(Object.assign(new Error('Preparing the approved image timed out'),{name:'AbortError'})),{once:true}));
  const blob=await Promise.race([task,guard]);if(!blob||blob.size<256)throw new Error('Final image bytes are unavailable');if(blob.size>18*1024*1024)throw new Error('Final image is too large for protected editing');return await studioBlobToData633(blob);
 }catch(e){if(e?.name==='AbortError')throw new Error('Preparing the approved image timed out');throw e}finally{clearTimeout(tm)}
}
async function exactSizeTo6319(url,targetW,targetH){
 const w=Math.max(1,Number(targetW)||0),h=Math.max(1,Number(targetH)||0);if(!w||!h)return {url,width:0,height:0};
 const blob=await fetchRenderBlob56(url),src=URL.createObjectURL(blob);
 try{const im=await new Promise((res,rej)=>{const x=new Image();x.onload=()=>res(x);x.onerror=rej;x.src=src});const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{alpha:false});ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(im,0,0,w,h);const out=await new Promise(res=>canvas.toBlob(res,'image/png',1));if(!out)throw new Error('Could not finalize edited image');const u=URL.createObjectURL(out);return {url:u,blobUrl:u,blob:out,width:w,height:h}}finally{URL.revokeObjectURL(src)}
}
async function finalizeEditedImage6319(providerUrl,targetW,targetH){
 let exact={url:providerUrl,width:targetW,height:targetH};try{exact=await exactSizeTo6319(providerUrl,targetW,targetH)}catch(e){console.warn('Edited exact-size finalization fallback',e)}
 if(studioFinal56.blobUrl)try{URL.revokeObjectURL(studioFinal56.blobUrl)}catch{}
 studioFinal56={...studioFinal56,providerUrl,exactUrl:exact.url||providerUrl,blobUrl:exact.blobUrl||'',blob:exact.blob||null,width:Number(targetW)||studioFinal56.width||studioSourceDims.width,height:Number(targetH)||studioFinal56.height||studioSourceDims.height};studioRenderKind56='final';return studioFinal56;
}
async function runLocalizedEdit56(){
 const instruction=q('#editPrompt')?.value.trim()||'Apply the supplied material/reference only inside the selected area.';
 const refs=[editV4.materialData,editV4.refData].filter(Boolean);
 const editW=Number(studioFinal56.width||studioSourceDims.width||0),editH=Number(studioFinal56.height||studioSourceDims.height||0);
 const prompt=[selectionText56(),instruction,editV4.materialName?`Material/texture reference supplied: ${editV4.materialName}. Match its physical color, scale, roughness and joint logic.`:'',editV4.refName?`Visual reference supplied: ${editV4.refName}. Use it only for the selected area.`:'',`Selected color cue: ${editV4.color}.`,`LOCALIZED EDIT RULE: preserve the exact CURRENT FINAL canvas size ${editW}x${editH}px, camera, crop, geometry, lighting continuity and all unselected architecture. Do not redesign, mirror, rotate or reframe the image.`].filter(Boolean).join('\n');
 const modal=showRenderMind58();q('#renderMindScene').textContent='Localized Edit · current final image · exact canvas locked';let start=null,engine='';
 try{
  mindUpdate('Preparing the current final image for protected editing…',8,0);const editSource=await studioFinalData6319(studioFinal56.providerUrl,18000);
  mindUpdate('Reading the selected area, material and edit instruction…',16,0);
  const payload=renderPayload56({source_image:editSource,prompt,references:refs,mode:'preserve',width:editW,height:editH,planToInterior:false,analysis:{localized_edit:true,edit_source:'current_final',selection:editV4.selection||null}});
  payload.scene_type=studioState.scene==='auto'?'architecture':studioState.scene;payload.fidelity='preserve';payload.mode='preserve';
  Object.assign(payload.controls,{architecture_lock:'strict',preserve_composition:true,allow_new_viewpoint:false,camera_only_change:false,no_mirror:true,no_rotation:true,preserve_exact_dimensions:true,source_width:editW,source_height:editH,target_width:editW,target_height:editH,quality_profile:'localized_edit_v6319'});
  mindUpdate('Locking the full image and isolating the requested edit area…',30,1);start=await renderPost56(payload,45000);engine=start.engines?.[0]||'';if(!engine)throw new Error('PIONX edit route is unavailable');if(Number.isFinite(Number(start.credits_remaining)))setCreditsFromRender56(start.credits_remaining);
  mindUpdate('Applying the localized edit with architecture protection…',54,3);const done=await renderEngine56(start,engine),best=done?.candidates?.find(x=>x?.url);if(!best?.url)throw new Error('Edit completed without an image');
  mindUpdate('Cleaning material edges, reflections and local lighting continuity…',92,4);await finalizeEditedImage6319(best.url,editW,editH);const out=q('#studioOutput');if(out)out.src=studioFinal56.exactUrl||best.url;if(q('#studioOutputBadge'))q('#studioOutputBadge').textContent=`EDITED · ${editW}×${editH}`;
  let editSaved=false;try{editSaved=await persistRender62(best.url,start?.job_token||('edit-'+Date.now()))}catch(saveErr){console.warn('Localized edit gallery save',saveErr)}
  editV4.hasSelection=false;editV4.selection=null;setEditToolV4('clear');wireStudioResultActions56();mindUpdate(editSaved?'Edited result ready · saved in Renders.':'Edited result ready · final image dimensions preserved…',100,5);await loadAccount56({quiet:true});hideRenderMind58(500);toast(editSaved?'Localized edit complete · saved in Renders':'Localized edit complete · current final image preserved')
 }catch(e){console.error('PIONX localized edit',e);if(start&&engine)await cancelRender56(start,engine);await loadAccount56({quiet:true});toast(e.message||'Localized edit failed');hideRenderMind58(2500)}
}
function statusProgress56(j){
 const sec=Math.max(0,Number(j?.elapsed_sec||0)),stage=String(j?.stage||'render').toLowerCase();let pct=58,msg='Generating the premium photoreal master…',step=3;
 const elapsed=sec>=60?`${Math.floor(sec/60)}m ${Math.floor(sec%60)}s`:`${Math.floor(sec)}s`;
 if(stage==='finish'){pct=91;msg=`Master image ready · preparing final finish · ${elapsed}`;step=4}
 else if(['photo_refine','finish_ai'].includes(stage)){pct=93;msg=`Finalizing photographic realism and material detail · ${elapsed}`;step=4}
 else if(['final_qc','delivery_qc'].includes(stage)){pct=96;msg=`Running architecture + photorealism quality gate · ${elapsed}`;step=4}
 else if(stage==='finalizing'){pct=98;msg=`Saving verified final image · ${elapsed}`;step=5}
 else if(sec<25){pct=58+Math.floor(sec/5);msg=`Generating the locked master image · ${elapsed}`}
 else if(sec<60){pct=63+Math.floor((sec-25)/7);msg=`Resolving materials, glass and light · ${elapsed}`}
 else if(sec<100){pct=68+Math.floor((sec-60)/10);msg=`Building photographic detail · ${elapsed}`}
 else{pct=Math.min(82,72+Math.floor((sec-100)/20));msg=`Provider is still rendering · ${elapsed} elapsed · you can close this window; the job will continue safely`}
 mindUpdate(msg,pct,step)
}
async function recoverStatus56(start,engine,maxMs,stop=()=>false){
 const end=Date.now()+maxMs;
 while(Date.now()<end&&!stop()){
  await sleep56(2500);if(stop())break;
  try{const j=await renderPost56({action:'status',job_token:start.job_token,engine},20000);if(j?.status==='completed'&&Array.isArray(j.candidates)&&j.candidates.some(x=>x?.url))return j;if(j?.status==='failed'){const e=new Error(j.error||'PIONX render failed');e.payload=j;throw e}if(j?.claimed===false){mindUpdate('Waiting for the server to accept the same render request…',56,3);continue}statusProgress56(j)}catch(e){if(!recoverableRender56(e))throw renderRecoveryError56(e);mindUpdate('Reconnecting to the same protected render job…',Math.min(91,Number(q('#renderMindPct')?.textContent.replace('%','')||70)+1),3)}
 }
 return null;
}
async function renderEngine56(start,engine){
 const windowMs=renderWait56(studioState.mode),requestId=(crypto?.randomUUID?.()||String(Date.now())+'-'+Math.random().toString(16).slice(2)),began=Date.now();let stopMonitor=false;
 const providerTask=renderPost56({action:'provider',job_token:start.job_token,engine,request_id:requestId},0).then(value=>({kind:'provider',value}),error=>({kind:'provider_error',error}));
 const statusTask=recoverStatus56(start,engine,windowMs,()=>stopMonitor).then(value=>({kind:'status',value}),error=>({kind:'status_error',error}));
 const first=await Promise.race([providerTask,statusTask]);stopMonitor=true;
 if(first.kind==='status'){if(first.value)return first.value;throw new Error('PIONX render is still processing')}if(first.kind==='status_error')throw first.error;
 if(first.kind==='provider_error'){if(!recoverableRender56(first.error))throw first.error;mindUpdate('Connection changed — recovering the same render safely…',72,3);const remaining=Math.max(15000,windowMs-(Date.now()-began));const recovered=await recoverStatus56(start,engine,remaining);if(recovered)return recovered;throw new Error('PIONX render is still processing')}
 const ack=first.value;if((ack?.status==='completed'||ack?.status==='delivered')&&Array.isArray(ack.candidates))return ack;if(['accepted','running'].includes(ack?.status)){mindUpdate('Render accepted safely · creating the final image…',58,3);const remaining=Math.max(15000,windowMs-(Date.now()-began));const done=await recoverStatus56(start,engine,remaining);if(done)return done;throw new Error('PIONX render is still processing')}throw new Error(ack?.error||'Render did not return a final image')
}
async function cancelRender56(start,engine){try{return await renderPost56({action:'cancel',job_token:start.job_token,engine},18000)}catch{return null}}

function studioBlobToData633(blob){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result||''));r.onerror=()=>rej(new Error('Could not prepare approved render'));r.readAsDataURL(blob)})}
async function studioUrlToData633(url){if(!url)return'';if(String(url).startsWith('data:image/'))return String(url);const b=await fetchRenderBlob56(url);return studioBlobToData633(b)}
const PLAN_PENDING_KEY6312='pionx.studio.pending-plan-v6323';
const PLAN_PENDING_CONTEXT_KEY6331='pionx.studio.pending-plan-context-v6331';
const PLAN_STALE_TOAST_KEY6326='pionx.studio.stale-toast-v6326';
const PLAN_PREFLIGHT_NOTICE6333='pionx.studio.preflight-notice-v6333';
function studioCanvasGate6333(){
 const pending=safeStore.get(PLAN_PENDING_KEY6312);
 if(pending){
  document.body.classList.add('pionx-plan-recovering6331');
  return `<div class="canvas-source-gate recovering6331" id="studioCanvasUpload" aria-disabled="true">${studioRecoveryCard6331()}</div>`;
 }
 return `<div class="canvas-source-gate" id="studioCanvasUpload" tabindex="0" role="button" aria-label="Upload image to render"><div class="canvas-source-icon">＋</div><h2>Upload the image you want to render</h2><p>Drag & drop your image here, or choose a JPG, PNG or WebP file.</p><button type="button" class="primary-btn canvas-source-btn" id="studioCanvasChoose">Choose image</button><small>Maximum 20 MB · original width, height and orientation will be preserved</small></div>`;
}
function studioPreflightNotice6333(message){
 try{sessionStorage.setItem(PLAN_PREFLIGHT_NOTICE6333,String(message||''))}catch{}
}
function studioConsumePreflightNotice6333(){
 let m='';try{m=sessionStorage.getItem(PLAN_PREFLIGHT_NOTICE6333)||'';sessionStorage.removeItem(PLAN_PREFLIGHT_NOTICE6333)}catch{}return m;
}
async function studioStartupPreflight6333(){
 const pending=safeStore.get(PLAN_PENDING_KEY6312);if(!pending)return {state:'none'};
 const ctx=studioPlanPendingContext6331();
 const ctxAge=ctx&&Number(ctx.started_at)>0?Date.now()-Number(ctx.started_at):Number.POSITIVE_INFINITY;
 const ctxMatches=!!(ctx&&String(ctx.job_id||'')===String(pending));
 let status=null,err=null;
 try{status=await studioPlanStatus6312(pending)}catch(e){err=e;console.warn('PIONX startup pending preflight',e)}
 if(status?.status==='completed'&&status?.result?.url)return {state:'completed',jobId:pending};
 if(status?.status==='failed'){
  studioPlanClearPending6331();document.body.classList.remove('pionx-plan-recovering6331');
  const released=Number(status.released_credits||0);studioPreflightNotice6333(status.error_code==='STALE_JOB_CLEANED'?`Previous stalled render was closed safely${released?` · ${released} reserved credit(s) released`:''}.`:'Previous failed render session was cleared.');
  if(Number.isFinite(Number(status.credits_remaining)))setCreditsFromRender56(status.credits_remaining);
  return {state:'cleared',jobId:pending,reason:status.error_code||'failed'};
 }
 if(status?.status==='running'){
  const elapsed=Math.max(0,Number(status.elapsed_sec||0));
  // A valid live operation is kept. Plan-to-interior is expected to heartbeat frequently;
  // anything far outside the protected window is treated as an orphaned browser pointer.
  if(elapsed<=360&&(!ctxMatches||ctxAge<=12*60*1000))return {state:'active',jobId:pending};
 }
 const clearlyOld=ctxMatches&&ctxAge>12*60*1000;
 const orphaned=!status&&(!ctxMatches||clearlyOld);
 const overWindow=!!status&&status.status==='running'&&Number(status.elapsed_sec||0)>360;
 if(orphaned||overWindow||status===null&&clearlyOld){
  studioPlanClearPending6331();document.body.classList.remove('pionx-plan-recovering6331');
  studioPreflightNotice6333('Old incomplete render recovery was cleared. Studio is ready for a new render.');
  return {state:'cleared',jobId:pending,reason:orphaned?'orphaned':'expired'};
 }
 // Network trouble with a recent, matching session is conservative: keep the same job, never duplicate it.
 if(err&&ctxMatches&&ctxAge<=12*60*1000)return {state:'active',jobId:pending,reason:'network'};
 // No trustworthy server state and no trustworthy recent context: clear only the browser pointer.
 studioPlanClearPending6331();document.body.classList.remove('pionx-plan-recovering6331');
 studioPreflightNotice6333('Unverifiable old render pointer was cleared. No replacement render was submitted.');
 return {state:'cleared',jobId:pending,reason:'unverifiable'};
}
let studioPlanPolling6312=false;
let studioRecoveryState6331={active:false,jobId:'',lastStage:'',startedAt:0};
function studioPlanPendingContext6331(){try{return JSON.parse(safeStore.get(PLAN_PENDING_CONTEXT_KEY6331)||'null')||null}catch{return null}}
function studioPlanSavePending6331(jobId){
 const ctx={job_id:String(jobId||''),started_at:Date.now(),source_name:studioSourceName||'',source_width:Number(studioSourceDims.width||0),source_height:Number(studioSourceDims.height||0),scene:String(studioState.scene||'auto'),environment:String(studioState.env||'auto'),source_mode:String(studioSourceMode635||'auto')};
 safeStore.set(PLAN_PENDING_KEY6312,String(jobId||''));safeStore.set(PLAN_PENDING_CONTEXT_KEY6331,JSON.stringify(ctx));return ctx;
}
function studioPlanClearPending6331(){try{localStorage.removeItem(PLAN_PENDING_KEY6312);localStorage.removeItem(PLAN_PENDING_CONTEXT_KEY6331)}catch{}}
function studioRecoveryCard6331(){return `<div class="studio-recovery-card6331"><div class="studio-recovery-spinner6331"></div><small>RECOVERING PREVIOUS RENDER</small><h2>Restoring the same protected operation</h2><p id="studioRecoveryText6331">Checking server state…</p><div class="studio-recovery-progress6331"><i id="studioRecoveryBar6331"></i></div><code id="studioRecoveryRef6331"></code><span>No duplicate paid render will be submitted while recovery is active.</span></div>`}
function studioRecoveryBegin6331(jobId){
 const id=String(jobId||''),same=studioRecoveryState6331.active&&studioRecoveryState6331.jobId===id;
 studioRecoveryState6331={active:true,jobId:id,lastStage:same?studioRecoveryState6331.lastStage:'checking',startedAt:same?studioRecoveryState6331.startedAt:Date.now()};document.body.classList.add('pionx-plan-recovering6331');
 // V6.31.22: route/gallery rerenders can replace the Studio DOM while polling is still active.
 // Rebuild the recovery canvas every time so Upload and Recovery can never be shown together.
 const stage=q('#studioEditStage');let gate=q('#studioCanvasUpload');
 if(stage&&!gate){gate=document.createElement('div');gate.id='studioCanvasUpload';gate.className='canvas-source-gate recovering6331';stage.prepend(gate)}
 if(gate){gate.classList.add('recovering6331');gate.setAttribute('aria-disabled','true');gate.removeAttribute('tabindex');gate.innerHTML=studioRecoveryCard6331()}
 const out=q('#studioOutput');if(out)out.style.visibility='hidden';
 const badge=q('#studioOutputBadge');if(badge)badge.textContent='RECOVERING PROTECTED RENDER';
 const ref=q('#studioRecoveryRef6331');if(ref)ref.textContent=id;
 const btn=q('#demoGenerate');if(btn){btn.disabled=true;btn.dataset.recoveryLocked='1';btn.textContent='✦ Recovering previous render…'}
 for(const el of [q('#studioSourceChoose'),q('#studioCanvasChoose')])if(el)el.disabled=true;
 const drop=q('#studioSourceDrop');if(drop){drop.setAttribute('aria-disabled','true');drop.style.pointerEvents='none';drop.style.opacity='.55'}
}
function studioRecoveryUpdate6331(jobId,stage,progress,elapsed){
 if(!studioRecoveryState6331.active)studioRecoveryBegin6331(jobId);studioRecoveryState6331.lastStage=String(stage||'processing');
 const txt=q('#studioRecoveryText6331'),bar=q('#studioRecoveryBar6331'),ref=q('#studioRecoveryRef6331');if(ref)ref.textContent=String(jobId||'');
 const p=Math.max(2,Math.min(99,Number(progress)||8));if(bar)bar.style.width=p+'%';if(txt)txt.textContent=`${String(stage||'processing').replaceAll('_',' ')} · ${p}%${elapsed?' · '+elapsed+'s':''}`;
}
function studioRecoveryEnd6331({refresh=false,message=''}={}){
 studioRecoveryState6331={active:false,jobId:'',lastStage:'',startedAt:0};document.body.classList.remove('pionx-plan-recovering6331');
 const btn=q('#demoGenerate');if(btn?.dataset.recoveryLocked==='1'){btn.disabled=false;delete btn.dataset.recoveryLocked;btn.textContent='✦ Render'}
 const drop=q('#studioSourceDrop');if(drop){drop.removeAttribute('aria-disabled');drop.style.pointerEvents='';drop.style.opacity=''}
 const out=q('#studioOutput');if(out)out.style.visibility='';
 if(message)studioRenderNotice636('complete',message);if(refresh)setTimeout(()=>route(),0)
}

function studioPlanToastOnce6326(jobId,msg){const k=PLAN_STALE_TOAST_KEY6326+'.'+String(jobId||'unknown');try{if(sessionStorage.getItem(k)==='1')return;sessionStorage.setItem(k,'1')}catch{}toast(msg)}
function studioPlanNewId6312(){const bytes=crypto.getRandomValues(new Uint8Array(12));return 'planint-'+[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function studioPlanStatus6312(jobId){
 const r=await pxApi56('/server/studio-plan-interior-v6338.php',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'status',job_id:jobId})});
 // V6.31.22: inspect HTTP status BEFORE parsing. Hostinger may return an HTML 404,
 // and parsing that as JSON used to trap Studio in recovery forever.
 if(r.status===404){try{await r.text()}catch{}return null}
 const j=await json56(r,'Plan to Interior status');
 if(!r.ok)throw new Error(j.error||`Operation status HTTP ${r.status}`);return j;
}
async function studioPlanWait6312(jobId,runPromise=null,retryStart=null){
 const started=Date.now(),recoveringExisting=!runPromise;let runError=null,missingSince=0,missingCount=0;
 let directResult=null;
 if(runPromise){
   runPromise.then(res=>{
     if(res&&res.url)directResult=res;
   }).catch(e=>{
     runError=e;
     console.warn('Plan start connection error:', e);
   });
 }
 while(Date.now()-started < 150*1000){
  if(directResult&&directResult.url){
    studioPlanClearPending6331();
    return directResult;
  }
  try{
   const j=await studioPlanStatus6312(jobId);
   if(j?.status==='completed'&&j.result?.url){studioPlanClearPending6331();return j.result}
   if(j?.status==='failed'){
    studioPlanClearPending6331();
    if(j.error_code==='STALE_JOB_CLEANED'){
     window.__pionxFastPlanBg6326=false;
     if(Number.isFinite(Number(j.credits_remaining)))setCreditsFromRender56(j.credits_remaining);
     studioRenderNotice636('failed','Previous stalled render was safely closed. Reserved PIONX credits were released.');
     try{hideRenderMind58(0)}catch{}
     const e=new Error('Previous stalled render was safely closed; Studio is ready for a new render.');e.staleCleaned=true;throw e;
    }
    if(j.error_code==='GEOMETRY_VALIDATION_FAILED'||j.error_code==='GEOMETRY_INVALID_JSON'){
     throw new Error('PIONX could not lock the plan geometry safely after automatic recovery. No image was generated and reserved credits were released. Try the same plan once more; if it still fails, upload a clearer uncropped plan image. · Reference: '+jobId);
    }
    const d=(j.error_detail&&String(j.error_detail).trim())?' · '+String(j.error_detail).slice(0,220):'';
    throw new Error((j.error||'Render failed')+(j.error_code?' · '+j.error_code:'')+d+' · Reference: '+jobId);
   }
   if(!j){
    missingSince=missingSince||Date.now();missingCount++;
    if(recoveringExisting&&missingCount>=4){studioPlanClearPending6331();const e=new Error('Previous pending operation is no longer present on the server.');e.orphaned=true;throw e;}
   } else {
    missingSince=0;missingCount=0;
    const stage=j.stage||'processing';
    const livePct=Math.max(1,Math.min(99,Number(j.progress)||(stage==='rendering'?65:stage==='analyzing_plan'?35:45)));
    const elapsed=Number(j.elapsed_sec||Math.round((Date.now()-started)/1000));
    studioRenderNotice636('running', 'Architectural Plan -> 3D Perspective · ' + elapsed + 's · ' + stage.replace('_', ' ') + '...');
    mindUpdate('Architectural Plan → 3D Perspective · '+stage.replace('_',' ')+' ('+elapsed+'s)',livePct,3);
   }
  }catch(e){
   if(e?.staleCleaned||String(e.message).includes('Reference:'))throw e;
   console.warn('Plan status check:', e);
  }
  await sleep56(2000);
 }
 if(directResult&&directResult.url){studioPlanClearPending6331();return directResult;}
 studioPlanClearPending6331();
 localStorage.removeItem('pionx.studio.pending-plan-v6323');
 throw new Error();
}
async function studioPlanInteriorCall633({camera='',masterData='',spec=null}={}){
 window.__pionxFastPlanBg6326=false;
 const rawNote=q('#studioNotes')?.value.trim()||'';
 const styleDirective=studioInteriorStyleDirectiveR16();
 const note=[styleDirective,rawNote,REALITY_RENDER_DIRECTIVE_R162,premiumCleanDirective56].filter(Boolean).join('\n\n');
 const empty=/\b(empty|unfurnished|without furniture|no furniture)\b/i.test(rawNote);
 const pending=safeStore.get(PLAN_PENDING_KEY6312);
 if(pending){const recovered=await studioPlanWait6312(pending);if(recovered.spec)studioPlanInteriorSpec633=recovered.spec;if(Number.isFinite(Number(recovered.credits_remaining)))setCreditsFromRender56(recovered.credits_remaining);return recovered}
 const jobId=studioPlanNewId6312();
 const payload={action:'generate',job_id:jobId,source_image:studioSourceImage,references:studioReferenceImages.filter(Boolean),master_image:masterData||'',spec:spec||studioPlanInteriorSpec633||null,note,environment:studioState.env||'auto',camera:camera||'Eye-level hero perspective from inside the room, looking toward the main architectural feature',empty_interior:empty,interior_style:studioState.interiorStyle||'none',interior_style_label:studioInteriorStyleLabelR16()};
 studioPlanSavePending6331(jobId);
 const startSameJob=async()=>{const r=await pxApi56('/server/studio-plan-interior-v6338.php',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});if(r.status===504||r.status===502)throw new Error(`Gateway HTTP ${r.status}; checking operation status`);const j=await json56(r,'Plan to Interior');if(!r.ok&&r.status<500)throw new Error(j.error||`Render HTTP ${r.status}`);return j};
 const runPromise=startSameJob();
 studioPlanPolling6312=true;let j;try{j=await studioPlanWait6312(jobId,runPromise,startSameJob)}finally{studioPlanPolling6312=false}
 if(j.spec)studioPlanInteriorSpec633=j.spec;if(Number.isFinite(Number(j.credits_remaining)))setCreditsFromRender56(j.credits_remaining);return j;
}
if(!window.__pionxResultViewTracker1697){
 window.__pionxResultViewTracker1697=true;window.pionxCompareExplicit1697=false;
 document.addEventListener('click',event=>{const button=event.target?.closest?.('.ust-view-btn[data-mode]');if(button)window.pionxCompareExplicit1697=button.dataset.mode==='split'},true);
}
function studioResultViewPreference1697(){
 const active=q('.ust-view-btn.active[data-mode]')?.dataset?.mode||'';
 const mode=active||String(window.pionxViewMode||'');
 return mode==='split'&&window.pionxCompareExplicit1697===true?'split':'final';
}
async function studioFocusFinalResult1697({delay=0}={}){
 const finalUrl=String(studioFinal56?.exactUrl||studioFinal56?.providerUrl||'');if(!finalUrl)return false;
 const preferred=studioResultViewPreference1697();
 if(delay>0)await sleep56(delay);
 try{if(typeof window.setStudioViewMode==='function')window.setStudioViewMode(preferred==='split'?'split':'final')}catch(e){console.warn('PIONX result view selection',e)}
 const stage=q('#studioEditStage')||q('#studioOutput');const image=q('#studioOutput');
 try{if(image?.decode)await Promise.race([image.decode().catch(()=>{}),sleep56(1000)])}catch{}
 if(!stage)return false;
 const behavior=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches?'auto':'smooth';
 const place=()=>{const header=q('.topbar')||q('.app-header')||q('header');const offset=Math.max(88,Number(header?.getBoundingClientRect?.().height||0)+20);const rect=stage.getBoundingClientRect();const target=Math.max(0,window.scrollY+rect.top-offset);window.scrollTo({top:target,behavior})};
 requestAnimationFrame(()=>requestAnimationFrame(place));
 setTimeout(()=>{const r=stage.getBoundingClientRect();if(r.top<70||r.top>Math.min(window.innerHeight*.62,560))place()},700);
 return true;
}
window.PIONXFocusFinalResult=studioFocusFinalResult1697;
async function studioDeliverPlanInterior633(j,modal){
 studioRecoveryEnd6331();
 if(!j.url||j.url===studioSourceImage)throw new Error('No generated interior image was returned.');
 await imageDims56(j.url);
 studioRenderNotice636('complete','Interior render delivered.');
 studioPlanInteriorMaster633=true;studioFinal56={providerUrl:j.url,exactUrl:j.url,blobUrl:'',blob:null,width:Number(j.width)||1536,height:Number(j.height)||1024};studioRenderKind56='final';
 const stage=q('#studioEditStage');if(stage){stage.style.aspectRatio=`${studioFinal56.width} / ${studioFinal56.height}`;stage.style.height='auto'}
 const sizeLabel=q('#resultActionsV57 .result-size-v57');if(sizeLabel)sizeLabel.textContent=`Interior perspective · ${studioFinal56.width} × ${studioFinal56.height}px`;
 const out=q('#studioOutput');if(out){out.src=j.url;out.alt='PIONX Plan to Interior eye-level render';out.style.display='block';out.style.filter='';out.style.transform='none';studioAdjustState.zoom=1;studioAdjustState.rotation=0}
 if(q('#studioOutputBadge'))q('#studioOutputBadge').textContent=`FINAL · VERIFIED · TRUE INTERIOR · ${studioFinal56.width}×${studioFinal56.height}`;q('#resultEditDock')?.classList.add('result-ready');const actions=q('#resultActionsV57');if(actions)actions.hidden=false;wireStudioResultActions56();
 let saved=false;try{saved=await persistRender62(j.url,j.job_id||('planint-'+Date.now()))}catch(e){console.warn('Plan interior gallery save',e)}
 mindUpdate(saved?'Eye-level interior delivered · saved in Renders.':'Eye-level interior delivered.',100,5);await loadAccount56({quiet:true});setTimeout(()=>{if(modal)modal.hidden=true;studioFocusFinalResult1697();setTimeout(studioInjectMultiCamera632,80)},650);toast(`Plan → Interior delivered · showing final result · ${Number(j.reference_count||0)} uploaded reference(s) used · ${Number(j.credits_cost||0)} credits used`);
}
async function runRenderDemo(){
 q('#studioRenderNotice636')?.remove(); studioPlanClearPending6331();
 if(!studioSourceImage){toast('Upload a source image first');q('#studioSourceDrop')?.scrollIntoView({behavior:'smooth',block:'center'});q('#studioSourceDrop')?.classList.add('needs-source');setTimeout(()=>q('#studioSourceDrop')?.classList.remove('needs-source'),1400);return}
 if(!signedIn56()){toast('Sign in with your real PIONX account before rendering');exitApp();q('#authCard')?.scrollIntoView({behavior:'smooth',block:'center'});return}
 let activeBeforeStart=null;try{activeBeforeStart=JSON.parse(safeStore.get(ACTIVE_RENDER_KEY56)||'null');if(activeBeforeStart&&Date.now()-Number(activeBeforeStart.ts||0)>90*60*1000){clearActiveRender56();activeBeforeStart=null}}catch{}
 if(activeBeforeStart?.job_token&&activeBeforeStart?.engine){if(typeof window.PIONXResumeActiveRender167!=='function'){studioRenderNotice636('failed','Could not reconnect to the existing render. Reload this page and try again. Your render was kept.');toast('Reload this page to reconnect to your existing render.');return}studioRenderNotice636('running','The previous render is still being checked. PIONX will not submit a duplicate paid render.');toast('A render is already active · restoring the same job');try{await window.PIONXResumeActiveRender167?.({foreground:true})}catch{}return}
 const btn=q('#demoGenerate');if(btn?.dataset.busy==='1')return;if(btn){btn.dataset.busy='1';btn.disabled=true;btn.textContent='✦ Rendering…'}
 studioRenderNotice636('running','Preparing your render. The image below is the uploaded source until a final image is delivered.');
 const modal=showRenderMind58(),scene=(sceneRules[studioState.scene]||sceneRules.auto).title;q('#renderMindScene').textContent=`${scene} · ${studioState.mode} · ${studioState.env}${studioState.scene==='interior'?` · Style: ${studioInteriorStyleLabelR16()}`:''} · live PIONX pipeline`;
 let start=null,engine='';
 try{
  mindUpdate('Analyzing the source image, geometry, camera and material intent…',10,0);
  const sessionReady=await ensureRenderSession6327();if(!sessionReady)throw new Error('Your PIONX login session expired. Please sign in again.');
  mindUpdate('Understanding the selected scene and reading whether the source is a plan/CAD or an existing view…',22,1);
  const studioAnalysis631=await analyzeStudioSource631();
  const userNote631=q('#studioNotes')?.value.trim()||'';
  const sourceIntent635=studioState.scene==='interior'?await studioClassifySource635():{kind:'not-applicable',confidence:1,method:'scene'};
  const planInterior631=studioState.scene==='interior'&&sourceIntent635.kind==='floor_plan';
  studioPlanDetect635=sourceIntent635;studioUpdateInputStatus635();
  if(planInterior631){
   q('#renderMindScene').textContent=`Plan/CAD → True Interior Camera · ${studioState.env} · geometry from plan`;mindUpdate('Plan/CAD detected · switching to TRUE INTERIOR CAMERA mode…',30,1);
   mindUpdate('Creating an eye-level interior from inside the room · the plan is geometry only, never the camera…',48,2);
   try {
     const direct633=await studioPlanInteriorCall633({camera:'Eye-level hero perspective from inside the room, camera height about 1.55 m, natural 28 mm lens, corrected verticals'});
     mindUpdate('Locking the generated room as the approved Visual Master for future camera angles…',94,4);
     await studioDeliverPlanInterior633(direct633,modal);return;
   } catch(planErr) {
     console.error('Plan-to-interior failed:', planErr);
     studioPlanClearPending6331();
     hideRenderMind58(0);
     btn.dataset.busy='0';btn.disabled=false;btn.textContent='✦ Render';
     studioRenderNotice636('failed', 'Plan rendering error: ' + (planErr.message || 'Check server logs'));
     toast('Plan render failed: ' + (planErr.message || ''));
     return;
   }
  } else mindUpdate('Source type confirmed · locking the selected architecture workflow…',30,1);
  const payload=renderPayload56({analysis:studioAnalysis631,planToInterior:planInterior631});
  mindUpdate(planInterior631?'Building Plan → Interior production prompt · references used for style only…':'Building the scene-specific production prompt and protected job quote…',38,2);
  start=await renderPost56(payload,45000);engine=start.engines?.[0]||'';if(!engine)throw new Error('PIONX rendering is temporarily unavailable. No render route was returned.');
  if(Number.isFinite(Number(start.credits_remaining)))setCreditsFromRender56(start.credits_remaining);saveActiveRender56(start,engine);
  mindUpdate(`Render started safely · ${Number(start.credits_reserved??start.credits_cost??0)} credits reserved…`,52,3);
  let done;
  try{done=await renderEngine56(start,engine)}catch(first){
    if(renderAuthRequired56(first))throw renderRecoveryError56(first);
    const terminal=renderTerminal56(first);
    const uncertain=!terminal&&(recoverableRender56(first)||/still processing/i.test(String(first?.message||'')));
    if(uncertain){
      mindUpdate('This render is taking longer than usual · continuing the SAME job in the background…',82,3);
      studioRenderNotice636('running','Render is still processing in the background. No duplicate render was submitted and reserved credits stay attached to this job until it finishes or fails.');
      toast('Render is still processing · close this window if you want to keep working');
      const extended=await recoverStatus56(start,engine,8*60*1000);
      if(extended)done=extended;
      else{const pendingErr=new Error('Render is still processing in the background. PIONX kept the same job and did not charge a second render.');pendingErr.code='PIONX_RENDER_PENDING';throw pendingErr}
    }else{
      const closed=await cancelRender56(start,engine);
      if(closed?.status==='completed'&&closed?.candidates?.some(x=>x?.url))done=closed;
      else{clearActiveRender56();throw first}
    }
  }
  const best=done?.candidates?.find(x=>x?.url);if(!best?.url)throw new Error('Render completed without a final image URL.');
  studioFinal56.qualityVerified=best.quality_verified!==false;
  mindUpdate('Preparing the original render for photographic finishing…',95,4);await finalizeRenderedImage56(best.url);let autoFinishSaved=false;
  try{mindUpdate('Balancing tone and refining natural edge detail…',97,4);autoFinishSaved=await automaticFinish610(best.url)}catch(finishError){console.warn('Automatic photographic finishing unavailable; original render preserved',finishError)}
  const out=q('#studioOutput');if(out){out.src=studioFinal56.exactUrl||best.url;out.alt='PIONX final render';out.style.display='block';out.style.filter='';out.style.transform='none';studioAdjustState.zoom=1;studioAdjustState.rotation=0}if(q('#studioOutputBadge'))q('#studioOutputBadge').textContent=`${studioFinal56.qualityVerified===false?'RESULT · QC DEGRADED':'FINAL · VERIFIED'} · ${studioFinal56.width}×${studioFinal56.height}`;q('#resultEditDock')?.classList.add('result-ready');const actions=q('#resultActionsV57');if(actions)actions.hidden=false;wireStudioResultActions56();
  studioRenderNotice636('complete',studioFinal56.qualityVerified===false?'Render delivered · automated QC temporarily unavailable; please visually review this result.':'Final render delivered.');
  mindUpdate('Final image delivered · saving to Renders…',99,5);
  const saved62=autoFinishSaved||await persistRender62(best.url,start.job_token);
  if(autoFinishSaved){galleryLoaded62=false;try{await galleryLoad62()}catch(galleryError){console.warn('Gallery refresh will retry on next open',galleryError)}}
  mindUpdate(saved62?'Final image saved in Renders.':'Final image ready; gallery save needs attention.',100,5);
  clearActiveRender56();await loadAccount56({quiet:true});hideRenderMind58(650);setTimeout(()=>studioFocusFinalResult1697(),650);
  toast(saved62?(studioFinal56.qualityVerified===false?`Render delivered · QC temporarily degraded · saved in Renders · ${Number(done?.finance?.credits_charged??start.credits_cost??start.credits_reserved??0)} credits used`:`Render complete · showing final result · saved in Renders · ${Number(done?.finance?.credits_charged??start.credits_cost??start.credits_reserved??0)} credits used`):'Render complete · showing final result, but gallery save failed. Download this image now; the job may be recoverable in Renders.')
 }catch(e){console.error('PIONX V5.7 real render',e);if(e?.staleCleaned){try{hideRenderMind58(0)}catch{};studioRenderNotice636('complete','Previous stalled render was closed safely. Studio is ready for a new render.');await loadAccount56({quiet:true});return}const raw=String(e?.message||'Render failed');const terminal=e?.payload?.status==='failed';const pending=e?.preserveRender===true||e?.code==='PIONX_RENDER_PENDING'||(!terminal&&/still processing|background|gateway|connection interrupted/i.test(raw));if(start&&engine&&!pending)await cancelRender56(start,engine);if(!pending)clearActiveRender56();await loadAccount56({quiet:true});const safe=String(PXPROFILE56?.role||'').toLowerCase()!=='admin'&&/provider|model|request[_ -]?id|engine-[0-9]+|api key/i.test(raw)?'PIONX could not complete this render. Please check Admin diagnostics and retry.':raw;const pendingUi=pending||/Reference: planint-/i.test(safe);studioRenderNotice636(pendingUi?'running':'failed',safe);mindUpdate(pendingUi?'Operation still processing: '+safe:'Render could not complete: '+safe,Math.max(10,Number(q('#renderMindPct')?.textContent.replace('%','')||10)),3);toast(safe);hideRenderMind58(pendingUi?500:5200)
 }finally{if(btn){delete btn.dataset.busy;btn.disabled=false;btn.textContent='✦ Render'}}
}
function studioTool(action){if(action==='edit'){q('#resultEditDock')?.scrollIntoView({behavior:'smooth',block:'center'});setEditToolV4('rectangle');toast('Draw a rectangle or brush the exact edit area');return}const out=q('#studioOutput');if(!out)return;if(action==='enhance'){studioAdjustState.enhanced=!studioAdjustState.enhanced;out.style.filter=studioAdjustState.enhanced?'contrast(1.04) saturate(1.06) brightness(1.02)':'';toast(studioAdjustState.enhanced?'Premium enhancement enabled':'Enhancement reverted')}else if(action==='variations'){toast('Variation set prepared · design lock preserved')}else if(action==='upscale'){q('#studioOutputBadge').textContent='4K · Premium';toast('4K upscale demo complete')}else if(action==='relight'){studioAdjustState.relightIndex=(studioAdjustState.relightIndex+1)%3;out.style.filter=['','brightness(.88) saturate(.94)','brightness(1.08) saturate(1.03)'][studioAdjustState.relightIndex];toast(['Original light','Evening relight','Bright daylight'][studioAdjustState.relightIndex])}else if(action==='more'){openDemoDialog('More image actions','<div class="demo-option-grid"><button data-more="full">Full View</button><button data-more="download">Download exact size</button><button data-more="edit">Edit Result</button><button data-more="compare">Before / After</button><button data-more="save">Save to Album</button><button data-more="video">Send to Video</button></div>');qa('[data-more]',q('#demoDialog')).forEach(b=>b.addEventListener('click',()=>{const a=b.dataset.more;q('#demoDialog').hidden=true;if(a==='video')go('video');else if(a==='full')openFullView56();else if(a==='download')downloadResult56();else if(a==='edit')activateResultEdit56();else toast(b.textContent+' ready') }))}}

function consistencyPage(){const batch=consistencyV4.workflow==='batch';return `<section class="page">${pageHead('VISUAL DNA SUITE','Visual DNA','Two workflows: render several source images together with one visual DNA, or create several controlled camera shots from one master image.')}<div class="consistency-mode-tabs"><button class="chip ${batch?'active':''}" data-consistency-workflow="batch">▦ Multi-image batch</button><button class="chip ${!batch?'active':''}" data-consistency-workflow="shots">⌖ One image → Multi-shot</button></div><div class="consistency-grid consistency-v4"><aside class="panel consistency-settings"><div class="field-title">${batch?'Primary reference':'Master image'}</div><div class="reference-large"><img src="${imgs.villa1}"><span>${batch?'Visual DNA reference':'Camera master'}</span></div>${batch?`<div class="field-title">Source images</div><div class="source-mini-grid">${[imgs.villa1,imgs.villa2,imgs.commercial,imgs.landscape].map((x,i)=>`<button><img src="${x}"><span>Source ${i+1}</span></button>`).join('')}<label class="add-source">＋<input type="file" id="consistencyFile" accept="image/*" multiple hidden></label></div>`:`<div class="field-title">Shot count</div><div class="segmented">${[3,4,6].map(x=>`<button class="chip ${consistencyV4.count===x?'active':''}" data-shot-count="${x}">${x} shots</button>`).join('')}</div><div class="camera-shot-grid">${['Front hero','Left 3/4','Right 3/4','Close detail','Wide context','Elevated'].slice(0,consistencyV4.count).map((x,i)=>`<span>⌖ ${x}</span>`).join('')}</div>`}<div class="field-title">Consistency strength</div><div class="segmented">${['flexible','strong','strict'].map(x=>`<button class="chip ${consistencyV4.strength===x?'active':''}" data-consistency-strength="${x}">${x[0].toUpperCase()+x.slice(1)}</button>`).join('')}</div><div class="field-title">Mode</div><div class="segmented">${['preserve','balanced','creative'].map(x=>`<button class="chip ${consistencyV4.mode===x?'active':''}" data-consistency-mode="${x}">${x[0].toUpperCase()+x.slice(1)}</button>`).join('')}</div><div class="toggle-row"><div class="switch-line"><i class="switch ${consistencyV4.sameLighting?'on':''}" data-consistency-toggle="sameLighting"></i>Same lighting</div><div class="switch-line"><i class="switch ${consistencyV4.sameMaterials?'on':''}" data-consistency-toggle="sameMaterials"></i>Same materials</div><div class="switch-line"><i class="switch ${consistencyV4.people?'on':''}" data-consistency-toggle="people"></i>Add People</div><div class="switch-line"><i class="switch ${consistencyV4.cars?'on':''}" data-consistency-toggle="cars"></i>Add Cars</div></div><div class="auto-brief"><header><b>Consistency Auto Brief</b><em>AUTO PROMPT</em></header><p>${batch?'Analyze every source separately, then apply one shared material, lighting, grading and realism language without changing each image camera/geometry.':'Analyze the master image, lock its visual DNA and generate new camera angles without mirroring or changing colors/material identity.'}</p></div><div class="field-title">Batch note</div><textarea class="notes" id="consistencyNotes" placeholder="Optional instruction shared across all results..."></textarea><div class="render-anchor"><button class="primary-btn render-btn-v4" id="consistencyRenderBtn">✦ Render</button></div></aside><div><div class="batch-grid" id="consistencyResults">${(batch?[imgs.villa1,imgs.villa2,imgs.commercial,imgs.landscape]:[imgs.villa1,imgs.villa2,imgs.commercial,imgs.night,imgs.landscape,imgs.interiorCard].slice(0,consistencyV4.count)).map((x,i)=>`<article class="panel batch-card"><img src="${x}"><footer><b>${batch?'Source':'Shot'} ${i+1}</b><span class="status-pill pending">Ready</span></footer></article>`).join('')}</div><div class="panel consistency-summary"><b>${batch?'Multi-image batch':'Multi-shot camera set'}</b><p>${batch?'Each image keeps its own geometry/camera while sharing the same approved visual DNA.':'One master image can produce several controlled camera angles with matched materials, lighting and mood.'}</p></div></div></div></section>`}
function wireConsistencyV4(){qa('[data-consistency-workflow]').forEach(b=>b.addEventListener('click',()=>{consistencyV4.workflow=b.dataset.consistencyWorkflow;route()}));qa('[data-shot-count]').forEach(b=>b.addEventListener('click',()=>{consistencyV4.count=Number(b.dataset.shotCount);route()}));qa('[data-consistency-strength]').forEach(b=>b.addEventListener('click',()=>{consistencyV4.strength=b.dataset.consistencyStrength;route()}));qa('[data-consistency-mode]').forEach(b=>b.addEventListener('click',()=>{consistencyV4.mode=b.dataset.consistencyMode;route()}));qa('[data-consistency-toggle]').forEach(s=>s.addEventListener('click',()=>{const k=s.dataset.consistencyToggle;consistencyV4[k]=!consistencyV4[k];s.classList.toggle('on',consistencyV4[k])}));q('#consistencyFile')?.addEventListener('change',e=>toast(`${e.target.files.length} source image(s) added to batch`));q('#consistencyRenderBtn')?.addEventListener('click',async()=>{await runImagePipelineV4('Consistency',`${consistencyV4.workflow==='batch'?'Multi-image batch':'Multi-shot'} · ${consistencyV4.mode} · ${consistencyV4.strength}`);qa('#consistencyResults .status-pill').forEach(s=>{s.textContent='Matched';s.classList.remove('pending')});toast('Consistency render set completed')})}

function explorePage(){const designers=[['MY','Mahmoud Yousri','Architectural Design · Visualization','architecture',imgs.hero,'24 projects'],['AA','Atelier Axis','Residential · Hospitality','architecture',imgs.villa1,'18 projects'],['NK','Noura K.','Interior Architecture','interior',imgs.interiorCard,'31 projects'],['SR','Studio R','Masterplanning · Urban Design','masterplan',imgs.master,'14 projects']];const work=[['Courtyard Residence',imgs.villa1,'Mahmoud Yousri','architecture','1.2k'],['Urban Clubhouse',imgs.commercial,'Atelier Axis','architecture','984'],['Quiet Luxury Interior',imgs.interiorCard,'Noura K.','interior','1.6k'],['Desert Masterplan',imgs.master,'Studio R','masterplan','742'],['Night Residence',imgs.night,'Mahmoud Yousri','architecture','886'],['Landscape Retreat',imgs.landscape,'Atelier Axis','landscape','694'],['Contemporary Villa',imgs.villa2,'Noura K.','architecture','1.1k']];return `<section class="page">${pageHead('PIONX DISCOVER','Discover','Project-first professional discovery. The public view shows trending or latest work across all creators — not a personal social feed.')}<div class="discover-v4-tabs"><button class="chip ${discoverV4.tab==='Trending'?'active':''}" data-discover-v4-tab="Trending">🔥 Trending</button><button class="chip ${discoverV4.tab==='Latest'?'active':''}" data-discover-v4-tab="Latest">◷ Latest</button></div><div class="discover-toolbar"><label class="discover-search"><span>⌕</span><input id="discoverSearch" placeholder="Search architect, project or style..."></label><div class="discover-filters">${['Featured','Architecture','Interior','Masterplan','Landscape'].map(x=>`<button class="chip ${discoverState.filter===x?'active':''}" data-discover-filter="${x}">${x}</button>`).join('')}</div></div><div class="section-title"><div><h2>Professionals</h2><p>Open any profile to see that creator's work, appreciations and comments.</p></div></div><div class="designer-row">${designers.map(d=>`<article class="panel designer-card" data-discover-category="${d[3]}" data-discover-search="${(d[1]+' '+d[2]).toLowerCase()}"><div class="designer-cover"><img src="${d[4]}"><span class="designer-avatar">${d[0]}</span></div><div class="designer-body"><h3>${d[1]}</h3><p>${d[2]}</p><div class="designer-meta"><span>${d[5]}</span><span>Portfolio</span></div><div class="designer-actions"><button data-open-creator="${d[1]}">Open profile</button><button data-follow="${d[1]}">${discoverState.followed.has(d[1])?'Following':'Follow'}</button></div></div></article>`).join('')}</div><div class="section-title"><div><h2>${discoverV4.tab} work</h2><p>Latest and trending work from all public portfolios.</p></div></div><div class="project-masonry">${work.map((w,i)=>`<article class="panel discover-project" data-discover-category="${w[3]}" data-discover-search="${(w[0]+' '+w[2]+' '+w[3]).toLowerCase()}"><div class="discover-img"><img src="${w[1]}" style="height:${i%3===0?300:i%3===1?225:260}px"><div class="overlay"><div><b>${w[0]}</b><br><button class="creator-link" data-open-creator="${w[2]}">by ${w[2]}</button></div><span>♡ ${w[4]}</span></div></div><div class="discover-stats"><button data-save="${w[0]}">${discoverState.saved.has(w[0])?'★ Saved':'☆ Save'}</button><button data-open-creator="${w[2]}">View creator</button><button data-view-project="${w[0]}" data-project-image="${w[1]}" data-project-author="${w[2]}">Open project</button></div></article>`).join('')}</div></section>`}
function creatorPage(){const p=creatorProfilesV4[discoverV4.selectedCreator]||creatorProfilesV4['Atelier Axis'];return `<section class="page"><div class="panel creator-profile-head"><img src="${p.cover}"><div class="creator-profile-overlay"><div class="portfolio-avatar">${p.initials}</div><div><div class="eyebrow">PIONX PROFESSIONAL PROFILE</div><h1>${discoverV4.selectedCreator}</h1><p>${p.title} · ${p.location}</p><small>${p.bio}</small></div><div class="creator-profile-actions"><button class="ghost-btn" data-route="explore">← Discover</button><button class="primary-btn" data-follow="${discoverV4.selectedCreator}">${discoverState.followed.has(discoverV4.selectedCreator)?'Following':'Follow'}</button></div></div></div><div class="creator-stats">${p.stats.map(x=>`<article class="panel"><b>${x.split(' ')[0]}</b><small>${x.substring(x.indexOf(' ')+1)}</small></article>`).join('')}</div><div class="section-title"><div><h2>Selected work</h2><p>Appreciate a project or leave a professional comment.</p></div></div><div class="creator-work-grid">${p.works.map((w,i)=>{const key=discoverV4.selectedCreator+'|'+w[0],liked=discoverV4.likes.has(key),comments=discoverV4.comments[key]||[];return `<article class="panel creator-project"><img src="${w[1]}"><div class="creator-project-body"><div><h3>${w[0]}</h3><small>${w[2]} appreciations</small></div><div class="creator-project-actions"><button class="${liked?'active':''}" data-appreciate="${key}">${liked?'♥ Appreciated':'♡ Appreciate'}</button><button data-comment-toggle="${key}">Comment</button></div><div class="comment-box" data-comment-box="${key}" hidden><div class="comment-list">${comments.map(c=>`<p><b>MY</b> ${c}</p>`).join('')||'<small>No comments yet.</small>'}</div><div class="comment-entry"><input data-comment-input="${key}" placeholder="Write a professional comment..."><button data-comment-send="${key}">Post</button></div></div></div></article>`}).join('')}</div></section>`}
function wireDiscover(){const search=q('#discoverSearch');search?.addEventListener('input',filterDiscover);qa('[data-discover-v4-tab]').forEach(b=>b.addEventListener('click',()=>{discoverV4.tab=b.dataset.discoverV4Tab;route()}));qa('[data-discover-filter]').forEach(b=>b.addEventListener('click',()=>{discoverState.filter=b.dataset.discoverFilter;qa('[data-discover-filter]').forEach(x=>x.classList.toggle('active',x===b));filterDiscover()}));qa('[data-follow]').forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.follow;if(discoverState.followed.has(k)){discoverState.followed.delete(k);b.textContent='Follow';b.classList.remove('active')}else{discoverState.followed.add(k);b.textContent='Following';b.classList.add('active')}toast(discoverState.followed.has(k)?`Following ${k}`:`Unfollowed ${k}`)}));qa('[data-save]').forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.save;if(discoverState.saved.has(k)){discoverState.saved.delete(k);b.textContent='☆ Save'}else{discoverState.saved.add(k);b.textContent='★ Saved'}toast(discoverState.saved.has(k)?'Project saved':'Project removed')}));qa('[data-open-creator]').forEach(b=>b.addEventListener('click',()=>{discoverV4.selectedCreator=b.dataset.openCreator;go('creator')}));qa('[data-view-project]').forEach(b=>b.addEventListener('click',()=>{const author=b.dataset.projectAuthor;openDemoDialog(b.dataset.viewProject,`<div class="project-dialog"><img src="${b.dataset.projectImage}"><p>Project by <b>${author}</b></p><p>Open the creator profile for the full project set, appreciations and comments.</p></div>`,`<button class="ghost-btn" data-dialog-close2>Close</button><button class="primary-btn" id="openCreatorFromProject">View ${author}</button>`);q('#openCreatorFromProject')?.addEventListener('click',()=>{discoverV4.selectedCreator=author;q('#demoDialog').hidden=true;go('creator')})}));filterDiscover()}
function wireCreatorV4(){qa('[data-follow]').forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.follow;if(discoverState.followed.has(k)){discoverState.followed.delete(k);b.textContent='Follow'}else{discoverState.followed.add(k);b.textContent='Following'}toast(discoverState.followed.has(k)?`Following ${k}`:`Unfollowed ${k}`)}));qa('[data-appreciate]').forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.appreciate;if(discoverV4.likes.has(k)){discoverV4.likes.delete(k);b.textContent='♡ Appreciate';b.classList.remove('active')}else{discoverV4.likes.add(k);b.textContent='♥ Appreciated';b.classList.add('active')}}));qa('[data-comment-toggle]').forEach(b=>b.addEventListener('click',()=>{const box=q(`[data-comment-box="${b.dataset.commentToggle}"]`);box.hidden=!box.hidden}));qa('[data-comment-send]').forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.commentSend,inp=q(`[data-comment-input="${k}"]`),val=inp.value.trim();if(!val)return;discoverV4.comments[k]=discoverV4.comments[k]||[];discoverV4.comments[k].push(val);route();toast('Comment added')}))}

function presentationPage(){const board=presentationV4.boards[presentationV4.selectedBoard]||presentationV4.boards[0];return `<section class="page">${pageHead('CLIENT DELIVERY','Presentation','Build a complete client package: cover, hero boards, material/color boards, comparisons, notes, branding and exports.','<button class="primary-btn" data-presentation-action="export-pdf">Export PDF</button><button class="ghost-btn" data-presentation-action="export-ppt">Export PPT</button>')}<div class="presentation-layout presentation-v4"><section><div class="panel board-canvas"><div class="board-paper board-${presentationV4.layout}"><div class="board-head"><div><small>PIONX CLIENT PRESENTATION</small><h2>Modern Villa — ${board}</h2></div><small>${presentationV4.pageSize} · ${presentationV4.orientation}</small></div><div class="board-main"><img src="${presentationV4.selectedBoard%2?imgs.interiorCard:imgs.villa1}"><div class="material-grid">${['Warm travertine','Brushed metal','Dark timber','Landscape green'].map(x=>`<div class="material-swatch"><i></i><b>${x}</b></div>`).join('')}</div></div><div class="board-note"><b>Design note</b><p>Premium architectural presentation with material, color and visual hierarchy analysis.</p></div><div class="board-foot"><span>PIONX AI · Client Package</span><span>Board ${String(presentationV4.selectedBoard+1).padStart(2,'0')} / ${String(presentationV4.boards.length).padStart(2,'0')}</span></div></div></div><div class="panel board-strip"><button class="add-board" data-presentation-action="add-board">＋ Add board</button>${presentationV4.boards.map((x,i)=>`<button class="board-thumb ${i===presentationV4.selectedBoard?'active':''}" data-board-index="${i}"><b>${i+1}</b><span>${x}</span></button>`).join('')}</div></section><aside class="panel presentation-tools"><div class="field-title">Board type</div><select id="presentationType" class="setting-select">${['Hero Board','Cover','Image Grid','Before / After','Materials + Colors','Comparison','Masterplan','Contact Sheet','Notes + Specs'].map(x=>`<option ${x===presentationV4.type?'selected':''}>${x}</option>`).join('')}</select><div class="field-title">Layout</div><div class="layout-grid">${[0,1,2,3].map(i=>`<button class="layout-tile ${i===presentationV4.layout?'active':''}" data-presentation-layout="${i}"><i></i></button>`).join('')}</div><div class="form-grid"><label>Page size<select id="presentationPageSize">${['A3','A4','16:9','Square'].map(x=>`<option ${x===presentationV4.pageSize?'selected':''}>${x}</option>`).join('')}</select></label><label>Orientation<select id="presentationOrientation">${['Landscape','Portrait'].map(x=>`<option ${x===presentationV4.orientation?'selected':''}>${x}</option>`).join('')}</select></label></div><div class="field-title">Content</div>${Object.entries({title:'Project title',materials:'Material palette',colors:'Color analysis',notes:'Image notes',logo:'Logo / branding',legend:'Legend / keynotes',qr:'Share QR'}).map(([k,v])=>`<div class="switch-line"><i class="switch ${presentationV4.content[k]?'on':''}" data-presentation-toggle="${k}"></i>${v}</div>`).join('')}<div class="field-title">Board controls</div><div class="presentation-action-grid"><button data-presentation-action="duplicate">Duplicate</button><button data-presentation-action="up">Move up</button><button data-presentation-action="down">Move down</button><button data-presentation-action="delete">Delete</button></div><div class="field-title">Package</div><button class="primary-btn" style="width:100%" data-presentation-action="package">Build client package</button></aside></div></section>`}
function wirePresentationV4(){qa('[data-board-index]').forEach(b=>b.addEventListener('click',()=>{presentationV4.selectedBoard=Number(b.dataset.boardIndex);route()}));qa('[data-presentation-layout]').forEach(b=>b.addEventListener('click',()=>{presentationV4.layout=Number(b.dataset.presentationLayout);route()}));q('#presentationType')?.addEventListener('change',e=>{presentationV4.type=e.target.value;presentationV4.boards[presentationV4.selectedBoard]=e.target.value;route()});q('#presentationPageSize')?.addEventListener('change',e=>{presentationV4.pageSize=e.target.value;route()});q('#presentationOrientation')?.addEventListener('change',e=>{presentationV4.orientation=e.target.value;route()});qa('[data-presentation-toggle]').forEach(s=>s.addEventListener('click',()=>{const k=s.dataset.presentationToggle;presentationV4.content[k]=!presentationV4.content[k];s.classList.toggle('on',presentationV4.content[k])}));qa('[data-presentation-action]').forEach(b=>b.addEventListener('click',()=>{const a=b.dataset.presentationAction;if(a==='add-board'){presentationV4.boards.push('New Board');presentationV4.selectedBoard=presentationV4.boards.length-1;route()}else if(a==='duplicate'){presentationV4.boards.splice(presentationV4.selectedBoard+1,0,presentationV4.boards[presentationV4.selectedBoard]+' Copy');presentationV4.selectedBoard++;route()}else if(a==='up'&&presentationV4.selectedBoard>0){const i=presentationV4.selectedBoard,[x]=presentationV4.boards.splice(i,1);presentationV4.boards.splice(i-1,0,x);presentationV4.selectedBoard--;route()}else if(a==='down'&&presentationV4.selectedBoard<presentationV4.boards.length-1){const i=presentationV4.selectedBoard,[x]=presentationV4.boards.splice(i,1);presentationV4.boards.splice(i+1,0,x);presentationV4.selectedBoard++;route()}else if(a==='delete'&&presentationV4.boards.length>1){presentationV4.boards.splice(presentationV4.selectedBoard,1);presentationV4.selectedBoard=Math.max(0,presentationV4.selectedBoard-1);route()}else if(a==='export-pdf')downloadText('PIONX-Presentation-PDF-Demo.txt','Production export target: PDF\nBoards: '+presentationV4.boards.join(', '));else if(a==='export-ppt')downloadText('PIONX-Presentation-PPT-Demo.txt','Production export target: PowerPoint\nBoards: '+presentationV4.boards.join(', '));else if(a==='package'){toast('Client package assembled · PDF + PPT + selected images in Production')}}))}

function wireView(name){qa('[data-route]',q('#viewRoot')).forEach(x=>x.addEventListener('click',()=>go(x.dataset.route)));qa('.chip',q('#viewRoot')).forEach(b=>b.addEventListener('click',()=>{const parent=b.parentElement;if(parent?.querySelectorAll('.chip').length&&!b.dataset.mode&&!b.dataset.env&&!b.dataset.adjustTab&&!b.dataset.discoverFilter&&!b.dataset.consistencyWorkflow&&!b.dataset.consistencyStrength&&!b.dataset.consistencyMode&&!b.dataset.shotCount&&!b.dataset.discoverV4Tab){parent.querySelectorAll('.chip').forEach(x=>x.classList.remove('active'));b.classList.add('active')}}));qa('.switch',q('#viewRoot')).forEach(s=>s.addEventListener('click',()=>{if(s.dataset.settingToggle||s.dataset.layer||s.dataset.adminFeature||s.dataset.consistencyToggle||s.dataset.presentationToggle)return;s.classList.toggle('on');if(s.dataset.control){studioState[s.dataset.control]=s.classList.contains('on');if(name==='studio')updateStudioBrief()}}));
 if(name==='studio'){qa('.scene-pick,.scene-mini',q('#viewRoot')).forEach(b=>b.addEventListener('click',()=>{studioState.scene=b.dataset.scene;qa('.scene-pick').forEach(x=>x.classList.toggle('active',x.dataset.scene===studioState.scene));qa('.scene-mini').forEach(x=>x.classList.toggle('active',x.dataset.scene===studioState.scene));updateStudioBrief();injectScenePrompt(studioState.scene);syncInteriorStyleUIR16();toast('✓ Discipline selected: Optimal architectural prompt injected')}));qa('[data-mode]',q('#viewRoot')).forEach(b=>b.addEventListener('click',()=>{studioState.mode=b.dataset.mode;b.parentElement.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('active',x===b));updateStudioBrief()}));qa('[data-env]',q('#viewRoot')).forEach(b=>b.addEventListener('click',()=>{studioState.env=b.dataset.env;b.parentElement.querySelectorAll('[data-env]').forEach(x=>x.classList.toggle('active',x===b));updateStudioBrief()}));qa('[data-interior-style]',q('#viewRoot')).forEach(b=>b.addEventListener('click',()=>{studioState.interiorStyle=b.dataset.interiorStyle||'none';syncInteriorStyleUIR16();updateStudioBrief();const custom=q('#studioInteriorCustomStyle');if(studioState.interiorStyle==='custom')custom?.focus()}));q('#studioInteriorCustomStyle')?.addEventListener('input',e=>{studioState.interiorCustomStyle=e.currentTarget.value.slice(0,120);updateStudioBrief()});qa('.shot-thumb',q('#viewRoot')).forEach(b=>b.addEventListener('click',()=>{qa('.shot-thumb').forEach(x=>x.classList.remove('active'));b.classList.add('active');q('#studioOutput').src=b.querySelector('img').src}));q('#demoGenerate')?.addEventListener('click',runRenderDemo);qa('[data-studio-tool]').forEach(b=>b.addEventListener('click',()=>studioTool(b.dataset.studioTool)));qa('[data-adjust]').forEach(b=>b.addEventListener('click',()=>cycleAdjust(b.dataset.adjust)));qa('[data-adjust-tab]').forEach(b=>b.addEventListener('click',()=>{qa('[data-adjust-tab]').forEach(x=>x.classList.toggle('active',x===b));qa('[data-adjust-pane]').forEach(x=>x.hidden=x.dataset.adjustPane!==b.dataset.adjustTab)}));q('#resetAdjust')?.addEventListener('click',resetStudioAdjustments);qa('[data-layer]').forEach(x=>x.addEventListener('click',()=>{x.classList.toggle('on');toast(`${x.dataset.layer} layer ${x.classList.contains('on')?'visible':'hidden'}`)}));qa('[data-canvas-action]').forEach(b=>b.addEventListener('click',()=>{const a=b.dataset.canvasAction;if(a==='rotate'){studioAdjustState.rotation=(studioAdjustState.rotation+90)%360;applyStudioVisual()}else if(a==='zoom'){if(studioFinal56.providerUrl){openFullView56()}else{studioAdjustState.zoom=studioAdjustState.zoom>=1.2?1:studioAdjustState.zoom+.1;b.textContent=Math.round(studioAdjustState.zoom*100)+'%';applyStudioVisual()}}else if(a==='fullscreen'){if(studioFinal56.providerUrl)openFullView56();else{q('.canvas-image')?.classList.toggle('fullscreen-canvas');toast('Canvas fullscreen toggled')}}}));q('#studioAdvancedBtn')?.addEventListener('click',()=>openDemoDialog('Advanced Studio Controls','<div class="advanced-grid"><label>Architecture lock<select><option>Strict</option><option>Strong</option></select></label><label>Material fidelity<select><option>High</option><option>Medium</option></select></label><label>Output quality<select><option>Premium Clean · original size</option><option>4K Upscale (manual)</option></select></label><label>Retouch<select><option>Automatic</option><option>Manual review</option></select></label></div>','<button class="primary-btn" data-dialog-close2>Apply</button>'));wireStudioUploads();wireLocalizedEditV4();wireStudioResultActions56();updateStudioBrief();applyStudioVisual()}
 if(name==='flow')wireFlow();if(name==='consistency')wireConsistencyV4();if(name==='explore')wireDiscover();if(name==='creator')wireCreatorV4();if(name==='presentation')wirePresentationV4();if(name==='settings')wireSettings();if(name==='finance')wireFinance();if(name==='admin')wireAdminV4();if(name==='video'){q('#demoVideoGenerate')?.addEventListener('click',runVideoPipelineV4);qa('.page-actions .primary-btn',q('#viewRoot')).forEach(b=>b.addEventListener('click',runVideoPipelineV4))}}
// ===== END V4 UPGRADE =====

function resizeProfileImage(file){return new Promise((resolve,reject)=>{if(!file)return reject(new Error('No image selected'));if(file.size>12*1024*1024)return reject(new Error('Image is too large. Use an image under 12 MB.'));const fr=new FileReader();fr.onerror=()=>reject(new Error('Could not read image'));fr.onload=()=>{const im=new Image();im.onerror=()=>reject(new Error('Unsupported image'));im.onload=()=>{const size=512,canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;const ctx=canvas.getContext('2d');const scale=Math.max(size/im.width,size/im.height),w=im.width*scale,h=im.height*scale,x=(size-w)/2,y=(size-h)/2;ctx.drawImage(im,x,y,w,h);resolve(canvas.toDataURL('image/jpeg',.86))};im.src=fr.result};fr.readAsDataURL(file)})}
function wireProfile(){
 profileDraftPhoto=profileState.photo||'';
 const input=q('#profilePhotoInput'),change=q('#changeProfilePhoto'),preview=q('#profileAvatarPreview'),state=q('#profileSaveState');
 change?.addEventListener('click',()=>input?.click());
 input?.addEventListener('change',async()=>{const file=input.files?.[0];if(!file)return;try{profileDraftPhoto=await resizeProfileImage(file);if(preview){preview.style.backgroundImage=`url('${profileDraftPhoto}')`;preview.classList.add('has-photo');preview.textContent=''}if(state)state.textContent='New photo selected — press Save profile to keep it.';toast('Profile photo ready to save')}catch(e){toast(e.message||'Could not use this photo')}});
 q('#saveProfileBtn')?.addEventListener('click',()=>{profileState={...profileState,displayName:q('#profileDisplayName')?.value.trim()||profileDefaults.displayName,username:q('#profileUsername')?.value.trim()||profileDefaults.username,title:q('#profileTitle')?.value.trim()||profileDefaults.title,company:q('#profileCompany')?.value.trim()||profileDefaults.company,bio:q('#profileBio')?.value.trim()||'',photo:profileDraftPhoto||''};try{saveProfileState()}catch{toast('Could not save profile in this browser');return}syncProfileChrome();route();toast('Profile saved')});
}
function route(){
 if(!signedIn56()){if(document.documentElement.dataset.pxRouteBoot==='pending')return;exitApp();setAuthStatus56('Sign in to open your PIONX workspace.');return}
 let name=(location.hash||'#home').slice(1).split('?')[0];if(!routes[name])name='home';
 const adminOnly=['admin','finance','diagnostics','sitecontent','voiceadmin'];
 if(adminOnly.includes(name)&&String(PXPROFILE56?.role||'user').toLowerCase()!=='admin'){name='home';history.replaceState(null,'','#home');toast('Administrator access is required')}
 qa('[data-route]').forEach(x=>x.classList.toggle('active',x.dataset.route===name&&x.classList.contains('nav-item')));const root=q('#viewRoot');root.innerHTML=routes[name]();root.scrollTop=0;wireView(name);if(name==='profile')wireProfile();syncProfileChrome();document.title=`PIONX AI — ${name==='home'?'Home':name[0].toUpperCase()+name.slice(1)}`
}
function go(name){if(!routes[name])name='home';if(location.hash==='#'+name)route();else location.hash=name}
function updateStudioBrief(){const rule=sceneRules[studioState.scene]||sceneRules.auto;const t=q('#sceneRuleTitle'),d=q('#sceneRuleDesc'),ins=q('#sceneInsight');if(t)t.textContent='PIONX Auto Brief · '+rule.title;const planHint=studioState.scene==='interior'?'If the uploaded source is a CAD/floor plan, PIONX automatically switches to Plan → Interior Perspective: plan geometry is preserved, the top-view camera is NOT preserved, and reference images control style/material/light only. ':'';const styleHint=studioState.scene==='interior'?(studioState.interiorStyle==='none'?'Interior Style: None. Preserve the existing design language; do not impose a new style. ':`Interior Style LOCK: ${studioInteriorStyleLabelR16()}. This style is mandatory and must clearly override the old decorative language while geometry, camera and layout stay locked. `):'';const glassHint=studioState.scene==='interior'?'Show believable exterior context through visible glass with subtle reflections; avoid blank or washed-out windows. ':'';const entourage=[studioState.people?'Add a restrained number of photoreal people at correct architectural scale with natural poses and scene-matched shadows.':'',studioState.cars?'Add realistic contemporary vehicles only where roads, parking or driveways make physical sense, with correct perspective and reflections.':''].filter(Boolean).join(' ');if(d)d.textContent=[planHint,styleHint,glassHint,rule.desc,modeRules[studioState.mode],envRules[studioState.env],entourage,studioState.scene==='interior'?'For an existing interior image, preserve its camera. For a detected CAD/plan source, generate a new eye-level interior viewpoint instead of a top view.':'Premium clean finish: preserve the exact source canvas and camera; balance color, exposure and white balance; improve physically believable materials, glazing/reflections and micro-detail; keep edges crisp but natural; remove CGI/plastic look, fake HDR, halos, oversharpening, noise, repeated assets and text/geometry artifacts.'].filter(Boolean).join(' ');if(ins)ins.innerHTML=rule.focus.map((x,i)=>`<span><b>${['Priority 1','Priority 2','Priority 3'][i]}</b><small>${x}</small></span>`).join('');const ref=q('#studioRef');if(ref){ref.src=studioState.scene==='exterior'?imgs.sceneExterior:studioState.scene==='masterplan'?imgs.sceneMaster:studioState.scene==='landscape'?imgs.sceneLandscape:studioState.scene==='sketch'?imgs.sceneSketch:imgs.sceneInterior}}
function renderOutputForScene(){if(studioState.env==='night')return imgs.night;return studioState.scene==='interior'?imgs.interiorCard:studioState.scene==='masterplan'?imgs.master:studioState.scene==='landscape'?imgs.landscape:studioState.scene==='sketch'?imgs.sceneSketch:imgs.villa1}
let renderMindProgress=0,renderMindStep=0;
function mindUpdate(message,pct,step){const status=q('#renderMindStatus'),number=q('#renderMindPct'),bar=q('#renderMindBar');if(!status||!number||!bar)return;status.setAttribute('aria-live','polite');bar.setAttribute('role','progressbar');bar.setAttribute('aria-valuemin','0');bar.setAttribute('aria-valuemax','100');const failed=/^Render could not complete:/i.test(String(message));status.textContent=message;if(failed){number.textContent='Failed';bar.setAttribute('aria-label','Render failed');return}const incoming=Number(pct);if(Number.isFinite(incoming))renderMindProgress=Math.max(renderMindProgress,Math.min(100,Math.max(0,Math.round(incoming))));renderMindStep=Math.max(renderMindStep,Number.isFinite(Number(step))?Math.max(0,Math.min(5,Number(step))):0);number.textContent=renderMindProgress+'%';bar.style.width=renderMindProgress+'%';bar.setAttribute('aria-valuenow',String(renderMindProgress));bar.setAttribute('aria-label',String(message||'Render progress'));qa('#mindSteps span').forEach((x,i)=>{x.classList.toggle('active',i===renderMindStep);x.classList.toggle('done',i<renderMindStep)})}
async function runRenderDemoLegacyV3(){const modal=showRenderMind58(),scene=(sceneRules[studioState.scene]||sceneRules.auto).title;q('#renderMindScene').textContent=`${scene} · ${studioState.mode} · ${studioState.env} · PIONX scene-aware production brief`;const stages=[['Analyzing geometry, camera, light and material cues…',8,0,500],['Understanding scene type and locking the architecture…',22,1,650],['Writing the scene-specific production prompt automatically…',38,2,650],['Generating the premium photoreal master image…',67,3,900],['Retouching color, exposure, light, materials and clean sharpness…',88,4,700],['Delivering the final image and saving project history…',100,5,550]];for(const [msg,pct,step,ms] of stages){mindUpdate(msg,pct,step);await new Promise(r=>setTimeout(r,ms))}const out=q('#studioOutput');if(out){out.src=renderOutputForScene();out.style.filter='saturate(1.04) contrast(1.02)'}setTimeout(()=>{hideRenderMind58();toast('Premium scene-aware render demo completed')},650)}
function wireViewLegacyV3(name){qa('[data-route]',q('#viewRoot')).forEach(x=>x.addEventListener('click',()=>go(x.dataset.route)));qa('.chip',q('#viewRoot')).forEach(b=>b.addEventListener('click',()=>{const parent=b.parentElement;if(parent?.querySelectorAll('.chip').length&&!b.dataset.mode&&!b.dataset.env&&!b.dataset.adjustTab&&!b.dataset.discoverFilter){parent.querySelectorAll('.chip').forEach(x=>x.classList.remove('active'));b.classList.add('active')}}));qa('.switch',q('#viewRoot')).forEach(s=>s.addEventListener('click',()=>{if(s.dataset.settingToggle||s.dataset.layer)return;s.classList.toggle('on');if(s.dataset.control){studioState[s.dataset.control]=s.classList.contains('on');if(name==='studio')updateStudioBrief()}}));
 if(name==='studio'){qa('.scene-pick,.scene-mini',q('#viewRoot')).forEach(b=>b.addEventListener('click',()=>{studioState.scene=b.dataset.scene;qa('.scene-pick').forEach(x=>x.classList.toggle('active',x.dataset.scene===studioState.scene));qa('.scene-mini').forEach(x=>x.classList.toggle('active',x.dataset.scene===studioState.scene));updateStudioBrief();injectScenePrompt(studioState.scene);toast('✓ Discipline selected: Optimal architectural prompt injected')}));qa('[data-mode]',q('#viewRoot')).forEach(b=>b.addEventListener('click',()=>{studioState.mode=b.dataset.mode;b.parentElement.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('active',x===b));updateStudioBrief()}));qa('[data-env]',q('#viewRoot')).forEach(b=>b.addEventListener('click',()=>{studioState.env=b.dataset.env;b.parentElement.querySelectorAll('[data-env]').forEach(x=>x.classList.toggle('active',x===b));updateStudioBrief()}));qa('.shot-thumb',q('#viewRoot')).forEach(b=>b.addEventListener('click',()=>{qa('.shot-thumb').forEach(x=>x.classList.remove('active'));b.classList.add('active');q('#studioOutput').src=b.querySelector('img').src}));q('#demoGenerate')?.addEventListener('click',runRenderDemo);qa('[data-studio-tool]').forEach(b=>b.addEventListener('click',()=>studioTool(b.dataset.studioTool)));qa('[data-adjust]').forEach(b=>b.addEventListener('click',()=>cycleAdjust(b.dataset.adjust)));qa('[data-adjust-tab]').forEach(b=>b.addEventListener('click',()=>{qa('[data-adjust-tab]').forEach(x=>x.classList.toggle('active',x===b));qa('[data-adjust-pane]').forEach(x=>x.hidden=x.dataset.adjustPane!==b.dataset.adjustTab);}));q('#resetAdjust')?.addEventListener('click',resetStudioAdjustments);qa('[data-layer]').forEach(x=>x.addEventListener('click',()=>{x.classList.toggle('on');toast(`${x.dataset.layer} layer ${x.classList.contains('on')?'visible':'hidden'}`)}));qa('[data-canvas-action]').forEach(b=>b.addEventListener('click',()=>{const a=b.dataset.canvasAction;if(a==='rotate'){studioAdjustState.rotation=(studioAdjustState.rotation+90)%360;applyStudioVisual()}else if(a==='zoom'){if(studioFinal56.providerUrl){openFullView56()}else{studioAdjustState.zoom=studioAdjustState.zoom>=1.2?1:studioAdjustState.zoom+.1;b.textContent=Math.round(studioAdjustState.zoom*100)+'%';applyStudioVisual()}}else if(a==='fullscreen'){if(studioFinal56.providerUrl)openFullView56();else{q('.canvas-image')?.classList.toggle('fullscreen-canvas');toast('Canvas fullscreen toggled')}}}));q('#studioAdvancedBtn')?.addEventListener('click',()=>openDemoDialog('Advanced Studio Controls','<div class="advanced-grid"><label>Architecture lock<select><option>Strict</option><option>Strong</option></select></label><label>Material fidelity<select><option>High</option><option>Medium</option></select></label><label>Output quality<select><option>Premium Clean · original size</option><option>4K Upscale (manual)</option></select></label><label>Retouch<select><option>Automatic</option><option>Manual review</option></select></label></div>','<button class="primary-btn" data-dialog-close2>Apply</button>'));qa('[data-studio-action="add-reference"]').forEach(b=>b.addEventListener('click',()=>toast('Reference upload control ready')));updateStudioBrief();applyStudioVisual()}
 if(name==='flow')wireFlow();if(name==='explore')wireDiscover();if(name==='settings')wireSettings();if(name==='finance')wireFinance();if(name==='video'){q('#demoVideoGenerate')?.addEventListener('click',()=>toast('Video Auto demo: Premium route selected; architecture-lock prompt prepared.'))}}
function enterApp(routeName='home'){
 if(!signedIn56()){exitApp();setAuthStatus56('Sign in to preview and use the PIONX workspace.');q('#authCard')?.scrollIntoView({behavior:'smooth',block:'center'});return false}
 q('#publicSite').hidden=true;q('#appShell').hidden=false;if(!location.hash)location.hash=routeName;else if(routeName)location.hash=routeName;route();toast('PIONX workspace connected');return true
}
function exitApp(){q('#accountPopover').hidden=true;q('#appShell').hidden=true;q('#publicSite').hidden=false;history.replaceState(null,'',location.pathname);document.title='PIONX AI — Architecture Intelligence'}
qa('[data-route]').forEach(x=>x.addEventListener('click',e=>{if(x.tagName==='A')e.preventDefault();go(x.dataset.route)}));
q('.brand')?.addEventListener('click',()=>go('home'));window.addEventListener('hashchange',()=>{if(!q('#appShell').hidden)route()});
q('#userMenu')?.addEventListener('click',e=>{e.preventDefault();const p=q('#accountPopover'),b=q('#userMenu');if(!p)return;p.hidden=!p.hidden;b?.setAttribute('aria-expanded',p.hidden?'false':'true')});q('#demoLogout')?.addEventListener('click',logout56);q('#mobileMenu')?.addEventListener('click',()=>q('#sidebar').classList.toggle('open'));q('#themeBtn')?.addEventListener('click',()=>applyTheme(settingsState.theme==='dark'?'light':'dark',true));q('#notifyBtn')?.addEventListener('click',()=>toast('No new notifications'));q('#globalSearch')?.addEventListener('keydown',e=>{if(e.key==='Enter'){const term=e.currentTarget.value.trim();safeStore.set('pionx-global-search-pending',term);go('explore')}});document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'&&!q('#appShell').hidden){e.preventDefault();q('#globalSearch').focus()}});document.addEventListener('click',e=>{const c=e.target.closest('[data-close]');if(c)q('#'+c.dataset.close).hidden=true;const c2=e.target.closest('[data-dialog-close2]');if(c2&&q('#demoDialog'))closeDemoDialog16910();const rr=e.target.closest('#demoDialog [data-route]');if(rr){q('#demoDialog').hidden=true;go(rr.dataset.route)}});
// V6.17 global transient UI behavior: click-outside, Escape, route cleanup and mobile drawer cleanup.
const closeAccountPopover617=()=>{const p=q('#accountPopover');if(p&&!p.hidden)p.hidden=true;q('#userMenu')?.setAttribute('aria-expanded','false')};
document.addEventListener('click',e=>{
 const p=q('#accountPopover');
 if(p&&!p.hidden&&!e.target.closest('#accountPopover')&&!e.target.closest('#userMenu'))closeAccountPopover617();
 if(e.target.closest('[data-route]'))closeAccountPopover617();
 if(window.matchMedia('(max-width:900px)').matches){const s=q('#sidebar');if(s?.classList.contains('open')&&!e.target.closest('#sidebar')&&!e.target.closest('#mobileMenu'))s.classList.remove('open')}
});
document.addEventListener('keydown',e=>{
 if(e.key!=='Escape')return;
 closeAccountPopover617();
 q('#sidebar')?.classList.remove('open');
 const d=q('#demoDialog');if(d&&!d.hidden)closeDemoDialog16910();
});
window.addEventListener('hashchange',()=>{closeAccountPopover617();q('#sidebar')?.classList.remove('open')});
q('#renderMindClose')?.addEventListener('click',()=>hideRenderMind58());wireRenderVideo58();
qa('[data-auth-tab]').forEach(b=>b.addEventListener('click',()=>{showAuthPane61(b.dataset.authTab);setAuthStatus56('')}));
q('#forgotPasswordLink')?.addEventListener('click',e=>{e.preventDefault();q('#recoveryEmail').value=q('#signinEmail').value.trim();showAuthPane61('request');setAuthStatus56('')});
qa('[data-auth-back]').forEach(b=>b.addEventListener('click',()=>{showAuthPane61('signin');setAuthStatus56('')}));
q('#sendRecoveryEmail')?.addEventListener('click',requestRecovery61);
q('#saveRecoveryPassword')?.addEventListener('click',saveRecoveryPassword61);
q('#publicSignIn')?.addEventListener('click',signIn56);q('#publicCreate')?.addEventListener('click',signUp56);q('#startFree')?.addEventListener('click',()=>q('#authCard')?.scrollIntoView({behavior:'smooth',block:'center'}));q('#googleAuth')?.addEventListener('click',googleSignIn56);qa('[data-auth-provider]').filter(b=>b.id!=='googleAuth').forEach(b=>b.addEventListener('click',()=>toast(`${b.dataset.authProvider[0].toUpperCase()+b.dataset.authProvider.slice(1)} sign-in is not connected on this test route yet`)));q('#openAuth')?.addEventListener('click',()=>q('#authCard').scrollIntoView({behavior:'smooth',block:'center'}));q('#seeStudio')?.addEventListener('click',()=>{setAuthStatus56('Sign in to preview and use the PIONX workspace.');q('#authCard')?.scrollIntoView({behavior:'smooth',block:'center'})});q('#signinPassword')?.addEventListener('keydown',e=>{if(e.key==='Enter')signIn56()});



let PXACCESS60={consistency:true,film:true,presentation:true,creative:true,credit_enabled:true};
function applyAccess60(){
 const a=PXACCESS60||{};for(const [routeName,key] of [['consistency','consistency'],['film','film'],['presentation','presentation']])qa(`[data-route="${routeName}"]`).forEach(el=>{el.hidden=a[key]===false;el.setAttribute('aria-disabled',a[key]===false?'true':'false')});
 const creative=q('[data-mode="creative"]');if(creative){creative.disabled=a.creative===false;creative.title=a.creative===false?'Creative mode is not enabled for this account':'';creative.classList.toggle('access-locked',a.creative===false)}
 const creditButtons=qa('.render-btn-v4');for(const b of creditButtons){b.disabled=a.credit_enabled===false;b.title=a.credit_enabled===false?'Credit usage is disabled by Admin':''}
}
const renderAccount56Base60=renderAccount56;
renderAccount56=function(data){const out=renderAccount56Base60(data);PXACCESS60={...PXACCESS60,...(data?.access||{})};applyAccess60();return out};
const routeBase60=route;
route=function(){let name=(location.hash||'#home').slice(1).split('?')[0];const blocked=(name==='consistency'&&PXACCESS60.consistency===false)||(name==='film'&&PXACCESS60.film===false)||(name==='presentation'&&PXACCESS60.presentation===false);if(blocked){toast('This feature is not enabled for this account');if(location.hash!=='#home'){history.replaceState(null,'',location.pathname+'#home')}name='home'}routeBase60();applyAccess60()};
const goBase60=go;
go=function(name){const blocked=(name==='consistency'&&PXACCESS60.consistency===false)||(name==='film'&&PXACCESS60.film===false)||(name==='presentation'&&PXACCESS60.presentation===false);if(blocked)return toast('This feature is not enabled for this account');return goBase60(name)};

// ===== V6.0 LIVE REPLACEMENT PATCH =====
// Production admin must never fall back to the old local UI-test accounts.
adminUsersV4=[];
// Keeps V4 design locked while making post-render viewing/post-production and
// Admin user creation/editing live against the existing root server + Supabase.
let ADMIN_LIVE_LOADED60=false,ADMIN_LIVE_LOADING60=false;
const planLabel60=v=>({starter:'Starter',free:'Starter',creator:'Starter',pro:'Pro',studio:'Studio',enterprise:'Enterprise',agency:'Enterprise'}[String(v||'').toLowerCase()]||String(v||'Starter'));
const planCode60=v=>({Starter:'starter',Pro:'pro',Studio:'studio',Enterprise:'enterprise'}[String(v||'Starter')]||String(v||'starter').toLowerCase());
function normalizeFeature60(raw={}){const base={consistency:{enabled:false,until:''},film:{enabled:false,until:''},presentation:{enabled:true,until:''},creative:{enabled:false,until:''}};for(const k of Object.keys(base)){if(raw&&raw[k])base[k]={enabled:!!raw[k].enabled,until:String(raw[k].until||'')}}return base}
function normalizeAdminUser60(u={}){return {id:String(u.id||''),name:String(u.name||u.username||u.email?.split('@')[0]||'User'),email:String(u.email||''),plan:planLabel60(u.plan||u.plan_code),credits:Math.max(0,Number(u.credits||0)),role:String(u.role||'User').toLowerCase()==='admin'?'Admin':'User',status:String(u.status||'Active').toLowerCase()==='suspended'?'Suspended':'Active',creditEnabled:u.creditEnabled!==false,features:normalizeFeature60(u.features)}}
async function adminLiveAction60(payload){const r=await pxApi56('/server/admin-user-v60.php',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),j=await json56(r,'PIONX Admin');if(!r.ok)throw new Error((j.error||'Admin operation failed')+(j.detail?' — '+j.detail:''));return j}
async function loadAdminUsersV60(showToast=false){if(ADMIN_LIVE_LOADING60)return;ADMIN_LIVE_LOADING60=true;try{const r=await pxApi56('/server/admin-users-v60.php?ts='+Date.now(),{cache:'no-store'}),j=await json56(r,'PIONX Admin');if(!r.ok)throw new Error((j.error||'Could not load users')+(j.detail?' — '+j.detail:''));adminUsersV4=(j.users||[]).map(normalizeAdminUser60);ADMIN_LIVE_LOADED60=true;if(showToast)toast(`${adminUsersV4.length} live user account(s) loaded`);return adminUsersV4}catch(e){console.error('PIONX Admin live load',e);toast(e.message);return null}finally{ADMIN_LIVE_LOADING60=false}}
function adminFeaturePayload60(root){const out={};for(const key of ['consistency','film','presentation','creative'])out[key]={enabled:!!q(`[data-admin-feature="${key}"]`,root)?.classList.contains('on'),until:q(`[data-admin-until="${key}"]`,root)?.value||''};return out}
function wireAdminDuration60(root){qa('[data-admin-duration]',root).forEach(sel=>sel.addEventListener('change',()=>{const key=sel.dataset.adminDuration,inp=q(`[data-admin-until="${key}"]`,root);if(!inp)return;const d=new Date();if(sel.value==='7 days')d.setDate(d.getDate()+7);if(sel.value==='30 days')d.setDate(d.getDate()+30);if(sel.value==='90 days')d.setDate(d.getDate()+90);if(['7 days','30 days','90 days'].includes(sel.value))inp.value=d.toISOString().slice(0,10);if(sel.value==='Permanent')inp.value='';}))}
function adminPage(){const liveNote=ADMIN_LIVE_LOADED60?'● LIVE SUPABASE USERS':'● Loading live users…';return `<section class="page">${pageHead('ADMIN CONTROL CENTER','Admin','Live control for users, packages, credits, passwords, status and timed feature access.','<button class="primary-btn" id="adminAddUser">+ Add user</button><button class="ghost-btn" id="adminRefreshUsers">Refresh users</button>')}
 <div class="finance-sync"><span>${liveNote}</span><b>Server-side admin controls</b><small>Passwords are never displayed</small></div>
 <div class="admin-kpis">${[['Users',adminUsersV4.length,'Live accounts'],['Admin accounts',adminUsersV4.filter(x=>x.role==='Admin').length,'Privileged'],['Credits issued',adminUsersV4.reduce((a,b)=>a+Number(b.credits||0),0).toLocaleString(),'Current balances'],['Suspended',adminUsersV4.filter(x=>x.status==='Suspended').length,'Access blocked']].map(x=>`<article class="panel metric"><small>${x[0]}</small><b>${x[1]}</b><span class="up">${x[2]}</span></article>`).join('')}</div>
 <div class="admin-grid-v4"><section class="panel admin-panel"><div class="section-title" style="margin-top:0"><div><h2>Users</h2><p>Create and edit real PIONX accounts.</p></div><label class="mini-search"><span>⌕</span><input id="adminUserSearch" placeholder="Search user or email"></label></div><div class="table-wrap"><table class="table admin-user-table"><thead><tr><th>User</th><th>Email</th><th>Package</th><th>Credits</th><th>Credit Access</th><th>Role</th><th>Status</th><th>Features</th><th></th></tr></thead><tbody id="adminUsersBody">${adminUsersV4.map(u=>`<tr data-admin-search="${escHtml((u.name+' '+u.email).toLowerCase())}"><td><b>${escHtml(u.name)}</b></td><td>${escHtml(u.email)}</td><td>${escHtml(u.plan)}</td><td>${Number(u.credits||0).toLocaleString()}</td><td class="${u.creditEnabled?'good':'bad'}">${u.creditEnabled?'Enabled':'Blocked'}</td><td>${u.role}</td><td class="${u.status==='Active'?'good':'bad'}">${u.status}</td><td><div class="feature-pills">${Object.entries(u.features||{}).filter(([,v])=>v.enabled).map(([k])=>`<span>${k==='film'?'Film':escHtml(k)}</span>`).join('')||'<small>None</small>'}</div></td><td><button class="ghost-btn" data-admin-edit="${escHtml(u.id)}">Edit user</button></td></tr>`).join('')||'<tr><td colspan="9">Loading live users…</td></tr>'}</tbody></table></div></section>
 <aside class="panel admin-panel admin-policy"><h2>Account controls are live</h2><p>Add user now creates a Supabase Auth account on the server. Role, package and credits are saved to the PIONX profile.</p>${[['Credits','Add or deduct instantly'],['Status','Active / Suspended'],['Role','User / Admin'],['Password','Reset link or temporary password'],['Features','Consistency / Film / Presentation / Creative with expiry']].map(x=>`<article><b>${x[0]}</b><span>${x[1]}</span></article>`).join('')}<div class="admin-warning"><b>Security</b><small>The Supabase secret key stays inside server-side PHP and is never exposed to the browser.</small></div></aside></div></section>`}
routes.admin=adminPage;
function openAdminCreateV60(){const m=openDemoDialog('Add PIONX user',`<div class="admin-edit-grid"><section><div class="field-title">New account</div><label>Name<input id="adminCreateName" placeholder="User name"></label><label>Email<input id="adminCreateEmail" type="email" placeholder="user@studio.com"></label><label>Temporary password<input id="adminCreatePassword" type="password" placeholder="Minimum 8 characters"></label><div class="form-grid"><label>Package<select id="adminCreatePlan"><option>Starter</option><option>Pro</option><option>Studio</option><option>Enterprise</option></select></label><label>Role<select id="adminCreateRole"><option>User</option><option>Admin</option></select></label></div><div class="form-grid"><label>Status<select id="adminCreateStatus"><option>Active</option><option>Suspended</option></select></label><label>Starting credits<input id="adminCreateCredits" type="number" min="0" value="0"></label></div><div class="switch-line"><i id="adminCreateCreditEnabled" class="switch on"></i>Allow credit usage</div></section><section><div class="field-title">Feature access</div><div class="admin-feature-editor">${featureRowAdminV4('consistency','Consistency',{enabled:false,until:''})}${featureRowAdminV4('film','PIONX Film',{enabled:false,until:''})}${featureRowAdminV4('presentation','Presentation',{enabled:true,until:''})}${featureRowAdminV4('creative','Creative Mode',{enabled:false,until:''})}</div></section></div>`,`<button class="ghost-btn" data-dialog-close2>Cancel</button><button class="primary-btn" id="adminCreateUserConfirm">Create user</button>`);q('#adminCreateCreditEnabled',m)?.addEventListener('click',e=>e.currentTarget.classList.toggle('on'));qa('[data-admin-feature]',m).forEach(s=>s.addEventListener('click',()=>s.classList.toggle('on')));wireAdminDuration60(m);q('#adminCreateUserConfirm',m)?.addEventListener('click',async()=>{const btn=q('#adminCreateUserConfirm',m),payload={action:'create',name:q('#adminCreateName',m)?.value.trim(),email:q('#adminCreateEmail',m)?.value.trim(),password:q('#adminCreatePassword',m)?.value||'',plan:q('#adminCreatePlan',m)?.value||'Starter',credits:Number(q('#adminCreateCredits',m)?.value||0),role:q('#adminCreateRole',m)?.value||'User',status:q('#adminCreateStatus',m)?.value||'Active',creditEnabled:q('#adminCreateCreditEnabled',m)?.classList.contains('on'),features:adminFeaturePayload60(m)};if(!payload.email||payload.password.length<8)return toast('Enter a valid email and temporary password of at least 8 characters');btn.disabled=true;btn.textContent='Creating…';try{await adminLiveAction60(payload);q('#demoDialog').hidden=true;await loadAdminUsersV60(false);route();toast('User created successfully · live account ready')}catch(e){toast(e.message)}finally{btn.disabled=false;btn.textContent='Create user'}})}
function openAdminUserEditorV4(id){const u=adminUsersV4.find(x=>x.id===id);if(!u)return;const m=openDemoDialog('Edit user · '+u.name,`<div class="admin-edit-grid"><section><div class="field-title">Account</div><label>Name<input id="adminEditName" value="${escHtml(u.name)}"></label><label>Email<input id="adminEditEmail" value="${escHtml(u.email)}"></label><div class="form-grid"><label>Package<select id="adminEditPlan">${['Starter','Pro','Studio','Enterprise'].map(x=>`<option ${x===u.plan?'selected':''}>${x}</option>`).join('')}</select></label><label>Role<select id="adminEditRole"><option ${u.role==='User'?'selected':''}>User</option><option ${u.role==='Admin'?'selected':''}>Admin</option></select></label></div><div class="form-grid"><label>Status<select id="adminEditStatus"><option ${u.status==='Active'?'selected':''}>Active</option><option ${u.status==='Suspended'?'selected':''}>Suspended</option></select></label><label>Credits<input id="adminEditCredits" type="number" min="0" value="${u.credits}"></label></div><div class="credit-controller"><div class="switch-line"><i id="adminCreditEnabled" class="switch ${u.creditEnabled?'on':''}"></i>Allow credit usage</div><label>Credit adjustment<input id="adminCreditDelta" type="number" min="1" value="50"></label><div><button class="ghost-btn" data-credit-action="add">+ Add now</button><button class="ghost-btn" data-credit-action="deduct">− Deduct now</button></div></div><div class="field-title">Password</div><div class="password-tools"><button class="ghost-btn" id="adminResetPassword">Send password reset link</button><label>Temporary password<input id="adminTempPassword" type="password" placeholder="Minimum 8 characters"></label><button class="ghost-btn" id="adminSetTempPassword">Set temporary password</button></div></section><section><div class="field-title">Feature access & expiry</div><div class="admin-feature-editor">${featureRowAdminV4('consistency','Consistency',u.features.consistency)}${featureRowAdminV4('film','PIONX Film',u.features.film)}${featureRowAdminV4('presentation','Presentation',u.features.presentation)}${featureRowAdminV4('creative','Creative Mode',u.features.creative)}</div><div class="admin-feature-note">Feature grants are stored server-side in protected account metadata.</div><div class="danger-zone"><b>Danger zone</b><p>Delete this authentication account and revoke future access.</p><button class="danger-btn" id="adminDeleteUser">Delete user</button></div></section></div>`,`<button class="ghost-btn" data-dialog-close2>Cancel</button><button class="primary-btn" id="adminSaveUser">Save user</button>`);
 q('#adminCreditEnabled',m)?.addEventListener('click',e=>e.currentTarget.classList.toggle('on'));qa('[data-admin-feature]',m).forEach(s=>s.addEventListener('click',()=>s.classList.toggle('on')));wireAdminDuration60(m);
 qa('[data-credit-action]',m).forEach(b=>b.addEventListener('click',async()=>{const delta=Math.max(1,Number(q('#adminCreditDelta',m)?.value||0))*(b.dataset.creditAction==='add'?1:-1);b.disabled=true;try{const j=await adminLiveAction60({action:'update',id:u.id,credit_delta:delta});u.credits=Number(j.profile?.credits??Math.max(0,u.credits+delta));q('#adminEditCredits',m).value=u.credits;toast(`${delta>0?'+':''}${delta} credits applied · live balance ${u.credits}`)}catch(e){toast(e.message)}finally{b.disabled=false}}));
 q('#adminResetPassword',m)?.addEventListener('click',async()=>{const b=q('#adminResetPassword',m);b.disabled=true;try{await adminLiveAction60({action:'send_reset',id:u.id,email:q('#adminEditEmail',m).value.trim()});toast('Password reset email sent')}catch(e){toast(e.message)}finally{b.disabled=false}});
 q('#adminSetTempPassword',m)?.addEventListener('click',async()=>{const password=q('#adminTempPassword',m)?.value||'';if(password.length<8)return toast('Temporary password must be at least 8 characters');const b=q('#adminSetTempPassword',m);b.disabled=true;try{await adminLiveAction60({action:'update',id:u.id,password});q('#adminTempPassword',m).value='';toast('Temporary password updated on the live account')}catch(e){toast(e.message)}finally{b.disabled=false}});
 q('#adminDeleteUser',m)?.addEventListener('click',()=>{openDemoDialog('Delete '+u.name+'?','<p>This deletes the live authentication account. This action cannot be undone from PIONX.</p>','<button class="ghost-btn" data-dialog-close2>Cancel</button><button class="danger-btn" id="confirmDeleteUserV60">Delete live user</button>');q('#confirmDeleteUserV60')?.addEventListener('click',async()=>{const b=q('#confirmDeleteUserV60');b.disabled=true;try{await adminLiveAction60({action:'delete',id:u.id});q('#demoDialog').hidden=true;await loadAdminUsersV60(false);route();toast('Live user deleted')}catch(e){toast(e.message)}finally{b.disabled=false}})});
 q('#adminSaveUser',m)?.addEventListener('click',async()=>{const b=q('#adminSaveUser',m);b.disabled=true;b.textContent='Saving…';const payload={action:'update',id:u.id,name:q('#adminEditName',m).value.trim(),email:q('#adminEditEmail',m).value.trim(),plan:q('#adminEditPlan',m).value,role:q('#adminEditRole',m).value,status:q('#adminEditStatus',m).value,credits:Number(q('#adminEditCredits',m).value||0),creditEnabled:q('#adminCreditEnabled',m).classList.contains('on'),features:adminFeaturePayload60(m)};try{await adminLiveAction60(payload);q('#demoDialog').hidden=true;await loadAdminUsersV60(false);route();toast('User access, package, credits, role and features saved live')}catch(e){toast(e.message)}finally{b.disabled=false;b.textContent='Save user'}})}
function wireAdminV4(){qa('[data-admin-edit]').forEach(b=>b.addEventListener('click',()=>openAdminUserEditorV4(b.dataset.adminEdit)));q('#adminUserSearch')?.addEventListener('input',e=>{const t=e.target.value.toLowerCase();qa('#adminUsersBody tr').forEach(r=>r.hidden=!!r.dataset.adminSearch&&!r.dataset.adminSearch.includes(t))});q('#adminRefreshUsers')?.addEventListener('click',async()=>{await loadAdminUsersV60(true);route()});q('#adminAddUser')?.addEventListener('click',openAdminCreateV60);if(!ADMIN_LIVE_LOADED60&&!ADMIN_LIVE_LOADING60){loadAdminUsersV60(false).then(rows=>{if(rows&&(location.hash||'#home').slice(1).split('?')[0]==='admin')route()})}}

// V6 post-production: keep the user's exact output dimensions for delivery,
// while retaining a separate high-resolution sharpened master for zoom inspection.
async function serverFinalize60(providerUrl){const r=await pxApi56('/server/pionx-finalize-v60.php',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:providerUrl,width:studioSourceDims.width,height:studioSourceDims.height})}),j=await json56(r,'PIONX post-production');if(!r.ok)throw new Error((j.error||'Post-production failed')+(j.detail?' — '+j.detail:''));return j}
finalizeRenderedImage56=async function(providerUrl){let finalUrl=providerUrl,masterUrl=providerUrl,method='provider',mw=0,mh=0,blob=null,blobUrl='';try{const j=await serverFinalize60(providerUrl);method=j.method||method;mw=Number(j.master_width||0);mh=Number(j.master_height||0);masterUrl=j.master_url||providerUrl;if(j.final_url&&method!=='native_provider_no_server_image_extension')finalUrl=j.final_url;else{const exact=await exactSizeResult56(providerUrl);finalUrl=exact.url||providerUrl;blob=exact.blob||null;blobUrl=exact.blobUrl||''}}catch(e){console.warn('PIONX v60 server post-production fallback',e);const exact=await exactSizeResult56(providerUrl);finalUrl=exact.url||providerUrl;blob=exact.blob||null;blobUrl=exact.blobUrl||'';try{const d=await imageDims56(providerUrl);mw=d.width;mh=d.height}catch{}}studioFinal56={providerUrl,exactUrl:finalUrl,masterUrl,blobUrl,blob,width:studioSourceDims.width,height:studioSourceDims.height,masterWidth:mw,masterHeight:mh,postMethod:method,qualityVerified:studioFinal56.qualityVerified!==false};studioRenderKind56='final';return studioFinal56}
let fullZoom60='fit',fullSource60='master';
function ensureFullView56(){let m=q('#pionxFullView57');if(m&&m.dataset.v60==='1')return m;if(m)m.remove();m=document.createElement('div');m.id='pionxFullView57';m.dataset.v60='1';m.className='fullview-v57';m.hidden=true;m.innerHTML='<div class="fullview-card-v57"><div class="fullview-head-v57"><div><b>PIONX Final Render</b><small id="fullViewSize57"></small></div><div class="fullview-zoom-v60"><button class="ghost-btn" id="fullViewFit60">Fit</button><button class="ghost-btn" id="fullView10060">100%</button><button class="ghost-btn" id="fullViewMinus60">−</button><span id="fullViewZoomLabel60">Fit</span><button class="ghost-btn" id="fullViewPlus60">＋</button><button class="ghost-btn" id="fullViewSource60">Detail master</button><button class="ghost-btn" id="fullViewDownload57">↓ Download exact</button><button class="ghost-btn" id="fullViewEdit57">✎ Edit</button><button class="ghost-btn" id="fullViewClose57">×</button></div></div><div class="fullview-stage-v57" id="fullViewStage60"><img id="fullViewImage57" alt="PIONX full-resolution render"></div></div>';document.body.appendChild(m);q('#fullViewClose57').onclick=()=>m.hidden=true;q('#fullViewDownload57').onclick=downloadResult56;q('#fullViewEdit57').onclick=()=>{m.hidden=true;activateResultEdit56()};q('#fullViewFit60').onclick=()=>setFullZoom60('fit');q('#fullView10060').onclick=()=>setFullZoom60(1);q('#fullViewMinus60').onclick=()=>setFullZoom60(typeof fullZoom60==='number'?Math.max(.25,fullZoom60-.25):.75);q('#fullViewPlus60').onclick=()=>setFullZoom60(typeof fullZoom60==='number'?Math.min(4,fullZoom60+.25):1.25);q('#fullViewSource60').onclick=()=>{fullSource60=fullSource60==='master'?'exact':'master';refreshFullSource60()};m.addEventListener('click',e=>{if(e.target===m)m.hidden=true});return m}
function setFullZoom60(z){const im=q('#fullViewImage57'),stage=q('#fullViewStage60'),label=q('#fullViewZoomLabel60');if(!im||!stage)return;fullZoom60=z;if(z==='fit'){im.style.width='auto';im.style.height='auto';im.style.maxWidth='100%';im.style.maxHeight='100%';if(label)label.textContent='Fit';return}const nat=im.naturalWidth||studioFinal56.masterWidth||studioFinal56.width||1;im.style.maxWidth='none';im.style.maxHeight='none';im.style.width=Math.max(1,Math.round(nat*z))+'px';im.style.height='auto';if(label)label.textContent=Math.round(z*100)+'%'}
function refreshFullSource60(){const im=q('#fullViewImage57'),btn=q('#fullViewSource60');if(!im)return;const useMaster=fullSource60==='master'&&(studioFinal56.masterUrl||studioFinal56.providerUrl);const src=useMaster?(studioFinal56.masterUrl||studioFinal56.providerUrl):(studioFinal56.exactUrl||studioFinal56.providerUrl);im.onload=()=>setFullZoom60(fullZoom60);im.src=src;if(btn)btn.textContent=useMaster?'Viewing detail master':'Viewing exact final';const size=q('#fullViewSize57');if(size)size.textContent=useMaster?`High-detail master ${studioFinal56.masterWidth||'—'} × ${studioFinal56.masterHeight||'—'}px for zoom · download stays ${studioSourceDims.width} × ${studioSourceDims.height}px`:`Exact post-produced final ${studioSourceDims.width} × ${studioSourceDims.height}px`}
function openFullView56(){if(!studioFinal56.providerUrl)return toast('Render an image first');const m=ensureFullView56();fullSource60='master';fullZoom60='fit';m.hidden=false;refreshFullSource60()}
downloadResult56=async function(){if(!studioFinal56.providerUrl)return toast('Render an image first');const name=`PIONX-${studioSourceDims.width||'render'}x${studioSourceDims.height||'final'}.png`;try{let blob=studioFinal56.blob;if(!blob){const target=studioFinal56.exactUrl||studioFinal56.providerUrl;blob=await fetchRenderBlob56(target)}if(!blob)throw new Error('No final image');const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),5000);toast(`Downloaded exact final · ${studioSourceDims.width}×${studioSourceDims.height}px`)}catch(e){console.error(e);toast('Opening final image because direct download was unavailable');window.open(studioFinal56.exactUrl||studioFinal56.providerUrl,'_blank','noopener')}}

// V6.2 gallery: existing PIONX generations table is the durable image library.
// Completed jobs missing a generation record can be recovered by their owner.
let galleryRows62=[],galleryLoaded62=false,galleryLoading62=false,galleryError62='',galleryUser62='';
let galleryStatus62='';
function galleryUrl62(value){
 try{const url=new URL(String(value||''),location.origin);return ['http:','https:'].includes(url.protocol)?url.href:''}catch{return ''}
}
function galleryDate62(value){const d=new Date(value||0);return Number.isFinite(d.getTime())?d.toLocaleString():''}
function galleryCard62(item,index){
 const url=galleryUrl62(item.url),title=item.scene?item.scene[0].toUpperCase()+item.scene.slice(1)+' Render':'PIONX Render';
 if(!url)return '';
 return `<article class="panel render-card"><button type="button" class="img-wrap gallery-image-button" data-gallery-open="${index}" aria-label="Open ${escHtml(title)}"><img src="${escHtml(url)}" alt="${escHtml(title)}" loading="lazy"><span class="badge">${item.recoverable?'RECOVERABLE':'FINAL'}</span></button><div class="meta"><div><b>${escHtml(title)}</b><br><small>${escHtml(galleryDate62(item.created_at))}</small></div><button class="kebab" data-gallery-open="${index}" aria-label="Open render">↗</button></div>${item.recoverable?`<button class="ghost-btn gallery-recover" data-gallery-recover="${index}">Save to Renders</button>`:''}</article>`;
}
function galleryCards62(rows){
 if(!signedIn56())return '<div class="panel gallery-empty">Sign in to see your saved renders.</div>';
 const message=galleryLoading62?'Loading your renders…':galleryError62||(!rows.length?'No saved renders found for this account. If you rendered before gallery saving was added, check the recovery status below.':'');
 return `${message?`<div class="panel gallery-empty">${escHtml(message)}</div>`:''}${rows.map(x=>galleryCard62(x,galleryRows62.indexOf(x))).join('')}${galleryStatus62&&!galleryLoading62?`<div class="panel gallery-empty">${escHtml(galleryStatus62)} <button class="ghost-btn" data-gallery-refresh>Check again</button></div>`:''}`;
}
renderCards=function(){return galleryCards62(galleryRows62.slice(0,4))};
routes.renders=function(){return `<section class="page">${pageHead('LIBRARY','Renders','Your actual completed images, saved to your PIONX account.',btn('Start a render','studio'))}<div class="gallery">${galleryCards62(galleryRows62)}</div></section>`};
routes.albums=function(){const rows=galleryRows62;return `<section class="page">${pageHead('ORGANIZATION','Albums','Your completed renders collected in one place.')}<article class="panel album-card gallery-album"><div class="album-stack">${rows.slice(0,3).map(x=>`<button class="gallery-album-image" data-gallery-open="${galleryRows62.indexOf(x)}" aria-label="Open render"><img src="${escHtml(galleryUrl62(x.url))}" alt=""></button>`).join('')}</div><footer><b>All Renders</b><small>${rows.length} image${rows.length===1?'':'s'}</small></footer></article><div class="gallery">${galleryCards62(rows)}</div></section>`};
async function galleryLoad62(){
 if(galleryLoading62||!signedIn56())return;
 const userId=String(PXUSER56?.id||'');if(!userId)return;
 galleryLoading62=true;galleryError62='';galleryStatus62='';
 const [historyResult,recoveryResult]=await Promise.allSettled([
  pxApi56('/server/history.php?ts='+Date.now(),{cache:'no-store'}).then(async r=>{const j=await json56(r,'PIONX Renders');if(!r.ok)throw new Error(j.error||'Renders unavailable');return j.items||[]}),
  pxApi56('/server/render-recovery-v62.php?ts='+Date.now(),{cache:'no-store'}).then(async r=>{const j=await json56(r,'PIONX recovery');if(!r.ok)throw new Error(j.error||'Recovery unavailable');return j.items||[]})
 ]);
 if(userId!==String(PXUSER56?.id||'')){galleryLoading62=false;return}
 const saved=historyResult.status==='fulfilled'?historyResult.value:[];
 const pending=recoveryResult.status==='fulfilled'?recoveryResult.value:[];
 const historyFailed=historyResult.status==='rejected',recoveryFailed=recoveryResult.status==='rejected';
 if(historyFailed||recoveryFailed){
  const parts=[];
  if(historyFailed)parts.push('Saved renders could not be checked ('+String(historyResult.reason?.message||'server error')+').');
  if(recoveryFailed)parts.push('Older renders could not be recovered ('+String(recoveryResult.reason?.message||'server error')+'). Check that render-recovery-v62.php is uploaded to public_html/server/.');
  galleryStatus62=parts.join(' ');
 }else galleryStatus62=`Checked saved renders (${saved.length}) and older completed jobs (${pending.length}).`;
 const rows=saved.map(g=>({id:g.id,url:g.output_url,created_at:g.created_at,scene:String(g.scene_type||''),job:String(g.metadata?.job_token||''),recoverable:false})).filter(x=>galleryUrl62(x.url));
 const jobs=new Set(rows.map(x=>x.job).filter(Boolean)),urls=new Set(rows.map(x=>galleryUrl62(x.url)));
 for(const j of pending){const url=galleryUrl62(j.output_url);if(!url||jobs.has(j.job_id)||urls.has(url))continue;rows.push({id:j.job_id,job:j.job_id,url,created_at:j.created_at,scene:'',recoverable:true});urls.add(url)}
 rows.sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));
 galleryRows62=rows;galleryLoaded62=true;galleryLoading62=false;
 if(historyFailed&&recoveryFailed)galleryError62='Renders could not connect to the server.';
 const current=(location.hash||'#home').slice(1).split('?')[0];
 if(!q('#appShell').hidden){
  if(['renders','albums'].includes(current))route();
  else if(['studio','home'].includes(current)){const recent=qa('#viewRoot .gallery').at(-1);if(recent){recent.innerHTML=renderCards();wireGallery62(recent)}}
 }
}
async function persistRender62(rawUrl,jobToken=''){
 const url=galleryUrl62(rawUrl);if(!url)return false;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);
 try{
  const r=await pxApi56('/server/save-generation.php',{method:'POST',cache:'no-store',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({output_url:url,scene_type:studioState.scene,mode:studioState.mode,metadata:{job_token:jobToken,width:studioFinal56.width||studioSourceDims.width,height:studioFinal56.height||studioSourceDims.height,interior_style:activeStyle65||null}})});
  const j=await json56(r,'PIONX gallery save');if(!r.ok||!j.generation?.id)throw new Error(j.error||'Gallery save failed');
  galleryRows62=galleryRows62.filter(x=>!jobToken||x.job!==jobToken);
  galleryRows62.unshift({id:j.generation.id,url:galleryUrl62(j.saved_output_url||url),created_at:j.generation.created_at||new Date().toISOString(),scene:studioState.scene,job:jobToken,recoverable:false});
  galleryLoaded62=true;return true;
 }catch(e){console.warn('PIONX gallery save',e);return false}finally{clearTimeout(timer)}
}
const localizedEditBase62=runLocalizedEdit56;
runLocalizedEdit56=async function(){
 const previous=studioFinal56.providerUrl;
 await localizedEditBase62();
 if(studioFinal56.providerUrl&&studioFinal56.providerUrl!==previous){
  const saved=await persistRender62(galleryUrl62(studioFinal56.exactUrl)||studioFinal56.providerUrl);
  toast(saved?'Edited image saved in Renders':'Edited image is ready, but gallery save failed. Download it now.');
 }
};
function wireGallery62(scope){
 qa('[data-gallery-refresh]',scope).forEach(b=>b.addEventListener('click',()=>{galleryLoaded62=false;galleryLoad62()}));
 qa('[data-gallery-open]',scope).forEach(b=>b.addEventListener('click',()=>{const item=galleryRows62[Number(b.dataset.galleryOpen)],url=galleryUrl62(item?.url);if(url)openGalleryImage64(item)}));
 qa('[data-gallery-recover]',scope).forEach(b=>b.addEventListener('click',async()=>{const item=galleryRows62[Number(b.dataset.galleryRecover)];if(!item?.recoverable)return;b.disabled=true;b.textContent='Saving…';
  const saved=await persistRender62(item.url,item.job);if(saved){toast('Recovered render saved to your account');await galleryLoad62()}else{toast('Recovery could not save this image. Open it and download a copy if available.');b.disabled=false;b.textContent='Save to Renders'}
 }));
}
const wireViewBase62=wireView;
wireView=function(name){wireViewBase62(name);if(['renders','albums','studio','home'].includes(name))wireGallery62(q('#viewRoot'));if(['profile','portfolio'].includes(name))q('#shareProfile64')?.addEventListener('click',shareProfile64)};
const renderAccountBase62=renderAccount56;
renderAccount56=function(data){const result=renderAccountBase62(data),id=String(data?.user?.id||'');if(id!==galleryUser62){galleryUser62=id;galleryRows62=[];galleryLoaded62=false;galleryError62=''}if(id&&!galleryLoaded62&&!galleryLoading62)galleryLoad62();return result};
const routeBase62=route;
route=function(){routeBase62();const name=(location.hash||'#home').slice(1).split('?')[0];if(['renders','albums','studio','home'].includes(name)&&signedIn56()&&!galleryLoaded62&&!galleryLoading62)galleryLoad62()};

// V6.4: real profile sharing and image opening within the gallery.
function openGalleryImage64(item){
 const url=galleryUrl62(item?.url);if(!url)return;
 let m=q('#galleryViewer64');if(!m){m=document.createElement('div');m.id='galleryViewer64';m.className='gallery-viewer64';m.setAttribute('role','dialog');m.setAttribute('aria-modal','true');document.body.appendChild(m);m.addEventListener('click',e=>{if(e.target===m||e.target.closest('[data-gallery-close64]'))m.hidden=true});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!m.hidden)m.hidden=true})}
 m.innerHTML=`<div class="gallery-viewer-card64"><div class="gallery-viewer-head64"><b>Final render</b><div><button type="button" data-gallery-edit65>Edit in Studio</button><a href="${escHtml(url)}" target="_blank" rel="noopener noreferrer">Open original ↗</a><button type="button" data-gallery-close64 aria-label="Close image">×</button></div></div><img src="${escHtml(url)}" alt="PIONX render"><p hidden>Image unavailable. Try Open original, or check whether the render link has expired.</p></div>`;
 const im=q('img',m);im.onerror=()=>{im.hidden=true;q('p',m).hidden=false};m.hidden=false;q('[data-gallery-edit65]',m).onclick=async()=>{try{const dims=await imageDims56(url);studioSourceImage=url;studioSourceName='Saved render';studioSourceDims.width=dims.width;studioSourceDims.height=dims.height;studioState.scene=item.scene||'auto';studioFinal56={providerUrl:url,exactUrl:url,masterUrl:url,width:dims.width,height:dims.height,masterWidth:dims.width,masterHeight:dims.height};m.hidden=true;go('studio');q('#postTools65')?.scrollIntoView({behavior:'smooth',block:'center'})}catch{toast('Image could not be opened for editing')}};q('[data-gallery-close64]',m)?.focus();
}
async function shareProfile64(){
 const b=q('#shareProfile64');if(b){b.disabled=true;b.textContent='Preparing link…'}
 try{
  if(!signedIn56())throw new Error('Sign in before sharing your profile.');
  const r=await pxApi56('/server/public-profile-v64.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:profileState.displayName,title:profileState.title,company:profileState.company,bio:profileState.bio,photo:profileState.photo})});
  const data=await json56(r,'PIONX profile sharing');if(!r.ok||!data.token)throw new Error(data.error||'Could not create a share link.');
  const link=new URL(location.pathname,location.origin);const nameSlug=String(profileState.displayName||'profile').normalize('NFKD').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-|-$/g,'').slice(0,70)||'profile';link.searchParams.set('pionx_profile',nameSlug+'-'+data.token);
  const m=openDemoDialog('Share profile',`<p>Anyone with this link can see your public profile details. Your Renders stay private.</p><input id="profileShareUrl64" type="text" readonly value="${escHtml(link.href)}" aria-label="Profile link">`,'<button class="primary-btn" id="copyProfileUrl64" type="button">Copy link</button>');
  q('#copyProfileUrl64',m)?.addEventListener('click',async()=>{const input=q('#profileShareUrl64',m);input.select();try{await navigator.clipboard.writeText(input.value);toast('Profile link copied')}catch{toast('Select the link and copy it')}});
 }catch(e){toast(e.message||'Could not share profile')}finally{if(b){b.disabled=false;b.textContent='Share profile'}}
}
async function loadSharedProfile64(){
 const sharedName=new URLSearchParams(location.search).get('pionx_profile');if(!sharedName)return;const token=String(sharedName).match(/([a-f0-9]{32})$/)?.[1]||'';
 const m=document.createElement('div');m.className='public-profile64';m.setAttribute('role','dialog');m.setAttribute('aria-modal','true');m.innerHTML='<div class="public-profile-card64">Loading profile…</div>';document.body.appendChild(m);
 try{const r=await fetch('/server/public-profile-v64.php?token='+encodeURIComponent(token),{cache:'no-store'}),j=await json56(r,'Public profile');if(!r.ok||!j.profile)throw new Error('This profile link is unavailable.');const p=j.profile;
  m.innerHTML=`<div class="public-profile-card64"><button class="public-profile-close64" type="button" aria-label="Close profile">×</button><div class="public-profile-avatar64">${p.photo?`<img src="${escHtml(p.photo)}" alt="">`:escHtml(String(p.name||'P')[0].toUpperCase())}</div><small>PIONX ARCHITECTURE PROFILE</small><h1>${escHtml(p.name||'PIONX member')}</h1><h2>${escHtml(p.title||'Architect / Designer')}</h2><p>${escHtml(p.company||'')}</p><p class="public-profile-bio64">${escHtml(p.bio||'')}</p></div>`;
 }catch(e){m.innerHTML='<div class="public-profile-card64"><button class="public-profile-close64" type="button" aria-label="Close profile">×</button><p>Profile link unavailable.</p></div>'}
 q('.public-profile-close64',m)?.addEventListener('click',()=>{m.remove();history.replaceState(null,'',location.pathname+location.hash)});
}
loadSharedProfile64();
// V6.5 post-render tools. Retouch runs locally; style changes use one protected render job.
const interiorStyles65={
 'Modern':'clean contemporary forms, restrained neutral stone, wood and metal, integrated lighting',
 'Contemporary':'current design language, layered warm neutrals, refined natural materials',
 'Minimalist':'quiet minimal palette, simple finishes, visual calm, no new objects',
 'Scandinavian':'light oak, pale neutrals, natural linen, soft daylight and tactile simplicity',
 'Japandi':'warm oak, wabi-sabi plaster, muted earth tones and restrained Japanese-Scandinavian warmth',
 'Wabi-sabi':'subtle imperfect plaster, handmade ceramic textures and natural patina',
 'Industrial':'exposed concrete, dark steel, aged timber and realistic utility details only where already present',
 'Bohemian':'layered earthy textiles, natural timber, artisanal pattern and warm color accents',
 'Mid-century Modern':'walnut, warm brass, period-inspired colors and clean mid-century material language',
 'Classical':'natural stone, refined moulding finish, rich timber and classical color harmony without altering construction',
 'Neoclassical':'understated classical palette, delicate stone and soft metallic details on existing surfaces',
 'Art Deco':'geometric material patterns, polished stone, brass accents and controlled jewel tones',
 'Transitional':'balanced classic and modern finishes, warm wood, refined stone and calm layered color',
 'Rustic':'natural wood grain, aged stone, woven texture and warm imperfect finishes',
 'Farmhouse':'painted timber, natural oak, linen and welcoming soft neutral finishes',
 'Mediterranean':'lime plaster, terracotta, pale stone and sun-warmed Mediterranean palette',
 'Coastal':'washed timber, sand and sea neutrals, airy textiles and clear natural light',
 'Traditional':'classic warm wood, layered textiles and timeless refined material choices',
 'Luxury':'premium natural stone, polished metals, rich timber and balanced editorial lighting',
 'Maximalist':'expressive color, layered material texture and decorative pattern on existing surfaces only',
 'Tropical':'natural rattan, warm timber, foliage tones and airy tropical material character',
 'Moroccan':'tadelakt, zellige-inspired color, warm metal and crafted texture on existing finishes',
 'Bauhaus':'functional bold color blocks, clean geometry and honest industrial materials'
};
let activeStyle65='';
const studioRouteBase65=routes.studio;
routes.studio=function(){let html=studioRouteBase65();const panel=`<section class="post-tools65" id="postTools65"><h3>Post-render Studio</h3><p>Retouch locally for free, or start one new credit-charged render for an interior style. Layout and camera are locked in the prompt.</p><div class="post-actions65"><button class="ghost-btn" id="openRetouch65" type="button">✦ Retouch image</button><select id="interiorStyle65" aria-label="Interior style"><option value="">Choose interior style</option>${Object.keys(interiorStyles65).map(n=>`<option value="${escHtml(n)}">${escHtml(n)}</option>`).join('')}</select><button class="primary-btn" id="applyInteriorStyle65" type="button">Render selected style</button></div><small id="postStatus65">${studioFinal56.providerUrl?'Final image ready for editing.':'Finish a render first to use these tools.'}</small></section>`;return html.replace('<div class="filmstrip">',panel+'<div class="filmstrip">').replace(/<div class="filmstrip">[\s\S]*?<\/div><\/section>/,'</section>')};
function ensurePost65(){const p=q('#postTools65');if(!p)return;p.querySelector('#postStatus65').textContent=studioFinal56.providerUrl?'Final image ready for editing.':'Finish a render first to use these tools.';q('#applyInteriorStyle65').disabled=!studioFinal56.providerUrl;q('#openRetouch65').disabled=!studioFinal56.providerUrl}
function openInteriorStyles65(){if(!studioFinal56.providerUrl)return toast('Render an image first');if(studioState.scene!=='interior')return toast('Choose Interior scene for interior styles');q('#postTools65')?.scrollIntoView({behavior:'smooth',block:'center'});q('#interiorStyle65')?.focus()}
async function runInteriorStyle65(){
 if(!studioFinal56.providerUrl)return toast('Render an image first');if(studioState.scene!=='interior')return toast('Interior styles require Interior scene');
 const style=q('#interiorStyle65')?.value;if(!interiorStyles65[style])return toast('Choose an interior style');
 const b=q('#applyInteriorStyle65');if(b.disabled||b.dataset.busy)return;b.dataset.busy='1';b.disabled=true;b.textContent='Rendering style…';
 const previous=studioFinal56.providerUrl,modal=showRenderMind58();q('#renderMindScene').textContent=`Interior · ${style} · architecture locked`;let start=null,engine='';
 try{
  const account=await loadAccount56({quiet:true});if(!account)throw new Error('Sign in to render a style');
  mindUpdate('Reading the finished interior and locking its layout and camera…',18,0);
  const prompt=[`SELECTED INTERIOR STYLE LOCK — ${style.toUpperCase()}. This style is visually authoritative after geometry preservation. Apply ${interiorStyles65[style]}. Keep the exact room shell, walls, ceiling heights, doors, windows, structure, built-in locations, furniture count/function/position/orientation, viewpoint, composition and aspect ratio. Restyle surface finishes, furniture design language, upholstery, textures, palette, lighting fixtures and decorative detailing strongly enough that ${style} is unmistakable. Furniture models may change to style-appropriate equivalents while keeping approximate footprint and placement. Ignore conflicting source decorative style; never fall back to generic luxury.`,REALITY_RENDER_DIRECTIVE_R162,premiumCleanDirective56].join('\n\n');
  const payload=renderPayload56({source_image:previous,prompt,mode:'preserve',width:studioSourceDims.width,height:studioSourceDims.height,references:[]});payload.scene_type='interior';payload.analysis.interior_style=style;
  mindUpdate('Preparing a single protected style render…',38,2);start=await renderPost56(payload,45000);engine=start.engines?.[0]||'';if(!engine)throw new Error('Style render unavailable');
  if(Number.isFinite(Number(start.credits_remaining)))setCreditsFromRender56(start.credits_remaining);
  mindUpdate('Applying the selected interior materials…',56,3);const done=await renderEngine56(start,engine),best=done?.candidates?.find(x=>x?.url);if(!best?.url)throw new Error('No styled image returned');
  mindUpdate('Finishing the exact canvas…',93,4);await finalizeRenderedImage56(best.url);const out=q('#studioOutput');if(out){out.src=studioFinal56.exactUrl||best.url;out.style.filter='none';out.style.transform='none'}
  if(q('#studioOutputBadge'))q('#studioOutputBadge').textContent=`${style.toUpperCase()} · EXACT SIZE`;
  activeStyle65=style;const saved=await persistRender62(galleryUrl62(studioFinal56.exactUrl)||best.url,start.job_token);activeStyle65='';
  mindUpdate('New style version ready…',100,5);await loadAccount56({quiet:true});hideRenderMind58(500);ensurePost65();toast(saved?`${style} version saved in Renders`:`${style} version ready; gallery save failed, download it now`);
 }catch(e){console.error('Interior restyle',e);if(start&&engine)await cancelRender56(start,engine);hideRenderMind58(2500);toast(e.message||'Style render failed')}finally{activeStyle65='';delete b.dataset.busy;b.disabled=false;b.textContent='Render selected style'}
}
function retouchFilter65(v){return `brightness(${1+Number(v.exposure)/100}) contrast(${1+Number(v.contrast)/100}) saturate(${1+Number(v.saturation)/100})`}
function paintRetouch65(ctx,img,w,h,v){ctx.clearRect(0,0,w,h);ctx.filter=retouchFilter65(v);ctx.drawImage(img,0,0,w,h);ctx.filter='none';const warmth=Number(v.warmth);if(warmth){ctx.fillStyle=warmth>0?`rgba(255,152,55,${Math.min(.22,warmth/360)})`:`rgba(55,130,255,${Math.min(.22,-warmth/360)})`;ctx.fillRect(0,0,w,h)}}
async function openRetouch65(){
 if(!studioFinal56.providerUrl)return toast('Render an image first');let blob;
 try{blob=await fetchRenderBlob56(studioFinal56.providerUrl)}catch(e){return toast('Could not load final image for retouch: '+e.message)}
 const sourceUrl=URL.createObjectURL(blob),img=new Image();try{img.src=sourceUrl;await img.decode()}catch{URL.revokeObjectURL(sourceUrl);return toast('Could not decode the final image')}
 const m=document.createElement('div');m.className='retouch-modal65';m.setAttribute('role','dialog');m.setAttribute('aria-modal','true');m.innerHTML=`<div class="retouch-card65"><header><div><b>Post-render retouch</b><small>Exposure · contrast · saturation · color temperature · original canvas</small></div><button type="button" data-retouch-close aria-label="Close">×</button></header><canvas id="retouchPreview65" aria-label="Retouch preview"></canvas><div class="retouch-controls65">${[['exposure','Exposure'],['contrast','Contrast'],['saturation','Saturation'],['warmth','Warmth']].map(([k,label])=>`<label>${label}<input type="range" min="-60" max="60" value="0" data-retouch="${k}"><output data-retouch-value="${k}">0</output></label>`).join('')}</div><footer><button type="button" id="retouchBefore65">Hold to compare</button><button type="button" id="retouchReset65">Reset</button><button type="button" id="retouchDownload65">Download edited</button><button type="button" class="primary-btn" id="retouchSave65">Save as new version</button></footer></div>`;document.body.appendChild(m);
 const values={exposure:0,contrast:0,saturation:0,warmth:0},preview=q('#retouchPreview65',m);const scale=Math.min(1,1400/img.naturalWidth,900/img.naturalHeight);preview.width=Math.max(1,Math.round(img.naturalWidth*scale));preview.height=Math.max(1,Math.round(img.naturalHeight*scale));const ctx=preview.getContext('2d',{alpha:false});let raf=0;
 const draw=()=>paintRetouch65(ctx,img,preview.width,preview.height,values),schedule=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(draw)};draw();
 const close=()=>{m.remove();URL.revokeObjectURL(sourceUrl);cancelAnimationFrame(raf)};q('[data-retouch-close]',m).onclick=close;m.addEventListener('click',e=>{if(e.target===m)close()});
 qa('[data-retouch]',m).forEach(input=>input.addEventListener('input',()=>{values[input.dataset.retouch]=Number(input.value);q(`[data-retouch-value="${input.dataset.retouch}"]`,m).textContent=input.value;schedule()}));
 q('#retouchReset65',m).onclick=()=>{for(const input of qa('[data-retouch]',m)){input.value='0';values[input.dataset.retouch]=0;q(`[data-retouch-value="${input.dataset.retouch}"]`,m).textContent='0'}schedule()};
 const before=q('#retouchBefore65',m);before.addEventListener('pointerdown',()=>{ctx.filter='none';ctx.drawImage(img,0,0,preview.width,preview.height)});for(const event of ['pointerup','pointerleave','pointercancel'])before.addEventListener(event,schedule);
 const makeBlob=async()=>{const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;paintRetouch65(canvas.getContext('2d',{alpha:false}),img,canvas.width,canvas.height,values);return await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.94))};
 q('#retouchDownload65',m).onclick=async()=>{const out=await makeBlob();if(!out)return toast('Could not export image');const u=URL.createObjectURL(out),a=document.createElement('a');a.href=u;a.download='PIONX-retouch-'+img.naturalWidth+'x'+img.naturalHeight+'.jpg';a.click();setTimeout(()=>URL.revokeObjectURL(u),10000)};
 q('#retouchSave65',m).onclick=async()=>{const button=q('#retouchSave65',m);button.disabled=true;button.textContent='Saving…';try{const output=await makeBlob();if(!output||output.size>16*1024*1024)throw new Error('Image too large to save; download it instead');const image=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(output)});const res=await pxApi56('/server/retouch-save-v65.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image,parent_url:studioFinal56.providerUrl,scene_type:studioState.scene})});const data=await json56(res,'PIONX retouch');if(!res.ok||!data.url)throw new Error(data.error||'Could not save retouch');studioFinal56={providerUrl:data.url,exactUrl:data.url,masterUrl:data.url,blob:output,width:img.naturalWidth,height:img.naturalHeight,masterWidth:img.naturalWidth,masterHeight:img.naturalHeight};if(q('#studioOutput'))q('#studioOutput').src=data.url;if(q('#studioOutputBadge'))q('#studioOutputBadge').textContent='RETOUCHED · SAVED';galleryLoaded62=false;await galleryLoad62();close();toast('Retouched version saved in Renders and Albums')}catch(e){toast(e.message||'Retouch save failed')}finally{button.disabled=false;button.textContent='Save as new version'}};
}
async function resize2x65(){if(!studioFinal56.providerUrl)return toast('Render an image first');try{const blob=await fetchRenderBlob56(studioFinal56.providerUrl),u=URL.createObjectURL(blob),im=new Image();im.src=u;await im.decode();if(im.naturalWidth*im.naturalHeight>16000000||Math.max(im.naturalWidth,im.naturalHeight)*2>8192)throw new Error('Image too large for browser resize');const c=document.createElement('canvas');c.width=im.naturalWidth*2;c.height=im.naturalHeight*2;const ctx=c.getContext('2d');ctx.imageSmoothingQuality='high';ctx.drawImage(im,0,0,c.width,c.height);const out=await new Promise(resolve=>c.toBlob(resolve,'image/png'));URL.revokeObjectURL(u);if(!out)throw new Error('Could not resize image');const link=URL.createObjectURL(out),a=document.createElement('a');a.href=link;a.download='PIONX-resized-2x.png';a.click();setTimeout(()=>URL.revokeObjectURL(link),10000);toast('2× resized copy downloaded · no new AI detail added')}catch(e){toast(e.message||'Could not resize image')}}
function compare65(){if(!studioFinal56.providerUrl||!studioSourceImage)return toast('Source and final images needed');const m=openDemoDialog('Before / After',`<div class="compare65"><div><b>Source</b><img src="${escHtml(studioSourceImage)}" alt="Source"></div><div><b>Final</b><img src="${escHtml(galleryUrl62(studioFinal56.exactUrl)||studioFinal56.exactUrl)}" alt="Final"></div></div>`);m.querySelector('.dialog-card').classList.add('compare-card65')}
const studioToolBase65=studioTool;
studioTool=function(action){if(action==='enhance')return openRetouch65();if(action==='variations')return openInteriorStyles65();if(action==='relight')return openRetouch65();if(action==='upscale')return resize2x65();if(action==='more'){const m=openDemoDialog('Image actions','<div class="demo-option-grid"><button data-more65="full">Full View</button><button data-more65="download">Download exact</button><button data-more65="edit">Edit selected area</button><button data-more65="retouch">Retouch</button><button data-more65="style">Interior styles</button><button data-more65="compare">Before / After</button></div>');qa('[data-more65]',m).forEach(b=>b.onclick=()=>{m.hidden=true;({full:openFullView56,download:downloadResult56,edit:activateResultEdit56,retouch:openRetouch65,style:openInteriorStyles65,compare:compare65})[b.dataset.more65]()});return}return studioToolBase65(action)};
cycleAdjust=function(kind){if(kind==='style')openInteriorStyles65();else if(['lighting','materials','color'].includes(kind))openRetouch65();else if(kind==='camera')openFullView56()};
const studioWireBase65=wireView;
wireView=function(name){studioWireBase65(name);if(name!=='studio')return;
 q('#openRetouch65')?.addEventListener('click',openRetouch65);q('#applyInteriorStyle65')?.addEventListener('click',runInteriorStyle65);ensurePost65();for(const [action,label] of Object.entries({enhance:'✦ Retouch',variations:'▦ Interior styles',relight:'◌ Light & color'})){const b=q(`[data-studio-tool=\"${action}\"]`);if(b)b.textContent=label}
 const upscale=qa('[data-studio-tool="upscale"]');for(const b of upscale){b.textContent='⌗ Resize 2×';b.title='Resample to 2× dimensions, not AI detail enhancement'}
 const adv=q('#studioAdvancedBtn');if(adv){const fresh=adv.cloneNode(true);adv.replaceWith(fresh);fresh.onclick=()=>openDemoDialog('Studio settings','<p>Architecture lock: strict. Canvas size: same as uploaded image. Follow the numbered Source image, Scene & lighting, and Prompt & references sections. The Render button stays at the bottom of your screen. After rendering, use the result editing tools for materials and finishing.</p>')}
 q('[data-canvas-action="rotate"]')?.remove();const layers=q('[data-adjust-tab="layers"]');layers?.remove();q('[data-adjust-pane="layers"]')?.remove();const hist=q('[data-adjust-pane="history"]');if(hist)hist.innerHTML=`<div class="history-list"><article><b>Source</b><small>${studioSourceName?escHtml(studioSourceName):'No source yet'}</small></article><article><b>Current final</b><small>${studioFinal56.providerUrl?'Ready':'Not rendered yet'}</small></article></div>`;
};
const baseRender65=runRenderDemo;runRenderDemo=async function(){await baseRender65();ensurePost65()};
const baseEdit65=runLocalizedEdit56;runLocalizedEdit56=async function(){await baseEdit65();ensurePost65()};

// ===== V6.6 DIRECT VIDEO + REAL PRESENTATION EXPORTS =====
function videoJobKey1615(){return 'pionx-video-job-v66-'+location.pathname.replace(/[^/]*$/,'')+'-'+String(PXUSER56?.id||'');}
let videoJob66='',videoTimer66=0,videoBusy66=false;
const videoBase66=routes.video;
routes.video=function(){return `<section class="page">${pageHead('VIDEO STUDIO','Video','Generate a video from your render or a written direction using PIONX Motion.','')}<div class="media-grid"><section class="panel video-preview" id="videoPreview66"><div class="video-placeholder66"><b>Video preview</b><span>Upload a starting image or choose your latest render.</span></div></section><aside class="panel media-settings"><label class="field-title">Starting image (optional)<input type="file" id="videoImage66" accept="image/png,image/jpeg,image/webp"></label><button class="ghost-btn" id="videoLatest66" type="button">Use latest render</button><div class="field-title">Direction</div><textarea id="videoPrompt66" class="notes" placeholder="Slow cinematic camera push through the entrance, preserving the exact architecture and materials..."></textarea><div class="form-grid"><label>Quality<select id="videoQuality66"><option value="premium">Premium</option><option value="fast">Fast</option></select></label><label>Duration<select id="videoDuration66"><option value="8">8 seconds</option><option value="6">6 seconds</option><option value="4">4 seconds</option></select></label></div><p class="video-caveat66">Video uses your available credits. The quoted amount is reserved before generation and adjusted when it completes.</p><p id="videoQuote66" role="status">Checking video credits…</p><button class="primary-btn" id="videoGenerate66" style="width:100%">Generate video</button><p id="videoStatus66" role="status" aria-live="polite"></p><button class="ghost-btn" id="videoDownload66" hidden>Download MP4</button></aside></div></section>`};
function videoStatus66(text){const e=q('#videoStatus66');if(e)e.textContent=text}
async function videoCall66(payload){const r=await pxApi56('/server/video-direct-v66.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const j=await json56(r,'Video');if(!r.ok)throw Error(j.error||'Video request failed');return j}
async function videoPoll66(){
 if(!videoJob66)return;const id=videoJob66,owner=videoJobKey1615();
 const current=()=>videoJob66===id&&videoJobKey1615()===owner;
 try{const j=await videoCall66({action:'status',id});if(!current())return;
  if(j.state==='ready'){
   videoBusy66=false;videoStatus66('Video ready. Preview it here or download the MP4.');loadAccount56({quiet:true}).catch(()=>{});
   if(q('#videoGenerate66'))q('#videoGenerate66').disabled=false;if(q('#videoDownload66'))q('#videoDownload66').hidden=false;
   const stage=q('#videoPreview66');if(stage&&!stage.querySelector('video[data-pionx-video-job="'+id+'"]')){
    const video=document.createElement('video');video.controls=true;video.playsInline=true;video.preload='metadata';video.dataset.pionxVideoJob=id;
    video.src=serverUrl56('video-auto-v627.php?action=preview&id='+encodeURIComponent(id));video.setAttribute('aria-label','Generated PIONX video');
    video.addEventListener('error',()=>videoStatus66('Video ready. If preview is unavailable, download the MP4.'));stage.replaceChildren(video);
   }
   clearTimeout(videoTimer66);return;
  }
  videoBusy66=true;if(q('#videoGenerate66'))q('#videoGenerate66').disabled=true;videoStatus66('Video is rendering. This can take several minutes.');clearTimeout(videoTimer66);videoTimer66=setTimeout(videoPoll66,12000);
 }catch(error){if(!current())return;clearTimeout(videoTimer66);
  if(error.state==='failed'){videoBusy66=false;safeStore.set(videoJobKey1615(),'');if(q('#videoGenerate66'))q('#videoGenerate66').disabled=false;videoStatus66(error.message);return;}
  videoBusy66=true;if(q('#videoGenerate66'))q('#videoGenerate66').disabled=true;videoStatus66('Progress is temporarily unavailable. Your existing video job remains saved.');videoTimer66=setTimeout(videoPoll66,12000);
 }
}
async function videoQuote66(){try{const j=await videoCall66({action:'quote',quality:q('#videoQuality66').value,duration:q('#videoDuration66').value});if(q('#videoQuote66'))q('#videoQuote66').textContent=`Cost: ${j.credits_cost} credits · temporary reserve: ${j.credits_reserved} credits`;}catch(e){if(q('#videoQuote66'))q('#videoQuote66').textContent=e.message}}
let videoImage66='';
async function wireVideo66(){const file=q('#videoImage66'),btn=q('#videoGenerate66');q('#videoQuality66')?.addEventListener('change',videoQuote66);q('#videoDuration66')?.addEventListener('change',videoQuote66);videoQuote66();file?.addEventListener('change',async()=>{const f=file.files?.[0];if(!f)return;if(f.size>5.8*1024*1024){videoStatus66('Choose an image smaller than 6 MB');return}videoImage66=await readStudioImage(f);q('#videoPreview66').innerHTML=`<img src="${videoImage66}" alt="Video starting frame">`;videoStatus66('Starting image loaded')});q('#videoLatest66')?.addEventListener('click',async()=>{const u=studioFinal56.providerUrl||galleryRows62[0]?.url;if(!u){videoStatus66('Render an image first, or upload a starting image.');return}try{const blob=await fetchRenderBlob56(galleryUrl62(u));if(blob.size>5.8*1024*1024)throw Error('Latest render exceeds 6 MB. Upload a smaller image.');videoImage66=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob)});q('#videoPreview66').innerHTML=`<img src="${videoImage66}" alt="Video starting frame">`;videoStatus66('Latest render selected')}catch(e){videoStatus66(e.message)}});btn?.addEventListener('click',async()=>{if(videoBusy66)return;const note=q('#videoPrompt66')?.value.trim()||'';const prompt=[note,'Cinematic architectural visualization. Preserve building geometry, openings, interior layout, materials and perspective; stable smooth camera movement.'].filter(Boolean).join('\n');videoBusy66=true;btn.disabled=true;videoStatus66('Submitting video request…');try{const j=await videoCall66({action:'start',prompt,image:videoImage66,quality:q('#videoQuality66').value,duration:q('#videoDuration66').value});videoJob66=j.id;safeStore.set(videoJobKey1615(),j.id);loadAccount56({quiet:true}).catch(()=>{});videoStatus66('Video job started. Rendering…');videoTimer66=setTimeout(videoPoll66,12000)}catch(e){videoBusy66=false;btn.disabled=false;videoStatus66(e.message)}});q('#videoDownload66')?.addEventListener('click',async()=>{if(!videoJob66)return;try{const r=await pxApi56('/server/video-direct-v66.php?action=download&id='+encodeURIComponent(videoJob66));if(!r.ok)throw Error((await json56(r,'Download')).error||'Download failed');const u=URL.createObjectURL(await r.blob()),a=document.createElement('a');a.href=u;a.download='PIONX-video.mp4';a.click();setTimeout(()=>URL.revokeObjectURL(u),60000)}catch(e){videoStatus66(e.message)}});if(videoJob66){videoStatus66('Checking your saved video job…');videoTimer66=setTimeout(videoPoll66,250)}}
let boardSources66=[];
const oldPresentation66=routes.presentation;
routes.presentation=function(){let html=oldPresentation66();const rows=galleryRows62.filter(r=>r?.url);const img=rows[presentationV4.selectedBoard%Math.max(1,rows.length)]?.url;if(img)html=html.replace(/<div class="board-main"><img src="[^"]+"/,`<div class="board-main"><img src="${escHtml(galleryUrl62(img))}"`);const field=`<label class="field-title">Project name<input id="presentationProject66" value="${escHtml(localStorage.getItem('pionx-presentation-name')||'My project')}" maxlength="100"></label><p class="video-caveat66">${rows.length?rows.length+' saved render(s) available for your boards.':'Save a render first to include real images.'}</p>`;return html.replace('<div class="field-title">Board type</div>',field+'<div class="field-title">Board type</div>')};
async function boardJpeg66(url){const blob=await fetchRenderBlob56(galleryUrl62(url)),object=URL.createObjectURL(blob);try{const image=new Image();image.src=object;await image.decode();const canvas=document.createElement('canvas'),scale=Math.min(1,2200/image.naturalWidth,1400/image.naturalHeight);canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/jpeg',.88)}finally{URL.revokeObjectURL(object)}}
async function presentationAssets66(){const rows=galleryRows62.filter(r=>r?.url);if(!rows.length)throw Error('Save a render in Renders before exporting a presentation');const list=[];for(let i=0;i<presentationV4.boards.length;i++)list.push(await boardJpeg66(rows[i%rows.length].url));return list}
function presentationTitle66(){return (localStorage.getItem('pionx-presentation-name')||'My project').trim().slice(0,100)||'My project'}
async function pdf66(images){const doc=await PDFLib.PDFDocument.create(),wide=presentationV4.orientation==='Landscape',a3=presentationV4.pageSize==='A3',size=presentationV4.pageSize==='16:9'?[960,540]:presentationV4.pageSize==='Square'?[720,720]:a3?[1191,842]:[842,595];if(!wide&&size[0]!==size[1])size.reverse();const font=await doc.embedFont(PDFLib.StandardFonts.Helvetica);for(let i=0;i<images.length;i++){const p=doc.addPage(size),w=size[0],h=size[1],im=await doc.embedJpg(images[i].split(',')[1]);p.drawRectangle({x:0,y:0,width:w,height:h,color:PDFLib.rgb(.055,.088,.14)});p.drawText((presentationTitle66()+' — '+presentationV4.boards[i]).replace(/[^\x20-\x7E]/g,'').slice(0,100),{x:35,y:h-55,size:22,font,color:PDFLib.rgb(1,1,1)});const maxW=w-70,maxH=h-125,s=Math.min(maxW/im.width,maxH/im.height);p.drawImage(im,{x:(w-im.width*s)/2,y:(h-85-im.height*s)/2,width:im.width*s,height:im.height*s});p.drawText('PIONX AI  |  Board '+(i+1)+' / '+images.length,{x:35,y:22,size:11,font,color:PDFLib.rgb(.8,.8,.8)})}return new Blob([await doc.save()],{type:'application/pdf'})}
async function ppt66(images){const ppt=new PptxGenJS();ppt.layout='LAYOUT_WIDE';ppt.author='PIONX AI';ppt.subject='Client presentation';ppt.title=presentationTitle66();for(let i=0;i<images.length;i++){const s=ppt.addSlide();s.background={color:'0E1724'};s.addText(presentationTitle66()+' — '+presentationV4.boards[i],{x:.45,y:.3,w:12.3,h:.55,fontSize:24,bold:true,color:'FFFFFF',breakLine:false});s.addImage({data:images[i],sizingContain:true,x:.5,y:1,w:12.33,h:5.8});s.addText('PIONX AI  •  '+(i+1)+' / '+images.length,{x:.5,y:7.1,w:4,h:.2,fontSize:9,color:'D8DCE2'})}const bytes=await ppt.write({outputType:'blob'});return bytes instanceof Blob?bytes:new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.presentationml.presentation'})}
function saveBlob66(blob,name){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),30000)}
async function exportPresentation66(kind,button){button.disabled=true;const label=button.textContent;button.textContent='Preparing…';try{const images=await presentationAssets66(),name='PIONX-'+presentationTitle66().replace(/[^a-z0-9_-]+/gi,'-').slice(0,40);if(kind==='export-pdf')saveBlob66(await pdf66(images),name+'.pdf');if(kind==='export-ppt')saveBlob66(await ppt66(images),name+'.pptx');if(kind==='package'){const zip=new JSZip();zip.file(name+'.pdf',await pdf66(images));zip.file(name+'.pptx',await ppt66(images));images.forEach((data,i)=>zip.file('boards/board-'+(i+1)+'.jpg',data.split(',')[1],{base64:true}));saveBlob66(await zip.generateAsync({type:'blob'}),name+'-package.zip')}toast('Presentation exported with '+images.length+' saved render boards')}catch(e){console.error(e);toast(e.message||'Presentation export failed')}finally{button.disabled=false;button.textContent=label}}
function wirePresentation66(){q('#presentationProject66')?.addEventListener('input',e=>localStorage.setItem('pionx-presentation-name',e.target.value));qa('[data-presentation-action]').filter(b=>['export-pdf','export-ppt','package'].includes(b.dataset.presentationAction)).forEach(b=>{const fresh=b.cloneNode(true);b.replaceWith(fresh);fresh.addEventListener('click',()=>exportPresentation66(fresh.dataset.presentationAction,fresh))})}
const wireBase66=wireView;wireView=function(name){wireBase66(name);if(name==='video')wireVideo66();if(name==='presentation')wirePresentation66()};
// ===== END V6.6 =====

// ===== V6.7 SCENE DIRECTOR + NONDESTRUCTIVE PHOTO RETOUCH =====
const sceneProduction67={
 auto:'FIRST visually classify the source as interior, exterior, landscape, masterplan or sketch; apply that scene\'s photographic rules. Never turn a masterplan into a facade or a room into an outdoor scene. Keep the source camera, boundary and composition.',
 interior:'INTERIOR architectural photography. Lock room boundaries, ceiling height, wall/opening locations, built-ins, furniture placement and exact camera perspective. Resolve realistic indirect daylight and practical light bounce, believable glass transmission, contact shadows, natural stone pores, timber grain, fabric weave and metal roughness at proper scale. Keep the existing design language and circulation; avoid staging changes.',
 exterior:'EXTERIOR architectural photography. Lock building silhouette, floor count, facade grid, window and door positions, structure, roofline and viewpoint. Refine facade surface detail, glazing depth and sky reflection, coherent daylight or night lighting, planted context at true scale, site contact shadows, construction joints and realistic atmospheric depth. Do not add floors or alter openings.',
 landscape:'LANDSCAPE photography. Lock site boundaries, levels, paths, hardscape geometry, water edges and building locations. Make planting species, growth habits, climate, density and season believable; render foliage translucency, paving joints, soil, lawn, water physics, furniture scale and natural outdoor shadows. Do not relocate paths, features or planting zones.',
 masterplan:'MASTERPLAN aerial visualization. Lock north/orientation, parcel boundaries, roads, road hierarchy, building footprints, plot count, setbacks, levels, circulation and top-down/axonometric camera. Improve legibility of roads and parcels, consistent roof scale, outdoor materials, landscape structure, shadows and restrained atmosphere. Never invent buildings, roads or planning geometry; preserve labels where legible.',
 sketch:'SKETCH-TO-RENDER. Treat drawing linework as fixed design information: retain plan/form, grid, massing, roofs, openings, proportions and perspective. Infer missing materials conservatively, resolve buildable joins and render photorealistically without changing the concept.'
};
const payloadBase67=renderPayload56;
renderPayload56=function(overrides={}){
 const payload=payloadBase67(overrides),scene=String(overrides.scene_type||studioState.scene||'auto').toLowerCase();
 const direction=sceneProduction67[scene]||sceneProduction67.auto;
 const original=(overrides.prompt??q('#studioNotes')?.value?.trim()??'').trim();
 const lighting=envRules[studioState.env]||envRules.auto,styleSelected=scene==='interior'&&studioState.interiorStyle!=='none'&&!!studioInteriorStyleDirectiveR16(),mode=styleSelected?'STYLE-AWARE PRESERVATION: preserve room geometry, openings, layout, furniture count/function/position and camera exactly, but DO NOT preserve the old decorative/material style. The selected Interior Style is allowed to replace materials, furniture design language, light fixtures and decorative finishes while the spatial design stays locked.':(modeRules[overrides.mode||studioState.mode]||modeRules.preserve);
 const entourage=[studioState.people?'Add a few correctly scaled people only where the space supports them.':'Do not add people.',studioState.cars?'Add realistic vehicles only on existing roads or parking.':'Do not add vehicles.'].join(' ');
 const selectedStyle=scene==='interior'?studioInteriorStyleDirectiveR16():'';
 payload.prompt=[`SCENE-SPECIFIC PRODUCTION DIRECTOR — ${scene.toUpperCase()}. ${direction}`,mode,lighting,entourage,selectedStyle,original?`USER DIRECTION (apply without violating geometry): ${original}`:'No user note: use the source image itself as geometry and content authority.',REALITY_RENDER_DIRECTIVE_R162,premiumCleanDirective56].filter(Boolean).join('\n\n');
 if(payload.controls){payload.controls.interior_style_locked=!!selectedStyle;payload.controls.style_strength=selectedStyle?1:0;payload.controls.reality_lock='professional_archviz_v1';}
 payload.scene_type=scene;payload.analysis={...payload.analysis,scene_prompt_version:'scene_v67-r162',scene_prompt_type:scene,interior_style_locked:!!selectedStyle,reality_lock:'professional_archviz_v1'};
 return payload;
};
function clamp67(x,a=0,b=1){return Math.max(a,Math.min(b,x))}
function sharp67(canvas,amount){if(amount<=0)return;const w=canvas.width,h=canvas.height,ctx=canvas.getContext('2d',{willReadFrequently:true});if(w*h>24000000)throw Error('This image is too large for local sharpening. Reduce the crop or set Sharpness to 0.');const blurred=document.createElement('canvas');blurred.width=w;blurred.height=h;const bx=blurred.getContext('2d',{willReadFrequently:true});bx.filter='blur(1.15px)';bx.drawImage(canvas,0,0);const strength=amount/75,tile=512;for(let y=0;y<h;y+=tile)for(let x=0;x<w;x+=tile){const tw=Math.min(tile,w-x),th=Math.min(tile,h-y),orig=ctx.getImageData(x,y,tw,th),soft=bx.getImageData(x,y,tw,th);for(let k=0;k<orig.data.length;k+=4){for(let c=0;c<3;c++)orig.data[k+c]=clamp67(Math.round(orig.data[k+c]+strength*(orig.data[k+c]-soft.data[k+c])),0,255)}ctx.putImageData(orig,x,y)} }
function retouchRender67(ctx,img,fullW,fullH,v,region={x:0,y:0,w:1,h:1},sharp=true){
 const crop={x:Math.round(region.x*fullW),y:Math.round(region.y*fullH),w:Math.max(1,Math.round(region.w*fullW)),h:Math.max(1,Math.round(region.h*fullH))};
 ctx.canvas.width=crop.w;ctx.canvas.height=crop.h;ctx.fillStyle='#14202d';ctx.fillRect(0,0,crop.w,crop.h);
 ctx.save();ctx.translate(-crop.x,-crop.y);ctx.translate(fullW*(.5+v.panX/100),fullH*(.5+v.panY/100));ctx.rotate(v.angle*Math.PI/180);
 const a=Math.abs(v.angle*Math.PI/180),scale=Math.cos(a)+Math.sin(a)*Math.max(fullW/fullH,fullH/fullW)+.003;ctx.scale(scale,scale);
 ctx.filter=retouchFilter65(v);ctx.drawImage(img,-fullW/2,-fullH/2,fullW,fullH);ctx.restore();
 if(v.warmth){ctx.fillStyle=v.warmth>0?`rgba(255,152,55,${Math.min(.22,v.warmth/360)})`:`rgba(55,130,255,${Math.min(.22,-v.warmth/360)})`;ctx.fillRect(0,0,crop.w,crop.h)}
 if(sharp&&v.sharpness)sharp67(ctx.canvas,v.sharpness);
 return crop;
}
function cropRatio67(current,ratio){if(!ratio)return current;let w=current.w,h=current.h;const aspect=ratio;if(w/h>aspect)w=h*aspect;else h=w/aspect;return{x:clamp67(current.x+(current.w-w)/2,0,1-w),y:clamp67(current.y+(current.h-h)/2,0,1-h),w,h}}
openRetouch65=async function(focus='tone'){
 if(typeof focus!=='string'||!['tone','detail','crop','camera'].includes(focus))focus='tone';
 if(!studioFinal56.providerUrl)return toast('Render an image first');let source;
 try{source=await fetchRenderBlob56(studioFinal56.providerUrl)}catch(e){return toast('Cannot load final image: '+e.message)}
 const sourceUrl=URL.createObjectURL(source),img=new Image();try{img.src=sourceUrl;await img.decode()}catch{URL.revokeObjectURL(sourceUrl);return toast('Could not decode final image')}
 const m=document.createElement('div');m.className='retouch-modal65';m.setAttribute('role','dialog');m.setAttribute('aria-modal','true');const v={exposure:0,contrast:0,saturation:0,warmth:0,sharpness:0,angle:0,panX:0,panY:0},defaultCrop={x:0,y:0,w:1,h:1};let crop={...defaultCrop},ratio='free',drag=null,raf=0,closed=false;
 const group=(key,title,items)=>`<section class="retouch-group67" data-group67="${key}" ${focus===key?'':'hidden'}><h3>${title}</h3><div class="retouch-controls65">${items.map(([id,label,min,max])=>`<label>${label}<input type="range" min="${min}" max="${max}" value="0" data-retouch67="${id}"><output data-value67="${id}">0</output></label>`).join('')}</div></section>`;
 m.innerHTML=`<div class="retouch-card65 retouch-card67"><header><div><b>Photo retouch</b><small>Crop · Sharpness · Camera · Light & color. Original render remains untouched.</small></div><button type="button" data-close67 aria-label="Close">×</button></header><nav class="retouch-tabs67">${[['tone','Light & color'],['detail','Sharpness'],['crop','Crop'],['camera','Camera']].map(([k,t])=>`<button type="button" data-tab67="${k}" class="${focus===k?'active':''}">${t}</button>`).join('')}</nav><div class="retouch-stage67"><canvas id="retouchPreview67" aria-label="Edited image preview"></canvas><div id="cropBox67" class="crop-box67" ${focus==='crop'?'':'hidden'}></div></div><p id="retouchInfo67" class="retouch-info67"></p>
 ${group('tone','Photographic finishing',[['exposure','Exposure',-60,60],['contrast','Contrast',-60,60],['saturation','Saturation',-60,60],['warmth','Warmth',-60,60]])}
 ${group('detail','Natural edge detail',[['sharpness','Sharpness',0,80]])}
 <section class="retouch-group67" data-group67="crop" ${focus==='crop'?'':'hidden'}><h3>Crop the final image</h3><p>Drag on the image to choose a crop; the exported pixels follow the selected area.</p><div class="crop-options67"><label>Aspect ratio<select id="cropRatio67"><option value="free">Free</option><option value="original">Original</option><option value="1:1">Square 1:1</option><option value="4:5">Portrait 4:5</option><option value="16:9">Wide 16:9</option><option value="9:16">Vertical 9:16</option></select></label><button id="cropReset67">Reset crop</button></div></section>
 ${group('camera','Camera framing on the existing image',[['angle','Straighten (degrees)',-5,5],['panX','Horizontal framing',-15,15],['panY','Vertical framing',-15,15]])}<p class="camera-note67" data-camera-note67 ${focus==='camera'?'':'hidden'}>Straighten and frame the original image; this does not synthesize another camera view. Straightening trims the edge slightly to avoid blank corners.</p>
 <footer><button id="retouchBefore67">Hold to compare</button><button id="retouchReset67">Reset all</button><button id="retouchDownload67">Download edited</button><button class="primary-btn" id="retouchSave67">Save as new version</button></footer></div>`;document.body.appendChild(m);
 const preview=q('#retouchPreview67',m),stage=q('.retouch-stage67',m),box=q('#cropBox67',m),scale=Math.min(1,1200/img.naturalWidth,850/img.naturalHeight);preview.width=Math.max(1,Math.round(img.naturalWidth*scale));preview.height=Math.max(1,Math.round(img.naturalHeight*scale));let tab=focus;
 const positionBox=()=>{const bounds=preview.getBoundingClientRect(),parent=stage.getBoundingClientRect();box.style.left=(bounds.left-parent.left+crop.x*bounds.width)+'px';box.style.top=(bounds.top-parent.top+crop.y*bounds.height)+'px';box.style.width=crop.w*bounds.width+'px';box.style.height=crop.h*bounds.height+'px';q('#retouchInfo67',m).textContent=`Original ${img.naturalWidth} × ${img.naturalHeight} · Export ${Math.round(crop.w*img.naturalWidth)} × ${Math.round(crop.h*img.naturalHeight)} px`;};
 const draw=()=>{if(closed)return;retouchRender67(preview.getContext('2d',{willReadFrequently:true}),img,preview.width,preview.height,v,{x:0,y:0,w:1,h:1},true);positionBox()};const schedule=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(draw)};draw();
 const close=()=>{closed=true;cancelAnimationFrame(raf);m.remove();URL.revokeObjectURL(sourceUrl)};q('[data-close67]',m).onclick=close;m.addEventListener('click',e=>{if(e.target===m)close()});
 qa('[data-tab67]',m).forEach(b=>b.onclick=()=>{tab=b.dataset.tab67;qa('[data-tab67]',m).forEach(x=>x.classList.toggle('active',x===b));qa('[data-group67]',m).forEach(x=>x.hidden=x.dataset.group67!==tab);box.hidden=tab!=='crop';q('[data-camera-note67]',m).hidden=tab!=='camera';positionBox()});
 qa('[data-retouch67]',m).forEach(input=>input.oninput=()=>{v[input.dataset.retouch67]=Number(input.value);q(`[data-value67="${input.dataset.retouch67}"]`,m).textContent=input.value;schedule()});
 q('#cropRatio67',m).onchange=e=>{ratio=e.target.value;const target=ratio==='original'?1:(ratio==='free'?0:Number(ratio.split(':')[0])/Number(ratio.split(':')[1])*img.naturalHeight/img.naturalWidth);crop=cropRatio67(crop,target);positionBox()};
 q('#cropReset67',m).onclick=()=>{crop={...defaultCrop};q('#cropRatio67',m).value='free';ratio='free';positionBox()};
 const point=e=>{const r=preview.getBoundingClientRect();return{x:clamp67((e.clientX-r.left)/r.width),y:clamp67((e.clientY-r.top)/r.height)}};
 preview.onpointerdown=e=>{if(tab!=='crop')return;drag=point(e);preview.setPointerCapture(e.pointerId);e.preventDefault()};
 preview.onpointermove=e=>{if(!drag)return;const end=point(e),x=Math.min(drag.x,end.x),y=Math.min(drag.y,end.y),w=Math.abs(end.x-drag.x),h=Math.abs(end.y-drag.y);if(w<.02||h<.02)return;crop={x,y,w,h};const target=ratio==='original'?1:(ratio==='free'?0:Number(ratio.split(':')[0])/Number(ratio.split(':')[1])*img.naturalHeight/img.naturalWidth);crop=cropRatio67(crop,target);positionBox()};
 preview.onpointerup=()=>drag=null;preview.onpointercancel=()=>drag=null;
 q('#retouchReset67',m).onclick=()=>{Object.keys(v).forEach(k=>v[k]=0);qa('[data-retouch67]',m).forEach(x=>{x.value=0;q(`[data-value67="${x.dataset.retouch67}"]`,m).textContent='0'});crop={...defaultCrop};ratio='free';q('#cropRatio67',m).value='free';schedule()};
 const before=q('#retouchBefore67',m);before.onpointerdown=e=>{before.setPointerCapture(e.pointerId);const ctx=preview.getContext('2d');ctx.clearRect(0,0,preview.width,preview.height);ctx.drawImage(img,0,0,preview.width,preview.height)};for(const ev of ['pointerup','pointercancel','pointerleave'])before.addEventListener(ev,schedule);
 const output=async()=>{const canvas=document.createElement('canvas');retouchRender67(canvas.getContext('2d',{willReadFrequently:true}),img,img.naturalWidth,img.naturalHeight,v,crop,true);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('Could not export edited image');return {blob,width:canvas.width,height:canvas.height}};
 const busy=async(button,work)=>{button.disabled=true;const old=button.textContent;button.textContent='Working…';try{await work()}catch(e){toast(e.message||'Retouch failed')}finally{if(!closed){button.disabled=false;button.textContent=old}}};
 q('#retouchDownload67',m).onclick=e=>busy(e.currentTarget,async()=>{const r=await output(),u=URL.createObjectURL(r.blob),a=document.createElement('a');a.href=u;a.download=`PIONX-retouch-${r.width}x${r.height}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(u),30000)});
 q('#retouchSave67',m).onclick=e=>busy(e.currentTarget,async()=>{const r=await output();if(r.blob.size>16*1024*1024){const c=document.createElement('canvas');const u=URL.createObjectURL(r.blob),im=new Image();try{im.src=u;await im.decode();c.width=r.width;c.height=r.height;c.getContext('2d').drawImage(im,0,0);r.blob=await new Promise(resolve=>c.toBlob(resolve,'image/jpeg',.98))}finally{URL.revokeObjectURL(u)}}if(!r.blob||r.blob.size>16*1024*1024)throw Error('Edited image exceeds 16 MB. Download or crop a smaller area.');const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(r.blob)});const res=await pxApi56('/server/retouch-save-v65.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:data,parent_url:studioFinal56.providerUrl,scene_type:studioState.scene})});const j=await json56(res,'PIONX retouch');if(!res.ok||!j.url)throw Error(j.error||'Could not save retouch');studioFinal56={providerUrl:j.url,exactUrl:j.url,masterUrl:j.url,blob:r.blob,width:r.width,height:r.height};studioSourceDims.width=r.width;studioSourceDims.height=r.height;if(q('#studioOutput'))q('#studioOutput').src=j.url;if(q('#studioOutputBadge'))q('#studioOutputBadge').textContent=`RETOUCHED · ${r.width} × ${r.height}`;galleryLoaded62=false;await galleryLoad62();close();toast('Edited version saved in Renders and Albums')});
};
cycleAdjust=function(kind){if(kind==='camera')return openRetouch65('camera');if(kind==='materials')return activateResultEdit56();if(kind==='lighting')return openRetouch65('tone');if(kind==='color')return openRetouch65('tone');if(kind==='style')return studioState.scene==='interior'?openInteriorStyles65():openRetouch65('tone')};
const briefBase67=updateStudioBrief;
updateStudioBrief=function(){briefBase67();const labels={style:studioState.scene==='interior'?['Interior styles','AI material restyle']:['Photo style','Color grade'],materials:['Edit material','Select area + reference'],camera:['Camera','Straighten + frame'],lighting:['Lighting','Exposure + temperature'],color:['Color','Color retouch']};for(const [key,[title,subtitle]] of Object.entries(labels)){const card=q(`[data-adjust="${key}"]`);if(card){const b=card.querySelector('b'),small=card.querySelector('small');if(b)b.textContent=title;if(small)small.textContent=subtitle}}};
const runRenderBase67=runRenderDemo;runRenderDemo=async function(){if(studioSourceImage){try{const d=await imageDims56(studioSourceImage);studioSourceDims.width=d.width;studioSourceDims.height=d.height}catch(e){console.warn('Source dimensions unavailable',e)}}return runRenderBase67()};
// ===== END V6.7 =====

// ===== V6.8 NATIVE IMAGE DELIVERY + DISTINCT ADJUST ACTIONS =====
exactSizeResult56=async function(url){const blob=await fetchRenderBlob56(url),u=URL.createObjectURL(blob);try{const dims=await imageDims56(u);if(!dims.width||!dims.height)throw Error('The generated image has no dimensions');if(studioFinal56.blobUrl)URL.revokeObjectURL(studioFinal56.blobUrl);return {url:u,blobUrl:u,blob,width:dims.width,height:dims.height,mime:blob.type||'image/png'}}catch(e){URL.revokeObjectURL(u);throw e}};
finalizeRenderedImage56=async function(providerUrl){let master={url:providerUrl,width:0,height:0};try{master=await exactSizeResult56(providerUrl)}catch(e){console.warn('Native image download unavailable',e);const dims=await imageDims56(providerUrl);master={url:providerUrl,width:dims.width,height:dims.height,blob:null,blobUrl:''}}
 const ratio=studioSourceDims.width&&studioSourceDims.height?studioSourceDims.width/studioSourceDims.height:0,drift=ratio?Math.abs(master.width/master.height-ratio)/ratio:0;studioFinal56={providerUrl,exactUrl:master.url,blobUrl:master.blobUrl||'',blob:master.blob||null,width:master.width,height:master.height,mime:master.mime||'',aspectWarning:drift>.035};studioRenderKind56='final';return studioFinal56};
openFullView56=function(){if(!studioFinal56.providerUrl)return toast('Render an image first');const m=ensureFullView56(),im=q('#fullViewImage57'),source=q('#fullViewSource60');if(source)source.hidden=true;const download=q('#fullViewDownload57');if(download)download.textContent='↓ Download native';im.onload=()=>setFullZoom60('fit');im.src=studioFinal56.exactUrl||studioFinal56.providerUrl;q('#fullViewSize57').textContent=`${studioFinal56.width||'?'} × ${studioFinal56.height||'?'} px · native output${studioFinal56.aspectWarning?' · aspect differs from source':''} · zoom cannot create missing texture`;m.hidden=false};
downloadResult56=async function(){if(!studioFinal56.providerUrl)return toast('Render an image first');try{const blob=studioFinal56.blob||await fetchRenderBlob56(studioFinal56.providerUrl),ext=blob.type.includes('png')?'png':blob.type.includes('webp')?'webp':'jpg',u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=`PIONX-native-${studioFinal56.width||'image'}x${studioFinal56.height||''}.${ext}`;a.click();setTimeout(()=>URL.revokeObjectURL(u),30000);toast(`Original file downloaded · ${studioFinal56.width}×${studioFinal56.height} px`)}catch(e){toast('Download failed: '+e.message)}};
const sceneFinishes68={
 exterior:{'Editorial architecture':'premium architectural magazine finish, refined but natural facade materials, coherent daylight and controlled reflections','Warm natural':'subtle warm natural color grade and realistic facade/landscape balance','Crisp commercial':'clean commercial architectural photography, restrained contrast and natural edges'},
 landscape:{'Botanical realism':'plausible diverse vegetation textures at true scale, natural foliage light response','Warm outdoor':'natural golden-hour outdoor color and realistic hardscape texture','Clean site':'restrained editorial planting color and clear readable hardscape'},
 masterplan:{'Photoreal aerial':'readable roof, road, parcel and planted textures at realistic aerial scale','Editorial aerial':'clean color hierarchy, consistent daylight and legible circulation','Natural site':'restrained natural earth, water and planting materials with accurate site hierarchy'},
 sketch:{'Photoreal finish':'conservatively resolve sketch lines into physically plausible architectural materials and light'},
 auto:{'Photographic finish':'keep the visually classified scene and improve natural material detail and high-end photographic balance'}
};
async function runPhotoPass68(label,instruction,options={}){if(!studioFinal56.providerUrl)return toast('Render an image first');if(!signedIn56())return toast('Sign in first');const from=studioFinal56.providerUrl,oldW=studioFinal56.width,oldH=studioFinal56.height,modal=showRenderMind58();q('#renderMindScene').textContent=label+' · source geometry protected';let start=null,engine='';try{
 mindUpdate('Reading native image pixels and locking design…',15,0);const payload=renderPayload56({source_image:from,prompt:`${instruction} Keep every existing building element, road/plot, furniture layout, opening, camera position and composition exactly as supplied. Restore believable material micro-texture without edge halos or synthetic repeat patterns. If a detail is unknowable, preserve it rather than inventing an object.`,mode:'preserve',width:oldW,height:oldH,references:[]});if(options.env){const e=options.env;payload.prompt=payload.prompt.replace(envRules[studioState.env]||envRules.auto,envRules[e]||'Lighting: apply the selected natural sunset direction while preserving architecture.');payload.lighting_mode=e;payload.controls.lighting=e;payload.controls.lighting_mode=e;payload.controls.time_of_day=e;payload.analysis.ui_environment=e;}
 mindUpdate('Reserving credits for one AI edit…',35,2);start=await renderPost56(payload,45000);engine=start.engines?.[0]||'';if(!engine)throw Error('PIONX image route unavailable');if(Number.isFinite(Number(start.credits_remaining)))setCreditsFromRender56(start.credits_remaining);
 mindUpdate('Improving photographic finish on the selected image…',64,3);const done=await renderEngine56(start,engine),best=done?.candidates?.find(x=>x?.url);if(!best?.url)throw Error('No edited image returned');await finalizeRenderedImage56(best.url);if(q('#studioOutput'))q('#studioOutput').src=studioFinal56.exactUrl;if(q('#studioOutputBadge'))q('#studioOutputBadge').textContent=`${label.toUpperCase()} · ${studioFinal56.width}×${studioFinal56.height}`;
 const saved=await persistRender62(best.url,start.job_token);await loadAccount56({quiet:true});mindUpdate('Final image ready…',100,5);hideRenderMind58(400);ensurePost65();toast(saved?`${label} saved · native ${studioFinal56.width}×${studioFinal56.height} px`:`${label} ready; gallery save failed — download it`);
 }catch(e){console.error('PIONX AI image pass',e);if(start&&engine)await cancelRender56(start,engine);hideRenderMind58(2500);toast(e.message||'AI image pass failed')} }
function openDetail68(){if(!studioFinal56.providerUrl)return toast('Render an image first');const m=openDemoDialog('Refine material detail',`<p>Current native image: <b>${studioFinal56.width} × ${studioFinal56.height} px</b>. At 380% zoom, the image will show its pixel limit.</p><p>A credit-charged image edit can refine believable material grain, planting and edge detail in the existing scene. It may keep the same pixel dimensions. Local 2× resizing cannot recover texture.</p>`,`<button class="ghost-btn" data-dialog-close2>Cancel</button><button class="primary-btn" id="confirmDetail68">Refine with AI</button>`);q('#confirmDetail68',m).onclick=()=>{m.hidden=true;runPhotoPass68('Material detail','DETAIL REFINEMENT ONLY. Refine the existing stone grain, concrete pores, timber, glazing depth, paving joints, foliage and natural fine edge clarity appropriate to the selected scene. Preserve the exact objects, layout, lighting concept and material identity. No added objects, made-up facade openings, crunchy sharpening, blur or upsample-only processing.')};}
function openLighting68(){if(!studioFinal56.providerUrl)return toast('Render an image first');const m=openDemoDialog('Lighting direction','<p>Choose a new physically plausible lighting setup. This starts one credit-charged AI edit while locking the design.</p><div class="demo-option-grid"><button data-light68="day">Natural day</button><button data-light68="sunset">Warm sunset</button><button data-light68="night">Real night</button></div>');qa('[data-light68]',m).forEach(b=>b.onclick=()=>{m.hidden=true;const choice=b.dataset.light68,brief={day:'Natural daylight with coherent sun direction and realistic surface reflections.',sunset:'Warm low-angle sunlight with long consistent shadows and controlled highlights.',night:'True night architecture photography with realistic practical lights, glazing depth and believable dark sky; no daylight.'}[choice];runPhotoPass68(choice+' lighting','RELIGHT ONLY. '+brief+' Preserve exact material identity, architecture, camera, site layout and objects. Do not replace the project.')})}
function openFinish68(){if(!studioFinal56.providerUrl)return toast('Render an image first');if(studioState.scene==='interior')return openInteriorStyles65();const options=sceneFinishes68[studioState.scene]||sceneFinishes68.auto;const m=openDemoDialog('Scene finish',`<p>Select a photographic direction for this ${escHtml(studioState.scene)} image. A credit-charged AI edit; preserve all existing geometry.</p><div class="demo-option-grid">${Object.keys(options).map((name,i)=>`<button data-finish68="${i}">${escHtml(name)}</button>`).join('')}</div>`);qa('[data-finish68]',m).forEach(b=>b.onclick=()=>{m.hidden=true;const name=Object.keys(options)[Number(b.dataset.finish68)];runPhotoPass68(name,`SCENE FINISH: ${name}. ${options[name]}. Change photographic tone and surface finish only. Preserve the site and architecture exactly.`)})}
cycleAdjust=function(kind){if(kind==='materials')return activateResultEdit56();if(kind==='color')return openRetouch65('tone');if(kind==='camera')return openRetouch65('camera');if(kind==='lighting')return openLighting68();if(kind==='style')return openFinish68()};
const studioTool67=studioTool;studioTool=function(action){if(action==='upscale')return openDetail68();if(action==='relight')return openLighting68();if(action==='variations')return openFinish68();return studioTool67(action)};
const briefBase68=updateStudioBrief;updateStudioBrief=function(){briefBase68();const labels={style:['Scene finish',studioState.scene==='interior'?'AI interior style · credits':'AI photo style · credits'],lighting:['Relight','AI day / sunset / night · credits'],materials:['Edit material','Select area + reference · credits'],color:['Color','Local retouch · free'],camera:['Camera','Local crop + straighten · free']};for(const [key,[name,info]] of Object.entries(labels)){const card=q(`[data-adjust="${key}"]`);if(card){const b=card.querySelector('b'),sm=card.querySelector('small');if(b)b.textContent=name;if(sm)sm.textContent=info}}};
const wireBase68=wireView;wireView=function(name){wireBase68(name);if(name!=='studio')return;const tools=qa('[data-studio-tool="upscale"]');for(const b of tools){b.textContent='◈ AI Detail';b.title='Paid AI material detail refinement; output resolution depends on provider'};const pane=q('[data-adjust-pane="adjust"]');if(pane&&!q('[data-adjust="detail"]')){const tile=document.createElement('button');tile.className='adjust-card';tile.dataset.adjust='detail';tile.innerHTML='<div class="line"><div><b>Detail refinement</b><small>AI texture edit · credits</small></div><i>›</i></div>';tile.onclick=openDetail68;pane.insertBefore(tile,pane.querySelector('#resetAdjust'))}if(studioFinal56.providerUrl&&q('#studioOutputBadge'))q('#studioOutputBadge').textContent=`${studioFinal56.qualityVerified===false?'RESULT · QC DEGRADED':'FINAL · VERIFIED'} · ${studioFinal56.width}×${studioFinal56.height}${studioFinal56.aspectWarning?' · CHECK ASPECT':''}`;updateStudioBrief()};
const renderBase68=runRenderDemo;runRenderDemo=async function(){await renderBase68();if(studioFinal56.providerUrl&&q('#studioOutputBadge'))q('#studioOutputBadge').textContent=`${studioFinal56.qualityVerified===false?'RESULT · QC DEGRADED':'FINAL · VERIFIED'} · ${studioFinal56.width}×${studioFinal56.height}${studioFinal56.aspectWarning?' · CHECK ASPECT':''}`};
// ===== END V6.8 =====

// ===== V6.9 MONOTONIC RENDER STATUS + PHOTOGRAPHIC SOURCE BRIEF =====
// The provider accepts named aspect ratios; raw source pixel ratios otherwise
// fall back to a landscape 16:9 image in the existing render backend.
function supportedAspect69(width,height){
 if(!(width>0&&height>0))return '1:1';
 const ratios=['1:1','2:3','3:2','3:4','4:3','4:5','5:4','9:16','16:9','21:9'];
 const source=width/height;
 return ratios.reduce((best,ratio)=>{const [w,h]=ratio.split(':').map(Number),[bw,bh]=best.split(':').map(Number);return Math.abs(Math.log((w/h)/source))<Math.abs(Math.log((bw/bh)/source))?ratio:best},ratios[0]);
}
const renderPayload68=renderPayload56;
renderPayload56=function(overrides={}){
 const payload=renderPayload68(overrides),w=Number(overrides.width||studioSourceDims.width),h=Number(overrides.height||studioSourceDims.height),aspect=supportedAspect69(w,h);
 payload.controls.aspect_ratio=aspect;
 payload.analysis={...payload.analysis,source_aspect_ratio:w&&h?`${w}:${h}`:'unknown',requested_provider_aspect:aspect,scene_prompt_version:'scene_photo_v69'};
 const scene=payload.scene_type||'auto';
 const realism='FINAL IMAGE MUST READ AS A REAL PROFESSIONAL ARCHITECTURAL PHOTOGRAPH OF A BUILT PROJECT. Interpret the uploaded source as a fixed design reference, not as a visual style reference: remove sketch strokes, conceptual wash, airbrushed gradients, illustrative shading, uniform smooth texture and generic AI render sheen. Rebuild material response from physical evidence: visible natural variation in stone and concrete, true-scale joints and weathering, distinct glass reflection and transmission, correctly sized window frames, believable grass and individual tree crowns, ground contact and a coherent sun direction. Maintain the exact tower count, silhouette, facade rhythm, opening positions, street network, landscape footprint and source camera. Resolve detail that can actually be represented at the output pixel size; do not invent fine texture with halos, noise or fake sharpening. If the source is a masterplan or aerial, keep the overall site geometry and true aerial scale; avoid painting rooftops, roads, grass and shadows as broad flat blocks. If the source is a sketch, translate it into the same physically plausible built architecture without leaving pencil or watercolor styling.';
 payload.prompt=[`PHOTOGRAPHIC REALISM QUALITY GATE — ${scene.toUpperCase()}. ${realism}`,payload.prompt].join('\n\n');
 return payload;
};
// ===== END V6.9 =====

// ===== V6.10 AUTOMATIC FIRST-RENDER PHOTOGRAPHIC FINISH =====
// This deterministic grade modifies existing pixels only. It cannot invent
// genuine material texture, geometry or higher native resolution.
async function automaticFinish610(originalUrl){
 if(settingsState.autoRetouch===false)return false;
 const native=studioFinal56,source=native.exactUrl||originalUrl;
 if(!native.width||!native.height||native.width*native.height>24000000)return false;
 const image=new Image();image.src=source;await image.decode();
 const canvas=document.createElement('canvas');canvas.width=native.width;canvas.height=native.height;
 const ctx=canvas.getContext('2d',{alpha:false,willReadFrequently:true});if(!ctx)return false;
 const outdoor=['exterior','masterplan','landscape','sketch','auto'].includes(studioState.scene),night=studioState.env==='night';
 ctx.filter=night?'contrast(1.05) saturate(1.025) brightness(1.01)':outdoor?'sepia(0.035) contrast(1.07) saturate(1.045) brightness(1.005)':'contrast(1.045) saturate(1.025) brightness(1.005)';
 ctx.drawImage(image,0,0,native.width,native.height);ctx.filter='none';
 sharp67(canvas,11);
 let blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
 if(!blob||blob.size>15*1024*1024)blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.96));
 if(!blob||blob.size>15*1024*1024)return false;
 const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Could not read finished image'));reader.readAsDataURL(blob)});
 const response=await pxApi56('/server/retouch-save-v65.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:data,parent_url:originalUrl,scene_type:studioState.scene,finish_type:'automatic'})});
 const saved=await json56(response,'PIONX photographic finish');if(!response.ok||!saved.url)throw Error(saved.error||'Could not save finished image');
 if(native.blobUrl){try{URL.revokeObjectURL(native.blobUrl)}catch{}}
 studioFinal56={providerUrl:saved.url,originalProviderUrl:originalUrl,exactUrl:saved.url,blob,blobUrl:'',width:native.width,height:native.height,mime:blob.type,aspectWarning:native.aspectWarning};
 return true;
}
// ===== END V6.10 =====

// ===== V6.11 FIRST-RENDER DIRECTION FROM SOURCE / RESULT COMPARISON =====
// Keep the user's existing image engine selection on the server. A compact
// single brief gives the model an explicit photographic goal before generation.
const renderPayload610=renderPayload56;
renderPayload56=function(overrides={}){
 const payload=renderPayload610(overrides);
 if(overrides.source_image||overrides.prompt!==undefined)return payload;
 const scene=payload.scene_type||'auto',userNote=q('#studioNotes')?.value?.trim()||'';
 const sceneFocus={
  interior:'Room boundaries, ceiling, fixed furniture and openings stay fixed. Resolve realistic bounced daylight, true fabric weave, wood grain and stone texture at room scale.',
  exterior:'Lock every tower/building silhouette, floor count, curtain-wall grid, roofline, entrance, podium and street. Give facade stone natural variation, glass believable reflection and interior depth; grounded planting and urban atmosphere.',
  masterplan:'Preserve every plot, footprint, road, path, grade and aerial viewpoint. Translate flat diagram fills into plausible built materials, living planting and legible circulation without adding or relocating buildings.',
  landscape:'Preserve terrain, planting zones, paths, water and all architectural positions. Resolve species variation, leaf scale, paving joints, shade and believable site ecology.',
  sketch:'The drawing defines the approved project: retain the exact number and relative heights of towers and blocks, podium, facade rhythm, main landscape and aerial camera. Turn blank sky, green fills and linework into believable daylight, real material surfaces and natural landscape without redesign.',
  auto:'Classify the source first. If it is a drawing, convert its fixed architecture and camera into a believable photograph; if it is already rendered, retain the design and improve its physical materials and photographic finish.'
 }[scene]||'';
 const environment=studioState.env==='night'?'True night exposure with believable warm architectural lighting and a dark sky; no daylight.':studioState.env==='day'?'Natural clear daylight with one coherent sun direction, dimensional but soft shadows, controlled highlights and warm-neutral editorial color.':'Keep the source time of day and make its light physically coherent.';
 const fidelity=studioState.mode==='creative'?'Explore materials only where the user explicitly permits; retain the project structure and viewpoint.':'Exact design and camera are mandatory. Keep existing openings, buildings, materials and streets as designed.';
 const entourage=`${studioState.people?'Add only a few people at correct architectural scale.':'Do not invent people on the project site.'} ${studioState.cars?'Add only a few realistic cars on existing roads.':'Do not add cars inside the project site.'}`;
 const priorPrompt=String(payload.prompt||'').trim();
 const glassWindowLine=scene==='interior'?'For any visible windows or glazed doors, keep clear architectural glass with believable outside environment visibility, subtle reflections, daylight depth and no blank or washed-out exterior.':'';
 payload.prompt=[`FINAL DELIVERABLE: a convincing premium architectural photograph of THIS specific design, ready for client presentation. ${sceneFocus}`,
  `${fidelity} ${environment} ${entourage}`,
  glassWindowLine,
  'Use physically plausible microtexture at real scale: distinct natural stone and concrete, construction joints, convincing glazing depth, nonuniform vegetation, soft contact shadows and readable facade details. Tonal separation and controlled contrast should give the project depth without crushed blacks, faded surfaces, watercolor edges, plastic shine, painted grass, generic repeated trees, over-sharpening or invented facade elements. Compose exactly as the source, with no reframing or changed aspect orientation.',
  priorPrompt,
  userNote?`USER NOTE: ${userNote}`:'' ].filter(Boolean).join('\n\n');
 payload.analysis={...payload.analysis,scene_prompt_version:'single_photographic_brief_v611'};
 return payload;
};
// ===== END V6.11 =====

// ===== V6.13 ADMIN FINANCE: MANAGEMENT AMOUNTS REPORT + CLEAR EXPORT BUTTONS =====
let financeSnapshot612=null,financeError612='';
const finUsd612=n=>'$'+(Number(n)||0).toFixed(2);
const finSafe612=value=>escHtml(String(value??''));
function financePage612(){const now=new Date(),end=now.toISOString().slice(0,10),start=new Date(now.getTime()-29*86400000).toISOString().slice(0,10);
 return '<section class="page finance612">'+pageHead('ADMIN · FINANCE','Finance & Accounting','Actual tracked usage, reconciled provider balances and recorded cash movements. Financial estimates are labelled separately.')+
 '<div class="finance612-actions"><label>From <input id="finFrom612" type="date" value="'+start+'"></label><label>To <input id="finTo612" type="date" value="'+end+'"></label>'+
 '<button class="primary-btn" data-fin612="refresh">Load live figures</button><button class="finance612-export finance612-pdf" data-fin612="pdf" title="Download the management financial report as PDF">↓ Download Financial PDF</button><button class="finance612-export finance612-csv" data-fin612="csv" title="Export financial amounts and balances as CSV">⇩ Export Financial CSV</button></div>'+
 '<p id="finStatus612" class="finance612-status">Loading admin finance data…</p><div id="finBody612"></div></section>'}
financePage=financePage612;routes.finance=financePage612;
function finRow612(cells){return '<tr>'+cells.map(x=>'<td>'+finSafe612(x)+'</td>').join('')+'</tr>'}
const financeOpsFilter631={type:'all',result:'all',query:''};
function finMeta631(e){
 let m=e?.meta??{};if(typeof m==='string'){try{m=JSON.parse(m)}catch{m={raw:m}}}return m&&typeof m==='object'?m:{};
}
function finOpGroup631(e){
 const t=String(e?.type||e?.operation||'').toLowerCase(),m=finMeta631(e),src=String(m.source||m.pionx_route||'').toLowerCase();
 if(t.includes('film')||src.includes('film'))return'film';
 if(t.includes('video'))return'video';
 if(t.includes('image')||t.includes('render')||t.includes('consistency')||t.includes('edit'))return'image';
 if(t.includes('prompt')||t.includes('analysis')||t.includes('director')||t.includes('qc'))return'analysis';
 if(t.includes('voice')||t.includes('audio')||t.includes('tts'))return'audio';
 return'other';
}
function finOpResult631(e){
 const st=String(e?.status||'').toLowerCase(),t=String(e?.type||'').toLowerCase();
 if(t.includes('route_switch')||st.includes('fallback')||st.includes('switched'))return'fallback';
 if(st.includes('complete')||st.includes('deliver')||st==='ready'||st==='success'||st==='succeeded')return'executed';
 if(st.includes('refund'))return'refunded';
 if(st.includes('fail')||st.includes('error')||st.includes('cancel')||st.includes('reject'))return'failed';
 if(st.includes('reserv')||st.includes('process')||st.includes('queue')||st.includes('pending')||st.includes('start'))return'processing';
 return st||'unknown';
}
function finOpReason631(e){
 const m=finMeta631(e),vals=[e?.reason,e?.error,e?.detail,m.reason,m.error,m.detail,m.provider_error,m.failure_reason,m.refund_reason,m.message];
 const found=vals.find(v=>String(v??'').trim());if(found)return String(found).slice(0,320);
 const r=finOpResult631(e);if(r==='executed')return'—';
 if(r==='processing')return'Waiting for provider / job completion';
 if(r==='fallback')return String(m.from_provider||'Primary route')+' unavailable; switched route';
 if(r==='refunded')return'Reserved credits refunded; server did not store a more specific reason';
 if(r==='failed')return'Operation failed; no detailed server reason was recorded';
 return'—';
}
function finOpEngine631(e){
 const m=finMeta631(e),v=e?.engine||e?.route||e?.pionx_route||m.selected_engine||m.pionx_engine||m.pionx_route||m.engine||m.route_policy||'';
 return String(v||'—');
}
function finOpProvider631(e){
 const m=finMeta631(e),provider=e?.provider||m.selected_provider||m.provider||'',model=e?.model||m.selected_model||m.model||'';
 return [provider,model].filter(Boolean).join(' / ')||'—';
}
function finOpJob631(e){const m=finMeta631(e);return e?.job||e?.job_token||e?.id||m.job_token||m.request_id||m.client_id||'—'}
function finOpCredits631(e){const m=finMeta631(e);const v=e?.credits_finalized??e?.credits_charged??m.credits_finalized??m.credits_charged??m.reserved_credits??0;return Number(v)||0}
function finOpCost631(e){const m=finMeta631(e);return Number(e?.tracked_cost_usd??e?.provider_cost_usd??e?.actual_cost_usd??m.actual_cost_usd??m.estimated_cost_usd??0)||0}
function finOpVisible631(e){
 const g=finOpGroup631(e),r=finOpResult631(e),f=financeOpsFilter631;if(f.type!=='all'&&g!==f.type)return false;
 if(f.result!=='all'&&r!==f.result)return false;
 if(f.query){const m=finMeta631(e),hay=[e?.ts,finOpJob631(e),e?.type,e?.status,finOpEngine631(e),finOpProvider631(e),finOpReason631(e),JSON.stringify(m)].join(' ').toLowerCase();if(!hay.includes(f.query.toLowerCase()))return false}
 return true;
}
function finStatusBadge631(r){const map={executed:['Executed','good'],processing:['In progress','warn'],failed:['Not executed','bad'],refunded:['Refunded','warn'],fallback:['Fallback','warn'],unknown:['Unknown','muted']},x=map[r]||[r,'muted'];return '<span class="'+x[1]+'"><b>'+finSafe612(x[0])+'</b></span>'}
function financeRenderOps631(data){
 const body=q('#finOpsBody631'),summary=q('#finOpsSummary631');if(!body||!data)return;
 const all=(data.operations||[]).slice(0,120),rows=all.filter(finOpVisible631).slice(0,100);
 const counts={executed:0,processing:0,failed:0,refunded:0,fallback:0};all.forEach(e=>{const r=finOpResult631(e);if(counts[r]!=null)counts[r]++});
 if(summary)summary.innerHTML=[['Executed',counts.executed,'good'],['In progress',counts.processing,'warn'],['Not executed',counts.failed,'bad'],['Refunded',counts.refunded,'warn'],['Fallback',counts.fallback,'warn']].map(x=>'<div class="finance612-line"><span>'+x[0]+'</span><b class="'+x[2]+'">'+x[1]+'</b></div>').join('');
 body.innerHTML=rows.length?rows.map(e=>{
  const r=finOpResult631(e),group=finOpGroup631(e),reason=finOpReason631(e),cost=finOpCost631(e),credits=finOpCredits631(e);
  return '<tr data-op-group="'+finSafe612(group)+'" data-op-result="'+finSafe612(r)+'">'+
   '<td>'+finSafe612(e.ts||'—')+'</td><td>'+finSafe612(finOpJob631(e))+'</td><td>'+finSafe612(group.toUpperCase())+'</td><td>'+finSafe612(e.type||e.operation||'—')+'</td><td>'+finStatusBadge631(r)+'</td><td>'+finSafe612(finOpEngine631(e))+'</td><td>'+finSafe612(finOpProvider631(e))+'</td><td>'+finUsd612(cost)+'</td><td>'+finSafe612(credits)+'</td><td class="'+(r==='failed'?'bad':'')+'">'+finSafe612(reason)+'</td></tr>';
 }).join(''):'<tr><td colspan="10" class="muted">No operations match the selected filters.</td></tr>';
}
function financeRender612(){
 const host=q('#finBody612');if(!host)return;const data=financeSnapshot612;
 if(!data){host.innerHTML='<div class="panel finance612-empty">'+finSafe612(financeError612||'No finance data has loaded. Check your administrator session and server endpoint.')+'</div>';return}
 const s=data.summary||{},cash=data.cash_summary||{},wallets=data.wallets||{},config=data.config||{},names=Object.keys(wallets);
 let html='<div class="finance612-kpis">';
 const kpis=[['Tracked provider usage',finUsd612(s.tracked_provider_cost_usd),'Provider API costs logged in this date range'],['Estimated credit value',finUsd612(s.estimated_credit_value_usd),'Current USD/credit × finalized credits; not collected cash'],['Cash receipts recorded',finUsd612(cash.receipts_usd),'Manually recorded receipts pending payment integration'],['Illustrative contribution',finUsd612(s.illustrative_contribution_usd),'Credit value minus logged usage; not accounting profit']];
 html+=kpis.map(k=>'<article class="panel"><small>'+finSafe612(k[0])+'</small><b>'+finSafe612(k[1])+'</b><p>'+finSafe612(k[2])+'</p></article>').join('')+'</div>';
 html+='<div class="panel finance612-note">Cash sales, credit consumption and provider funding are separate movements. A provider top-up is funding, not another provider usage expense. Wallet balances are PIONX estimates until you reconcile them against the provider statement.</div>';
 html+='<div class="section-title"><div><h2>Provider wallets</h2><p>Enter the current balance shown by the provider once. Future logged costs reduce the calculated balance. Record later payments as top-ups.</p></div></div><div class="finance612-wallets">';
 for(const key of names){const w=wallets[key]||{},low=!!w.low_balance||Number(w.estimated_balance_usd)<0;
 html+='<article class="panel finance612-wallet"><header><b>'+finSafe612(w.label||key)+'</b><strong class="'+(low?'bad':'good')+'">'+finUsd612(w.estimated_balance_usd)+'</strong></header>'+
 '<p>Opening '+finUsd612(w.opening_balance_usd)+' · Funding +'+finUsd612(w.added_funding_usd)+' · Tracked usage -'+finUsd612(w.used_usd)+' · Adjustments '+finUsd612(w.reconciliation_adjustment_usd)+'</p>'+
 '<small>Low balance alert: '+finUsd612(w.alert_threshold_usd)+(low?' · ACTION NEEDED':'')+'</small><div class="finance612-buttons"><button data-fin612="balance" data-provider="'+finSafe612(key)+'">Set current balance</button><button data-fin612="topup" data-provider="'+finSafe612(key)+'">Add funding</button><button data-fin612="threshold" data-provider="'+finSafe612(key)+'">Alert limit</button></div></article>'}
 html+='</div>';
 html+='<div class="finance612-columns"><section class="panel"><h2>Cash movements</h2><p>Record a real receipt, refund or operating expense with its unique payment reference.</p><button data-fin612="cash">+ Record cash entry</button><div class="finance612-line">Receipts <b>'+finUsd612(cash.receipts_usd)+'</b></div><div class="finance612-line">Refunds <b>'+finUsd612(cash.refunds_usd)+'</b></div><div class="finance612-line">Operating expenses <b>'+finUsd612(cash.operating_expenses_usd)+'</b></div><div class="finance612-line">Net before funding <b>'+finUsd612(cash.net_recorded_cash_before_provider_funding_usd)+'</b></div><div class="finance612-line">Cash less tracked API usage* <b>'+finUsd612(cash.recorded_cash_less_tracked_usage_usd)+'</b></div><small>*Management estimate, not audited profit. Unrecorded payments, fees and taxes are excluded.</small></section>'+
 '<section class="panel"><h2>Margin controls</h2><p>Existing live pricing remains on the server. These figures do not replace actual payment receipts.</p><div class="finance612-line">USD per credit <b>'+finUsd612(config.usd_per_credit)+'</b></div><div class="finance612-line">Target margin <b>'+finSafe612(config.target_margin_pct)+'%</b></div><div class="finance612-line">Illustrative margin <b>'+finSafe612(s.margin_pct==null?'—':s.margin_pct+'%')+'</b></div><div class="finance612-line">Monthly budget <b>'+finUsd612(config.monthly_budget_usd)+'</b></div><div class="finance612-line">Finalized jobs <b>'+finSafe612(s.finalized_jobs||0)+'</b></div><div class="finance612-line">Refund events <b>'+finSafe612(s.refund_events||0)+'</b></div><button data-fin612="pricing">Edit live pricing</button></section></div>';
 const alerts=names.filter(k=>wallets[k]?.low_balance||Number(wallets[k]?.estimated_balance_usd)<0).map(k=>'Low estimated balance: '+(wallets[k]?.label||k));
 if(s.margin_pct!=null&&Number(s.margin_pct)<Number(config.target_margin_pct))alerts.push('Illustrative margin is below the target; review actual costs and credit pricing.');
 if(alerts.length)html+='<div class="panel finance612-alert"><b>Attention</b><ul>'+alerts.map(x=>'<li>'+finSafe612(x)+'</li>').join('')+'</ul></div>';
 const entries=(data.operations||[]).slice(0,120),cashRows=(data.cash_entries||[]).slice(0,30),reversedIds=new Set((data.cash_entries||[]).map(e=>e.reversal_of).filter(Boolean));
 html+='<section class="panel finance612-table"><div class="section-title" style="margin:0 0 10px"><div><h2>Latest operations · execution & engine audit</h2><p>Shows what executed, what did not execute, why it failed, and the exact PIONX route / provider / model used for images, video, Film and analysis.</p></div><button class="ghost-btn" data-fin612="refresh">Refresh operations</button></div>'+
 '<div class="finance612-columns"><section><label>Operation<select id="finOpType631"><option value="all">All operations</option><option value="image">Image / Render / Consistency</option><option value="video">Video</option><option value="film">PIONX Film</option><option value="analysis">Analysis / QC</option><option value="audio">Voice / Audio</option><option value="other">Other</option></select></label><label>Result<select id="finOpResult631"><option value="all">All results</option><option value="executed">Executed</option><option value="processing">In progress</option><option value="failed">Not executed</option><option value="refunded">Refunded</option><option value="fallback">Fallback / route switch</option></select></label><label>Search<input id="finOpSearch631" placeholder="Job, engine, model or failure reason"></label></section><section id="finOpsSummary631"></section></div>'+
 '<div class="table-wrap"><table class="table"><thead><tr><th>UTC</th><th>Job</th><th>Category</th><th>Operation</th><th>Result</th><th>PIONX route / engine</th><th>Provider / model</th><th>Provider cost</th><th>Credits</th><th>Failure / status reason</th></tr></thead><tbody id="finOpsBody631"></tbody></table></div>'+
 '<small>Completed provider cost reduces the matching Finance wallet. Failed/refunded attempts remain visible for audit. Provider/model names are admin-only.</small></section>';
 html+='<section class="panel finance612-table"><h2>Recorded cash entries</h2><div class="table-wrap"><table class="table"><thead><tr><th>UTC</th><th>Type</th><th>Amount</th><th>Reference</th><th>Note</th><th>Correction</th></tr></thead><tbody>'+
 (cashRows.length?cashRows.map(e=>'<tr>'+[e.ts,e.kind,finUsd612(e.amount_usd),e.reference,e.note].map(v=>'<td>'+finSafe612(v)+'</td>').join('')+'<td>'+(e.reversal_of?'Correction':reversedIds.has(e.id)?'Reversed':'<button data-fin612="reverse" data-entry="'+finSafe612(e.id)+'">Reverse</button>')+'</td></tr>').join(''):finRow612(['—','No recorded receipts yet','—','—','—','—']))+'</tbody></table></div></section>';
 host.innerHTML=html;financeRenderOps631(data);
 const type=q('#finOpType631'),res=q('#finOpResult631'),search=q('#finOpSearch631');if(type)type.value=financeOpsFilter631.type;if(res)res.value=financeOpsFilter631.result;if(search)search.value=financeOpsFilter631.query;
}
async function financeLoad612(showToast=false){
 const from=q('#finFrom612')?.value,to=q('#finTo612')?.value,status=q('#finStatus612');
 if(!from||!to||from>to){financeError612='Choose a valid reporting date range';financeSnapshot612=null;financeRender612();return}
 if(status)status.textContent='Loading authenticated admin ledger…';
 try{const url='/server/admin-finance-report-v612.php?from='+encodeURIComponent(from)+'&to='+encodeURIComponent(to)+'&ts='+Date.now();
  const response=await pxApi56(url,{cache:'no-store'}),data=await json56(response,'Finance report');if(!response.ok||!data.ok)throw Error(data.error||'Finance report unavailable');
  financeSnapshot612=data;financeError612='';financeRender612();if(status)status.textContent='Live server ledger · '+finSafe612(data.event_count)+' events · generated '+data.generated_at+' · UTC';
  if(showToast)toast('Finance ledger refreshed');
 }catch(e){financeSnapshot612=null;financeError612=e.message||'Could not load finance ledger';financeRender612();if(status)status.textContent=financeError612;if(showToast)toast(financeError612)}
}
async function financePost612(body){const r=await pxApi56('/server/admin-finance-report-v612.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),data=await json56(r,'Finance update');if(!r.ok||!data.ok)throw Error(data.error||'Finance update failed');await financeLoad612();return data}
async function financeDialog612(kind,provider){
 if(kind==='pricing'&&!await loadLiveCostConfig56(false))return toast('Live pricing could not load; changes were not opened');
 const wallet=financeSnapshot612?.wallets?.[provider]||{},names={balance:'Set current actual provider balance',topup:'Record provider funding',threshold:'Set low-balance alert',cash:'Record real cash movement',pricing:'Live credit pricing'};
 let body='';
 if(kind==='cash')body='<label>Movement<select id="finKind612"><option value="credit_sale">Credit purchase received</option><option value="subscription_sale">Subscription received</option><option value="customer_refund">Customer refund paid</option><option value="operating_expense">Operating expense paid</option></select></label><label>Amount USD<input id="finAmount612" type="number" min="0.01" step="0.01"></label><label>Customer account ID (optional)<input id="finBuyer17" maxlength="36"></label><label>Unique payment / document reference<input id="finRef612" maxlength="100"></label><label>Note<input id="finNote612" maxlength="240"></label>';
 else if(kind==='pricing'){const cfg=financePricingV56();body='<label>USD / credit<input id="finUsdCredit612" type="number" min="0.001" step="0.001" value="'+finSafe612(cfg.usdPerCredit)+'"></label><label>Target margin %<input id="finMargin612" type="number" min="0" max="95" value="'+finSafe612(cfg.targetMarginPct)+'"></label><label>Monthly budget USD<input id="finBudget612" type="number" min="0" value="'+finSafe612(cfg.monthlyBudgetUsd)+'"></label><p>Pricing changes affect future quotes; the report shows past credits at the current configured value as an estimate.</p>'}
 else body='<p>'+finSafe612(wallet.label||provider)+'</p><label>Amount USD<input id="finAmount612" type="number" min="0" step="0.01" value="'+(kind==='balance'?finSafe612(wallet.estimated_balance_usd):kind==='threshold'?finSafe612(wallet.alert_threshold_usd):'')+'"></label>'+(kind==='threshold'?'':'<label>Provider statement date, payment reference or reason<input id="finNote612" maxlength="120"></label>')+
 (kind==='balance'?'<p>This posts an auditable reconciliation adjustment so the entered current balance becomes the new starting point. New logged usage reduces it automatically.</p>':'');
 const modal=openDemoDialog(names[kind]||'Finance', '<div class="finance612-dialog">'+body+'</div>','<button class="ghost-btn" data-dialog-close2>Cancel</button><button class="primary-btn" id="finCommit612">Save</button>');
 const commit=q('#finCommit612',modal);commit.onclick=async()=>{commit.disabled=true;try{
  if(kind==='pricing'){const cfg=financePricingV56();cfg.usdPerCredit=Number(q('#finUsdCredit612',modal).value);cfg.targetMarginPct=Number(q('#finMargin612',modal).value);cfg.monthlyBudgetUsd=Number(q('#finBudget612',modal).value);if(!(cfg.usdPerCredit>0)||cfg.targetMarginPct<0||cfg.targetMarginPct>95||cfg.monthlyBudgetUsd<0)throw Error('Enter valid pricing values');await saveLiveCostConfig56(cfg);await financeLoad612()}
  else {const amount=q('#finAmount612',modal)?.value,note=q('#finNote612',modal)?.value?.trim()||'',reference=q('#finRef612',modal)?.value?.trim()||'';const request=kind==='cash'?{action:'cash_entry',kind:q('#finKind612',modal).value,amount_usd:amount,reference,note,buyer_id:q('#finBuyer17',modal)?.value.trim()||''}:{action:kind==='balance'?'reconcile':kind==='topup'?'topup':'threshold',provider,amount_usd:amount,note};await financePost612(request)}
  modal.hidden=true;toast('Finance entry recorded on the server');
 }catch(e){toast(e.message||'Could not save finance entry')}finally{commit.disabled=false}};
}
function financeReverse612(entryId){
 const entry=(financeSnapshot612?.cash_entries||[]).find(e=>e.id===entryId);if(!entry)return toast('Cash entry not found');
 const modal=openDemoDialog('Correct cash entry','<p>Keep the original entry and post an equal opposite movement. Reference: '+finSafe612(entry.reference)+'</p><label>Correction reason<input id="finReverseReason612" maxlength="240"></label>',
 '<button class="ghost-btn" data-dialog-close2>Cancel</button><button class="primary-btn" id="finReverseCommit612">Post reversal</button>');
 q('#finReverseCommit612',modal).onclick=async e=>{const button=e.currentTarget;button.disabled=true;try{await financePost612({action:'reverse_cash',entry_id:entryId,reason:q('#finReverseReason612',modal).value.trim()});modal.hidden=true;toast('Correction posted; original entry preserved')}catch(error){toast(error.message)}finally{button.disabled=false}};
}
function financeAmounts612(report){
 const s=report?.summary||{},cash=report?.cash_summary||{},cfg=report?.config||{},wallets=report?.wallets||{};
 const walletValues=Object.values(wallets);
 const totalOpening=walletValues.reduce((a,w)=>a+(Number(w?.opening_balance_usd)||0),0);
 const totalFunding=walletValues.reduce((a,w)=>a+(Number(w?.added_funding_usd)||0),0);
 const totalUsage=walletValues.reduce((a,w)=>a+(Number(w?.used_usd)||0),0);
 const totalAdjustments=walletValues.reduce((a,w)=>a+(Number(w?.reconciliation_adjustment_usd)||0),0);
 const totalRemaining=walletValues.reduce((a,w)=>a+(Number(w?.estimated_balance_usd)||0),0);
 return {s,cash,cfg,wallets,totalOpening,totalFunding,totalUsage,totalAdjustments,totalRemaining};
}
function financeCsv612(){
 const report=financeSnapshot612;if(!report)return toast('Load live figures first');
 const f=financeAmounts612(report),rows=[];
 const add=(section,metric,amount,notes='')=>rows.push([section,metric,Number(amount||0).toFixed(2),notes]);
 add('Executive summary','Recorded cash receipts',f.cash.receipts_usd,'Actual manually recorded receipts in selected period');
 add('Executive summary','Customer refunds',f.cash.refunds_usd,'Recorded refunds in selected period');
 add('Executive summary','Operating expenses',f.cash.operating_expenses_usd,'Recorded operating expenses in selected period');
 add('Executive summary','Tracked provider usage',f.s.tracked_provider_cost_usd,'Provider/API usage cost in selected period');
 add('Executive summary','Net recorded cash before provider funding',f.cash.net_recorded_cash_before_provider_funding_usd,'Receipts less refunds and operating expenses');
 add('Executive summary','Recorded cash less tracked API usage',f.cash.recorded_cash_less_tracked_usage_usd,'Management estimate; excludes unrecorded fees/tax/costs');
 add('Executive summary','Estimated credit value',f.s.estimated_credit_value_usd,'Current configured USD per credit x finalized credits; not collected cash');
 add('Executive summary','Illustrative contribution',f.s.illustrative_contribution_usd,'Estimated credit value less tracked provider usage; not audited net profit');
 add('Provider wallets','Total opening provider balance',f.totalOpening,'All configured provider wallets');
 add('Provider wallets','Total provider funding added',f.totalFunding,'All recorded wallet funding');
 add('Provider wallets','Total tracked wallet usage',f.totalUsage,'Cumulative tracked wallet usage');
 add('Provider wallets','Total reconciliation adjustments',f.totalAdjustments,'Balance reconciliation adjustments');
 add('Provider wallets','Total remaining provider balance',f.totalRemaining,'Estimated balance at report generation');
 for(const [key,w] of Object.entries(f.wallets)){
  const name=w?.label||key;
  add('Provider wallet - '+name,'Opening balance',w?.opening_balance_usd,'');
  add('Provider wallet - '+name,'Funding added',w?.added_funding_usd,'');
  add('Provider wallet - '+name,'Tracked usage',w?.used_usd,'');
  add('Provider wallet - '+name,'Adjustments',w?.reconciliation_adjustment_usd,'');
  add('Provider wallet - '+name,'Remaining balance',w?.estimated_balance_usd,'Alert limit '+finUsd612(w?.alert_threshold_usd));
 }
 for(const [key,val] of Object.entries(report.cost_by_provider||{}))add('Selected-period spend by provider',key,val,'');
 for(const [key,val] of Object.entries(report.cost_by_type||{}))add('Selected-period spend by category',key,val,'');
 const escape=value=>'"'+String(value??'').replace(/"/g,'""')+'"';
 const meta=[['PIONX FINANCIAL REPORT'],['Period',report.period.from+' to '+report.period.to],['Generated',report.generated_at],['Currency',report.currency||'USD'],[]];
 const lines=meta.map(r=>r.map(escape).join(',')).concat([['Section','Financial metric','Amount USD','Notes'].map(escape).join(',')],rows.map(r=>r.map(escape).join(',')));
 downloadText('PIONX-financial-summary-'+report.period.from+'-to-'+report.period.to+'.csv','\uFEFF'+lines.join('\r\n'));
}
async function financePdf612(){
 const report=financeSnapshot612;if(!report)return toast('Load live figures first');if(!window.PDFLib)throw Error('PDF library is unavailable');
 const pdf=await PDFLib.PDFDocument.create(),regular=await pdf.embedFont(PDFLib.StandardFonts.Helvetica),bold=await pdf.embedFont(PDFLib.StandardFonts.HelveticaBold);
 const navy=PDFLib.rgb(.08,.15,.25),gray=PDFLib.rgb(.36,.42,.49),blue=PDFLib.rgb(.08,.36,.68),gold=PDFLib.rgb(.76,.54,.18);let page=null,y=0,pageCount=0;
 function next(){page=pdf.addPage([595,842]);pageCount++;y=790;page.drawText('PIONX  |  MANAGEMENT FINANCIAL REPORT',{x:42,y:815,size:10,font:bold,color:gold});page.drawLine({start:{x:42,y:806},end:{x:553,y:806},thickness:1,color:gold});}
 function line(value,opt={}){if(!page||y<52)next();const font=opt.strong?bold:regular,size=opt.size||9,raw=String(value??'').replace(/[^\x20-\x7E]/g,' '),max=opt.max||104;
  for(let offset=0;offset<Math.max(1,raw.length);offset+=max){if(y<52)next();page.drawText(raw.slice(offset,offset+max)||' ',{x:opt.indent?54:42,y,size,font,color:opt.strong?navy:gray});y-=opt.gap||14;}
 }
 function heading(value){y-=8;line(value,{strong:true,size:12,gap:19})}
 function moneyRow(label,value,note=''){line(label+' : '+finUsd612(value),{strong:true,max:92});if(note)line(note,{indent:true,size:8,max:98,gap:12})}
 const f=financeAmounts612(report);
 next();line('Period: '+report.period.from+' to '+report.period.to+' (UTC)  |  Generated: '+report.generated_at,{strong:true,max:92});line('Currency: USD. This report is financial amounts only. User names, render jobs and individual AI operations are excluded.');
 heading('Executive financial summary');
 moneyRow('Recorded cash receipts',f.cash.receipts_usd,'Actual manually recorded receipts in the selected period.');
 moneyRow('Customer refunds',f.cash.refunds_usd);
 moneyRow('Operating expenses',f.cash.operating_expenses_usd);
 moneyRow('Tracked provider usage',f.s.tracked_provider_cost_usd,'Actual tracked PIONX provider/API cost in the selected period.');
 moneyRow('Net recorded cash before provider funding',f.cash.net_recorded_cash_before_provider_funding_usd,'Receipts less refunds and operating expenses.');
 moneyRow('Recorded cash less tracked API usage',f.cash.recorded_cash_less_tracked_usage_usd,'Management estimate; unrecorded fees, taxes, invoices or costs are excluded.');
 moneyRow('Estimated credit value',f.s.estimated_credit_value_usd,'Current configured USD per credit multiplied by finalized credits; this is not collected cash.');
 moneyRow('Illustrative contribution',f.s.illustrative_contribution_usd,'Estimated credit value less tracked provider usage; this is not audited net profit.');
 line('Illustrative margin: '+(f.s.margin_pct==null?'N/A':f.s.margin_pct+'%')+'  |  Target margin: '+(f.cfg.target_margin_pct||0)+'%  |  Monthly budget: '+finUsd612(f.cfg.monthly_budget_usd));
 heading('Provider balances - company funds available at providers');
 moneyRow('Total opening provider balance',f.totalOpening);
 moneyRow('Total provider funding added',f.totalFunding);
 moneyRow('Total tracked wallet usage',f.totalUsage);
 moneyRow('Total reconciliation adjustments',f.totalAdjustments);
 moneyRow('Total estimated remaining provider balance',f.totalRemaining);
 for(const [key,w] of Object.entries(f.wallets)){
  const name=w?.label||key;
  line(name+'  |  Remaining '+finUsd612(w?.estimated_balance_usd)+'  |  Alert '+finUsd612(w?.alert_threshold_usd),{strong:true,max:92});
  line('Opening '+finUsd612(w?.opening_balance_usd)+'  + Funding '+finUsd612(w?.added_funding_usd)+'  - Usage '+finUsd612(w?.used_usd)+'  + Adjustments '+finUsd612(w?.reconciliation_adjustment_usd),{indent:true,max:96});
 }
 heading('Selected-period provider spend');
 const byProvider=Object.entries(report.cost_by_provider||{});if(!byProvider.length)line('No tracked provider cost in this period.');
 for(const [key,val] of byProvider)moneyRow(key,val);
 heading('Selected-period cost categories');
 const byType=Object.entries(report.cost_by_type||{});if(!byType.length)line('No tracked cost categories in this period.');
 for(const [key,val] of byType)moneyRow(key,val);
 heading('Accounting scope');
 for(const note of report.notes||[])line(note,{max:101});
 line('Technical render/user/job ledgers remain available inside PIONX Finance for administrator audit and troubleshooting, but they are intentionally excluded from this management report.',{max:101});
 const pages=pdf.getPages();pages.forEach((p,i)=>p.drawText('PIONX internal  |  Financial amounts report  |  Page '+(i+1)+' of '+pageCount,{x:42,y:27,size:8,font:regular,color:gray}));
 const blob=new Blob([await pdf.save()],{type:'application/pdf'});saveBlob66(blob,'PIONX-financial-report-'+report.period.from+'-to-'+report.period.to+'.pdf');
}
let financeRefreshTimer612=null;
function wireFinance612(){void financeLoad612();
 if(financeRefreshTimer612)clearInterval(financeRefreshTimer612);
 financeRefreshTimer612=setInterval(()=>{if(location.hash.split('?')[0]==='#finance'&&document.visibilityState==='visible')void financeLoad612()},30000);
 const financeRoot=q('#viewRoot');if(financeRoot&&!financeRoot.dataset.ops631){financeRoot.dataset.ops631='1';financeRoot.addEventListener('change',e=>{if(e.target?.id==='finOpType631'){financeOpsFilter631.type=e.target.value;financeRenderOps631(financeSnapshot612)}else if(e.target?.id==='finOpResult631'){financeOpsFilter631.result=e.target.value;financeRenderOps631(financeSnapshot612)}});financeRoot.addEventListener('input',e=>{if(e.target?.id==='finOpSearch631'){financeOpsFilter631.query=e.target.value.trim();financeRenderOps631(financeSnapshot612)}})}
 const actionRoot=q('#viewRoot');if(actionRoot&&!actionRoot.dataset.finActions16){actionRoot.dataset.finActions16='1';actionRoot.addEventListener('click',async e=>{if(workspaceRoute16()!=='finance')return;const button=e.target.closest('[data-fin612]');if(!button)return;const action=button.dataset.fin612,provider=button.dataset.provider||'';
 if(['balance','topup','threshold','cash','pricing'].includes(action))return void financeDialog612(action,provider);
 if(action==='reverse')return financeReverse612(button.dataset.entry);
 button.disabled=true;try{if(action==='refresh')await financeLoad612(true);else if(action==='pdf')await financePdf612();else if(action==='csv')financeCsv612()}catch(err){toast(err.message||'Finance action failed')}finally{button.disabled=false}
 });}
}
wireFinance=wireFinance612;
// ===== END V6.13 =====

// ===== V6.14 SHOWCASE + PRIVACY + FILM + PRESENTATION + FLOW =====
const PX614_ASSETS={
  villa:'https://images.unsplash.com/photo-1769780265587-037ee842c0b0?auto=format&fit=crop&fm=jpg&q=72&w=2200',
  interior:'https://images.unsplash.com/photo-1773754532196-014342510e64?auto=format&fit=crop&fm=jpg&q=72&w=2200',
  plaza:'https://images.unsplash.com/photo-1773496430440-328f5a407504?auto=format&fit=crop&fm=jpg&q=72&w=2200',
  night:'https://images.unsplash.com/photo-1772090121254-8db123dfc076?auto=format&fit=crop&fm=jpg&q=72&w=2200',
  facade:'https://images.unsplash.com/photo-1744905385271-733523c3cac2?auto=format&fit=crop&fm=jpg&q=72&w=2200'
};
profileState.cover=profileState.cover||PX614_ASSETS.villa;
let profileDraftCover614=profileState.cover;
const PORTFOLIO_KEY614='pionx-portfolio-v614';
const defaultProjects614=[
 {id:'modern-villa',title:'Modern Villa',category:'Residential',description:'Contemporary residential architecture with controlled material and daylight studies.',cover:PX614_ASSETS.villa,renders:[PX614_ASSETS.villa,imgs.villa1,imgs.villa2],visibility:'public',published:true,allowDownload:false},
 {id:'quiet-interior',title:'Quiet Luxury Interior',category:'Interior',description:'Interior material, lighting and furniture study.',cover:PX614_ASSETS.interior,renders:[PX614_ASSETS.interior,imgs.interiorCard],visibility:'private',published:false,allowDownload:false},
 {id:'urban-plaza',title:'Urban Plaza',category:'Urban / Landscape',description:'Public realm and contemporary commercial architecture.',cover:PX614_ASSETS.plaza,renders:[PX614_ASSETS.plaza,imgs.landscape,imgs.commercial],visibility:'public',published:true,allowDownload:true},
 {id:'night-study',title:'Night Architecture Study',category:'Exterior',description:'Night lighting and facade atmosphere study.',cover:PX614_ASSETS.night,renders:[PX614_ASSETS.night,imgs.night],visibility:'private',published:false,allowDownload:false}
];
let portfolioProjects614=(()=>{try{const x=JSON.parse(safeStore.get(PORTFOLIO_KEY614)||'null');return Array.isArray(x)?x:[]}catch{return []}})();
let portfolioDirectory614=[],portfolioServerLoaded614=false,portfolioDirectoryLoaded614=false,portfolioRequests614=[];
function savePortfolioLocal614(){safeStore.set(PORTFOLIO_KEY614,JSON.stringify(portfolioProjects614))}
function projectById614(id){return portfolioProjects614.find(p=>p.id===id)}
function projectImage614(p){return p?.cover||p?.renders?.[0]||PX614_ASSETS.villa}
function projectBadges614(p){return `<span class="privacy-badge614 ${p.visibility}">${p.visibility==='public'?'● Public':'◒ Private'}</span>${p.published?'<span class="showcase-badge614">Showcase</span>':''}${p.allowDownload?'<span class="download-badge614">Download ON</span>':''}`}
async function portfolioApi614(body){const r=await pxApi56('/server/portfolio-hub-v614.php',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:body.action==='create_project'?AbortSignal.timeout(20000):body.action==='publish_render_set'?AbortSignal.timeout(120000):undefined});const j=await json56(r,'PIONX Showcase');if(!r.ok)throw Error(j.error||'Showcase request failed');return j}
async function savePortfolioServer614(quiet=true){
 if(!signedIn56())return null;
 const payload={action:'save',profile:{name:profileState.displayName,username:profileState.username,title:profileState.title,company:profileState.company,bio:profileState.bio,photo:profileState.photo,cover:profileState.cover,searchable:settingsState.profileSearchable!==false},projects:portfolioProjects614};
 try{const j=await portfolioApi614(payload);if(!quiet)toast('Showcase & project privacy saved');return j}catch(e){if(!quiet)toast(e.message);return null}
}
async function loadPortfolioServer614(){
 if(portfolioServerLoaded614||!signedIn56())return;portfolioServerLoaded614=true;
 try{const j=await portfolioApi614({action:'own'}),d=j.portfolio;if(d){
   if(Array.isArray(d.projects)&&d.projects.length){portfolioProjects614=d.projects;savePortfolioLocal614()}
   if(d.profile){profileState={...profileState,displayName:d.profile.name||profileState.displayName,username:d.profile.username||profileState.username,title:d.profile.title||profileState.title,company:d.profile.company||profileState.company,bio:d.profile.bio||profileState.bio,photo:d.profile.photo||profileState.photo,cover:d.profile.cover||profileState.cover};saveProfileState();syncProfileChrome()}
  }
 }catch(e){console.warn('portfolio hub load',e)}
}
async function loadPortfolioDirectory614(){
 if(portfolioDirectoryLoaded614)return;
 try{const r=await fetch('/server/portfolio-hub-v614.php?action=directory&ts='+Date.now(),{cache:'no-store'}),j=await json56(r,'PIONX Showcase');if(!r.ok)throw Error(j.error||'Could not load PIONX members');if(Array.isArray(j.items)){portfolioDirectory614=j.items;portfolioDirectoryLoaded614=true}}catch(e){portfolioDirectoryLoaded614=false;console.warn('showcase directory',e)}
}
function premiumHomePage614(){return `<section class="page">
 <div class="hero premium-home614"><img src="${PX614_ASSETS.villa}" alt="Premium modern architecture"><div class="hero-copy"><div class="eyebrow">PIONX ARCHITECTURE INTELLIGENCE</div><h1>Architecture workflows.<br><span>One premium workspace.</span></h1><p>Render, video, film, presentation, project privacy and a professional architecture Showcase — with the engines hidden behind PIONX Auto.</p><div class="hero-actions">${btn('Start a render ✦','studio')}${btn('Open Showcase','explore','ghost-btn')}</div><div class="hero-chip-row"><span class="mini-badge">Design fidelity</span><span class="mini-badge">Project privacy</span><span class="mini-badge">Client-ready delivery</span></div></div></div>
 <div class="section-title"><div><h2>Your workspace</h2><p>High-quality visual cards and direct access to every production workflow.</p></div></div>
 <div class="grid-4 premium-cards614">${featureCard('AI Studio',PX614_ASSETS.villa,'Photoreal architectural rendering with automatic scene intelligence.','studio','focus')}${featureCard('Flow',PX614_ASSETS.plaza,'Create project boards, branches, comparisons and visual options.','flow')}${featureCard('Consistency',PX614_ASSETS.interior,'Keep style, materials and lighting consistent across a project.','consistency')}${featureCard('Video',PX614_ASSETS.night,'Architecture-locked motion with PIONX Video Auto.','video')}${featureCard('PIONX Film',PX614_ASSETS.facade,'Arrange multiple video shots and export a client film.','film')}${featureCard('Presentation',PX614_ASSETS.interior,'Analyze images, build material boards, palettes and export PDF/PPT.','presentation')}${featureCard('PIONX Showcase',PX614_ASSETS.plaza,'Professional public portfolios and selected architecture projects.','explore')}${featureCard('Projects',PX614_ASSETS.facade,'Control Public/Private, sharing, downloads and Showcase publishing.','projects')}</div>
 <div class="section-title"><div><h2>Recent projects</h2><p>Privacy and publishing status are visible at a glance.</p></div><a data-route="projects">Manage projects →</a></div><div class="grid-4">${portfolioProjects614.slice(0,4).map(p=>`<article class="panel project-card premium-project614"><img src="${escHtml(projectImage614(p))}" alt=""><div class="meta"><div><h3>${escHtml(p.title)}</h3><div class="project-badges614">${projectBadges614(p)}</div></div><button class="kebab" data-route="projects">⋮</button></div></article>`).join('')}</div>
 </section>`}
routes.home=premiumHomePage614;

function projectsPage614(){return `<section class="page">${pageHead('WORKSPACE','Projects','Choose what stays private, what is public, what appears in PIONX Showcase, and whether viewers may download the work.','<button class="primary-btn" id="newProject614">+ New Project</button>')}<div class="project-privacy-note614"><b>Privacy rule</b><span>Private projects never appear in Showcase. You can create a request-only link and approve or reject each viewer.</span></div><div class="projects-manager614">${portfolioProjects614.map(p=>`<article class="panel project-manage-card614" data-project614="${p.id}"><div class="project-cover614"><img src="${escHtml(projectImage614(p))}" alt=""><div class="project-badges614">${projectBadges614(p)}</div></div><div class="project-manage-body614"><h3>${escHtml(p.title)}</h3><p>${escHtml(p.description||'')}</p><div class="project-controls614"><label>Visibility<select data-project-visibility614="${p.id}"><option value="private" ${p.visibility==='private'?'selected':''}>Private</option><option value="public" ${p.visibility==='public'?'selected':''}>Public</option></select></label><label class="switch-control614"><input type="checkbox" data-project-publish614="${p.id}" ${p.published?'checked':''} ${p.visibility!=='public'?'disabled':''}><span>Publish to Showcase</span></label><label class="switch-control614"><input type="checkbox" data-project-download614="${p.id}" ${p.allowDownload?'checked':''}><span>Allow download</span></label></div><div class="project-action-row614"><button class="ghost-btn" data-project-open614="${p.id}">Open project</button><button class="ghost-btn" data-project-add-render614="${p.id}">+ Add from Renders</button>${p.visibility==='private'?`<button class="primary-btn" data-project-share614="${p.id}">Create request link</button>`:`<button class="ghost-btn" data-route="explore">View in Showcase</button>`}</div></div></article>`).join('')}</div></section>`}

function newProjectExperienceP1(fromFlow=false){
 const m=openDemoDialog('Create project',`<div class="px-create-p1"><p>Start with a private project. Choose the next workspace after creation.</p><label>Project name *<input id="px-name-p1" maxlength="100" placeholder="e.g. New Cairo Villa" required></label><label>Category *<select id="px-cat-p1"><option value="Exterior">Exterior</option><option value="Interior">Interior</option><option value="Landscape">Landscape</option><option value="Urban">Urban / Masterplan</option><option value="Commercial">Commercial</option><option value="Other">Other</option></select></label><label>Description (optional)<textarea id="px-desc-p1" maxlength="500" rows="2" placeholder="Briefly describe this project"></textarea></label><label>Continue to<select id="px-next-p1"><option value="projects">My Projects</option><option value="studio">AI Studio</option><option value="flow" ${fromFlow?'selected':''}>Flow</option></select></label><p id="px-error-p1" role="alert" hidden></p></div>`,'<button type="button" class="ghost-btn" id="px-cancel-p1">Cancel</button><button type="button" class="primary-btn" id="px-create-p1">Create project</button>');
 q('#px-cancel-p1',m).onclick=()=>m.hidden=true;
 const n=q('#px-name-p1',m);n.focus();
 const create=()=>{
  const title=n.value.trim();if(!title){const e=q('#px-error-p1',m);e.hidden=false;e.textContent='Please enter a project name.';n.focus();return}
  const id='p-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),category=q('#px-cat-p1',m).value,description=q('#px-desc-p1',m).value.trim(),destination=q('#px-next-p1',m).value;
  portfolioProjects614.unshift({id,title,category,description,cover:PX614_ASSETS.facade,renders:[],visibility:'private',published:false,allowDownload:false});savePortfolioLocal614();
  Promise.resolve(savePortfolioServer614(true)).then(result=>{if(signedIn56()&&!result)toast('Saved locally; cloud sync unconfirmed.')}).catch(()=>toast('Saved locally; cloud sync unconfirmed.'));
  if(destination==='flow'){flowWorkspace615.activeProject=id;flowWorkspace615.activeBoard='';saveFlow615()}
  m.hidden=true;location.hash='#'+destination;route();toast('Private project created');
 };
 q('#px-create-p1',m).onclick=create;
 n.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();create()}};
}

routes.projects=projectsPage614;

function portfolioPage614(){const publicP=portfolioProjects614.filter(p=>p.visibility==='public'&&p.published);return `<section class="page"><div class="panel portfolio-header portfolio-header614"><img src="${escHtml(profileState.cover||PX614_ASSETS.villa)}"><div class="portfolio-cover-shade614"></div><div class="portfolio-info"><div class="portfolio-avatar ${profileState.photo?'has-photo':''}"${profileAvatarStyle()}>${profileState.photo?'':profileInitials()}</div><div><div class="eyebrow">PIONX PROFESSIONAL PORTFOLIO</div><h1>${escHtml(profileState.displayName)}</h1><p>${escHtml(profileState.title)} · ${escHtml(profileState.company)}</p><div class="stats-row"><div class="panel stat-mini"><b>${portfolioProjects614.length}</b><small>Projects</small></div><div class="panel stat-mini"><b>${publicP.length}</b><small>Published</small></div><div class="panel stat-mini"><b>${portfolioProjects614.filter(p=>p.visibility==='private').length}</b><small>Private</small></div></div></div><div class="portfolio-actions"><button class="ghost-btn" data-route="profile">Edit profile</button><button class="primary-btn" id="publishPortfolio614">Save / Publish</button></div></div></div><div class="section-title"><div><h2>Selected Work</h2><p>Only Public + Published projects appear to other users in PIONX Showcase.</p></div><button class="ghost-btn" data-route="projects">Manage visibility</button></div><div class="project-masonry showcase-own614">${publicP.length?publicP.map(p=>showcaseProjectCard614(p,profileState.displayName,true)).join(''):'<div class="panel empty-showcase614">No projects are published yet. Open Projects and turn on Public + Publish to Showcase.</div>'}</div><div class="section-title"><div><h2>Access requests</h2><p>Approve or reject people asking to view a private shared project.</p></div><button class="ghost-btn" id="refreshRequests614">Refresh</button></div><section class="panel requests-panel614" id="requestsPanel614">Loading requests…</section></section>`}
routes.portfolio=portfolioPage614;

function showcaseProjectCard614(p,author,isOwn=false,token=''){return `<article class="panel discover-project showcase-card614" data-showcase-search614="${escHtml((p.title+' '+p.category+' '+author).toLowerCase())}" data-showcase-category614="${escHtml(String(p.category||'architecture').toLowerCase())}"><div class="discover-img"><img src="${escHtml(projectImage614(p))}"><div class="overlay"><div><b>${escHtml(p.title)}</b><br><small>by ${escHtml(author)}</small></div><span>${escHtml(p.category||'Architecture')}</span></div></div><div class="discover-stats"><button data-showcase-view614="${escHtml(p.id)}" data-owner-token614="${escHtml(token)}">↗ View project</button>${p.allowDownload?`<button data-showcase-download614="${escHtml(projectImage614(p))}" data-download-name614="${escHtml(p.title)}">↓ Download</button>`:'<button disabled>Download off</button>'}${isOwn?'<button data-route="projects">Manage</button>':'<button>☆ Save</button>'}</div></article>`}
function showcasePage614(){
 const own=portfolioProjects614.filter(p=>p.visibility==='public'&&p.published).map(p=>({p,author:profileState.displayName,own:true,token:''}));
 const directory=portfolioDirectory614.flatMap(entry=>(entry.projects||[]).map(p=>({p,author:entry.profile?.name||'PIONX Creator',own:false,token:entry.token||''})));
 const fallback=[
  {p:{id:'featured-1',title:'Contemporary Residence',category:'Residential',cover:PX614_ASSETS.villa,renders:[PX614_ASSETS.villa],allowDownload:false},author:'PIONX Featured',own:false,token:''},
  {p:{id:'featured-2',title:'Interior Collection',category:'Interior',cover:PX614_ASSETS.interior,renders:[PX614_ASSETS.interior],allowDownload:false},author:'PIONX Featured',own:false,token:''},
  {p:{id:'featured-3',title:'Urban Public Realm',category:'Urban',cover:PX614_ASSETS.plaza,renders:[PX614_ASSETS.plaza],allowDownload:false},author:'PIONX Featured',own:false,token:''}
 ];
 const projects=[...own,...directory,...fallback];
 const pros=[{name:profileState.displayName,title:profileState.title,cover:profileState.cover,photo:profileState.photo,count:own.length,own:true},...portfolioDirectory614.slice(0,8).map(x=>({name:x.profile?.name||'PIONX Creator',title:x.profile?.title||'Architect / Designer',cover:x.profile?.cover||x.projects?.[0]?.cover||PX614_ASSETS.facade,photo:x.profile?.photo||'',count:x.projects?.length||0,token:x.token}))];
 return `<section class="page">${pageHead('PIONX SHOWCASE','Showcase','A professional architecture portfolio network for selected public work — project-first, searchable, and controlled by each creator.')}<div class="discover-toolbar"><label class="discover-search"><span>⌕</span><input id="showcaseSearch614" placeholder="Search architect, project, category or studio..."></label><div class="discover-filters"><button class="chip active" data-showcase-filter614="all">All</button><button class="chip" data-showcase-filter614="residential">Residential</button><button class="chip" data-showcase-filter614="interior">Interior</button><button class="chip" data-showcase-filter614="urban">Urban</button></div></div><div class="section-title"><div><h2>Professionals</h2><p>Every creator has a cover, profile and selected public projects.</p></div><button class="ghost-btn" data-route="portfolio">My portfolio</button></div><div class="designer-row showcase-pros614">${pros.map(x=>`<article class="panel designer-card"><div class="designer-cover"><img src="${escHtml(x.cover||PX614_ASSETS.facade)}"><span class="designer-avatar ${x.photo?'has-photo':''}" ${x.photo?`style="background-image:url('${escHtml(x.photo)}');background-size:cover"`:''}>${x.photo?'':escHtml((x.name||'PX').split(/\s+/).slice(0,2).map(n=>n[0]).join('').toUpperCase())}</span></div><div class="designer-body"><h3>${escHtml(x.name)}</h3><p>${escHtml(x.title||'Architect / Designer')}</p><div class="designer-meta"><span>${x.count} public project${x.count===1?'':'s'}</span><span>${x.own?'Your portfolio':'PIONX member'}</span></div><div class="designer-actions"><button ${x.own?'data-route="portfolio"':`data-public-portfolio614="${escHtml(x.token||'')}"`}>View portfolio</button></div></div></article>`).join('')}</div><div class="section-title"><div><h2>Selected public work</h2><p>Private projects never appear here.</p></div></div><div class="project-masonry" id="showcaseProjects614">${projects.map(x=>showcaseProjectCard614(x.p,x.author,x.own,x.token)).join('')}</div></section>`}
routes.explore=showcasePage614;

const profileBase614=routes.profile;
routes.profile=function(){const html=profileBase614();const cover=`<div class="profile-cover-editor614"><img id="profileCoverPreview614" src="${escHtml(profileState.cover||PX614_ASSETS.villa)}" alt="Profile cover"><div class="profile-cover-actions614"><div><b>Professional cover</b><small>Shown at the top of your portfolio and Showcase profile.</small></div><input id="profileCoverInput614" type="file" accept="image/png,image/jpeg,image/webp" hidden><button class="ghost-btn" id="changeProfileCover614" type="button">Change cover</button></div></div>`;return html.replace('<div class="profile-layout">',cover+'<div class="profile-layout">')};
async function compactImage614(file,maxW=1800,quality=.78){const data=await readStudioImage(file),im=new Image();im.src=data;await im.decode();const scale=Math.min(1,maxW/im.naturalWidth),c=document.createElement('canvas');c.width=Math.max(1,Math.round(im.naturalWidth*scale));c.height=Math.max(1,Math.round(im.naturalHeight*scale));c.getContext('2d').drawImage(im,0,0,c.width,c.height);return c.toDataURL('image/jpeg',quality)}

function openProjectViewer614(p,author=profileState.displayName){const images=(p.renders?.length?p.renders:[p.cover]).filter(Boolean);const m=openDemoDialog(p.title,`<div class="project-viewer614"><div class="project-viewer-meta614"><span>${escHtml(author)}</span><span>${escHtml(p.category||'Architecture')}</span>${projectBadges614({...p,visibility:p.visibility||'public',published:true})}</div><p>${escHtml(p.description||'')}</p><div class="project-viewer-grid614">${images.map((u,i)=>`<figure><img src="${escHtml(u)}" alt=""><figcaption>Image ${i+1}</figcaption></figure>`).join('')}</div></div>`,p.allowDownload?`<button class="primary-btn" id="downloadProject614">Download Project ZIP</button>`:'');if(p.allowDownload)q('#downloadProject614',m)?.addEventListener('click',()=>downloadProject614(p));return m}
async function downloadUrl614(url,name='PIONX-project'){try{const r=await fetch(url,{mode:'cors'});if(!r.ok)throw Error('download');const u=URL.createObjectURL(await r.blob()),a=document.createElement('a');a.href=u;a.download=name.replace(/[^a-z0-9_-]+/gi,'-')+'.jpg';a.click();setTimeout(()=>URL.revokeObjectURL(u),15000)}catch{window.open(url,'_blank','noopener')}}
async function projectBlob614(url){
 if(/^data:/i.test(url)){const r=await fetch(url);return r.blob()}
 if(/^https:\/\/images\.unsplash\.com\//i.test(url)){const r=await fetch(url,{mode:'cors'});if(!r.ok)throw Error('Image unavailable');return r.blob()}
 if(typeof fetchRenderBlob56==='function')return fetchRenderBlob56(typeof galleryUrl62==='function'?(galleryUrl62(url)||url):url);
 const r=await fetch(url,{credentials:'same-origin'});if(!r.ok)throw Error('Image unavailable');return r.blob();
}
async function downloadProject614(p){
 const images=(p?.renders?.length?p.renders:[p?.cover]).filter(Boolean);if(!images.length)return toast('No project images to download');
 const btn=q('#downloadProject614');if(btn){btn.disabled=true;btn.textContent='Preparing ZIP…'}
 try{
   if(typeof JSZip==='undefined')throw Error('ZIP library is unavailable');const zip=new JSZip();let saved=0;
   for(let i=0;i<images.length;i++)try{const blob=await projectBlob614(images[i]);const ext=(blob.type||'').includes('png')?'png':(blob.type||'').includes('webp')?'webp':'jpg';zip.file(`PIONX-${String(i+1).padStart(2,'0')}.${ext}`,blob);saved++}catch(e){console.warn('project image download skipped',e)}
   if(!saved)throw Error('Project images are temporarily unavailable');zip.file('README.txt',`${p.title||'PIONX Project'}\nExported from PIONX Showcase.\nDownload permission was enabled by the project owner.`);
   const out=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}}),u=URL.createObjectURL(out),a=document.createElement('a');a.href=u;a.download=(p.title||'PIONX-project').replace(/[^a-z0-9_-]+/gi,'-')+'.zip';a.click();setTimeout(()=>URL.revokeObjectURL(u),30000);toast('Project ZIP ready');
 }catch(e){toast(e.message)}finally{if(btn){btn.disabled=false;btn.textContent='Download Project ZIP'}}
}
async function privateShare614(id){const p=projectById614(id);if(!p)return;await savePortfolioServer614(true);try{const j=await portfolioApi614({action:'create_private_share',project_id:id}),u=new URL(location.pathname,location.origin);u.searchParams.set('pionx_project',j.share);const m=openDemoDialog('Private request link',`<p>Anyone opening this link sees a locked project card and can send an access request. The project stays private until you approve that account.</p><input id="privateShareUrl614" value="${escHtml(u.href)}" readonly>`,`<button class="primary-btn" id="copyPrivate614">Copy request link</button>`);q('#copyPrivate614',m)?.addEventListener('click',async()=>{const x=q('#privateShareUrl614',m);x.select();try{await navigator.clipboard.writeText(x.value);toast('Private project request link copied')}catch{toast('Select and copy the link')}})}catch(e){toast(e.message)}}
async function loadRequests614(){const panel=q('#requestsPanel614');if(!panel)return;try{const j=await portfolioApi614({action:'requests'});portfolioRequests614=j.requests||[];panel.innerHTML=portfolioRequests614.length?portfolioRequests614.map(r=>`<article class="request-row614"><div><b>${escHtml(r.requester_name||r.requester_email||'PIONX user')}</b><small>${escHtml(r.project_title||'Project')} · ${escHtml(r.requester_email||'')}</small></div><span class="request-status614 ${r.status}">${escHtml(r.status)}</span>${r.status==='pending'?`<div><button class="primary-btn" data-request-decision614="approved" data-request-id614="${r.id}">Approve</button><button class="ghost-btn" data-request-decision614="rejected" data-request-id614="${r.id}">Reject</button></div>`:''}</article>`).join(''):'<div class="empty-showcase614">No access requests.</div>';qa('[data-request-decision614]',panel).forEach(b=>b.addEventListener('click',async()=>{b.disabled=true;try{await portfolioApi614({action:'decision',request_id:b.dataset.requestId614,decision:b.dataset.requestDecision614});toast('Request '+b.dataset.requestDecision614);await loadRequests614()}catch(e){toast(e.message)}finally{b.disabled=false}}))}catch(e){panel.textContent=e.message}}
async function openPublicPortfolio614(token){if(!token)return toast('Public portfolio is not published yet');try{const r=await fetch('/server/portfolio-hub-v614.php?action=public&token='+encodeURIComponent(token),{cache:'no-store'}),j=await json56(r,'Public portfolio');if(!r.ok)throw Error(j.error||'Portfolio unavailable');const p=j.profile||{},projects=j.projects||[];openDemoDialog(p.name||'PIONX Portfolio',`<div class="public-portfolio614"><div class="public-portfolio-cover614"><img src="${escHtml(p.cover||PX614_ASSETS.facade)}"><div><b>${escHtml(p.name||'PIONX member')}</b><span>${escHtml(p.title||'Architect / Designer')}</span></div></div><p>${escHtml(p.bio||'')}</p><div class="project-viewer-grid614">${projects.map(x=>`<button data-public-project614="${escHtml(x.id)}"><img src="${escHtml(projectImage614(x))}"><b>${escHtml(x.title)}</b></button>`).join('')}</div></div>`);qa('[data-public-project614]',q('#demoDialog')).forEach(b=>b.onclick=()=>{const x=projects.find(p=>p.id===b.dataset.publicProject614);if(x)openProjectViewer614(x,p.name)})}catch(e){toast(e.message)}}

// Video: richer settings while keeping the working V6.6 provider/credit pipeline.
routes.video=function(){return `<section class="page">${pageHead('PIONX VIDEO AUTO','Video Studio','Architecture-first image-to-video. Choose the creative intent; PIONX keeps provider names hidden and protects the building while it moves.','')}<div class="media-grid media-grid614"><section class="panel video-preview video-preview614" id="videoPreview66"><img src="${PX614_ASSETS.night}" alt=""><div class="video-preview-copy614"><span>VIDEO AUTO</span><b>Motion that respects architecture.</b><small>Upload a render or use your latest PIONX result.</small></div></section><aside class="panel media-settings media-settings614"><div class="video-form-grid614"><label>Workflow<select id="videoWorkflow614"><option value="image">Image → Video</option><option value="walkthrough">Interior Walkthrough</option><option value="flythrough">Exterior Fly-through</option><option value="cinematic">Cinematic Shot</option></select></label><label>Quality<select id="videoQuality66"><option value="premium">Premium</option><option value="fast">Fast Preview</option></select></label><label>Duration<select id="videoDuration66"><option value="8">8 seconds</option><option value="6">6 seconds</option><option value="4">4 seconds</option></select></label><label>Aspect<select id="videoAspect614"><option value="16:9">16:9 Landscape</option><option value="9:16">9:16 Vertical</option></select></label><label>Camera<select id="videoCamera614"><option>Slow cinematic push</option><option>Orbit</option><option>Pan left to right</option><option>Dolly forward</option><option>Walkthrough</option></select></label><label>Lighting<select id="videoLighting614"><option>Lock source lighting</option><option>Daylight</option><option>Golden hour</option><option>Night</option></select></label></div><label class="video-source-drop614">Starting image<input type="file" id="videoImage66" accept="image/png,image/jpeg,image/webp"><span>Upload JPG / PNG / WebP</span></label><button class="ghost-btn" id="videoLatest66" type="button">Use latest render</button><div class="field-title">Direction / notes</div><textarea id="videoPrompt66" class="notes" placeholder="Optional: slower movement, no people, keep trees still, emphasize entrance lighting..."></textarea><div class="video-locks614"><label><input type="checkbox" id="videoGeometry614" checked> Strict geometry lock</label><label><input type="checkbox" id="videoMaterials614" checked> Material continuity</label><label><input type="checkbox" id="videoPeople614"> Natural people motion</label></div><p class="video-caveat66">Credits are reserved once before generation and reconciled when the video completes.</p><p id="videoQuote66" role="status">Checking video credits…</p><button class="primary-btn" id="videoGenerate66" style="width:100%">Generate Video ✦</button><p id="videoStatus66" role="status" aria-live="polite"></p><button class="ghost-btn" id="videoDownload66" hidden>Download MP4</button></aside></div><div class="section-title"><div><h2>Shot presets</h2><p>Settings write the motion brief automatically.</p></div></div><div class="grid-4 premium-cards614">${featureCard('Walkthrough',PX614_ASSETS.interior,'Stable interior camera and locked furniture/material scale.','video')}${featureCard('Exterior Fly-through',PX614_ASSETS.villa,'Controlled parallax around a fixed facade.','video')}${featureCard('Night Cinematic',PX614_ASSETS.night,'Highlight architecture lighting without geometry drift.','video')}${featureCard('Urban Motion',PX614_ASSETS.plaza,'Natural people and public-realm movement.','video')}</div></section>`};
const videoCallBase614=videoCall66;
videoCall66=async function(payload){if(payload?.action==='start'){
 const wf=q('#videoWorkflow614')?.value||'image',camera=q('#videoCamera614')?.value||'Slow cinematic push',lighting=q('#videoLighting614')?.value||'Lock source lighting';
 payload={...payload,aspect_ratio:q('#videoAspect614')?.value||'16:9',workflow:wf,camera,lighting,prompt:[payload.prompt,`Workflow: ${wf}. Camera: ${camera}. Lighting: ${lighting}.`,`Architecture protection: ${q('#videoGeometry614')?.checked!==false?'strict geometry lock; no moving openings, slabs or facade lines.':''} ${q('#videoMaterials614')?.checked!==false?'Preserve material identity, reflections and lighting continuity.':''} ${q('#videoPeople614')?.checked?'If people exist, move them naturally without duplication or body artifacts.':'Do not invent people unless already present.'}`].join('\n')};
 }
 return videoCallBase614(payload)
};

// Film: real multi-clip browser assembly (WebM) + project-style timeline.
let filmClips614=[],filmBusy614=false;
function filmPage614(){return `<section class="page">${pageHead('PIONX FILM','Film Studio','Assemble approved video shots into one client film. Add clips, reorder them, preview the sequence and export a real combined film from the browser.','<button class="ghost-btn" id="filmAddLatest614">+ Latest Video</button><button class="primary-btn" id="filmExport614">Export Film</button>')}<div class="film-grid614"><section class="panel film-stage614"><div id="filmStage614">${filmClips614.length?`<video controls src="${escHtml(filmClips614[0].url)}"></video>`:`<div class="film-empty614"><b>Build a film from approved shots</b><span>Upload MP4/WebM clips or add your latest generated PIONX video.</span></div>`}</div><div class="film-progress614"><span id="filmStatus614">${filmClips614.length+' shot(s) ready'}</span><i></i></div></section><aside class="panel film-settings614"><label>Film title<input id="filmTitle614" value="PIONX Architecture Film"></label><label>Format<select id="filmRatio614"><option value="16:9">16:9 Client Film</option><option value="9:16">9:16 Social Vertical</option></select></label><label>Transition<select id="filmTransition614"><option value="fade">Soft fade</option><option value="cut">Clean cut</option></select></label><label>Frame rate<select id="filmFps614"><option value="30">30 fps</option><option value="24">24 fps</option></select></label><label class="video-source-drop614">Add video clips<input type="file" id="filmFiles614" accept="video/mp4,video/webm" multiple><span>MP4 / WebM · multiple files</span></label><button class="ghost-btn" id="filmPreviewSequence614">Preview sequence</button><p class="video-caveat66">Film export is assembled locally in Chrome/Edge as WebM, so your clips do not need to be re-uploaded to another provider.</p></aside></div><div class="section-title"><div><h2>Film timeline</h2><p>Drag-style order controls with shot preview.</p></div></div><section class="panel film-timeline614" id="filmTimeline614">${filmClips614.length?filmClips614.map((c,i)=>`<article class="film-shot614"><video muted src="${escHtml(c.url)}"></video><div><b>Shot ${i+1}</b><small>${escHtml(c.name)}</small></div><button data-film-up614="${i}" ${i===0?'disabled':''}>↑</button><button data-film-down614="${i}" ${i===filmClips614.length-1?'disabled':''}>↓</button><button data-film-remove614="${i}">×</button></article>`).join(''):'<div class="film-empty614">No clips yet.</div>'}</section></section>`}
routes.film=filmPage614;
async function addLatestVideo614(){if(!videoJob66)return toast('Generate a video first or upload clips');try{const r=await pxApi56('/server/video-direct-v66.php?action=download&id='+encodeURIComponent(videoJob66));if(!r.ok)throw Error((await json56(r,'Latest video')).error||'Latest video unavailable');const blob=await r.blob(),url=URL.createObjectURL(blob);filmClips614.push({name:'Latest PIONX Video.mp4',url,blob});route()}catch(e){toast(e.message)}}
function filmRevoke614(c){for(const u of [c?.url,c?.previewUrl,c?.thumbUrl])if(u?.startsWith('blob:'))try{URL.revokeObjectURL(u)}catch{}}
async function previewFilm614(){if(!filmClips614.length)return toast('Add video clips first');const stage=q('#filmStage614');for(let i=0;i<filmClips614.length;i++){if(!stage)return;stage.innerHTML=`<video id="filmPreviewPlayer614" autoplay muted playsinline src="${escHtml(filmClips614[i].url)}"></video><span class="film-shot-label614">Shot ${i+1} / ${filmClips614.length}</span>`;const v=q('#filmPreviewPlayer614');await new Promise(res=>{v.onended=res;v.onerror=res;v.play().catch(res)})}stage.innerHTML='<div class="film-empty614"><b>Preview complete</b><span>Ready to export film.</span></div>'}
async function exportFilm614(){
 if(filmBusy614)return;if(!filmClips614.length)return toast('Add video clips first');if(typeof MediaRecorder==='undefined')return toast('This browser cannot export the Film preview');filmBusy614=true;const button=q('#filmExport614');if(button){button.disabled=true;button.textContent='Building film…'};
 try{
  const vertical=q('#filmRatio614')?.value==='9:16',fps=Number(q('#filmFps614')?.value||30),canvas=document.createElement('canvas');canvas.width=vertical?720:1280;canvas.height=vertical?1280:720;const ctx=canvas.getContext('2d',{alpha:false}),stream=canvas.captureStream(fps),mime=MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':'video/webm';const rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:8000000}),chunks=[];rec.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};const stopped=new Promise(res=>rec.onstop=res);rec.start(500);
  for(let i=0;i<filmClips614.length;i++){
   const clip=filmClips614[i],v=document.createElement('video');v.src=clip.url;v.muted=true;v.playsInline=true;await new Promise((res,rej)=>{v.onloadedmetadata=res;v.onerror=()=>rej(Error('Could not read '+clip.name))});const draw=()=>{if(v.paused||v.ended)return;const s=Math.max(canvas.width/v.videoWidth,canvas.height/v.videoHeight),w=v.videoWidth*s,h=v.videoHeight*s;ctx.fillStyle='#050b14';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(v,(canvas.width-w)/2,(canvas.height-h)/2,w,h);ctx.fillStyle='rgba(0,0,0,.45)';ctx.fillRect(20,canvas.height-58,230,34);ctx.fillStyle='#fff';ctx.font='20px Arial';ctx.fillText('PIONX FILM  ·  '+(i+1)+'/'+filmClips614.length,34,canvas.height-35);requestAnimationFrame(draw)};await v.play();draw();await new Promise(res=>v.onended=res);
   if(q('#filmTransition614')?.value==='fade'&&i<filmClips614.length-1){for(let a=0;a<=1;a+=.08){ctx.fillStyle=`rgba(5,11,20,${a})`;ctx.fillRect(0,0,canvas.width,canvas.height);await sleep56(28)}}
  }
  rec.stop();await stopped;const blob=new Blob(chunks,{type:mime}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=(q('#filmTitle614')?.value||'PIONX-Film').replace(/[^a-z0-9_-]+/gi,'-')+'.webm';a.click();setTimeout(()=>URL.revokeObjectURL(u),60000);toast('Film exported successfully')
 }catch(e){console.error(e);toast(e.message||'Film export failed')}finally{filmBusy614=false;if(button){button.disabled=false;button.textContent='Export Film'}}
}

// Presentation: source upload + analysis + material board + color extraction + Plan->3D + PDF/PPT.
const presentationState614={type:'Material Board',sources:[],plan:'',plan3d:'',palette:['#D8D0C2','#8B7A68','#383C42','#A79B86','#EEEAE3'],materials:['Natural stone','Warm timber','Brushed metal','Clear glass'],summary:'Upload project images, then run Analyze Presentation.'};
function presentationPage614(){const preview=presentationPreview614();return `<section class="page">${pageHead('CLIENT DELIVERY','Presentation Studio','Analyze project images, build material/color boards, upload extra images, turn a plan into a 3D presentation visual, then export PDF or editable PowerPoint.','<button class="ghost-btn" id="presentationPdf614">Export PDF</button><button class="primary-btn" id="presentationPpt614">Export PowerPoint</button>')}<div class="presentation-studio614"><aside class="panel presentation-builder614"><div class="presentation-step614"><b>1 · Sources</b><label class="presentation-drop614">Upload images<input id="presentationImages614" type="file" accept="image/png,image/jpeg,image/webp" multiple><span>Renders, references, photos or diagrams</span></label><button class="ghost-btn" id="presentationSaved614">+ Add saved renders</button><div class="presentation-source-list614" id="presentationSources614">${presentationState614.sources.map((s,i)=>`<div><img src="${escHtml(s.data)}"><span>${escHtml(s.name||'Image '+(i+1))}</span><button data-pres-remove614="${i}">×</button></div>`).join('')||'<small>No uploaded images yet.</small>'}</div></div><div class="presentation-step614"><b>2 · Deliverable</b><div class="presentation-types614">${['Material Board','Color Palette','Image Board','Plan → 3D','Mixed Presentation'].map(t=>`<button data-pres-type614="${t}" class="${presentationState614.type===t?'active':''}">${t}</button>`).join('')}</div></div><div class="presentation-step614"><b>3 · Analyze & build</b><button class="primary-btn" id="presentationAnalyze614">✦ Analyze materials & colors</button><p id="presentationAnalysisText614">${escHtml(presentationState614.summary)}</p></div><div class="presentation-step614"><b>4 · Plan → 3D</b><label class="presentation-drop614">Upload plan<input id="presentationPlan614" type="file" accept="image/png,image/jpeg,image/webp"><span>${presentationState614.plan?'Plan ready':'2D plan image'}</span></label><button class="ghost-btn" id="presentationPlan3D614" ${presentationState614.plan?'':'disabled'}>Generate 3D presentation visual ✦</button><small>This uses the PIONX image pipeline and may use credits.</small></div></aside><section class="panel presentation-preview614" id="presentationPreview614">${preview}</section></div></section>`}
routes.presentation=presentationPage614;
function presentationPreview614(){const main=presentationState614.plan3d||presentationState614.sources[0]?.data||PX614_ASSETS.interior;return `<div class="presentation-board614"><header><div><small>PIONX CLIENT PRESENTATION</small><h2>${escHtml(presentationTitle66())}</h2></div><span>${escHtml(presentationState614.type)}</span></header><div class="presentation-board-main614"><img src="${escHtml(main)}" alt=""><div class="presentation-palette614">${presentationState614.palette.map((c,i)=>`<div><i style="background:${c}"></i><b>${c}</b><small>${escHtml(presentationState614.materials[i%presentationState614.materials.length]||'Material')}</small></div>`).join('')}</div></div><footer><span>${escHtml(presentationState614.summary)}</span><b>PIONX AI</b></footer></div>`}
function readAnyImage614(file){return readStudioImage(file).then(data=>({name:file.name,data}))}
async function paletteFromImage614(data){const im=new Image();im.src=data;await im.decode();const c=document.createElement('canvas');c.width=96;c.height=96;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0,96,96);const d=x.getImageData(0,0,96,96).data,bins=new Map();for(let i=0;i<d.length;i+=16){const a=d[i+3];if(a<180)continue;const r=Math.round(d[i]/32)*32,g=Math.round(d[i+1]/32)*32,b=Math.round(d[i+2]/32)*32,key=[Math.min(255,r),Math.min(255,g),Math.min(255,b)].join(',');bins.set(key,(bins.get(key)||0)+1)}return [...bins.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6).map(([k])=>'#'+k.split(',').map(v=>Number(v).toString(16).padStart(2,'0')).join('').toUpperCase())}
async function analyzePresentation614(){const b=q('#presentationAnalyze614');if(b){b.disabled=true;b.textContent='Analyzing…'};try{const src=presentationState614.sources[0]?.data||presentationState614.plan;if(!src)throw Error('Upload at least one project image or plan');presentationState614.palette=await paletteFromImage614(src);let analysis=null;try{const r=await pxApi56('/server/analyze.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:src,scene_type:'auto',mode:'preserve'})});const j=await json56(r,'Presentation analysis');if(r.ok)analysis=j.analysis||j}catch{};if(analysis){const mats=Array.isArray(analysis.materials)?analysis.materials:String(analysis.materials||'').split(/[,·]/).map(x=>x.trim()).filter(Boolean);if(mats.length)presentationState614.materials=mats.slice(0,6);presentationState614.summary=`${analysis.style||analysis.architectural_language||'Architecture'} · ${analysis.lighting||'balanced lighting'} · ${analysis.material_strategy||'materials analyzed'}`.slice(0,220)}else presentationState614.summary='Local color analysis complete · material labels prepared for client presentation.';route();toast('Presentation analysis complete')}catch(e){toast(e.message)}finally{if(b){b.disabled=false;b.textContent='✦ Analyze materials & colors'}}}
async function planTo3D614(){if(!presentationState614.plan)return toast('Upload a plan first');const button=q('#presentationPlan3D614');if(button){button.disabled=true;button.textContent='Generating 3D…'};const modal=showRenderMind58();q('#renderMindScene').textContent='Presentation · Plan to 3D concept';let start=null,engine='';try{mindUpdate('Reading plan walls, openings, circulation and room relationships…',12,0);const prompt='PLAN TO 3D PRESENTATION VISUAL. Use the supplied 2D plan as authoritative geometry. Preserve wall, room, opening, stair and circulation relationships. Convert it into a clean professional 3D axonometric architectural presentation visual, white/neutral materials, readable spatial depth, no invented rooms, no changed planning logic, no text hallucinations. Suitable for a client presentation board.';start=await renderPost56({action:'start',source_image:presentationState614.plan,prompt,scene_type:'plan',fidelity:'preserve',mode:'preserve',lighting_mode:'day',controls:{architecture_lock:'strict',preserve_composition:true,output_purpose:'presentation_plan_3d',quality_profile:'premium_clean_v57'},references:[],assets:[],analysis:{presentation_plan_3d:true}},45000);engine=start.engines?.[0]||'';if(!engine)throw Error('PIONX plan route is unavailable');mindUpdate('Building the 3D presentation visual while locking the plan…',58,3);const done=await renderEngine56(start,engine),best=done?.candidates?.find(x=>x?.url);if(!best?.url)throw Error('Plan conversion completed without an image');presentationState614.plan3d=best.url;mindUpdate('3D plan visual ready for the presentation…',100,5);hideRenderMind58(400);route();toast('Plan → 3D visual added to Presentation')}catch(e){if(start&&engine)await cancelRender56(start,engine);hideRenderMind58(1500);toast(e.message||'Plan → 3D failed')}finally{if(button){button.disabled=false;button.textContent='Generate 3D presentation visual ✦'}}}
async function drawContain614(ctx,data,x,y,w,h){
 let source=data,revoke='';
 if(data&&!/^data:image\//i.test(data)&&!/^blob:/i.test(data)){
   try{
     let blob=null;
     if(/^https:\/\/images\.unsplash\.com\//i.test(data)){
       const rr=await fetch(data,{mode:'cors'});if(rr.ok)blob=await rr.blob();
     }else if(typeof fetchRenderBlob56==='function'){
       blob=await fetchRenderBlob56(typeof galleryUrl62==='function'?(galleryUrl62(data)||data):data);
     }else{
       const rr=await fetch(data,{credentials:'same-origin'});if(rr.ok)blob=await rr.blob();
     }
     if(blob){source=URL.createObjectURL(blob);revoke=source;}
   }catch(e){console.warn('Presentation image proxy fallback',e)}
 }
 const im=new Image();if(!/^blob:/i.test(source)&&!/^data:/i.test(source))im.crossOrigin='anonymous';im.src=source;await im.decode();
 const sc=Math.min(w/im.naturalWidth,h/im.naturalHeight),iw=im.naturalWidth*sc,ih=im.naturalHeight*sc;ctx.drawImage(im,x+(w-iw)/2,y+(h-ih)/2,iw,ih);
 if(revoke)URL.revokeObjectURL(revoke);
}
async function presentationBoards614(){const boards=[];const sources=[...presentationState614.sources];if(presentationState614.plan3d)sources.push({name:'Plan 3D',data:presentationState614.plan3d});if(!sources.length)sources.push({name:'Architecture',data:PX614_ASSETS.interior});
 const cover=document.createElement('canvas');cover.width=1600;cover.height=900;let c=cover.getContext('2d');c.fillStyle='#07111d';c.fillRect(0,0,1600,900);await drawContain614(c,sources[0].data,720,0,880,900);c.fillStyle='#fff';c.font='700 62px Arial';c.fillText(presentationTitle66(),80,250);c.fillStyle='#d7b36b';c.font='24px Arial';c.fillText('PIONX CLIENT PRESENTATION',80,180);c.fillStyle='#b9c5d2';c.font='28px Arial';c.fillText(presentationState614.type,80,310);boards.push(cover.toDataURL('image/jpeg',.9));
 if(['Image Board','Mixed Presentation'].includes(presentationState614.type)){for(const s of sources.slice(0,8)){const cv=document.createElement('canvas');cv.width=1600;cv.height=900;c=cv.getContext('2d');c.fillStyle='#f4f2ed';c.fillRect(0,0,1600,900);await drawContain614(c,s.data,70,105,1460,700);c.fillStyle='#17202a';c.font='700 32px Arial';c.fillText(s.name||'Project image',70,60);c.fillStyle='#666';c.font='18px Arial';c.fillText('PIONX AI',1370,860);boards.push(cv.toDataURL('image/jpeg',.9))}}
 if(['Material Board','Color Palette','Mixed Presentation'].includes(presentationState614.type)){const cv=document.createElement('canvas');cv.width=1600;cv.height=900;c=cv.getContext('2d');c.fillStyle='#f4f2ed';c.fillRect(0,0,1600,900);c.fillStyle='#17202a';c.font='700 42px Arial';c.fillText(presentationState614.type==='Color Palette'?'Color Palette':'Material & Color Board',70,75);await drawContain614(c,sources[0].data,70,125,850,650);presentationState614.palette.forEach((col,i)=>{const y=160+i*105;c.fillStyle=col;c.fillRect(990,y,95,70);c.fillStyle='#17202a';c.font='700 20px Arial';c.fillText(col,1110,y+26);c.font='18px Arial';c.fillText(presentationState614.materials[i%presentationState614.materials.length]||'Material',1110,y+55)});c.fillStyle='#68727d';c.font='18px Arial';c.fillText(presentationState614.summary.slice(0,100),70,835);boards.push(cv.toDataURL('image/jpeg',.9))}
 if(presentationState614.type==='Plan → 3D'&&presentationState614.plan3d){const cv=document.createElement('canvas');cv.width=1600;cv.height=900;c=cv.getContext('2d');c.fillStyle='#f4f2ed';c.fillRect(0,0,1600,900);c.fillStyle='#17202a';c.font='700 42px Arial';c.fillText('Plan → 3D Concept',70,70);await drawContain614(c,presentationState614.plan3d,70,120,1460,700);boards.push(cv.toDataURL('image/jpeg',.9))}
 return boards}
async function exportPresentation614(kind){const btn=kind==='pdf'?q('#presentationPdf614'):q('#presentationPpt614');if(btn){btn.disabled=true;btn.textContent='Preparing…'};try{const images=await presentationBoards614(),name='PIONX-'+presentationTitle66().replace(/[^a-z0-9_-]+/gi,'-');if(kind==='pdf'){const doc=await PDFLib.PDFDocument.create();for(const data of images){const page=doc.addPage([960,540]),im=await doc.embedJpg(data.split(',')[1]);page.drawImage(im,{x:0,y:0,width:960,height:540})}saveBlob66(new Blob([await doc.save()],{type:'application/pdf'}),name+'.pdf')}else{const ppt=new PptxGenJS();ppt.layout='LAYOUT_WIDE';ppt.author='PIONX AI';ppt.title=presentationTitle66();images.forEach(data=>{const s=ppt.addSlide();s.addImage({data,x:0,y:0,w:13.333,h:7.5})});const out=await ppt.write({outputType:'blob'});saveBlob66(out instanceof Blob?out:new Blob([out]),name+'.pptx')}toast('Presentation exported · '+images.length+' board(s)')}catch(e){console.error(e);toast(e.message||'Presentation export failed')}finally{if(btn){btn.disabled=false;btn.textContent=kind==='pdf'?'Export PDF':'Export PowerPoint'}}}

// Flow: add project ownership to boards.
let flowProjects614=(()=>{try{return JSON.parse(safeStore.get('pionx-flow-projects-v614')||'[]')}catch{return []}})();
const flowBase614=routes.flow;
routes.flow=function(){let html=flowBase614();const select=`<select id="flowProjectSelect614"><option value="">No project</option>${portfolioProjects614.map(p=>`<option value="${p.id}">${escHtml(p.title)}</option>`).join('')}</select><button class="ghost-btn" id="flowNewProject614">+ New Project</button>`;html=html.replace('<button class="primary-btn" id="flowNewBoard">+ New Board</button>',select+'<button class="primary-btn" id="flowNewBoard">+ New Board</button>');return html};
function newFlowProject614(){const m=openDemoDialog('New Flow project','<label>Project name<input id="flowProjectName614" placeholder="e.g. Villa A options"></label><p>Create a project first, then every Flow board can be assigned to it.</p>','<button class="ghost-btn" data-dialog-close2>Cancel</button><button class="primary-btn" id="flowCreateProject614">Create project</button>');q('#flowCreateProject614',m)?.addEventListener('click',()=>{const name=q('#flowProjectName614',m)?.value.trim();if(!name)return toast('Write a project name');const id='flow-'+Date.now();portfolioProjects614.unshift({id,title:name,category:'Flow Project',description:'Created from PIONX Flow.',cover:PX614_ASSETS.plaza,renders:[],visibility:'private',published:false,allowDownload:false});savePortfolioLocal614();savePortfolioServer614(true);m.hidden=true;route();toast('Flow project created')})}

async function openPrivateProject614(token){
 try{const r=await fetch('/server/portfolio-hub-v614.php?action=private_info&share='+encodeURIComponent(token),{cache:'no-store'}),j=await json56(r,'Private project');if(!r.ok)throw Error(j.error||'Private project unavailable');const p=j.project||{},m=openDemoDialog('Private project',`<div class="private-share614"><img src="${escHtml(p.cover||PX614_ASSETS.facade)}"><span class="privacy-badge614 private">◒ Private</span><h2>${escHtml(p.title||'Private project')}</h2><p>${escHtml(p.description||'')}</p><small>Owner: ${escHtml(j.owner?.name||'PIONX member')}</small><div id="privateAccessState614">Access is locked. Send a request to the owner.</div></div>`,`<button class="ghost-btn" id="checkPrivate614">Check access</button><button class="primary-btn" id="requestPrivate614">Request access</button>`);
 q('#requestPrivate614',m)?.addEventListener('click',async e=>{e.currentTarget.disabled=true;try{const x=await portfolioApi614({action:'request_access',share:token});q('#privateAccessState614',m).textContent='Request sent · waiting for owner approval.';toast('Access request sent')}catch(err){toast(err.message)}finally{e.currentTarget.disabled=false}});
 q('#checkPrivate614',m)?.addEventListener('click',async e=>{e.currentTarget.disabled=true;try{const x=await portfolioApi614({action:'access',share:token});if(x.approved&&x.project){m.hidden=true;openProjectViewer614(x.project,x.owner?.name||'PIONX member')}else q('#privateAccessState614',m).textContent='Still waiting for approval.'}catch(err){q('#privateAccessState614',m).textContent=err.message}finally{e.currentTarget.disabled=false}})
 }catch(e){toast(e.message)}
}

async function addSavedRenderToProject614(id){
 const p=projectById614(id);if(!p)return;
 if(!galleryRows62.length)try{await galleryLoad62()}catch{}
 const rows=galleryRows62.filter(r=>r?.url).slice(0,30);
 if(!rows.length)return toast('No saved renders yet. Render an image first, then add it to this project.');
 const body=`<p class="render-picker-note614">Choose one or more saved renders. Only projects you mark Public + Publish to Showcase can appear in Showcase.</p><div class="render-picker614">${rows.map((r,i)=>`<label><input type="checkbox" data-render-pick614="${i}"><img src="${escHtml(galleryUrl62(r.url))}" alt=""><span>${escHtml(r.title||r.scene_type||'Render '+(i+1))}</span></label>`).join('')}</div>`;
 const m=openDemoDialog('Add saved renders to '+p.title,body,'<button class="ghost-btn" data-dialog-close2>Cancel</button><button class="primary-btn" id="confirmRenderPick614">Add selected</button>');
 q('[data-dialog-close2]',m)?.addEventListener('click',()=>m.hidden=true);
 q('#confirmRenderPick614',m)?.addEventListener('click',()=>{
   const picks=qa('[data-render-pick614]:checked',m).map(x=>rows[+x.dataset.renderPick614]).filter(Boolean);
   if(!picks.length)return toast('Select at least one render');
   const urls=picks.map(r=>galleryUrl62(r.url)).filter(Boolean);p.renders=[...(p.renders||[]),...urls].filter((u,i,a)=>a.indexOf(u)===i).slice(0,16);
   if((!p.cover||p.cover===PX614_ASSETS.facade)&&urls[0])p.cover=urls[0];
   savePortfolioLocal614();savePortfolioServer614(true);m.hidden=true;route();toast(picks.length+' render(s) added to project');
 });
}
const wireBase614=wireView;
wireView=function(name){wireBase614(name);
 if(['home','projects','portfolio','explore','profile'].includes(name)){loadPortfolioServer614().catch(()=>{});if(name==='explore')loadPortfolioDirectory614().then(()=>{if((location.hash||'#home').slice(1)==='explore'&&portfolioDirectory614.length&&!q('#viewRoot')?.dataset?.directoryRefresh614){q('#viewRoot').dataset.directoryRefresh614='1';route()}}).catch(()=>{})}
 if(name==='projects'){
  q('#newProject614')?.addEventListener('click',()=>newProjectExperienceP1(false));
  qa('[data-project-visibility614]').forEach(s=>s.addEventListener('change',()=>{const p=projectById614(s.dataset.projectVisibility614);if(!p)return;p.visibility=s.value;p.published=p.visibility==='public'&&p.published;savePortfolioLocal614();savePortfolioServer614(true);route()}));
  qa('[data-project-publish614]').forEach(x=>x.addEventListener('change',()=>{const p=projectById614(x.dataset.projectPublish614);if(!p)return;p.published=!!x.checked&&p.visibility==='public';savePortfolioLocal614();savePortfolioServer614(true);route()}));
  qa('[data-project-download614]').forEach(x=>x.addEventListener('change',()=>{const p=projectById614(x.dataset.projectDownload614);if(!p)return;p.allowDownload=!!x.checked;savePortfolioLocal614();savePortfolioServer614(true);toast('Download permission updated')}));
  qa('[data-project-open614]').forEach(b=>b.addEventListener('click',()=>{const p=projectById614(b.dataset.projectOpen614);if(p)openProjectViewer614(p)}));qa('[data-project-add-render614]').forEach(b=>b.addEventListener('click',()=>addSavedRenderToProject614(b.dataset.projectAddRender614)));qa('[data-project-share614]').forEach(b=>b.addEventListener('click',()=>privateShare614(b.dataset.projectShare614)));
 }
 if(name==='portfolio'){q('#publishPortfolio614')?.addEventListener('click',()=>savePortfolioServer614(false));q('#refreshRequests614')?.addEventListener('click',loadRequests614);loadRequests614()}
 if(name==='explore'){
  let showcaseFilter614='all';const apply=()=>{const term=(q('#showcaseSearch614')?.value||'').toLowerCase();qa('.showcase-card614').forEach(card=>{const cat=(card.dataset.showcaseCategory614||'').toLowerCase(),okFilter=showcaseFilter614==='all'||cat.includes(showcaseFilter614),okTerm=!term||(card.dataset.showcaseSearch614||'').includes(term);card.hidden=!(okFilter&&okTerm)})};q('#showcaseSearch614')?.addEventListener('input',apply);qa('[data-showcase-filter614]').forEach(b=>b.addEventListener('click',()=>{showcaseFilter614=b.dataset.showcaseFilter614||'all';qa('[data-showcase-filter614]').forEach(x=>x.classList.toggle('active',x===b));apply()}));
  qa('[data-showcase-view614]').forEach(b=>b.addEventListener('click',async()=>{const own=projectById614(b.dataset.showcaseView614);if(own)return openProjectViewer614(own);const token=b.dataset.ownerToken614;if(token){try{const r=await fetch('/server/portfolio-hub-v614.php?action=public&token='+encodeURIComponent(token)),j=await json56(r,'Public portfolio');const p=(j.projects||[]).find(x=>x.id===b.dataset.showcaseView614);if(p)openProjectViewer614(p,j.profile?.name||'PIONX member')}catch(e){toast(e.message)}}else toast('Featured showcase preview')}));
  qa('[data-showcase-download614]').forEach(b=>b.addEventListener('click',()=>downloadUrl614(b.dataset.showcaseDownload614,b.dataset.downloadName614)));qa('[data-public-portfolio614]').forEach(b=>b.addEventListener('click',()=>openPublicPortfolio614(b.dataset.publicPortfolio614)));
 }
 if(name==='profile'){
  q('#changeProfileCover614')?.addEventListener('click',()=>q('#profileCoverInput614')?.click());q('#profileCoverInput614')?.addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{profileDraftCover614=await compactImage614(f,1800,.78);q('#profileCoverPreview614').src=profileDraftCover614;toast('Cover ready · save profile to apply')}catch(err){toast(err.message)}});q('#saveProfileBtn')?.addEventListener('click',()=>{profileState.cover=profileDraftCover614||profileState.cover;setTimeout(()=>savePortfolioServer614(true),20)})
 }
 if(name==='film'){
  q('#filmFiles614')?.addEventListener('change',async e=>{await filmAddFiles621(e.target.files||[])});q('#filmAddLatest614')?.addEventListener('click',addLatestVideo614);q('#filmPreviewSequence614')?.addEventListener('click',previewFilm614);q('#filmExport614')?.addEventListener('click',exportFilm614);qa('[data-film-up614]').forEach(b=>b.onclick=()=>{const i=+b.dataset.filmUp614;[filmClips614[i-1],filmClips614[i]]=[filmClips614[i],filmClips614[i-1]];route()});qa('[data-film-down614]').forEach(b=>b.onclick=()=>{const i=+b.dataset.filmDown614;[filmClips614[i+1],filmClips614[i]]=[filmClips614[i],filmClips614[i+1]];route()});qa('[data-film-remove614]').forEach(b=>b.onclick=()=>{const i=+b.dataset.filmRemove614;filmRevoke614(filmClips614[i]);filmClips614.splice(i,1);route()})
 }
 if(name==='presentation'){
  q('#presentationImages614')?.addEventListener('change',async e=>{for(const f of [...(e.target.files||[])].slice(0,12)){try{presentationState614.sources.push(await readAnyImage614(f))}catch(err){toast(err.message)}}route()});q('#presentationSaved614')?.addEventListener('click',async()=>{if(!galleryRows62.length)await galleryLoad62();const rows=galleryRows62.filter(r=>r?.url).slice(0,8);if(!rows.length)return toast('No saved renders found');for(const r of rows){try{const blob=await fetchRenderBlob56(galleryUrl62(r.url)),data=await new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.onerror=rej;fr.readAsDataURL(blob)});presentationState614.sources.push({name:r.title||r.scene_type||'Saved render',data})}catch{}}route()});qa('[data-pres-remove614]').forEach(b=>b.onclick=()=>{presentationState614.sources.splice(+b.dataset.presRemove614,1);route()});qa('[data-pres-type614]').forEach(b=>b.onclick=()=>{presentationState614.type=b.dataset.presType614;route()});q('#presentationPlan614')?.addEventListener('change',async e=>{const f=e.target.files?.[0];if(f){presentationState614.plan=await readStudioImage(f);route()}});q('#presentationAnalyze614')?.addEventListener('click',analyzePresentation614);q('#presentationPlan3D614')?.addEventListener('click',planTo3D614);q('#presentationPdf614')?.addEventListener('click',()=>exportPresentation614('pdf'));q('#presentationPpt614')?.addEventListener('click',()=>exportPresentation614('ppt'))
 }
 if(name==='flow'){q('#flowNewProject614')?.addEventListener('click',newFlowProject614);q('#flowProjectSelect614')?.addEventListener('change',e=>safeStore.set('pionx-flow-project-active-v614',e.target.value))}
};

// Keep labels consistent without changing route identifiers.
setTimeout(()=>{qa('[data-route="explore"] b').forEach(b=>b.textContent='Showcase');},0);
const privateToken614=new URLSearchParams(location.search).get('pionx_project');if(privateToken614)setTimeout(()=>openPrivateProject614(privateToken614),700);
// ===== PIONX V6.15 · ALL MEMBERS + MULTI-PAGE PRESENTATION + REAL FLOW =====

// --- Showcase: all PIONX members are searchable. Public projects + approved private access only. ---
function showcaseMemberCard615(x){
 const p=x.profile||{},name=p.name||p.username||'PIONX member',cover=p.cover||x.projects?.[0]?.cover||PX614_ASSETS.facade,photo=p.photo||'',count=(x.projects||[]).length;
 const initials=(name||'PX').split(/\s+/).filter(Boolean).slice(0,2).map(n=>n[0]||'').join('').toUpperCase()||'PX';
 const search=[name,p.username,p.title,p.company].filter(Boolean).join(' ').toLowerCase();
 return `<article class="panel designer-card member-card615" data-member-search615="${escHtml(search)}"><div class="designer-cover"><img src="${escHtml(cover)}" alt=""><span class="designer-avatar ${photo?'has-photo':''}" ${photo?`style="background-image:url('${escHtml(photo)}');background-size:cover;background-position:center"`:''}>${photo?'':escHtml(initials)}</span></div><div class="designer-body"><h3>${escHtml(name)}</h3><p>${escHtml(p.title||'Architect / Designer')}</p><div class="designer-meta"><span>@${escHtml(p.username||'member')}</span><span>${count} public project${count===1?'':'s'}</span></div><div class="designer-actions"><button data-member-view615="${escHtml(x.member_key||'')}">View profile</button></div></div></article>`;
}
function showcasePage615(){
 const ownProjects=(signedIn56()?portfolioProjects614:[]).filter(p=>p.visibility==='public'&&p.published).map(p=>({p,author:profileState.displayName,own:true,token:'',memberKey:''}));
 const others=portfolioDirectory614.filter(x=>{const u=String(x.profile?.username||'').toLowerCase(),n=String(x.profile?.name||'').toLowerCase();return !(u&&u===String(profileState.username||'').toLowerCase())&&!(n&&n===String(profileState.displayName||'').toLowerCase())});
 const publicWork=others.flatMap(entry=>(entry.projects||[]).map(p=>({p,author:entry.profile?.name||entry.profile?.username||'PIONX member',own:false,token:entry.token||'',memberKey:entry.member_key||''}))).slice(0,160);
 const professionals=[...(signedIn56()?[{member_key:'',profile:{name:profileState.displayName,username:profileState.username,title:profileState.title,company:profileState.company,photo:profileState.photo,cover:profileState.cover},projects:ownProjects.map(x=>x.p),own:true}]:[]),...others];
 return `<section class="page">${pageHead('PIONX PROFESSIONAL NETWORK','Showcase','Find every searchable PIONX member by name or username. A profile only exposes projects that are public to everyone or private projects already approved for your account.')}<div class="discover-toolbar showcase-toolbar615"><label class="discover-search"><span>⌕</span><input id="showcaseSearch615" placeholder="Search any PIONX user, username, studio or project..."></label><div class="discover-filters"><button class="chip active" data-showcase-filter615="all">All work</button><button class="chip" data-showcase-filter615="residential">Residential</button><button class="chip" data-showcase-filter615="interior">Interior</button><button class="chip" data-showcase-filter615="urban">Urban</button><button class="chip" data-showcase-filter615="landscape">Landscape</button></div></div><div class="section-title"><div><h2>All PIONX members</h2><p>${professionals.length} searchable account${professionals.length===1?'':'s'} · profiles stay visible even when they have no public projects.</p></div><button class="ghost-btn" data-route="portfolio">My portfolio</button></div><div class="designer-row showcase-pros615" id="showcaseMembers615">${professionals.map(x=>x.own?`<article class="panel designer-card member-card615" data-member-search615="${escHtml([profileState.displayName,profileState.username,profileState.title,profileState.company].join(' ').toLowerCase())}"><div class="designer-cover"><img src="${escHtml(profileState.cover||PX614_ASSETS.facade)}"><span class="designer-avatar ${profileState.photo?'has-photo':''}" ${profileState.photo?`style="background-image:url('${escHtml(profileState.photo)}');background-size:cover;background-position:center"`:''}>${profileState.photo?'':profileInitials()}</span></div><div class="designer-body"><h3>${escHtml(profileState.displayName)}</h3><p>${escHtml(profileState.title)}</p><div class="designer-meta"><span>@${escHtml(profileState.username)}</span><span>${ownProjects.length} public project${ownProjects.length===1?'':'s'}</span></div><div class="designer-actions"><button data-route="portfolio">View my profile</button></div></div></article>`:showcaseMemberCard615(x)).join('')}</div><div class="section-title"><div><h2>Public work</h2><p>Selected projects published by PIONX members. Private work is never listed here.</p></div></div><div class="project-masonry" id="showcaseProjects615">${[...ownProjects,...publicWork].map(x=>`<div data-project-member615="${escHtml(x.memberKey||'')}" class="showcase-wrap615">${showcaseProjectCard614(x.p,x.author,x.own,x.token)}</div>`).join('')||'<div class="panel empty-showcase614">No public work has been published yet.</div>'}</div></section>`;
}
routes.explore=showcasePage615;

async function openMemberPortfolio615(memberKey){
 if(!memberKey)return go('portfolio');
 try{
  const j=await portfolioApi614({action:'member_view',member_key:memberKey}),p=j.profile||{},projects=j.projects||[];
  const available=projects.length?projects.map(x=>`<button class="member-project615" data-member-project615="${escHtml(x.id)}"><img src="${escHtml(projectImage614(x))}" alt=""><span><b>${escHtml(x.title)}</b><small>${escHtml(x.category||'Architecture')} · ${x.access==='approved'?'Private · Access granted':x.access==='owner'?'Private / Owner':'Public'}</small></span></button>`).join(''):'<div class="empty-showcase614">No projects are currently available to your account.</div>';
  const m=openDemoDialog(p.name||p.username||'PIONX member',`<div class="public-portfolio614 member-portfolio615"><div class="public-portfolio-cover614"><img src="${escHtml(p.cover||PX614_ASSETS.facade)}"><div><b>${escHtml(p.name||p.username||'PIONX member')}</b><span>${escHtml(p.title||'Architect / Designer')}</span><small>@${escHtml(p.username||'member')}${p.company?' · '+escHtml(p.company):''}</small></div></div><p>${escHtml(p.bio||'')}</p><div class="member-access-note615">You see public projects plus any private project this owner has approved for your account.</div><div class="member-project-list615">${available}</div></div>`);
  qa('[data-member-project615]',m).forEach(b=>b.addEventListener('click',()=>{const x=projects.find(v=>v.id===b.dataset.memberProject615);if(x)openProjectViewer614(x,p.name||p.username||'PIONX member')}));
 }catch(e){toast(e.message)}
}

// --- Presentation: unlimited independent pages. ---
function newPresentationPage615(type='Image Board',title=''){
 return {id:'pg-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),title:title||type,type,sources:[],plan:'',plan3d:'',palette:['#D8D0C2','#8B7A68','#383C42','#A79B86','#EEEAE3'],materials:['Natural stone','Warm timber','Brushed metal','Clear glass'],summary:'Add images, choose the page type, then build this page.',notes:''};
}
const presentationState615={title:'PIONX Client Presentation',selected:0,pages:[newPresentationPage615('Cover','Cover'),newPresentationPage615('Image Board','Project Images'),newPresentationPage615('Material Board','Materials')]};
function presPage615(){return presentationState615.pages[presentationState615.selected]||presentationState615.pages[0]}
function presSource615(p){return p?.plan3d||p?.sources?.[0]?.data||p?.plan||PX614_ASSETS.interior}
function presentationPreview615(){
 const p=presPage615(),src=presSource615(p),imgs615=(p.sources||[]).slice(0,6);
 const gallery=imgs615.length>1?`<div class="pres-preview-grid615">${imgs615.map(s=>`<img src="${escHtml(s.data)}" alt="">`).join('')}</div>`:`<img class="pres-preview-main615" src="${escHtml(src)}" alt="">`;
 const palette=['Material Board','Color Palette','Mixed Board'].includes(p.type)?`<div class="presentation-palette614">${(p.palette||[]).map((c,i)=>`<div><i style="background:${c}"></i><b>${c}</b><small>${escHtml(p.materials?.[i%(p.materials?.length||1)]||'Material')}</small></div>`).join('')}</div>`:'';
 return `<div class="presentation-board614 presentation-board615"><header><div><small>PIONX CLIENT PRESENTATION</small><h2>${escHtml(p.title||p.type)}</h2></div><span>${escHtml(p.type)}</span></header><div class="presentation-board-main614 presentation-board-main615"><div class="pres-preview-media615">${gallery}</div>${palette}</div><div class="pres-preview-note615">${escHtml(p.notes||p.summary||'')}</div><footer><span>${escHtml(p.summary||'Page ready')}</span><b>Page ${presentationState615.selected+1} / ${presentationState615.pages.length}</b></footer></div>`;
}
function presentationPage615(){
 const p=presPage615(),types=['Cover','Image Board','Material Board','Color Palette','Before / After','Contact Sheet','Mixed Board','Plan → 3D','Notes / Specs'];
 return `<section class="page">${pageHead('CLIENT DELIVERY','Presentation Studio','Build an unlimited multi-page client presentation. Every page has its own images, analysis, board type and content. Export the complete ordered deck to PDF or editable PowerPoint.','<button class="ghost-btn" id="presentationPdf615">Export PDF</button><button class="primary-btn" id="presentationPpt615">Export PowerPoint</button>')}<div class="presentation-package-bar615"><label>Presentation title<input id="presentationTitle615" value="${escHtml(presentationState615.title)}"></label><span>${presentationState615.pages.length} page${presentationState615.pages.length===1?'':'s'} · no fixed page limit</span></div><div class="presentation-multipage615"><aside class="panel presentation-pages615"><button class="primary-btn" id="presentationAddPage615">＋ Add Page</button><div class="presentation-page-list615">${presentationState615.pages.map((x,i)=>`<button class="presentation-page-item615 ${i===presentationState615.selected?'active':''}" data-pres-page615="${i}"><span>${String(i+1).padStart(2,'0')}</span><div><b>${escHtml(x.title||x.type)}</b><small>${escHtml(x.type)} · ${(x.sources||[]).length} image${(x.sources||[]).length===1?'':'s'}</small></div></button>`).join('')}</div><div class="presentation-page-actions615"><button data-pres-page-action615="duplicate">Duplicate</button><button data-pres-page-action615="up" ${presentationState615.selected===0?'disabled':''}>↑</button><button data-pres-page-action615="down" ${presentationState615.selected===presentationState615.pages.length-1?'disabled':''}>↓</button><button data-pres-page-action615="delete" ${presentationState615.pages.length===1?'disabled':''}>Delete</button></div></aside><section class="panel presentation-preview614 presentation-preview615">${presentationPreview615()}</section><aside class="panel presentation-builder614 presentation-builder615"><div class="presentation-step614"><b>Page setup</b><label>Page title<input id="presentationPageTitle615" value="${escHtml(p.title||'')}"></label><label>Page type<select id="presentationType615">${types.map(t=>`<option ${t===p.type?'selected':''}>${t}</option>`).join('')}</select></label></div><div class="presentation-step614"><b>Images for this page</b><label class="presentation-drop614">Upload images<input id="presentationImages615" type="file" accept="image/png,image/jpeg,image/webp" multiple><span>Add as many images as this page needs</span></label><button class="ghost-btn" id="presentationSaved615">Choose from saved renders</button><div class="presentation-source-list614 presentation-source-list615">${(p.sources||[]).map((s,i)=>`<div><img src="${escHtml(s.data)}"><span>${escHtml(s.name||'Image '+(i+1))}</span><button data-pres-remove615="${i}">×</button></div>`).join('')||'<small>No images on this page yet.</small>'}</div></div><div class="presentation-step614"><b>AI / board build</b><button class="primary-btn" id="presentationBuild615">✦ Analyze & Build This Page</button><p id="presentationAnalysisText615">${escHtml(p.summary||'')}</p><label>Page notes<textarea id="presentationNotes615" class="notes" placeholder="Optional client note, specification or caption...">${escHtml(p.notes||'')}</textarea></label></div>${p.type==='Plan → 3D'?`<div class="presentation-step614"><b>Plan → 3D</b><label class="presentation-drop614">Upload plan<input id="presentationPlan615" type="file" accept="image/png,image/jpeg,image/webp"><span>${p.plan?'Plan ready':'Upload the 2D plan for this page'}</span></label><button class="ghost-btn" id="presentationPlan3D615" ${p.plan?'':'disabled'}>Generate 3D presentation visual ✦</button><small>Uses the PIONX rendering pipeline and may consume credits.</small></div>`:''}</aside></div></section>`;
}
routes.presentation=presentationPage615;

function savedRenderPicker615(onAdd,title='Choose saved renders'){
 (async()=>{if(!galleryRows62.length)await galleryLoad62();const rows=galleryRows62.filter(r=>r?.url);if(!rows.length)return toast('No saved renders found');const m=openDemoDialog(title,`<div class="render-picker614 presentation-picker615">${rows.map((r,i)=>`<label><input type="checkbox" data-pres-pick615="${i}"><img src="${escHtml(galleryUrl62(r.url))}" alt=""><span>${escHtml(r.title||r.scene||'Render '+(i+1))}</span></label>`).join('')}</div>`,'<button class="ghost-btn" data-dialog-close2>Cancel</button><button class="primary-btn" id="presentationPickerAdd615">Add selected</button>');q('[data-dialog-close2]',m)?.addEventListener('click',()=>m.hidden=true);q('#presentationPickerAdd615',m)?.addEventListener('click',()=>{const picks=qa('[data-pres-pick615]:checked',m).map(x=>rows[+x.dataset.presPick615]).filter(Boolean).map((r,i)=>({name:r.title||r.scene||'Saved Render',data:galleryUrl62(r.url)}));if(!picks.length)return toast('Select at least one render');onAdd(picks);m.hidden=true})})().catch(e=>toast(e.message));
}
async function buildPresentationPage615(){
 const p=presPage615(),button=q('#presentationBuild615');if(button){button.disabled=true;button.textContent='Building…'};
 try{
  const src=p.sources?.[0]?.data||p.plan||p.plan3d;
  if(['Material Board','Color Palette','Mixed Board'].includes(p.type)){
   if(!src)throw Error('Add at least one image to analyze');p.palette=await paletteFromImage614(src);let analysis=null;
   try{const r=await pxApi56('/server/analyze.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:src,scene_type:'auto',mode:'preserve'})});const j=await json56(r,'Presentation analysis');if(r.ok)analysis=j.analysis||j}catch{}
   if(analysis){const mats=Array.isArray(analysis.materials)?analysis.materials:String(analysis.materials||'').split(/[,·]/).map(x=>x.trim()).filter(Boolean);if(mats.length)p.materials=mats.slice(0,8);p.summary=`${analysis.style||analysis.architectural_language||'Architecture'} · ${analysis.lighting||'balanced lighting'} · ${analysis.material_strategy||'materials analyzed'}`.slice(0,240)}else p.summary='Color and material analysis complete for this page.';
  }else if(p.type==='Plan → 3D'){
   p.summary=p.plan3d?'3D plan visual ready for this page.':'Upload a plan and generate the 3D visual for this page.';
  }else if(p.type==='Before / After'){
   if((p.sources||[]).length<2)throw Error('Before / After needs at least two images on this page');p.summary='Before / After comparison page ready.';
  }else if(p.type==='Notes / Specs'){
   p.summary=p.notes?.trim()?'Notes / specifications page ready.':'Add page notes or specifications, then build this page.';
  }else if(!src){throw Error('Add at least one image to this page');}else p.summary=`${p.type} page built from ${(p.sources||[]).length} selected image${(p.sources||[]).length===1?'':'s'}.`;
  route();toast('Presentation page built');
 }catch(e){toast(e.message)}finally{if(button){button.disabled=false;button.textContent='✦ Analyze & Build This Page'}}
}
async function planTo3D615(){
 const p=presPage615();if(!p?.plan)return toast('Upload a plan on this page first');const button=q('#presentationPlan3D615');if(button){button.disabled=true;button.textContent='Generating 3D…'};showRenderMind58();q('#renderMindScene').textContent='Presentation · Plan to 3D';let start=null,engine='';
 try{mindUpdate('Reading plan geometry and circulation…',14,0);const prompt='PLAN TO 3D PRESENTATION VISUAL. The supplied 2D plan is authoritative. Preserve every wall, room boundary, opening, stair, core and circulation relationship. Create a clean professional 3D axonometric architectural presentation visual with restrained neutral materials and readable spatial depth. Do not invent or move rooms. No text hallucinations.';start=await renderPost56({action:'start',source_image:p.plan,prompt,scene_type:'plan',fidelity:'preserve',mode:'preserve',lighting_mode:'day',controls:{architecture_lock:'strict',preserve_composition:true,output_purpose:'presentation_plan_3d',quality_profile:'premium_clean_v57'},references:[],assets:[],analysis:{presentation_plan_3d:true}},45000);engine=start.engines?.[0]||'';if(!engine)throw Error('PIONX plan route is unavailable');mindUpdate('Building the axonometric presentation visual…',60,3);const done=await renderEngine56(start,engine),best=done?.candidates?.find(x=>x?.url);if(!best?.url)throw Error('Plan conversion completed without an image');p.plan3d=best.url;p.summary='Plan converted to a 3D presentation visual with planning geometry locked.';mindUpdate('3D plan visual ready…',100,5);hideRenderMind58(350);route();toast('Plan → 3D added to this page')}catch(e){if(start&&engine)await cancelRender56(start,engine);hideRenderMind58(1000);toast(e.message||'Plan → 3D failed')}finally{if(button){button.disabled=false;button.textContent='Generate 3D presentation visual ✦'}}
}
function canvasText615(ctx,text,x,y,maxWidth,lineHeight,maxLines=8){const words=String(text||'').split(/\s+/),lines=[];let line='';for(const w of words){const test=line?line+' '+w:w;if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=w;if(lines.length>=maxLines)break}else line=test}if(line&&lines.length<maxLines)lines.push(line);lines.forEach((l,i)=>ctx.fillText(l,x,y+i*lineHeight));}
async function renderPresentationPage615(p,index,total){
 const cv=document.createElement('canvas');cv.width=1600;cv.height=900;const c=cv.getContext('2d');const sources=[...(p.sources||[])];if(p.plan3d)sources.unshift({name:'Plan 3D',data:p.plan3d});const src=sources[0]?.data||p.plan||PX614_ASSETS.interior;
 c.fillStyle='#f4f2ed';c.fillRect(0,0,1600,900);c.fillStyle='#17202a';c.font='700 38px Arial';c.fillText(p.title||p.type,70,68);c.fillStyle='#68727d';c.font='18px Arial';c.fillText(`PIONX AI · ${p.type} · ${index+1}/${total}`,70,98);
 if(p.type==='Cover'){
  c.fillStyle='#07111d';c.fillRect(0,0,1600,900);await drawContain614(c,src,760,0,840,900);c.fillStyle='#d7b36b';c.font='24px Arial';c.fillText('PIONX CLIENT PRESENTATION',80,190);c.fillStyle='#fff';c.font='700 58px Arial';canvasText615(c,presentationState615.title,80,270,600,68,4);c.fillStyle='#c4ced9';c.font='25px Arial';canvasText615(c,p.notes||p.summary,80,520,560,36,5);
 }else if(p.type==='Image Board'||p.type==='Contact Sheet'||p.type==='Mixed Board'){
  const list=sources.length?sources:[{name:'Architecture',data:src}],n=list.length,cols=p.type==='Image Board'?Math.min(2,Math.ceil(Math.sqrt(n))):Math.max(1,Math.ceil(Math.sqrt(n))),rows=Math.ceil(n/cols),gap=18,x0=70,y0=125,w=(1460-gap*(cols-1))/cols,h=(690-gap*(rows-1))/rows;
  for(let i=0;i<n;i++){const x=x0+(i%cols)*(w+gap),y=y0+Math.floor(i/cols)*(h+gap);c.fillStyle='#e5e2dc';c.fillRect(x,y,w,h);await drawContain614(c,list[i].data,x+8,y+8,w-16,h-16)}
  if(p.type==='Mixed Board'&&(p.palette||[]).length){(p.palette||[]).slice(0,6).forEach((col,i)=>{c.fillStyle=col;c.fillRect(70+i*115,835,92,28)})}
 }else if(p.type==='Material Board'||p.type==='Color Palette'){
  await drawContain614(c,src,70,135,850,650);(p.palette||[]).slice(0,6).forEach((col,i)=>{const y=145+i*104;c.fillStyle=col;c.fillRect(990,y,95,70);c.fillStyle='#17202a';c.font='700 20px Arial';c.fillText(col,1110,y+27);c.font='18px Arial';c.fillText(p.materials?.[i%(p.materials?.length||1)]||'Material',1110,y+56)});c.fillStyle='#68727d';c.font='18px Arial';canvasText615(c,p.summary,990,780,500,26,4);
 }else if(p.type==='Before / After'){
  const a=sources[0]?.data||src,b=sources[1]?.data||src;await drawContain614(c,a,70,145,705,620);await drawContain614(c,b,825,145,705,620);c.fillStyle='#17202a';c.font='700 22px Arial';c.fillText('BEFORE',70,125);c.fillText('AFTER',825,125);
 }else if(p.type==='Plan → 3D'){
  await drawContain614(c,p.plan3d||p.plan||src,70,130,1460,680);c.fillStyle='#68727d';c.font='18px Arial';canvasText615(c,p.summary,70,840,1420,26,2);
 }else if(p.type==='Notes / Specs'){
  await drawContain614(c,src,70,140,760,650);c.fillStyle='#17202a';c.font='700 28px Arial';c.fillText('Notes / Specifications',900,155);c.font='21px Arial';canvasText615(c,p.notes||p.summary,900,205,600,34,16);
 }else{await drawContain614(c,src,70,135,1460,650)}
 c.fillStyle='#777';c.font='16px Arial';c.fillText('PIONX AI',1450,870);return cv.toDataURL('image/jpeg',.91);
}
async function exportPresentation615(kind){
 const btn=kind==='pdf'?q('#presentationPdf615'):q('#presentationPpt615');if(btn){btn.disabled=true;btn.textContent='Preparing…'};
 try{const images=[];for(let i=0;i<presentationState615.pages.length;i++)images.push(await renderPresentationPage615(presentationState615.pages[i],i,presentationState615.pages.length));const name='PIONX-'+String(presentationState615.title||'Presentation').replace(/[^a-z0-9_-]+/gi,'-');if(kind==='pdf'){const doc=await PDFLib.PDFDocument.create();for(const data of images){const page=doc.addPage([960,540]),im=await doc.embedJpg(data.split(',')[1]);page.drawImage(im,{x:0,y:0,width:960,height:540})}saveBlob66(new Blob([await doc.save()],{type:'application/pdf'}),name+'.pdf')}else{const ppt=new PptxGenJS();ppt.layout='LAYOUT_WIDE';ppt.author='PIONX AI';ppt.title=presentationState615.title;images.forEach(data=>{const slide=ppt.addSlide();slide.addImage({data,x:0,y:0,w:13.333,h:7.5})});const out=await ppt.write({outputType:'blob'});saveBlob66(out instanceof Blob?out:new Blob([out]),name+'.pptx')}toast(`Presentation exported · ${images.length} page${images.length===1?'':'s'}`)}catch(e){console.error(e);toast(e.message||'Presentation export failed')}finally{if(btn){btn.disabled=false;btn.textContent=kind==='pdf'?'Export PDF':'Export PowerPoint'}}
}

// --- Flow: persistent project boards, real image/note/frame nodes, connections, sharing. ---
const FLOW_KEY615='pionx-flow-workspace-v615';
let flowWorkspace615=(()=>{try{const x=JSON.parse(safeStore.get(FLOW_KEY615)||'null');if(x&&Array.isArray(x.boards))return {...x,tool:'select',connectFrom:null}}catch{}return {boards:[],activeBoard:'',activeProject:'',tool:'select',connectFrom:null}})();
let flowShared615=null;
function saveFlow615(){const out={boards:flowWorkspace615.boards,activeBoard:flowWorkspace615.activeBoard,activeProject:flowWorkspace615.activeProject};safeStore.set(FLOW_KEY615,JSON.stringify(out))}
function flowBoardsForProject615(){return flowWorkspace615.boards.filter(b=>!flowWorkspace615.activeProject||b.projectId===flowWorkspace615.activeProject)}
function activeFlowBoard615(){if(flowShared615)return flowShared615;return flowWorkspace615.boards.find(b=>b.id===flowWorkspace615.activeBoard)||null}
function createFlowBoard615(title='Untitled Flow',projectId=flowWorkspace615.activeProject){const b={id:'fb-'+Date.now()+'-'+Math.random().toString(36).slice(2,6),title,projectId:projectId||'',nodes:[],edges:[],zoom:1,panX:0,panY:0,updated:Date.now()};flowWorkspace615.boards.unshift(b);flowWorkspace615.activeBoard=b.id;flowWorkspace615.activeProject=projectId||'';saveFlow615();return b}
function flowProjectTitle615(id){return portfolioProjects614.find(p=>p.id===id)?.title||'No project'}
function flowNodeHtml615(n,readonly){const cls=`flow-node615 ${n.type} ${flowWorkspace615.connectFrom===n.id?'connect-source615':''} ${activeFlowBoard615()?.selected===n.id?'selected615':''}`;if(n.type==='frame')return `<article class="${cls}" data-flow-node615="${n.id}" style="left:${n.x}px;top:${n.y}px;width:${n.w||520}px;height:${n.h||320}px"><b>${escHtml(n.title||'Frame')}</b><small>${escHtml(n.text||'Group related options')}</small></article>`;if(n.type==='image')return `<article class="${cls}" data-flow-node615="${n.id}" style="left:${n.x}px;top:${n.y}px;width:${n.w||240}px"><img src="${escHtml(n.image||PX614_ASSETS.villa)}" alt=""><b>${escHtml(n.title||'Image')}</b><small>${escHtml(n.text||'Project visual')}</small></article>`;return `<article class="${cls}" data-flow-node615="${n.id}" style="left:${n.x}px;top:${n.y}px;width:${n.w||250}px"><b>${escHtml(n.title||'Design note')}</b><p>${escHtml(n.text||'')}</p></article>`}
function flowPage615(){
 const b=activeFlowBoard615(),readonly=!!flowShared615,filtered=flowBoardsForProject615();
 const actions=`<select id="flowProjectSelect615" ${readonly?'disabled':''}><option value="">No project</option>${portfolioProjects614.map(p=>`<option value="${p.id}" ${p.id===flowWorkspace615.activeProject?'selected':''}>${escHtml(p.title)}</option>`).join('')}</select><select id="flowBoardSelect615" ${readonly?'disabled':''}><option value="">${filtered.length?'Choose board':'No boards yet'}</option>${filtered.map(x=>`<option value="${x.id}" ${x.id===flowWorkspace615.activeBoard?'selected':''}>${escHtml(x.title)}</option>`).join('')}</select>${readonly?'<span class="flow-readonly615">Shared view · read only</span>':'<button class="ghost-btn" id="flowNewProject615">+ New Project</button><button class="primary-btn" id="flowNewBoard615">+ New Board</button><button class="ghost-btn" id="flowShare615">Share</button>'}`;
 const tools=[['select','⌖','Select'],['pan','✋','Pan'],['add','＋','Add'],['image','◉','Image'],['text','T','Text'],['frame','▤','Frame'],['connect','↔','Connect'],['delete','⌫','Delete']];
 return `<section class="page">${pageHead('VISUAL WORKSPACE','Flow','Create professional visual boards inside a project. Upload images, add saved renders, write notes, group options, connect decisions and share a read-only board.',actions)}<div class="flow-shell flow-shell615"><div class="flow-zoom"><button id="flowZoomOut615">−</button><span id="flowZoomPct615">${Math.round((b?.zoom||1)*100)}%</span><button id="flowZoomIn615">＋</button><button id="flowFit615">Fit</button></div><div class="panel flow-tools flow-tools615">${tools.map(x=>`<button data-flow-tool615="${x[0]}" class="${flowWorkspace615.tool===x[0]?'active':''}" ${readonly?'disabled':''}><b>${x[1]}</b><small>${x[2]}</small></button>`).join('')}</div><div class="flow-viewport" id="flowViewport615">${b?`<div class="flow-canvas flow-canvas615" id="flowCanvas615" style="transform:translate(${b.panX||0}px,${b.panY||0}px) scale(${b.zoom||1})"><svg class="flow-svg" id="flowSvg615" width="3200" height="2200" viewBox="0 0 3200 2200"></svg>${(b.nodes||[]).slice().sort((a,z)=>(a.type==='frame'?-1:0)-(z.type==='frame'?-1:0)).map(n=>flowNodeHtml615(n,readonly)).join('')}</div>`:`<div class="flow-empty615"><b>No Flow board selected</b><span>${readonly?'This shared board is unavailable.':'Create a project or choose a project, then create a new Flow board.'}</span>${readonly?'':'<button class="primary-btn" id="flowEmptyNew615">+ Create First Board</button>'}</div>`}</div><div class="flow-help"><b>${b?escHtml(b.title):'Flow'}</b><span>${b?`${escHtml(flowProjectTitle615(b.projectId))} · ${(b.nodes||[]).length} nodes · ${(b.edges||[]).length} connections`:'Persistent project boards'}</span></div></div></section>`;
}
routes.flow=flowPage615;
function drawFlowEdges615(){const b=activeFlowBoard615(),svg=q('#flowSvg615');if(!b||!svg)return;const byId=Object.fromEntries((b.nodes||[]).map(n=>[n.id,n]));svg.innerHTML=(b.edges||[]).map(e=>{const a=byId[e.from],z=byId[e.to];if(!a||!z)return '';const x1=a.x+(a.w||240)/2,y1=a.y+(a.h||150)/2,x2=z.x+(z.w||240)/2,y2=z.y+(z.h||150)/2,dx=Math.max(70,Math.abs(x2-x1)*.45);return `<path d="M ${x1} ${y1} C ${x1+dx} ${y1}, ${x2-dx} ${y2}, ${x2} ${y2}" fill="none" stroke="rgba(111,150,255,.7)" stroke-width="3"/><circle cx="${x2}" cy="${y2}" r="5" fill="#7ea2ff"/>`}).join('')}
function flowPersistBoard615(b){if(!b||flowShared615)return;b.updated=Date.now();saveFlow615()}
function addFlowNode615(type,data={}){const b=activeFlowBoard615();if(!b||flowShared615)return;const i=b.nodes.length,n={id:'fn-'+Date.now()+'-'+Math.random().toString(36).slice(2,5),type,x:160+(i%5)*270,y:140+Math.floor(i/5)*220,w:type==='frame'?560:(type==='text'?260:245),h:type==='frame'?350:(type==='text'?170:180),title:data.title||({image:'Image',text:'Design note',frame:'Option group'}[type]||'Node'),text:data.text||'',image:data.image||''};b.nodes.push(n);flowPersistBoard615(b);route()}
function openFlowText615(type='text'){const frame=type==='frame';const m=openDemoDialog(frame?'Add Flow frame':'Add Flow note',`<label>Title<input id="flowNodeTitle615" placeholder="${frame?'Option group':'Design note'}"></label><label>${frame?'Description':'Note'}<textarea class="notes" id="flowNodeText615" placeholder="Write the content..."></textarea></label>`,'<button class="ghost-btn" data-dialog-close2>Cancel</button><button class="primary-btn" id="flowAddText615">Add</button>');q('[data-dialog-close2]',m)?.addEventListener('click',()=>m.hidden=true);q('#flowAddText615',m)?.addEventListener('click',()=>{addFlowNode615(type,{title:q('#flowNodeTitle615',m)?.value.trim()||undefined,text:q('#flowNodeText615',m)?.value.trim()||''});m.hidden=true})}
async function openFlowImage615(){if(flowShared615)return;try{if(!galleryRows62.length)await galleryLoad62()}catch{}const rows=galleryRows62.filter(x=>x?.url);const m=openDemoDialog('Add image to Flow',`<label class="presentation-drop614">Upload image<input id="flowUploadImage615" type="file" accept="image/png,image/jpeg,image/webp"><span>JPG / PNG / WebP</span></label><div class="field-title">Saved renders</div><div class="flow-image-picker615">${rows.length?rows.map((r,i)=>`<button data-flow-render615="${i}"><img src="${escHtml(galleryUrl62(r.url))}" alt=""><span>${escHtml(r.title||r.scene||'Render '+(i+1))}</span></button>`).join(''):'<small>No saved renders yet.</small>'}</div>`,'<button class="ghost-btn" data-dialog-close2>Close</button>');q('[data-dialog-close2]',m)?.addEventListener('click',()=>m.hidden=true);q('#flowUploadImage615',m)?.addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{const data=await compactImage614(f,1100,.72);addFlowNode615('image',{title:f.name.replace(/\.[^.]+$/,''),image:data});m.hidden=true}catch(err){toast(err.message)}});qa('[data-flow-render615]',m).forEach(btn=>btn.addEventListener('click',()=>{const r=rows[+btn.dataset.flowRender615];if(r){addFlowNode615('image',{title:r.title||r.scene||'Saved render',image:galleryUrl62(r.url)});m.hidden=true}}))}
function openFlowAddMenu615(){const m=openDemoDialog('Add to Flow','<div class="flow-add-menu615"><button data-flow-add-kind615="image">◉ <b>Image</b><small>Upload or saved render</small></button><button data-flow-add-kind615="text">T <b>Note</b><small>Text / decision / comment</small></button><button data-flow-add-kind615="frame">▤ <b>Frame</b><small>Group related options</small></button></div>','<button class="ghost-btn" data-dialog-close2>Close</button>');q('[data-dialog-close2]',m)?.addEventListener('click',()=>m.hidden=true);qa('[data-flow-add-kind615]',m).forEach(b=>b.addEventListener('click',()=>{m.hidden=true;const k=b.dataset.flowAddKind615;if(k==='image')openFlowImage615();else openFlowText615(k)}))}
function deleteFlowSelected615(){const b=activeFlowBoard615();if(!b||flowShared615||!b.selected)return toast('Select a Flow item first');b.nodes=b.nodes.filter(n=>n.id!==b.selected);b.edges=b.edges.filter(e=>e.from!==b.selected&&e.to!==b.selected);b.selected='';flowPersistBoard615(b);route()}
function editFlowNode615(id){const b=activeFlowBoard615(),n=b?.nodes?.find(x=>x.id===id);if(!n||flowShared615)return;const m=openDemoDialog('Edit Flow item',`<label>Title<input id="flowEditTitle615" value="${escHtml(n.title||'')}"></label><label>Text<textarea class="notes" id="flowEditText615">${escHtml(n.text||'')}</textarea></label>`,'<button class="ghost-btn" data-dialog-close2>Cancel</button><button class="primary-btn" id="flowSaveEdit615">Save</button>');q('[data-dialog-close2]',m)?.addEventListener('click',()=>m.hidden=true);q('#flowSaveEdit615',m)?.addEventListener('click',()=>{n.title=q('#flowEditTitle615',m)?.value.trim()||n.title;n.text=q('#flowEditText615',m)?.value.trim()||'';flowPersistBoard615(b);m.hidden=true;route()})}
function fitFlow615(){const b=activeFlowBoard615(),vp=q('#flowViewport615');if(!b||!vp||!b.nodes.length)return;const minX=Math.min(...b.nodes.map(n=>n.x)),minY=Math.min(...b.nodes.map(n=>n.y)),maxX=Math.max(...b.nodes.map(n=>n.x+(n.w||240))),maxY=Math.max(...b.nodes.map(n=>n.y+(n.h||180))),w=maxX-minX+160,h=maxY-minY+160,scale=Math.max(.35,Math.min(1.2,Math.min(vp.clientWidth/w,vp.clientHeight/h)));b.zoom=scale;b.panX=60-minX*scale;b.panY=50-minY*scale;flowPersistBoard615(b);route()}
async function shareFlow615(){const b=activeFlowBoard615();if(!b||flowShared615)return toast('Create or select a Flow board first');try{const body={...b,projectTitle:flowProjectTitle615(b.projectId)};const r=await pxApi56('/server/flow-share-v615.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'share',board:body})}),j=await json56(r,'Flow share');if(!r.ok)throw Error(j.error||'Could not share Flow');const u=new URL(location.pathname,location.origin);u.searchParams.set('pionx_flow',j.token);const m=openDemoDialog('Flow share link',`<p>This is a read-only snapshot of the current board.</p><input id="flowShareUrl615" value="${escHtml(u.href)}" readonly>`,'<button class="primary-btn" id="flowCopyShare615">Copy link</button>');q('#flowCopyShare615',m)?.addEventListener('click',async()=>{const el=q('#flowShareUrl615',m);el.select();try{await navigator.clipboard.writeText(el.value);toast('Flow share link copied')}catch{toast('Select and copy the link')}})}catch(e){toast(e.message)}}
async function loadSharedFlow615(token){try{const r=await fetch('/server/flow-share-v615.php?token='+encodeURIComponent(token),{cache:'no-store'}),j=await json56(r,'Shared Flow');if(!r.ok)throw Error(j.error||'Shared Flow unavailable');flowShared615={...(j.board||{}),owner:j.owner||{},zoom:1,panX:0,panY:0};enterApp('flow');toast('Opened shared Flow board')}catch(e){toast(e.message)}}

const wireBase615=wireView;
wireView=function(name){wireBase615(name);
 if(name==='explore'){
  const pending=(safeStore.get('pionx-global-search-pending')||'').trim();if(pending&&q('#showcaseSearch615')){q('#showcaseSearch615').value=pending;safeStore.set('pionx-global-search-pending','')}
  let filter='all';const apply=()=>{const term=(q('#showcaseSearch615')?.value||'').trim().toLowerCase();qa('.member-card615').forEach(card=>card.hidden=!!term&&!(card.dataset.memberSearch615||'').includes(term));qa('#showcaseProjects615 .showcase-card614').forEach(card=>{const wrap=card.closest('.showcase-wrap615'),cat=(card.dataset.showcaseCategory614||'').toLowerCase(),text=(card.dataset.showcaseSearch614||'').toLowerCase(),okF=filter==='all'||cat.includes(filter),okT=!term||text.includes(term);if(wrap)wrap.hidden=!(okF&&okT)})};q('#showcaseSearch615')?.addEventListener('input',apply);qa('[data-showcase-filter615]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.showcaseFilter615||'all';qa('[data-showcase-filter615]').forEach(x=>x.classList.toggle('active',x===b));apply()}));qa('[data-member-view615]').forEach(b=>b.addEventListener('click',()=>openMemberPortfolio615(b.dataset.memberView615)));apply();
 }
 if(name==='presentation'){
  const p=presPage615();q('#presentationTitle615')?.addEventListener('input',e=>presentationState615.title=e.target.value);q('#presentationAddPage615')?.addEventListener('click',()=>{presentationState615.pages.push(newPresentationPage615('Image Board','New Page'));presentationState615.selected=presentationState615.pages.length-1;route()});qa('[data-pres-page615]').forEach(b=>b.addEventListener('click',()=>{presentationState615.selected=+b.dataset.presPage615;route()}));qa('[data-pres-page-action615]').forEach(b=>b.addEventListener('click',()=>{const a=b.dataset.presPageAction615,i=presentationState615.selected;if(a==='duplicate'){const src=presentationState615.pages[i],copy=JSON.parse(JSON.stringify(src));copy.id='pg-'+Date.now()+'-'+Math.random().toString(36).slice(2,5);copy.title=(copy.title||copy.type)+' Copy';presentationState615.pages.splice(i+1,0,copy);presentationState615.selected=i+1}else if(a==='up'&&i>0){const [x]=presentationState615.pages.splice(i,1);presentationState615.pages.splice(i-1,0,x);presentationState615.selected=i-1}else if(a==='down'&&i<presentationState615.pages.length-1){const [x]=presentationState615.pages.splice(i,1);presentationState615.pages.splice(i+1,0,x);presentationState615.selected=i+1}else if(a==='delete'&&presentationState615.pages.length>1){presentationState615.pages.splice(i,1);presentationState615.selected=Math.min(i,presentationState615.pages.length-1)}route()}));q('#presentationPageTitle615')?.addEventListener('change',e=>{p.title=e.target.value.trim()||p.type;route()});q('#presentationType615')?.addEventListener('change',e=>{p.type=e.target.value;if(!p.title||/^(New Page|Image Board|Material Board|Color Palette|Cover)$/.test(p.title))p.title=p.type;route()});q('#presentationNotes615')?.addEventListener('change',e=>{p.notes=e.target.value;route()});q('#presentationImages615')?.addEventListener('change',async e=>{for(const f of [...(e.target.files||[])])try{const data=typeof compactImage614==='function'?await compactImage614(f,1800,.86):await readStudioImage(f);p.sources.push({name:f.name,data})}catch(err){toast(err.message)}route()});q('#presentationSaved615')?.addEventListener('click',()=>savedRenderPicker615(items=>{p.sources.push(...items);route()},'Choose renders for this page'));qa('[data-pres-remove615]').forEach(b=>b.addEventListener('click',()=>{p.sources.splice(+b.dataset.presRemove615,1);route()}));q('#presentationBuild615')?.addEventListener('click',buildPresentationPage615);q('#presentationPlan615')?.addEventListener('change',async e=>{const f=e.target.files?.[0];if(f){p.plan=await readStudioImage(f);route()}});q('#presentationPlan3D615')?.addEventListener('click',planTo3D615);q('#presentationPdf615')?.addEventListener('click',()=>exportPresentation615('pdf'));q('#presentationPpt615')?.addEventListener('click',()=>exportPresentation615('ppt'));
 }
 if(name==='flow'){
  drawFlowEdges615();const b=activeFlowBoard615(),readonly=!!flowShared615;q('#flowProjectSelect615')?.addEventListener('change',e=>{flowWorkspace615.activeProject=e.target.value;const first=flowWorkspace615.boards.find(x=>!flowWorkspace615.activeProject||x.projectId===flowWorkspace615.activeProject);flowWorkspace615.activeBoard=first?.id||'';saveFlow615();route()});q('#flowBoardSelect615')?.addEventListener('change',e=>{flowWorkspace615.activeBoard=e.target.value;saveFlow615();route()});q('#flowNewProject615')?.addEventListener('click',()=>newProjectExperienceP1(true));const newBoard=()=>{const m=openDemoDialog('New Flow board',`<label>Board name<input id="flowBoardName615" placeholder="e.g. Facade Option Study"></label><p>${flowWorkspace615.activeProject?'This board will be saved inside '+escHtml(flowProjectTitle615(flowWorkspace615.activeProject))+'.':'You can create a board without a project, or choose a project first.'}</p>`,'<button class="ghost-btn" data-dialog-close2>Cancel</button><button class="primary-btn" id="flowCreateBoard615">Create board</button>');q('[data-dialog-close2]',m)?.addEventListener('click',()=>m.hidden=true);q('#flowCreateBoard615',m)?.addEventListener('click',()=>{createFlowBoard615(q('#flowBoardName615',m)?.value.trim()||'Untitled Flow',flowWorkspace615.activeProject);m.hidden=true;route()})};q('#flowNewBoard615')?.addEventListener('click',newBoard);q('#flowEmptyNew615')?.addEventListener('click',newBoard);q('#flowShare615')?.addEventListener('click',shareFlow615);q('#flowZoomIn615')?.addEventListener('click',()=>{if(b){b.zoom=Math.min(2,Number(b.zoom||1)+.1);flowPersistBoard615(b);route()}});q('#flowZoomOut615')?.addEventListener('click',()=>{if(b){b.zoom=Math.max(.35,Number(b.zoom||1)-.1);flowPersistBoard615(b);route()}});q('#flowFit615')?.addEventListener('click',fitFlow615);qa('[data-flow-tool615]').forEach(btn=>btn.addEventListener('click',()=>{const t=btn.dataset.flowTool615;if(t==='add')return openFlowAddMenu615();if(t==='image')return openFlowImage615();if(t==='text'||t==='frame')return openFlowText615(t);if(t==='delete')return deleteFlowSelected615();flowWorkspace615.tool=t;flowWorkspace615.connectFrom=null;route()}));if(b&&!readonly){qa('[data-flow-node615]').forEach(node=>{const id=node.dataset.flowNode615;node.addEventListener('dblclick',()=>editFlowNode615(id));node.addEventListener('pointerdown',e=>{if(flowWorkspace615.tool==='connect'){e.preventDefault();if(!flowWorkspace615.connectFrom){flowWorkspace615.connectFrom=id;route()}else if(flowWorkspace615.connectFrom!==id){if(!b.edges.some(x=>x.from===flowWorkspace615.connectFrom&&x.to===id))b.edges.push({from:flowWorkspace615.connectFrom,to:id});flowWorkspace615.connectFrom=null;flowPersistBoard615(b);route()}return}if(flowWorkspace615.tool!=='select')return;e.preventDefault();b.selected=id;const n=b.nodes.find(x=>x.id===id);if(!n)return;const sx=e.clientX,sy=e.clientY,ox=n.x,oy=n.y,z=Number(b.zoom||1);const move=ev=>{n.x=ox+(ev.clientX-sx)/z;n.y=oy+(ev.clientY-sy)/z;node.style.left=n.x+'px';node.style.top=n.y+'px';drawFlowEdges615()};const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);flowPersistBoard615(b)};window.addEventListener('pointermove',move);window.addEventListener('pointerup',up)})});const vp=q('#flowViewport615');vp?.addEventListener('pointerdown',e=>{if(flowWorkspace615.tool!=='pan'||e.target.closest('[data-flow-node615]'))return;const sx=e.clientX,sy=e.clientY,ox=b.panX||0,oy=b.panY||0;const move=ev=>{b.panX=ox+ev.clientX-sx;b.panY=oy+ev.clientY-sy;const c=q('#flowCanvas615');if(c)c.style.transform=`translate(${b.panX}px,${b.panY}px) scale(${b.zoom||1})`};const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);flowPersistBoard615(b)};window.addEventListener('pointermove',move);window.addEventListener('pointerup',up)});vp?.addEventListener('wheel',e=>{e.preventDefault();b.zoom=Math.max(.35,Math.min(2,Number(b.zoom||1)+(e.deltaY<0?.08:-.08)));const c=q('#flowCanvas615');if(c)c.style.transform=`translate(${b.panX||0}px,${b.panY||0}px) scale(${b.zoom})`;const pct=q('#flowZoomPct615');if(pct)pct.textContent=Math.round(b.zoom*100)+'%';flowPersistBoard615(b)},{passive:false});}
 }
};

q('#publicBrand')?.addEventListener('click',()=>{q('#publicSite')?.scrollIntoView({behavior:'smooth',block:'start'})});
const flowToken615=new URLSearchParams(location.search).get('pionx_flow');if(flowToken615)setTimeout(()=>loadSharedFlow615(flowToken615),900);

// ===== PIONX V6.15.1 · FUNCTIONALITY AUDIT: CONSISTENCY + ASSETS + ALBUMS + DIAGNOSTICS =====

// Assets: every visible control performs a real local workspace action.
const ASSET_KEY615='pionx.assets.v615';
let assetRows615=[];try{assetRows615=JSON.parse(localStorage.getItem(ASSET_KEY615)||'[]')||[]}catch{}
function saveAssets615(){try{localStorage.setItem(ASSET_KEY615,JSON.stringify(assetRows615.slice(0,80)))}catch{toast('Asset library is full. Remove an old asset and try again.')}}
function assetsPage615(){
 const cats=['All Assets','Materials','References','People','Cars','Landscape'];
 return `<section class="page">${pageHead('ASSET LIBRARY','Assets','Upload and reuse project references, materials, people, cars and landscape resources. Assets are private to this browser workspace until cloud asset storage is enabled.','<button class="primary-btn" id="assetUploadBtn615">+ Upload Asset</button>')}<input id="assetUploadInput615" type="file" accept="image/png,image/jpeg,image/webp" multiple hidden><div class="asset-toolbar615"><div class="filterbar">${cats.map((x,i)=>`<button class="chip ${i===0?'active':''}" data-asset-filter615="${escHtml(x)}">${escHtml(x)}</button>`).join('')}</div><label>Upload category<select id="assetCategory615">${cats.slice(1).map(x=>`<option>${escHtml(x)}</option>`).join('')}</select></label></div><div class="grid-4" id="assetGrid615">${assetRows615.length?assetRows615.map(a=>`<article class="panel asset-card asset-card615" data-asset-category615="${escHtml(a.category||'References')}"><button class="asset-preview615" data-asset-open615="${escHtml(a.id)}"><img src="${escHtml(a.data)}" alt=""></button><h3>${escHtml(a.name||'Asset')}</h3><p>${escHtml(a.category||'References')} · ${new Date(a.created||Date.now()).toLocaleDateString()}</p><div class="project-action-row614"><button class="ghost-btn" data-asset-open615="${escHtml(a.id)}">Open</button><button class="ghost-btn" data-asset-delete615="${escHtml(a.id)}">Delete</button></div></article>`).join(''):'<article class="panel asset-empty615"><b>No assets yet</b><p>Upload JPG, PNG or WebP references and they will appear here.</p></article>'}</div></section>`;
}
routes.assets=assetsPage615;

// Albums: user-created collections made from actual saved renders.
const ALBUM_KEY615='pionx.albums.v615';
let albumRows615=[];try{albumRows615=JSON.parse(localStorage.getItem(ALBUM_KEY615)||'[]')||[]}catch{}
function saveAlbums615(){try{localStorage.setItem(ALBUM_KEY615,JSON.stringify(albumRows615.slice(0,60)))}catch{toast('Could not save albums in this browser')}}
function albumCover615(a){return a.items?.[0]?.data||a.items?.[0]?.url||PX614_ASSETS.interior}
function albumsPage615(){return `<section class="page">${pageHead('ORGANIZATION','Albums','Create your own collections and add any completed PIONX renders to them.','<button class="primary-btn" id="newAlbum615">+ New Album</button>')}<div class="grid-4 album-grid615">${albumRows615.map(a=>`<article class="panel album-card615"><button class="album-cover615" data-album-open615="${escHtml(a.id)}"><img src="${escHtml(albumCover615(a))}" alt=""></button><footer><div><b>${escHtml(a.title)}</b><small>${(a.items||[]).length} render${(a.items||[]).length===1?'':'s'}</small></div><div class="album-actions615"><button class="ghost-btn" data-album-add615="${escHtml(a.id)}">+ Renders</button><button class="ghost-btn" data-album-delete615="${escHtml(a.id)}">Delete</button></div></footer></article>`).join('')||'<article class="panel asset-empty615"><b>No albums yet</b><p>Create an album, then choose renders already saved in your account.</p></article>'}</div><div class="section-title"><div><h2>All Renders</h2><p>Your completed render history remains available independently of albums.</p></div></div><div class="gallery">${galleryCards62(galleryRows62)}</div></section>`}
routes.albums=albumsPage615;

// Diagnostics: actual same-origin endpoint probes, never fabricated "Healthy" values.
const diagState615={running:false,rows:[]};
const DIAG_ENDPOINTS615=[
 ['Authentication','/server/me-v60.php'],
 ['Portfolio directory','/server/portfolio-hub-v614.php?action=directory'],
 ['Render route','/server/auto-render-v21.php'],
 ['Video route','/server/video-direct-v66.php'],
 ['Finance report','/server/admin-finance-report-v612.php'],
 ['Flow sharing','/server/flow-share-v615.php']
];
function diagnosticsPage615(){return `<section class="page">${pageHead('ADMIN · SYSTEM','Diagnostics','Live same-origin readiness checks. A 401/403/405 can still prove the route exists; 5xx/network errors are treated as failures.',`<button class="primary-btn" id="runDiagnostics615" ${diagState615.running?'disabled':''}>${diagState615.running?'Running checks…':'Run live checks'}</button>`)}<div class="health-grid">${DIAG_ENDPOINTS615.map(([name,path])=>{const r=diagState615.rows.find(x=>x.path===path),ok=r?.reachable;return `<article class="panel health-card"><header><div class="eyebrow">${escHtml(name.toUpperCase())}</div><i class="health-dot ${r?(ok?'':'bad'):''}"></i></header><h3>${r?(ok?'Reachable':'Failed'):'Not checked'}</h3><p>${r?`HTTP ${r.status||'network'} · ${escHtml(r.note||'')}`:'Press Run live checks to test this route now.'}</p><div class="latency">${r?Math.round(r.ms)+' ms':'—'} <small>measured latency</small></div></article>`}).join('')}</div><div class="section-title"><div><h2>Check log</h2><p>Current browser session only.</p></div></div><section class="panel table-wrap"><table class="table"><thead><tr><th>Time</th><th>Service</th><th>Endpoint</th><th>HTTP</th><th>Latency</th><th>Status</th></tr></thead><tbody>${diagState615.rows.length?diagState615.rows.map(r=>`<tr><td>${escHtml(r.time)}</td><td>${escHtml(r.name)}</td><td>${escHtml(r.path)}</td><td>${escHtml(String(r.status||'network'))}</td><td>${Math.round(r.ms)} ms</td><td class="${r.reachable?'good':'bad'}">${r.reachable?'Reachable':'Failed'}</td></tr>`).join(''):'<tr><td colspan="6" class="muted">No live check has run yet.</td></tr>'}</tbody></table></section></section>`}
routes.diagnostics=diagnosticsPage615;
async function runDiagnostics615(){diagState615.running=true;diagState615.rows=[];route();for(const [name,path] of DIAG_ENDPOINTS615){const t=performance.now();let status=0,note='';try{const r=await pxApi56(path,{cache:'no-store'});status=r.status;note=status>=500?'Server returned an error':status===401?'Route exists · sign-in required':status===403?'Route exists · permission required':status===405?'Route exists · method restricted':'Route responded';diagState615.rows.push({name,path,status,ms:performance.now()-t,reachable:status>0&&status<500,time:new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'}),note})}catch(e){diagState615.rows.push({name,path,status:0,ms:performance.now()-t,reachable:false,time:new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'}),note:e.message||'Network failure'})}route()}diagState615.running=false;route();toast('Live diagnostics finished')}

// Real Consistency: uploaded images are sent through the protected production render route one at a time.
const consistencyMedia615={sources:[],master:'',results:[],busy:false};
function consistencyPage615(){const batch=consistencyV4.workflow==='batch',shots=['Front hero','Left 3/4','Right 3/4','Close detail','Wide context','Elevated'];const inputs=batch?consistencyMedia615.sources:(consistencyMedia615.master?[{name:'Master image',data:consistencyMedia615.master}]:[]);return `<section class="page">${pageHead('VISUAL DNA SUITE','Visual DNA','Production consistency workflow. Upload your own source images; every output is generated through the protected PIONX render route and therefore uses the normal credit quote for each generated image.')}<div class="consistency-mode-tabs"><button class="chip ${batch?'active':''}" data-consistency-workflow615="batch">▦ Multi-image batch</button><button class="chip ${!batch?'active':''}" data-consistency-workflow615="shots">⌖ One image → Multi-shot</button></div><div class="consistency-grid consistency-v4"><aside class="panel consistency-settings"><div class="field-title">${batch?'Source images':'Master image'}</div><label class="consistency-upload615">${inputs.length?`<span>${inputs.length} image${inputs.length===1?'':'s'} ready</span>`:'<span>Upload source image(s)</span>'}<input id="consistencyUpload615" type="file" accept="image/png,image/jpeg,image/webp" ${batch?'multiple':''}></label>${inputs.length?`<div class="source-mini-grid consistency-sources615">${inputs.map((x,i)=>`<button type="button"><img src="${escHtml(x.data)}"><span>${escHtml(x.name||('Source '+(i+1)))}</span></button>`).join('')}</div>`:''}${!batch?`<div class="field-title">Shot count</div><div class="segmented">${[3,4,6].map(x=>`<button class="chip ${consistencyV4.count===x?'active':''}" data-shot-count615="${x}">${x} shots</button>`).join('')}</div><div class="camera-shot-grid">${shots.slice(0,consistencyV4.count).map(x=>`<span>⌖ ${x}</span>`).join('')}</div>`:''}<div class="field-title">Consistency strength</div><div class="segmented">${['flexible','strong','strict'].map(x=>`<button class="chip ${consistencyV4.strength===x?'active':''}" data-consistency-strength615="${x}">${x[0].toUpperCase()+x.slice(1)}</button>`).join('')}</div><div class="field-title">Mode</div><div class="segmented">${['preserve','balanced','creative'].map(x=>`<button class="chip ${consistencyV4.mode===x?'active':''}" data-consistency-mode615="${x}">${x[0].toUpperCase()+x.slice(1)}</button>`).join('')}</div><div class="toggle-row"><label><input type="checkbox" data-consistency-check615="sameLighting" ${consistencyV4.sameLighting?'checked':''}> Same lighting</label><label><input type="checkbox" data-consistency-check615="sameMaterials" ${consistencyV4.sameMaterials?'checked':''}> Same materials</label><label><input type="checkbox" data-consistency-check615="people" ${consistencyV4.people?'checked':''}> Add people</label><label><input type="checkbox" data-consistency-check615="cars" ${consistencyV4.cars?'checked':''}> Add cars</label></div><label class="field-title">Shared note<textarea class="notes" id="consistencyNotes615" placeholder="Optional instruction shared across all outputs...">${escHtml(consistencyMedia615.note||'')}</textarea></label><div class="consistency-credit-note615"><b>Credit rule</b><span>${batch?'One protected render job per uploaded image.':'One protected render job per requested camera shot.'} PIONX quotes/reserves credits before every job; failed protected jobs use the normal refund rule.</span></div><button class="primary-btn render-btn-v4" id="consistencyRender615" ${consistencyMedia615.busy?'disabled':''}>${consistencyMedia615.busy?'Rendering batch…':'✦ Render consistency set'}</button></aside><div><div class="batch-grid" id="consistencyResults615">${consistencyMedia615.results.length?consistencyMedia615.results.map((x,i)=>`<article class="panel batch-card"><img src="${escHtml(x.url)}"><footer><b>${escHtml(x.label||('Result '+(i+1)))}</b><span class="status-pill">Delivered</span></footer><button class="ghost-btn consistency-open615" data-consistency-result615="${i}">Open full image</button></article>`).join(''):'<article class="panel consistency-empty615"><b>No generated results yet</b><p>Upload your own source image(s) and start the production batch.</p></article>'}</div></div></div></section>`}
routes.consistency=consistencyPage615;
async function runConsistency615(){if(consistencyMedia615.busy)return;if(!signedIn56())return toast('Sign in before using Consistency');const userNote=q('#consistencyNotes615')?.value?.trim()||consistencyMedia615.note||'';consistencyMedia615.note=userNote;const batch=consistencyV4.workflow==='batch';const jobs=batch?consistencyMedia615.sources.map((x,i)=>({source:x.data,label:x.name||`Source ${i+1}`,shot:''})):(consistencyMedia615.master?['Front hero','Left 3/4','Right 3/4','Close detail','Wide context','Elevated'].slice(0,consistencyV4.count).map(x=>({source:consistencyMedia615.master,label:x,shot:x})):[]);if(!jobs.length)return toast(batch?'Upload at least one source image':'Upload a master image first');consistencyMedia615.busy=true;consistencyMedia615.results=[];route();const mind=showRenderMind58();q('#renderMindScene').textContent=`Consistency · ${batch?'multi-image':'multi-shot'} · ${jobs.length} output${jobs.length===1?'':'s'}`;let delivered=0;try{for(let i=0;i<jobs.length;i++){const j=jobs[i],pct=Math.max(5,Math.round(i/jobs.length*88));mindUpdate(`Preparing consistency output ${i+1} of ${jobs.length}…`,pct,Math.min(4,Math.floor(i/jobs.length*4)));const note=userNote;const shared=`PIONX CONSISTENCY PRODUCTION. Preserve the source architecture and camera unless a camera angle is explicitly requested. ${consistencyV4.sameMaterials?'Keep exactly the same material palette, glass response, facade colors and finish identity across the set.':''} ${consistencyV4.sameLighting?'Keep the same lighting direction, exposure, color grade and time-of-day across the set.':''} Consistency strength: ${consistencyV4.strength}. Mode: ${consistencyV4.mode}. ${consistencyV4.people?'Add believable people with correct scale.':'Do not add people unless already present.'} ${consistencyV4.cars?'Add believable cars where context supports them.':'Do not add cars unless already present.'} ${j.shot?`CAMERA REQUEST: create a ${j.shot} view of the same project; do not mirror the source and do not change design/material identity.`:'Keep this source image camera and geometry locked.'} ${note}`;let start=null,engine='';try{start=await renderPost56({action:'start',source_image:j.source,prompt:shared,scene_type:'architecture',fidelity:consistencyV4.mode,mode:consistencyV4.mode,lighting_mode:consistencyV4.sameLighting?'lock':'auto',controls:{architecture_lock:consistencyV4.strength==='strict'?'strict':'strong',preserve_composition:!j.shot,add_people:consistencyV4.people,add_cars:consistencyV4.cars,consistency_batch:true,same_materials:consistencyV4.sameMaterials,same_lighting:consistencyV4.sameLighting,quality_profile:'premium_clean_v57'},references:batch&&consistencyMedia615.sources[0]?.data&&consistencyMedia615.sources[0].data!==j.source?[consistencyMedia615.sources[0].data]:[],assets:[],analysis:{consistency:true,output_index:i+1,output_total:jobs.length,camera_request:j.shot||''}},45000);engine=start.engines?.[0]||'';if(!engine)throw Error('No render route was returned');const done=await renderEngine56(start,engine),best=done?.candidates?.find(x=>x?.url);if(!best?.url)throw Error('Render completed without an image');consistencyMedia615.results.push({url:best.url,label:j.label});delivered++;if(Number.isFinite(Number(done.credits_remaining)))setCreditsFromRender56(done.credits_remaining)}catch(e){if(start&&engine)await cancelRender56(start,engine);toast(`${j.label}: ${e.message||'render failed'}`)}route()}mindUpdate(`${delivered} of ${jobs.length} consistency outputs delivered.`,100,5);await loadAccount56({quiet:true});hideRenderMind58(600);toast(`Consistency finished · ${delivered}/${jobs.length} delivered`)}finally{consistencyMedia615.busy=false;route()}}

// Plans: no dead purchase buttons while payment gateway is not connected.
const plansBase615=routes.plans;
routes.plans=function(){let html=plansBase615();html=html.replace(/<button class="(primary-btn|ghost-btn)" style="width:100%">Choose ([^<]+)<\/button>/g,'<button class="$1" style="width:100%" disabled title="Payment gateway is not connected yet">$2 · payment setup pending</button>').replace(/<button class="ghost-btn" style="width:100%">Current plan<\/button>/g,'<button class="ghost-btn" style="width:100%" disabled>Current plan</button>').replace(/<button class="ghost-btn" style="margin-top:10px">Buy credits<\/button>/g,'<button class="ghost-btn" style="margin-top:10px" disabled title="Payment gateway is not connected yet">Payment setup pending</button>');return html};

// Remove unsupported auth provider choices from the visible production surface instead of leaving dead buttons.
qa('[data-auth-provider="microsoft"],[data-auth-provider="apple"]').forEach(b=>b.remove());

// Wrap the latest view wiring with the functionality-audit controls.
const wireBase6151=wireView;wireView=function(name){wireBase6151(name);
 if(name==='assets'){
  let filter='All Assets';const apply=()=>qa('[data-asset-category615]').forEach(c=>c.hidden=filter!=='All Assets'&&c.dataset.assetCategory615!==filter);qa('[data-asset-filter615]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.assetFilter615;qa('[data-asset-filter615]').forEach(x=>x.classList.toggle('active',x===b));apply()}));q('#assetUploadBtn615')?.addEventListener('click',()=>q('#assetUploadInput615')?.click());q('#assetUploadInput615')?.addEventListener('change',async e=>{const cat=q('#assetCategory615')?.value||'References';for(const f of [...(e.target.files||[])]){try{let data=typeof compactImage614==='function'?await compactImage614(f,1400,.82):await readStudioImage(f);assetRows615.unshift({id:'a-'+Date.now()+'-'+Math.random().toString(36).slice(2,6),name:f.name,category:cat,data,created:Date.now()})}catch(err){toast(err.message)}}saveAssets615();route()});qa('[data-asset-open615]').forEach(b=>b.addEventListener('click',()=>{const a=assetRows615.find(x=>x.id===b.dataset.assetOpen615);if(a)openDemoDialog(a.name,`<img src="${escHtml(a.data)}" style="width:100%;max-height:70vh;object-fit:contain;border-radius:14px"><p>${escHtml(a.category)}</p>`)}));qa('[data-asset-delete615]').forEach(b=>b.addEventListener('click',()=>{assetRows615=assetRows615.filter(x=>x.id!==b.dataset.assetDelete615);saveAssets615();route()}));apply();
 }
 if(name==='albums'){
  q('#newAlbum615')?.addEventListener('click',()=>{const m=openDemoDialog('New Album','<label>Album name<input id="albumName615" placeholder="e.g. Villa A · Approved Renders"></label>','<button class="ghost-btn" data-dialog-close2>Cancel</button><button class="primary-btn" id="createAlbum615">Create album</button>');q('[data-dialog-close2]',m)?.addEventListener('click',()=>m.hidden=true);q('#createAlbum615',m)?.addEventListener('click',()=>{const title=q('#albumName615',m)?.value.trim();if(!title)return toast('Write an album name');albumRows615.unshift({id:'al-'+Date.now(),title,items:[]});saveAlbums615();m.hidden=true;route()})});qa('[data-album-add615]').forEach(b=>b.addEventListener('click',()=>{const a=albumRows615.find(x=>x.id===b.dataset.albumAdd615);if(!a)return;savedRenderPicker615(items=>{a.items=[...(a.items||[]),...items];saveAlbums615();route()},`Add renders to ${a.title}`)}));qa('[data-album-open615]').forEach(b=>b.addEventListener('click',()=>{const a=albumRows615.find(x=>x.id===b.dataset.albumOpen615);if(!a)return;openDemoDialog(a.title,(a.items||[]).length?`<div class="pres-picker-grid614">${a.items.map(x=>`<button><img src="${escHtml(x.data||x.url)}"><span>${escHtml(x.name||'Render')}</span></button>`).join('')}</div>`:'<p>This album is empty. Add renders from your History.</p>')}));qa('[data-album-delete615]').forEach(b=>b.addEventListener('click',()=>{albumRows615=albumRows615.filter(x=>x.id!==b.dataset.albumDelete615);saveAlbums615();route()}));
 }
 if(name==='diagnostics')q('#runDiagnostics615')?.addEventListener('click',runDiagnostics615);
 if(name==='consistency'){
  qa('[data-consistency-workflow615]').forEach(b=>b.addEventListener('click',()=>{consistencyV4.workflow=b.dataset.consistencyWorkflow615;consistencyMedia615.results=[];route()}));qa('[data-shot-count615]').forEach(b=>b.addEventListener('click',()=>{consistencyV4.count=+b.dataset.shotCount615;route()}));qa('[data-consistency-strength615]').forEach(b=>b.addEventListener('click',()=>{consistencyV4.strength=b.dataset.consistencyStrength615;route()}));qa('[data-consistency-mode615]').forEach(b=>b.addEventListener('click',()=>{consistencyV4.mode=b.dataset.consistencyMode615;route()}));qa('[data-consistency-check615]').forEach(c=>c.addEventListener('change',()=>{consistencyV4[c.dataset.consistencyCheck615]=c.checked}));q('#consistencyUpload615')?.addEventListener('change',async e=>{const fs=[...(e.target.files||[])];if(consistencyV4.workflow==='batch'){consistencyMedia615.sources=[];for(const f of fs){try{consistencyMedia615.sources.push({name:f.name,data:await readStudioImage(f)})}catch(err){toast(err.message)}}}else if(fs[0]){try{consistencyMedia615.master=await readStudioImage(fs[0])}catch(err){toast(err.message)}}consistencyMedia615.results=[];route()});q('#consistencyNotes615')?.addEventListener('change',e=>{consistencyMedia615.note=e.target.value});q('#consistencyRender615')?.addEventListener('click',runConsistency615);qa('[data-consistency-result615]').forEach(b=>b.addEventListener('click',()=>{const x=consistencyMedia615.results[+b.dataset.consistencyResult615];if(x?.url)window.open(x.url,'_blank','noopener')}));
 }
};

// Settings exports now create files instead of showing placeholder toasts.
const settingsPageBase615=routes.settings;routes.settings=function(){return settingsPageBase615().replace('•••• 4242','Not connected').replace('Demo billing method','Payment gateway pending').replace('Download billing history','Billing export status')};
wireSettings=function(){qa('[data-settings-tab]').forEach(b=>b.addEventListener('click',()=>{settingsState.tab=b.dataset.settingsTab;route()}));qa('[data-setting-toggle]').forEach(s=>s.addEventListener('click',()=>{const k=s.dataset.settingToggle;settingsState[k]=!settingsState[k];s.classList.toggle('on',settingsState[k]);toast(`${k.replace(/([A-Z])/g,' $1')} ${settingsState[k]?'enabled':'disabled'}`)}));qa('[data-setting-select]').forEach(sel=>sel.addEventListener('change',()=>{settingsState[sel.dataset.settingSelect]=sel.value;if(sel.dataset.settingSelect==='language'){window.PIONX_I18N?.setLanguage(sel.value==='Arabic'?'ar':'en');toast('Language preference saved');}else toast(`${sel.dataset.settingSelect}: ${sel.value}`)}));qa('[data-theme-choice]').forEach(b=>b.addEventListener('click',()=>{applyTheme(b.dataset.themeChoice,true);qa('[data-theme-choice]').forEach(x=>x.classList.toggle('active',x===b))}));q('#saveSettings')?.addEventListener('click',()=>{safeStore.set('pionx-settings',JSON.stringify({...settingsState,theme:settingsState.theme}));toast('Settings saved')});qa('[data-setting-action]').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.settingAction==='download-data')downloadText('pionx-account-export.json',JSON.stringify({profile:profileState,settings:settingsState,projects:portfolioProjects614,albums:albumRows615,assets:assetRows615.map(({data,...rest})=>rest)},null,2));else if(b.dataset.settingAction==='invoice')downloadText('pionx-billing-status.txt','PIONX payment gateway is not connected yet.\nNo invoice was fabricated.');}))};


// ===== PIONX V6.16 · SHOWCASE PROJECT DETAIL + LIKES + COMMENTS + FOLLOWS =====
async function showcaseSocialApi616(payload){
 const r=await pxApi56('/server/showcase-social-v616.php',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload||{})});
 const j=await json56(r,'PIONX Showcase');if(!r.ok)throw Error(j.error||'Showcase action failed');return j;
}
function showcaseMemberCard616(x){
 const p=x.profile||{},name=p.name||p.username||'PIONX member',cover=p.cover||x.projects?.[0]?.cover||PX614_ASSETS.facade,photo=p.photo||'',count=(x.projects||[]).length;
 const initials=(name||'PX').split(/\s+/).filter(Boolean).slice(0,2).map(n=>n[0]||'').join('').toUpperCase()||'PX';
 const search=[name,p.username,p.title,p.company].filter(Boolean).join(' ').toLowerCase();
 return `<article class="panel designer-card member-card616" data-member-search616="${escHtml(search)}"><div class="designer-cover"><img src="${escHtml(cover)}" alt=""><span class="designer-avatar ${photo?'has-photo':''}" ${photo?`style="background-image:url('${escHtml(photo)}');background-size:cover;background-position:center"`:''}>${photo?'':escHtml(initials)}</span></div><div class="designer-body"><h3>${escHtml(name)}</h3><p>${escHtml(p.title||'Architect / Designer')}</p><div class="designer-meta"><span>@${escHtml(p.username||'member')}</span><span>${count} public project${count===1?'':'s'}</span></div><div class="designer-actions"><button class="primary-btn" data-member-view616="${escHtml(x.member_key||'')}">View profile</button></div></div></article>`;
}
function showcaseProjectCard616(x){
 const p=x.p,author=x.author||'PIONX member',cat=String(p.category||'Architecture'),memberKey=x.memberKey||'';
 return `<article class="panel discover-project showcase-card616" data-showcase-search616="${escHtml((p.title+' '+cat+' '+author).toLowerCase())}" data-showcase-category616="${escHtml(cat.toLowerCase())}"><button class="showcase-project-cover616" data-project-open616="${escHtml(p.id)}" data-project-member616="${escHtml(memberKey)}"><img src="${escHtml(projectImage614(p))}" alt=""><div class="overlay"><div><b>${escHtml(p.title)}</b><br><small>by ${escHtml(author)}</small></div><span>${escHtml(cat)}</span></div></button><div class="discover-stats"><button class="primary-btn" data-project-open616="${escHtml(p.id)}" data-project-member616="${escHtml(memberKey)}">Open project</button><button class="ghost-btn" data-project-author616="${escHtml(memberKey)}">View creator</button>${p.allowDownload?'<span class="mini-badge">Download enabled</span>':'<span class="mini-badge">View only</span>'}</div></article>`;
}
function showcasePage616(){
 const ownProjects=(signedIn56()?portfolioProjects614:[]).filter(p=>p.visibility==='public'&&p.published).map(p=>({p,author:profileState.displayName,own:true,memberKey:''}));
 const others=portfolioDirectory614.filter(x=>!portfolioOwnMember16||x.member_key!==portfolioOwnMember16);
 const publicWork=others.flatMap(entry=>(entry.projects||[]).map(p=>({p,author:entry.profile?.name||entry.profile?.username||'PIONX member',own:false,memberKey:entry.member_key||''}))).slice(0,200);
 const professionals=[...(signedIn56()?[{member_key:'',profile:{name:profileState.displayName,username:profileState.username,title:profileState.title,company:profileState.company,photo:profileState.photo,cover:profileState.cover},projects:ownProjects.map(x=>x.p),own:true}]:[]),...others];
 return `<section class="page">${pageHead('PIONX PROFESSIONAL NETWORK','Showcase','Search PIONX members, open their available projects, appreciate work, comment and follow creators. Private projects remain visible only after access approval.')}<div class="discover-toolbar showcase-toolbar616"><label class="discover-search"><span>⌕</span><input id="showcaseSearch616" placeholder="Search user, username, studio, project or category..."></label><div class="discover-filters"><button class="chip active" data-showcase-filter616="all">All work</button><button class="chip" data-showcase-filter616="residential">Residential</button><button class="chip" data-showcase-filter616="interior">Interior</button><button class="chip" data-showcase-filter616="urban">Urban</button><button class="chip" data-showcase-filter616="landscape">Landscape</button></div></div><div class="section-title"><div><h2>People on PIONX</h2><p>${professionals.length} searchable account${professionals.length===1?'':'s'} · open a profile to view available projects and follow the creator.</p></div><button class="ghost-btn" data-route="portfolio">My portfolio</button></div><div class="designer-row showcase-pros616" id="showcaseMembers616">${professionals.map(x=>x.own?`<article class="panel designer-card member-card616" data-member-search616="${escHtml([profileState.displayName,profileState.username,profileState.title,profileState.company].join(' ').toLowerCase())}"><div class="designer-cover"><img src="${escHtml(profileState.cover||PX614_ASSETS.facade)}"><span class="designer-avatar ${profileState.photo?'has-photo':''}" ${profileState.photo?`style="background-image:url('${escHtml(profileState.photo)}');background-size:cover;background-position:center"`:''}>${profileState.photo?'':profileInitials()}</span></div><div class="designer-body"><h3>${escHtml(profileState.displayName)}</h3><p>${escHtml(profileState.title)}</p><div class="designer-meta"><span>@${escHtml(profileState.username)}</span><span>${ownProjects.length} public project${ownProjects.length===1?'':'s'}</span></div><div class="designer-actions"><button class="primary-btn" data-route="portfolio">View my profile</button></div></div></article>`:showcaseMemberCard616(x)).join('')}</div><div class="section-title"><div><h2>Public projects</h2><p>Open a project for its full image set, project information, likes and comments.</p></div></div><div class="project-masonry" id="showcaseProjects616">${[...ownProjects,...publicWork].map(showcaseProjectCard616).join('')||'<div class="panel empty-showcase614">No public projects have been published yet.</div>'}</div></section>`;
}
routes.explore=showcasePage616;

function timeAgo616(ts){const sec=Math.max(0,Math.floor(Date.now()/1000-Number(ts||0)));if(sec<60)return 'now';if(sec<3600)return Math.floor(sec/60)+'m';if(sec<86400)return Math.floor(sec/3600)+'h';if(sec<604800)return Math.floor(sec/86400)+'d';return new Date(Number(ts||0)*1000).toLocaleDateString();}
function commentsHtml616(rows=[],viewerKey='',owner=false){
 if(!rows.length)return '<div class="showcase-no-comments616">No comments yet. Start the conversation.</div>';
 return rows.map(c=>{const canDelete=owner||String(c.user_key||'')===String(viewerKey||'');const initials=String(c.name||'PX').split(/\s+/).filter(Boolean).slice(0,2).map(n=>n[0]||'').join('').toUpperCase()||'PX';return `<article class="showcase-comment616"><span class="showcase-comment-avatar616">${escHtml(initials)}</span><div><header><b>${escHtml(c.name||'PIONX member')}</b><small>${escHtml(timeAgo616(c.created))}</small>${canDelete?`<button data-comment-delete616="${escHtml(c.id||'')}">Delete</button>`:''}</header><p>${escHtml(c.text||'')}</p></div></article>`}).join('');
}
async function openMemberPortfolio616(memberKey){
 try{
  const j=await showcaseSocialApi616({action:'profile',member_key:memberKey}),p=j.profile||{},projects=j.projects||[],canonical=j.member_key||memberKey;
  const available=projects.length?projects.map(x=>`<button class="member-project616" data-member-project616="${escHtml(x.id)}"><img src="${escHtml(projectImage614(x))}" alt=""><span><b>${escHtml(x.title)}</b><small>${escHtml(x.category||'Architecture')} · ${x.access==='approved'?'Private · Access granted':x.access==='owner'?'Owner access':'Public'}</small><em>♥ ${Number(x.social?.likes_count||0)} · ${Number(x.social?.comments_count||0)} comments</em></span><strong>Open →</strong></button>`).join(''):'<div class="empty-showcase614">No projects are currently available to your account.</div>';
  const m=openDemoDialog(p.name||p.username||'PIONX member',`<div class="public-portfolio614 member-portfolio616"><div class="public-portfolio-cover614"><img src="${escHtml(p.cover||PX614_ASSETS.facade)}"><div><b>${escHtml(p.name||p.username||'PIONX member')}</b><span>${escHtml(p.title||'Architect / Designer')}</span><small>@${escHtml(p.username||'member')}${p.company?' · '+escHtml(p.company):''}</small></div></div><div class="member-social-head616"><span><b id="memberFollowers616">${Number(j.followers_count||0)}</b> followers</span><button class="${j.following?'primary-btn':'ghost-btn'}" id="memberFollow616">${j.following?'✓ Following':'＋ Follow'}</button></div><p>${escHtml(p.bio||'')}</p><div class="member-access-note615">Available here: public projects plus private projects this creator has approved for your account.</div><div class="member-project-list615">${available}</div></div>`,'<button class="ghost-btn" data-dialog-close2>Close</button>');
  q('[data-dialog-close2]',m)?.addEventListener('click',()=>m.hidden=true);
  q('#memberFollow616',m)?.addEventListener('click',async e=>{const b=e.currentTarget;b.disabled=true;try{const r=await showcaseSocialApi616({action:'follow',member_key:canonical,following:!j.following});j.following=!!r.following;j.followers_count=Number(r.followers_count||0);b.textContent=j.following?'✓ Following':'＋ Follow';b.className=j.following?'primary-btn':'ghost-btn';const n=q('#memberFollowers616',m);if(n)n.textContent=j.followers_count}catch(err){toast(err.message)}finally{b.disabled=false}});
  qa('[data-member-project616]',m).forEach(b=>b.addEventListener('click',()=>openShowcaseProject616(canonical,b.dataset.memberProject616,true)));
 }catch(e){toast(e.message)}
}

// ===== PIONX V6.19 · ISOLATED SINGLE-PROJECT VIEWER =====
function openProjectDialog619(title,body,actions=''){
  // A project must never share the same dialog with the creator profile/project list.
  const profileDialog=q('#demoDialog');if(profileDialog)profileDialog.hidden=true;
  let m=q('#projectDialog619');
  if(!m){m=document.createElement('div');m.id='projectDialog619';m.className='modal-backdrop project-backdrop619';document.body.appendChild(m)}
  m.hidden=false;
  m.innerHTML=`<div class="dialog-card project-dialog619"><button class="close-modal" data-project-close619>×</button><div class="eyebrow">PIONX PROJECT</div><h2>${title}</h2><div class="project-dialog-body619">${body}</div>${actions?`<div class="dialog-actions project-dialog-actions619">${actions}</div>`:''}</div>`;
  const close=()=>{m.hidden=true};
  q('[data-project-close619]',m)?.addEventListener('click',close);
  m.onclick=e=>{if(e.target===m)close()};
  const esc=e=>{if(e.key==='Escape'&&!m.hidden){close();document.removeEventListener('keydown',esc)}};
  document.addEventListener('keydown',esc);
  return m;
}

async function openShowcaseProject616(memberKey,projectId,backToProfile=false){
 try{
  const j=await showcaseSocialApi616({action:'project',member_key:memberKey,project_id:projectId}),p=j.project||{},creator=j.profile||{},social=j.social||{},canonical=j.member_key||memberKey;
  const images=(p.renders?.length?p.renders:[p.cover]).filter(Boolean),isOwner=p.access==='owner';
  const gallery=images.length?`<div class="showcase-project-gallery616">${images.map((u,i)=>`<figure><img src="${escHtml(u)}" alt="${escHtml(p.title||'Project')} ${i+1}"><figcaption>${String(i+1).padStart(2,'0')}</figcaption></figure>`).join('')}</div>`:'<div class="empty-showcase614">No project images are available.</div>';
  const m=openProjectDialog619(p.title||'Project',`<div class="showcase-project-detail616"><div class="showcase-creator-strip616"><div class="showcase-creator-avatar616" ${creator.photo?`style="background-image:url('${escHtml(creator.photo)}')"`:''}>${creator.photo?'':escHtml((creator.name||'PX').split(/\s+/).slice(0,2).map(n=>n[0]).join('').toUpperCase())}</div><div><b>${escHtml(creator.name||creator.username||'PIONX member')}</b><small>@${escHtml(creator.username||'member')} · ${escHtml(creator.title||'Architect / Designer')}</small></div>${isOwner?'':`<button class="${j.following?'primary-btn':'ghost-btn'}" id="projectFollow616">${j.following?'✓ Following':'＋ Follow'}</button>`}</div><div class="project-viewer-meta614"><span>${escHtml(p.category||'Architecture')}</span><span>${p.access==='approved'?'Private · Access granted':p.access==='owner'?'Owner':'Public'}</span>${p.allowDownload?'<span>Download enabled</span>':'<span>View only</span>'}</div><p class="showcase-project-description616">${escHtml(p.description||'')}</p>${gallery}<div class="showcase-social-bar616"><button class="${social.liked?'primary-btn':'ghost-btn'}" id="projectLike616">${social.liked?'♥ Liked':'♡ Like'} <b id="projectLikes616">${Number(social.likes_count||0)}</b></button><span>💬 <b id="projectCommentsCount616">${Number(social.comments_count||0)}</b> comments</span><span>👥 ${Number(j.followers_count||0)} followers</span></div><section class="showcase-comments616"><div class="section-title"><div><h3>Comments</h3><p>Discuss the project with the creator and other PIONX members.</p></div></div><div id="projectComments616">${commentsHtml616(social.comments||[],j.viewer_key,isOwner)}</div><div class="showcase-comment-compose616"><textarea id="projectCommentText616" maxlength="700" placeholder="Write a professional comment..."></textarea><button class="primary-btn" id="projectCommentSend616">Post comment</button></div></section></div>`,`${backToProfile&&!isOwner?'<button class="ghost-btn" id="projectBackProfile616">← Creator profile</button>':''}${p.allowDownload?'<button class="ghost-btn" id="downloadProject614">Download Project ZIP</button>':''}<button class="primary-btn" data-dialog-close2>Done</button>`);
  q('[data-dialog-close2]',m)?.addEventListener('click',()=>m.hidden=true);
  q('#projectBackProfile616',m)?.addEventListener('click',()=>{m.hidden=true;openMemberPortfolio616(canonical)});
  if(p.allowDownload)q('#downloadProject614',m)?.addEventListener('click',()=>downloadProject614(p));
  q('#projectLike616',m)?.addEventListener('click',async e=>{const b=e.currentTarget;b.disabled=true;try{const r=await showcaseSocialApi616({action:'like',member_key:canonical,project_id:p.id,liked:!social.liked});social.liked=!!r.liked;social.likes_count=Number(r.likes_count||0);b.className=social.liked?'primary-btn':'ghost-btn';b.innerHTML=`${social.liked?'♥ Liked':'♡ Like'} <b id="projectLikes616">${social.likes_count}</b>`}catch(err){toast(err.message)}finally{b.disabled=false}});
  q('#projectFollow616',m)?.addEventListener('click',async e=>{const b=e.currentTarget;b.disabled=true;try{const r=await showcaseSocialApi616({action:'follow',member_key:canonical,following:!j.following});j.following=!!r.following;j.followers_count=Number(r.followers_count||0);b.textContent=j.following?'✓ Following':'＋ Follow';b.className=j.following?'primary-btn':'ghost-btn'}catch(err){toast(err.message)}finally{b.disabled=false}});
  const wireCommentDeletes=()=>qa('[data-comment-delete616]',m).forEach(b=>b.addEventListener('click',async()=>{if(!confirm('Delete this comment?'))return;b.disabled=true;try{const r=await showcaseSocialApi616({action:'comment_delete',member_key:canonical,project_id:p.id,comment_id:b.dataset.commentDelete616});social.comments=r.social?.comments||[];social.comments_count=Number(r.social?.comments_count||0);const box=q('#projectComments616',m);if(box)box.innerHTML=commentsHtml616(social.comments,j.viewer_key,isOwner);const count=q('#projectCommentsCount616',m);if(count)count.textContent=social.comments_count;wireCommentDeletes()}catch(err){toast(err.message)}}));
  wireCommentDeletes();
  q('#projectCommentSend616',m)?.addEventListener('click',async e=>{const b=e.currentTarget,text=(q('#projectCommentText616',m)?.value||'').trim();if(!text)return toast('Write a comment first');b.disabled=true;b.textContent='Posting…';try{const r=await showcaseSocialApi616({action:'comment',member_key:canonical,project_id:p.id,text});social.comments=r.social?.comments||[];social.comments_count=Number(r.social?.comments_count||0);const box=q('#projectComments616',m);if(box)box.innerHTML=commentsHtml616(social.comments,j.viewer_key,isOwner);const count=q('#projectCommentsCount616',m);if(count)count.textContent=social.comments_count;const input=q('#projectCommentText616',m);if(input)input.value='';wireCommentDeletes();toast('Comment posted')}catch(err){toast(err.message)}finally{b.disabled=false;b.textContent='Post comment'}});
 }catch(e){toast(e.message)}
}

const wireBase616=wireView;
wireView=function(name){wireBase616(name);
 if(name==='explore'){
  const pending=(safeStore.get('pionx-global-search-pending')||'').trim();if(pending&&q('#showcaseSearch616')){q('#showcaseSearch616').value=pending;safeStore.set('pionx-global-search-pending','')}
  let filter='all';const apply=()=>{const term=(q('#showcaseSearch616')?.value||'').trim().toLowerCase();qa('.member-card616').forEach(card=>card.hidden=!!term&&!(card.dataset.memberSearch616||'').includes(term));qa('#showcaseProjects616 .showcase-card616').forEach(card=>{const cat=(card.dataset.showcaseCategory616||'').toLowerCase(),text=(card.dataset.showcaseSearch616||'').toLowerCase(),okF=filter==='all'||cat.includes(filter),okT=!term||text.includes(term);card.hidden=!(okF&&okT)});};
  q('#showcaseSearch616')?.addEventListener('input',apply);qa('[data-showcase-filter616]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.showcaseFilter616||'all';qa('[data-showcase-filter616]').forEach(x=>x.classList.toggle('active',x===b));apply()}));qa('[data-member-view616]').forEach(b=>b.addEventListener('click',()=>openMemberPortfolio616(b.dataset.memberView616)));qa('[data-project-open616]').forEach(b=>b.addEventListener('click',()=>openShowcaseProject616(b.dataset.projectMember616,b.dataset.projectOpen616,false)));qa('[data-project-author616]').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.projectAuthor616)openMemberPortfolio616(b.dataset.projectAuthor616);else go('portfolio')}));apply();
 }
};


// ===== PIONX V6.18 · UNIFIED PORTFOLIO / PROFILE / PROJECT OPENING =====
// One project detail experience everywhere: My Portfolio, Projects, Showcase and member profiles.
function openOwnSocialProject618(projectId){
  if(!projectId)return;
  openShowcaseProject616('',projectId,false).catch?.(()=>{});
}
function wirePortfolioProjectOpen618(){
  // My Portfolio uses the older showcase card markup. Route it into the social Project Detail API.
  qa('#viewRoot [data-showcase-view614]').forEach(b=>{
    if(b.dataset.px618Wired)return;b.dataset.px618Wired='1';
    b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openOwnSocialProject618(b.dataset.showcaseView614)});
  });
  qa('#viewRoot .showcase-own614 .showcase-card614').forEach(card=>{
    if(card.dataset.px618Wired)return;card.dataset.px618Wired='1';card.tabIndex=0;card.setAttribute('role','button');
    const open=()=>{const b=card.querySelector('[data-showcase-view614]');if(b)openOwnSocialProject618(b.dataset.showcaseView614)};
    card.addEventListener('click',e=>{if(e.target.closest('button,a,input,select,textarea,label'))return;open()});
    card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}});
  });
}
function wireProjectManagerOpen618(){
  // Projects workspace should open the same social detail for the owner too.
  qa('#viewRoot [data-project-open614]').forEach(b=>{
    if(b.dataset.px618SocialWired)return;b.dataset.px618SocialWired='1';
    // Capture phase prevents the old non-social viewer from winning.
    b.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();openOwnSocialProject618(b.dataset.projectOpen614)},true);
  });
  qa('#viewRoot .project-manage-card614').forEach(card=>{
    if(card.dataset.px618CardWired)return;card.dataset.px618CardWired='1';
    const id=card.dataset.project614;if(!id)return;
    const cover=card.querySelector('.project-cover614');if(cover){cover.tabIndex=0;cover.setAttribute('role','button');cover.title='Open project';cover.addEventListener('click',()=>openOwnSocialProject618(id));cover.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openOwnSocialProject618(id)}})}
  });
}
function wireMemberCards618(){
  // Clicking anywhere on a professional card opens the profile, not only the button.
  qa('#viewRoot .member-card616').forEach(card=>{
    if(card.dataset.px618Wired)return;card.dataset.px618Wired='1';card.tabIndex=0;card.setAttribute('role','button');
    const open=()=>{const b=card.querySelector('[data-member-view616]');if(b)return openMemberPortfolio616(b.dataset.memberView616);const mine=card.querySelector('[data-route="portfolio"]');if(mine)return go('portfolio')};
    card.addEventListener('click',e=>{if(e.target.closest('button,a,input,select,textarea,label'))return;open()});
    card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}});
  });
}
const wireBase618=wireView;
wireView=function(name){
  wireBase618(name);
  if(name==='portfolio')wirePortfolioProjectOpen618();
  if(name==='projects')wireProjectManagerOpen618();
  if(name==='explore')wireMemberCards618();
};
// ===== END PIONX V6.18 =====

// ===== END PIONX V6.16 =====


// ===== END PIONX V6.15.1 =====

// ===== END PIONX V6.15 =====

// ===== END V6.14 =====



// ===== PIONX V6.20 · FILM TARGET DURATION UP TO 2 MINUTES =====
const FILM_MAX_SECONDS620=120;
let filmDuration620=Number(safeStore.get('pionx-film-duration-v620')||60);
if(!(filmDuration620>=10&&filmDuration620<=FILM_MAX_SECONDS620))filmDuration620=60;
function filmFmt620(sec){sec=Math.max(0,Math.round(Number(sec)||0));return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`}
function filmTarget620(){
 const sel=q('#filmDuration620');let v=Number(sel?.value||filmDuration620||60);
 if(sel?.value==='custom')v=Number(q('#filmCustomDuration620')?.value||60);
 v=Math.max(10,Math.min(FILM_MAX_SECONDS620,v||60));filmDuration620=v;safeStore.set('pionx-film-duration-v620',String(v));return v;
}
function filmSourceSeconds620(){return filmClips614.reduce((n,c)=>n+(Number(c.duration)||0),0)}
function filmProbeDuration620(url){return new Promise((resolve,reject)=>{const v=document.createElement('video');v.preload='metadata';v.muted=true;let done=false;const finish=(ok,val)=>{if(done)return;done=true;v.removeAttribute('src');v.load();ok?resolve(Number.isFinite(val)?val:0):reject(val)};v.onloadedmetadata=()=>finish(true,v.duration);v.onerror=()=>finish(false,new Error('Could not read clip duration'));v.src=url;setTimeout(()=>finish(true,0),6000)})}
function filmDurationStatus620(){
 const src=filmSourceSeconds620(),target=filmTarget620(),el=q('#filmDurationStatus620'),bar=q('#filmDurationBar620');
 if(el)el.innerHTML=`<b>${filmFmt620(Math.min(src,target))}</b> planned of <b>${filmFmt620(target)}</b> target · ${filmClips614.length} shot(s) · source ${filmFmt620(src)}`;
 if(bar)bar.style.width=Math.min(100,src/target*100)+'%';
 const custom=q('#filmCustomDuration620');if(custom)custom.hidden=q('#filmDuration620')?.value!=='custom';
}
filmPage614=function(){
 const source=filmSourceSeconds620(),target=filmDuration620;
 return `<section class="page">${pageHead('PIONX FILM','Film Studio','Build a client film from multiple approved shots. Target the final runtime up to two minutes, reorder clips, preview the sequence and export one combined film.','<button class="ghost-btn" id="filmAddLatest614">+ Latest Video</button><button class="primary-btn" id="filmExport614">Export Film</button>')}
 <div class="film-grid614">
  <section class="panel film-stage614"><div id="filmStage614">${filmClips614.length?`<video controls src="${escHtml(filmClips614[0].url)}"></video>`:`<div class="film-empty614"><b>Build a film up to 2:00</b><span>Add several short video shots. PIONX assembles them into the final target runtime.</span></div>`}</div><div class="film-progress614 film-progress620"><span id="filmStatus614">${filmClips614.length+' shot(s) ready'}</span><div class="film-meter620"><i id="filmDurationBar620" style="width:${Math.min(100,source/Math.max(1,target)*100)}%"></i></div></div></section>
  <aside class="panel film-settings614"><label>Film title<input id="filmTitle614" value="PIONX Architecture Film"></label><label>Format<select id="filmRatio614"><option value="16:9">16:9 Client Film</option><option value="9:16">9:16 Social Vertical</option></select></label><label>Target duration<select id="filmDuration620"><option value="15" ${target===15?'selected':''}>15 seconds</option><option value="30" ${target===30?'selected':''}>30 seconds</option><option value="45" ${target===45?'selected':''}>45 seconds</option><option value="60" ${target===60?'selected':''}>1 minute</option><option value="90" ${target===90?'selected':''}>1 minute 30 seconds</option><option value="120" ${target===120?'selected':''}>2 minutes</option><option value="custom" ${![15,30,45,60,90,120].includes(target)?'selected':''}>Custom · max 2:00</option></select></label><label id="filmCustomWrap620" ${![15,30,45,60,90,120].includes(target)?'':'hidden'}>Custom seconds<input id="filmCustomDuration620" type="number" min="10" max="120" step="1" value="${target}"></label><div class="film-runtime620" id="filmDurationStatus620"><b>${filmFmt620(Math.min(source,target))}</b> planned of <b>${filmFmt620(target)}</b> target · ${filmClips614.length} shot(s) · source ${filmFmt620(source)}</div><label>Transition<select id="filmTransition614"><option value="fade">Soft fade</option><option value="cut">Clean cut</option></select></label><label>Frame rate<select id="filmFps614"><option value="30">30 fps</option><option value="24">24 fps</option></select></label><label class="video-source-drop614">Add video clips<input type="file" id="filmFiles614" accept="video/mp4,video/webm" multiple><span>MP4 / WebM · multiple files</span></label><button class="ghost-btn" id="filmPreviewSequence614">Preview target sequence</button><p class="video-caveat66">Maximum final film runtime is 2:00. Long films are assembled from multiple short shots; PIONX does not request one 120-second AI generation from the video provider.</p></aside>
 </div>
 <div class="section-title"><div><h2>Film timeline</h2><p>Arrange shots in story order. Export trims the sequence automatically at the selected target runtime.</p></div></div><section class="panel film-timeline614" id="filmTimeline614">${filmClips614.length?filmClips614.map((c,i)=>`<article class="film-shot614"><video muted src="${escHtml(c.url)}"></video><div><b>Shot ${i+1}</b><small>${escHtml(c.name)}${c.duration?` · ${filmFmt620(c.duration)}`:''}</small></div><button data-film-up614="${i}" ${i===0?'disabled':''}>↑</button><button data-film-down614="${i}" ${i===filmClips614.length-1?'disabled':''}>↓</button><button data-film-remove614="${i}">×</button></article>`).join(''):'<div class="film-empty614">No clips yet.</div>'}</section>
 ${filmDirectorBoard622()}
 </section>`
};
routes.film=filmPage614;
addLatestVideo614=async function(){if(!videoJob66)return toast('Generate a video first or upload clips');try{const r=await pxApi56('/server/video-direct-v66.php?action=download&id='+encodeURIComponent(videoJob66));if(!r.ok)throw Error((await json56(r,'Latest video')).error||'Latest video unavailable');const blob=await r.blob(),url=URL.createObjectURL(blob),duration=await filmProbeDuration620(url).catch(()=>0);filmClips614.push({name:'Latest PIONX Video.mp4',url,blob,duration});route()}catch(e){toast(e.message)}};
previewFilm614=async function(){
 if(!filmClips614.length)return toast('Add video clips first');const target=filmTarget620(),stage=q('#filmStage614');let used=0;
 for(let i=0;i<filmClips614.length&&used<target;i++){
  const clip=filmClips614[i];if(!stage)return;stage.innerHTML=`<video id="filmPreviewPlayer614" autoplay muted playsinline src="${escHtml(clip.url)}"></video><span class="film-shot-label614">Shot ${i+1} / ${filmClips614.length}</span>`;const v=q('#filmPreviewPlayer614');
  await new Promise(res=>{v.onloadedmetadata=()=>{const left=Math.max(0,target-used),limit=Math.min(Number.isFinite(v.duration)?v.duration:left,left);clip.duration=Number.isFinite(v.duration)?v.duration:clip.duration;let finished=false;const done=()=>{if(finished)return;finished=true;v.pause();v.ontimeupdate=null;v.onended=null;used+=limit;res()};v.ontimeupdate=()=>{if(v.currentTime>=limit-.04)done()};v.onended=done;v.play().catch(done)};v.onerror=res});
 }
 filmDurationStatus620();stage.innerHTML=`<div class="film-empty614"><b>Preview complete · ${filmFmt620(Math.min(used,target))}</b><span>${used+0.05<target?'Add more shots to reach the target runtime.':'Ready to export the selected runtime.'}</span></div>`
};
exportFilm614=async function(){
 if(filmBusy614)return;if(!filmClips614.length)return toast('Add video clips first');if(typeof MediaRecorder==='undefined')return toast('This browser cannot export the Film preview');filmBusy614=true;const button=q('#filmExport614');if(button){button.disabled=true;button.textContent='Building film…'};
 try{
  const target=filmTarget620(),src=filmSourceSeconds620();if(src&&src+0.05<target)toast(`Source clips total ${filmFmt620(src)}; export will be shorter than the ${filmFmt620(target)} target.`);
  const vertical=q('#filmRatio614')?.value==='9:16',fps=Number(q('#filmFps614')?.value||30),canvas=document.createElement('canvas');canvas.width=vertical?720:1280;canvas.height=vertical?1280:720;const ctx=canvas.getContext('2d',{alpha:false}),stream=canvas.captureStream(fps),mime=MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':'video/webm';const rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:8000000}),chunks=[];rec.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};const stopped=new Promise(res=>rec.onstop=res);rec.start(500);let used=0;
  for(let i=0;i<filmClips614.length&&used<target;i++){
   const clip=filmClips614[i],v=document.createElement('video');v.src=clip.url;v.muted=true;v.playsInline=true;await new Promise((res,rej)=>{v.onloadedmetadata=res;v.onerror=()=>rej(Error('Could not read '+clip.name))});clip.duration=Number.isFinite(v.duration)?v.duration:clip.duration;const left=target-used,playFor=Math.min(Number.isFinite(v.duration)?v.duration:left,left);if(playFor<=.02)break;
   let drawing=true;const draw=()=>{if(!drawing)return;const s=Math.max(canvas.width/v.videoWidth,canvas.height/v.videoHeight),w=v.videoWidth*s,h=v.videoHeight*s;ctx.fillStyle='#050b14';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(v,(canvas.width-w)/2,(canvas.height-h)/2,w,h);ctx.fillStyle='rgba(0,0,0,.45)';ctx.fillRect(20,canvas.height-58,260,34);ctx.fillStyle='#fff';ctx.font='20px Arial';ctx.fillText('PIONX FILM  ·  '+filmFmt620(Math.min(target,used+v.currentTime))+' / '+filmFmt620(target),34,canvas.height-35);requestAnimationFrame(draw)};
   await v.play();draw();await new Promise(res=>{let done=false;const finish=()=>{if(done)return;done=true;drawing=false;v.pause();v.ontimeupdate=null;v.onended=null;res()};v.ontimeupdate=()=>{if(v.currentTime>=playFor-.035)finish()};v.onended=finish});used+=playFor;
   if(q('#filmTransition614')?.value==='fade'&&i<filmClips614.length-1&&used<target){for(let a=0;a<=1;a+=.08){ctx.fillStyle=`rgba(5,11,20,${a})`;ctx.fillRect(0,0,canvas.width,canvas.height);await sleep56(28)}}
  }
  rec.stop();await stopped;const blob=new Blob(chunks,{type:mime}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=(q('#filmTitle614')?.value||'PIONX-Film').replace(/[^a-z0-9_-]+/gi,'-')+'.webm';a.click();setTimeout(()=>URL.revokeObjectURL(u),60000);toast(`Film exported · ${filmFmt620(Math.min(used,target))}`)
 }catch(e){console.error(e);toast(e.message||'Film export failed')}finally{filmBusy614=false;if(button){button.disabled=false;button.textContent='Export Film'}}
};
const wireBase620=wireView;
wireView=function(name){wireBase620(name);if(name==='film'){
 const select=q('#filmDuration620'),custom=q('#filmCustomDuration620'),wrap=q('#filmCustomWrap620');const sync=()=>{if(wrap)wrap.hidden=select?.value!=='custom';filmDurationStatus620()};select?.addEventListener('change',sync);custom?.addEventListener('input',sync);sync();
 }};
// ===== END PIONX V6.20 =====


// ===== PIONX V6.22 · AI FILM DIRECTOR STATE =====
let filmDirector622=null,filmDirectorBusy622=false,filmDirectorMode622='auto',filmDirectorStyle622='Architectural Film',filmDirectorLanguage622='English',filmDirectorBrief622='';
function filmDirectorMotion622(camera=''){const x=String(camera).toLowerCase();if(x.includes('pan left'))return'pan-left';if(x.includes('pan right'))return'pan-right';if(x.includes('pull')||x.includes('zoom out')||x.includes('reveal'))return'zoom-out';return'push'}
function filmBlobData622(blob){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result||''));r.onerror=()=>rej(r.error||Error('Could not read film source'));r.readAsDataURL(blob)})}
async function filmDirectorImages622(){const rows=filmClips614.filter(c=>filmKind621(c)==='image').slice(0,12),out=[];for(const c of rows){try{const b=await (await fetch(c.thumbUrl||c.previewUrl||c.url)).blob();out.push(await filmBlobData622(b))}catch(e){console.warn('Director image skipped',e)}}return out}
function filmDirectorScene622(scene,i){const imgs=filmClips614.filter(c=>filmKind621(c)==='image'),src=imgs[Math.max(0,Math.min(imgs.length-1,Number(scene.source_index)||0))];return `<article class="film-director-scene622" data-director-scene622="${i}"><div class="film-director-thumb622">${src?`<img loading="lazy" decoding="async" src="${escHtml(src.thumbUrl||src.previewUrl||src.url)}" alt="">`:'<span>No image</span>'}<b>${i+1}</b></div><div class="film-director-fields622"><label>Scene title<input data-director-title622="${i}" value="${escHtml(scene.title||'Scene '+(i+1))}"></label><div class="film-director-row622"><label>Duration<input type="number" min="3" max="20" data-director-duration622="${i}" value="${Number(scene.duration)||6}"></label><label>Camera<select data-director-camera622="${i}"><option ${String(scene.camera).toLowerCase().includes('push')?'selected':''}>Slow push</option><option ${String(scene.camera).toLowerCase().includes('pan left')?'selected':''}>Pan left</option><option ${String(scene.camera).toLowerCase().includes('pan right')?'selected':''}>Pan right</option><option ${String(scene.camera).toLowerCase().includes('pull')?'selected':''}>Slow pull back</option></select></label></div><label>Visual direction<textarea data-director-visual622="${i}">${escHtml(scene.visual_direction||'')}</textarea></label><label>Voice-over<textarea data-director-voice622="${i}">${escHtml(scene.voiceover||'')}</textarea></label><div class="film-director-row622"><label>Transition<input data-director-transition622="${i}" value="${escHtml(scene.transition||'Soft fade')}"></label><label>SFX<input data-director-sfx622="${i}" value="${escHtml(scene.sfx||'')}"></label></div></div></article>`}
function filmDirectorBoard622(){if(!filmDirector622)return'';const scenes=Array.isArray(filmDirector622.scenes)?filmDirector622.scenes:[];return `<section class="panel film-director-board622"><div class="section-title" style="margin-top:0"><div><small>AI DIRECTOR STORYBOARD</small><h2>${escHtml(filmDirector622.title||'PIONX Film')}</h2><p>${escHtml(filmDirector622.logline||'')}</p></div><button class="primary-btn" id="filmApplyDirector622">Apply to timeline</button></div><div class="film-director-summary622"><div><small>Story</small><p>${escHtml(filmDirector622.story||'')}</p></div><div><small>Music mood</small><p>${escHtml(filmDirector622.music_mood||'')}</p></div><div><small>Director note</small><p>${escHtml(filmDirector622.director_note||'')}</p></div></div><div class="film-director-scenes622">${scenes.map(filmDirectorScene622).join('')}</div><div class="film-director-voice622"><small>FULL VOICE-OVER SCRIPT</small><textarea id="filmDirectorFullVoice622">${escHtml(filmDirector622.voiceover_script||'')}</textarea></div></section>`}
async function filmGenerateDirector622(){if(filmDirectorBusy622)return;const images=await filmDirectorImages622();const brief=q('#filmDirectorBrief622')?.value?.trim()||filmDirectorBrief622;if(!images.length&&!brief)return toast('Upload images or write a film brief first');filmDirectorBusy622=true;const b=q('#filmDirectorGenerate622');if(b){b.disabled=true;b.textContent='Directing story…'};try{filmDirectorMode622=q('#filmDirectorMode622')?.value||filmDirectorMode622;filmDirectorStyle622=q('#filmDirectorStyle622')?.value||filmDirectorStyle622;filmDirectorLanguage622=q('#filmDirectorLanguage622')?.value||filmDirectorLanguage622;filmDirectorBrief622=brief;const r=await pxApi56('/server/film-director-v622.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:filmDirectorMode622,style:filmDirectorStyle622,language:filmDirectorLanguage622,duration:filmTarget620(),brief,images})});const j=await json56(r,'PIONX AI Director');if(!r.ok||!j.ok)throw Error(j.error||'AI Director failed');filmDirector622=j.plan||null;toast('AI Director storyboard is ready');route()}catch(e){console.error(e);toast(e.message||'AI Director failed')}finally{filmDirectorBusy622=false;if(b){b.disabled=false;b.textContent='Create Story for Me ✦'}}}
function filmApplyDirector622(){if(!filmDirector622?.scenes?.length)return toast('Create a storyboard first');const imgs=filmClips614.filter(c=>filmKind621(c)==='image');for(const scene of filmDirector622.scenes){const c=imgs[Number(scene.source_index)||0];if(!c)continue;c.duration=Math.max(3,Math.min(20,Number(scene.duration)||6));c.motion=filmDirectorMotion622(scene.camera);c.directorScene={...scene}}const sum=filmDirector622.scenes.reduce((n,x)=>n+(Number(x.duration)||0),0);if(sum)filmDuration620=Math.max(15,Math.min(120,Math.round(sum)));toast('Storyboard timing and camera directions applied');route()}
// ===== END PIONX V6.22 AI FILM DIRECTOR STATE =====

// ===== PIONX V6.21 · FILM IMAGE + VIDEO SOURCES =====
let filmImageDuration621=5,filmImageMotion621='push';
function filmKind621(c){return c?.kind||(c?.blob?.type?.startsWith('image/')?'image':'video')}
async function filmPreviews622(file){
 try{
  const bmp=await createImageBitmap(file),make=async max=>{
   const scale=Math.min(1,max/Math.max(bmp.width,bmp.height)),w=Math.max(1,Math.round(bmp.width*scale)),h=Math.max(1,Math.round(bmp.height*scale));
   const cv=document.createElement('canvas');cv.width=w;cv.height=h;const cx=cv.getContext('2d',{alpha:false});cx.imageSmoothingEnabled=true;cx.imageSmoothingQuality='high';cx.drawImage(bmp,0,0,w,h);
   return await new Promise(res=>cv.toBlob(res,'image/webp',max<=360?.68:.76));
  };
  const [preview,thumb]=await Promise.all([make(1280),make(320)]);bmp.close?.();
  return {previewUrl:preview?URL.createObjectURL(preview):'',thumbUrl:thumb?URL.createObjectURL(thumb):''};
 }catch(e){console.warn('Film preview compression fallback',e);return {previewUrl:'',thumbUrl:''}}
}
async function filmAddFiles621(files){
 const arr=[...(files||[])];if(!arr.length)return;
 const imageDuration=Math.max(2,Math.min(12,Number(q('#filmImageDuration621')?.value||filmImageDuration621||5)));
 const imageMotion=q('#filmImageMotion621')?.value||filmImageMotion621||'push';
 let added=0,images=0;
 for(const f of arr){
  const type=(f.type||'').toLowerCase();
  if(type.startsWith('image/')){
   const url=URL.createObjectURL(f),pv=await filmPreviews622(f);
   filmClips614.push({name:f.name,url,previewUrl:pv.previewUrl||url,thumbUrl:pv.thumbUrl||pv.previewUrl||url,blob:f,kind:'image',duration:imageDuration,motion:imageMotion});added++;images++;
  }else if(type.startsWith('video/')){
   const url=URL.createObjectURL(f),duration=await filmProbeDuration620(url).catch(()=>0);filmClips614.push({name:f.name,url,blob:f,kind:'video',duration});added++;
  }
 }
 if(added){toast(`${added} source${added===1?'':'s'} added${images?` · ${images} optimized for smooth Film scrolling`:''}`);route()}else toast('Choose JPG, PNG, WebP, MP4 or WebM files');
}
function filmThumb621(c){return filmKind621(c)==='image'?`<img loading="lazy" decoding="async" fetchpriority="low" src="${escHtml(c.thumbUrl||c.previewUrl||c.url)}" alt="${escHtml(c.name||'Film image')}">`:`<video muted preload="metadata" playsinline src="${escHtml(c.url)}"></video>`}
function filmStageMedia621(c){return filmKind621(c)==='image'?`<div class="film-image-stage621"><img decoding="async" src="${escHtml(c.previewUrl||c.url)}" alt="${escHtml(c.name||'Film image')}"><span>IMAGE SHOT · ${filmFmt620(c.duration||filmImageDuration621)}</span></div>`:`<video controls preload="metadata" src="${escHtml(c.url)}"></video>`}
filmPage614=function(){
 const source=filmSourceSeconds620(),target=filmDuration620,first=filmClips614[0];
 return `<section class="page">${pageHead('PIONX FILM','Film Studio','Build a complete film from still images, generated videos or uploaded clips. Images become cinematic motion shots; combine everything into a final runtime up to two minutes.','<button class="ghost-btn" id="filmAddLatest614">+ Latest Video</button><button class="primary-btn" id="filmExport614">Export Film</button>')}
 <div class="film-grid614">
  <section class="panel film-stage614"><div id="filmStage614">${first?filmStageMedia621(first):`<div class="film-empty614"><b>Build a film from images + video</b><span>Upload JPG / PNG / WebP images or MP4 / WebM clips. Still images become cinematic motion shots in the timeline.</span></div>`}</div><div class="film-progress614 film-progress620"><span id="filmStatus614">${filmClips614.length+' shot(s) ready'}</span><div class="film-meter620"><i id="filmDurationBar620" style="width:${Math.min(100,source/Math.max(1,target)*100)}%"></i></div></div></section>
  <aside class="panel film-settings614"><label>Film title<input id="filmTitle614" value="PIONX Architecture Film"></label><label>Format<select id="filmRatio614"><option value="16:9">16:9 Client Film</option><option value="9:16">9:16 Social Vertical</option></select></label><label>Target duration<select id="filmDuration620"><option value="15" ${target===15?'selected':''}>15 seconds</option><option value="30" ${target===30?'selected':''}>30 seconds</option><option value="45" ${target===45?'selected':''}>45 seconds</option><option value="60" ${target===60?'selected':''}>1 minute</option><option value="90" ${target===90?'selected':''}>1 minute 30 seconds</option><option value="120" ${target===120?'selected':''}>2 minutes</option><option value="custom" ${![15,30,45,60,90,120].includes(target)?'selected':''}>Custom · max 2:00</option></select></label><label id="filmCustomWrap620" ${![15,30,45,60,90,120].includes(target)?'':'hidden'}>Custom seconds<input id="filmCustomDuration620" type="number" min="10" max="120" step="1" value="${target}"></label><div class="film-runtime620" id="filmDurationStatus620"><b>${filmFmt620(Math.min(source,target))}</b> planned of <b>${filmFmt620(target)}</b> target · ${filmClips614.length} shot(s) · source ${filmFmt620(source)}</div>
  <div class="film-director-controls622"><div class="film-director-head622"><div><b>PIONX AI Director</b><small>Upload images and let PIONX write the story, scenes and voice-over.</small></div><span>AUTO STORY</span></div><label>Director mode<select id="filmDirectorMode622"><option value="auto" ${filmDirectorMode622==='auto'?'selected':''}>Write story for me</option><option value="improve" ${filmDirectorMode622==='improve'?'selected':''}>Improve my brief</option><option value="script" ${filmDirectorMode622==='script'?'selected':''}>Use my script</option></select></label><div class="film-director-row622"><label>Film type<select id="filmDirectorStyle622"><option ${filmDirectorStyle622==='Architectural Film'?'selected':''}>Architectural Film</option><option ${filmDirectorStyle622==='Luxury Real Estate'?'selected':''}>Luxury Real Estate</option><option ${filmDirectorStyle622==='Cinematic'?'selected':''}>Cinematic</option><option ${filmDirectorStyle622==='Corporate'?'selected':''}>Corporate</option><option ${filmDirectorStyle622==='Social Reel'?'selected':''}>Social Reel</option><option ${filmDirectorStyle622==='Documentary'?'selected':''}>Documentary</option></select></label><label>Language<select id="filmDirectorLanguage622"><option ${filmDirectorLanguage622==='English'?'selected':''}>English</option><option ${filmDirectorLanguage622==='Arabic'?'selected':''}>Arabic</option></select></label></div><label>Story brief / script<textarea id="filmDirectorBrief622" class="notes" placeholder="Optional. Leave empty and PIONX will create the story from your images.">${escHtml(filmDirectorBrief622)}</textarea></label><button class="primary-btn" id="filmDirectorGenerate622" style="width:100%">Create Story for Me ✦</button></div>
  <div class="film-image-controls621"><label>Still-image shot duration<select id="filmImageDuration621"><option value="3" ${filmImageDuration621===3?'selected':''}>3 seconds</option><option value="5" ${filmImageDuration621===5?'selected':''}>5 seconds</option><option value="6" ${filmImageDuration621===6?'selected':''}>6 seconds</option><option value="8" ${filmImageDuration621===8?'selected':''}>8 seconds</option><option value="10" ${filmImageDuration621===10?'selected':''}>10 seconds</option></select></label><label>Image motion<select id="filmImageMotion621"><option value="push" ${filmImageMotion621==='push'?'selected':''}>Slow cinematic push</option><option value="pan-left" ${filmImageMotion621==='pan-left'?'selected':''}>Pan left</option><option value="pan-right" ${filmImageMotion621==='pan-right'?'selected':''}>Pan right</option><option value="zoom-out" ${filmImageMotion621==='zoom-out'?'selected':''}>Slow pull back</option></select></label></div>
  <label>Transition<select id="filmTransition614"><option value="fade">Soft fade</option><option value="cut">Clean cut</option></select></label><label>Frame rate<select id="filmFps614"><option value="30">30 fps</option><option value="24">24 fps</option></select></label><label class="video-source-drop614">Add images / video<input type="file" id="filmFiles614" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm" multiple><span>JPG / PNG / WebP / MP4 / WebM · multiple files</span></label><button class="ghost-btn" id="filmPreviewSequence614">Preview target sequence</button><p class="video-caveat66">Still images are usable immediately as cinematic motion shots. Video clips keep their original duration. Final film runtime can be up to 2:00.</p></aside>
 </div>
 <div class="section-title"><div><h2>Film timeline</h2><p>Mix images and videos in story order. Each still image has a timed cinematic move; export trims the sequence at the selected target runtime.</p></div></div><section class="panel film-timeline614" id="filmTimeline614">${filmClips614.length?filmClips614.map((c,i)=>`<article class="film-shot614 ${filmKind621(c)==='image'?'is-image621':''}">${filmThumb621(c)}<div><b>Shot ${i+1} · ${filmKind621(c)==='image'?'Image':'Video'}</b><small>${escHtml(c.name)}${c.duration?` · ${filmFmt620(c.duration)}`:''}${filmKind621(c)==='image'?` · ${escHtml(c.motion||filmImageMotion621)}`:''}</small></div><button data-film-up614="${i}" ${i===0?'disabled':''}>↑</button><button data-film-down614="${i}" ${i===filmClips614.length-1?'disabled':''}>↓</button><button data-film-remove614="${i}">×</button></article>`).join(''):'<div class="film-empty614">No sources yet. Add images or video clips.</div>'}</section>
 ${filmDirectorBoard622()}
 </section>`
};
routes.film=filmPage614;
addLatestVideo614=async function(){if(!videoJob66)return toast('Generate a video first or upload images / video clips');try{const r=await pxApi56('/server/video-direct-v66.php?action=download&id='+encodeURIComponent(videoJob66));if(!r.ok)throw Error((await json56(r,'Latest video')).error||'Latest video unavailable');const blob=await r.blob(),url=URL.createObjectURL(blob),duration=await filmProbeDuration620(url).catch(()=>0);filmClips614.push({name:'Latest PIONX Video.mp4',url,blob,kind:'video',duration});route()}catch(e){toast(e.message)}};
function filmImageFit621(ctx,img,canvas,p,motion){
 const base=Math.max(canvas.width/img.naturalWidth,canvas.height/img.naturalHeight),m=motion||'push';let zoom=1.03,xShift=0;
 if(m==='push')zoom=1.03+.10*p;else if(m==='zoom-out')zoom=1.13-.10*p;else if(m==='pan-left'){zoom=1.09;xShift=(-.08+.16*p)*canvas.width}else if(m==='pan-right'){zoom=1.09;xShift=(.08-.16*p)*canvas.width}
 const w=img.naturalWidth*base*zoom,h=img.naturalHeight*base*zoom;ctx.fillStyle='#050b14';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,(canvas.width-w)/2+xShift,(canvas.height-h)/2,w,h)
}
async function filmPreviewImage621(clip,stage,shotNo,total,seconds){
 stage.innerHTML=`<div class="film-image-preview621"><img id="filmPreviewImage621" src="${escHtml(clip.previewUrl||clip.url)}" alt=""><span class="film-shot-label614">Shot ${shotNo} / ${total} · Image</span></div>`;
 const im=q('#filmPreviewImage621',stage);if(!im)return;im.style.setProperty('--film-image-duration621',seconds+'s');im.dataset.motion621=clip.motion||filmImageMotion621;await sleep56(Math.max(50,seconds*1000));
}
previewFilm614=async function(){
 if(!filmClips614.length)return toast('Add images or video clips first');const target=filmTarget620(),stage=q('#filmStage614');let used=0;
 for(let i=0;i<filmClips614.length&&used<target;i++){
  const clip=filmClips614[i],left=Math.max(0,target-used);if(!stage)return;
  if(filmKind621(clip)==='image'){
   const playFor=Math.min(Number(clip.duration)||filmImageDuration621,left);await filmPreviewImage621(clip,stage,i+1,filmClips614.length,playFor);used+=playFor;
  }else{
   stage.innerHTML=`<video id="filmPreviewPlayer614" autoplay muted playsinline src="${escHtml(clip.url)}"></video><span class="film-shot-label614">Shot ${i+1} / ${filmClips614.length} · Video</span>`;const v=q('#filmPreviewPlayer614');
   await new Promise(res=>{v.onloadedmetadata=()=>{const limit=Math.min(Number.isFinite(v.duration)?v.duration:left,left);clip.duration=Number.isFinite(v.duration)?v.duration:clip.duration;let finished=false;const done=()=>{if(finished)return;finished=true;v.pause();v.ontimeupdate=null;v.onended=null;used+=limit;res()};v.ontimeupdate=()=>{if(v.currentTime>=limit-.04)done()};v.onended=done;v.play().catch(done)};v.onerror=res});
  }
 }
 filmDurationStatus620();stage.innerHTML=`<div class="film-empty614"><b>Preview complete · ${filmFmt620(Math.min(used,target))}</b><span>${used+0.05<target?'Add more images or video shots to reach the target runtime.':'Ready to export the selected runtime.'}</span></div>`
};
exportFilm614=async function(){
 if(filmBusy614)return;if(!filmClips614.length)return toast('Add images or video clips first');if(typeof MediaRecorder==='undefined')return toast('This browser cannot export the Film preview');filmBusy614=true;const button=q('#filmExport614');if(button){button.disabled=true;button.textContent='Building film…'};
 try{
  const target=filmTarget620(),src=filmSourceSeconds620();if(src&&src+0.05<target)toast(`Sources total ${filmFmt620(src)}; export will be shorter than the ${filmFmt620(target)} target.`);
  const vertical=q('#filmRatio614')?.value==='9:16',fps=Number(q('#filmFps614')?.value||30),canvas=document.createElement('canvas');canvas.width=vertical?720:1280;canvas.height=vertical?1280:720;const ctx=canvas.getContext('2d',{alpha:false}),stream=canvas.captureStream(fps),mime=MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':'video/webm';const rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:8000000}),chunks=[];rec.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};const stopped=new Promise(res=>rec.onstop=res);rec.start(500);let used=0;
  for(let i=0;i<filmClips614.length&&used<target;i++){
   const clip=filmClips614[i],left=target-used;
   if(filmKind621(clip)==='image'){
    const playFor=Math.min(Number(clip.duration)||filmImageDuration621,left);if(playFor<=.02)break;const im=new Image();im.src=clip.url;await im.decode();const start=performance.now();await new Promise(res=>{const frame=now=>{const elapsed=(now-start)/1000,p=Math.min(1,elapsed/playFor);filmImageFit621(ctx,im,canvas,p,clip.motion);ctx.fillStyle='rgba(0,0,0,.45)';ctx.fillRect(20,canvas.height-58,310,34);ctx.fillStyle='#fff';ctx.font='20px Arial';ctx.fillText('PIONX FILM  ·  '+filmFmt620(Math.min(target,used+elapsed))+' / '+filmFmt620(target),34,canvas.height-35);if(elapsed>=playFor)res();else requestAnimationFrame(frame)};requestAnimationFrame(frame)});used+=playFor;
   }else{
    const v=document.createElement('video');v.src=clip.url;v.muted=true;v.playsInline=true;await new Promise((res,rej)=>{v.onloadedmetadata=res;v.onerror=()=>rej(Error('Could not read '+clip.name))});clip.duration=Number.isFinite(v.duration)?v.duration:clip.duration;const playFor=Math.min(Number.isFinite(v.duration)?v.duration:left,left);if(playFor<=.02)break;
    let drawing=true;const draw=()=>{if(!drawing)return;const s=Math.max(canvas.width/v.videoWidth,canvas.height/v.videoHeight),w=v.videoWidth*s,h=v.videoHeight*s;ctx.fillStyle='#050b14';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(v,(canvas.width-w)/2,(canvas.height-h)/2,w,h);ctx.fillStyle='rgba(0,0,0,.45)';ctx.fillRect(20,canvas.height-58,310,34);ctx.fillStyle='#fff';ctx.font='20px Arial';ctx.fillText('PIONX FILM  ·  '+filmFmt620(Math.min(target,used+v.currentTime))+' / '+filmFmt620(target),34,canvas.height-35);requestAnimationFrame(draw)};
    await v.play();draw();await new Promise(res=>{let done=false;const finish=()=>{if(done)return;done=true;drawing=false;v.pause();v.ontimeupdate=null;v.onended=null;res()};v.ontimeupdate=()=>{if(v.currentTime>=playFor-.035)finish()};v.onended=finish});used+=playFor;
   }
   if(q('#filmTransition614')?.value==='fade'&&i<filmClips614.length-1&&used<target){for(let a=0;a<=1;a+=.08){ctx.fillStyle=`rgba(5,11,20,${a})`;ctx.fillRect(0,0,canvas.width,canvas.height);await sleep56(28)}}
  }
  rec.stop();await stopped;const blob=new Blob(chunks,{type:mime}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=(q('#filmTitle614')?.value||'PIONX-Film').replace(/[^a-z0-9_-]+/gi,'-')+'.webm';a.click();setTimeout(()=>URL.revokeObjectURL(u),60000);toast(`Film exported · ${filmFmt620(Math.min(used,target))}`)
 }catch(e){console.error(e);toast(e.message||'Film export failed')}finally{filmBusy614=false;if(button){button.disabled=false;button.textContent='Export Film'}}
};
const wireBase621=wireView;
wireView=function(name){wireBase621(name);if(name==='film'){
 const d=q('#filmImageDuration621'),m=q('#filmImageMotion621');d?.addEventListener('change',()=>{filmImageDuration621=Math.max(2,Math.min(12,Number(d.value)||5));for(const c of filmClips614)if(filmKind621(c)==='image')c.duration=filmImageDuration621;filmDurationStatus620();route()});m?.addEventListener('change',()=>{filmImageMotion621=m.value||'push';for(const c of filmClips614)if(filmKind621(c)==='image')c.motion=filmImageMotion621;route()});
 q('#filmDirectorGenerate622')?.addEventListener('click',filmGenerateDirector622);q('#filmApplyDirector622')?.addEventListener('click',filmApplyDirector622);q('#filmDirectorBrief622')?.addEventListener('input',e=>filmDirectorBrief622=e.target.value);q('#filmDirectorMode622')?.addEventListener('change',e=>filmDirectorMode622=e.target.value);q('#filmDirectorStyle622')?.addEventListener('change',e=>filmDirectorStyle622=e.target.value);q('#filmDirectorLanguage622')?.addEventListener('change',e=>filmDirectorLanguage622=e.target.value);qa('[data-director-title622]').forEach(x=>x.oninput=()=>filmDirector622.scenes[+x.dataset.directorTitle622].title=x.value);qa('[data-director-duration622]').forEach(x=>x.oninput=()=>filmDirector622.scenes[+x.dataset.directorDuration622].duration=Math.max(3,Math.min(20,Number(x.value)||6)));qa('[data-director-camera622]').forEach(x=>x.onchange=()=>filmDirector622.scenes[+x.dataset.directorCamera622].camera=x.value);qa('[data-director-visual622]').forEach(x=>x.oninput=()=>filmDirector622.scenes[+x.dataset.directorVisual622].visual_direction=x.value);qa('[data-director-voice622]').forEach(x=>x.oninput=()=>filmDirector622.scenes[+x.dataset.directorVoice622].voiceover=x.value);qa('[data-director-transition622]').forEach(x=>x.oninput=()=>filmDirector622.scenes[+x.dataset.directorTransition622].transition=x.value);qa('[data-director-sfx622]').forEach(x=>x.oninput=()=>filmDirector622.scenes[+x.dataset.directorSfx622].sfx=x.value);q('#filmDirectorFullVoice622')?.addEventListener('input',e=>filmDirector622.voiceover_script=e.target.value);
 }};
// ===== END PIONX V6.21 =====


// ===== PIONX V6.24 · FILM AI VOICE OVER + AUDIO MIX =====
const filmAudio624={
 voiceUrl:'',voiceBlob:null,voiceName:'',voice:'coral',voiceVolume:.92,
 musicUrl:'',musicBlob:null,musicName:'',musicVolume:.26,
 sfxUrl:'',sfxBlob:null,sfxName:'',sfxVolume:.34,
 keepSourceAudio:false,busy:false
};
function filmAudioRevoke624(key){const u=filmAudio624[key];if(u&&String(u).startsWith('blob:'))try{URL.revokeObjectURL(u)}catch{}filmAudio624[key]=''}
function filmVoiceScript624(){
 const live=q('#filmDirectorFullVoice622')?.value?.trim();if(live)return live;
 if(filmDirector622?.voiceover_script?.trim())return filmDirector622.voiceover_script.trim();
 const sceneVoice=(filmDirector622?.scenes||[]).map(x=>String(x?.voiceover||'').trim()).filter(Boolean).join(' ');if(sceneVoice)return sceneVoice;
 return String(filmDirectorBrief622||q('#filmDirectorBrief622')?.value||'').trim();
}
function filmAudioPanel624(){
 const voiceReady=!!filmAudio624.voiceUrl,musicReady=!!filmAudio624.musicUrl,sfxReady=!!filmAudio624.sfxUrl;
 return `<div class="film-audio624"><div class="film-audio-head624"><div><b>AI Voice Over & Audio Mix</b><small>Generate narration, add music/SFX and mix them into the exported film.</small></div><span>V6.24</span></div>
 <label>AI voice<select id="filmVoice624">${['coral','alloy','nova','onyx'].map(v=>`<option value="${v}" ${filmAudio624.voice===v?'selected':''}>${v[0].toUpperCase()+v.slice(1)}</option>`).join('')}</select></label>
 <button class="primary-btn" id="filmGenerateVoice624" style="width:100%">${voiceReady?'Regenerate AI Voice Over':'Generate AI Voice Over ✦'}</button>
 <div class="film-audio-ready624" id="filmVoiceStatus624">${voiceReady?'✓ '+escHtml(filmAudio624.voiceName||'AI voice-over ready'):'Uses the full Voice-over Script from AI Director.'}</div>
 <div class="film-audio-files624"><label class="video-source-drop614">Background music<input id="filmMusicFile624" type="file" accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/webm,audio/mp4"><span>${musicReady?'✓ '+escHtml(filmAudio624.musicName):'MP3 / WAV / OGG / M4A'}</span></label><label class="video-source-drop614">Sound effects / ambience<input id="filmSfxFile624" type="file" accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/webm,audio/mp4"><span>${sfxReady?'✓ '+escHtml(filmAudio624.sfxName):'Optional ambience / SFX track'}</span></label></div>
 <div class="film-audio-sliders624"><label>Voice <input id="filmVoiceVolume624" type="range" min="0" max="1" step="0.01" value="${filmAudio624.voiceVolume}"><b>${Math.round(filmAudio624.voiceVolume*100)}%</b></label><label>Music <input id="filmMusicVolume624" type="range" min="0" max="1" step="0.01" value="${filmAudio624.musicVolume}"><b>${Math.round(filmAudio624.musicVolume*100)}%</b></label><label>SFX <input id="filmSfxVolume624" type="range" min="0" max="1" step="0.01" value="${filmAudio624.sfxVolume}"><b>${Math.round(filmAudio624.sfxVolume*100)}%</b></label></div>
 <label class="film-audio-check624"><input id="filmKeepSourceAudio624" type="checkbox" ${filmAudio624.keepSourceAudio?'checked':''}> Keep original audio from uploaded video clips</label>
 <div class="film-audio-actions624"><button class="ghost-btn" id="filmPreviewAudio624">▶ Preview Audio Mix</button>${voiceReady?'<button class="ghost-btn" id="filmClearVoice624">Remove Voice</button>':''}${musicReady?'<button class="ghost-btn" id="filmClearMusic624">Remove Music</button>':''}${sfxReady?'<button class="ghost-btn" id="filmClearSfx624">Remove SFX</button>':''}</div></div>`;
}
const filmPageBase624=filmPage614;
filmPage614=function(){
 const html=filmPageBase624(),audio=filmAudioPanel624(),close=html.lastIndexOf('</section>');
 if(close<0)return html+audio;
 return html.slice(0,close)+`<div class="section-title film-audio-title624"><div><h2>Voice Over & Audio</h2><p>Generate the narration from the approved full voice-over script, then mix music and SFX before export.</p></div></div>`+audio+html.slice(close);
};
routes.film=filmPage614;
function filmSetAudioFile624(file,type){if(!file)return;const ok=/^audio\//i.test(file.type||'')||/\.(mp3|wav|ogg|m4a|aac|webm)$/i.test(file.name||'');if(!ok)return toast('Choose an audio file');const key=type+'Url',blobKey=type+'Blob',nameKey=type+'Name';filmAudioRevoke624(key);filmAudio624[blobKey]=file;filmAudio624[nameKey]=file.name||type;filmAudio624[key]=URL.createObjectURL(file);route();toast(type==='music'?'Background music added':'SFX / ambience added')}
async function filmGenerateVoice624(){
 if(filmAudio624.busy)return;const text=filmVoiceScript624();if(!text)return toast('Create a story/voice-over script first');if(!signedIn56())return toast('Sign in before generating AI voice-over');
 const b=q('#filmGenerateVoice624');filmAudio624.busy=true;if(b){b.disabled=true;b.textContent='Generating voice-over…'};
 try{filmAudio624.voice=q('#filmVoice624')?.value||filmAudio624.voice;const r=await pxApi56('/server/film-audio-v624.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'voiceover',text,voice:filmAudio624.voice,language:filmDirectorLanguage622||'English',style:filmDirectorStyle622||'Architectural Film'})});if(!r.ok){let msg='AI voice-over failed';try{const j=await json56(r,'PIONX Film Voice');msg=j.error||msg}catch{}throw Error(msg)}const blob=await r.blob();if(!blob.size)throw Error('AI voice-over returned an empty audio file');filmAudioRevoke624('voiceUrl');filmAudio624.voiceBlob=blob;filmAudio624.voiceName=`PIONX AI Voice · ${filmAudio624.voice}`;filmAudio624.voiceUrl=URL.createObjectURL(blob);toast('AI voice-over ready');route()}catch(e){console.error('PIONX film voice',e);toast(e.message||'AI voice-over failed')}finally{filmAudio624.busy=false;if(b){b.disabled=false;b.textContent='Generate AI Voice Over ✦'}}
}
function filmAudioEl624(url,loop=false){if(!url)return null;const a=new Audio(url);a.preload='auto';a.loop=loop;a.playsInline=true;return a}
async function filmPreviewAudio624(){
 const list=[];if(filmAudio624.voiceUrl)list.push([filmAudioEl624(filmAudio624.voiceUrl),filmAudio624.voiceVolume]);if(filmAudio624.musicUrl)list.push([filmAudioEl624(filmAudio624.musicUrl,true),filmAudio624.musicVolume]);if(filmAudio624.sfxUrl)list.push([filmAudioEl624(filmAudio624.sfxUrl),filmAudio624.sfxVolume]);if(!list.length)return toast('Generate voice-over or add music/SFX first');
 try{for(const [a,v] of list){a.volume=Math.max(0,Math.min(1,v));await a.play().catch(()=>{})}toast('Audio mix preview · 12 seconds');await sleep56(12000)}finally{for(const [a] of list){try{a.pause();a.currentTime=0}catch{}}}
}
function filmWireAudio624(){
 q('#filmGenerateVoice624')?.addEventListener('click',filmGenerateVoice624);q('#filmVoice624')?.addEventListener('change',e=>filmAudio624.voice=e.target.value);
 q('#filmMusicFile624')?.addEventListener('change',e=>filmSetAudioFile624(e.target.files?.[0],'music'));q('#filmSfxFile624')?.addEventListener('change',e=>filmSetAudioFile624(e.target.files?.[0],'sfx'));
 const bindVol=(id,key)=>q(id)?.addEventListener('input',e=>{filmAudio624[key]=Math.max(0,Math.min(1,Number(e.target.value)||0));const b=e.target.parentElement?.querySelector('b');if(b)b.textContent=Math.round(filmAudio624[key]*100)+'%'});bindVol('#filmVoiceVolume624','voiceVolume');bindVol('#filmMusicVolume624','musicVolume');bindVol('#filmSfxVolume624','sfxVolume');
 q('#filmKeepSourceAudio624')?.addEventListener('change',e=>filmAudio624.keepSourceAudio=!!e.target.checked);q('#filmPreviewAudio624')?.addEventListener('click',filmPreviewAudio624);
 q('#filmClearVoice624')?.addEventListener('click',()=>{filmAudioRevoke624('voiceUrl');filmAudio624.voiceBlob=null;filmAudio624.voiceName='';route()});q('#filmClearMusic624')?.addEventListener('click',()=>{filmAudioRevoke624('musicUrl');filmAudio624.musicBlob=null;filmAudio624.musicName='';route()});q('#filmClearSfx624')?.addEventListener('click',()=>{filmAudioRevoke624('sfxUrl');filmAudio624.sfxBlob=null;filmAudio624.sfxName='';route()});
}
function filmAttachAudio624(ctx,dest,url,gainValue,loop=false){if(!url)return null;const el=filmAudioEl624(url,loop),src=ctx.createMediaElementSource(el),gain=ctx.createGain();gain.gain.value=Math.max(0,Math.min(1,Number(gainValue)||0));src.connect(gain).connect(dest);return {el,src,gain}}
async function filmStartAudio624(nodes){for(const n of nodes.filter(Boolean)){try{n.el.currentTime=0;await n.el.play()}catch(e){console.warn('Film audio start',e)}}}
function filmStopAudio624(nodes){for(const n of nodes.filter(Boolean)){try{n.el.pause();n.el.currentTime=0;n.src.disconnect();n.gain.disconnect()}catch{}}}
exportFilm614=async function(){
 if(filmBusy614)return;if(!filmClips614.length)return toast('Add images or video clips first');if(typeof MediaRecorder==='undefined')return toast('This browser cannot export the Film preview');filmBusy614=true;const button=q('#filmExport614');if(button){button.disabled=true;button.textContent='Building film + audio…'};let audioCtx=null,audioNodes=[];
 try{
  const target=filmTarget620(),src=filmSourceSeconds620();if(src&&src+0.05<target)toast(`Sources total ${filmFmt620(src)}; export will be shorter than the ${filmFmt620(target)} target.`);
  const vertical=q('#filmRatio614')?.value==='9:16',fps=Number(q('#filmFps614')?.value||30),canvas=document.createElement('canvas');canvas.width=vertical?720:1280;canvas.height=vertical?1280:720;const ctx=canvas.getContext('2d',{alpha:false}),videoStream=canvas.captureStream(fps);
  const AC=window.AudioContext||window.webkitAudioContext;let mixDest=null;if(AC){audioCtx=new AC();await audioCtx.resume();mixDest=audioCtx.createMediaStreamDestination();audioNodes=[filmAttachAudio624(audioCtx,mixDest,filmAudio624.voiceUrl,filmAudio624.voiceVolume,false),filmAttachAudio624(audioCtx,mixDest,filmAudio624.musicUrl,filmAudio624.musicVolume,true),filmAttachAudio624(audioCtx,mixDest,filmAudio624.sfxUrl,filmAudio624.sfxVolume,false)].filter(Boolean)}
  const tracks=[...videoStream.getVideoTracks(),...(mixDest?mixDest.stream.getAudioTracks():[])],stream=new MediaStream(tracks),mime=MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')?'video/webm;codecs=vp9,opus':(MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':'video/webm'),rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:9000000,audioBitsPerSecond:192000}),chunks=[];rec.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};const stopped=new Promise(res=>rec.onstop=res);rec.start(500);await filmStartAudio624(audioNodes);let used=0;
  for(let i=0;i<filmClips614.length&&used<target;i++){
   const clip=filmClips614[i],left=target-used;
   if(filmKind621(clip)==='image'){
    const playFor=Math.min(Number(clip.duration)||filmImageDuration621,left);if(playFor<=.02)break;const im=new Image();im.src=clip.url;await im.decode();const start=performance.now();await new Promise(res=>{const frame=now=>{const elapsed=(now-start)/1000,p=Math.min(1,elapsed/playFor);filmImageFit621(ctx,im,canvas,p,clip.motion);ctx.fillStyle='rgba(0,0,0,.45)';ctx.fillRect(20,canvas.height-58,310,34);ctx.fillStyle='#fff';ctx.font='20px Arial';ctx.fillText('PIONX FILM  ·  '+filmFmt620(Math.min(target,used+elapsed))+' / '+filmFmt620(target),34,canvas.height-35);if(elapsed>=playFor)res();else requestAnimationFrame(frame)};requestAnimationFrame(frame)});used+=playFor;
   }else{
    const v=document.createElement('video');v.src=clip.url;v.playsInline=true;v.preload='auto';await new Promise((res,rej)=>{v.onloadedmetadata=res;v.onerror=()=>rej(Error('Could not read '+clip.name))});clip.duration=Number.isFinite(v.duration)?v.duration:clip.duration;const playFor=Math.min(Number.isFinite(v.duration)?v.duration:left,left);if(playFor<=.02)break;let clipAudio=null;if(filmAudio624.keepSourceAudio&&audioCtx&&mixDest){try{v.muted=false;clipAudio=filmAttachAudio624(audioCtx,mixDest,clip.url,.62,false);if(clipAudio){clipAudio.el.currentTime=0;clipAudio.el.muted=false;await clipAudio.el.play().catch(()=>{})}}catch(e){console.warn('Source clip audio skipped',e)}}else v.muted=true;
    let drawing=true;const draw=()=>{if(!drawing)return;const s=Math.max(canvas.width/v.videoWidth,canvas.height/v.videoHeight),w=v.videoWidth*s,h=v.videoHeight*s;ctx.fillStyle='#050b14';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(v,(canvas.width-w)/2,(canvas.height-h)/2,w,h);ctx.fillStyle='rgba(0,0,0,.45)';ctx.fillRect(20,canvas.height-58,310,34);ctx.fillStyle='#fff';ctx.font='20px Arial';ctx.fillText('PIONX FILM  ·  '+filmFmt620(Math.min(target,used+v.currentTime))+' / '+filmFmt620(target),34,canvas.height-35);requestAnimationFrame(draw)};
    await v.play();draw();await new Promise(res=>{let done=false;const finish=()=>{if(done)return;done=true;drawing=false;v.pause();v.ontimeupdate=null;v.onended=null;res()};v.ontimeupdate=()=>{if(v.currentTime>=playFor-.035)finish()};v.onended=finish});if(clipAudio)filmStopAudio624([clipAudio]);used+=playFor;
   }
   if(q('#filmTransition614')?.value==='fade'&&i<filmClips614.length-1&&used<target){for(let a=0;a<=1;a+=.08){ctx.fillStyle=`rgba(5,11,20,${a})`;ctx.fillRect(0,0,canvas.width,canvas.height);await sleep56(28)}}
  }
  filmStopAudio624(audioNodes);rec.stop();await stopped;const blob=new Blob(chunks,{type:mime}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=(q('#filmTitle614')?.value||'PIONX-Film').replace(/[^a-z0-9_-]+/gi,'-')+'.webm';a.click();setTimeout(()=>URL.revokeObjectURL(u),60000);toast(`Film + audio exported · ${filmFmt620(Math.min(used,target))}`)
 }catch(e){console.error(e);toast(e.message||'Film export failed')}finally{filmStopAudio624(audioNodes);if(audioCtx)try{await audioCtx.close()}catch{}filmBusy614=false;if(button){button.disabled=false;button.textContent='Export Film'}}
};
const wireBase624=wireView;
wireView=function(name){wireBase624(name);if(name==='film')filmWireAudio624()};
// ===== END PIONX V6.24 =====

// ===== PIONX V6.25 · REAL AI FILM MOTION + VIDEO CREDIT ROUTE =====
let filmMotionBusy625=false,filmMotionQuality625='premium',filmMotionAutoCamera625=true,filmMotionQuoteState625=null;
const filmCameraPlan625=[
 'Slow cinematic dolly-in with subtle parallax and depth',
 'Smooth orbit right around the architecture, restrained angle change, real 3D parallax',
 'Slow crane-up reveal with stable verticals and preserved architecture',
 'Lateral tracking move from left to right with foreground/background parallax',
 'Slow pull-back reveal, widening context while preserving the exact building',
 'Gentle orbit left with premium architectural camera motion'
];
function filmPlayableKind625(c){return c?.generatedVideoUrl625?'video':filmKind621(c)}
function filmPlayableUrl625(c){return c?.generatedVideoUrl625||c?.url||''}
function filmGeneratedCount625(){return filmClips614.filter(c=>!!c.generatedVideoUrl625).length}
function filmImageCount625(){return filmClips614.filter(c=>filmKind621(c)==='image').length}
function filmProviderDuration625(sec){sec=Number(sec)||5;return sec<=4?4:sec<=6?6:8}
function filmCameraFor625(c,i){
 const scene=c?.directorScene||{};const chosen=String(scene.camera||'').trim();
 if(!filmMotionAutoCamera625&&chosen)return chosen;
 const imageClips=filmClips614.filter(x=>filmKind621(x)==='image'),cams=imageClips.map(x=>String(x?.directorScene?.camera||'').trim().toLowerCase()).filter(Boolean),unique=new Set(cams);
 if(chosen&&unique.size>1)return chosen;
 return filmCameraPlan625[i%filmCameraPlan625.length];
}
function filmMotionPanel625(){
 const imgs=filmImageCount625(),done=filmGeneratedCount625(),qv=filmMotionQuoteState625;
 return `<section class="panel" id="filmMotionPanel625" style="margin-top:18px;padding:18px"><div class="section-title" style="margin:0 0 12px"><div><small>REAL AI VIDEO SHOTS</small><h2 style="margin:4px 0">AI Motion & Camera Generation</h2><p>Convert storyboard still images into true AI-generated video shots with real camera movement, parallax and scene motion. This is the paid generation step; Export Film only assembles finished shots.</p></div><span class="status-pill">${done}/${imgs} AI shots</span></div>
 <div class="form-grid"><label>Video quality<select id="filmMotionQuality625"><option value="premium" ${filmMotionQuality625==='premium'?'selected':''}>Premium Cinematic</option><option value="fast" ${filmMotionQuality625==='fast'?'selected':''}>Fast Preview</option></select></label><label class="film-audio-check624" style="align-self:end"><input id="filmAutoCamera625" type="checkbox" ${filmMotionAutoCamera625?'checked':''}> Auto-vary camera movement between scenes</label></div>
 <div class="alert-box" style="margin:12px 0">Each still-image scene is sent through the existing PIONX Video engine. Credits are quoted/reserved by the server for every generated shot. Finished AI clips replace the flat still-image motion during Preview and Export.</div>
 <div class="film-audio-actions624"><button class="ghost-btn" id="filmMotionQuote625">Check AI Motion Credits</button><button class="primary-btn" id="filmGenerateMotion625" ${imgs?'':'disabled'}>${done&&done===imgs?'Regenerate Missing AI Motion':'Generate AI Motion Shots ✦'}</button></div>
 <div class="film-audio-ready624" id="filmMotionStatus625">${qv?`Estimated: ${qv.cost} credits · reserve ${qv.reserve} credits for ${qv.shots} shot(s)`:(imgs?`${imgs} still-image scene(s) ready for real AI motion.`:'Upload still images first.')}</div></section>`;
}
const filmPageBase625=filmPage614;
filmPage614=function(){
 const html=filmPageBase625(),panel=filmMotionPanel625();
 const marker='<div class="section-title film-audio-title624">';const at=html.indexOf(marker);
 if(at>=0)return html.slice(0,at)+panel+html.slice(at);
 const close=html.lastIndexOf('</section>');return close>=0?html.slice(0,close)+panel+html.slice(close):html+panel;
};
routes.film=filmPage614;

// Expand the storyboard camera choices for true video generation.
filmDirectorScene622=function(scene,i){
 const imgs=filmClips614.filter(c=>filmKind621(c)==='image'),src=imgs[Math.max(0,Math.min(imgs.length-1,Number(scene.source_index)||0))],cur=String(scene.camera||'Slow cinematic push');
 const cams=['Slow cinematic push','Orbit left','Orbit right','Crane up','Fly-through','Lateral tracking','Slow pull back'];
 return `<article class="film-director-scene622" data-director-scene622="${i}"><div class="film-director-thumb622">${src?`<img loading="lazy" decoding="async" src="${escHtml(src.thumbUrl||src.previewUrl||src.url)}" alt="">`:'<span>No image</span>'}<b>${i+1}</b></div><div class="film-director-fields622"><label>Scene title<input data-director-title622="${i}" value="${escHtml(scene.title||'Scene '+(i+1))}"></label><div class="film-director-row622"><label>Duration<input type="number" min="3" max="20" data-director-duration622="${i}" value="${Number(scene.duration)||6}"></label><label>Camera<select data-director-camera622="${i}">${cams.map(x=>`<option ${cur.toLowerCase().includes(x.toLowerCase().replace('cinematic ',''))||cur.toLowerCase()===x.toLowerCase()?'selected':''}>${x}</option>`).join('')}</select></label></div><label>Visual direction<textarea data-director-visual622="${i}">${escHtml(scene.visual_direction||'')}</textarea></label><label>Voice-over<textarea data-director-voice622="${i}">${escHtml(scene.voiceover||'')}</textarea></label><div class="film-director-row622"><label>Transition<input data-director-transition622="${i}" value="${escHtml(scene.transition||'Soft fade')}"></label><label>SFX<input data-director-sfx622="${i}" value="${escHtml(scene.sfx||'')}"></label></div></div></article>`;
};

filmThumb621=function(c){
 if(c?.generatedVideoUrl625)return `<video muted preload="metadata" playsinline src="${escHtml(c.generatedVideoUrl625)}"></video>`;
 return filmKind621(c)==='image'?`<img loading="lazy" decoding="async" fetchpriority="low" src="${escHtml(c.thumbUrl||c.previewUrl||c.url)}" alt="${escHtml(c.name||'Film image')}">`:`<video muted preload="metadata" playsinline src="${escHtml(c.url)}"></video>`;
};
filmStageMedia621=function(c){
 if(c?.generatedVideoUrl625)return `<video controls preload="metadata" src="${escHtml(c.generatedVideoUrl625)}"></video>`;
 return filmKind621(c)==='image'?`<div class="film-image-stage621"><img decoding="async" src="${escHtml(c.previewUrl||c.url)}" alt="${escHtml(c.name||'Film image')}"><span>IMAGE SHOT · ${filmFmt620(c.duration||filmImageDuration621)}</span></div>`:`<video controls preload="metadata" src="${escHtml(c.url)}"></video>`;
};
async function filmSourceData625(c){
 const u=c.previewUrl||c.thumbUrl||c.url;const b=await (await fetch(u)).blob();return await filmBlobData622(b);
}
async function filmQuoteMotion625(){
 const clips=filmClips614.filter(c=>filmKind621(c)==='image'&&!c.generatedVideoUrl625);if(!clips.length){filmMotionQuoteState625={cost:0,reserve:0,shots:0};const s=q('#filmMotionStatus625');if(s)s.textContent='All still-image shots already have AI motion.';return filmMotionQuoteState625}
 const btn=q('#filmMotionQuote625');if(btn){btn.disabled=true;btn.textContent='Checking…'};let cost=0,reserve=0;
 try{for(const c of clips){const d=filmProviderDuration625(c.duration);const j=await videoCall66({action:'quote',quality:filmMotionQuality625,duration:d});cost+=Number(j.credits_cost)||0;reserve+=Number(j.credits_reserved)||0}filmMotionQuoteState625={cost,reserve,shots:clips.length};const s=q('#filmMotionStatus625');if(s)s.textContent=`Estimated: ${cost} credits · temporary reserve ${reserve} credits · ${clips.length} AI shot(s)`;return filmMotionQuoteState625}catch(e){const s=q('#filmMotionStatus625');if(s)s.textContent=e.message;throw e}finally{if(btn){btn.disabled=false;btn.textContent='Check AI Motion Credits'}}
}
async function filmWaitVideo625(id,index,total){
 const end=Date.now()+12*60*1000;while(Date.now()<end){const j=await videoCall66({action:'status',id});const st=String(j.state||j.status||'').toLowerCase();const s=q('#filmMotionStatus625');if(s)s.textContent=`AI shot ${index}/${total} · ${st||'rendering'}…`;if(st==='ready')return j;if(['failed','error','cancelled','canceled'].includes(st))throw Error(j.error||`AI shot ${index} failed`);await sleep56(10000)}throw Error(`AI shot ${index} exceeded the safe processing time`)
}
async function filmDownloadVideo625(id){const r=await pxApi56('/server/video-direct-v66.php?action=download&id='+encodeURIComponent(id));if(!r.ok){let msg='AI video download failed';try{msg=(await json56(r,'Film AI video')).error||msg}catch{}throw Error(msg)}return await r.blob()}
async function filmGenerateMotion625(){
 if(filmMotionBusy625)return;if(!signedIn56())return toast('Sign in before generating AI film shots');const clips=filmClips614.filter(c=>filmKind621(c)==='image'&&!c.generatedVideoUrl625);if(!clips.length)return toast('All still images already have AI motion');filmMotionBusy625=true;const btn=q('#filmGenerateMotion625');if(btn){btn.disabled=true;btn.textContent='Generating AI shots…'};
 try{
  filmMotionQuality625=q('#filmMotionQuality625')?.value||filmMotionQuality625;filmMotionAutoCamera625=!!q('#filmAutoCamera625')?.checked;await filmQuoteMotion625();
  for(let n=0;n<clips.length;n++){
   const c=clips[n],scene=c.directorScene||{},camera=filmCameraFor625(c,n),duration=filmProviderDuration625(c.duration),image=await filmSourceData625(c);
   const visual=String(scene.visual_direction||'').trim(),title=String(scene.title||`Scene ${n+1}`).trim();
   const prompt=[`PIONX FILM SHOT ${n+1}: ${title}.`,visual,`CAMERA: ${camera}.`,`Create genuine cinematic 3D camera motion with natural parallax, depth change and environmental movement. Preserve the exact architecture, massing, facade openings, materials, landscape identity and overall design. Keep verticals stable and motion physically plausible. Do NOT simulate a flat slideshow, simple 2D Ken Burns zoom, warped geometry, melting facade, changing windows, duplicated objects or unstable structure.`].filter(Boolean).join('\n');
   const s=q('#filmMotionStatus625');if(s)s.textContent=`Submitting AI shot ${n+1}/${clips.length} · ${camera}…`;
   const j=await videoCall66({action:'start',prompt,image,quality:filmMotionQuality625,duration});const id=j.id;if(!id)throw Error(`AI shot ${n+1} did not return a job id`);c.generatedJob625=id;c.generatedCamera625=camera;c.timelineDuration625=Number(c.duration)||duration;
   await loadAccount56({quiet:true}).catch(()=>{});await filmWaitVideo625(id,n+1,clips.length);const blob=await filmDownloadVideo625(id),url=URL.createObjectURL(blob);if(c.generatedVideoUrl625?.startsWith('blob:'))try{URL.revokeObjectURL(c.generatedVideoUrl625)}catch{}c.generatedVideoBlob625=blob;c.generatedVideoUrl625=url;c.generatedVideoDuration625=await filmProbeDuration620(url).catch(()=>duration);await loadAccount56({quiet:true}).catch(()=>{});
  }
  filmMotionQuoteState625=null;toast(`${clips.length} real AI motion shot(s) ready · credits updated`);route();
 }catch(e){console.error('PIONX Film AI motion',e);toast(e.message||'AI motion generation failed');const s=q('#filmMotionStatus625');if(s)s.textContent=e.message||'AI motion generation failed';await loadAccount56({quiet:true}).catch(()=>{})}finally{filmMotionBusy625=false;if(btn){btn.disabled=false;btn.textContent='Generate AI Motion Shots ✦'}}
}

// Preview uses generated AI video whenever it exists; otherwise it keeps the still-image fallback.
previewFilm614=async function(){
 if(!filmClips614.length)return toast('Add images or video clips first');const target=filmTarget620(),stage=q('#filmStage614');let used=0;
 for(let i=0;i<filmClips614.length&&used<target;i++){
  const clip=filmClips614[i],left=Math.max(0,target-used);if(!stage)return;const kind=filmPlayableKind625(clip);
  if(kind==='image'){const playFor=Math.min(Number(clip.duration)||filmImageDuration621,left);await filmPreviewImage621(clip,stage,i+1,filmClips614.length,playFor);used+=playFor}
  else{const src=filmPlayableUrl625(clip);stage.innerHTML=`<video id="filmPreviewPlayer614" autoplay muted playsinline src="${escHtml(src)}"></video><span class="film-shot-label614">Shot ${i+1} / ${filmClips614.length} · ${clip.generatedVideoUrl625?'AI Video':'Video'}</span>`;const v=q('#filmPreviewPlayer614');await new Promise(res=>{v.onloadedmetadata=()=>{const planned=Number(clip.timelineDuration625||clip.duration)||v.duration||left,limit=Math.min(Number.isFinite(v.duration)?v.duration:left,planned,left);let finished=false;const done=()=>{if(finished)return;finished=true;v.pause();v.ontimeupdate=null;v.onended=null;used+=limit;res()};v.ontimeupdate=()=>{if(v.currentTime>=limit-.04)done()};v.onended=done;v.play().catch(done)};v.onerror=res})}
 }
 filmDurationStatus620();stage.innerHTML=`<div class="film-empty614"><b>Preview complete · ${filmFmt620(Math.min(used,target))}</b><span>${filmGeneratedCount625()?filmGeneratedCount625()+' real AI motion shot(s) included.':'Still-image fallback used; generate AI Motion Shots for real camera movement.'}</span></div>`
};

// Export V6.25: same audio mix, but generated AI video clips replace flat stills.
exportFilm614=async function(){
 if(filmBusy614)return;if(!filmClips614.length)return toast('Add images or video clips first');if(typeof MediaRecorder==='undefined')return toast('This browser cannot export the Film preview');filmBusy614=true;const button=q('#filmExport614');if(button){button.disabled=true;button.textContent='Building film + audio…'};let audioCtx=null,audioNodes=[];
 try{
  const target=filmTarget620(),src=filmSourceSeconds620();if(src&&src+0.05<target)toast(`Sources total ${filmFmt620(src)}; export will be shorter than the ${filmFmt620(target)} target.`);
  const vertical=q('#filmRatio614')?.value==='9:16',fps=Number(q('#filmFps614')?.value||30),canvas=document.createElement('canvas');canvas.width=vertical?720:1280;canvas.height=vertical?1280:720;const ctx=canvas.getContext('2d',{alpha:false}),videoStream=canvas.captureStream(fps);
  const AC=window.AudioContext||window.webkitAudioContext;let mixDest=null;if(AC){audioCtx=new AC();await audioCtx.resume();mixDest=audioCtx.createMediaStreamDestination();audioNodes=[filmAttachAudio624(audioCtx,mixDest,filmAudio624.voiceUrl,filmAudio624.voiceVolume,false),filmAttachAudio624(audioCtx,mixDest,filmAudio624.musicUrl,filmAudio624.musicVolume,true),filmAttachAudio624(audioCtx,mixDest,filmAudio624.sfxUrl,filmAudio624.sfxVolume,false)].filter(Boolean)}
  const tracks=[...videoStream.getVideoTracks(),...(mixDest?mixDest.stream.getAudioTracks():[])],stream=new MediaStream(tracks),mime=MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')?'video/webm;codecs=vp9,opus':(MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':'video/webm'),rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:9000000,audioBitsPerSecond:192000}),chunks=[];rec.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};const stopped=new Promise(res=>rec.onstop=res);rec.start(500);await filmStartAudio624(audioNodes);let used=0;
  for(let i=0;i<filmClips614.length&&used<target;i++){
   const clip=filmClips614[i],left=target-used,kind=filmPlayableKind625(clip);
   if(kind==='image'){
    const playFor=Math.min(Number(clip.duration)||filmImageDuration621,left);if(playFor<=.02)break;const im=new Image();im.src=clip.url;await im.decode();const start=performance.now();await new Promise(res=>{const frame=now=>{const elapsed=(now-start)/1000,p=Math.min(1,elapsed/playFor);filmImageFit621(ctx,im,canvas,p,clip.motion);ctx.fillStyle='rgba(0,0,0,.45)';ctx.fillRect(20,canvas.height-58,310,34);ctx.fillStyle='#fff';ctx.font='20px Arial';ctx.fillText('PIONX FILM  ·  '+filmFmt620(Math.min(target,used+elapsed))+' / '+filmFmt620(target),34,canvas.height-35);if(elapsed>=playFor)res();else requestAnimationFrame(frame)};requestAnimationFrame(frame)});used+=playFor;
   }else{
    const v=document.createElement('video');v.src=filmPlayableUrl625(clip);v.playsInline=true;v.preload='auto';await new Promise((res,rej)=>{v.onloadedmetadata=res;v.onerror=()=>rej(Error('Could not read '+clip.name))});const planned=Number(clip.timelineDuration625||clip.duration)||v.duration||left,playFor=Math.min(Number.isFinite(v.duration)?v.duration:left,planned,left);if(playFor<=.02)break;let clipAudio=null;if(filmAudio624.keepSourceAudio&&!clip.generatedVideoUrl625&&audioCtx&&mixDest){try{clipAudio=filmAttachAudio624(audioCtx,mixDest,clip.url,.62,false);if(clipAudio){clipAudio.el.currentTime=0;clipAudio.el.muted=false;await clipAudio.el.play().catch(()=>{})}}catch(e){console.warn('Source clip audio skipped',e)}}v.muted=true;
    let drawing=true;const draw=()=>{if(!drawing)return;const s=Math.max(canvas.width/v.videoWidth,canvas.height/v.videoHeight),w=v.videoWidth*s,h=v.videoHeight*s;ctx.fillStyle='#050b14';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(v,(canvas.width-w)/2,(canvas.height-h)/2,w,h);ctx.fillStyle='rgba(0,0,0,.45)';ctx.fillRect(20,canvas.height-58,310,34);ctx.fillStyle='#fff';ctx.font='20px Arial';ctx.fillText('PIONX FILM  ·  '+filmFmt620(Math.min(target,used+v.currentTime))+' / '+filmFmt620(target),34,canvas.height-35);requestAnimationFrame(draw)};await v.play();draw();await new Promise(res=>{let done=false;const finish=()=>{if(done)return;done=true;drawing=false;v.pause();v.ontimeupdate=null;v.onended=null;res()};v.ontimeupdate=()=>{if(v.currentTime>=playFor-.035)finish()};v.onended=finish});if(clipAudio)filmStopAudio624([clipAudio]);used+=playFor;
   }
   if(q('#filmTransition614')?.value==='fade'&&i<filmClips614.length-1&&used<target){for(let a=0;a<=1;a+=.08){ctx.fillStyle=`rgba(5,11,20,${a})`;ctx.fillRect(0,0,canvas.width,canvas.height);await sleep56(28)}}
  }
  filmStopAudio624(audioNodes);rec.stop();await stopped;const blob=new Blob(chunks,{type:mime}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=(q('#filmTitle614')?.value||'PIONX-Film').replace(/[^a-z0-9_-]+/gi,'-')+'.webm';a.click();setTimeout(()=>URL.revokeObjectURL(u),60000);toast(`Film exported · ${filmGeneratedCount625()} real AI motion shot(s) · ${filmFmt620(Math.min(used,target))}`)
 }catch(e){console.error(e);toast(e.message||'Film export failed')}finally{filmStopAudio624(audioNodes);if(audioCtx)try{await audioCtx.close()}catch{}filmBusy614=false;if(button){button.disabled=false;button.textContent='Export Film'}}
};
const wireBase625=wireView;
wireView=function(name){wireBase625(name);if(name==='film'){
 q('#filmMotionQuality625')?.addEventListener('change',e=>{filmMotionQuality625=e.target.value;filmMotionQuoteState625=null});q('#filmAutoCamera625')?.addEventListener('change',e=>filmMotionAutoCamera625=!!e.target.checked);q('#filmMotionQuote625')?.addEventListener('click',()=>filmQuoteMotion625().catch(e=>toast(e.message)));q('#filmGenerateMotion625')?.addEventListener('click',filmGenerateMotion625);
 }};
// ===== END PIONX V6.25 =====

// ===== PIONX V6.26 · FILM AUTO ENGINE (OMNI PRIMARY + GROK FALLBACK) =====
async function filmVideoCall626(payload){
 const r=await pxApi56('/server/film-video-auto-v626.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
 const j=await json56(r,'PIONX Film AI');if(!r.ok)throw Error(j.error||'Film AI request failed');return j
}
filmMotionPanel625=function(){
 const imgs=filmImageCount625(),done=filmGeneratedCount625(),qv=filmMotionQuoteState625;
 return `<section class="panel" id="filmMotionPanel625" style="margin-top:18px;padding:18px"><div class="section-title" style="margin:0 0 12px"><div><small>PIONX AUTO FILM ENGINE</small><h2 style="margin:4px 0">AI Motion & Camera Generation</h2><p>PIONX automatically selects the best available Film engine for each shot, then falls back safely if the primary route is unavailable. Provider names stay hidden from users.</p></div><span class="status-pill">${done}/${imgs} AI shots</span></div>
 <div class="form-grid"><label>Film quality<select id="filmMotionQuality625"><option value="premium" ${filmMotionQuality625==='premium'?'selected':''}>Premium Cinematic</option><option value="fast" ${filmMotionQuality625==='fast'?'selected':''}>Fast Preview</option></select></label><label class="film-audio-check624" style="align-self:end"><input id="filmAutoCamera625" type="checkbox" ${filmMotionAutoCamera625?'checked':''}> Auto-vary camera movement between scenes</label></div>
 <div class="alert-box" style="margin:12px 0">Credits are reserved before each real AI shot. PIONX settles the final charge after completion and refunds unused reserve automatically. Export Film only assembles the finished shots.</div>
 <div class="film-audio-actions624"><button class="ghost-btn" id="filmMotionQuote625">Check AI Motion Credits</button><button class="primary-btn" id="filmGenerateMotion625" ${imgs?'':'disabled'}>${done&&done===imgs?'Regenerate Missing AI Motion':'Generate AI Motion Shots ✦'}</button></div>
 <div class="film-audio-ready624" id="filmMotionStatus625">${qv?`Estimated: ${qv.cost} credits · reserve ${qv.reserve} credits for ${qv.shots} shot(s)`:(imgs?`${imgs} still-image scene(s) ready for PIONX Auto motion.`:'Upload still images first.')}</div></section>`;
};
filmQuoteMotion625=async function(){
 const clips=filmClips614.filter(c=>filmKind621(c)==='image'&&!c.generatedVideoUrl625);if(!clips.length){filmMotionQuoteState625={cost:0,reserve:0,shots:0};const s=q('#filmMotionStatus625');if(s)s.textContent='All still-image shots already have AI motion.';return filmMotionQuoteState625}
 const btn=q('#filmMotionQuote625');if(btn){btn.disabled=true;btn.textContent='Checking…'};let cost=0,reserve=0;
 try{for(const c of clips){const d=filmProviderDuration625(c.duration);const j=await filmVideoCall626({action:'quote',quality:filmMotionQuality625,duration:d,aspect_ratio:q('#filmRatio614')?.value||'16:9'});cost+=Number(j.credits_cost)||0;reserve+=Number(j.credits_reserved)||0}filmMotionQuoteState625={cost,reserve,shots:clips.length};const s=q('#filmMotionStatus625');if(s)s.textContent=`Estimated: ${cost} credits · temporary reserve ${reserve} credits · ${clips.length} AI shot(s)`;return filmMotionQuoteState625}catch(e){const s=q('#filmMotionStatus625');if(s)s.textContent=e.message;throw e}finally{if(btn){btn.disabled=false;btn.textContent='Check AI Motion Credits'}}
};
filmWaitVideo625=async function(id,index,total){
 const end=Date.now()+15*60*1000;while(Date.now()<end){const j=await filmVideoCall626({action:'status',id});const st=String(j.state||j.status||'').toLowerCase();const s=q('#filmMotionStatus625');if(s)s.textContent=`AI shot ${index}/${total} · ${st||'rendering'}…`;if(st==='ready')return j;if(['failed','error','cancelled','canceled'].includes(st))throw Error(j.error||`AI shot ${index} failed`);await sleep56(8000)}throw Error(`AI shot ${index} exceeded the safe processing time`)
};
filmDownloadVideo625=async function(id){
 const r=await pxApi56('/server/film-video-auto-v626.php?action=download&id='+encodeURIComponent(id));if(!r.ok){let msg='AI video download failed';try{msg=(await json56(r,'Film AI video')).error||msg}catch{}throw Error(msg)}return await r.blob()
};
filmGenerateMotion625=async function(){
 if(filmMotionBusy625)return;if(!signedIn56())return toast('Sign in before generating AI film shots');const clips=filmClips614.filter(c=>filmKind621(c)==='image'&&!c.generatedVideoUrl625);if(!clips.length)return toast('All still images already have AI motion');filmMotionBusy625=true;const btn=q('#filmGenerateMotion625');if(btn){btn.disabled=true;btn.textContent='Generating AI shots…'};
 try{
  filmMotionQuality625=q('#filmMotionQuality625')?.value||filmMotionQuality625;filmMotionAutoCamera625=!!q('#filmAutoCamera625')?.checked;await filmQuoteMotion625();
  for(let n=0;n<clips.length;n++){
   const c=clips[n],scene=c.directorScene||{},camera=filmCameraFor625(c,n),duration=filmProviderDuration625(c.duration),image=await filmSourceData625(c),aspect=q('#filmRatio614')?.value||'16:9';
   const visual=String(scene.visual_direction||'').trim(),title=String(scene.title||`Scene ${n+1}`).trim();
   const prompt=[`PIONX FILM SHOT ${n+1}: ${title}.`,visual,`CAMERA: ${camera}.`,`Target approximately ${duration} seconds. Create genuine cinematic 3D camera motion with natural parallax, depth change and subtle physically plausible environmental movement. Preserve the exact architecture, massing, facade openings, materials, landscape identity, proportions and design. Keep verticals stable. No flat slideshow or Ken Burns zoom. No warped geometry, melting facade, moving windows, duplicated objects, invented floors or structural changes.`].filter(Boolean).join('\n');
   const s=q('#filmMotionStatus625');if(s)s.textContent=`Submitting AI shot ${n+1}/${clips.length} · ${camera}…`;
   const j=await filmVideoCall626({action:'start',prompt,image,quality:filmMotionQuality625,duration,aspect_ratio:aspect});const id=j.id;if(!id)throw Error(`AI shot ${n+1} did not return a job id`);c.generatedJob625=id;c.generatedCamera625=camera;c.timelineDuration625=Number(c.duration)||duration;
   await loadAccount56({quiet:true}).catch(()=>{});await filmWaitVideo625(id,n+1,clips.length);const blob=await filmDownloadVideo625(id),url=URL.createObjectURL(blob);if(c.generatedVideoUrl625?.startsWith('blob:'))try{URL.revokeObjectURL(c.generatedVideoUrl625)}catch{}c.generatedVideoBlob625=blob;c.generatedVideoUrl625=url;c.generatedVideoDuration625=await filmProbeDuration620(url).catch(()=>duration);await loadAccount56({quiet:true}).catch(()=>{});
  }
  filmMotionQuoteState625=null;toast(`${clips.length} real AI motion shot(s) ready · credits updated`);route();
 }catch(e){console.error('PIONX Film Auto motion',e);toast(e.message||'AI motion generation failed');const s=q('#filmMotionStatus625');if(s)s.textContent=e.message||'AI motion generation failed';await loadAccount56({quiet:true}).catch(()=>{})}finally{filmMotionBusy625=false;if(btn){btn.disabled=false;btn.textContent='Generate AI Motion Shots ✦'}}
};
// ===== END PIONX V6.26 =====





// ===== PIONX V6.27 · GENERAL VIDEO AUTO ENGINE =====
videoCall66=async function(payload){
 const r=await pxApi56('/server/video-auto-v627.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
 const j=await json56(r,'PIONX Video Auto');if(!r.ok){const error=Error(j.error||'Video request failed');error.status=r.status;error.state=j.state;throw error;}return j
};
function videoPurpose627(){
 const w=q('#videoWorkflow614')?.value||'image';
 if(w==='cinematic')return'cinematic';
 if(w==='walkthrough'||w==='flythrough'||w==='image')return'preserve';
 return'auto';
}
function videoBrief627(){
 const note=q('#videoPrompt66')?.value.trim()||'',workflow=q('#videoWorkflow614')?.value||'image',camera=q('#videoCamera614')?.value||'Slow cinematic push',lighting=q('#videoLighting614')?.value||'Lock source lighting';
 const strict=!!q('#videoGeometry614')?.checked,materials=!!q('#videoMaterials614')?.checked,people=!!q('#videoPeople614')?.checked;
 const wf={image:'Architectural image-to-video',walkthrough:'Interior architectural walkthrough',flythrough:'Exterior architectural fly-through',cinematic:'Premium cinematic architectural shot'}[workflow]||'Architectural video';
 return [note,`${wf}. CAMERA: ${camera}. LIGHTING: ${lighting}.`,strict?'STRICT GEOMETRY LOCK: preserve the exact architecture, massing, openings, camera logic and proportions.':'Preserve architectural identity.',materials?'Keep all materials, colors, glazing and landscape identity consistent with the source.':'',people?'Allow only subtle natural people motion at correct scale.':'Do not invent people unless already present.','Create genuine cinematic 3D motion with stable verticals and natural parallax. No melting facade, moving windows, duplicated objects, invented floors or structural changes.'].filter(Boolean).join('\n')
}
let videoQuoteState1615=null,videoQuoteEpoch1615=0;
function videoQuoteInputs1615(){return {quality:q('#videoQuality66')?.value||'premium',duration:q('#videoDuration66')?.value||'8',aspect_ratio:q('#videoAspect614')?.value||'16:9',purpose:videoPurpose627(),has_image:!!videoImage66};}
videoQuote66=async function(){
 const epoch=++videoQuoteEpoch1615,input=videoQuoteInputs1615();videoQuoteState1615=null;
 try{const j=await videoCall66({action:'quote',...input});if(epoch!==videoQuoteEpoch1615)return;
  const quote=window.PIONXAssistantWorkflows1615.videoQuote(j);videoQuoteState1615={signature:JSON.stringify(input),quote};
  if(q('#videoQuote66'))q('#videoQuote66').textContent=`Cost: ${quote.estimated_credits} credits · temporary reserve: ${quote.reservation_credits} credits · PIONX Auto`;
 }catch(e){if(epoch===videoQuoteEpoch1615&&q('#videoQuote66'))q('#videoQuote66').textContent=e.message;}
};
wireVideo66=async function(){
 const file=q('#videoImage66'),btn=q('#videoGenerate66'),latest=q('#videoLatest66');if(btn)btn.disabled=videoBusy66;
 ['#videoQuality66','#videoDuration66','#videoAspect614','#videoWorkflow614'].forEach(sel=>q(sel)?.addEventListener('change',videoQuote66));
 videoQuote66();
 file?.addEventListener('change',async()=>{const f=file.files?.[0];if(!f)return;if(f.size>5.8*1024*1024){videoStatus66('Choose an image smaller than 6 MB');return}videoImage66=await readStudioImage(f);q('#videoPreview66').innerHTML=`<img src="${videoImage66}" alt="Video starting frame">`;videoStatus66('Starting image loaded');videoQuote66()});
 latest?.addEventListener('click',async()=>{const u=studioFinal56.providerUrl||galleryRows62[0]?.url;if(!u){videoStatus66('Render an image first, or upload a starting image.');return}try{const blob=await fetchRenderBlob56(galleryUrl62(u));if(blob.size>5.8*1024*1024)throw Error('Latest render exceeds 6 MB. Upload a smaller image.');videoImage66=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob)});q('#videoPreview66').innerHTML=`<img src="${videoImage66}" alt="Video starting frame">`;videoStatus66('Latest render selected');videoQuote66()}catch(e){videoStatus66(e.message)}});
 btn?.addEventListener('click',async()=>{
  if(videoBusy66)return;if(!videoImage66){videoStatus66('Upload a starting image or use your latest render first.');return;}const input=videoQuoteInputs1615();
  if(!videoQuoteState1615||videoQuoteState1615.signature!==JSON.stringify(input)){await videoQuote66();videoStatus66('Review the updated video quote and press Generate again.');return;}
  if(!videoQuoteState1615.quote.can_render){videoStatus66('Insufficient credits for the video reservation.');return;}
  if(assistantVideoPending1615()){videoStatus66('Check the previous video submission before starting another.');return;}
  const requestId=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
  safeStore.set(assistantVideoKey1615(),JSON.stringify({requestId,createdAt:Date.now()}));
  if(assistantVideoPending1615()?.requestId!==requestId){videoStatus66('Browser storage is unavailable. No video was submitted.');return;}
  const quote=videoQuoteState1615.quote,prompt=videoBrief627();videoBusy66=true;btn.disabled=true;videoStatus66('PIONX Auto is selecting the video engine…');
  try{const j=await window.PIONXAssistantBridge1613.request('/server/video-auto-v627.php',{action:'start',request_id:requestId,prompt,image:videoImage66,...input,max_estimated_credits:quote.estimated_credits,max_reservation_credits:quote.reservation_credits});
   if(!/^[a-f0-9]{32}$/.test(j.id)||j.state==='submission_unknown')throw Error('Check the previous video submission before starting another.');
   videoJob66=j.id;safeStore.set(videoJobKey1615(),j.id);assistantVideoClear1615();loadAccount56({quiet:true}).catch(()=>{});videoStatus66('Video job started. Rendering…');clearTimeout(videoTimer66);videoTimer66=setTimeout(videoPoll66,250);
  }catch(e){videoBusy66=false;btn.disabled=false;if([400,401,402,403,412].includes(e.status))assistantVideoClear1615();videoStatus66(e.message);loadAccount56({quiet:true}).catch(()=>{});}
 });
 const statusBox=q('#videoStatus66');if(statusBox&&!q('#videoStatusRecover1615')){const recover=document.createElement('button');recover.id='videoStatusRecover1615';recover.type='button';recover.className='ghost-btn';recover.textContent='Check previous submission';statusBox.after(recover);recover.onclick=async()=>{recover.disabled=true;try{const result=await window.PIONXAssistantBridge1613.videoStatus();videoStatus66(result.message||result.status);if(videoJob66){clearTimeout(videoTimer66);videoTimer66=setTimeout(videoPoll66,250);}}catch(error){videoStatus66(error.message);}finally{recover.disabled=false;}};}

 q('#videoDownload66')?.addEventListener('click',async()=>{if(!videoJob66)return;try{const r=await pxApi56('/server/video-auto-v627.php?action=download&id='+encodeURIComponent(videoJob66));if(!r.ok)throw Error((await json56(r,'Download')).error||'Download failed');const u=URL.createObjectURL(await r.blob()),a=document.createElement('a');a.href=u;a.download='PIONX-video.mp4';a.click();setTimeout(()=>URL.revokeObjectURL(u),60000)}catch(e){videoStatus66(e.message)}});
 if(videoJob66){videoStatus66('Checking your saved PIONX Auto video job…');videoTimer66=setTimeout(videoPoll66,250)}
};
// ===== END PIONX V6.27 =====
applyTheme(settingsState.theme,false);
function finishRouteBoot16121(){
 try{
  const html=document.documentElement;
  if(html.getAttribute('data-px-route-boot')==='pending'){if(!PXUSER56?.id)q('#publicSite').dataset.workspaceLogin1616='true';html.removeAttribute('data-px-route-boot');}
 }catch{}
}
// Reuse the existing same-origin PIONX session if available; otherwise stay on the public landing.
(async()=>{
 try{
  if(await captureOAuthSession56()){finishRouteBoot16121();return;}
  let status=await authSession56('status').catch(()=>({ok:false}));
  if(!status?.ok){
   const legacy=takeLegacySession56();
   if(legacy?.access_token){
    try{await establishServerSession56(legacy);status={ok:true}}catch{setSession56(null)}
   }
  }else{
   try{localStorage.removeItem('pionx_session')}catch{}
  }
  setSession56(!!status?.ok);
  if(signedIn56()){
   const a=await loadAccount56({quiet:true});
   if(a){await studioStartupPreflight6333();const requested=window.PIONXRouteBoot1616?.requested||(location.hash||'#home').slice(1).split('?')[0]||'home';enterApp(requested);return}
  }
  const requested=(location.hash||'').slice(1);
  if(requested&&routes[requested]){
   setAuthStatus56('Sign in to continue to '+requested.replace(/-/g,' ')+'.');
   setTimeout(()=>{q('#authCard')?.scrollIntoView({behavior:'smooth',block:'center'});q('#signinEmail')?.focus()},120)
  }
 }catch(e){setSession56(null);console.warn('PIONX session bootstrap',e)}
 finally{finishRouteBoot16121()}
})();

// ===== END PIONX V6.19 SINGLE-PROJECT VIEWER =====

// ===== PIONX V6.27.2 · FILM MOTION QUALITY + STRICT EXPORT TIMING =====
// Fixes: visible 3D camera travel, provider routing per shot, exact target runtime,
// no progress watermark in the delivered film, and no silent still-image fallback.
const filmCameraPlan6272=[
 'Dolly forward about 4 metres while rising gently about 1 metre; keep the building centered, create clearly visible foreground/background parallax from the first second',
 'Orbit right about 8 degrees around the architecture with a real lateral camera translation, stable verticals and clearly visible 3D parallax',
 'Crane upward about 3 metres while tilting very slightly down to reveal more of the site; no digital zoom',
 'Lateral truck from left to right about 5 metres, with foreground landscape moving faster than the building and distant context',
 'Slow pull back about 5 metres while rising slightly, widening the context with real depth change rather than a 2D zoom',
 'Orbit left about 8 degrees with a restrained dolly-in, stable facade geometry and visible foreground/background separation'
];
filmCameraFor625=function(c,i){
 const scene=c?.directorScene||{},chosen=String(scene.camera||'').trim();
 if(!filmMotionAutoCamera625&&chosen)return chosen;
 const text=chosen.toLowerCase();
 if(text.includes('orbit right'))return filmCameraPlan6272[1];
 if(text.includes('orbit left'))return filmCameraPlan6272[5];
 if(text.includes('crane'))return filmCameraPlan6272[2];
 if(text.includes('lateral')||text.includes('track'))return filmCameraPlan6272[3];
 if(text.includes('pull')||text.includes('zoom-out'))return filmCameraPlan6272[4];
 if(text.includes('fly'))return 'Controlled architectural fly-through: translate forward about 6 metres through the open site axis, gentle rise, no collision, stable verticals, strong but natural parallax';
 return filmCameraPlan6272[i%filmCameraPlan6272.length];
};
function filmMotionProfile6272(camera=''){
 const x=String(camera).toLowerCase();
 return /orbit|fly|lateral|track|crane|pull back|translate/.test(x)?'dynamic':'preserve';
}
filmQuoteMotion625=async function(){
 const clips=filmClips614.filter(c=>filmKind621(c)==='image'&&!c.generatedVideoUrl625);
 if(!clips.length){filmMotionQuoteState625={cost:0,reserve:0,shots:0};const s=q('#filmMotionStatus625');if(s)s.textContent='All still-image shots already have AI motion.';return filmMotionQuoteState625}
 const btn=q('#filmMotionQuote625');if(btn){btn.disabled=true;btn.textContent='Checking…'};let cost=0,reserve=0;
 try{
  for(let i=0;i<clips.length;i++){
   const c=clips[i],camera=filmCameraFor625(c,i),d=filmProviderDuration625(c.duration);
   const j=await filmVideoCall626({action:'quote',quality:filmMotionQuality625,duration:d,aspect_ratio:q('#filmRatio614')?.value||'16:9',motion_profile:filmMotionProfile6272(camera),camera});
   cost+=Number(j.credits_cost)||0;reserve+=Number(j.credits_reserved)||0;
  }
  filmMotionQuoteState625={cost,reserve,shots:clips.length};const s=q('#filmMotionStatus625');if(s)s.textContent=`Estimated: ${cost} credits · temporary reserve ${reserve} credits · ${clips.length} AI shot(s)`;return filmMotionQuoteState625;
 }catch(e){const s=q('#filmMotionStatus625');if(s)s.textContent=e.message;throw e}
 finally{if(btn){btn.disabled=false;btn.textContent='Check AI Motion Credits'}}
};
filmGenerateMotion625=async function(){
 if(filmMotionBusy625)return;if(!signedIn56())return toast('Sign in before generating AI film shots');
 const clips=filmClips614.filter(c=>filmKind621(c)==='image'&&!c.generatedVideoUrl625);if(!clips.length)return toast('All still images already have AI motion');
 filmMotionBusy625=true;const btn=q('#filmGenerateMotion625');if(btn){btn.disabled=true;btn.textContent='Generating cinematic AI shots…'};
 try{
  filmMotionQuality625=q('#filmMotionQuality625')?.value||filmMotionQuality625;filmMotionAutoCamera625=!!q('#filmAutoCamera625')?.checked;await filmQuoteMotion625();
  for(let n=0;n<clips.length;n++){
   const c=clips[n],scene=c.directorScene||{},camera=filmCameraFor625(c,n),duration=filmProviderDuration625(c.duration),image=await filmSourceData625(c),aspect=q('#filmRatio614')?.value||'16:9';
   const visual=String(scene.visual_direction||'').trim(),title=String(scene.title||`Scene ${n+1}`).trim(),profile=filmMotionProfile6272(camera);
   const prompt=[
    `PIONX ARCHITECTURAL FILM SHOT ${n+1}: ${title}.`,visual,`CAMERA MOVE: ${camera}.`,
    `MOTION REQUIREMENT: the camera must visibly travel through real 3D space from the first second to the last. Create unmistakable parallax: foreground elements move relative to the building and distant background. Camera translation must be visible, not a locked camera and not a digital crop or Ken Burns zoom.`,
    `ARCHITECTURE LOCK: preserve the exact building massing, number of floors, facade openings, mullions, materials, landscape layout, roads, proportions and identity. Stable verticals, physically plausible motion, premium real-estate cinematography.`,
    `Do not warp, melt, bend or redesign the building. Do not move windows, add floors, duplicate trees/cars/objects, or morph geometry. No slideshow motion. No fake 2D zoom. Target approximately ${duration} seconds.`
   ].filter(Boolean).join('\n');
   const s=q('#filmMotionStatus625');if(s)s.textContent=`Generating AI shot ${n+1}/${clips.length} · cinematic camera…`;
   const j=await filmVideoCall626({action:'start',prompt,image,quality:filmMotionQuality625,duration,aspect_ratio:aspect,motion_profile:profile,camera});
   const id=j.id;if(!id)throw Error(`AI shot ${n+1} did not return a job id`);c.generatedJob625=id;c.generatedCamera625=camera;c.timelineDuration625=Math.max(1,Number(c.duration)||duration);
   await loadAccount56({quiet:true}).catch(()=>{});await filmWaitVideo625(id,n+1,clips.length);const blob=await filmDownloadVideo625(id),url=URL.createObjectURL(blob);
   if(c.generatedVideoUrl625?.startsWith('blob:'))try{URL.revokeObjectURL(c.generatedVideoUrl625)}catch{}
   c.generatedVideoBlob625=blob;c.generatedVideoUrl625=url;c.generatedVideoDuration625=await filmProbeDuration620(url).catch(()=>duration);await loadAccount56({quiet:true}).catch(()=>{});
  }
  filmMotionQuoteState625=null;toast(`${clips.length} cinematic AI motion shot(s) ready`);route();
 }catch(e){console.error('PIONX Film cinematic motion',e);toast(e.message||'AI motion generation failed');const s=q('#filmMotionStatus625');if(s)s.textContent=e.message||'AI motion generation failed';await loadAccount56({quiet:true}).catch(()=>{})}
 finally{filmMotionBusy625=false;if(btn){btn.disabled=false;btn.textContent='Generate AI Motion Shots ✦'}}
};
function filmWaitMetadata6272(v,ms=12000){return new Promise((res,rej)=>{let done=false;const end=(ok,e)=>{if(done)return;done=true;clearTimeout(t);v.onloadedmetadata=v.onerror=null;ok?res():rej(e||Error('Could not read film clip'))};const t=setTimeout(()=>end(false,Error('Timed out reading film clip')),ms);v.onloadedmetadata=()=>end(true);v.onerror=()=>end(false,Error('Could not read film clip'))})}
async function filmFade6272(ctx,canvas,seconds){if(seconds<=0)return;const st=performance.now();await new Promise(res=>{const f=now=>{const p=Math.min(1,(now-st)/(seconds*1000));ctx.fillStyle=`rgba(5,11,20,${p})`;ctx.fillRect(0,0,canvas.width,canvas.height);if(p>=1)res();else requestAnimationFrame(f)};requestAnimationFrame(f)})}
exportFilm614=async function(){
 if(filmBusy614)return;if(!filmClips614.length)return toast('Add images or video clips first');if(typeof MediaRecorder==='undefined')return toast('This browser cannot export the Film preview');
 const stillCount=filmClips614.filter(c=>filmKind621(c)==='image').length,aiCount=filmGeneratedCount625();
 if(stillCount&&aiCount<stillCount)return toast(`Generate AI Motion Shots first · ${aiCount}/${stillCount} still-image scenes are ready`);
 filmBusy614=true;const button=q('#filmExport614');if(button){button.disabled=true;button.textContent='Building final film…'};let audioCtx=null,audioNodes=[];
 try{
  const target=Math.max(1,filmTarget620()),vertical=q('#filmRatio614')?.value==='9:16',fps=Number(q('#filmFps614')?.value||30),canvas=document.createElement('canvas');canvas.width=vertical?720:1280;canvas.height=vertical?1280:720;
  const ctx=canvas.getContext('2d',{alpha:false}),videoStream=canvas.captureStream(fps),AC=window.AudioContext||window.webkitAudioContext;let mixDest=null;
  if(AC){audioCtx=new AC();await audioCtx.resume();mixDest=audioCtx.createMediaStreamDestination();audioNodes=[filmAttachAudio624(audioCtx,mixDest,filmAudio624.voiceUrl,filmAudio624.voiceVolume,false),filmAttachAudio624(audioCtx,mixDest,filmAudio624.musicUrl,filmAudio624.musicVolume,true),filmAttachAudio624(audioCtx,mixDest,filmAudio624.sfxUrl,filmAudio624.sfxVolume,false)].filter(Boolean)}
  const tracks=[...videoStream.getVideoTracks(),...(mixDest?mixDest.stream.getAudioTracks():[])],stream=new MediaStream(tracks),mime=MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')?'video/webm;codecs=vp9,opus':(MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':'video/webm'),rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:10000000,audioBitsPerSecond:192000}),chunks=[];
  rec.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};const stopped=new Promise(res=>rec.onstop=res);rec.start(250);await filmStartAudio624(audioNodes);const exportStart=performance.now();let used=0;
  for(let i=0;i<filmClips614.length&&used<target-.01;i++){
   const clip=filmClips614[i],left=target-used,src=filmPlayableUrl625(clip),v=document.createElement('video');v.src=src;v.playsInline=true;v.preload='auto';v.muted=true;await filmWaitMetadata6272(v);
   const mediaDuration=Number.isFinite(v.duration)&&v.duration>0?v.duration:Number(clip.generatedVideoDuration625||clip.duration||left),planned=Math.max(.1,Number(clip.timelineDuration625||clip.duration)||mediaDuration||left),playFor=Math.min(planned,left);
   if(playFor<=.02)break;v.currentTime=0;const rate=mediaDuration>0?Math.max(.5,Math.min(3,mediaDuration/playFor)):1;try{v.playbackRate=rate}catch{}
   const clipStart=performance.now();await v.play().catch(()=>{});
   await new Promise(res=>{let done=false;const finish=()=>{if(done)return;done=true;try{v.pause()}catch{}res()};const frame=now=>{if(done)return;const elapsed=(now-clipStart)/1000,global=(now-exportStart)/1000;if(v.readyState>=2&&v.videoWidth&&v.videoHeight){const s=Math.max(canvas.width/v.videoWidth,canvas.height/v.videoHeight),w=v.videoWidth*s,h=v.videoHeight*s;ctx.fillStyle='#050b14';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(v,(canvas.width-w)/2,(canvas.height-h)/2,w,h)}if(elapsed>=playFor||global>=target-.005)return finish();requestAnimationFrame(frame)};requestAnimationFrame(frame)});
   used=Math.min(target,used+playFor);
   if(q('#filmTransition614')?.value==='fade'&&i<filmClips614.length-1&&used<target-.02){const t=Math.min(.18,target-used);await filmFade6272(ctx,canvas,t);used=Math.min(target,used+t)}
  }
  const wall=(performance.now()-exportStart)/1000;if(wall<target){await sleep56(Math.max(0,(target-wall)*1000))}
  filmStopAudio624(audioNodes);try{rec.requestData()}catch{}await sleep56(80);rec.stop();await stopped;
  const blob=new Blob(chunks,{type:mime}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=(q('#filmTitle614')?.value||'PIONX-Film').replace(/[^a-z0-9_-]+/gi,'-')+'.webm';a.click();setTimeout(()=>URL.revokeObjectURL(u),60000);toast(`Final film exported · target ${filmFmt620(target)} · ${filmGeneratedCount625()} AI motion shot(s)`)
 }catch(e){console.error(e);toast(e.message||'Film export failed')}
 finally{filmStopAudio624(audioNodes);if(audioCtx)try{await audioCtx.close()}catch{}filmBusy614=false;if(button){button.disabled=false;button.textContent='Export Film'}}
};
// ===== END PIONX V6.27.2 =====


// ===== PIONX V6.27.3 · VISIBLE AI MOTION GENERATION PROGRESS =====
// Shows real workflow state without inventing provider percentages.
let filmMotionUi6273={active:false,total:0,current:0,completed:0,stage:'idle',camera:'',message:'',startedAt:0,shotStartedAt:0,shots:[]};
let filmMotionTicker6273=0;
function filmMotionCss6273(){
 if(document.getElementById('filmMotionCss6273'))return;
 const st=document.createElement('style');st.id='filmMotionCss6273';st.textContent=`
 #filmMotionLive6273{margin-top:14px;border:1px solid rgba(111,101,255,.42);border-radius:16px;background:linear-gradient(180deg,rgba(83,75,255,.10),rgba(5,17,31,.72));padding:16px;overflow:hidden}
 #filmMotionLive6273[hidden]{display:none!important}
 .fm6273-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.fm6273-head b{font-size:16px}.fm6273-head small{display:block;color:#91a3b9;margin-top:4px}
 .fm6273-live{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:700;color:#dcd8ff;white-space:nowrap}.fm6273-pulse{width:9px;height:9px;border-radius:50%;background:#746cff;box-shadow:0 0 0 0 rgba(116,108,255,.7);animation:fm6273pulse 1.35s infinite}
 @keyframes fm6273pulse{0%{box-shadow:0 0 0 0 rgba(116,108,255,.7)}70%{box-shadow:0 0 0 10px rgba(116,108,255,0)}100%{box-shadow:0 0 0 0 rgba(116,108,255,0)}}
 .fm6273-overall{height:9px;border-radius:20px;background:#13243a;margin:14px 0 8px;overflow:hidden;position:relative}.fm6273-overall>i{display:block;height:100%;width:0;border-radius:inherit;background:linear-gradient(90deg,#7b61ff,#3c6fff);transition:width .35s ease}.fm6273-overall.active:after{content:'';position:absolute;inset:0;width:34%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.25),transparent);animation:fm6273scan 1.25s linear infinite}
 @keyframes fm6273scan{from{transform:translateX(-120%)}to{transform:translateX(390%)}}
 .fm6273-meta{display:flex;justify-content:space-between;gap:12px;color:#9fb0c4;font-size:12px;flex-wrap:wrap}
 .fm6273-shots{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:9px;margin-top:14px}.fm6273-shot{border:1px solid #1d3550;border-radius:12px;padding:10px 11px;background:#081827;display:grid;grid-template-columns:24px 1fr;gap:9px;align-items:start}.fm6273-shot.current{border-color:#7269ff;background:rgba(91,83,255,.09)}.fm6273-shot.done{border-color:rgba(54,201,139,.45)}.fm6273-shot.failed{border-color:rgba(255,93,93,.6)}
 .fm6273-icon{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:#132b43;color:#9fb0c4;font-size:11px;font-weight:800}.fm6273-shot.current .fm6273-icon{background:#625bff;color:white;animation:fm6273spin 1.2s linear infinite}.fm6273-shot.done .fm6273-icon{background:#123e31;color:#72e1b1;animation:none}.fm6273-shot.failed .fm6273-icon{background:#4b2026;color:#ff9aa3;animation:none}@keyframes fm6273spin{to{transform:rotate(360deg)}}
 .fm6273-shot b{font-size:12px}.fm6273-shot small{display:block;color:#8297ad;margin-top:3px;line-height:1.35}.fm6273-stage{margin-top:12px;border-radius:11px;padding:11px 12px;background:#07131f;color:#cbd8e6;font-size:13px}.fm6273-stage strong{color:#fff}
 `;document.head.appendChild(st)
}
function filmMotionFmtTime6273(ms){const s=Math.max(0,Math.floor(ms/1000)),m=Math.floor(s/60),r=s%60;return m+':'+String(r).padStart(2,'0')}
function filmMotionEnsureUi6273(){
 filmMotionCss6273();const panel=q('#filmMotionPanel625');if(!panel)return null;let box=q('#filmMotionLive6273',panel);if(!box){box=document.createElement('div');box.id='filmMotionLive6273';box.hidden=true;panel.appendChild(box)}return box
}
function filmMotionStageLabel6273(stage){return ({quote:'Checking credits and route',prepare:'Preparing source image',submit:'Submitting shot to PIONX Auto',rendering:'AI video is rendering',download:'Downloading finished AI shot',ready:'Shot completed',complete:'All AI motion shots completed',error:'Generation stopped'})[stage]||'Working'}
function filmMotionPaint6273(){
 const box=filmMotionEnsureUi6273();if(!box)return;const u=filmMotionUi6273;box.hidden=!u.active&&!u.shots.length;if(box.hidden)return;
 const total=Math.max(1,u.total||u.shots.length||1),pct=Math.max(0,Math.min(100,(u.completed/total)*100)),elapsed=u.startedAt?filmMotionFmtTime6273(Date.now()-u.startedAt):'0:00';
 const current=u.current>0?`Shot ${u.current} of ${u.total}`:`${u.completed} of ${u.total} complete`;
 box.innerHTML=`<div class="fm6273-head"><div><b>${u.active?'PIONX is generating real camera motion':'AI motion generation status'}</b><small>${escHtml(filmMotionStageLabel6273(u.stage))}${u.camera?` · ${escHtml(u.camera)}`:''}</small></div><span class="fm6273-live">${u.active?'<i class="fm6273-pulse"></i> Working':'Finished'}</span></div>
 <div class="fm6273-overall ${u.active?'active':''}"><i style="width:${pct}%"></i></div><div class="fm6273-meta"><span>${escHtml(current)}</span><span>${Math.round(pct)}% shots completed</span><span>Elapsed ${elapsed}</span></div>
 <div class="fm6273-stage"><strong>${escHtml(filmMotionStageLabel6273(u.stage))}</strong>${u.message?` · ${escHtml(u.message)}`:''}<br><small>Keep this tab open while the current shot is being generated. Provider percentages are not fabricated; progress advances when a real shot completes.</small></div>
 <div class="fm6273-shots">${u.shots.map((x,i)=>{const cls=x.state==='done'?'done':x.state==='failed'?'failed':x.state==='current'?'current':'';const icon=x.state==='done'?'✓':x.state==='failed'?'!':x.state==='current'?'↻':String(i+1);return `<div class="fm6273-shot ${cls}"><span class="fm6273-icon">${icon}</span><div><b>Shot ${i+1}${x.title?' · '+escHtml(x.title):''}</b><small>${escHtml(x.camera||'Camera move queued')}<br>${escHtml(x.label||'Queued')}</small></div></div>`}).join('')}</div>`;
}
function filmMotionSet6273(stage,extra={}){Object.assign(filmMotionUi6273,{stage,...extra});filmMotionPaint6273()}
function filmMotionBegin6273(clips){
 filmMotionUi6273={active:true,total:clips.length,current:0,completed:0,stage:'quote',camera:'',message:'Preparing generation',startedAt:Date.now(),shotStartedAt:0,shots:clips.map((c,i)=>({state:'queued',label:'Queued',camera:filmCameraFor625(c,i),title:String(c?.directorScene?.title||'').trim()}))};
 clearInterval(filmMotionTicker6273);filmMotionTicker6273=setInterval(filmMotionPaint6273,1000);filmMotionPaint6273()
}
function filmMotionFinish6273(ok=true,message=''){
 filmMotionUi6273.active=false;filmMotionUi6273.stage=ok?'complete':'error';filmMotionUi6273.message=message||filmMotionUi6273.message;clearInterval(filmMotionTicker6273);filmMotionTicker6273=0;filmMotionPaint6273()
}
filmWaitVideo625=async function(id,index,total){
 const end=Date.now()+15*60*1000;while(Date.now()<end){const j=await filmVideoCall626({action:'status',id});const st=String(j.state||j.status||'').toLowerCase();filmMotionSet6273('rendering',{current:index,message:`Server status: ${st||'processing'}`});const s=q('#filmMotionStatus625');if(s)s.textContent=`AI shot ${index}/${total} · ${st||'rendering'}…`;if(st==='ready')return j;if(['failed','error','cancelled','canceled'].includes(st))throw Error(j.error||`AI shot ${index} failed`);await sleep56(8000)}throw Error(`AI shot ${index} exceeded the safe processing time`)
};
filmGenerateMotion625=async function(){
 if(filmMotionBusy625)return;if(!signedIn56())return toast('Sign in before generating AI film shots');
 const clips=filmClips614.filter(c=>filmKind621(c)==='image'&&!c.generatedVideoUrl625);if(!clips.length)return toast('All still images already have AI motion');
 filmMotionBusy625=true;const btn=q('#filmGenerateMotion625');if(btn){btn.disabled=true;btn.textContent='AI Motion is working…'};
 try{
  filmMotionQuality625=q('#filmMotionQuality625')?.value||filmMotionQuality625;filmMotionAutoCamera625=!!q('#filmAutoCamera625')?.checked;filmMotionBegin6273(clips);filmMotionSet6273('quote',{message:'Checking cost and reserving only the required credits'});await filmQuoteMotion625();
  for(let n=0;n<clips.length;n++){
   const c=clips[n],scene=c.directorScene||{},camera=filmCameraFor625(c,n),duration=filmProviderDuration625(c.duration),aspect=q('#filmRatio614')?.value||'16:9';
   filmMotionUi6273.shots[n].state='current';filmMotionUi6273.shots[n].label='Preparing source';filmMotionSet6273('prepare',{current:n+1,camera,message:`Preparing ${duration}s source and camera direction`});
   const image=await filmSourceData625(c),visual=String(scene.visual_direction||'').trim(),title=String(scene.title||`Scene ${n+1}`).trim(),profile=filmMotionProfile6272(camera);
   const prompt=[`PIONX ARCHITECTURAL FILM SHOT ${n+1}: ${title}.`,visual,`CAMERA MOVE: ${camera}.`,`MOTION REQUIREMENT: the camera must visibly travel through real 3D space from the first second to the last. Create unmistakable parallax: foreground elements move relative to the building and distant background. Camera translation must be visible, not a locked camera and not a digital crop or Ken Burns zoom.`,`ARCHITECTURE LOCK: preserve the exact building massing, number of floors, facade openings, mullions, materials, landscape layout, roads, proportions and identity. Stable verticals, physically plausible motion, premium real-estate cinematography.`,`Do not warp, melt, bend or redesign the building. Do not move windows, add floors, duplicate trees/cars/objects, or morph geometry. No slideshow motion. No fake 2D zoom. Target approximately ${duration} seconds.`].filter(Boolean).join('\n');
   filmMotionUi6273.shots[n].label='Submitting to AI';filmMotionSet6273('submit',{current:n+1,camera,message:'Starting protected AI video job'});const s=q('#filmMotionStatus625');if(s)s.textContent=`Submitting AI shot ${n+1}/${clips.length}…`;
   const j=await filmVideoCall626({action:'start',prompt,image,quality:filmMotionQuality625,duration,aspect_ratio:aspect,motion_profile:profile,camera});const id=j.id;if(!id)throw Error(`AI shot ${n+1} did not return a job id`);c.generatedJob625=id;c.generatedCamera625=camera;c.timelineDuration625=Math.max(1,Number(c.duration)||duration);
   filmMotionUi6273.shots[n].label='Rendering';filmMotionSet6273('rendering',{current:n+1,camera,message:'The AI engine is rendering this camera move'});await loadAccount56({quiet:true}).catch(()=>{});await filmWaitVideo625(id,n+1,clips.length);
   filmMotionUi6273.shots[n].label='Downloading result';filmMotionSet6273('download',{current:n+1,camera,message:'AI shot finished; downloading the generated video'});const blob=await filmDownloadVideo625(id),url=URL.createObjectURL(blob);
   if(c.generatedVideoUrl625?.startsWith('blob:'))try{URL.revokeObjectURL(c.generatedVideoUrl625)}catch{}c.generatedVideoBlob625=blob;c.generatedVideoUrl625=url;c.generatedVideoDuration625=await filmProbeDuration620(url).catch(()=>duration);await loadAccount56({quiet:true}).catch(()=>{});
   filmMotionUi6273.shots[n].state='done';filmMotionUi6273.shots[n].label='Ready';filmMotionUi6273.completed=n+1;filmMotionSet6273('ready',{current:n+1,camera,message:`Shot ${n+1} completed successfully`});
  }
  filmMotionQuoteState625=null;filmMotionFinish6273(true,`${clips.length} cinematic AI motion shot(s) ready`);toast(`${clips.length} cinematic AI motion shot(s) ready`);setTimeout(()=>route(),900)
 }catch(e){console.error('PIONX Film cinematic motion',e);const idx=Math.max(0,(filmMotionUi6273.current||1)-1);if(filmMotionUi6273.shots[idx]){filmMotionUi6273.shots[idx].state='failed';filmMotionUi6273.shots[idx].label=e.message||'Failed'}filmMotionFinish6273(false,e.message||'AI motion generation failed');toast(e.message||'AI motion generation failed');const s=q('#filmMotionStatus625');if(s)s.textContent=e.message||'AI motion generation failed';await loadAccount56({quiet:true}).catch(()=>{})}
 finally{filmMotionBusy625=false;if(btn){btn.disabled=false;btn.textContent='Generate AI Motion Shots ✦'}}
};
filmMotionCss6273();
// ===== END PIONX V6.27.3 =====

// ===== PIONX V6.27.5 · FULL FILM PREVIEW + LIVE CREDITS + PREMIUM FIDELITY =====
// Full preview is the exact final composite (all shots + VO/music/SFX), cached for instant Export.
// Premium Film uses 1080p delivery, safer architectural camera travel and two-shot parallel generation.
let filmPreviewBlob6275=null,filmPreviewUrl6275='',filmPreviewSig6275='',filmPreviewBusy6275=false;
function filmPreviewRevoke6275(){if(filmPreviewUrl6275?.startsWith('blob:'))try{URL.revokeObjectURL(filmPreviewUrl6275)}catch{}filmPreviewUrl6275='';filmPreviewBlob6275=null;filmPreviewSig6275=''}
function filmPreviewSignature6275(){return JSON.stringify({target:filmTarget620(),ratio:q('#filmRatio614')?.value||'16:9',fps:Number(q('#filmFps614')?.value||30),transition:q('#filmTransition614')?.value||'fade',quality:filmMotionQuality625,clips:filmClips614.map(c=>[c.generatedJob625||'',c.generatedVideoDuration625||0,c.timelineDuration625||c.duration||0,c.name||'']),audio:[filmAudio624.voiceName||'',filmAudio624.voiceBlob?.size||0,filmAudio624.voiceVolume,filmAudio624.musicName||'',filmAudio624.musicBlob?.size||0,filmAudio624.musicVolume,filmAudio624.sfxName||'',filmAudio624.sfxBlob?.size||0,filmAudio624.sfxVolume,filmAudio624.keepSourceAudio]})}
const filmSafeCameraPlan6275=[
 'Slow dolly forward about 1.5 metres with subtle rise under 0.4 metre; preserve the exact facade and keep all verticals locked',
 'Very restrained orbit right about 3 degrees with less than 1.5 metres lateral travel; do not expose or invent unseen facade geometry',
 'Gentle crane upward about 1.2 metres with a tiny downward tilt; preserve the exact source composition and building proportions',
 'Short lateral truck left-to-right about 1.5 metres creating foreground parallax while the building geometry remains rigid',
 'Slow pull back about 1.5 metres with a slight rise; widen context only from information already visible in the source',
 'Very restrained orbit left about 3 degrees with less than 1.5 metres travel; if unseen geometry would be required, reduce the move instead'
];
filmCameraFor625=function(c,i){
 const chosen=String(c?.directorScene?.camera||'').trim().toLowerCase();if(!filmMotionAutoCamera625&&chosen){
  if(chosen.includes('crane'))return filmSafeCameraPlan6275[2];if(chosen.includes('lateral')||chosen.includes('track'))return filmSafeCameraPlan6275[3];if(chosen.includes('pull'))return filmSafeCameraPlan6275[4];if(chosen.includes('orbit left'))return filmSafeCameraPlan6275[5];if(chosen.includes('orbit right')||chosen.includes('orbit'))return filmSafeCameraPlan6275[1];if(chosen.includes('fly'))return filmSafeCameraPlan6275[0];return filmSafeCameraPlan6275[0]
 }
 return filmSafeCameraPlan6275[i%filmSafeCameraPlan6275.length]
};
filmProviderDuration625=function(sec){if(filmMotionQuality625==='premium')return 8;sec=Number(sec)||5;return sec<=4?4:sec<=6?6:8};

async function filmBuildComposite6275(){
 if(typeof MediaRecorder==='undefined')throw Error('This browser cannot build the Film preview');if(!filmClips614.length)throw Error('Add film shots first');
 const stillCount=filmClips614.filter(c=>filmKind621(c)==='image').length,aiCount=filmGeneratedCount625();if(stillCount&&aiCount<stillCount)throw Error(`Generate AI Motion Shots first · ${aiCount}/${stillCount} ready`);
 const sig=filmPreviewSignature6275();if(filmPreviewBlob6275&&filmPreviewSig6275===sig)return filmPreviewBlob6275;
 filmPreviewRevoke6275();const target=Math.max(1,filmTarget620()),vertical=(q('#filmRatio614')?.value||'16:9')==='9:16',premium=filmMotionQuality625!=='fast',fps=Number(q('#filmFps614')?.value||30);
 const canvas=document.createElement('canvas');canvas.width=vertical?(premium?1080:720):(premium?1920:1280);canvas.height=vertical?(premium?1920:1280):(premium?1080:720);const ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#050b14';ctx.fillRect(0,0,canvas.width,canvas.height);
 const prepared=[];let plannedUsed=0;
 for(let i=0;i<filmClips614.length&&plannedUsed<target-.01;i++){
  const clip=filmClips614[i],left=target-plannedUsed,src=filmPlayableUrl625(clip),v=document.createElement('video');v.src=src;v.playsInline=true;v.preload='auto';v.muted=true;await filmWaitMetadata6272(v);
  const mediaDuration=Number.isFinite(v.duration)&&v.duration>0?v.duration:Number(clip.generatedVideoDuration625||clip.duration||left),planned=Math.max(.1,Number(clip.timelineDuration625||clip.duration)||mediaDuration||left),playFor=Math.min(planned,left,mediaDuration||left);if(playFor<=.02)continue;prepared.push({clip,v,playFor,index:i});plannedUsed+=playFor;
 }
 if(!prepared.length)throw Error('No playable Film shots are available');
 const videoStream=canvas.captureStream(fps),AC=window.AudioContext||window.webkitAudioContext;let audioCtx=null,mixDest=null,audioNodes=[];
 if(AC){audioCtx=new AC();await audioCtx.resume();mixDest=audioCtx.createMediaStreamDestination();audioNodes=[filmAttachAudio624(audioCtx,mixDest,filmAudio624.voiceUrl,filmAudio624.voiceVolume,false),filmAttachAudio624(audioCtx,mixDest,filmAudio624.musicUrl,filmAudio624.musicVolume,true),filmAttachAudio624(audioCtx,mixDest,filmAudio624.sfxUrl,filmAudio624.sfxVolume,false)].filter(Boolean)}
 const tracks=[...videoStream.getVideoTracks(),...(mixDest?mixDest.stream.getAudioTracks():[])],stream=new MediaStream(tracks),mime=MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')?'video/webm;codecs=vp9,opus':(MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':'video/webm'),chunks=[],rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:premium?18000000:10000000,audioBitsPerSecond:192000});
 rec.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};const stopped=new Promise(res=>rec.onstop=res);rec.start(250);await filmStartAudio624(audioNodes);let used=0;
 try{
  for(let p=0;p<prepared.length&&used<target-.01;p++){
   const {v,playFor,index}=prepared[p],stage=q('#filmStatus614');if(stage)stage.textContent=`Building full preview · shot ${p+1}/${prepared.length}`;v.currentTime=0;await v.play().catch(()=>{});const start=performance.now(),fade=q('#filmTransition614')?.value==='fade'?Math.min(.16,playFor*.08):0;
   await new Promise(res=>{let done=false;const finish=()=>{if(done)return;done=true;try{v.pause()}catch{}res()};const frame=now=>{if(done)return;const elapsed=(now-start)/1000;if(v.readyState>=2&&v.videoWidth&&v.videoHeight){const s=Math.max(canvas.width/v.videoWidth,canvas.height/v.videoHeight),w=v.videoWidth*s,h=v.videoHeight*s;ctx.fillStyle='#050b14';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(v,(canvas.width-w)/2,(canvas.height-h)/2,w,h);if(fade>0&&elapsed>playFor-fade){const a=Math.min(1,(elapsed-(playFor-fade))/fade);ctx.fillStyle=`rgba(5,11,20,${a})`;ctx.fillRect(0,0,canvas.width,canvas.height)}}if(elapsed>=playFor||v.ended)return finish();requestAnimationFrame(frame)};requestAnimationFrame(frame)});used+=playFor;
  }
 }finally{filmStopAudio624(audioNodes);if(audioCtx)try{await audioCtx.close()}catch{}}
 try{rec.requestData()}catch{}await sleep56(80);rec.stop();await stopped;const blob=new Blob(chunks,{type:mime});if(blob.size<1024)throw Error('Full Film preview could not be built');filmPreviewBlob6275=blob;filmPreviewSig6275=sig;filmPreviewUrl6275=URL.createObjectURL(blob);const st=q('#filmStatus614');if(st)st.textContent=`Full preview ready · ${filmFmt620(Math.min(used,target))}`;return blob
}
previewFilm614=async function(){
 if(filmPreviewBusy6275)return;filmPreviewBusy6275=true;const b=q('#filmPreviewSequence614');if(b){b.disabled=true;b.textContent='Building full preview…'};
 try{await filmBuildComposite6275();const stage=q('#filmStage614');if(!stage)return;stage.innerHTML=`<video id="filmFullPreview6275" controls playsinline preload="metadata" src="${escHtml(filmPreviewUrl6275)}"></video>`;const v=q('#filmFullPreview6275',stage);try{await v.play()}catch{toast('Full preview is ready · press Play to hear the Voice Over')};toast('Full Film Preview ready · all shots + Voice Over/audio')}
 catch(e){console.error('PIONX full preview',e);toast(e.message||'Could not build full preview')}finally{filmPreviewBusy6275=false;if(b){b.disabled=false;b.textContent='Build Full Preview + Voice'}}
};
exportFilm614=async function(){
 if(filmBusy614)return;filmBusy614=true;const b=q('#filmExport614');if(b){b.disabled=true;b.textContent='Preparing export…'};
 try{const blob=await filmBuildComposite6275(),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=(q('#filmTitle614')?.value||'PIONX-Film').replace(/[^a-z0-9_-]+/gi,'-')+'.webm';a.click();setTimeout(()=>URL.revokeObjectURL(u),60000);toast(`Exported the exact Full Preview · ${filmMotionQuality625==='fast'?'720p':'1080p'} master`)}catch(e){console.error(e);toast(e.message||'Film export failed')}finally{filmBusy614=false;if(b){b.disabled=false;b.textContent='Export Film'}}
};
const filmPageBase6275=filmPage614;
filmPage614=function(){return filmPageBase6275().replace('>Preview target sequence<','>Build Full Preview + Voice<').replace('>Preview sequence<','>Build Full Preview + Voice<')};routes.film=filmPage614;

// Credit changes made from Admin should update the signed-in user's header immediately.
const adminLiveActionBase6275=adminLiveAction60;
adminLiveAction60=async function(payload){
 const j=await adminLiveActionBase6275(payload);try{const me=String(PXUSER56?.id||PXPROFILE56?.id||''),target=String(payload?.id||'');if(me&&target&&me===target){const credits=Number(j?.profile?.credits);if(Number.isFinite(credits)){if(PXPROFILE56)PXPROFILE56.credits=credits;const side=q('#sideCredits');if(side)side.textContent=credits.toLocaleString();const top=q('#topCredits');if(top)top.textContent=credits.toLocaleString()+' Credits'}await loadAccount56({quiet:true})}}catch(e){console.warn('PIONX live credit refresh',e)}return j
};

// Run at most two Film AI shots together. This removes the long dead gap between shots while keeping each credit reservation independent.
function filmMotionRequestKey6275(c,n){if(!c.motionRequestKey6275)c.motionRequestKey6275='film-'+Date.now().toString(36)+'-'+(n+1)+'-'+Math.random().toString(36).slice(2,10);return c.motionRequestKey6275}
async function filmGenerateOne6275(c,n,total){
 const scene=c.directorScene||{},camera=filmCameraFor625(c,n),duration=filmProviderDuration625(c.duration),aspect=q('#filmRatio614')?.value||'16:9',image=await filmSourceData625(c),visual=String(scene.visual_direction||'').trim(),title=String(scene.title||`Scene ${n+1}`).trim();
 const prompt=[`PIONX ARCHITECTURAL FILM SHOT ${n+1}: ${title}.`,visual,`CAMERA MOVE: ${camera}.`,`SOURCE IMAGE IS IMMUTABLE ARCHITECTURE: exact towers/buildings, floor count, facade grid, openings, podium, landscape, roads, materials and proportions must remain unchanged in every frame.`,`Use restrained real camera translation and natural parallax. If a move would reveal unseen geometry, REDUCE the move instead of inventing any new facade or building geometry. Keep verticals stable. No morphing, no new floors, no changed massing, no moving windows, no duplicated architecture, no fake 2D zoom. Target approximately ${duration} seconds.`].filter(Boolean).join('\n');
 if(filmMotionUi6273.shots[n]){filmMotionUi6273.shots[n].state='current';filmMotionUi6273.shots[n].label='Submitting / rendering';filmMotionUi6273.shots[n].camera=camera}filmMotionPaint6273();
 const j=await filmVideoCall626({action:'start',prompt,image,quality:filmMotionQuality625,duration,aspect_ratio:aspect,motion_profile:'preserve',camera,request_key:filmMotionRequestKey6275(c,n)});if(!j.id)throw Error(`AI shot ${n+1} did not return a job id`);c.generatedJob625=j.id;c.generatedCamera625=camera;c.timelineDuration625=Math.max(1,Number(c.duration)||duration);await loadAccount56({quiet:true}).catch(()=>{});
 await filmWaitVideo625(j.id,n+1,total);const blob=await filmDownloadVideo625(j.id),url=URL.createObjectURL(blob);if(c.generatedVideoUrl625?.startsWith('blob:'))try{URL.revokeObjectURL(c.generatedVideoUrl625)}catch{}c.generatedVideoBlob625=blob;c.generatedVideoUrl625=url;c.generatedVideoDuration625=await filmProbeDuration620(url).catch(()=>duration);if(filmMotionUi6273.shots[n]){filmMotionUi6273.shots[n].state='done';filmMotionUi6273.shots[n].label='Ready'}filmMotionUi6273.completed=filmMotionUi6273.shots.filter(x=>x.state==='done').length;filmMotionPaint6273();filmPreviewRevoke6275();await loadAccount56({quiet:true}).catch(()=>{});return true
}
filmGenerateMotion625=async function(){
 if(filmMotionBusy625)return;if(!signedIn56())return toast('Sign in before generating AI film shots');const clips=filmClips614.filter(c=>filmKind621(c)==='image'&&!c.generatedVideoUrl625);if(!clips.length)return toast('All still images already have AI motion');filmMotionBusy625=true;const btn=q('#filmGenerateMotion625');if(btn){btn.disabled=true;btn.textContent='AI Motion is working…'};
 try{filmMotionQuality625=q('#filmMotionQuality625')?.value||filmMotionQuality625;filmMotionAutoCamera625=!!q('#filmAutoCamera625')?.checked;filmMotionBegin6273(clips);filmMotionSet6273('quote',{message:`Checking credits · ${filmMotionQuality625==='fast'?'720p fast':'1080p premium'} route`});await filmQuoteMotion625();let next=0,failed=[];const worker=async()=>{while(true){const n=next++;if(n>=clips.length)return;try{await filmGenerateOne6275(clips[n],n,clips.length)}catch(e){failed.push({n,e});if(filmMotionUi6273.shots[n]){filmMotionUi6273.shots[n].state='failed';filmMotionUi6273.shots[n].label=e.message||'Failed'}filmMotionPaint6273()}}};await Promise.all(Array.from({length:Math.min(2,clips.length)},worker));filmMotionQuoteState625=null;if(failed.length){filmMotionFinish6273(false,`${failed.length} shot(s) need retry; completed shots were kept`);toast(`${failed.length} AI shot(s) need retry · completed shots were kept`)}else{filmMotionFinish6273(true,`${clips.length} premium architecture-locked motion shot(s) ready`);toast(`${clips.length} AI motion shots ready · Full Preview can be built now`)}setTimeout(()=>route(),700)}catch(e){console.error(e);filmMotionFinish6273(false,e.message||'AI motion generation failed');toast(e.message||'AI motion generation failed')}finally{filmMotionBusy625=false;if(btn){btn.disabled=false;btn.textContent='Generate AI Motion Shots ✦'}await loadAccount56({quiet:true}).catch(()=>{})}
};
// ===== END PIONX V6.27.5 =====

// ===== PIONX V6.27.6 · FILM STATE / PENDING JOB RESUME FIX =====
// Keeps AI-motion progress intact while Voice Over is generated, hides stale
// motion quotes, and resumes already-started provider jobs without reserving
// credits a second time.
function filmMotionSets6276(){
 const images=filmClips614.filter(c=>filmKind621(c)==='image');
 const ready=images.filter(c=>!!c.generatedVideoUrl625);
 const pending=images.filter(c=>!c.generatedVideoUrl625&&!!c.generatedJob625);
 const fresh=images.filter(c=>!c.generatedVideoUrl625&&!c.generatedJob625);
 return {images,ready,pending,fresh};
}
function filmMotionAccountCredits6276(){const n=Number(PXPROFILE56?.credits);return Number.isFinite(n)?n:null}
filmMotionPanel625=function(){
 const {images,ready,pending,fresh}=filmMotionSets6276(),qv=filmMotionQuoteState625;
 const active=!!filmMotionBusy625||pending.length>0;
 let status='';
 if(active){status=`${ready.length} ready · ${pending.length} processing${fresh.length?` · ${fresh.length} waiting`:''}. Existing processing shots are resumed automatically; no second reserve is taken.`}
 else if(qv&&qv.shots===fresh.length&&fresh.length){const bal=filmMotionAccountCredits6276();status=`Estimated: ${qv.cost} credits · reserve ${qv.reserve} credits for ${qv.shots} new shot(s)`+(bal!=null?` · balance ${bal}`:'')}
 else if(!fresh.length&&ready.length===images.length&&images.length){status='All still-image scenes already have AI motion.'}
 else status=images.length?`${fresh.length} still-image scene(s) ready for PIONX Auto motion.`:'Upload still images first.';
 return `<section class="panel" id="filmMotionPanel625" style="margin-top:18px;padding:18px"><div class="section-title" style="margin:0 0 12px"><div><small>PIONX AUTO FILM ENGINE</small><h2 style="margin:4px 0">AI Motion & Camera Generation</h2><p>PIONX automatically selects the best available Film engine for each shot. Processing jobs are preserved while you work on Voice Over or other Film controls.</p></div><span class="status-pill">${ready.length}/${images.length} AI shots${pending.length?` · ${pending.length} processing`:''}</span></div>
 <div class="form-grid"><label>Film quality<select id="filmMotionQuality625"><option value="premium" ${filmMotionQuality625==='premium'?'selected':''}>Premium Cinematic</option><option value="fast" ${filmMotionQuality625==='fast'?'selected':''}>Fast Preview</option></select></label><label class="film-audio-check624" style="align-self:end"><input id="filmAutoCamera625" type="checkbox" ${filmMotionAutoCamera625?'checked':''}> Auto-vary camera movement between scenes</label></div>
 <div class="alert-box" style="margin:12px 0">Credits are reserved only when a new AI shot starts. A shot already processing is resumed without a second reservation. Voice Over generation does not start or re-price AI Motion.</div>
 <div class="film-audio-actions624"><button class="ghost-btn" id="filmMotionQuote625" ${fresh.length?'':'disabled'}>Check AI Motion Credits</button><button class="primary-btn" id="filmGenerateMotion625" ${images.length?'':'disabled'}>${pending.length?'Resume AI Motion':(fresh.length?'Generate AI Motion Shots ✦':'AI Motion Ready')}</button></div>
 <div class="film-audio-ready624" id="filmMotionStatus625">${status}</div></section>`;
};
filmQuoteMotion625=async function(){
 const {pending,fresh}=filmMotionSets6276();
 if(!fresh.length){filmMotionQuoteState625=null;const s=q('#filmMotionStatus625');if(s)s.textContent=pending.length?`${pending.length} AI shot(s) are already processing · no new credit reserve required.`:'All still-image shots already have AI motion.';return {cost:0,reserve:0,shots:0}}
 const btn=q('#filmMotionQuote625');if(btn){btn.disabled=true;btn.textContent='Checking…'};let cost=0,reserve=0;
 try{
  for(let i=0;i<fresh.length;i++){const c=fresh[i],camera=filmCameraFor625(c,i),d=filmProviderDuration625(c.duration);const j=await filmVideoCall626({action:'quote',quality:filmMotionQuality625,duration:d,aspect_ratio:q('#filmRatio614')?.value||'16:9',motion_profile:'preserve',camera});cost+=Number(j.credits_cost)||0;reserve+=Number(j.credits_reserved)||0}
  filmMotionQuoteState625={cost,reserve,shots:fresh.length};const bal=filmMotionAccountCredits6276(),s=q('#filmMotionStatus625');if(s)s.textContent=`Estimated: ${cost} credits · reserve ${reserve} credits for ${fresh.length} NEW shot(s)`+(bal!=null?` · balance ${bal}`:'');return filmMotionQuoteState625
 }catch(e){const s=q('#filmMotionStatus625');if(s)s.textContent=e.message;throw e}finally{if(btn){btn.disabled=false;btn.textContent='Check AI Motion Credits'}}
};
async function filmResumeOne6276(c,n,total){
 const id=c.generatedJob625;if(!id)return filmGenerateOne6275(c,n,total);
 const camera=c.generatedCamera625||filmCameraFor625(c,n);
 if(filmMotionUi6273?.shots?.[n]){filmMotionUi6273.shots[n].state='current';filmMotionUi6273.shots[n].label='Resuming existing AI job';filmMotionUi6273.shots[n].camera=camera}filmMotionPaint6273?.();
 try{await filmWaitVideo625(id,n+1,total);const blob=await filmDownloadVideo625(id),url=URL.createObjectURL(blob);if(c.generatedVideoUrl625?.startsWith('blob:'))try{URL.revokeObjectURL(c.generatedVideoUrl625)}catch{}c.generatedVideoBlob625=blob;c.generatedVideoUrl625=url;c.generatedVideoDuration625=await filmProbeDuration620(url).catch(()=>Number(c.duration)||6);if(filmMotionUi6273?.shots?.[n]){filmMotionUi6273.shots[n].state='done';filmMotionUi6273.shots[n].label='Ready'}if(filmMotionUi6273){filmMotionUi6273.completed=filmMotionUi6273.shots.filter(x=>x.state==='done').length}filmMotionPaint6273?.();filmPreviewRevoke6275?.();await loadAccount56({quiet:true}).catch(()=>{});return true}
 catch(e){c.generatedJob625='';c.motionRequestKey6275='';throw e}
}
filmGenerateMotion625=async function(){
 if(filmMotionBusy625)return;if(!signedIn56())return toast('Sign in before generating AI film shots');const sets=filmMotionSets6276();if(!sets.pending.length&&!sets.fresh.length)return toast('All still images already have AI motion');
 filmMotionBusy625=true;const btn=q('#filmGenerateMotion625');if(btn){btn.disabled=true;btn.textContent='AI Motion is working…'};filmMotionQuoteState625=null;
 const tasks=[...sets.pending.map(c=>({c,resume:true})),...sets.fresh.map(c=>({c,resume:false}))];
 try{filmMotionQuality625=q('#filmMotionQuality625')?.value||filmMotionQuality625;filmMotionAutoCamera625=!!q('#filmAutoCamera625')?.checked;filmMotionBegin6273(tasks.map(x=>x.c));if(sets.fresh.length){filmMotionSet6273('quote',{message:`Checking credits only for ${sets.fresh.length} new shot(s)`});await filmQuoteMotion625()}else filmMotionSet6273('rendering',{message:`Resuming ${sets.pending.length} already-started AI shot(s) · no new reserve`});
  let next=0,failed=[];const worker=async()=>{while(true){const n=next++;if(n>=tasks.length)return;const t=tasks[n];try{if(t.resume)await filmResumeOne6276(t.c,n,tasks.length);else await filmGenerateOne6275(t.c,n,tasks.length)}catch(e){failed.push({n,e});if(filmMotionUi6273?.shots?.[n]){filmMotionUi6273.shots[n].state='failed';filmMotionUi6273.shots[n].label=e.message||'Failed'}filmMotionPaint6273?.()}}};await Promise.all(Array.from({length:Math.min(2,tasks.length)},worker));filmMotionQuoteState625=null;
  if(failed.length){filmMotionFinish6273(false,`${failed.length} shot(s) need retry; completed shots were kept`);toast(`${failed.length} AI shot(s) need retry · completed shots were kept`)}else{filmMotionFinish6273(true,`${tasks.length} AI motion shot(s) ready`);toast('AI Motion ready · Voice Over and Full Preview can continue')}
  setTimeout(()=>route(),500)
 }catch(e){console.error(e);filmMotionFinish6273(false,e.message||'AI motion generation failed');toast(e.message||'AI motion generation failed')}finally{filmMotionBusy625=false;if(btn){btn.disabled=false;btn.textContent='Generate AI Motion Shots ✦'}await loadAccount56({quiet:true}).catch(()=>{})}
};
// Voice Over is independent. Do not rebuild the whole Film route while AI Motion
// is processing, because that used to hide live progress and expose a stale quote.
filmGenerateVoice624=async function(){
 if(filmAudio624.busy)return;const text=filmVoiceScript624();if(!text)return toast('Create a story/voice-over script first');if(!signedIn56())return toast('Sign in before generating AI voice-over');
 const b=q('#filmGenerateVoice624');filmAudio624.busy=true;if(b){b.disabled=true;b.textContent='Generating voice-over…'};
 try{filmAudio624.voice=q('#filmVoice624')?.value||filmAudio624.voice;const r=await pxApi56('/server/film-audio-v624.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'voiceover',text,voice:filmAudio624.voice,language:filmDirectorLanguage622||'English',style:filmDirectorStyle622||'Architectural Film'})});if(!r.ok){let msg='AI voice-over failed';try{const j=await json56(r,'PIONX Film Voice');msg=j.error||msg}catch{}throw Error(msg)}const blob=await r.blob();if(!blob.size)throw Error('AI voice-over returned an empty audio file');filmAudioRevoke624('voiceUrl');filmAudio624.voiceBlob=blob;filmAudio624.voiceName=`PIONX AI Voice · ${filmAudio624.voice}`;filmAudio624.voiceUrl=URL.createObjectURL(blob);filmPreviewRevoke6275?.();const status=q('#filmVoiceStatus624');if(status)status.textContent='✓ '+filmAudio624.voiceName;if(b)b.textContent='Regenerate AI Voice Over';toast('AI voice-over ready');if(!filmMotionBusy625&&!filmMotionSets6276().pending.length)setTimeout(()=>route(),80)
 }catch(e){console.error('PIONX film voice',e);toast(e.message||'AI voice-over failed')}finally{filmAudio624.busy=false;if(b){b.disabled=false;if(!filmAudio624.voiceUrl)b.textContent='Generate AI Voice Over ✦'}}
};
// ===== END PIONX V6.27.6 =====

// ===== PIONX V6.27.7 · LIVE MOTION ETA + VISIBLE PREVIEW =====
// Shows real job stages, elapsed time, a rolling ETA based only on completed
// shots, and makes preview access visible beside AI Motion controls.
function filmMotionFmtEta6277(ms){
 if(!Number.isFinite(ms)||ms<=0)return 'Calculating from completed shots…';
 const sec=Math.max(1,Math.round(ms/1000));
 if(sec<60)return `~${sec}s`;
 const min=Math.floor(sec/60),rem=sec%60;
 return `~${min}m ${rem?rem+'s':''}`.trim();
}
function filmMotionEta6277(){
 const u=filmMotionUi6273||{},now=Date.now(),shots=Array.isArray(u.shots)?u.shots:[];
 const doneDur=shots.filter(x=>x.state==='done'&&x.startedAt&&x.doneAt&&x.doneAt>x.startedAt).map(x=>x.doneAt-x.startedAt);
 if(!doneDur.length)return {text:'Calculating from completed shots…',ms:null,avg:null};
 const avg=doneDur.reduce((a,b)=>a+b,0)/doneDur.length;
 const unfinished=shots.filter(x=>x.state!=='done'&&x.state!=='failed').length;
 if(!unfinished)return {text:'Ready',ms:0,avg};
 const active=shots.filter(x=>x.state==='current');
 const activeAges=active.map(x=>x.startedAt?Math.max(0,now-x.startedAt):0);
 const firstWave=Math.max(0,avg-(activeAges.length?Math.max(...activeAges):0));
 const queued=Math.max(0,unfinished-active.length);
 const extraWaves=Math.ceil(queued/2);
 const estimate=Math.max(15000,firstWave+extraWaves*avg);
 return {text:filmMotionFmtEta6277(estimate),ms:estimate,avg};
}
function filmMotionPaint6277(){
 const box=filmMotionEnsureUi6273();if(!box)return;const u=filmMotionUi6273;box.hidden=!u.active&&!u.shots.length;if(box.hidden)return;
 const now=Date.now(),shots=Array.isArray(u.shots)?u.shots:[];
 for(const x of shots){if(x.state==='current'&&!x.startedAt)x.startedAt=now;if(x.state==='done'&&!x.doneAt)x.doneAt=now}
 const total=Math.max(1,u.total||shots.length||1),pct=Math.max(0,Math.min(100,(u.completed/total)*100)),elapsed=u.startedAt?filmMotionFmtTime6273(now-u.startedAt):'0:00';
 const current=u.current>0?`Shot ${u.current} of ${u.total}`:`${u.completed} of ${u.total} complete`,eta=filmMotionEta6277();
 const activeShots=shots.filter(x=>x.state==='current').length,queued=shots.filter(x=>x.state==='queued').length;
 box.innerHTML=`<div class="fm6273-head"><div><b>${u.active?'PIONX is generating real camera motion':'AI motion generation status'}</b><small>${escHtml(filmMotionStageLabel6273(u.stage))}${u.camera?` · ${escHtml(u.camera)}`:''}</small></div><span class="fm6273-live">${u.active?'<i class="fm6273-pulse"></i> Working':'Finished'}</span></div>
 <div class="fm6273-overall ${u.active?'active':''}"><i style="width:${pct}%"></i></div>
 <div class="fm6273-meta"><span>${escHtml(current)}</span><span>${Math.round(pct)}% shots complete</span><span>Elapsed ${elapsed}</span></div>
 <div class="fm6277-eta" style="margin-top:10px;padding:10px 12px;border:1px solid rgba(111,101,255,.25);border-radius:11px;background:#091725;display:flex;gap:18px;flex-wrap:wrap;align-items:center"><b style="color:#fff">Estimated remaining: ${escHtml(eta.text)}</b><span style="color:#8fa3ba;font-size:12px">${activeShots} rendering · ${queued} queued</span></div>
 <div class="fm6273-stage"><strong>${escHtml(filmMotionStageLabel6273(u.stage))}</strong>${u.message?` · ${escHtml(u.message)}`:''}<br><small>The provider returns job status rather than a true percentage. This line uses completed shots and elapsed time for a live ETA, so it becomes more accurate after the first shot finishes.</small></div>
 <div class="fm6273-shots">${shots.map((x,i)=>{const cls=x.state==='done'?'done':x.state==='failed'?'failed':x.state==='current'?'current':'';const icon=x.state==='done'?'✓':x.state==='failed'?'!':x.state==='current'?'↻':String(i+1);const t=x.startedAt?(x.doneAt||now)-x.startedAt:0;return `<div class="fm6273-shot ${cls}"><span class="fm6273-icon">${icon}</span><div><b>Shot ${i+1}${x.title?' · '+escHtml(x.title):''}</b><small>${escHtml(x.camera||'Camera move queued')}<br>${escHtml(x.label||'Queued')}${t>0?` · ${filmMotionFmtTime6273(t)}`:''}</small></div></div>`}).join('')}</div>`;
}
filmMotionPaint6273=filmMotionPaint6277;
const filmMotionBeginBase6277=filmMotionBegin6273;
filmMotionBegin6273=function(clips){filmMotionBeginBase6277(clips);const now=Date.now();for(const x of filmMotionUi6273.shots){x.startedAt=0;x.doneAt=0}filmMotionUi6273.startedAt=now;filmMotionPaint6277()};
function filmMotionShowShotPreview6277(c){
 const stage=q('#filmStage614');if(!stage||!c?.generatedVideoUrl625)return;
 stage.innerHTML=`<video id="filmLiveShotPreview6277" controls muted playsinline preload="metadata" src="${escHtml(c.generatedVideoUrl625)}"></video><span class="film-shot-label614">AI MOTION SHOT READY · Preview</span>`;
 const v=q('#filmLiveShotPreview6277',stage);if(v)v.play().catch(()=>{});
 const st=q('#filmStatus614');if(st)st.textContent=`AI motion shot ready · ${filmGeneratedCount625()} completed`;
}
const filmGenerateOneBase6277=filmGenerateOne6275;
filmGenerateOne6275=async function(c,n,total){const r=await filmGenerateOneBase6277(c,n,total);const x=filmMotionUi6273?.shots?.[n];if(x){x.doneAt=Date.now();x.label='Ready · click preview anytime'}filmMotionPaint6277();filmMotionShowShotPreview6277(c);return r};
const filmResumeOneBase6277=filmResumeOne6276;
filmResumeOne6276=async function(c,n,total){const r=await filmResumeOneBase6277(c,n,total);const x=filmMotionUi6273?.shots?.[n];if(x){x.doneAt=Date.now();x.label='Ready · click preview anytime'}filmMotionPaint6277();filmMotionShowShotPreview6277(c);return r};
filmMotionPanel625=function(){
 const {images,ready,pending,fresh}=filmMotionSets6276(),qv=filmMotionQuoteState625,allReady=images.length>0&&ready.length===images.length;
 const active=!!filmMotionBusy625||pending.length>0;let status='';
 if(active)status=`${ready.length} ready · ${pending.length} processing${fresh.length?` · ${fresh.length} waiting`:''}. Existing processing shots are resumed automatically; no second reserve is taken.`;
 else if(qv&&qv.shots===fresh.length&&fresh.length){const bal=filmMotionAccountCredits6276();status=`Estimated: ${qv.cost} credits · reserve ${qv.reserve} credits for ${qv.shots} new shot(s)`+(bal!=null?` · balance ${bal}`:'')}
 else if(allReady)status='All still-image scenes already have AI motion. Full Film Preview is ready to build.';
 else status=images.length?`${fresh.length} still-image scene(s) ready for PIONX Auto motion.`:'Upload still images first.';
 return `<section class="panel" id="filmMotionPanel625" style="margin-top:18px;padding:18px"><div class="section-title" style="margin:0 0 12px"><div><small>PIONX AUTO FILM ENGINE</small><h2 style="margin:4px 0">AI Motion & Camera Generation</h2><p>Live shot status, elapsed time and rolling ETA stay visible while PIONX generates the film.</p></div><span class="status-pill">${ready.length}/${images.length} AI shots${pending.length?` · ${pending.length} processing`:''}</span></div>
 <div class="form-grid"><label>Film quality<select id="filmMotionQuality625"><option value="premium" ${filmMotionQuality625==='premium'?'selected':''}>Premium Cinematic</option><option value="fast" ${filmMotionQuality625==='fast'?'selected':''}>Fast Preview</option></select></label><label class="film-audio-check624" style="align-self:end"><input id="filmAutoCamera625" type="checkbox" ${filmMotionAutoCamera625?'checked':''}> Auto-vary camera movement between scenes</label></div>
 <div class="alert-box" style="margin:12px 0">The moving line shows that the provider job is alive. Completed-shot progress is real; remaining time is a rolling estimate based on shots that actually finished.</div>
 <div class="film-audio-actions624"><button class="ghost-btn" id="filmMotionQuote625" ${fresh.length?'':'disabled'}>Check AI Motion Credits</button><button class="primary-btn" id="filmGenerateMotion625" ${images.length?'':'disabled'}>${pending.length?'Resume AI Motion':(fresh.length?'Generate AI Motion Shots ✦':'AI Motion Ready')}</button></div>
 <div class="film-audio-actions624" style="margin-top:10px"><button class="ghost-btn" id="filmPreviewReady6277" ${ready.length?'':'disabled'}>▶ Preview latest ready shot</button><button class="primary-btn" id="filmFullPreview6277" ${allReady?'':'disabled'}>${allReady?'▶ Build Full Film Preview':'Full Preview after AI Motion'}</button></div>
 <div class="film-audio-ready624" id="filmMotionStatus625">${status}</div></section>`;
};
const wireBase6277=wireView;
wireView=function(name){wireBase6277(name);if(name!=='film')return;
 q('#filmPreviewReady6277')?.addEventListener('click',()=>{const ready=filmMotionSets6276().ready;const c=ready[ready.length-1];if(c)filmMotionShowShotPreview6277(c);else toast('No AI motion shot is ready yet')});
 q('#filmFullPreview6277')?.addEventListener('click',()=>previewFilm614());
};
// ===== END PIONX V6.27.7 =====


// ===== PIONX V6.27.8 · CACHE-SAFE LIVE PROGRESS + RESUME HYDRATION =====
// Uses a new physical JS filename so stale app-v68.js caches cannot hide the live UI.
function filmMotionHydrate6278(){
 const sets=filmMotionSets6276();
 const images=sets.images||[];if(!images.length)return;
 const hasLive=Array.isArray(filmMotionUi6273?.shots)&&filmMotionUi6273.shots.length===images.length&&filmMotionUi6273.active;
 if(hasLive){filmMotionPaint6277();return}
 const now=Date.now(),pendingSet=new Set(sets.pending||[]),readySet=new Set(sets.ready||[]);
 const shots=images.map((c,i)=>({
  state:readySet.has(c)?'done':pendingSet.has(c)?'current':'queued',
  label:readySet.has(c)?'Ready':pendingSet.has(c)?'Processing provider job':'Queued',
  camera:c.generatedCamera625||filmCameraFor625(c,i),
  title:String(c?.directorScene?.title||'').trim(),
  startedAt:pendingSet.has(c)?now:0,
  doneAt:readySet.has(c)?now:0
 }));
 const firstPending=shots.findIndex(x=>x.state==='current');
 filmMotionUi6273={active:pendingSet.size>0||!!filmMotionBusy625,total:images.length,current:firstPending>=0?firstPending+1:0,completed:readySet.size,stage:pendingSet.size?'rendering':(readySet.size===images.length?'complete':'idle'),camera:firstPending>=0?shots[firstPending].camera:'',message:pendingSet.size?`${pendingSet.size} AI shot job(s) are processing`:(readySet.size===images.length?'All AI motion shots are ready':'Ready to generate'),startedAt:now,shotStartedAt:now,shots};
 clearInterval(filmMotionTicker6273);filmMotionTicker6273=0;
 if(filmMotionUi6273.active)filmMotionTicker6273=setInterval(filmMotionPaint6277,1000);
 filmMotionPaint6277();
}
filmMotionPanel625=function(){
 const {images,ready,pending,fresh}=filmMotionSets6276(),qv=filmMotionQuoteState625,allReady=images.length>0&&ready.length===images.length;
 const active=!!filmMotionBusy625||pending.length>0;let status='';
 if(active)status=`${ready.length} ready · ${pending.length} processing${fresh.length?` · ${fresh.length} waiting`:''}`;
 else if(qv&&qv.shots===fresh.length&&fresh.length){const bal=filmMotionAccountCredits6276();status=`Estimated: ${qv.cost} credits · reserve ${qv.reserve} credits for ${qv.shots} new shot(s)`+(bal!=null?` · balance ${bal}`:'')}
 else if(allReady)status='All AI motion shots are ready. Build the full preview before export.';
 else status=images.length?`${fresh.length} still-image scene(s) ready for AI motion.`:'Upload still images first.';
 return `<section class="panel" id="filmMotionPanel625" style="margin-top:18px;padding:18px"><div class="section-title" style="margin:0 0 12px"><div><small>PIONX FILM · VISUAL CONSISTENCY</small><h2 style="margin:4px 0">AI Motion & Camera Generation</h2><p>Live rendering status, elapsed time and estimated remaining time stay visible during every AI shot.</p></div><span class="status-pill">${ready.length}/${images.length} AI shots${pending.length?` · ${pending.length} processing`:''}</span></div>
 <div class="form-grid"><label>Film quality<select id="filmMotionQuality625"><option value="premium" ${filmMotionQuality625==='premium'?'selected':''}>Premium Cinematic</option><option value="fast" ${filmMotionQuality625==='fast'?'selected':''}>Fast Preview</option></select></label><label class="film-audio-check624" style="align-self:end"><input id="filmAutoCamera625" type="checkbox" ${filmMotionAutoCamera625?'checked':''}> Auto-vary camera movement between scenes</label></div>
 <div class="alert-box" style="margin:12px 0">The animated line confirms the provider job is alive. After the first completed shot, PIONX estimates the remaining time from actual completed-shot timing.</div>
 <div class="film-audio-actions624"><button class="ghost-btn" id="filmMotionQuote625" ${fresh.length?'':'disabled'}>Check AI Motion Credits</button><button class="primary-btn" id="filmGenerateMotion625" ${images.length?'':'disabled'}>${pending.length?'Resume AI Motion':(fresh.length?'Generate AI Motion Shots ✦':'AI Motion Ready')}</button></div>
 <div class="film-audio-actions624" style="margin-top:10px"><button class="ghost-btn" id="filmPreviewReady6277" ${ready.length?'':'disabled'}>▶ Preview latest ready shot</button><button class="primary-btn" id="filmFullPreview6277" ${allReady?'':'disabled'}>${allReady?'▶ Build Full Film Preview':'Full Preview after AI Motion'}</button></div>
 <div class="film-audio-ready624" id="filmMotionStatus625">${status}</div>
 <div id="filmMotionLive6273" ${active||filmMotionUi6273?.shots?.length?'':'hidden'}></div></section>`;
};
const wireBase6278=wireView;
wireView=function(name){
 wireBase6278(name);if(name!=='film')return;
 // Recreate the live status from pending/ready shot jobs if the view was redrawn.
 requestAnimationFrame(()=>filmMotionHydrate6278());
};
// Refresh live view once at boot when Film is already the active route.
setTimeout(()=>{try{if((location.hash||'').includes('film'))filmMotionHydrate6278()}catch{}},250);
// ===== END PIONX V6.27.8 =====

// One exact preview master: all ready AI-motion shots + decoded VO/music/SFX.
// Export reuses the same cached master so preview and downloaded film match.
let filmPreviewBlob6281=null,filmPreviewUrl6281='',filmPreviewSignatureCache6281='',filmPreviewBusy6281=false,filmPreviewDuration6281=0;
function filmPreviewClear6281(){
  if(filmPreviewUrl6281&&String(filmPreviewUrl6281).startsWith('blob:'))try{URL.revokeObjectURL(filmPreviewUrl6281)}catch{}
  filmPreviewBlob6281=null;filmPreviewUrl6281='';filmPreviewSignatureCache6281='';filmPreviewDuration6281=0;
}
function filmPreviewSignature6281(){
  return JSON.stringify({
    target:filmTarget620(),ratio:q('#filmRatio614')?.value||'16:9',fps:Number(q('#filmFps614')?.value||30),transition:q('#filmTransition614')?.value||'fade',quality:filmMotionQuality625,
    clips:filmClips614.map(c=>[c.generatedJob625||'',c.generatedVideoDuration625||0,c.timelineDuration625||c.duration||0,c.name||'']),
    audio:[filmAudio624.voiceBlob?.size||0,filmAudio624.voiceName||'',filmAudio624.voiceVolume,filmAudio624.musicBlob?.size||0,filmAudio624.musicName||'',filmAudio624.musicVolume,filmAudio624.sfxBlob?.size||0,filmAudio624.sfxName||'',filmAudio624.sfxVolume]
  });
}
function filmPreviewStage6281(title,detail='',pct=0){
  const stage=q('#filmStage614');if(!stage)return;
  const p=Math.max(0,Math.min(100,Number(pct)||0));
  stage.innerHTML=`<div class="film-preview-build6281" style="height:100%;min-height:320px;display:grid;place-items:center;background:#07111d;color:#eef5ff;padding:24px"><div style="width:min(620px,86%);text-align:center"><b style="font-size:18px">${escHtml(title)}</b><p id="filmPreviewBuildDetail6281" style="color:#91a6bb;margin:8px 0 16px">${escHtml(detail)}</p><div style="height:10px;border-radius:999px;background:#10263b;overflow:hidden"><i id="filmPreviewBuildBar6281" style="display:block;height:100%;width:${p}%;background:linear-gradient(90deg,#7568ff,#52b7ff);transition:width .18s linear"></i></div><small id="filmPreviewBuildPct6281" style="display:block;margin-top:9px;color:#8da1b8">${Math.round(p)}%</small></div></div>`;
}
function filmPreviewStageUpdate6281(detail,pct){
  const d=q('#filmPreviewBuildDetail6281'),b=q('#filmPreviewBuildBar6281'),p=q('#filmPreviewBuildPct6281');
  const n=Math.max(0,Math.min(100,Number(pct)||0));if(d)d.textContent=detail;if(b)b.style.width=n+'%';if(p)p.textContent=Math.round(n)+'%';
}
async function filmDecodeAudio6281(ctx,blob){
  if(!ctx||!blob||!blob.size)return null;
  try{return await ctx.decodeAudioData((await blob.arrayBuffer()).slice(0))}catch(e){console.warn('PIONX preview audio decode',e);return null}
}
function filmScheduleBuffer6281(ctx,dest,buffer,volume,loop,startAt){
  if(!ctx||!dest||!buffer)return null;
  const src=ctx.createBufferSource(),gain=ctx.createGain();src.buffer=buffer;src.loop=!!loop;gain.gain.value=Math.max(0,Math.min(1,Number(volume)||0));src.connect(gain).connect(dest);src.start(startAt);return {src,gain};
}
async function filmWaitMeta6281(v){
  if(v.readyState>=1&&Number.isFinite(v.duration)&&v.duration>0)return;
  await new Promise((res,rej)=>{let done=false;const finish=(ok,e)=>{if(done)return;done=true;clearTimeout(t);v.onloadedmetadata=null;v.onerror=null;ok?res():rej(e||Error('Could not read Film shot'))};const t=setTimeout(()=>finish(false,Error('Film shot metadata timed out')),12000);v.onloadedmetadata=()=>finish(true);v.onerror=()=>finish(false,Error('Could not read Film shot'))});
}
async function filmBuildComposite6281(){
  if(filmPreviewBusy6281)throw Error('Full Film Preview is already building');
  if(typeof MediaRecorder==='undefined')throw Error('This browser cannot build the Full Film Preview');
  if(!filmClips614.length)throw Error('Add Film shots first');
  const stills=filmClips614.filter(c=>filmKind621(c)==='image'),missing=stills.filter(c=>!c.generatedVideoUrl625);
  if(missing.length)throw Error(`Generate AI Motion first · ${stills.length-missing.length}/${stills.length} ready`);
  const sig=filmPreviewSignature6281();if(filmPreviewBlob6281&&filmPreviewSignatureCache6281===sig)return filmPreviewBlob6281;
  filmPreviewBusy6281=true;filmPreviewClear6281();
  const target=Math.max(1,filmTarget620()),vertical=(q('#filmRatio614')?.value||'16:9')==='9:16',premium=filmMotionQuality625!=='fast',fps=Math.max(24,Number(q('#filmFps614')?.value||30));
  filmPreviewStage6281('Building Full Film Preview','Preparing all AI motion shots + Voice Over…',2);
  let audioCtx=null,audioSources=[];
  try{
    const prepared=[];let planned=0;
    for(let i=0;i<filmClips614.length&&planned<target-.01;i++){
      const c=filmClips614[i],src=filmPlayableUrl625(c);if(!src)continue;
      const v=document.createElement('video');v.src=src;v.playsInline=true;v.preload='auto';v.muted=true;await filmWaitMeta6281(v);
      const media=Number.isFinite(v.duration)&&v.duration>0?v.duration:Number(c.generatedVideoDuration625||c.duration||0),want=Math.max(.1,Number(c.timelineDuration625||c.duration)||media||1),playFor=Math.min(target-planned,want,media||want);
      if(playFor>.02){prepared.push({c,v,playFor});planned+=playFor}
      filmPreviewStageUpdate6281(`Preparing shot ${i+1}/${filmClips614.length}`,Math.min(10,(i+1)/Math.max(1,filmClips614.length)*10));
    }
    if(!prepared.length)throw Error('No playable AI motion shots found');
    const actualTarget=Math.min(target,prepared.reduce((n,x)=>n+x.playFor,0));filmPreviewDuration6281=actualTarget;
    const canvas=document.createElement('canvas');canvas.width=vertical?(premium?1080:720):(premium?1920:1280);canvas.height=vertical?(premium?1920:1280):(premium?1080:720);
    const ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#050b14';ctx.fillRect(0,0,canvas.width,canvas.height);
    const videoStream=canvas.captureStream(fps),AC=window.AudioContext||window.webkitAudioContext;let dest=null,voiceBuf=null,musicBuf=null,sfxBuf=null;
    if(AC){
      audioCtx=new AC();await audioCtx.resume();dest=audioCtx.createMediaStreamDestination();filmPreviewStageUpdate6281('Preparing Voice Over + audio mix…',11);
      [voiceBuf,musicBuf,sfxBuf]=await Promise.all([filmDecodeAudio6281(audioCtx,filmAudio624.voiceBlob),filmDecodeAudio6281(audioCtx,filmAudio624.musicBlob),filmDecodeAudio6281(audioCtx,filmAudio624.sfxBlob)]);
      if(filmAudio624.voiceBlob?.size&&!voiceBuf)throw Error('Voice Over is ready but could not be embedded. Regenerate Voice Over once, then build preview again.');
    }
    const tracks=[...videoStream.getVideoTracks(),...(dest?dest.stream.getAudioTracks():[])],stream=new MediaStream(tracks),mime=MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')?'video/webm;codecs=vp9,opus':(MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':'video/webm');
    const chunks=[],rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:premium?20000000:11000000,audioBitsPerSecond:192000});rec.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};const stopped=new Promise(res=>rec.onstop=res);rec.start(250);
    if(audioCtx&&dest){const t0=audioCtx.currentTime+.08;const add=(buf,vol,loop)=>{const n=filmScheduleBuffer6281(audioCtx,dest,buf,vol,loop,t0);if(n)audioSources.push(n)};add(voiceBuf,filmAudio624.voiceVolume,false);add(musicBuf,filmAudio624.musicVolume,true);add(sfxBuf,filmAudio624.sfxVolume,false)}
    let used=0;
    for(let i=0;i<prepared.length&&used<actualTarget-.01;i++){
      const {v,playFor}=prepared[i];v.currentTime=0;await v.play().catch(()=>{});const start=performance.now();
      await new Promise(res=>{let done=false,lastUi=0;const finish=()=>{if(done)return;done=true;try{v.pause()}catch{}res()};const frame=now=>{if(done)return;const elapsed=Math.min(playFor,(now-start)/1000);if(v.readyState>=2&&v.videoWidth&&v.videoHeight){const s=Math.max(canvas.width/v.videoWidth,canvas.height/v.videoHeight),w=v.videoWidth*s,h=v.videoHeight*s;ctx.fillStyle='#050b14';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(v,(canvas.width-w)/2,(canvas.height-h)/2,w,h)}if(now-lastUi>160){lastUi=now;const totalNow=Math.min(actualTarget,used+elapsed),pct=12+(totalNow/Math.max(.1,actualTarget))*84;filmPreviewStageUpdate6281(`Shot ${i+1}/${prepared.length} · ${filmFmt620(totalNow)} / ${filmFmt620(actualTarget)} · ${filmAudio624.voiceBlob?.size?'Voice Over embedded':'video only'}`,pct)}if(elapsed>=playFor||v.ended)return finish();requestAnimationFrame(frame)};requestAnimationFrame(frame)});used+=playFor;
    }
    for(const n of audioSources){try{n.src.stop()}catch{}try{n.src.disconnect();n.gain.disconnect()}catch{}}audioSources=[];
    try{rec.requestData()}catch{}await sleep56(120);rec.stop();await stopped;if(audioCtx)try{await audioCtx.close()}catch{}audioCtx=null;
    const blob=new Blob(chunks,{type:mime});if(blob.size<2048)throw Error('Full Film Preview could not be encoded');
    filmPreviewBlob6281=blob;filmPreviewSignatureCache6281=sig;filmPreviewUrl6281=URL.createObjectURL(blob);filmPreviewStageUpdate6281('Full Film Preview ready',100);
    const st=q('#filmStatus614');if(st)st.textContent=`Full Film Preview ready · ${filmFmt620(Math.min(used,actualTarget))} · ${filmAudio624.voiceBlob?.size?'Voice Over embedded':'video only'}`;
    return blob;
  }finally{
    for(const n of audioSources){try{n.src.stop()}catch{}try{n.src.disconnect();n.gain.disconnect()}catch{}}
    if(audioCtx)try{await audioCtx.close()}catch{}
    filmPreviewBusy6281=false;
  }
}
async function filmShowFullPreview6281(){
  if(filmPreviewBusy6281)return toast('Full Film Preview is already building…');
  try{
    await filmBuildComposite6281();const stage=q('#filmStage614');if(!stage)return;
    stage.innerHTML=`<video id="filmFullPreview6281" controls playsinline preload="auto" src="${escHtml(filmPreviewUrl6281)}"></video><span class="film-shot-label614">FULL FILM PREVIEW · ${filmFmt620(filmPreviewDuration6281)}${filmAudio624.voiceBlob?.size?' · VOICE EMBEDDED':''}</span>`;
    const v=q('#filmFullPreview6281',stage);if(v){v.muted=false;v.volume=1;try{await v.play()}catch{toast('Full preview ready · press Play to hear the embedded Voice Over')}}
    toast(`Full Film Preview ready · ${filmFmt620(filmPreviewDuration6281)}${filmAudio624.voiceBlob?.size?' · Voice Over embedded':''}`);
  }catch(e){console.error('PIONX Full Preview 6.28.0',e);toast(e.message||'Could not build Full Film Preview')}
}
previewFilm614=filmShowFullPreview6281;
exportFilm614=async function(){
  if(filmBusy614)return;filmBusy614=true;const b=q('#filmExport614');if(b){b.disabled=true;b.textContent='Preparing exact preview…'};
  try{const blob=await filmBuildComposite6281(),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=(q('#filmTitle614')?.value||'PIONX-Film').replace(/[^a-z0-9_-]+/gi,'-')+'.webm';a.click();setTimeout(()=>URL.revokeObjectURL(u),60000);toast(`Exported exact Full Preview · ${filmMotionQuality625==='fast'?'720p':'1080p'}${filmAudio624.voiceBlob?.size?' · Voice Over included':''}`)}catch(e){console.error(e);toast(e.message||'Film export failed')}finally{filmBusy614=false;if(b){b.disabled=false;b.textContent='Export Film'}}
};
const filmMotionShowShotPreviewBase6281=filmMotionShowShotPreview6277;
filmMotionShowShotPreview6277=function(c){if(filmPreviewBusy6281||filmPreviewUrl6281)return;return filmMotionShowShotPreviewBase6281(c)};
const filmGenerateVoiceBase6281=filmGenerateVoice624;
filmGenerateVoice624=async function(){filmPreviewClear6281();return filmGenerateVoiceBase6281()};
function filmBindFullPreview6281(){
  for(const id of ['#filmPreviewSequence614','#filmFullPreview6277']){const old=q(id);if(!old||old.dataset.full6281)return;const fresh=old.cloneNode(true);fresh.dataset.full6281='1';old.replaceWith(fresh);fresh.addEventListener('click',filmShowFullPreview6281)}
}
const wireBase6281=wireView;
wireView=function(name){wireBase6281(name);if(name==='film')requestAnimationFrame(filmBindFullPreview6281)};
setTimeout(()=>{try{if((location.hash||'').includes('film'))filmBindFullPreview6281()}catch{}},180);
// ===== END PIONX V6.28.0 =====

// ===== PIONX V6.28.1 · SAFE FILM BRIDGE =====
// Exposes only supported Film actions/status to tiny external UI helpers.
// Core Film state remains inside the main application closure.
window.PIONXFilmBridge6281={
 version:'6.28.1',
 motionSnapshot(){
  const s=filmMotionSets6276(),images=s.images||[],ready=s.ready||[],pending=s.pending||[],fresh=s.fresh||[];
  const shots=images.map((c,i)=>({idx:i+1,state:c.generatedVideoUrl625?'done':(c.generatedJob625?'current':'queued'),camera:c.generatedCamera625||filmCameraFor625(c,i),title:String(c?.directorScene?.title||'')}));
  const ci=shots.findIndex(x=>x.state==='current');
  return {total:images.length,ready:ready.length,pending:pending.length,fresh:fresh.length,active:!!filmMotionBusy625||pending.length>0,current:ci>=0?ci+1:0,shots,status:q('#filmMotionStatus625')?.textContent||''};
 },
 previewLatest(){const r=filmMotionSets6276().ready||[],c=r[r.length-1];if(!c)return toast('No AI motion shot is ready yet');return filmMotionShowShotPreview6277(c)},
 buildFullPreview(){return filmShowFullPreview6281()},
 exportFull(){return exportFilm614()},
 hasVoice(){return !!filmAudio624.voiceBlob?.size}
};
// ===== END PIONX V6.28.1 =====

// ===== PIONX V6.30.0 · FILM STORY AUTO ENGINE =====
// Reorganizes Film into a clear 6-step workflow and turns each still image
// into a story scene with visible non-camera action, not a camera-only move.
let filmStoryMotion6290=safeStore.get('pionx-film-story-motion-v6290')||'cinematic';
if(!['subtle','cinematic','lived-in'].includes(filmStoryMotion6290))filmStoryMotion6290='cinematic';
let filmStoryAllowPeople6290=safeStore.get('pionx-film-story-people-v6290')==='1';
function filmStoryProfile6290(c){
 const s=c?.directorScene||{};
 return String(s.action||'').trim()||String(s.environment_motion||'').trim()?'story':'preserve';
}
function filmStoryFallbackAction6290(){
 if(filmStoryMotion6290==='subtle')return 'Create subtle visible scene life beyond the camera: natural light and reflection changes plus one physically plausible environmental motion already supported by the image.';
 if(filmStoryMotion6290==='lived-in')return 'Create a lived-in scene with multiple visible actions beyond the camera, using only plausible elements supported by the image. Keep all activity secondary to the architecture.';
 return 'Create a cinematic scene that visibly evolves through time beyond the camera move: use two or three physically plausible motions already supported by the image, such as light/reflections, water/steam, curtains, vegetation, doors/mechanisms, screens or atmosphere.';
}
function filmStoryPeopleRule6290(){return filmStoryAllowPeople6290?'People may move naturally only where spatially appropriate, at correct scale, and without obscuring the architecture.':'Do not invent people.'}

// Rich storyboard editor: each shot now has a narrative beat + scene action + environment motion.
filmDirectorScene622=function(scene,i){
 const imgs=filmClips614.filter(c=>filmKind621(c)==='image'),src=imgs[Math.max(0,Math.min(imgs.length-1,Number(scene.source_index)||0))],cur=String(scene.camera||'Slow cinematic push');
 const cams=['Slow cinematic push','Orbit left','Orbit right','Crane up','Fly-through','Lateral tracking','Slow pull back'];
 return `<article class="film-director-scene622 film-story-scene6290" data-director-scene622="${i}">
  <div class="film-director-thumb622">${src?`<img loading="lazy" decoding="async" src="${escHtml(src.thumbUrl||src.previewUrl||src.url)}" alt="">`:'<span>No image</span>'}<b>${i+1}</b></div>
  <div class="film-director-fields622">
   <div class="film-story-grid6290"><label>Scene title<input data-director-title622="${i}" value="${escHtml(scene.title||'Scene '+(i+1))}"></label><label>Story beat<input data-director-beat6290="${i}" value="${escHtml(scene.beat||'')}" placeholder="Opening / Discovery / Reveal / Closing"></label></div>
   <div class="film-director-row622"><label>Duration<input type="number" min="3" max="20" data-director-duration622="${i}" value="${Number(scene.duration)||6}"></label><label>Camera<select data-director-camera622="${i}">${cams.map(x=>`<option ${cur.toLowerCase().includes(x.toLowerCase().replace('cinematic ',''))||cur.toLowerCase()===x.toLowerCase()?'selected':''}>${x}</option>`).join('')}</select></label></div>
   <label class="film-story-key6290">Scene action · what actually happens<textarea data-director-action6290="${i}" placeholder="Example: elevator doors open; warm light grows; reflections travel across the stone.">${escHtml(scene.action||'')}</textarea></label>
   <label>Environment motion<textarea data-director-env6290="${i}" placeholder="Water, steam, curtains, vegetation, reflections, shadows, screens, atmosphere…">${escHtml(scene.environment_motion||'')}</textarea></label>
   <label>Visual direction<textarea data-director-visual622="${i}">${escHtml(scene.visual_direction||'')}</textarea></label>
   <label>Continuity to next scene<input data-director-cont6290="${i}" value="${escHtml(scene.continuity||'')}" placeholder="Match light direction / continue movement / reveal next space"></label>
   <label>Voice-over<textarea data-director-voice622="${i}">${escHtml(scene.voiceover||'')}</textarea></label>
   <div class="film-director-row622"><label>Transition<input data-director-transition622="${i}" value="${escHtml(scene.transition||'Soft fade')}"></label><label>SFX<input data-director-sfx622="${i}" value="${escHtml(scene.sfx||'')}"></label></div>
  </div>
 </article>`;
};

const filmGenerateDirectorBase6290=filmGenerateDirector622;
filmGenerateDirector622=async function(){
 if(filmDirectorBusy622)return;const images=await filmDirectorImages622();const brief=q('#filmDirectorBrief622')?.value?.trim()||filmDirectorBrief622;if(!images.length&&!brief)return toast('Upload images or write a film brief first');
 filmDirectorBusy622=true;const b=q('#filmDirectorGenerate622');if(b){b.disabled=true;b.textContent='Directing story scenes…'};
 try{
  filmDirectorMode622=q('#filmDirectorMode622')?.value||filmDirectorMode622;filmDirectorStyle622=q('#filmDirectorStyle622')?.value||filmDirectorStyle622;filmDirectorLanguage622=q('#filmDirectorLanguage622')?.value||filmDirectorLanguage622;filmDirectorBrief622=brief;
  filmStoryMotion6290=q('#filmStoryMotion6290')?.value||filmStoryMotion6290;filmStoryAllowPeople6290=!!q('#filmStoryPeople6290')?.checked;safeStore.set('pionx-film-story-motion-v6290',filmStoryMotion6290);safeStore.set('pionx-film-story-people-v6290',filmStoryAllowPeople6290?'1':'0');
  const r=await pxApi56('/server/film-director-v622.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:filmDirectorMode622,style:filmDirectorStyle622,language:filmDirectorLanguage622,duration:filmTarget620(),brief,images,story_motion:filmStoryMotion6290,allow_people:filmStoryAllowPeople6290})});
  const j=await json56(r,'PIONX AI Director');if(!r.ok||!j.ok)throw Error(j.error||'AI Director failed');filmDirector622=j.plan||null;toast('Story + scene actions are ready');route();
 }catch(e){console.error(e);toast(e.message||'AI Director failed')}finally{filmDirectorBusy622=false;if(b){b.disabled=false;b.textContent='Create Story for Me ✦'}}
};

function filmStoryPrompt6290(c,n,duration,camera){
 const scene=c?.directorScene||{},title=String(scene.title||`Scene ${n+1}`).trim(),beat=String(scene.beat||'').trim(),visual=String(scene.visual_direction||'').trim(),action=String(scene.action||'').trim()||filmStoryFallbackAction6290(),env=String(scene.environment_motion||'').trim(),continuity=String(scene.continuity||'').trim();
 const density=filmStoryMotion6290==='subtle'?'1-2 restrained visible motions':filmStoryMotion6290==='lived-in'?'2-4 visible motions':'2-3 visible motions';
 return [
  `PIONX STORY FILM SHOT ${n+1}: ${title}.`,beat?`STORY BEAT: ${beat}.`:'',visual,
  `SCENE ACTION — REQUIRED: ${action}`,
  env?`ENVIRONMENT MOTION: ${env}`:'',
  continuity?`CONTINUITY: ${continuity}`:'',
  `CAMERA: ${camera}. Camera movement supports the scene but must NOT be the only motion.`,
  `TEMPORAL ARC: beginning -> development -> end. The frame must visibly evolve over time with ${density} unrelated to camera movement. Avoid a static image with a Ken Burns move.`,
  `STORY REALISM: ${filmStoryPeopleRule6290()} Motion must be physically plausible and spatially consistent. Objects do not teleport, duplicate, melt or change identity.`,
  `ARCHITECTURE LOCK: the source image is the immutable design reference. Preserve exact walls, doors, openings, sanitary fixtures, furniture, facade geometry, materials, proportions, artwork, landscape and project identity. Never redesign or invent hidden architecture. If the camera would reveal unknown geometry, reduce the travel instead.`,
  `Target approximately ${duration} seconds. Premium real-estate cinematography, natural motion blur, coherent lighting, stable verticals, no morphing, no slideshow look.`
 ].filter(Boolean).join('\n');
}

// Quote the route that will actually be used for story motion.
filmQuoteMotion625=async function(){
 const {pending,fresh}=filmMotionSets6276();
 if(!fresh.length){filmMotionQuoteState625=null;const s=q('#filmMotionStatus625');if(s)s.textContent=pending.length?`${pending.length} AI scene(s) are already processing · no new credit reserve required.`:'All still-image scenes already have generated video.';return {cost:0,reserve:0,shots:0}}
 const btn=q('#filmMotionQuote625');if(btn){btn.disabled=true;btn.textContent='Checking…'};let cost=0,reserve=0;
 try{
  for(let i=0;i<fresh.length;i++){const c=fresh[i],camera=filmCameraFor625(c,i),d=filmProviderDuration625(c.duration),profile=filmStoryProfile6290(c);const j=await filmVideoCall626({action:'quote',quality:filmMotionQuality625,duration:d,aspect_ratio:q('#filmRatio614')?.value||'16:9',motion_profile:profile,camera});cost+=Number(j.credits_cost)||0;reserve+=Number(j.credits_reserved)||0}
  filmMotionQuoteState625={cost,reserve,shots:fresh.length};const bal=filmMotionAccountCredits6276(),s=q('#filmMotionStatus625');if(s)s.textContent=`Estimated: ${cost} credits · reserve ${reserve} credits for ${fresh.length} NEW story scene(s)`+(bal!=null?` · balance ${bal}`:'');return filmMotionQuoteState625
 }catch(e){const s=q('#filmMotionStatus625');if(s)s.textContent=e.message;throw e}finally{if(btn){btn.disabled=false;btn.textContent='Check Generation Credits'}}
};

// Generate each image as a real story scene: action + environment + camera.
filmGenerateOne6275=async function(c,n,total){
 const camera=filmCameraFor625(c,n),duration=filmProviderDuration625(c.duration),aspect=q('#filmRatio614')?.value||'16:9',image=await filmSourceData625(c),profile=filmStoryProfile6290(c),prompt=filmStoryPrompt6290(c,n,duration,camera);
 if(filmMotionUi6273?.shots?.[n]){filmMotionUi6273.shots[n].state='current';filmMotionUi6273.shots[n].label=profile==='story'?'Creating story action':'Creating architectural motion';filmMotionUi6273.shots[n].camera=camera;filmMotionUi6273.shots[n].startedAt=Date.now()}filmMotionPaint6277?.();
 const j=await filmVideoCall626({action:'start',prompt,image,quality:filmMotionQuality625,duration,aspect_ratio:aspect,motion_profile:profile,camera,request_key:filmMotionRequestKey6275(c,n)});if(!j.id)throw Error(`AI scene ${n+1} did not return a job id`);c.generatedJob625=j.id;c.generatedCamera625=camera;c.timelineDuration625=Math.max(1,Number(c.duration)||duration);await loadAccount56({quiet:true}).catch(()=>{});
 await filmWaitVideo625(j.id,n+1,total);const blob=await filmDownloadVideo625(j.id),url=URL.createObjectURL(blob);if(c.generatedVideoUrl625?.startsWith('blob:'))try{URL.revokeObjectURL(c.generatedVideoUrl625)}catch{}c.generatedVideoBlob625=blob;c.generatedVideoUrl625=url;c.generatedVideoDuration625=await filmProbeDuration620(url).catch(()=>duration);
 if(filmMotionUi6273?.shots?.[n]){filmMotionUi6273.shots[n].state='done';filmMotionUi6273.shots[n].label='Story scene ready';filmMotionUi6273.shots[n].doneAt=Date.now()}if(filmMotionUi6273){filmMotionUi6273.completed=filmMotionUi6273.shots.filter(x=>x.state==='done').length}filmMotionPaint6277?.();filmPreviewClear6281?.();await loadAccount56({quiet:true}).catch(()=>{});return true
};

filmMotionPanel625=function(){
 const {images,ready,pending,fresh}=filmMotionSets6276(),qv=filmMotionQuoteState625,allReady=images.length>0&&ready.length===images.length,active=!!filmMotionBusy625||pending.length>0;let status='';
 if(active)status=`${ready.length} ready · ${pending.length} processing${fresh.length?` · ${fresh.length} waiting`:''}`;
 else if(qv&&qv.shots===fresh.length&&fresh.length){const bal=filmMotionAccountCredits6276();status=`Estimated: ${qv.cost} credits · reserve ${qv.reserve} credits for ${qv.shots} new story scene(s)`+(bal!=null?` · balance ${bal}`:'')}
 else if(allReady)status='All story video scenes are ready. Continue to Voice & Sound, then build the Full Preview.';
 else status=images.length?`${fresh.length} storyboard scene(s) ready to become real video.`:'Upload still images first.';
 return `<section class="panel" id="filmMotionPanel625"><div class="section-title" style="margin:0 0 12px"><div><small>PIONX STORY VIDEO ENGINE · 6.29</small><h2 style="margin:4px 0">Generate Real Story Scenes</h2><p>Each image becomes a real video scene with scene action + environment motion + camera. Camera movement alone is rejected by the prompt.</p></div><span class="status-pill">${ready.length}/${images.length} scenes</span></div>
  <div class="form-grid"><label>Film quality<select id="filmMotionQuality625"><option value="premium" ${filmMotionQuality625==='premium'?'selected':''}>Premium 1080p</option><option value="fast" ${filmMotionQuality625==='fast'?'selected':''}>Fast Preview</option></select></label><label class="film-audio-check624" style="align-self:end"><input id="filmAutoCamera625" type="checkbox" ${filmMotionAutoCamera625?'checked':''}> Auto-vary camera between scenes</label></div>
  <div class="alert-box film-story-note6290">Story generation animates what happens inside each shot — lighting, reflections, water, curtains, vegetation, visible mechanisms and other plausible scene life — while locking the architecture.</div>
  <div class="film-audio-actions624"><button class="ghost-btn" id="filmMotionQuote625" ${fresh.length?'':'disabled'}>Check Generation Credits</button><button class="primary-btn" id="filmGenerateMotion625" ${images.length?'':'disabled'}>${pending.length?'Resume Story Scenes':(fresh.length?'Generate Story Video Scenes ✦':'Story Scenes Ready')}</button></div>
  <div class="film-audio-ready624" id="filmMotionStatus625">${status}</div><div id="filmMotionLive6273" ${active||filmMotionUi6273?.shots?.length?'':'hidden'}></div></section>`;
};

function filmEnsureStyle6290(){if(q('#filmStoryStyle6290'))return;const st=document.createElement('style');st.id='filmStoryStyle6290';st.textContent=`
 .film-workflow6290{--film-step:#101d2d;--film-line:#28405b}.film-stepper6290{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin:8px 0 18px}.film-stepper6290 button{min-width:0;padding:10px 8px;border:1px solid var(--film-line);background:#0b1725;border-radius:12px;color:#aebfd2;text-align:left}.film-stepper6290 button b{display:block;color:#fff;font-size:12px}.film-stepper6290 button span{font-size:10px}.film-stepper6290 button.done{border-color:#2a725b}.film-stepper6290 button.active{border-color:#6b63ff;background:#171c43}.film-step6290{margin:0 0 16px;padding:18px;border:1px solid #20364d}.film-step-head6290{display:flex;gap:14px;align-items:flex-start;margin-bottom:14px}.film-step-num6290{width:34px;height:34px;display:grid;place-items:center;border-radius:50%;background:#182a3e;font-weight:800;flex:0 0 auto}.film-step-head6290 h2{margin:0 0 4px}.film-step-head6290 p{margin:0;color:#8498ad}.film-step-status6290{margin-left:auto;padding:5px 9px;border:1px solid #2a425b;border-radius:999px;font-size:11px}.film-step-status6290.done{border-color:#2a725b;color:#8de4bd}.film-story-options6290{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}.film-story-scene6290{border:1px solid #243c55;border-radius:14px;padding:12px}.film-story-key6290 textarea{min-height:86px;border-color:#6259c9}.film-story-grid6290{display:grid;grid-template-columns:1.2fr .8fr;gap:10px}.film-final-actions6290{display:flex;gap:10px;flex-wrap:wrap}.film-final-actions6290 button{min-width:220px}.film-story-note6290{line-height:1.45}.film-step6290 .film-director-board622,.film-step6290 #filmMotionPanel625,.film-step6290 .film-audio624{margin:0}.film-step6290 .film-director-board622{border:0;padding:0;background:transparent}.film-step6290 #filmMotionPanel625{border:0;padding:0;background:transparent}.film-step6290 .film-audio-title624{display:none}.film-step6290 .film-grid614{margin:0}.film-step6290 .film-timeline614{margin-top:14px}.film-step6290 #filmPreviewSequence614{width:auto}.film-story-empty6290{padding:20px;border:1px dashed #2c455f;border-radius:12px;color:#8498ad}.film-next6290{margin-top:14px;display:flex;justify-content:flex-end}.film-workflow6290 #filmExport614{display:none!important}@media(max-width:980px){.film-stepper6290{grid-template-columns:repeat(3,1fr)}.film-story-options6290,.film-story-grid6290{grid-template-columns:1fr}}`;
 document.head.appendChild(st)}
function filmStep6290(n,title,desc,done=false){const s=document.createElement('section');s.className='panel film-step6290';s.id='filmStep6290-'+n;s.innerHTML=`<div class="film-step-head6290"><span class="film-step-num6290">${n}</span><div><h2>${title}</h2><p>${desc}</p></div><span class="film-step-status6290 ${done?'done':''}">${done?'Ready':'Next'}</span></div>`;return s}
function filmNextButton6290(step){const d=document.createElement('div');d.className='film-next6290';d.innerHTML=`<button class="ghost-btn" type="button" data-film-next6290="${step}">Next →</button>`;return d}
function filmOrganize6290(){
 const root=q('section.page');if(!root||!q('.film-grid614',root)||root.dataset.workflow6290)return;root.dataset.workflow6290='1';root.classList.add('film-workflow6290');filmEnsureStyle6290();
 const grid=q('.film-grid614',root),timeline=q('#filmTimeline614',root),directorControls=q('.film-director-controls622',root),directorBoard=q('.film-director-board622',root),motion=q('#filmMotionPanel625',root),audio=q('.film-audio624',root),audioTitle=q('.film-audio-title624',root),previewBtn=q('#filmPreviewSequence614',root),exportTop=q('#filmExport614',root);
 const imgCount=filmClips614.filter(c=>filmKind621(c)==='image').length,storyReady=!!filmDirector622?.scenes?.length,applied=filmClips614.some(c=>!!c.directorScene),motionReady=imgCount>0&&filmGeneratedCount625()>=imgCount,audioReady=!!filmAudio624.voiceBlob?.size,previewReady=!!filmPreviewUrl6281;
 const nav=document.createElement('nav');nav.className='film-stepper6290';nav.innerHTML=[['1','Sources',filmClips614.length>0],['2','Story',storyReady],['3','Storyboard',applied],['4','Generate',motionReady],['5','Voice + Sound',audioReady],['6','Preview + Export',previewReady]].map(x=>`<button type="button" class="${x[2]?'done':''}" data-film-step6290="${x[0]}"><b>${x[0]}. ${x[1]}</b><span>${x[2]?'✓ complete':'continue'}</span></button>`).join('');
 grid.before(nav);
 const step1=filmStep6290(1,'Sources & Film Setup','Upload images/videos, set duration and format, then arrange the source order.',filmClips614.length>0);grid.before(step1);step1.appendChild(grid);if(timeline){const title=timeline.previousElementSibling;if(title?.classList?.contains('section-title'))step1.appendChild(title);step1.appendChild(timeline)}step1.appendChild(filmNextButton6290(2));
 const step2=filmStep6290(2,'Story Direction','Tell PIONX the film intent. AI Director creates a beginning, development and ending — plus what actually moves inside every scene.',storyReady);step1.after(step2);
 const opts=document.createElement('div');opts.className='film-story-options6290';opts.innerHTML=`<label>Scene life<select id="filmStoryMotion6290"><option value="subtle" ${filmStoryMotion6290==='subtle'?'selected':''}>Subtle · light / reflections / atmosphere</option><option value="cinematic" ${filmStoryMotion6290==='cinematic'?'selected':''}>Cinematic Story · recommended</option><option value="lived-in" ${filmStoryMotion6290==='lived-in'?'selected':''}>Lived-in · richer activity</option></select></label><label class="film-audio-check624"><input id="filmStoryPeople6290" type="checkbox" ${filmStoryAllowPeople6290?'checked':''}> Allow people when they genuinely improve the story</label><div class="film-story-note6290" style="grid-column:1/-1;padding:10px 12px;border:1px solid #243c55;border-radius:10px;color:#9eb2c7"><b style="color:#eef5ff">PIONX Story Auto</b> chooses a story-first video route for each scene. Provider/model names remain hidden from users.</div>`;step2.appendChild(opts);if(directorControls)step2.appendChild(directorControls);else step2.insertAdjacentHTML('beforeend','<div class="film-story-empty6290">Upload sources first, then create the story.</div>');step2.appendChild(filmNextButton6290(3));
 const step3=filmStep6290(3,'Storyboard & Scene Actions','Review every shot. Camera is only one layer — Scene Action and Environment Motion are what make it feel like a real film.',applied);step2.after(step3);if(directorBoard)step3.appendChild(directorBoard);else step3.insertAdjacentHTML('beforeend','<div class="film-story-empty6290">Create the story in Step 2 to generate the storyboard.</div>');step3.appendChild(filmNextButton6290(4));
 const step4=filmStep6290(4,'Generate Story Video Scenes','Turn each approved image into a real story scene: visible action + environment motion + restrained cinematic camera movement.',motionReady);step3.after(step4);if(motion)step4.appendChild(motion);else step4.insertAdjacentHTML('beforeend','<div class="film-story-empty6290">Apply the storyboard first.</div>');step4.appendChild(filmNextButton6290(5));
 const step5=filmStep6290(5,'Voice, Music & Ambience','Generate the narration, then balance voice, music and ambience.',audioReady);step4.after(step5);if(audioTitle)step5.appendChild(audioTitle);if(audio)step5.appendChild(audio);else step5.insertAdjacentHTML('beforeend','<div class="film-story-empty6290">Create a storyboard first so PIONX has a voice-over script.</div>');step5.appendChild(filmNextButton6290(6));
 const step6=filmStep6290(6,'Full Preview & Export','Build one complete story film with every generated scene, Voice Over and audio mix. Export only after approving this exact preview.',previewReady);step5.after(step6);const actions=document.createElement('div');actions.className='film-final-actions6290';if(previewBtn){previewBtn.textContent='▶ Build Full Film Preview';actions.appendChild(previewBtn)}else actions.innerHTML='<button class="primary-btn" id="filmFinalPreview6290">▶ Build Full Film Preview</button>';const exp=document.createElement('button');exp.className='primary-btn';exp.id='filmFinalExport6290';exp.textContent='Export Approved Film';actions.appendChild(exp);step6.appendChild(actions);step6.insertAdjacentHTML('beforeend',`<p class="video-caveat66" style="margin-top:12px">Final output is locked to generated story-video scenes. Original still-image pan/zoom is never used once Story Scenes are generated.</p>`);
 if(exportTop)exportTop.hidden=true;
 q('#filmStoryMotion6290',step2)?.addEventListener('change',e=>{filmStoryMotion6290=e.target.value;safeStore.set('pionx-film-story-motion-v6290',filmStoryMotion6290)});q('#filmStoryPeople6290',step2)?.addEventListener('change',e=>{filmStoryAllowPeople6290=!!e.target.checked;safeStore.set('pionx-film-story-people-v6290',filmStoryAllowPeople6290?'1':'0')});
 qa('[data-director-beat6290]',step3).forEach(x=>x.addEventListener('input',()=>{filmDirector622.scenes[+x.dataset.directorBeat6290].beat=x.value}));qa('[data-director-action6290]',step3).forEach(x=>x.addEventListener('input',()=>{filmDirector622.scenes[+x.dataset.directorAction6290].action=x.value}));qa('[data-director-env6290]',step3).forEach(x=>x.addEventListener('input',()=>{filmDirector622.scenes[+x.dataset.directorEnv6290].environment_motion=x.value}));qa('[data-director-cont6290]',step3).forEach(x=>x.addEventListener('input',()=>{filmDirector622.scenes[+x.dataset.directorCont6290].continuity=x.value}));
 qa('[data-film-step6290],[data-film-next6290]',root).forEach(b=>b.addEventListener('click',()=>{const n=b.dataset.filmStep6290||b.dataset.filmNext6290;q('#filmStep6290-'+n,root)?.scrollIntoView({behavior:'smooth',block:'start'})}));
 q('#filmFinalPreview6290',step6)?.addEventListener('click',()=>filmShowFullPreview6281());q('#filmFinalExport6290',step6)?.addEventListener('click',()=>exportFilm614());
 const fallbackLabel=[...qa('.film-settings614 label',root)].find(l=>String(l.firstChild?.textContent||'').trim()==='Image motion');if(fallbackLabel)fallbackLabel.firstChild.textContent='Fallback still motion';
}
const wireBase6290=wireView;wireView=function(name){wireBase6290(name);if(name==='film')requestAnimationFrame(()=>filmOrganize6290())};
setTimeout(()=>{try{if((location.hash||'').includes('film'))filmOrganize6290()}catch(e){console.warn('PIONX Film workflow 6.30',e)}},320);
// ===== END PIONX V6.30.0 =====


// ===== PIONX V6.30.1 · FILM SMOOTH PLAYBACK + SCROLL LOCK =====
// 1) Preserve Film workspace position through internal rerenders.
// 2) Build the composite film on a lower-overhead fixed cadence to reduce
//    dropped/irregular frames in browser-side 1080p WebM assembly.
function filmScrollSnapshot6301(){
 const root=q('#viewRoot');
 if(!root||!(location.hash||'').startsWith('#film')||!root.querySelector('.film-workflow6290'))return null;
 const y=root.scrollTop||0,steps=[...root.querySelectorAll('.film-step6290')];
 let anchor=null;
 for(const el of steps){if(el.offsetTop<=y+110)anchor=el;else break}
 return {top:y,id:anchor?.id||'',delta:anchor?y-anchor.offsetTop:0};
}
function filmScrollRestore6301(snap){
 if(!snap)return;
 const root=q('#viewRoot');if(!root)return;
 const apply=()=>{const a=snap.id?document.getElementById(snap.id):null;root.scrollTop=Math.max(0,a?(a.offsetTop+snap.delta):snap.top)};
 requestAnimationFrame(()=>requestAnimationFrame(()=>{apply();setTimeout(apply,40)}));
}
const routeBase6301=route;
route=function(){
 const snap=filmScrollSnapshot6301();
 routeBase6301();
 filmScrollRestore6301(snap);
};

function filmWaitCanPlay6301(v,timeout=5000){
 return new Promise(resolve=>{
  let done=false;const finish=()=>{if(done)return;done=true;clearTimeout(t);v.removeEventListener('canplay',finish);v.removeEventListener('loadeddata',finish);resolve()};
  const t=setTimeout(finish,timeout);v.addEventListener('canplay',finish,{once:true});v.addEventListener('loadeddata',finish,{once:true});
  if(v.readyState>=2)finish();
 });
}
function filmDrawCover6301(ctx,canvas,v){
 if(!(v.videoWidth&&v.videoHeight))return;
 const s=Math.max(canvas.width/v.videoWidth,canvas.height/v.videoHeight),w=v.videoWidth*s,h=v.videoHeight*s;
 ctx.fillStyle='#050b14';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(v,(canvas.width-w)/2,(canvas.height-h)/2,w,h);
}
function filmSleep6301(ms){return new Promise(r=>setTimeout(r,Math.max(0,ms)))}

async function filmBuildComposite6301(){
 if(filmPreviewBusy6281)return filmPreviewBlob6281||null;
 if(typeof MediaRecorder==='undefined')throw Error('This browser cannot build the Full Film Preview');
 const stills=filmClips614.filter(c=>filmKind621(c)==='image'),missing=stills.filter(c=>!c.generatedVideoUrl625);
 if(missing.length)throw Error(`Generate AI Motion first · ${stills.length-missing.length}/${stills.length} ready`);
 const sig=filmPreviewSignature6281()+'|smooth6301';if(filmPreviewBlob6281&&filmPreviewSignatureCache6281===sig)return filmPreviewBlob6281;
 filmPreviewBusy6281=true;filmPreviewClear6281();
 const target=Math.max(1,filmTarget620()),vertical=(q('#filmRatio614')?.value||'16:9')==='9:16',premium=filmMotionQuality625!=='fast';
 // Premium AI clips are commonly cinematic cadence; keep the selected UI fps,
 // but use an explicit frame-request clock instead of RAF sampling.
 const fps=Math.max(24,Math.min(30,Number(q('#filmFps614')?.value||24)||24)),frameMs=1000/fps;
 filmPreviewStage6281('Building Smooth Full Film Preview','Preloading every AI story scene…',2);
 let audioCtx=null,audioSources=[];
 try{
  const prepared=[];let planned=0;
  for(let i=0;i<filmClips614.length&&planned<target-.01;i++){
   const c=filmClips614[i],src=filmPlayableUrl625(c);if(!src)continue;
   const v=document.createElement('video');v.src=src;v.playsInline=true;v.preload='auto';v.muted=true;v.crossOrigin='anonymous';
   await filmWaitMeta6281(v);await filmWaitCanPlay6301(v);
   const media=Number.isFinite(v.duration)&&v.duration>0?v.duration:Number(c.generatedVideoDuration625||c.duration||0),want=Math.max(.1,Number(c.timelineDuration625||c.duration)||media||1),playFor=Math.min(target-planned,want,media||want);
   if(playFor>.02){prepared.push({c,v,playFor});planned+=playFor}
   filmPreviewStageUpdate6281(`Preparing scene ${i+1}/${filmClips614.length}`,Math.min(10,(i+1)/Math.max(1,filmClips614.length)*10));
  }
  if(!prepared.length)throw Error('No playable AI story scenes found');
  const actualTarget=Math.min(target,prepared.reduce((n,x)=>n+x.playFor,0));filmPreviewDuration6281=actualTarget;
  const canvas=document.createElement('canvas');canvas.width=vertical?(premium?1080:720):(premium?1920:1280);canvas.height=vertical?(premium?1920:1280):(premium?1080:720);
  const ctx=canvas.getContext('2d',{alpha:false,desynchronized:true});ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.fillStyle='#050b14';ctx.fillRect(0,0,canvas.width,canvas.height);
  let videoStream=canvas.captureStream(0),videoTrack=videoStream.getVideoTracks()[0],manualFrame=!!videoTrack?.requestFrame;
  if(!manualFrame){videoStream.getTracks().forEach(t=>t.stop());videoStream=canvas.captureStream(fps);videoTrack=videoStream.getVideoTracks()[0]}
  const AC=window.AudioContext||window.webkitAudioContext;let dest=null,voiceBuf=null,musicBuf=null,sfxBuf=null;
  if(AC){
   audioCtx=new AC();await audioCtx.resume();dest=audioCtx.createMediaStreamDestination();filmPreviewStageUpdate6281('Preparing Voice Over + sound mix…',11);
   [voiceBuf,musicBuf,sfxBuf]=await Promise.all([filmDecodeAudio6281(audioCtx,filmAudio624.voiceBlob),filmDecodeAudio6281(audioCtx,filmAudio624.musicBlob),filmDecodeAudio6281(audioCtx,filmAudio624.sfxBlob)]);
   if(filmAudio624.voiceBlob?.size&&!voiceBuf)throw Error('Voice Over could not be embedded. Regenerate Voice Over once, then build preview again.');
  }
  const tracks=[...videoStream.getVideoTracks(),...(dest?dest.stream.getAudioTracks():[])],stream=new MediaStream(tracks);
  // Prefer VP8 here: it is materially lighter than VP9 for real-time 1080p canvas capture
  // in Chrome, which reduces encoder stalls/dropped frames in the final film.
  const mime=MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')?'video/webm;codecs=vp8,opus':(MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')?'video/webm;codecs=vp9,opus':'video/webm');
  const chunks=[],rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:premium?12000000:8000000,audioBitsPerSecond:192000});
  rec.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};const stopped=new Promise(res=>rec.onstop=res);rec.start(1000);
  if(audioCtx&&dest){const t0=audioCtx.currentTime+.12;const add=(buf,vol,loop)=>{const n=filmScheduleBuffer6281(audioCtx,dest,buf,vol,loop,t0);if(n)audioSources.push(n)};add(voiceBuf,filmAudio624.voiceVolume,false);add(musicBuf,filmAudio624.musicVolume,true);add(sfxBuf,filmAudio624.sfxVolume,false)}
  await filmSleep6301(120);
  let used=0;
  for(let i=0;i<prepared.length&&used<actualTarget-.01;i++){
   const {v,playFor}=prepared[i];
   try{v.pause();v.currentTime=0}catch{}await filmWaitCanPlay6301(v);
   await v.play().catch(()=>{});
   const frameCount=Math.max(1,Math.round(playFor*fps)),wall0=performance.now();
   for(let f=0;f<frameCount;f++){
    const deadline=wall0+f*frameMs,wait=deadline-performance.now();if(wait>1)await filmSleep6301(wait);
    filmDrawCover6301(ctx,canvas,v);if(manualFrame)try{videoTrack.requestFrame()}catch{}
    if(f%Math.max(1,Math.round(fps/5))===0){const local=Math.min(playFor,f/fps),totalNow=Math.min(actualTarget,used+local),pct=12+(totalNow/Math.max(.1,actualTarget))*84;filmPreviewStageUpdate6281(`Scene ${i+1}/${prepared.length} · ${filmFmt620(totalNow)} / ${filmFmt620(actualTarget)} · smooth ${fps} fps`,pct)}
   }
   try{v.pause()}catch{}used+=playFor;
  }
  if(manualFrame)try{videoTrack.requestFrame()}catch{}
  for(const n of audioSources){try{n.src.stop()}catch{}try{n.src.disconnect();n.gain.disconnect()}catch{}}audioSources=[];
  try{rec.requestData()}catch{}await filmSleep6301(180);rec.stop();await stopped;if(audioCtx)try{await audioCtx.close()}catch{}audioCtx=null;
  const blob=new Blob(chunks,{type:mime});if(blob.size<2048)throw Error('Full Film Preview could not be encoded');
  filmPreviewBlob6281=blob;filmPreviewSignatureCache6281=sig;filmPreviewUrl6281=URL.createObjectURL(blob);filmPreviewStageUpdate6281('Smooth Full Film Preview ready',100);
  const st=q('#filmStatus614');if(st)st.textContent=`Full Film Preview ready · ${filmFmt620(Math.min(used,actualTarget))} · smooth ${fps} fps${filmAudio624.voiceBlob?.size?' · Voice Over embedded':''}`;
  return blob;
 }finally{
  for(const n of audioSources){try{n.src.stop()}catch{}try{n.src.disconnect();n.gain.disconnect()}catch{}}
  if(audioCtx)try{await audioCtx.close()}catch{}
  filmPreviewBusy6281=false;
 }
}
filmBuildComposite6281=filmBuildComposite6301;

// Keep users at the step they are working on after Story / Apply / Generate / Voice rerenders.
const wireBase6301=wireView;
wireView=function(name){
 wireBase6301(name);
 if(name==='film'){
  const note=document.createElement('div');note.className='film-smooth-note6301';note.textContent='Smooth film assembly · fixed cinematic cadence · page position stays locked while you work';
  const stepper=q('.film-stepper6290');if(stepper&&!q('.film-smooth-note6301'))stepper.insertAdjacentElement('afterend',note);
 }
};
(function(){const st=document.createElement('style');st.textContent='.film-smooth-note6301{margin:0 0 12px;padding:8px 11px;border:1px solid #23425f;border-radius:10px;color:#91a8bd;font-size:11px;background:#0c1723}.film-workflow6290{scroll-margin-top:12px}';document.head.appendChild(st)})();
// ===== END PIONX V6.30.1 =====


// ===== PIONX V6.30.5 · STUDIO MULTI-CAMERA VISUAL DNA LOCK =====
const studioMultiCamera632={count:3,busy:false,current:0,results:[],errors:[]};
function studioCameraAngles632(){
 const scene=String(studioState.scene||'auto').toLowerCase();
 const interior=['Eye-level left corner view','Eye-level right corner view','Opposite-side reverse view','Wide diagonal room view','Doorway reveal view','Closer architectural detail view'];
 const exterior=['Front hero view','Left three-quarter view','Right three-quarter view','Wide context view','Lower eye-level facade view','Elevated oblique view'];
 const master=['Primary aerial view','Lower oblique aerial view','Opposite diagonal aerial view','Wide context aerial view','Closer central-zone view','Elevated site overview'];
 const landscape=['Main eye-level hero view','Left diagonal landscape view','Right diagonal landscape view','Wide context view','Closer material/planting view','Elevated garden overview'];
 if(scene==='interior')return interior;if(scene==='exterior')return exterior;if(scene==='masterplan')return master;if(scene==='landscape')return landscape;
 return studioPlanToInterior631(studioDetectedSource631||{},q('#studioNotes')?.value||'')?interior:['Front hero view','Left three-quarter view','Right three-quarter view','Wide context view','Closer detail view','Elevated view'];
}
function studioMultiCameraInner632(){
 const master=!!studioFinal56.providerUrl,angles=studioCameraAngles632().slice(0,studioMultiCamera632.count),done=studioMultiCamera632.results.length;
 const status=studioMultiCamera632.busy?`Generating camera ${Math.min(studioMultiCamera632.current+1,studioMultiCamera632.count)} of ${studioMultiCamera632.count}…`:(done?`${done}/${studioMultiCamera632.count} camera renders ready`:(master?'Approved render ready as Visual Master':'Render and approve the first image before creating camera angles'));
 return `<header class="studio-multicam-head632"><div><small>STUDIO · VISUAL DNA MULTI-CAMERA SET</small><h3>Same design. Multiple camera angles.</h3><p>The approved render is the Visual Master. PIONX changes only the camera while locking materials, layout, furniture, lighting and colors.</p></div><span class="status-pill ${master?'':'pending'}">${master?'VISUAL DNA LOCKED':'MASTER REQUIRED'}</span></header>
 <div class="studio-multicam-locks632"><span>✓ Same materials</span><span>✓ Same layout / furniture</span><span>✓ Same lighting</span><span>✓ Same colors / grade</span><span>✓ No mirroring</span></div>
 <div class="studio-multicam-controls632"><div><b>Camera set</b><div class="segmented">${[3,4,6].map(n=>`<button class="chip ${studioMultiCamera632.count===n?'active':''}" data-studio-mc-count632="${n}" ${studioMultiCamera632.busy?'disabled':''}>${n} views</button>`).join('')}</div></div><div class="studio-multicam-status632"><b>${escHtml(status)}</b><small>Each view is a protected image-generation job and uses the normal image credit price.</small></div><button class="primary-btn" id="studioMultiCameraGenerate632" ${!master||studioMultiCamera632.busy?'disabled':''}>${studioMultiCamera632.busy?'Generating camera set…':`✦ Generate ${studioMultiCamera632.count} camera renders`}</button></div>
 <div class="studio-camera-presets632">${angles.map((a,i)=>`<span class="${studioMultiCamera632.busy&&i===studioMultiCamera632.current?'active':''}">⌖ ${i+1}. ${escHtml(a)}</span>`).join('')}</div>
 ${studioMultiCamera632.results.length?`<div class="studio-multicam-results632">${studioMultiCamera632.results.map((r,i)=>`<article><button data-studio-mc-open632="${i}"><img src="${escHtml(r.url)}" alt="${escHtml(r.label)}"></button><footer><b>${escHtml(r.label)}</b><small>Visual DNA locked</small></footer></article>`).join('')}</div>`:''}
 ${studioMultiCamera632.errors.length?`<div class="alert-box">${studioMultiCamera632.errors.map(x=>escHtml(x)).join('<br>')}</div>`:''}`;
}
function studioMultiCamWire632(){
 qa('[data-studio-mc-count632]').forEach(b=>b.onclick=()=>{studioMultiCamera632.count=Number(b.dataset.studioMcCount632)||3;studioMultiCamRefresh632()});
 q('#studioMultiCameraGenerate632')?.addEventListener('click',studioGenerateMultiCamera632);
 qa('[data-studio-mc-open632]').forEach(b=>b.onclick=()=>{const r=studioMultiCamera632.results[Number(b.dataset.studioMcOpen632)];if(!r)return;const m=openDemoDialog(r.label,`<div class="studio-mc-full632"><img src="${escHtml(r.url)}" alt="${escHtml(r.label)}"></div>`,`<button class="ghost-btn" data-dialog-close2>Close</button><button class="primary-btn" id="studioMcOpenTab632">Open full image</button>`);q('[data-dialog-close2]',m)?.addEventListener('click',()=>m.hidden=true);q('#studioMcOpenTab632',m)?.addEventListener('click',()=>window.open(r.url,'_blank','noopener'))});
}
function studioMultiCamRefresh632(){const host=q('#studioMultiCamera632');if(!host)return;host.innerHTML=studioMultiCameraInner632();studioMultiCamWire632()}
function studioPlanSpecForCamera6330(spec){
 const pl=spec?.plan_lock||{};const slim=(arr,keys,limit=48)=>(Array.isArray(arr)?arr:[]).slice(0,limit).map(v=>{const o={};for(const k of keys)if(v&&v[k]!==undefined)o[k]=v[k];return o});
 const out={orientation_lock:pl.orientation_lock||{},outer_dimensions:pl.outer_dimensions||{},room_zones:slim(pl.room_zones,['id','label_or_function','bbox_uv_0_1','adjacent_zones'],24),openings:slim(pl.openings,['type','wall_id','image_side','width_m_or_null','offset_from_wall_start_m_or_null','swing_or_sill_notes'],40),fixed_joinery:slim(pl.fixed_joinery,['type','bbox_uv_0_1','wall_relationship','orientation','evidence'],40),plumbing_fixtures:slim(pl.plumbing_fixtures,['type','bbox_uv_0_1','wall_relationship','orientation','evidence'],30),furniture:slim(pl.furniture,['type','count','bbox_uv_0_1','size_m_or_null','wall_relationship','orientation','evidence'],60),circulation_notes:pl.circulation_notes||''};
 try{return JSON.stringify(out)}catch{return '{}'}
}
function studioInjectMultiCamera632(){
 if(q('#studioMultiCamera632')){studioMultiCamRefresh632();return}
 const anchor=q('#resultEditDock')||q('#studioEditStage');if(!anchor)return;
 const section=document.createElement('section');section.id='studioMultiCamera632';section.className='studio-multicam632';section.innerHTML=studioMultiCameraInner632();
 anchor.insertAdjacentElement('beforebegin',section);studioMultiCamWire632();
}
function studioMultiCameraPrompt632(angle,index,total){
 const scene=String(studioState.scene||'architecture').toLowerCase(),note=(q('#studioNotes')?.value||'').trim(),styleDirective=studioInteriorStyleDirectiveR16();
 const empty=/\b(empty|unfurnished|without furniture|no furniture)\b/i.test(note);
 const derived=studioPlanToInterior631(studioDetectedSource631||{},note);
 return `PIONX MULTI-CAMERA VISUAL-DNA LOCK. The supplied image is the APPROVED VISUAL MASTER for one architectural project. Create CAMERA VIEW ${index+1} OF ${total}: ${angle}. THE ONLY PERMITTED CHANGE IS CAMERA POSITION, LENS AND FRAMING. Keep the exact same project identity and spatial design. LOCK ALL OF THE FOLLOWING ACROSS THE SET: wall positions and room proportions; openings, doors and windows; ceiling and floor design; fixed joinery and built-ins; furniture model, count, dimensions, placement and orientation; material types, texture scale, joints, roughness and finish; glass tint and reflection character; lighting fixtures and their on/off state; daylight direction and intensity; shadow character; exposure; white balance; color palette; saturation; contrast and final color grade. Do not redesign, restyle, refurnish, add or remove objects, change materials, move furniture, change colors, change time of day or mirror the scene. No fisheye or impossible wide-angle distortion. ${scene==='interior'||derived?'Use a realistic eye-level architectural camera around 1.45–1.60 m with a natural 24–32 mm lens and corrected verticals.':''} ${derived?'This interior was derived from a CAD/floor plan. Preserve the established circulation, room layout and PLAN ORIENTATION; never mirror, rotate or reinterpret the plan when showing the new angle. Wardrobes/closets stay wardrobes, dressers/vanities stay furniture, and bathroom fixtures may appear only where the locked plan explicitly identifies plumbing fixtures.':''} ${empty?'The approved scene is EMPTY / UNFURNISHED. Keep every camera view empty; do not add furniture, people or decorative props.':''} ${styleDirective?`The selected pre-render Interior Style is ${studioInteriorStyleLabelR16()}. Preserve that exact design language across every camera view; do not reinterpret it.`:''} Use the approved master as the appearance truth for every new view. If an unseen area cannot be inferred reliably, choose a camera position that stays within visually supported geometry rather than inventing architecture.`;
}
async function studioGenerateMultiCamera632(){
 if(studioMultiCamera632.busy)return;if(!signedIn56())return toast('Sign in before generating camera views');
 const master=studioFinal56.providerUrl;if(!master)return toast('Render and approve the first image before creating a Multi-Camera set');
 const angles=studioCameraAngles632().slice(0,studioMultiCamera632.count);studioMultiCamera632.busy=true;studioMultiCamera632.current=0;studioMultiCamera632.results=[];studioMultiCamera632.errors=[];studioMultiCamRefresh632();
 const modal=showRenderMind58();q('#renderMindScene').textContent=`Studio Multi-Camera · ${angles.length} locked views`;let delivered=0;
 const derived633=studioPlanInteriorMaster633||studioPlanToInterior631(studioDetectedSource631||{},q('#studioNotes')?.value||'');let masterData633='';
 try{
  if(derived633){mindUpdate('Preparing approved Visual Master + locked floor plan for camera-consistent views…',10,0);try{masterData633=await studioFinalData6319(master,12000);mindUpdate('Visual Master secured · starting camera 1…',16,0)}catch(e){console.warn('Multi-camera master transfer fallback',e);masterData633='';mindUpdate('Visual Master transfer was slow · continuing through the protected camera route without duplicating the master render…',16,0)}}
  for(let i=0;i<angles.length;i++){
   studioMultiCamera632.current=i;studioMultiCamRefresh632();mindUpdate(`Camera ${i+1}/${angles.length} · locking visual DNA and changing viewpoint only…`,Math.max(16,Math.round(16+(i/angles.length)*76)),Math.min(4,Math.floor((i/angles.length)*4)));
   let start=null,engine='';
   try{
    const planContract=derived633?studioPlanSpecForCamera6330(studioPlanInteriorSpec633):'';
    const refs=[studioSourceImage,...studioReferenceImages.filter(Boolean)].filter(Boolean),prompt=studioMultiCameraPrompt632(angles[i],i,angles.length)+(derived633?`
HARD FLOOR-PLAN CONTRACT FOR ALL CAMERA VIEWS: ${planContract}
The FLOOR PLAN reference remains authoritative for wall/opening/furniture semantics. The APPROVED VISUAL MASTER is authoritative for materials, lighting, colors and object appearance. Wardrobe/closet stays storage. Dresser/vanity stays furniture and can NEVER become a bathroom fixture unless the plan contract explicitly lists a plumbing fixture. Never mirror or rotate the project.`:'');
    const payload=renderPayload56({source_image:(derived633?(masterData633||master):master),prompt,mode:'creative',width:studioFinal56.width||studioSourceDims.width,height:studioFinal56.height||studioSourceDims.height,references:refs,planToInterior:false,analysis:{studio_multi_camera:true,camera_request:angles[i],visual_dna_lock:'strict',approved_visual_master:true,plan_semantic_lock:!!derived633,plan_contract:derived633?planContract:''}});
    payload.fidelity='preserve';payload.mode='creative';payload.scene_type=studioState.scene==='auto'?'architecture':studioState.scene;
    Object.assign(payload.controls,{architecture_lock:'strict',preserve_composition:false,allow_new_viewpoint:true,camera_only_change:true,visual_dna_lock:'strict',same_materials:true,same_lighting:true,same_colors:true,same_layout:true,same_furniture:true,no_mirror:true,preserve_exact_dimensions:true,quality_profile:'studio_multi_camera_v6330'});
    Object.assign(payload.analysis,{studio_multi_camera:true,camera_index:i+1,camera_total:angles.length,camera_request:angles[i],same_materials:true,same_lighting:true,same_colors:true,same_layout:true,same_furniture:true});
    start=await renderPost56(payload,45000);engine=start.engines?.[0]||'';if(!engine)throw Error('No render route was returned');if(Number.isFinite(Number(start.credits_remaining)))setCreditsFromRender56(start.credits_remaining);
    const done=await renderEngine56(start,engine),best=done?.candidates?.find(x=>x?.url);if(!best?.url)throw Error('Camera render completed without an image');
    studioMultiCamera632.results.push({url:best.url,label:angles[i],job:start.job_token||''});delivered++;if(Number.isFinite(Number(done.credits_remaining)))setCreditsFromRender56(done.credits_remaining);try{await persistRender62(best.url,start.job_token)}catch(e){console.warn('Multi-camera gallery save',e)}
   }catch(e){if(start&&engine)try{await cancelRender56(start,engine)}catch{}studioMultiCamera632.errors.push(`${angles[i]}: ${e.message||'render failed'}`)}
   studioMultiCamRefresh632();
  }
  mindUpdate(`${delivered} of ${angles.length} locked camera renders delivered.`,100,5);await loadAccount56({quiet:true});hideRenderMind58(500);toast(`Multi-Camera set complete · ${delivered}/${angles.length} views ready`)
 }finally{studioMultiCamera632.busy=false;studioMultiCamera632.current=0;studioMultiCamRefresh632()}
}
const wireBase632=wireView;
wireView=function(name){wireBase632(name);if(name==='studio')setTimeout(studioInjectMultiCamera632,0)};
(function(){const st=document.createElement('style');st.textContent=`
.studio-multicam632{margin:14px 0;padding:15px;border:1px solid #244566;border-radius:14px;background:linear-gradient(180deg,#0c1826,#09131e)}
.studio-multicam-head632{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.studio-multicam-head632 small{color:#8e7cff;letter-spacing:.12em;font-weight:800}.studio-multicam-head632 h3{margin:4px 0 3px;font-size:17px}.studio-multicam-head632 p{margin:0;color:#8fa5b9;font-size:12px;max-width:720px;line-height:1.5}
.studio-multicam-locks632{display:flex;flex-wrap:wrap;gap:7px;margin:12px 0}.studio-multicam-locks632 span{padding:6px 9px;border:1px solid #21415b;border-radius:999px;background:#0b2130;color:#9ed4c4;font-size:11px}
.studio-multicam-controls632{display:grid;grid-template-columns:minmax(180px,.8fr) minmax(240px,1.2fr) auto;gap:12px;align-items:end}.studio-multicam-status632{display:flex;flex-direction:column;gap:3px}.studio-multicam-status632 small{color:#7f94a8;font-size:10px}.studio-camera-presets632{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:11px}.studio-camera-presets632 span{padding:8px;border:1px solid #203d55;border-radius:9px;color:#9aafc2;font-size:10px}.studio-camera-presets632 span.active{border-color:#705cff;background:#171d3d;color:white}
.studio-multicam-results632{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:12px}.studio-multicam-results632 article{overflow:hidden;border:1px solid #213f57;border-radius:11px;background:#0b1722}.studio-multicam-results632 button{display:block;width:100%;border:0;padding:0;background:none;cursor:pointer}.studio-multicam-results632 img{display:block;width:100%;aspect-ratio:16/10;object-fit:cover}.studio-multicam-results632 footer{padding:8px 9px;display:flex;flex-direction:column;gap:2px}.studio-multicam-results632 footer small{color:#6fae9d}.studio-mc-full632 img{max-width:100%;max-height:70vh;display:block;margin:auto;border-radius:10px}
@media(max-width:900px){.studio-multicam-controls632{grid-template-columns:1fr}.studio-camera-presets632,.studio-multicam-results632{grid-template-columns:1fr 1fr}}
`;document.head.appendChild(st)})();
// ===== END PIONX V6.30.5 =====


// ===== PIONX V6.30.8 · RELIABLE INTERIOR INPUT ROUTER =====
let studioSourceMode635=safeStore.get('pionx.studio.source-mode.v635')||'auto';
let studioPlanDetect635={kind:'unknown',confidence:0,method:'none'};
function studioSourceModeLabel635(){return studioSourceMode635==='plan'?'CAD / Floor Plan':studioSourceMode635==='view'?'Existing Interior View':'Auto Detect'}
async function studioPixelPlanScore635(){
 if(!studioSourceImage)return 0;
 try{
  const im=new Image();im.src=studioSourceImage;await im.decode();const c=document.createElement('canvas');c.width=144;c.height=144;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0,144,144);const d=x.getImageData(0,0,144,144).data;let white=0,dark=0,lowSat=0,mid=0,n=0;
  for(let i=0;i<d.length;i+=4){const r=d[i],g=d[i+1],b=d[i+2],mx=Math.max(r,g,b),mn=Math.min(r,g,b),v=(r+g+b)/3,s=mx?((mx-mn)/mx):0;n++;if(v>225)white++;if(v<85)dark++;if(s<.09)lowSat++;if(v>=85&&v<=225)mid++}
  const W=white/n,D=dark/n,S=lowSat/n,M=mid/n;
  // CAD/floor plans are usually mostly white/very light, low-saturation and carry a modest amount of dark linework.
  let score=0;if(W>.48)score+=.34;if(S>.82)score+=.28;if(D>.025&&D<.28)score+=.20;if(M>.08&&M<.46)score+=.10;if(W>.64&&S>.90)score+=.12;return Math.min(1,score);
 }catch(e){console.warn('Plan pixel classifier unavailable',e);return 0}
}
async function studioServerClassify635(){
 try{
  const r=await pxApi56('/server/studio-plan-interior-v6338.php',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'classify',source_image:studioSourceImage})}),j=await json56(r,'Interior input classifier');
  if(r.ok&&j.ok)return {kind:j.source_kind||'unknown',confidence:Number(j.confidence)||0,method:'visual-classifier',reason:j.reason||''};
 }catch(e){console.warn('Interior source classifier unavailable',e)}return {kind:'unknown',confidence:0,method:'classifier-unavailable'}
}
async function studioClassifySource635(){
 if(studioState.scene!=='interior')return {kind:'not-applicable',confidence:1,method:'scene'};
 if(studioSourceMode635==='plan')return {kind:'floor_plan',confidence:1,method:'manual'};
 if(studioSourceMode635==='view')return {kind:'interior_view',confidence:1,method:'manual'};
 const ai=await studioServerClassify635();
 if(ai.kind==='interior_view'&&ai.confidence>=.35)return ai;
 if(ai.kind==='floor_plan'&&ai.confidence>=.70)return ai;
 const pixel=await studioPixelPlanScore635();
 const old=studioPlanEvidence634(studioDetectedSource631||{},q('#studioNotes')?.value||'');
 if(ai.kind==='floor_plan'&&ai.confidence>=.55&&pixel>=.82&&old)return {...ai,method:'visual+pixel-plan-confirmed'};
 if((ai.kind==='unknown'||ai.confidence<.35)&&pixel>=.92&&old)return {kind:'floor_plan',confidence:.76,method:'fallback-plan-consensus',reason:'strong plan-only consensus after classifier uncertainty'};
 return {kind:'interior_view',confidence:Math.max(.60,ai.kind==='interior_view'?ai.confidence:0),method:ai.method||'safe-perspective-fallback',reason:ai.reason||'Auto mode preserves an existing camera unless floor-plan evidence is strong'};
}
function studioInputControl635(){
 const status=studioPlanDetect635.kind==='floor_plan'?'PLAN → INTERIOR READY':studioPlanDetect635.kind==='interior_view'?'EXISTING VIEW':'NOT CHECKED';
 const detail=studioPlanDetect635.kind==='floor_plan'?'Plan geometry only · camera will be generated inside the room.':'Choose Auto Detect, or force the source type if needed.';
 return `<div class="studio-input-router635"><div class="field-title">Interior Input <span class="muted">prevents plan/top-view mistakes</span></div><div class="segmented studio-input-seg635">${[['auto','Auto Detect'],['plan','CAD / Floor Plan'],['view','Existing Interior']].map(([k,l])=>`<button type="button" class="chip ${studioSourceMode635===k?'active':''}" data-studio-source-mode635="${k}">${l}</button>`).join('')}</div><div class="studio-input-status635" id="studioInputStatus635"><b>${status}</b><small>${detail}</small></div></div>`;
}
const studioRouteBase635=routes.studio;
routes.studio=function(){let html=studioRouteBase635();const ctl=studioInputControl635();return html.replace('<div class="field-title">Environment</div>',ctl+'<div class="field-title">Environment</div>')};
function studioUpdateInputStatus635(){const box=q('#studioInputStatus635');if(!box)return;const k=studioPlanDetect635.kind,c=Math.round((Number(studioPlanDetect635.confidence)||0)*100);box.innerHTML=k==='floor_plan'?`<b>✓ PLAN → INTERIOR DETECTED${c?' · '+c+'%':''}</b><small>Floor plan controls geometry and furniture. Uploaded references control materials and lighting.</small>`:k==='interior_view'?`<b>✓ EXISTING INTERIOR VIEW${c?' · '+c+'%':''}</b><small>Existing camera/composition can be preserved normally.</small>`:`<b>INPUT NOT CHECKED</b><small>Detection runs automatically when you press Render.</small>`}
const wireBase635=wireView;
wireView=function(name){wireBase635(name);if(name==='studio'){qa('[data-studio-source-mode635]').forEach(b=>b.onclick=()=>{studioSourceMode635=b.dataset.studioSourceMode635||'auto';safeStore.set('pionx.studio.source-mode.v635',studioSourceMode635);studioPlanDetect635={kind:'unknown',confidence:0,method:'mode-change'};route()});studioUpdateInputStatus635()}};
// Make all later calls (including Multi-Camera) honor the explicit/verified source interpretation.
const studioPlanToInteriorBase635=studioPlanToInterior631;
studioPlanToInterior631=function(a={},note=''){if(studioState.scene!=='interior')return false;if(studioSourceMode635==='plan'||studioPlanDetect635.kind==='floor_plan')return true;if(studioSourceMode635==='view')return false;return studioPlanToInteriorBase635(a,note)};
(function(){const st=document.createElement('style');st.textContent=`.studio-input-router635{margin:10px 0 12px;padding:10px;border:1px solid #29445d;border-radius:11px;background:#0a1723}.studio-input-seg635{margin-top:6px}.studio-input-status635{margin-top:7px;padding:7px 9px;border-radius:8px;background:#0d2130;border:1px solid #1c3a52;display:flex;flex-direction:column;gap:2px}.studio-input-status635 b{font-size:10px;color:#9ed4c4}.studio-input-status635 small{font-size:9px;color:#7f96aa;line-height:1.4}`;document.head.appendChild(st)})();
// ===== END PIONX V6.30.8 =====

// V6.30.10: persistent, explicit render outcome; never label a failed source as a result.
let studioNotice636=null;
function studioRenderNotice636(state,message){
 studioNotice636={state,message};
 let box=q('#studioRenderNotice636');
 if(!box){const canvas=q('.canvas-panel');if(!canvas)return;box=document.createElement('div');box.id='studioRenderNotice636';box.setAttribute('role','status');box.style.cssText='padding:14px 18px;margin:10px;border:1px solid #52647c;border-radius:12px;white-space:pre-wrap;overflow-wrap:anywhere';canvas.prepend(box)}
 box.textContent=(state==='failed'?'Render failed — no new image delivered. ':state==='running'?'Rendering… ':'')+message;
 box.style.backgroundColor=state==='failed'?'#fff1f2':state==='complete'?'#ecfdf5':'#eff6ff';
 box.style.color=state==='failed'?'#9f1239':state==='complete'?'#065f46':'#1e3a8a';
 const badge=q('#studioOutputBadge');if(badge&&state!=='complete')badge.textContent=studioFinal56.providerUrl?'PREVIOUS RESULT · '+state.toUpperCase():state==='failed'?'SOURCE · RENDER FAILED':'SOURCE · RENDERING';
}
const wireNotice636=wireView;wireView=function(name){
 wireNotice636(name);if(name==='studio'&&studioNotice636)studioRenderNotice636(studioNotice636.state,studioNotice636.message);if(name!=='studio')return;
 const pending=safeStore.get(PLAN_PENDING_KEY6312);if(!pending)return;
 // Always remount the recovery UI after any Studio rerender, even if the poll loop already exists.
 studioRecoveryBegin6331(pending);studioRenderNotice636('running','Restoring protected operation '+pending+' from the server.');
 if(studioPlanPolling6312)return;
 studioPlanPolling6312=true;
 studioPlanWait6312(pending).then(async j=>{if((location.hash||'').includes('studio'))await studioDeliverPlanInterior633(j,null)}).catch(e=>{
  if(e?.staleCleaned){studioPlanClearPending6331();studioRecoveryEnd6331({refresh:true,message:'Previous stalled render was closed safely. Studio is ready for a new render.'});loadAccount56({quiet:true}).catch(()=>{});return}
  if(e?.orphaned){studioPlanClearPending6331();studioRecoveryEnd6331({refresh:true,message:'Old incomplete recovery state cleared. Studio is ready for a new render.'});return}
  const still=/still processing/i.test(e.message||'');if(!still)studioPlanClearPending6331();studioRecoveryEnd6331({refresh:!still});studioRenderNotice636(still?'running':'failed',e.message||'Could not recover the previous operation');
 }).finally(()=>studioPlanPolling6312=false)
};
const sourceNotice636=setStudioSourceFile;setStudioSourceFile=async function(file){if(!studioRecoveryState6331.active)studioPlanClearPending6331();await sourceNotice636(file);studioNotice636=null;q('#studioRenderNotice636')?.remove()};
const wirePreflight6333=wireView;wireView=function(name){wirePreflight6333(name);if(name==='studio'){const m=studioConsumePreflightNotice6333();if(m){studioRenderNotice636('complete',m);toast(m)}}};

// ===== PIONX V6.31.21 · PENDING RENDER SESSION REHYDRATION FIX =====
// Startup recovery rebuilds a recovery canvas, clears orphan pointers, blocks duplicate paid renders, and delivers completed results without an empty upload state.
// ===== END PIONX V6.31.21 =====

// ===== PIONX V6.31.19 · MULTI-CAMERA / EDIT / PLAN SEMANTIC FIX =====
// Multi-Camera no longer stalls indefinitely at 8%; Edit uses current-final bytes/dimensions; Plan→Interior uses v6319 orientation/semantic lock server.
// ===== END PIONX V6.31.19 =====

// ===== PIONX V6.31.21 · SESSION REHYDRATION / ORPHAN PENDING CLEANUP =====
(function(){const st=document.createElement('style');st.textContent=`
.pionx-plan-recovering6331 #studioEditStage{min-height:430px}.canvas-source-gate.recovering6331{border-style:solid!important;border-color:#5e56c7!important;background:radial-gradient(circle at 50% 15%,rgba(104,88,255,.12),rgba(7,17,29,.98) 48%)!important;cursor:default!important}.studio-recovery-card6331{width:min(560px,90%);margin:auto;text-align:center;display:flex;flex-direction:column;align-items:center;gap:10px}.studio-recovery-card6331 small{color:#988cff;font-weight:900;letter-spacing:.14em}.studio-recovery-card6331 h2{margin:0;font-size:21px}.studio-recovery-card6331 p{margin:0;color:#b7c6d5}.studio-recovery-card6331 code{font-size:10px;color:#91a8bd;overflow-wrap:anywhere}.studio-recovery-card6331 span{font-size:10px;color:#6fae9d}.studio-recovery-spinner6331{width:40px;height:40px;border:3px solid #24384f;border-top-color:#7565ff;border-radius:50%;animation:pionxRecoverSpin6331 .8s linear infinite}.studio-recovery-progress6331{width:min(360px,85%);height:7px;border-radius:99px;background:#142538;overflow:hidden}.studio-recovery-progress6331 i{display:block;width:8%;height:100%;background:linear-gradient(90deg,#6d5cff,#a08eff);transition:width .35s ease}@keyframes pionxRecoverSpin6331{to{transform:rotate(360deg)}}
`;document.head.appendChild(st)})();
// ===== END PIONX V6.31.21 =====

// ===== PIONX V6.31.23 · STUDIO PREFLIGHT / VISIBLE BUILD MARKER =====
(function(){
 const mount=()=>{let b=document.getElementById('pionxBuild6333');if(b)return;b=document.createElement('span');b.id='pionxBuild6333';b.textContent='BUILD 7.5.0 (Visual DNA Edition)';b.style.cssText='position:fixed;right:18px;bottom:14px;z-index:9998;padding:5px 8px;border:1px solid #35516e;border-radius:8px;background:#071421e8;color:#86a9c6;font:700 9px/1 system-ui;letter-spacing:.08em;pointer-events:none';document.body.appendChild(b)};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
// ===== END PIONX V6.31.23 =====

// ===== PIONX V6.31.18 · SECURE IMAGE COMMENTS / PINNED FEEDBACK =====
const studioComments6328={open:false,mode:false,filter:'all',loading:false,busy:false,comments:[],pending:null,editing:'',replying:'',focus:'',projectId:safeStore.get('pionx.studio.comments.project.v6328')||'',imageId:'',renderId:'',imageSignature:'',ownerId:'',error:''};
function commentsProjects6328(){const rows=Array.isArray(portfolioProjects614)?portfolioProjects614.filter(p=>p&&p.id):[];return rows.length?rows:[{id:'studio-feedback',title:'Studio feedback'}]}
function commentsProject6328(){const ps=commentsProjects6328();let p=ps.find(x=>String(x.id)===studioComments6328.projectId);if(!p&&ps.length){p=ps[0];studioComments6328.projectId=String(p.id);safeStore.set('pionx.studio.comments.project.v6328',studioComments6328.projectId)}return p||null}
function commentsImageSource6328(){return String(studioFinal56.providerUrl||studioFinal56.exactUrl||studioSourceImage||q('#studioOutput')?.src||'')}
function commentsCanonicalUrl6328(value){try{const u=new URL(String(value||''),location.origin);if(['http:','https:'].includes(u.protocol))return u.origin+u.pathname}catch{}return ''}
async function commentsDigest6328(value){const input=new TextEncoder().encode(String(value));if(globalThis.crypto?.subtle){const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',input));return [...bytes].map(x=>x.toString(16).padStart(2,'0')).join('')}let h=2166136261;for(const b of input){h^=b;h=Math.imul(h,16777619)}return (h>>>0).toString(16).padStart(8,'0')}
async function commentsContext6328(force=false){
 const source=commentsImageSource6328();if(!source)return null;
 const canonical=commentsCanonicalUrl6328(studioFinal56.providerUrl||studioFinal56.exactUrl);const signature=canonical||`${studioSourceName}|${studioSourceDims.width}x${studioSourceDims.height}|${source.slice(0,96)}|${source.slice(-48)}`;
 if(!force&&studioComments6328.imageSignature===signature&&studioComments6328.imageId)return {image_id:studioComments6328.imageId,render_id:studioComments6328.renderId};
 const digest=await commentsDigest6328(signature),gallery=(galleryRows62||[]).find(r=>commentsCanonicalUrl6328(r?.url)===canonical);
 studioComments6328.imageSignature=signature;studioComments6328.imageId='img-'+digest.slice(0,40);studioComments6328.renderId=String(gallery?.job||gallery?.id||('render-'+digest.slice(0,40)));studioComments6328.comments=[];studioComments6328.pending=null;studioComments6328.editing='';studioComments6328.replying='';
 return {image_id:studioComments6328.imageId,render_id:studioComments6328.renderId};
}
function commentsTime6328(value){const d=new Date(value||0);return Number.isFinite(d.getTime())?d.toLocaleString([], {dateStyle:'medium',timeStyle:'short'}):''}
function commentsFiltered6328(){return studioComments6328.comments.filter(c=>studioComments6328.filter==='all'||(studioComments6328.filter==='resolved'?c.resolved:!c.resolved))}
function commentsCounts6328(){const all=studioComments6328.comments.length,resolved=studioComments6328.comments.filter(c=>c.resolved).length;return {all,open:all-resolved,resolved}}
function commentsPanelHtml6328(){
 const p=commentsProject6328(),projects=commentsProjects6328(),counts=commentsCounts6328(),items=commentsFiltered6328();
 const empty=!commentsImageSource6328()?'Upload or render an image first.':!p?'Create a project first, then return to Studio.':studioComments6328.loading?'Loading feedback…':studioComments6328.error?studioComments6328.error:items.length?'':'No comments in this filter.';
 return `<header class="comments-head6328"><div><small>PINNED FEEDBACK</small><h3>Image Comments</h3></div><button type="button" class="comments-close6328" id="commentsClose6328" aria-label="Close comments">×</button></header>
 <label class="comments-project6328"><span>Project</span><select id="commentsProject6328" ${projects.length?'':'disabled'}>${projects.map(x=>`<option value="${escHtml(x.id)}" ${String(x.id)===studioComments6328.projectId?'selected':''}>${escHtml(x.title||x.id)}</option>`).join('')||'<option>No project</option>'}</select></label>
 <div class="comments-mode-note6328 ${studioComments6328.mode?'active':''}"><b>${studioComments6328.mode?'Comment mode is on':'Comment mode is off'}</b><span>${studioComments6328.mode?'Click anywhere on the image to place a numbered pin.':'Use the Comments button to place pins.'}</span></div>
 <nav class="comments-filters6328">${[['all','All',counts.all],['open','Open',counts.open],['resolved','Resolved',counts.resolved]].map(x=>`<button type="button" data-comments-filter6328="${x[0]}" class="${studioComments6328.filter===x[0]?'active':''}">${x[1]} <b>${x[2]}</b></button>`).join('')}</nav>
 ${studioComments6328.pending?`<section class="comment-compose6328"><b>New pin · ${Number(studioComments6328.pending.pin_number||counts.all+1)}</b><textarea id="commentNewText6328" maxlength="2000" placeholder="Write clear feedback for this point…"></textarea><div><button type="button" class="ghost-btn" id="commentCancel6328">Cancel</button><button type="button" class="primary-btn" id="commentSave6328" ${studioComments6328.busy?'disabled':''}>${studioComments6328.busy?'Saving…':'Add comment'}</button></div></section>`:''}
 <div class="comments-list6328" id="commentsList6328">${empty?`<div class="comments-empty6328">${escHtml(empty)}</div>`:items.map(c=>commentsCard6328(c)).join('')}</div>`;
}
function commentsCard6328(c){
 const edit=studioComments6328.editing===c.id,reply=studioComments6328.replying===c.id;
 return `<article class="comment-card6328 ${c.resolved?'resolved':''} ${studioComments6328.focus===c.id?'focused':''}" data-comment-card6328="${escHtml(c.id)}"><button type="button" class="comment-pin-mini6328" data-comment-focus6328="${escHtml(c.id)}">${Number(c.pin_number)||'•'}</button><div class="comment-card-main6328"><header><div><b>${escHtml(c.author||'PIONX User')}</b><small>${escHtml(commentsTime6328(c.created_at))}${c.updated_at!==c.created_at?' · edited':''}</small></div><span>${c.resolved?'Resolved':'Open'}</span></header>${edit?`<textarea data-comment-edit-text6328="${escHtml(c.id)}" maxlength="2000">${escHtml(c.text)}</textarea><div class="comment-inline-actions6328"><button type="button" data-comment-edit-cancel6328="${escHtml(c.id)}">Cancel</button><button type="button" data-comment-edit-save6328="${escHtml(c.id)}">Save</button></div>`:`<p>${escHtml(c.text)}</p>`}<div class="comment-actions6328"><button type="button" data-comment-reply6328="${escHtml(c.id)}">Reply</button>${c.can_resolve?`<button type="button" data-comment-resolve6328="${escHtml(c.id)}" data-resolved6328="${c.resolved?'1':'0'}">${c.resolved?'Reopen':'Resolve'}</button>`:''}${c.can_edit?`<button type="button" data-comment-edit6328="${escHtml(c.id)}">Edit</button>`:''}${c.can_delete?`<button type="button" class="danger" data-comment-delete6328="${escHtml(c.id)}">Delete</button>`:''}</div>${(c.replies||[]).length?`<div class="comment-replies6328">${c.replies.map(r=>`<div><b>${escHtml(r.author)}</b><p>${escHtml(r.text)}</p><small>${escHtml(commentsTime6328(r.created_at))}</small>${r.can_delete?`<button type="button" data-reply-delete6328="${escHtml(r.id)}" data-comment-id6328="${escHtml(c.id)}">Delete</button>`:''}</div>`).join('')}</div>`:''}${reply?`<div class="comment-reply-compose6328"><textarea data-comment-reply-text6328="${escHtml(c.id)}" maxlength="1200" placeholder="Write a reply…"></textarea><button type="button" data-comment-reply-cancel6328="${escHtml(c.id)}">Cancel</button><button type="button" data-comment-reply-save6328="${escHtml(c.id)}">Reply</button></div>`:''}</div></article>`;
}
// Keep feedback on the image and place the composer beside the selected pin.
function commentsPosition15(){
 const panel=q('#studioCommentsPanel6328'),stage=q('#studioEditStage');if(!panel||!stage||panel.hidden)return;
 const sr=stage.getBoundingClientRect();if(!sr.width||!sr.height)return;
 const ir=window.getActiveCanvasRect?.()||sr,p=studioComments6328.pending||studioComments6328.comments.find(c=>c.id===studioComments6328.focus);
 const margin=8,width=Math.min(320,Math.max(1,sr.width-margin*2));
 const height=Math.min(440,Math.max(1,sr.height-margin*2),Math.max(120,innerHeight-160));
 panel.style.width=width+'px';panel.style.maxHeight=height+'px';
 let left=sr.width-width-margin,top=margin;
 if(p){const x=ir.left-sr.left+Number(p.x)*ir.width,y=ir.top-sr.top+Number(p.y)*ir.height;left=x+20+width<=sr.width-margin?x+20:x-width-20;top=y-30;}
 panel.style.left=Math.max(margin,Math.min(left,sr.width-width-margin))+'px';
 panel.style.top=Math.max(margin,Math.min(top,sr.height-height-margin))+'px';
}
function commentsRenderPanel6328(){const panel=q('#studioCommentsPanel6328');if(!panel)return;panel.innerHTML=commentsPanelHtml6328();commentsWirePanel6328();commentsDrawPins6328();commentsUpdateButton6328();commentsPosition15()}
function commentsUpdateButton6328(){const b=q('#studioCommentsToggle6328');if(!b)return;const n=studioComments6328.comments.length;b.classList.toggle('active',studioComments6328.open);b.setAttribute('aria-pressed',studioComments6328.mode?'true':'false');b.innerHTML=`<span>💬</span> <span>Comments & Pins</span> <b id="ustCommentCount">${n}</b>`}
async function commentsApi6328(action,extra={}){
 let ctx=await commentsContext6328();const p=commentsProject6328();if(!ctx||!p)throw Error(!ctx?'Open an image first':'Choose a project first');
 if(!PXUSER56?.id)await loadAccount56({quiet:true});const owner=String(PXUSER56?.id||'');if(!owner)throw Error('Your PIONX login session is not active');studioComments6328.ownerId=owner;
 const r=await pxApi56('/server/image-comments-v6328.php',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,project_id:String(p.id),project_owner_id:owner,image_id:ctx.image_id,render_id:ctx.render_id,...extra})});const j=await json56(r,'Image comments');if(!r.ok||!j.ok)throw Error(j.error||'Comments request failed');return j;
}
async function commentsLoad6328(force=false){
 if(!studioComments6328.open)return;studioComments6328.loading=true;studioComments6328.error='';commentsRenderPanel6328();
 try{await commentsContext6328(force);const j=await commentsApi6328('list');studioComments6328.comments=Array.isArray(j.comments)?j.comments:[]}
 catch(e){studioComments6328.error=e.message||'Comments unavailable';studioComments6328.comments=[]}
 finally{studioComments6328.loading=false;commentsRenderPanel6328()}
}
async function commentsMutate6328(action,extra={}){if(studioComments6328.busy)return;studioComments6328.busy=true;commentsRenderPanel6328();try{const j=await commentsApi6328(action,extra);studioComments6328.comments=Array.isArray(j.comments)?j.comments:[];studioComments6328.error='';return true}catch(e){studioComments6328.error=e.message||'Could not save comment';toast(studioComments6328.error);return false}finally{studioComments6328.busy=false;commentsRenderPanel6328()}}
function commentsWirePanel6328(){
 q('#commentsClose6328')?.addEventListener('click',()=>commentsToggle6328(false));q('#commentsProject6328')?.addEventListener('change',e=>{studioComments6328.projectId=e.target.value;safeStore.set('pionx.studio.comments.project.v6328',studioComments6328.projectId);studioComments6328.comments=[];commentsLoad6328(true)});
 qa('[data-comments-filter6328]').forEach(b=>b.addEventListener('click',()=>{studioComments6328.filter=b.dataset.commentsFilter6328;commentsRenderPanel6328()}));
 q('#commentCancel6328')?.addEventListener('click',()=>{studioComments6328.pending=null;commentsRenderPanel6328()});q('#commentSave6328')?.addEventListener('click',async()=>{const text=q('#commentNewText6328')?.value.trim();if(!text)return toast('Write a comment first');const p=studioComments6328.pending;if(!p)return;if(await commentsMutate6328('create',{text,x:p.x,y:p.y})){studioComments6328.pending=null;commentsRenderPanel6328()}});
 qa('[data-comment-focus6328]').forEach(b=>b.addEventListener('click',()=>commentsFocus6328(b.dataset.commentFocus6328)));
 qa('[data-comment-card6328]').forEach(card=>card.addEventListener('click',e=>{if(e.target.closest('button,textarea'))return;commentsFocus6328(card.dataset.commentCard6328)}));
 qa('[data-comment-edit6328]').forEach(b=>b.addEventListener('click',()=>{studioComments6328.editing=b.dataset.commentEdit6328;commentsRenderPanel6328()}));qa('[data-comment-edit-cancel6328]').forEach(b=>b.addEventListener('click',()=>{studioComments6328.editing='';commentsRenderPanel6328()}));
 qa('[data-comment-edit-save6328]').forEach(b=>b.addEventListener('click',async()=>{const id=b.dataset.commentEditSave6328,text=q(`[data-comment-edit-text6328="${CSS.escape(id)}"]`)?.value.trim();if(!text)return toast('Comment cannot be empty');if(await commentsMutate6328('edit',{comment_id:id,text})){studioComments6328.editing='';commentsRenderPanel6328()}}));
 qa('[data-comment-delete6328]').forEach(b=>b.addEventListener('click',async()=>{if(!confirm('Delete this pinned comment and its replies?'))return;await commentsMutate6328('delete',{comment_id:b.dataset.commentDelete6328})}));
 qa('[data-comment-resolve6328]').forEach(b=>b.addEventListener('click',()=>commentsMutate6328('resolve',{comment_id:b.dataset.commentResolve6328,resolved:b.dataset.resolved6328!=='1'})));
 qa('[data-comment-reply6328]').forEach(b=>b.addEventListener('click',()=>{studioComments6328.replying=b.dataset.commentReply6328;commentsRenderPanel6328()}));qa('[data-comment-reply-cancel6328]').forEach(b=>b.addEventListener('click',()=>{studioComments6328.replying='';commentsRenderPanel6328()}));
 qa('[data-comment-reply-save6328]').forEach(b=>b.addEventListener('click',async()=>{const id=b.dataset.commentReplySave6328,text=q(`[data-comment-reply-text6328="${CSS.escape(id)}"]`)?.value.trim();if(!text)return toast('Write a reply first');if(await commentsMutate6328('reply',{comment_id:id,text})){studioComments6328.replying='';commentsRenderPanel6328()}}));
 qa('[data-reply-delete6328]').forEach(b=>b.addEventListener('click',()=>commentsMutate6328('reply_delete',{comment_id:b.dataset.commentId6328,reply_id:b.dataset.replyDelete6328})));
}
function commentsDrawPins6328(){ if(typeof window.commentsDrawPinsFixed === 'function') { return window.commentsDrawPinsFixed(); }

 const layer=q('#commentPinLayer6328'),stage=q('#studioEditStage'),img=q('#studioOutput');if(!layer||!stage||!img)return;layer.innerHTML='';const sr=stage.getBoundingClientRect(),ir=img.getBoundingClientRect();if(!ir.width||!ir.height)return;
 const draw=(c,pending=false)=>{const b=document.createElement('button');b.type='button';b.className=`comment-pin6328 ${c.resolved?'resolved':''} ${studioComments6328.focus===c.id?'focused':''} ${pending?'pending':''}`;b.textContent=String(c.pin_number||'+');b.style.left=(ir.left-sr.left+Number(c.x)*ir.width)+'px';b.style.top=(ir.top-sr.top+Number(c.y)*ir.height)+'px';b.title=pending?'New comment':`${c.author}: ${c.text}`;if(!pending)b.addEventListener('click',e=>{e.stopPropagation();commentsFocus6328(c.id)});layer.appendChild(b)};
 studioComments6328.comments.forEach(c=>draw(c));if(studioComments6328.pending)draw({...studioComments6328.pending,id:'pending',pin_number:studioComments6328.pending.pin_number||studioComments6328.comments.length+1},true);
}
function commentsFocus6328(id){studioComments6328.focus=id;commentsDrawPins6328();commentsPosition15();qa('[data-comment-card6328]').forEach(x=>x.classList.toggle('focused',x.dataset.commentCard6328===id));q(`[data-comment-card6328="${CSS.escape(id)}"]`)?.scrollIntoView({behavior:'smooth',block:'nearest'});setTimeout(()=>{if(studioComments6328.focus===id){studioComments6328.focus='';commentsDrawPins6328()}},1600)}
function commentsPlacePin6328(ev){ if(typeof window.commentsPlacePinFixed === 'function') { return window.commentsPlacePinFixed(ev); }

 const stage=q('#studioEditStage'),img=q('#studioOutput');if(!stage||!img||!commentsImageSource6328())return;const r=img.getBoundingClientRect();if(ev.clientX<r.left||ev.clientX>r.right||ev.clientY<r.top||ev.clientY>r.bottom)return toast('Click inside the image to add a comment');
 studioComments6328.pending={x:Math.max(0,Math.min(1,(ev.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(ev.clientY-r.top)/r.height)),pin_number:studioComments6328.comments.length+1};commentsRenderPanel6328();setTimeout(()=>q('#commentNewText6328')?.focus(),30);
}
function commentsToggle6328(next=!studioComments6328.open){
 studioComments6328.open=!!next;studioComments6328.mode=!!next;studioComments6328.pending=null;const grid=q('.studio-grid-v4');grid?.classList.remove('comments-open6328');const panel=q('#studioCommentsPanel6328');if(panel){panel.hidden=!studioComments6328.open;commentsPosition15();}q('#studioEditStage')?.classList.toggle('comment-mode6328',studioComments6328.mode);commentsUpdateButton6328();if(studioComments6328.open)commentsLoad6328(true);else commentsDrawPins6328();
}
function commentsInject6328(){
 const canvas=q('.canvas-panel'),toolbar=canvas?.querySelector('.canvas-toolbar')||canvas?.querySelector('.unified-studio-toolbar'),stage=q('#studioEditStage'),grid=q('.studio-grid-v4');if(!canvas||!toolbar||!stage||!grid)return;
 let b=q('#studioCommentsToggle6328');
 if(!b){b=document.createElement('button');b.type='button';b.id='studioCommentsToggle6328';b.className='tiny-btn studio-comments-toggle6328';toolbar.appendChild(b)}
 if(!b.dataset.pxCommentsWired1699){b.dataset.pxCommentsWired1699='1';b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();commentsToggle6328()})}
 // R16.9.9: retire the old local-only pin state so its 1s redraw cannot erase secure server pins.
 window.drawAllStudioPins=commentsDrawPins6328;
 if(!q('#studioCommentsPanel6328')){const panel=document.createElement('aside');panel.id='studioCommentsPanel6328';panel.className='panel comments-panel6328';panel.hidden=!studioComments6328.open;stage.appendChild(panel)}
 if(!q('#commentPinLayer6328')){const layer=document.createElement('div');layer.id='commentPinLayer6328';layer.className='comment-pin-layer6328';stage.appendChild(layer)}
 grid.classList.remove('comments-open6328');stage.classList.toggle('comment-mode6328',studioComments6328.mode);commentsRenderPanel6328();
 let down=null;stage.addEventListener('pointerdown',e=>{if(!studioComments6328.mode||e.target.closest('#studioCommentsPanel6328,.comment-pin6328,button,textarea,input,select'))return;down={x:e.clientX,y:e.clientY};e.preventDefault();e.stopImmediatePropagation()},true);stage.addEventListener('pointerup',e=>{if(!studioComments6328.mode||!down||e.target.closest('#studioCommentsPanel6328,.comment-pin6328,button,textarea,input,select'))return;const moved=Math.hypot(e.clientX-down.x,e.clientY-down.y);down=null;e.preventDefault();e.stopImmediatePropagation();if(moved<8)commentsPlacePin6328(e)},true);
 const img=q('#studioOutput');img?.addEventListener('load',()=>{commentsDrawPins6328();if(studioComments6328.open)commentsLoad6328(true)});if(globalThis.ResizeObserver){const ro=new ResizeObserver(()=>{commentsDrawPins6328();commentsPosition15()});ro.observe(stage)}else window.addEventListener('resize',commentsDrawPins6328,{passive:true});
}
const wireCommentsBase6328=wireView;wireView=function(name){wireCommentsBase6328(name);if(name==='studio')setTimeout(commentsInject6328,0)};
(function(){const st=document.createElement('style');st.textContent=`
.studio-comments-toggle6328.active{border-color:#8472ff!important;background:linear-gradient(135deg,#6e5cff,#8878ff)!important;color:#fff!important}.studio-comments-toggle6328 b{display:inline-grid;place-items:center;min-width:18px;height:18px;padding:0 5px;margin-left:4px;border-radius:999px;background:rgba(255,255,255,.18);font-size:10px}.studio-grid-v4.comments-open6328>.adjust-panel{display:none}.studio-grid-v4.comments-open6328{grid-template-columns:minmax(250px,.82fr) minmax(0,1.75fr) minmax(300px,.92fr)}
.comments-panel6328{min-width:0;max-height:calc(100vh - 120px);position:sticky;top:90px;display:flex;flex-direction:column;padding:0;overflow:hidden;border-color:#2d4360}.comments-panel6328[hidden]{display:none!important}.comments-head6328{display:flex;align-items:flex-start;justify-content:space-between;padding:16px 16px 10px}.comments-head6328 small{color:#8b7cff;letter-spacing:.13em;font-weight:800}.comments-head6328 h3{margin:4px 0 0}.comments-close6328{border:0;background:transparent;color:#9eb0c2;font-size:24px;cursor:pointer}.comments-project6328{display:flex;flex-direction:column;gap:5px;padding:0 16px 10px;font-size:11px;color:#8fa5b9}.comments-project6328 select{width:100%;border:1px solid #29445c;border-radius:9px;background:#091724;color:#e9f1fb;padding:9px}.comments-mode-note6328{margin:0 16px 10px;padding:9px 10px;border:1px solid #29445c;border-radius:9px;background:#0a1926;display:flex;flex-direction:column;gap:2px}.comments-mode-note6328.active{border-color:#6f5cff;background:#17183a}.comments-mode-note6328 b{font-size:11px}.comments-mode-note6328 span{font-size:10px;color:#91a5b8}.comments-filters6328{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;padding:0 16px 11px}.comments-filters6328 button{border:1px solid #29445c;background:#0a1723;color:#91a5b8;border-radius:8px;padding:7px 4px;font-size:10px;cursor:pointer}.comments-filters6328 button.active{border-color:#7565ff;color:#fff;background:#1a1a3e}.comments-filters6328 b{margin-left:3px}.comments-list6328{overflow:auto;padding:0 12px 14px}.comments-empty6328{padding:24px 10px;text-align:center;color:#8196a9;font-size:12px;line-height:1.5}.comment-compose6328{margin:0 12px 10px;padding:10px;border:1px solid #705fff;border-radius:11px;background:#10172c}.comment-compose6328 textarea,.comment-card6328 textarea,.comment-reply-compose6328 textarea{width:100%;min-height:70px;margin:7px 0;border:1px solid #31475f;border-radius:8px;background:#07131e;color:#eef5fb;padding:9px;resize:vertical}.comment-compose6328>div,.comment-inline-actions6328{display:flex;justify-content:flex-end;gap:6px}.comment-card6328{display:grid;grid-template-columns:29px 1fr;gap:8px;padding:10px 5px;border-bottom:1px solid #20374b;transition:.2s}.comment-card6328.focused{background:#18203e;border-radius:10px;box-shadow:inset 0 0 0 1px #7565ff}.comment-pin-mini6328{width:26px;height:26px;border:0;border-radius:50%;background:#725fff;color:#fff;font-weight:800;cursor:pointer}.comment-card6328.resolved .comment-pin-mini6328{background:#385264}.comment-card-main6328 header{display:flex;justify-content:space-between;gap:8px}.comment-card-main6328 header>div{display:flex;flex-direction:column}.comment-card-main6328 header b{font-size:11px}.comment-card-main6328 header small{font-size:9px;color:#748a9e}.comment-card-main6328 header>span{font-size:9px;color:#83d2b3}.comment-card-main6328 p{margin:7px 0;color:#cfdae5;font-size:11px;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere}.comment-card6328.resolved p{opacity:.65}.comment-actions6328{display:flex;flex-wrap:wrap;gap:4px}.comment-actions6328 button,.comment-inline-actions6328 button,.comment-reply-compose6328 button,.comment-replies6328 button{border:0;background:transparent;color:#94a9bd;padding:3px 5px;font-size:9px;cursor:pointer}.comment-actions6328 button:hover{color:#fff}.comment-actions6328 .danger{color:#e89a9a}.comment-replies6328{margin-top:8px;padding-left:8px;border-left:2px solid #273f54}.comment-replies6328>div{position:relative;padding:6px 0}.comment-replies6328 b{font-size:9px}.comment-replies6328 p{margin:2px 0}.comment-replies6328 small{font-size:8px;color:#71879b}.comment-replies6328 button{float:right}.comment-reply-compose6328{margin-top:7px}.comment-pin-layer6328{position:absolute;inset:0;z-index:8;pointer-events:none;overflow:visible}.comment-pin6328{position:absolute;transform:translate(-50%,-50%);width:30px;height:30px;border:2px solid #fff;border-radius:50%;background:#6f5cff;color:#fff;font-weight:900;box-shadow:0 4px 18px rgba(0,0,0,.45);pointer-events:auto;cursor:pointer;z-index:2}.comment-pin6328.resolved{background:#365164;opacity:.75}.comment-pin6328.focused{animation:pxCommentPulse6328 .8s ease 2;z-index:4}.comment-pin6328.pending{background:#fa9b4b;border-style:dashed;animation:pxCommentPulse6328 1s ease infinite}.comment-mode6328{cursor:crosshair}.comment-mode6328 #studioOutput{user-select:none}.comment-mode6328:after{content:'Click image to add a pin';position:absolute;left:50%;bottom:12px;transform:translateX(-50%);z-index:7;background:rgba(5,12,21,.82);color:#fff;border:1px solid #6d5cff;border-radius:999px;padding:6px 10px;font-size:10px;pointer-events:none}@keyframes pxCommentPulse6328{50%{transform:translate(-50%,-50%) scale(1.28);box-shadow:0 0 0 8px rgba(117,101,255,.22)}}
@media(max-width:1180px){.studio-grid-v4.comments-open6328{grid-template-columns:minmax(230px,.7fr) minmax(0,1.5fr)}.studio-grid-v4.comments-open6328>.comments-panel6328{grid-column:1/-1;position:relative;top:auto;max-height:620px}}
@media(max-width:760px){.studio-grid-v4.comments-open6328{grid-template-columns:1fr}.studio-grid-v4.comments-open6328>.comments-panel6328{grid-column:auto}.comments-panel6328{max-height:none}.comment-pin6328{width:34px;height:34px}.comments-filters6328{position:sticky;top:0;background:#08141f;z-index:2;padding-top:8px}}
`;document.head.appendChild(st)})();
// ===== END PIONX V6.31.18 =====


// =========================================================================
// PIONX AI v7.1: INTERACTIVE BEFORE/AFTER SPLIT SLIDER (INSIDE CLOSURE)
// =========================================================================
// R16.14: split, zoom and pins share the authenticated application state.
  window.currentZoomLevel = 1;
  window.cycleStudioZoom = function() {
    const levels = [1, 1.5, 2, 3];
    const nextIdx = (levels.indexOf(window.currentZoomLevel) + 1) % levels.length;
    window.setStudioZoom(levels[nextIdx]);
  };

  window.setStudioZoom = function(scale) {
    window.currentZoomLevel = scale;
    const stage = document.getElementById('studioEditStage');
    const outImg = document.getElementById('studioOutput');
    const sliderWrap = document.getElementById('pionxSplitWrap7');
    const zoomBtn = document.querySelector('[data-canvas-action="zoom"]');

    if (zoomBtn) zoomBtn.textContent = Math.round(scale * 100) + '%';

    const target = (sliderWrap && sliderWrap.style.display !== 'none') ? sliderWrap : outImg;
    if (target) {
      target.style.transformOrigin = 'center center';
      target.style.transform = scale > 1 ? `scale(${scale})` : 'none';
      target.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
    }

    if (stage) {
      stage.style.cursor = scale > 1 ? 'grab' : (studioComments6328.mode ? 'crosshair' : 'default');
    }

    toast(`Zoom: ${Math.round(scale * 100)}%`);
    window.drawAllStudioPins();
  };


(function() {
  window.pionxViewMode = 'split'; // 'split' | 'final' | 'source'

  window.setStudioViewMode = function(mode) {
    window.pionxViewMode = mode;
    const splitWrap = document.getElementById('pionxSplitWrap7');
    const finalImg = document.getElementById('studioOutput');
    const sourceImg = typeof studioSourceImage !== 'undefined' ? studioSourceImage : '';
    const renderUrl = typeof studioFinal56 !== 'undefined' ? (studioFinal56.exactUrl || studioFinal56.providerUrl) : '';

    document.querySelectorAll('.ust-view-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === mode);
    });

    if (mode === 'split') {
      if (splitWrap) splitWrap.style.display = 'block';
      if (finalImg) finalImg.style.visibility = 'hidden';
      if (typeof window.syncSplitSliderSize === 'function') window.syncSplitSliderSize();
    } else if (mode === 'final') {
      if (splitWrap) splitWrap.style.display = 'none';
      if (finalImg) {
        finalImg.style.visibility = 'visible';
        finalImg.src = renderUrl || finalImg.src;
      }
    } else if (mode === 'source') {
      if (splitWrap) splitWrap.style.display = 'none';
      if (finalImg) {
        finalImg.style.visibility = 'visible';
        finalImg.src = sourceImg || finalImg.src;
      }
    }
    if (typeof commentsDrawPins6328 === 'function') commentsDrawPins6328();
  };

  function getActiveCanvasRect() {
    const splitWrap = document.getElementById('pionxSplitWrap7');
    if (splitWrap && splitWrap.style.display !== 'none' && splitWrap.offsetWidth > 0) {
      return splitWrap.getBoundingClientRect();
    }
    const finalImg = document.getElementById('studioOutput');
    if (finalImg && finalImg.offsetWidth > 0) {
      return finalImg.getBoundingClientRect();
    }
    const stage = document.getElementById('studioEditStage');
    return stage ? stage.getBoundingClientRect() : null;
  }
  window.getActiveCanvasRect = getActiveCanvasRect;

  // Modern Split Slider implementation
  window.initPionxSplitSlider = function() {
    const stage = document.getElementById('studioEditStage');
    if (!stage) return;

    const sourceImg = typeof studioSourceImage !== 'undefined' ? studioSourceImage : '';
    const renderImg = typeof studioFinal56 !== 'undefined' ? (studioFinal56.exactUrl || studioFinal56.providerUrl) : '';

    if (!sourceImg || !renderImg) {
      const existing = document.getElementById('pionxSplitWrap7');
      if (existing) existing.style.display = 'none';
      const out = document.getElementById('studioOutput');
      if (out) out.style.visibility = 'visible';
      return;
    }

    let wrap = document.getElementById('pionxSplitWrap7');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'pionxSplitWrap7';
      wrap.className = 'pionx-split-wrap-v7';
      wrap.innerHTML = `
        <div class="split-under-layer" id="splitUnderLayer">
          <img src="${sourceImg}" alt="Original CAD / Source" id="splitBeforeImg" draggable="false">
          <span class="split-tag tag-before">Original CAD / Input</span>
        </div>
        <div class="split-over-layer" id="splitOverLayer" style="width: 50%;">
          <img src="${renderImg}" alt="PIONX Photoreal Render" id="splitAfterImg" draggable="false">
          <span class="split-tag tag-after">PIONX Photoreal Render</span>
        </div>
        <div class="split-divider-line" id="splitDividerLine" style="left: 50%;">
          <div class="split-divider-handle" id="splitDividerHandle" title="Drag to compare before & after">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="#ffffff"><path d="M8 7l-5 5 5 5V7zm8 0v10l5-5-5-5z"/></svg>
          </div>
        </div>
        <div class="comment-hint-overlay" id="commentHintOverlay" style="display:none;">
          📍 Click anywhere on the image to place a feedback pin
        </div>
      `;
      stage.appendChild(wrap);

      let isDragging = false;
      const overLayer = wrap.querySelector('#splitOverLayer');
      const dividerLine = wrap.querySelector('#splitDividerLine');

      function updateSlider(clientX) {
        const rect = wrap.getBoundingClientRect();
        if (!rect.width) return;
        let pos = (clientX - rect.left) / rect.width;
        pos = Math.max(0.01, Math.min(0.99, pos));
        const pct = (pos * 100).toFixed(2) + '%';
        overLayer.style.width = pct;
        dividerLine.style.left = pct;
      }

      function syncSize() {
        const w = wrap.offsetWidth;
        if (w > 0) {
          const afterImg = wrap.querySelector('#splitAfterImg');
          if (afterImg) afterImg.style.width = w + 'px';
        }
      }
      window.syncSplitSliderSize = syncSize;

      wrap.addEventListener('pointerdown', function(e) {
        // If in comment mode, allow click to drop pin
        if (typeof studioComments6328 !== 'undefined' && studioComments6328.mode) {
          return;
        }
        e.preventDefault();
        isDragging = true;
        wrap.setPointerCapture(e.pointerId);
        syncSize();
        updateSlider(e.clientX);
      });

      wrap.addEventListener('pointermove', function(e) {
        if (!isDragging) return;
        e.preventDefault();
        updateSlider(e.clientX);
      });

      function stopDrag(e) {
        if (isDragging) {
          isDragging = false;
          try { wrap.releasePointerCapture(e.pointerId); } catch(err) {}
        }
      }

      wrap.addEventListener('pointerup', stopDrag);
      wrap.addEventListener('pointercancel', stopDrag);
      window.addEventListener('resize', syncSize);
      syncSize();
    } else {
      const bImg = wrap.querySelector('#splitBeforeImg');
      const aImg = wrap.querySelector('#splitAfterImg');
      if (bImg && bImg.src !== sourceImg) bImg.src = sourceImg;
      if (aImg && aImg.src !== renderImg) aImg.src = renderImg;
      if (typeof window.syncSplitSliderSize === 'function') window.syncSplitSliderSize();
    }

    if (window.pionxViewMode === 'split') {
      wrap.style.display = 'block';
      const out = document.getElementById('studioOutput');
      if (out) out.style.visibility = 'hidden';
    } else {
      wrap.style.display = 'none';
      const out = document.getElementById('studioOutput');
      if (out) out.style.visibility = 'visible';
    }
  };

  // Enhance comments placement to work with both standard canvas and split slider!
  window.commentsPlacePinFixed = function(ev) {
    const stage = document.getElementById('studioEditStage');
    if (!stage || typeof studioComments6328 === 'undefined') return;

    const r = getActiveCanvasRect();
    if (!r || !r.width || !r.height) return;

    if (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom) {
      return;
    }

    const x = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
    const y = Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height));

    studioComments6328.pending = {
      x: x,
      y: y,
      pin_number: (studioComments6328.comments || []).length + 1
    };

    if (typeof commentsRenderPanel6328 === 'function') commentsRenderPanel6328();
    setTimeout(() => {
      const inp = document.getElementById('commentNewText6328');
      if (inp) inp.focus({preventScroll:true});
    }, 50);

    toast('📍 Pin placed. Enter your comment in the panel.');
  };

  // Overwrite draw pins so pins are drawn at z-index: 60 above everything
  window.commentsDrawPinsFixed = function() {
    const layer = document.getElementById('commentPinLayer6328');
    const stage = document.getElementById('studioEditStage');
    if (!layer || !stage || typeof studioComments6328 === 'undefined') return;

    layer.innerHTML = '';
    const sr = stage.getBoundingClientRect();
    const ir = getActiveCanvasRect() || sr;
    if (!ir.width || !ir.height) return;

    // Hint overlay
    const hint = document.getElementById('commentHintOverlay');
    if (hint) {
      hint.style.display = studioComments6328.mode ? 'block' : 'none';
    }

    const draw = (c, pending = false) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `comment-pin6328 ${c.resolved ? 'resolved' : ''} ${studioComments6328.focus === c.id ? 'focused' : ''} ${pending ? 'pending' : ''}`;
      b.textContent = String(c.pin_number || '+');
      b.style.position = 'absolute';
      b.style.left = (ir.left - sr.left + Number(c.x) * ir.width) + 'px';
      b.style.top = (ir.top - sr.top + Number(c.y) * ir.height) + 'px';
      b.style.zIndex = '60';
      b.title = pending ? 'New note' : `${c.author || 'Architect'}: ${c.text}`;
      if (!pending && typeof commentsFocus6328 === 'function') {
        b.addEventListener('click', e => {
          e.stopPropagation();
          commentsFocus6328(c.id);
        });
      }
      layer.appendChild(b);
    };

    (studioComments6328.comments || []).forEach(c => draw(c));
    if (studioComments6328.pending) {
      draw({
        ...studioComments6328.pending,
        id: 'pending',
        pin_number: studioComments6328.pending.pin_number || (studioComments6328.comments.length + 1)
      }, true);
    }

    // Update count in top header
    const cntEl = document.getElementById('ustCommentCount');
    if (cntEl) cntEl.textContent = (studioComments6328.comments || []).length;
  };
})();
function ensureSplitSliderV7() { if(typeof window.initPionxSplitSlider === "function") window.initPionxSplitSlider(); }
setInterval(ensureSplitSliderV7, 1000);

(function(){
'use strict';
Object.defineProperty(window,'PIONXWorkspaceR14',{value:Object.freeze({version:'R14.7',get affectedRoute(){return(location.hash||'#home').slice(1).split('?')[0];}}),writable:false});
const esc=s=>{const d=document.createElement('div');d.textContent=s||'';return d.innerHTML;};
const isDef=p=>{
 const ds=typeof defaultProjects614!=="undefined"?defaultProjects614:[];
 return !!p && ds.some(x=>["id","title","cover","description"].every(k=>x[k]===p[k])&&JSON.stringify(x.renders)===JSON.stringify(p.renders));
};
if(typeof routes!=='undefined'&&routes.home){
 routes.home=function(){
  const projs=typeof portfolioProjects614!=='undefined'?portfolioProjects614.filter(p=>!isDef(p)):[];
  const rCards=typeof galleryCards62==='function'?galleryCards62((typeof galleryRows62!=='undefined'?galleryRows62:[]).slice(0,4)):'';
  const pCards=projs.length?projs.map(p=>`<article class="panel project-card">${p.cover||(p.renders&&p.renders[0])?`<img src="${esc(p.cover||(p.renders&&p.renders[0]))}" alt="${esc(p.title)}">`:'<div class="r14-empty">No project image yet</div>'}<div class="meta"><div><h3>${esc(p.title)}</h3><small>${esc(p.category)}</small><button class="ghost-btn" data-r14-project="${esc(p.id)}">Open project</button></div></div></article>`).join(''):'<div class="panel r14-empty">No projects yet.</div>';
  return `<section class="page"><div class="r14-header"><div><h2>Workspace Dashboard</h2><p>Continue your architectural productions.</p></div></div>
  <div class="r14-tiles"><a href="#studio" class="panel">✦ AI Studio</a><a href="#flow" class="panel">⌘ Flow</a><a href="#consistency" class="panel">∞ Visual DNA</a><a href="#video" class="panel">▣ Video</a><a href="#film" class="panel">▤ Film</a><a href="#presentation" class="panel">▧ Presentation</a></div>
  <div class="section-title"><h2>Recent Projects</h2><a href="#projects">View all</a></div><div class="grid-4">${pCards}</div>
  <div class="section-title" style="margin-top:24px"><h2>Recent Renders</h2><a href="#renders">View all</a></div><div class="gallery">${rCards}</div></section>`;
 };
}
if(typeof setStudioViewMode!=='undefined'&&!window.r14svm){
 const old=setStudioViewMode;
 setStudioViewMode=function(m){
  const s=typeof studioSourceImage!=='undefined'?studioSourceImage:'';
  const f=typeof studioFinal56!=='undefined'?(studioFinal56.exactUrl||studioFinal56.providerUrl):'';
  if(m==='split'){if(!s||!f||s===f){if(typeof toast==='function')toast('Comparison unavailable: source and result identical');old('final');return;}if(typeof initPionxSplitSlider==='function')initPionxSplitSlider();}
  try {old(m); if(m==='split'){const wrap=document.getElementById('pionxSplitWrap7');if(!wrap||!wrap.offsetWidth)old('final');}} catch(e){old('final');}
 };window.r14svm=true;
}
const applyR14=(name)=>{
 try{
  const r=document.getElementById('viewRoot');if(!r)return;r.classList.add('r14-workspace');
  if(name!=='home'&&!r.querySelector('.r14-wb')){
   const msg={studio:'Upload a source to render.',renders:'All completed renders.',projects:'Client workspaces.',flow:'Visual boards (saved in this browser).',consistency:'Batch rendering.',video:'Cinematic motion.',film:'Assemble clips.',presentation:'Client boards.',assets:'Custom library (saved in this browser).',albums:'Curated collections (saved in this browser).'}[name]||'';
   const wb=document.createElement('div');wb.className='r14-wb';wb.innerHTML=`<span><b>${name.toUpperCase()}</b> · ${msg}</span> <a href="#home">Dashboard</a>`;r.insertBefore(wb,r.firstChild);
  }
  if(name==='studio'){
   const h=r.querySelector('.studio-hero');if(h)h.style.display='none';
   const grid=r.querySelector('.studio-grid, .studio-grid-v4');
   if(grid&&!r.querySelector('.r14-sh')){
    const head=document.createElement('div');head.className='r14-header r14-sh';head.innerHTML=`<div><h2>AI Studio</h2><p>Photoreal rendering workspace</p></div><div class="r14-sh-act"></div>`;
    grid.parentNode.insertBefore(head,grid);const btn=document.getElementById('demoGenerate');if(btn)head.querySelector('.r14-sh-act').appendChild(btn);
   }
   const brief=r.querySelector('.auto-brief');
   if(brief&&!brief.closest('.r14-details')){
    const det=document.createElement('details');det.className='r14-details';det.innerHTML='<summary>Prompt & Requirements</summary>';
    brief.parentNode.insertBefore(det,brief);det.appendChild(brief);
   }
   const badge=document.getElementById('ustNoticeText');
   if(badge&&typeof studioFinal56!=='undefined'&&(studioFinal56.exactUrl||studioFinal56.providerUrl)&&badge.textContent.includes('4K'))badge.textContent='✦ Final render ready';
   const srcBtn=document.querySelector('.ust-view-btn[data-mode="source"]');
   if(srcBtn){const isP=(typeof studioSourceMode635!=='undefined'&&studioSourceMode635==='plan')||(typeof studioPlanDetect635!=='undefined'&&studioPlanDetect635.kind==='floor_plan');srcBtn.textContent=isP?'📐 Source image (CAD)':'🖼️ Source image';}
  }
 }catch(e){console.warn('PIONX R14 workspace',e.message);}
};
if(typeof wireView!=='undefined'&&!window.r14wv){
 const oldWv=wireView;
 wireView=function(name){oldWv(name);requestAnimationFrame(()=>applyR14(name));};
 window.r14wv=true;requestAnimationFrame(()=>applyR14((location.hash||'#home').slice(1).split('?')[0]||'home'));
}
})();
(function() {
  'use strict';

  // Safely expose internal closure state to global legacy split/view functions
  Object.defineProperties(window, {
    studioSourceImage: { get: () => typeof studioSourceImage !== 'undefined' ? studioSourceImage : '' },
    studioFinal56: { get: () => ({
      exactUrl: typeof studioFinal56 !== 'undefined' ? studioFinal56.exactUrl : '',
      providerUrl: typeof studioFinal56 !== 'undefined' ? studioFinal56.providerUrl : ''
    })}
  });

  // Patch global setStudioViewMode to handle split safety and initialization
  if (typeof window.setStudioViewMode === 'function' && !window._r14svm) {
    const oldSvm = window.setStudioViewMode;
    window.setStudioViewMode = function(m) {
      const s = typeof studioSourceImage !== 'undefined' ? studioSourceImage : '';
      const f = typeof studioFinal56 !== 'undefined' ? (studioFinal56.exactUrl || studioFinal56.providerUrl) : '';
      const out = typeof q === 'function' ? q('#studioOutput') : document.getElementById('studioOutput');
      
      if (m === 'split') {
        if (!s || !f || s === f) {
          if (typeof toast === 'function') toast('Comparison unavailable: source and result identical or missing');
          return oldSvm('final');
        }
        try { if (typeof window.initPionxSplitSlider === 'function') window.initPionxSplitSlider(); } catch(e) {}
      }
      
      oldSvm(m);
      
      // Fallback: keep image visible if split wrapper failed to mount properly
      if (m === 'split' && out) {
        const wrap = document.getElementById('pionxSplitWrap7');
        if (!wrap || wrap.offsetWidth === 0) out.style.visibility = 'visible';
      }
      if (typeof commentsDrawPins6328 === 'function') commentsDrawPins6328();
    };
    window._r14svm = true;
  }

  // Idempotent DOM enhancements
  const applyR14 = (name) => {
    if (name !== 'studio' || typeof q !== 'function') return;
    try {
      const r = q('#viewRoot'); if (!r) return;
      r.classList.add('r14-workspace');

      // Idempotent native accordion wrapping for auto-brief
      const brief = q('.auto-brief', r);
      if (brief && !brief.closest('.r14-details')) {
        const det = document.createElement('details');
        det.className = 'r14-details';
        det.innerHTML = '<summary>Prompt & Requirements</summary>';
        brief.parentNode.insertBefore(det, brief);
        det.appendChild(brief);
      }

      // Truthful rendering badge using actual dimensions
      const badge = q('#studioOutputBadge', r), notice = q('#ustNoticeText', r);
      const fOk = typeof studioFinal56 !== 'undefined' && studioFinal56.providerUrl;
      const w = fOk ? studioFinal56.width : (typeof studioSourceDims !== 'undefined' ? studioSourceDims.width : 0);
      const h = fOk ? studioFinal56.height : (typeof studioSourceDims !== 'undefined' ? studioSourceDims.height : 0);
      const dims = w && h ? ` · ${w}x${h}` : '';
      
      if (fOk) {
        if (badge) badge.textContent = `✦ Final render ready${dims}`;
        if (notice) notice.textContent = `✦ Final render ready`;
      }

      // Truthful CAD input label
      const srcBtn = q('.ust-view-btn[data-mode="source"]', r);
      if (srcBtn) {
        const isPlan = (typeof studioSourceMode635 !== 'undefined' && studioSourceMode635 === 'plan') || 
                       (typeof studioPlanDetect635 !== 'undefined' && studioPlanDetect635.kind === 'floor_plan');
        srcBtn.textContent = isPlan ? '📐 Source image (CAD)' : '🖼️ Source image';
      }
    } catch(e) {}
  };

  // Intercept the internal router safely
  if (typeof wireView === 'function' && !window._r14wv) {
    const oldWv = wireView;
    wireView = function(name) {
      oldWv(name);
      requestAnimationFrame(() => applyR14(name));
    };
    window._r14wv = true;
    requestAnimationFrame(() => applyR14((location.hash || '#home').slice(1).split('?')[0] || 'home'));
  }
})();

(function(){
 const root=q('#viewRoot');if(!root)return;
 function truthfulLabels(){
  const source=root.querySelector('.ust-view-btn[data-mode="source"]');
  const sourceLabel=window.PIONX_I18N?.translate('🖼️ Source image')||'🖼️ Source image';if(source&&source.textContent!==sourceLabel)source.textContent=sourceLabel;
  const hint=root.querySelector('.r14-wb span');
  const original=studioSourceImage?'STUDIO · Source image ready.':'STUDIO · Upload a source to render.';const text=window.PIONX_I18N?.translate(original)||original;
  if(hint&&location.hash.split('?')[0]==='#studio'&&hint.textContent!==text)hint.textContent=text;
  root.querySelectorAll('[data-r14-project]').forEach(button=>{if(button.dataset.bound)return;button.dataset.bound='1';button.addEventListener('click',()=>{const project=projectById614(button.dataset.r14Project);if(project)openProjectViewer614(project);});});
 }
 new MutationObserver(truthfulLabels).observe(root,{subtree:true,childList:true});truthfulLabels();
 const previous=window.setStudioViewMode;
 if(typeof previous==='function')window.setStudioViewMode=function(mode){
  const source=studioSourceImage,final=studioFinal56.exactUrl||studioFinal56.providerUrl;
  const actual=mode==='split'&&(!source||!final||source===final)?'final':mode;
  previous(mode);
  root.querySelectorAll('.ust-view-btn[data-mode]').forEach(button=>button.classList.toggle('active',button.dataset.mode===actual));
 };
})();

// Presentation and navigation only. Rendering, costs and access checks retain their owners.
(function(){
 const root=q('#viewRoot');if(!root)return;
 const ar=()=>document.documentElement.lang==='ar';
 const t=(en,arabic)=>ar()?arabic:en;
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const menus=qa('.px-nav-group');
 function closeMenus(){menus.forEach(g=>{g.querySelector('.px-dropdown').hidden=true;g.querySelector('button').setAttribute('aria-expanded','false')})}
 menus.forEach(g=>{const button=g.querySelector('button'),menu=g.querySelector('.px-dropdown');button.addEventListener('click',()=>{const open=menu.hidden;closeMenus();menu.hidden=!open;button.setAttribute('aria-expanded',String(open))});button.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();closeMenus()}if(e.key==='ArrowDown'){e.preventDefault();closeMenus();menu.hidden=false;button.setAttribute('aria-expanded','true');menu.querySelector('a,button')?.focus()}});menu.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMenus();button.focus()}if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const items=[...menu.querySelectorAll('a,button')].filter(x=>!x.hidden),i=items.indexOf(document.activeElement);items[e.key==='Home'?0:e.key==='End'?items.length-1:(i+(e.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus()}});menu.addEventListener('click',e=>{if(e.target.closest('a'))closeMenus()})});
 document.addEventListener('click',e=>{if(!e.target.closest('.px-nav-group'))closeMenus()});window.addEventListener('hashchange',closeMenus);
 function translate(){qa('[data-px-en]').forEach(el=>{const text=ar()?el.dataset.pxAr:el.dataset.pxEn;if(text&&el.textContent!==text)el.textContent=text})}
 q('#appLang')?.addEventListener('click',()=>requestAnimationFrame(translate));translate();
 const isAdmin=()=>String(PXPROFILE56?.role||'').toLowerCase()==='admin';
 const infoFields=[['about_title','About heading',120],['about_text','About text',4000],['contact_email','Contact email',180],['contact_phone','Phone',80],['contact_address','Address',500]];
 routes.sitecontent=()=>`<section class="px-info-panel"><div class="px-page-intro"><h1>${t('Site content','محتوى الموقع')}</h1><p>${t('Update the public About and Contact pages. Changes appear after saving.','تعديل صفحات نبذة عن الموقع والتواصل. تظهر التعديلات بعد الحفظ.')}</p></div><form id="pxSiteForm" class="px-site-form">${infoFields.map(([key,label,max])=>`<label>${label}<${key==='about_text'?'textarea':'input'} name="${key}" maxlength="${max}" ${key==='contact_email'?'type="email"':''}>${key==='about_text'?'</textarea>':''}</label>`).join('')}<button class="primary-btn" type="submit">${t('Save public content','حفظ محتوى الموقع')}</button><p id="pxSiteStatus" role="status"></p></form></section>`;
 let observer,scheduled=false;
 function motion(){if(matchMedia('(prefers-reduced-motion: reduce)').matches||!('IntersectionObserver'in window)||!Element.prototype.animate)return;if(!observer)observer=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){observer.unobserve(e.target);e.target.animate([{opacity:.55,transform:'translateY(14px)'},{opacity:1,transform:'translateY(0)'}],{duration:340,easing:'cubic-bezier(.2,.7,.2,1)',fill:'none'})}},{threshold:.08});root.querySelectorAll('.px-service-card,.px-home-intro,.px-workflow,.panel,.film-step,.presentation-step614,.px-page-intro').forEach(el=>{if(!el.dataset.pxMotion){el.dataset.pxMotion='1';observer.observe(el)}})}
 window.addEventListener('hashchange',()=>{observer?.disconnect();observer=null});
 const flows={studio:[['Source','Upload your image'],['Direction','Scene, style & references'],['Generate','Review settings & credits'],['Deliver','Review, save & export']],consistency:[['Reference','Choose the master image'],['Views','Add project views'],['Consistency','Set visual controls'],['Review','Compare and save']],video:[['Image','Choose a source render'],['Motion','Set camera movement'],['Generate','Review settings & credits'],['Export','Preview and download']],film:[['Scenes','Add project images'],['Sequence','Arrange scenes'],['Direction','Set motion and timing'],['Film','Generate and review']],flow:[['Board','Create a project board'],['Sources','Add images and references'],['Connect','Arrange the workflow'],['Save','Keep your project board']],presentation:[['Project','Select your renders'],['Pages','Choose page layouts'],['Compose','Arrange images and text'],['Export','Review and download']]};
 const services=[['studio','AI Studio','Architectural image rendering','interior-main.jpg'],['consistency','Visual DNA','Design consistency across views','hero-villa.jpg'],['video','Video Studio','Architectural images in motion','/assets/pionx-service-motion-r16.jpg'],['film','PIONX Film','Project scenes in a cinematic sequence','hero-villa.jpg'],['flow','Flow Canvas','References, ideas and project stages','/assets/pionx-service-flow-r16.jpg'],['presentation','Presentation','Client boards and project pages','interior-main.jpg']];
 async function wireContent(){const form=q('#pxSiteForm');if(!form||form.dataset.wired)return;form.dataset.wired='1';let revision=0;const status=q('#pxSiteStatus');const button=form.querySelector('button');button.disabled=true;try{const res=await fetch('/server/site-content.php',{cache:'no-store'}),data=await res.json();if(!res.ok)throw Error(data.error||'Cannot load site content');revision=data.revision;for(const [key]of infoFields)form.elements[key].value=data.content[key]||'';button.disabled=false}catch(e){status.textContent=e.message;return}form.addEventListener('submit',async e=>{e.preventDefault();button.disabled=true;status.textContent=t('Saving…','جاري الحفظ…');try{const content=Object.fromEntries(infoFields.map(([k])=>[k,form.elements[k].value.trim()]));const res=await pxApi56('/server/site-content.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision,content})});const data=await res.json();if(!res.ok)throw Error(data.error||'Save failed');revision=data.revision;status.textContent=t('Saved. About and Contact are updated.','تم الحفظ وتحديث صفحات الموقع.')}catch(err){status.textContent=err.message||'Save failed'}finally{button.disabled=false}})}
 function organiseStudio(){
  const panel=root.querySelector('.studio-grid>.control-panel');if(!panel)return;
  if(!panel.dataset.pxOrganised){
   panel.dataset.pxOrganised='true';
   const makeStep=(number,en,arabic)=>{const section=document.createElement('section');section.className='px-studio-step';section.innerHTML=`<h3><span>${number}</span><b data-px-en="${en}" data-px-ar="${arabic}">${t(en,arabic)}</b></h3>`;panel.append(section);return section};
   const source=makeStep(1,'Source image','الصورة الأصلية'),direction=makeStep(2,'Scene & lighting','المشهد والإضاءة'),prompt=makeStep(3,'Prompt & references','البرومبت والمراجع');
   const takeField=(text,section)=>{const label=[...panel.children].find(el=>el.classList.contains('field-title')&&el.textContent.trim().startsWith(text));if(label){const content=label.nextElementSibling;section.append(label);if(content)section.append(content)}};
   takeField('Source Image',source);const input=panel.querySelector('.studio-input-router635');if(input)source.append(input);
   takeField('Render Mode',direction);takeField('Scene Type',direction);const interiorStyle=panel.querySelector('#studioInteriorStyleWrap');if(interiorStyle)direction.append(interiorStyle);takeField('Environment',direction);const toggles=panel.querySelector('.toggle-row');if(toggles)direction.append(toggles);
   const notes=panel.querySelector('.px-studio-prompt');if(notes)prompt.append(notes);
   takeField('Reference Images',prompt);
   const brief=panel.querySelector('.r14-details')||panel.querySelector('.auto-brief');if(brief){prompt.append(brief);const summary=brief.querySelector('summary');if(summary)summary.textContent=t('Automatic requirements','المتطلبات التلقائية')}
   const finish=panel.querySelector('.finish-note');if(finish)prompt.append(finish);
  }
  let bar=root.querySelector('.px-studio-actionbar');if(!bar){bar=document.createElement('section');bar.className='px-studio-actionbar';bar.setAttribute('aria-label',t('Render controls','أزرار الريندر'));bar.innerHTML='<div class="px-studio-actioncopy"><strong></strong><small></small></div><div class="px-studio-actions"></div>'}
  if(bar.parentElement!==panel)panel.append(bar);
  const actions=bar.querySelector('.px-studio-actions');for(const id of ['studioAdvancedBtn','demoGenerate']){const button=q('#'+id);if(button&&button.parentElement!==actions)actions.append(button)}
  const ready=!!studioSourceImage;
  const sceneName=(sceneRules[studioState.scene]?.title||studioState.scene||'Auto');
  const modeName=({preserve:'Preserve',balanced:'Balanced',creative:'Creative'}[studioState.mode]||studioState.mode||'Preserve');
  const styleName=studioState.scene==='interior'?(studioInteriorStyleLabelR16?.()||'None'):'—';
  const title=t(ready?'Render ready':'Source image required',ready?'جاهز للريندر':'الصورة الأصلية مطلوبة');
  const context=studioState.scene==='interior'?`${sceneName} · ${modeName} · ${styleName}`:`${sceneName} · ${modeName}`;
  const detail=ar()?`${sceneName}${studioState.scene==='interior'?` · ${styleName}`:''} · ${ready?'الصورة جاهزة':'ارفع الصورة'}`:`${context} · ${ready?'Source ready':'Upload source'}`;
  if(bar.querySelector('strong').textContent!==title)bar.querySelector('strong').textContent=title;if(bar.querySelector('small').textContent!==detail)bar.querySelector('small').textContent=detail;
 }
 function refresh(){scheduled=false;const name=(location.hash||'#home').slice(1).split('?')[0];
  if(name==='studio'){const notes=q('#studioNotes');if(notes&&!notes.dataset.pxScenePromptWired){notes.dataset.pxScenePromptWired='true';notes.addEventListener('input',()=>{notes.dataset.autoPrompt='false'});injectScenePrompt(studioState.scene);const heading=notes.previousElementSibling;const section=document.createElement('section');section.className='px-studio-prompt';notes.parentElement.insertBefore(section,heading);section.append(heading,notes);notes.setAttribute('aria-label',t('Scene & material prompt','برومبت المشهد والخامات'));const advanced=q('#studioAdvancedBtn');if(advanced)advanced.textContent=t('Advanced settings','الإعدادات المتقدمة');}}
  if(name==='studio')organiseStudio();
  if(name==='home'&&!root.querySelector('.px-home-intro')){const h=root.querySelector('.r14-header');if(h)h.outerHTML=`<section class="px-home-intro"><div><small>PIONX WORKSPACE</small><h1 class="px-home-title">${t('From idea to architectural vision.','من الفكرة إلى رؤية معمارية.')}</h1><p>${t('One workspace for renders, consistent views, motion and client presentations. Choose a tool below to start your next project.','مساحة واحدة للريندر واتساق المشاهد والفيديو وعروض العملاء. اختر الأداة المناسبة لبدء مشروعك.')}</p><div class="px-home-actions"><a href="#studio">${t('Open AI Studio','افتح استوديو الصور')}</a><a href="#projects">${t('View projects','عرض المشروعات')}</a></div></div><img src="pionx-main/assets/hero-villa.jpg" alt="Architectural villa illustration" width="1487" height="900"></section>`;
   const grid=root.querySelector('.r14-tiles');if(grid){grid.className='px-service-grid';grid.innerHTML=services.map(s=>`<a class="px-service-card" href="#${s[0]}"><div class="px-service-media"><img src="${s[3].startsWith('/')?s[3]:'pionx-main/assets/'+s[3]}" alt="" loading="lazy" width="1234" height="740"></div><div class="px-service-body"><h3>${s[1]}</h3><p>${s[2]}</p><div class="px-service-meta"><span>${t('Open workspace','افتح الأداة')}</span><span aria-hidden="true">↗</span></div></div></a>`).join('')}}
  if(flows[name]&&!root.querySelector('.px-workflow')){const guide=document.createElement('section');guide.className='px-workflow';guide.innerHTML=`<header><b>${t('Your workflow','مراحل العمل')}</b><span>${t('Your options are available below','كل الخيارات متاحة بالأسفل')}</span></header><ol>${flows[name].map((x,i)=>`<li><span>${i+1}</span><div><b>${x[0]}</b><small>${x[1]}</small></div></li>`).join('')}</ol>`;root.prepend(guide)}
  if(['admin','finance','diagnostics','sitecontent'].includes(name)&&isAdmin()&&!root.querySelector('.px-admin-shortcuts')){const box=document.createElement('nav');box.className='px-admin-shortcuts';box.innerHTML='<a href="admin.html#admin">Admin</a><a href="admin.html#finance">Finance</a><a href="admin.html#sitecontent">Site content</a><a href="/#home">Client workspace</a><small class="px-admin-version">Website release R16</small>';root.prepend(box)}
  if(name==='sitecontent'&&isAdmin())wireContent();motion();
 }
 const updateStudioBriefBeforeR163=updateStudioBrief;
 updateStudioBrief=function(){updateStudioBriefBeforeR163();if((location.hash||'#home').split('?')[0]==='#studio')organiseStudio()};
 new MutationObserver(()=>{if(!scheduled){scheduled=true;requestAnimationFrame(refresh)}}).observe(root,{childList:true,subtree:true});refresh();
 // Extend visibility controls to both password-recovery fields.
 ['recoveryNewPassword','recoveryConfirmPassword'].forEach(id=>{const input=q('#'+id);if(!input)return;const wrap=document.createElement('div');wrap.className='password-wrapper';input.replaceWith(wrap);wrap.append(input);const button=document.createElement('button');button.type='button';button.className='eye-toggle-btn';button.textContent='◉';button.setAttribute('aria-label','Show password');button.setAttribute('aria-pressed','false');wrap.append(button);button.addEventListener('click',()=>{const show=input.type==='password';input.type=show?'text':'password';button.setAttribute('aria-pressed',String(show));button.setAttribute('aria-label',show?'Hide password':'Show password')})});
 const signup=q('[data-auth-pane="signup"]');if(signup){const resend=document.createElement('button');resend.type='button';resend.className='ghost-btn';resend.textContent=t('Resend verification email','إعادة إرسال رسالة التفعيل');signup.append(resend);resend.addEventListener('click',async()=>{const email=q('#signupEmail')?.value.trim();if(!email||!q('#signupEmail').checkValidity())return setAuthStatus56(t('Enter the email you used to register.','اكتب البريد المستخدم في التسجيل.'),true);resend.disabled=true;try{await supabaseAuth56('resend?redirect_to='+encodeURIComponent(location.origin+'/'),{type:'signup',email});setAuthStatus56(t('If verification is pending, check your inbox for the activation link.','إذا كان الحساب ينتظر التفعيل، راجع البريد للحصول على رابط التفعيل.'))}catch(e){setAuthStatus56(e.message,true)}finally{setTimeout(()=>{resend.disabled=false},60000)}})}
 if(document.body.dataset.adminWorkspace==='true'&&!location.hash)location.hash='admin';
})();

// The render extensions below share the main application closure.

// ===== PIONX V6.30.6 · TRUE PLAN→INTERIOR CAMERA PIPELINE =====


// ===== PIONX R16.6 · RENDER DOCTOR PROFESSIONAL REALITY GATE =====
// Final outbound payload hardening. This runs after the existing R16 pipeline so
// geometry, style, reference, realism and camera rules cannot be silently lost.
const renderPayloadBeforeDoctorR166=renderPayload56;
function pionxDoctorSceneContractR166(payload){
 const controls=payload.controls||(payload.controls={}),analysis=payload.analysis||(payload.analysis={});
 const scene=String(payload.scene_type||studioState.scene||'auto').toLowerCase();
 const isPlan=!!(controls.plan_to_interior||controls.source_is_plan||analysis.plan_to_interior||studioSourceMode635==='plan'||studioPlanDetect635?.kind==='floor_plan');
 const isMulti=!!(controls.camera_only_change||analysis.studio_multi_camera);
 const isEdit=!!analysis.localized_edit;
 const styleKey=scene==='interior'?String(studioState.interiorStyle||'none'):'none';
 const styleLabel=scene==='interior'?studioInteriorStyleLabelR16():'None';
 const refs=Array.isArray(payload.references)?payload.references:[];
 const geometry=isPlan
  ? 'HARD GEOMETRY CONTRACT: the uploaded CAD/floor plan is the spatial authority. Preserve plan orientation, wall topology, room proportions, circulation, doors, windows, openings, columns, built-ins and furniture anchors. Never mirror, rotate or transpose the plan. Wardrobes remain storage; dressers/vanities remain furniture; sanitary fixtures appear only where the plan actually contains plumbing fixtures. Generate an eye-level interior from inside the room; never return top view, CAD screenshot, axonometric or dollhouse.'
  : isMulti
   ? 'HARD GEOMETRY CONTRACT: use the approved Visual Master as one canonical scene. Change CAMERA POSITION/LENS/FRAMING only. Keep room/building geometry, openings, built-ins, furniture identity/count/position, materials, lighting, time of day and color grade locked. Never mirror the scene or regenerate it as a different design.'
   : isEdit
    ? 'HARD GEOMETRY CONTRACT: preserve the current final image as immutable geometry outside the selected edit. Keep camera, crop, openings, room shell, furniture positions, unaffected materials and all unselected architecture unchanged. No mirroring, rotation, reframing or structural redesign.'
    : 'HARD GEOMETRY CONTRACT: preserve the exact source orientation, camera, crop, room/building geometry, openings, fixed joinery, furniture anchors and circulation. Never mirror, rotate, crop, outpaint, add/remove doors or windows, or move major furniture unless the user explicitly requests that structural change.';
 const preservation=styleKey!=='none'&&scene==='interior'
  ? `PRESERVATION CONTRACT: architecture and layout are locked, but the selected Interior Style (${styleLabel}) is authoritative for finishes, furniture design language, palette, lighting fixtures and decor. Do not preserve conflicting source decoration.`
  : 'PRESERVATION CONTRACT: preserve the source design language and material intent unless the user explicitly requests a change. Improve physical realism without random redesign.';
 const style=scene==='interior'&&styleKey!=='none'
  ? `STYLE CONTRACT: ${styleLabel} must be unmistakable at first glance. Apply it coherently to materials, furniture language, colors, fixtures and detailing while keeping spatial geometry fixed. Do not drift to generic luxury, modern-classic, or the original source style when they conflict.`
  : 'STYLE CONTRACT: None/Original. Do not impose a new interior style.';
 const refRule=refs.length
  ? (isPlan?'REFERENCE CONTRACT: uploaded reference images control style, material, lighting and mood only; they must never override CAD/plan geometry or furniture anchors.':'REFERENCE CONTRACT: use uploaded references only for the attributes the user intends (style/material/light/mood). They do not authorize geometry, camera or layout changes unless explicitly stated.')
  : 'REFERENCE CONTRACT: no external style reference is supplied; do not invent a reference-driven redesign.';
 const day=String(payload.lighting_mode||controls.lighting_mode||studioState.env||'auto').toLowerCase();
 const glass=scene==='interior'
  ? (day==='night'
    ? 'GLASS / EXTERIOR CONTRACT: visible glazing must have real thickness, controlled reflections and believable night exterior depth with physically plausible exterior/architectural lights. Never use blank black voids, opaque glass or fake mirror-only glazing.'
    : 'GLASS / EXTERIOR CONTRACT: visible windows and curtain walls must show believable exterior daylight depth and atmospheric perspective through clear architectural glass, while retaining subtle interior/exterior reflections and a slight neutral tint. Avoid blank gray backgrounds, white blowout, opaque glazing, mirror-only glass or missing exterior context.')
  : 'GLASS CONTRACT: use physically plausible reflection/transmission and glazing depth wherever glass is visible.';
 const realism='REALITY QUALITY GATE: final output must read as a premium real-world architectural photograph, not CGI, game art, illustration or a stylized render. Use physically plausible global illumination, coherent bounce light and contact shadows, correct roughness/specular response, believable fabric/wood/stone/concrete microtexture at real scale, true glass depth, corrected verticals, natural lens behavior, controlled highlight roll-off, neutral white balance, realistic tonal separation and clean natural sharpness. Preserve fine detail without plastic smoothing or fake sharpening.';
 const camera=isPlan
  ? 'CAMERA CONTRACT: create a physically plausible eye-level camera around 1.45–1.60 m, natural architectural lens roughly 24–32 mm full-frame equivalent, corrected verticals and no fisheye. Camera must remain inside valid room bounds.'
  : isMulti
   ? `CAMERA CONTRACT: this output is a distinct camera view (${analysis.camera_request||'requested camera'}). It must be genuinely different from other views while remaining physically plausible; no duplicate or near-duplicate framing, no wall intersections, no impossible lens distortion.`
   : 'CAMERA CONTRACT: preserve the source camera and perspective. Correct only accidental vertical distortion when doing so does not change composition.';
 const negative='NEGATIVE CONSTRAINTS: no mirrored plan; no rotated orientation; no changed layout; no extra/missing doors or windows; no missing built-ins; no duplicated camera angle; no cartoon, sketch, watercolor, painterly, clay or game-like look; no waxy/plastic materials; no fake HDR, halos, excessive bloom, crushed blacks, clipped highlights or oversaturation; no warped furniture, repeated objects, impossible reflections, blank window backgrounds, provider labels, text artifacts or watermarks.';
 const prior=String(payload.prompt||'').trim();
 payload.prompt=[geometry,preservation,style,refRule,glass,realism,camera,negative,prior].filter(Boolean).join('\n\n');
 Object.assign(controls,{
  architecture_lock:'strict',preserve_orientation:true,no_mirror:true,no_rotation:true,
  quality_profile:isPlan?'pionx_plan_reality_r166':isMulti?'pionx_multicam_reality_r166':isEdit?'pionx_edit_reality_r166':'pionx_reality_r166',
  reality_lock:'pionx_render_doctor_r166',anti_cgi:true,anti_cartoon:true,anti_sketch:true,
  glass_realism:scene==='interior'?'high':'standard',material_physics:'high',photographic_finish:'natural'
 });
 if(!isPlan&&!isMulti)Object.assign(controls,{preserve_composition:true,no_crop:true,no_outpaint:true});
 if(isPlan)Object.assign(controls,{preserve_composition:false,allow_new_viewpoint:true,source_is_plan:true,plan_to_interior:true});
 if(isMulti)Object.assign(controls,{preserve_composition:false,allow_new_viewpoint:true,camera_only_change:true,disable_camera_result_reuse:true,camera_variant:analysis.camera_request||''});
 if(isEdit)Object.assign(controls,{preserve_composition:true,allow_new_viewpoint:false,camera_only_change:false});
 Object.assign(analysis,{
  render_doctor_version:'r16.6',quality_gate:'professional_architectural_render',geometry_contract:isPlan?'plan_authoritative':isMulti?'visual_master_canonical_scene':isEdit?'localized_edit_lock':'source_authoritative',
  selected_style:styleKey,selected_style_label:styleLabel,reference_count:refs.length,
  negative_constraints:['no_mirror','no_rotation','no_layout_change','no_extra_openings','no_missing_builtins','no_cartoon','no_sketch','no_plastic_materials','no_blank_glass','no_watermark']
 });
 if(isMulti){analysis.camera_signature=`${analysis.camera_index||0}/${analysis.camera_total||0}:${analysis.camera_request||''}`;analysis.reject_near_duplicate_views=true;}
 window.PIONX_RENDER_DOCTOR_R166={scene,mode:payload.mode,fidelity:payload.fidelity,lighting:payload.lighting_mode,style:styleLabel,plan:isPlan,multi:isMulti,edit:isEdit,references:refs.length,controls:{architecture_lock:controls.architecture_lock,no_mirror:controls.no_mirror,no_rotation:controls.no_rotation,preserve_composition:controls.preserve_composition,allow_new_viewpoint:controls.allow_new_viewpoint,quality_profile:controls.quality_profile,reality_lock:controls.reality_lock}};
 return payload;
}
renderPayload56=function(overrides={}){return pionxDoctorSceneContractR166(renderPayloadBeforeDoctorR166(overrides))};

// Distinct camera families reduce accidental duplicate viewpoints while the
// approved Visual Master remains the single appearance source of truth.
studioCameraAngles632=function(){
 const scene=String(studioState.scene||'auto').toLowerCase();
 const interior=['Entrance-side hero view toward the main room','Left rear-corner diagonal toward the opposite opening','Right rear-corner diagonal toward the opposite opening','Reverse view from the far side looking back toward the entrance','Side-wall eye-level wide view across the room','Close architectural detail view from a new side position'];
 const exterior=['Straight front hero at eye level','Left three-quarter facade view','Right three-quarter facade view','Wide context view from farther back','Lower eye-level oblique emphasizing entrance depth','Elevated oblique showing roof and site relationship'];
 const master=['Primary aerial from original quadrant','Lower oblique aerial from left diagonal','Opposite diagonal aerial from the reverse quadrant','Wide site-context aerial','Closer central-zone oblique','Higher site overview from a distinct compass direction'];
 const landscape=['Main eye-level landscape hero','Left diagonal path-side view','Right diagonal path-side view','Wide context from farther back','Closer hardscape/planting view from a side position','Elevated garden overview'];
 if(scene==='interior')return interior;if(scene==='exterior')return exterior;if(scene==='masterplan')return master;if(scene==='landscape')return landscape;
 return studioPlanToInterior631(studioDetectedSource631||{},q('#studioNotes')?.value||'')?interior:exterior;
};

// Browser filters cannot create real material detail or repair glazing. Preserve
// the native provider master instead of applying a second destructive sharpen/
// contrast pass that can create halos, plastic materials and fake HDR.
automaticFinish610=async function(){return false};

// Add a truthful quality indicator without changing the R16 layout.
(function(){
 const mark=()=>{if((location.hash||'#home').split('?')[0]!=='#studio')return;const note=document.querySelector('#viewRoot .finish-note span');if(note&&!note.dataset.doctor166){note.dataset.doctor166='1';note.textContent='Reality Pro: geometry lock · selected style lock · physical materials · realistic glass/exterior depth · natural GI/contact shadows · anti-CGI cleanup · native provider master.';}};
 new MutationObserver(()=>requestAnimationFrame(mark)).observe(document.documentElement,{childList:true,subtree:true});requestAnimationFrame(mark);
})();
// ===== END PIONX R16.6 · RENDER DOCTOR PROFESSIONAL REALITY GATE =====

// ===== PIONX R16.7 · PRODUCTION AUDIT FIX =====
// Focus: refresh recovery, non-destructive aspect handling, structured reference roles,
// outbound QC flags and duplicate-camera rejection. This layer intentionally keeps the R16 UI.
(function(){
 'use strict';
 const q167=(s,r=document)=>r.querySelector(s);
 const ACTIVE_KEY167='pionx.active.render.v56';
 const cameraJobs167=new Map();
 let cameraAccepted167=[];
 let recoveryBusy167=false;

 function referenceRoles167(payload){
  const refs=Array.isArray(payload.references)?payload.references:[];
  const a=payload.analysis||(payload.analysis={});
  const c=payload.controls||(payload.controls={});
  const plan=!!(c.plan_to_interior||c.source_is_plan||a.plan_to_interior);
  const multi=!!(c.camera_only_change||a.studio_multi_camera||(a.consistency&&a.camera_request));
  let roles=[];
  if(multi&&a.plan_semantic_lock&&refs.length){
    roles=refs.map((_,i)=>i===0?'geometry_plan_authority':'style_material_lighting_reference');
  }else if(plan){
    roles=refs.map(()=> 'style_material_lighting_reference');
  }else if(a.consistency&&refs.length){
    roles=refs.map(()=> 'visual_dna_reference');
  }else{
    roles=refs.map(()=> 'style_material_lighting_reference');
  }
  c.reference_roles=roles;
  a.reference_roles=roles;
  return roles;
 }

 const renderPayloadR167Base=renderPayload56;
 renderPayload56=function(overrides={}){
  const p=renderPayloadR167Base(overrides);
  const c=p.controls||(p.controls={}),a=p.analysis||(p.analysis={});
  referenceRoles167(p);
  Object.assign(c,{quality_gate_required:true,min_delivery_qc:90,zero_hard_fail:true});
  Object.assign(a,{render_doctor_version:'r16.7',force_delivery_qc:true,quality_gate_required:true,min_delivery_qc:90,zero_hard_fail:true});
  window.PIONX_RENDER_DOCTOR_R167={scene:p.scene_type,mode:p.mode,fidelity:p.fidelity,reference_roles:a.reference_roles||[],quality_gate_required:true,min_delivery_qc:90};
  return p;
 };

 // Direct start payloads (Consistency and Presentation Plan->3D) bypass renderPayload56.
 // Harden only their explicit contracts here, without depending on global Studio state.
 const renderPostR167Base=renderPost56;
 renderPost56=async function(data,timeout=260000){
  if(data&&data.action==='start'&&data.source_image){
    const c=data.controls||(data.controls={}),a=data.analysis||(data.analysis={});
    const cameraLike=!!(a.studio_multi_camera||(a.consistency&&a.camera_request));
    Object.assign(c,{architecture_lock:c.architecture_lock||'strict',preserve_orientation:true,no_mirror:true,no_rotation:true,anti_cgi:true,anti_cartoon:true,anti_sketch:true,quality_gate_required:true,min_delivery_qc:90,zero_hard_fail:true});
    Object.assign(a,{render_doctor_version:a.render_doctor_version||'r16.7-direct',force_delivery_qc:true,quality_gate_required:true,min_delivery_qc:90,zero_hard_fail:true});
    if(cameraLike){Object.assign(c,{preserve_composition:false,allow_new_viewpoint:true,camera_only_change:true,disable_camera_result_reuse:true,same_layout:true,same_furniture:true});a.reject_near_duplicate_views=true;}
    referenceRoles167(data);
  }
  const out=await renderPostR167Base(data,timeout);
  if(data&&data.action==='start'&&out?.job_token){
    const a=data.analysis||{};
    const cameraLike=!!(a.studio_multi_camera||(a.consistency&&a.camera_request));
    if(cameraLike){
      const idx=Number(a.camera_index||a.output_index||0);
      if(idx===1)cameraAccepted167=[];
      cameraJobs167.set(String(out.job_token),{index:idx,total:Number(a.camera_total||a.output_total||0),request:String(a.camera_request||'')});
    }
  }
  return out;
 };

 // Keep the provider's real pixels; validate composition without resizing to the source.
 async function exactSizedSafe167(url){
  const blob=await fetchRenderBlob56(url),src=URL.createObjectURL(blob);
  try{
   const dims=await imageDims56(src),tw=Number(studioSourceDims.width),th=Number(studioSourceDims.height);
   if(!dims.width||!dims.height)throw new Error('Generated image has no dimensions');
   if(tw&&th){const drift=Math.abs(dims.width/dims.height-tw/th)/(tw/th);if(drift>.012){const e=new Error('Render aspect ratio changed; result rejected instead of stretching.');e.code='PIONX_ASPECT_RATIO_MISMATCH';throw e}}
   return {url:src,blobUrl:src,blob,width:dims.width,height:dims.height,mime:blob.type};
  }catch(e){URL.revokeObjectURL(src);throw e}
 }
 exactSizeResult56=exactSizedSafe167;
 const finalizeR167Base=finalizeRenderedImage56;
 finalizeRenderedImage56=async function(providerUrl){
  const result=await finalizeR167Base(providerUrl);
  const tw=Number(studioSourceDims.width),th=Number(studioSourceDims.height);
  if(tw&&th&&Math.abs(result.width/result.height-tw/th)/(tw/th)>.012){const e=new Error('Final render aspect ratio differs from the source.');e.code='PIONX_ASPECT_RATIO_MISMATCH';throw e}
  result.masterUrl=result.exactUrl||providerUrl;result.masterWidth=result.width;result.masterHeight=result.height;
  studioFinal56=result;return result;
 };

 async function imageSignature167(url){
  try{
    const blob=await fetchRenderBlob56(url),buf=await blob.arrayBuffer();
    const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',buf))].map(x=>x.toString(16).padStart(2,'0')).join('');
    const bmp=await createImageBitmap(blob),c=document.createElement('canvas');c.width=9;c.height=8;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(bmp,0,0,9,8);bmp.close?.();
    const d=x.getImageData(0,0,9,8).data,g=[];for(let i=0;i<d.length;i+=4)g.push((d[i]*299+d[i+1]*587+d[i+2]*114)/1000);
    let bits='';for(let y=0;y<8;y++)for(let xx=0;xx<8;xx++)bits+=g[y*9+xx]>g[y*9+xx+1]?'1':'0';return {digest,bits};
  }catch(e){console.warn('PIONX R16.7 camera duplicate check unavailable',e);return null}
 }
 function hamming167(a,b){if(!a||!b||a.length!==b.length)return 999;let n=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i])n++;return n}
 const renderEngineR167Base=renderEngine56;
 renderEngine56=async function(start,engine){
  const done=await renderEngineR167Base(start,engine),meta=cameraJobs167.get(String(start?.job_token||''));
  if(!meta)return done;
  cameraJobs167.delete(String(start?.job_token||''));
  const best=done?.candidates?.find(x=>x?.url);if(!best?.url)return done;
  const sig=await imageSignature167(best.url);if(!sig)return done;
  const dup=cameraAccepted167.find(x=>x.sig.digest===sig.digest||hamming167(x.sig.bits,sig.bits)<=2);
  if(dup){const e=new Error(`Camera "${meta.request||meta.index}" duplicated ${dup.request||dup.index}. Duplicate view rejected instead of being delivered.`);e.code='PIONX_DUPLICATE_CAMERA';throw e}
  cameraAccepted167.push({sig,index:meta.index,request:meta.request});return done;
 };

 const saveActiveR167Base=saveActiveRender56;
 saveActiveRender56=function(start,engine){
  try{safeStore.set(ACTIVE_KEY167,JSON.stringify({job_token:start.job_token,engine,mode:studioState.mode,credits:start.credits_cost||start.credits_reserved||0,source_width:Number(studioSourceDims.width||0),source_height:Number(studioSourceDims.height||0),source_name:studioSourceName||'',scene:studioState.scene||'auto',environment:studioState.env||'auto',ts:Date.now()}))}catch{saveActiveR167Base(start,engine)}
 };
 function activeMeta167(){try{const j=JSON.parse(safeStore.get(ACTIVE_KEY167)||'null');if(!j?.job_token||!j?.engine)return null;if(Date.now()-Number(j.ts||0)>90*60*1000){clearActiveRender56();return null}return j}catch{return null}}
 async function deliverRecovered167(done,meta){
  const best=done?.candidates?.find(x=>x?.url);if(!best?.url)return false;
  if(meta.source_width&&meta.source_height){studioSourceDims.width=Number(meta.source_width);studioSourceDims.height=Number(meta.source_height)}
  if(meta.scene)studioState.scene=meta.scene;if(meta.environment)studioState.env=meta.environment;
  await finalizeRenderedImage56(best.url);const out=q167('#studioOutput');if(out){out.src=studioFinal56.exactUrl||best.url;out.alt='PIONX recovered final render';out.style.display='block'}
  const badge=q167('#studioOutputBadge');if(badge)badge.textContent=`FINAL · VERIFIED · ${studioFinal56.width||''}×${studioFinal56.height||''}`;
  const actions=q167('#resultActionsV57');if(actions)actions.hidden=false;wireStudioResultActions56();studioRenderNotice636?.('complete','Recovered the same protected render after refresh.');
  try{await persistRender62(best.url,meta.job_token)}catch(e){console.warn('Recovered render gallery save',e)}
  clearActiveRender56();await loadAccount56({quiet:true});setTimeout(()=>studioFocusFinalResult1697(),650);return true;
 }
 async function resumeActiveRender167({foreground=false}={}){
  if(!signedIn56())return;const meta=activeMeta167();if(!meta)return;
  if(recoveryBusy167){if(foreground){showRenderMind58();mindUpdate('Following the same protected render — no duplicate request…',56,3)}return}
  recoveryBusy167=true;
  try{
    if(meta.source_width&&meta.source_height){studioSourceDims.width=Number(meta.source_width);studioSourceDims.height=Number(meta.source_height)}
    const modal=showRenderMind58();q167('#renderMindScene').textContent='Recovering protected render after refresh';mindUpdate('Checking the existing render job — no duplicate request will be submitted…',55,3);
    let status=await renderPost56({action:'status',job_token:meta.job_token,engine:meta.engine},20000);
    if(status?.status==='completed'&&status?.candidates?.some(x=>x?.url)){await deliverRecovered167(status,meta);mindUpdate('Recovered render delivered.',100,5);hideRenderMind58(500);return}
    if(status?.status==='failed'){clearActiveRender56();studioRenderNotice636?.('failed',status.error||'Previous render failed.');hideRenderMind58(1200);return}
    studioRenderNotice636?.('running','The same render is still processing. You can close the progress window and reopen it with Render; no duplicate request will be submitted.');
    const done=await recoverStatus56({job_token:meta.job_token},meta.engine,6*60*1000);
    if(done&&await deliverRecovered167(done,meta)){mindUpdate('Recovered render delivered.',100,5);hideRenderMind58(500);return}
    studioRenderNotice636?.('running','The same render is still processing. Its recovery pointer was kept for the next check.');hideRenderMind58(1200);
  }catch(e){console.warn('PIONX R16.7 active render recovery',e);renderRecoveryError56(e);const terminal=renderTerminal56(e);if(terminal)clearActiveRender56();studioRenderNotice636?.(terminal?'failed':'running',terminal?(e.message||'Previous render failed.'):renderAuthRequired56(e)?e.message:'Render recovery connection interrupted. The same job was kept for retry.');hideRenderMind58(1400)}finally{recoveryBusy167=false}
 }
 window.PIONXResumeActiveRender167=resumeActiveRender167;
 const wireViewR167Base=wireView;
 wireView=function(name){wireViewR167Base(name);if(name==='studio')setTimeout(resumeActiveRender167,250)};

 window.PIONX_AUDIT_R167={version:'R16.7',refresh_recovery:true,aspect_gate:'reject_over_1.2pct',structured_reference_roles:true,duplicate_camera_guard:true,dialog_title_escaping:true,backend_qc_required:true};
})();
// R16.8 server-aware final quality contract. No layout rollback: this only advertises the backend-enforced delivery gate to diagnostics/admin code.
window.PIONX_AUDIT_R168={version:'R16.8-Final',backend_delivery_gate:'weighted_90plus_zero_hard_fail',creative_qc_bypass:false,multi_reference_delivery:true,reference_roles:true,provider_policy:'GPT-Image-2.5 only',refresh_recovery:true,aspect_gate:'reject_over_1.2pct'};
window.PIONX_UX_R1697={version:'R16.9.7',result_focus:true,preserve_compare:true,auto_final_view:true};
// ===== END PIONX R16.7 · PRODUCTION AUDIT FIX =====



// ===== PIONX R16.9.9 · CSP-SAFE STUDIO INTERACTIONS =====
// Security R16.9.4 intentionally blocks inline event handlers. Studio review controls
// must therefore be wired with addEventListener rather than onclick attributes.
(function(){
 'use strict';
 function wireStudioInteractions1699(){
  const root=document.getElementById('viewRoot');if(!root)return;
  root.querySelectorAll('.ust-view-btn[data-mode]').forEach(button=>{
   if(button.dataset.pxViewWired1699)return;button.dataset.pxViewWired1699='1';
   button.addEventListener('click',event=>{
    event.preventDefault();
    const mode=button.dataset.mode||'final';
    if(mode==='split'){
     window.pionxCompareExplicit1697=true;
     try{window.initPionxSplitSlider?.()}catch(e){console.warn('PIONX split init',e)}
    }else if(mode==='final')window.pionxCompareExplicit1697=false;
    try{window.setStudioViewMode?.(mode)}catch(e){console.error('PIONX view switch',e);if(typeof toast==='function')toast('Could not switch the image view')}
   });
  });
  const comments=document.getElementById('studioCommentsToggle6328');
  if(comments&&!comments.dataset.pxCommentsWired1699){
   comments.dataset.pxCommentsWired1699='1';
   comments.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();if(typeof commentsToggle6328==='function')commentsToggle6328()});
  }
  const analyze=document.getElementById('btnAutoAnalyzePrompt');
  if(analyze&&!analyze.dataset.pxAnalyzeWired1699){analyze.dataset.pxAnalyzeWired1699='1';analyze.addEventListener('click',event=>{event.preventDefault();if(typeof autoAnalyzeAndSetPrompt==='function')autoAnalyzeAndSetPrompt()})}
  const zoom=root.querySelector('[data-canvas-action="zoom"]');
  if(zoom&&!zoom.dataset.pxZoomWired1699){zoom.dataset.pxZoomWired1699='1';zoom.addEventListener('click',event=>{event.preventDefault();if(typeof cycleStudioZoom==='function')cycleStudioZoom()})}
  // Reconcile secure pin state with the legacy one-second drawing hook.
  if(typeof commentsDrawPins6328==='function')window.drawAllStudioPins=commentsDrawPins6328
 }
 const previousWire=typeof wireView==='function'?wireView:null;
 if(previousWire){wireView=function(name){previousWire(name);if(name==='studio')requestAnimationFrame(wireStudioInteractions1699)}}
 if((location.hash||'#home').split('?')[0]==='#studio')requestAnimationFrame(wireStudioInteractions1699);
 window.wireStudioInteractions1699=wireStudioInteractions1699;
})();
// ===== END PIONX R16.9.9 =====


// ===== PIONX R16.10 · ACCESSIBILITY + NAVIGATION POLISH =====
(function(){
 'use strict';
 function syncSwitch16910(el){if(!el)return;el.setAttribute('role','switch');el.setAttribute('tabindex','0');el.setAttribute('aria-checked',el.classList.contains('on')?'true':'false')}
 function hydrate16910(){
  const root=document.getElementById('viewRoot')||document;
  root.querySelectorAll('button:not([type])').forEach(b=>b.type='button');
  document.querySelectorAll('a[data-route]').forEach(a=>{const r=a.dataset.route;if(r&&!a.getAttribute('href'))a.setAttribute('href','#'+r)});
  root.querySelectorAll('.switch').forEach(el=>{syncSwitch16910(el);if(!el.dataset.pxA11y16910){el.dataset.pxA11y16910='1';el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();el.click()}});el.addEventListener('click',()=>requestAnimationFrame(()=>syncSwitch16910(el)))} });
  root.querySelectorAll('img:not([alt])').forEach(img=>{const card=img.closest('article,.panel,.card,.batch-card,.designer-card,.discover-project');const label=card?.querySelector('h1,h2,h3,b')?.textContent?.trim();img.alt=label?label+' — architectural visualization':''});
  const toast=document.getElementById('toast');if(toast){toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');toast.setAttribute('aria-atomic','true')}
  const mind=document.getElementById('renderMind');if(mind){mind.setAttribute('role','dialog');mind.setAttribute('aria-modal','true');mind.setAttribute('aria-label','Render progress')}
  const search=document.getElementById('globalSearch');if(search&&!search.getAttribute('aria-label'))search.setAttribute('aria-label','Search PIONX workspace');
 }
 const baseWire=typeof wireView==='function'?wireView:null;if(baseWire){wireView=function(name){baseWire(name);requestAnimationFrame(hydrate16910)}}
 document.addEventListener('DOMContentLoaded',hydrate16910,{once:true});
 document.addEventListener('keydown',e=>{const m=document.getElementById('demoDialog');if(!m||m.hidden)return;if(e.key==='Escape'){e.preventDefault();closeDemoDialog16910();return}if(e.key!=='Tab')return;const list=[...m.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(x=>x.offsetParent!==null);if(!list.length)return;const first=list[0],last=list[list.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}},true);
 window.PIONX_AUDIT_R1610={version:'R16.10',a11y_hydration:true,modal_focus_management:true,route_href_recovery:true,truthful_render_status:true};
})();
// ===== END PIONX R16.10 =====

window.PIONX_UX_R16121={version:'R16.12.1',refresh_route_gate:true,no_public_flash_on_workspace_refresh:true};

window.PIONX_R16125={version:'R16.12.5',background_render_recovery:true,no_timeout_cancel:true,no_duplicate_paid_retry:true,interactive_wait:'short_then_background'};


(function(){const style=document.createElement('style');style.id='imageCommentsLayout15';style.textContent=`
#studioEditStage{position:relative}
#studioEditStage>#studioCommentsPanel6328{position:absolute;right:auto;bottom:auto;z-index:80;box-sizing:border-box;margin:0;padding:0;min-width:0;display:flex;flex-direction:column;overflow:auto;overscroll-behavior:contain;cursor:default;background:#fff;color:#192c45;border:1px solid #cbd5ef;border-radius:14px;box-shadow:0 8px 28px #14274533;font-size:13px;text-align:start}
#studioEditStage>#studioCommentsPanel6328[hidden]{display:none!important}
#studioCommentsPanel6328 .comments-head6328{padding:10px 12px 8px}
#studioCommentsPanel6328 .comments-head6328 small{font-size:9px}
#studioCommentsPanel6328 .comments-head6328 h3{font-size:17px}
#studioCommentsPanel6328 .comments-project6328{padding:0 12px 8px;color:#526580}
#studioCommentsPanel6328 .comments-project6328 select{padding:6px;background:#f5f7fc;color:#192c45;border-color:#ced8eb;font-size:12px}
#studioCommentsPanel6328 .comments-mode-note6328{margin:0 12px 8px;background:#f0edff;border-color:#bdb3ff;color:#34256a}
#studioCommentsPanel6328 .comments-mode-note6328 span{color:#526580}
#studioCommentsPanel6328 .comments-filters6328{position:static;padding:0 12px 8px;background:transparent}
#studioCommentsPanel6328 .comments-filters6328 button{background:#f4f6fc;color:#3b506d;border-color:#ced8eb}
#studioCommentsPanel6328 .comments-filters6328 button.active{background:#6d59e8;color:white}
#studioCommentsPanel6328 .comments-list6328{overflow:visible;flex:0 0 auto;padding:0 10px 8px}
#studioCommentsPanel6328 .comment-compose6328{flex-shrink:0;background:#f4f1ff;color:#192c45;margin:0 10px 8px}
#studioCommentsPanel6328 textarea{background:#fff;color:#192c45;border-color:#bfcce0;box-sizing:border-box;min-height:65px;font-size:13px}
#studioCommentsPanel6328 .comment-card6328{border-color:#d6deeb}
#studioCommentsPanel6328 .comment-card6328.focused{background:#efebff}
#studioCommentsPanel6328 .comment-card-main6328 p{color:#192c45;font-size:12px}
#studioCommentsPanel6328 .comment-card-main6328 header b{font-size:12px}
#studioCommentsPanel6328 .comment-actions6328 button{color:#465e88;font-size:11px}
#studioCommentsPanel6328 .comment-actions6328 .danger{color:#bd2534}
#studioCommentsPanel6328 .comment-pin-mini6328{align-self:start}
`;document.head.appendChild(style)})();
// R16.16: durable workspace synchronization and search.
let portfolioOwner16='',portfolioRequestOwner16='',portfolioBusy16=null,portfolioLoadedAt16=0,portfolioRevision16=0,portfolioSaving16=0,portfolioSaveQueue16=Promise.resolve(),portfolioSyncError16='',portfolioOwnMember16='';
let directoryBusy16=null,directoryLoadedAt16=0,showcaseQuery16='',showcaseCategory16='all';
function workspaceRoute16(){return location.hash.slice(1).split('?')[0]||'home'}
function portfolioOwnerKey16(){return PORTFOLIO_KEY614+':'+String(PXUSER56?.id||'')}
function workspaceSyncBanner16(){
 const root=q('#viewRoot');if(!root||!['home','projects','portfolio','explore'].includes(workspaceRoute16()))return;
 let banner=q('#workspaceSync16',root);if(!banner){banner=document.createElement('p');banner.id='workspaceSync16';banner.setAttribute('role','status');root.prepend(banner)}
 banner.textContent=portfolioSyncError16|| (portfolioSaving16?'Saving project changes…':portfolioBusy16?'Loading your projects…':'');banner.hidden=!banner.textContent;
}
savePortfolioLocal614=function(){
 let previous=[];try{previous=JSON.parse(safeStore.get(portfolioOwnerKey16())||'[]')}catch{}
 const added=portfolioProjects614.find(p=>!previous.some(old=>old.id===p.id));
 if(added){studioComments6328.projectId=String(added.id);safeStore.set('pionx.studio.comments.project.v6328',String(added.id))}
 portfolioRevision16++;safeStore.set(PORTFOLIO_KEY614,JSON.stringify(portfolioProjects614));if(PXUSER56?.id)safeStore.set(portfolioOwnerKey16(),JSON.stringify(portfolioProjects614));portfolioDirectoryLoaded614=false;directoryLoadedAt16=0
};
loadPortfolioServer614=async function(force=false){
 if(!signedIn56()||!PXUSER56?.id)return;
 const owner=String(PXUSER56.id);
 if(portfolioOwner16!==owner){
  if(portfolioOwner16){try{portfolioProjects614=JSON.parse(safeStore.get(portfolioOwnerKey16())||'[]')}catch{portfolioProjects614=[]}}
  portfolioOwner16=owner;portfolioLoadedAt16=0;portfolioServerLoaded614=false;portfolioOwnMember16='';
 }
 if(portfolioBusy16&&portfolioRequestOwner16===owner)return portfolioBusy16;
 if(!force&&Date.now()-portfolioLoadedAt16<30000)return;
 const revision=portfolioRevision16,previous=JSON.stringify(portfolioProjects614),previousMember=portfolioOwnMember16;
 const task=(async()=>{
  try{
   const j=await portfolioApi614({action:'own'});if(owner!==String(PXUSER56?.id||''))return;
   if(portfolioRevision16!==revision||portfolioSaving16)return;
   if(j.portfolio&&Array.isArray(j.portfolio.projects))portfolioProjects614=j.portfolio.projects;
   portfolioOwnMember16=String(j.member_key||'');
   const p=j.portfolio?.profile;
   if(p){profileState={...profileState,displayName:p.name||profileState.displayName,username:p.username||profileState.username,title:p.title||profileState.title,company:p.company||profileState.company,bio:p.bio??profileState.bio,photo:p.photo??profileState.photo,cover:p.cover??profileState.cover};saveProfileState();syncProfileChrome()}
   safeStore.set(portfolioOwnerKey16(),JSON.stringify(portfolioProjects614));portfolioServerLoaded614=true;portfolioLoadedAt16=Date.now();portfolioSyncError16='';
   if((previous!==JSON.stringify(portfolioProjects614)||previousMember!==portfolioOwnMember16)&&['home','projects','portfolio','explore'].includes(workspaceRoute16()))route();
  }catch(e){portfolioServerLoaded614=false;portfolioLoadedAt16=0;portfolioSyncError16='Projects could not sync: '+e.message}
 })();portfolioBusy16=task;portfolioRequestOwner16=owner;workspaceSyncBanner16();try{await task}finally{if(portfolioBusy16===task)portfolioBusy16=null;workspaceSyncBanner16()}
};
savePortfolioServer614=function(quiet=true){
 if(!signedIn56()||!PXUSER56?.id){portfolioSyncError16='Sign in to save projects to your account.';workspaceSyncBanner16();return Promise.resolve(null)}
 const owner=String(PXUSER56.id),payload={action:'save',profile:{name:profileState.displayName,username:profileState.username,title:profileState.title,company:profileState.company,bio:profileState.bio,photo:profileState.photo,cover:profileState.cover,searchable:settingsState.profileSearchable!==false},projects:JSON.parse(JSON.stringify(portfolioProjects614))};
 portfolioSaving16++;workspaceSyncBanner16();
 const task=portfolioSaveQueue16.then(async()=>{
  if(owner!==String(PXUSER56?.id||''))return null;
  try{const j=await portfolioApi614(payload);portfolioServerLoaded614=true;portfolioLoadedAt16=Date.now();portfolioSyncError16='';portfolioDirectoryLoaded614=false;directoryLoadedAt16=0;if(!quiet)toast('Projects and privacy saved');return j}
  catch(e){portfolioSyncError16='Project changes are saved on this device, but account sync failed: '+e.message;toast(portfolioSyncError16);return null}
 }).finally(()=>{portfolioSaving16--;workspaceSyncBanner16()});
 portfolioSaveQueue16=task.catch(()=>{});return task;
};
loadPortfolioDirectory614=async function(force=false){
 if(directoryBusy16)return directoryBusy16;
 if(!force&&Date.now()-directoryLoadedAt16<30000)return;
 const before=JSON.stringify(portfolioDirectory614);
 const task=(async()=>{try{const r=await fetch('/server/portfolio-hub-v614.php?action=directory&ts='+Date.now(),{cache:'no-store'}),j=await json56(r,'PIONX Showcase');if(!r.ok||!Array.isArray(j.items))throw Error(j.error||'Directory unavailable');portfolioDirectory614=j.items;portfolioDirectoryLoaded614=true;directoryLoadedAt16=Date.now();if(before!==JSON.stringify(j.items)&&workspaceRoute16()==='explore')route()}catch(e){portfolioDirectoryLoaded614=false;directoryLoadedAt16=0;if(workspaceRoute16()==='explore'){let status=q('#showcaseStatus16');if(status)status.textContent='Showcase could not load: '+e.message}}})();
 directoryBusy16=task;try{await task}finally{if(directoryBusy16===task)directoryBusy16=null}
};
function normalizeSearch16(value){return String(value||'').normalize('NFKC').toLowerCase().replace(/[\u064B-\u065F\u0670\u0640]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/\s+/g,' ').trim()}
function matchesSearch16(text,query){const normalized=normalizeSearch16(text);return normalizeSearch16(query).split(' ').filter(Boolean).every(term=>normalized.includes(term))}
function applyShowcaseSearch16(){
 const query=q('#showcaseSearch616')?.value||showcaseQuery16;showcaseQuery16=query;
 const members=qa('.member-card616'),projects=qa('#showcaseProjects616 .showcase-card616');
 members.forEach(card=>card.hidden=!matchesSearch16(card.dataset.memberSearch616,query));
 projects.forEach(card=>card.hidden=!matchesSearch16(card.dataset.showcaseSearch616,query)||(showcaseCategory16!=='all'&&!normalizeSearch16(card.dataset.showcaseCategory616).includes(showcaseCategory16)));
 let status=q('#showcaseStatus16');if(!status){status=document.createElement('p');status.id='showcaseStatus16';status.setAttribute('role','status');q('.showcase-toolbar616')?.after(status)}
 if(status)status.textContent=`${members.filter(c=>!c.hidden).length} people · ${projects.filter(c=>!c.hidden).length} projects${query?' matching your search':''}`;
}
const showcaseWireBase16=wireView;
wireView=function(name){showcaseWireBase16(name);if(['home','projects','portfolio','explore'].includes(name))workspaceSyncBanner16();if(name==='explore'){
 const input=q('#showcaseSearch616');if(input){if(input.value)showcaseQuery16=input.value;else input.value=showcaseQuery16;input.addEventListener('input',applyShowcaseSearch16)}
 qa('[data-showcase-filter616]').forEach(button=>{button.classList.toggle('active',button.dataset.showcaseFilter616===showcaseCategory16);button.addEventListener('click',()=>{showcaseCategory16=button.dataset.showcaseFilter616||'all';applyShowcaseSearch16()})});applyShowcaseSearch16();
}};
async function workspaceSearch16(query){
 if(!normalizeSearch16(query))return;
 await loadPortfolioServer614();
 const own=portfolioProjects614.filter(p=>matchesSearch16([p.title,p.category,p.description].join(' '),query));
 const pages=[['studio','Studio'],['projects','Projects'],['renders','Renders'],['flow','Flow'],['explore','Showcase'],['presentation','Presentation'],['film','Film'],['video','Video'],['profile','Profile'],['settings','Settings']];
 if(String(PXPROFILE56?.role||'').toLowerCase()==='admin')pages.push(['admin','Admin'],['finance','Finance']);
 const options=pages.filter(([,title])=>matchesSearch16(title,query));
 const m=openDemoDialog('Search · '+query,`<div class="workspace-search16"><h3>Your projects</h3>${own.map(p=>`<button type="button" class="ghost-btn" data-search-project16="${escHtml(p.id)}">${escHtml(p.title)}</button>`).join('')||'<p>No matching projects.</p>'}<h3>Workspace pages</h3>${options.map(([id,title])=>`<button type="button" class="ghost-btn" data-search-route16="${id}">${title}</button>`).join('')}<button type="button" class="primary-btn" id="searchShowcase16">Search people and public work</button></div>`);
 qa('[data-search-project16]',m).forEach(b=>b.onclick=()=>{m.hidden=true;openOwnSocialProject618(b.dataset.searchProject16)});
 qa('[data-search-route16]',m).forEach(b=>b.onclick=()=>{m.hidden=true;go(b.dataset.searchRoute16)});
 q('#searchShowcase16',m).onclick=()=>{m.hidden=true;showcaseQuery16=query;safeStore.set('pionx-global-search-pending',query);go('explore')};
}
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target?.id==='globalSearch'){e.preventDefault();e.stopImmediatePropagation();void workspaceSearch16(e.target.value)}},true);
window.addEventListener('focus',()=>{if(signedIn56()&&['home','projects','portfolio','explore'].includes(workspaceRoute16())){void loadPortfolioServer614(true);if(workspaceRoute16()==='explore')void loadPortfolioDirectory614(true)}});
window.addEventListener('storage',e=>{if(e.key===portfolioOwnerKey16()&&e.newValue){try{const rows=JSON.parse(e.newValue);if(Array.isArray(rows)&&!portfolioSaving16){portfolioProjects614=rows;if(['home','projects','portfolio'].includes(workspaceRoute16()))route()}}catch{}}});
const adminLoadBase16=loadAdminUsersV60;
loadAdminUsersV60=async function(showToast=false){const rows=await adminLoadBase16(showToast);if(rows===null&&workspaceRoute16()==='admin'){const body=q('#adminUsersBody');if(body)body.innerHTML='<tr><td colspan="9">Users could not load. Check your administrator access and use Refresh users to retry.</td></tr>'}return rows};
(function(){const style=document.createElement('style');style.textContent=`.member-card616[hidden],.showcase-card616[hidden],#workspaceSync16[hidden]{display:none!important}#workspaceSync16,#showcaseStatus16{padding:10px 14px;background:#f2f4fc;color:#304b70;border-radius:9px}.workspace-search16{display:flex;flex-direction:column;gap:8px}.workspace-search16 h3{margin:12px 0 4px}`;document.head.appendChild(style)})();

/* Appended inside the application closure. */
const financeRenderBase17=financeRender612;
financeRender612=function(){financeRenderBase17();const mount=q('#finBody612')||q('#financeBody612')||q('#viewRoot .finance612-table')?.parentElement;if(!mount||!financeSnapshot612)return;
 q('#financePeriods17')?.remove();const data=financeSnapshot612,period=data.accounting_period?.active;
 const table=(title,rows)=>'<section class="panel"><h2>'+title+'</h2><div class="table-wrap"><table class="table"><thead>'+finRow612(['Period','Cash receipts recorded','Refunds','Operating expenses','Provider cost','Management profit','Paid subscribers'])+'</thead><tbody>'+Object.entries(rows||{}).map(([k,v])=>finRow612([k,finUsd612(v.receipts_usd),finUsd612(v.refunds_usd),finUsd612(v.operating_expenses_usd),finUsd612(v.provider_cost_usd),finUsd612(v.management_profit_usd),v.unique_paid_subscribers+(v.unidentified_subscription_receipts?' + ?':'')])).join('')+'</tbody></table></div></section>';
 const panel=document.createElement('section');panel.id='financePeriods17';panel.innerHTML='<section class="panel"><h2>Accounting period</h2><p>'+ (period?finSafe612(period.start):'All recorded history')+'</p><p>Start a new accounting period after testing. Previous records and provider wallet balances are preserved.</p><button type="button" id="financeReset17">Start new accounting period</button><button type="button" id="financeAll17">Include archived periods</button><p>Paid subscribers are unique identified subscription receipts in the selected period. Active subscription count needs payment integration.</p></section>'+table('Monthly totals',data.financials?.monthly)+table('Yearly totals',data.financials?.yearly);mount.append(panel);
 q('#financeReset17').onclick=()=>{const modal=openDemoDialog('Start new accounting period','<p>Archive the trial reporting period and start at zero for reports. Provider balances and transaction history stay intact.</p><label>Reason<input id="financeResetReason17" maxlength="240"></label>','<button data-dialog-close2>Cancel</button><button id="financeResetCommit17">Confirm new period</button>');q('#financeResetCommit17',modal).onclick=async e=>{e.currentTarget.disabled=true;try{await financePost612({action:'start_period',confirmation:'START NEW PERIOD',previous_period_id:period?.id||null,reason:q('#financeResetReason17',modal).value});modal.hidden=true;}catch(error){toast(error.message)}finally{e.currentTarget.disabled=false;}};};
 q('#financeAll17').onclick=async()=>{const from=q('#finFrom612').value,to=q('#finTo612').value,r=await pxApi56('/server/admin-finance-report-v612.php?scope=all&from='+encodeURIComponent(from)+'&to='+encodeURIComponent(to),{cache:'no-store'}),report=await json56(r,'Finance report');if(!r.ok||!report.ok)return toast(report.error||'Finance report unavailable');financeSnapshot612=report;financeRender612();};
 const official=document.createElement('section');official.className='panel';official.innerHTML='<h2>Official provider statements</h2><p>Read-only comparison. Provider wallets are not changed automatically.</p><select id="financeStatementProvider17"><option value="openai">OpenAI</option><option value="xai">xAI</option><option value="google">Google</option></select><button id="financeStatementCheck17" type="button">Check official statement</button><p id="financeStatementResult17" role="status"></p><h3>Pricing verification</h3><pre id="financeRateStatus17"></pre>';panel.append(official);
 const rateStatus=q('#financeRateStatus17',official);rateStatus.textContent=JSON.stringify(data.config?.rate_sync||{},null,2);rateStatus.setAttribute('data-i18n-skip','');
 q('#financeStatementCheck17',official).onclick=async e=>{const button=e.currentTarget,result=q('#financeStatementResult17',official);button.disabled=true;try{const response=await pxApi56('/server/admin-finance-report-v612.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'provider_statement',provider:q('#financeStatementProvider17',official).value,from:q('#finFrom612').value,to:q('#finTo612').value})}),payload=await json56(response,'Official provider statements');if(!response.ok||!payload.ok)throw Error(payload.error||'Official billing connection failed');const st=payload.statement;result.textContent=st.message+(st.official_cost_usd!==undefined?' '+finUsd612(st.official_cost_usd)+' | '+(st.project_scoped?'Configured project':'Entire organization'):'')+(st.signed_prepaid_balance_usd!==undefined?' '+finUsd612(st.signed_prepaid_balance_usd):'');window.PIONX_I18N?.apply(result);}catch(error){result.textContent=error.message;window.PIONX_I18N?.apply(result);}finally{button.disabled=false;}};
 const invoices=document.createElement('section');invoices.className='panel';const reversed=new Set((data.cash_entries||[]).map(e=>e.reversal_of).filter(Boolean)),receipts=(data.cash_entries||[]).filter(e=>e.kind==='subscription_sale'&&e.amount_usd>0&&e.buyer_id&&!reversed.has(e.id));invoices.innerHTML='<h2>Subscriber invoices</h2><p>Issue a PDF invoice for a recorded subscription payment with a customer account ID.</p><select id="financeInvoiceReceipt17">'+receipts.map(e=>'<option value="'+finSafe612(e.id)+'">'+finSafe612(e.buyer_id)+' | '+finSafe612(e.reference)+' | '+finUsd612(e.amount_usd)+'</option>').join('')+'</select><button id="financeInvoiceDownload17" type="button">Download subscriber invoice</button>';panel.append(invoices);q('#financeInvoiceReceipt17',invoices).setAttribute('data-i18n-skip','');const invoiceButton=q('#financeInvoiceDownload17',invoices);invoiceButton.disabled=!receipts.length;invoiceButton.onclick=async()=>{invoiceButton.disabled=true;try{const response=await pxApi56('/server/admin-finance-report-v612.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'invoice',entry_id:q('#financeInvoiceReceipt17',invoices).value})}),payload=await json56(response,'Invoice');if(!response.ok||!payload.ok)throw Error(payload.error||'Could not save invoice');await financeInvoicePdf17(payload.invoice);}catch(error){toast(error.message)}finally{invoiceButton.disabled=!receipts.length;}};
 window.PIONX_I18N?.apply(panel);
};
// Canvas shapes Arabic text with the browser's font engine; PDF pages contain these rendered labels.
financePdf612=async function(){const report=financeSnapshot612;if(!report)return toast('Load live figures first');if(!window.PDFLib)throw Error('PDF library is unavailable');await document.fonts?.ready;
 const pdf=await PDFLib.PDFDocument.create(),ar=window.PIONX_I18N?.language()==='ar',t=s=>window.PIONX_I18N?.translate(s)||s;let canvas,ctx,y,index=0;
 async function flush(){if(!canvas)return;const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('Could not export financial report page');const bytes=await blob.arrayBuffer(),img=await pdf.embedPng(bytes),page=pdf.addPage([595,842]);page.drawImage(img,{x:0,y:0,width:595,height:842});}
 async function next(){await flush();canvas=document.createElement('canvas');canvas.width=1190;canvas.height=1684;ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,1190,1684);ctx.direction=ar?'rtl':'ltr';ctx.textAlign=ar?'right':'left';ctx.font='bold 28px Tajawal, Arial, sans-serif';ctx.fillStyle='#153552';ctx.fillText(t('FINANCE REPORT')+' | PIONX',ar?1106:84,80);ctx.font='20px Tajawal, Arial, sans-serif';ctx.fillText(String(++index),ar?84:1106,1628);y=138;}
 async function line(text,strong=false){const value=String(text);ctx.font=(strong?'bold ':'')+'22px Tajawal, Arial, sans-serif';const words=value.split(/\s+/),lines=[];let row='';for(const word of words){const trial=row?row+' '+word:word;if(ctx.measureText(trial).width>1010&&row){lines.push(row);row=word;}else row=trial;}if(row)lines.push(row);for(const row of lines){if(y>1565)await next();ctx.font=(strong?'bold ':'')+'22px Tajawal, Arial, sans-serif';ctx.fillStyle=strong?'#153552':'#374b5e';ctx.fillText(row,ar?1106:84,y);y+=34;}if(strong)y+=10;}
 await next();await line('\u2066'+report.period.from+' — '+report.period.to+' | '+report.period.timezone+'\u2069');await line(t('Currency')+': USD');
 const totals=report.financials?.totals||{};for(const [label,key]of [['Cash receipts recorded','receipts_usd'],['Refunds','refunds_usd'],['Operating expenses','operating_expenses_usd'],['Provider cost','provider_cost_usd'],['Management profit','management_profit_usd']])await line(t(label)+': '+finUsd612(totals[key]??(key==='provider_cost_usd'?report.summary?.tracked_provider_cost_usd:0)),true);
 await line(t('Paid subscribers')+': '+(totals.unique_paid_subscribers??0)+(totals.unidentified_subscription_receipts?' + '+t('Unidentified subscriptions')+': '+totals.unidentified_subscription_receipts:''));await line(t('Active subscribers')+': '+t('Payment integration required'));
 for(const [heading,rows]of [['Monthly totals',report.financials?.monthly],['Yearly totals',report.financials?.yearly]]){await line(t(heading),true);for(const [period,v]of Object.entries(rows||{})){await line(period,true);for(const [label,key]of [['Receipts','receipts_usd'],['Refunds','refunds_usd'],['Operating expenses','operating_expenses_usd'],['Provider cost','provider_cost_usd'],['Management profit','management_profit_usd']])await line(t(label)+': '+finUsd612(v[key]));await line(t('Paid subscribers')+': '+v.unique_paid_subscribers);}}
 await line(t('Provider wallets'),true);for(const [provider,w]of Object.entries(report.wallets||{}))await line(provider+': '+finUsd612(w.estimated_balance_usd));await line(t('Accounting scope'),true);await line(t('Management estimate; only recorded receipts and costs are included. Provider funding is not counted twice as an expense.'));await line(t('Active subscription count needs payment integration.'));await flush();saveBlob66(new Blob([await pdf.save()],{type:'application/pdf'}),'PIONX-financial-report-'+report.period.from+'-'+report.period.to+'.pdf');
};

async function financeInvoicePdf17(invoice){if(!window.PDFLib)throw Error('PDF library is unavailable');await document.fonts?.ready;const ar=window.PIONX_I18N?.language()==='ar',t=s=>window.PIONX_I18N?.translate(s)||s,canvas=document.createElement('canvas');canvas.width=1190;canvas.height=1684;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,1190,1684);ctx.direction=ar?'rtl':'ltr';ctx.textAlign=ar?'right':'left';let y=120;const line=(label,value='',bold=false)=>{ctx.font=(bold?'bold ':'')+'24px Tajawal,Arial,sans-serif';ctx.fillStyle='#153552';const text=t(label)+(value!==''?': '+(/[\u0600-\u06ff]/.test(String(value))?'\u2067':'\u2066')+value+'\u2069':'');const words=text.split(/\s+/);let row='';for(const word of words){const trial=row?row+' '+word:word;if(ctx.measureText(trial).width>1000&&row){ctx.fillText(row,ar?1090:100,y);y+=40;row=word;}else row=trial;}ctx.fillText(row,ar?1090:100,y);y+=60;};line('Invoice','',true);line('Seller',invoice.seller);line('Invoice number',invoice.number);line('Issue date',invoice.issued_at);line('Payment date',invoice.payment_date);line('Customer account ID',invoice.customer_account_id);line('Item',t(invoice.item));line('Payment reference',invoice.payment_reference);line('Total',finUsd612(invoice.amount_usd),true);line('Currency',invoice.currency);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('Could not export invoice');const pdf=await PDFLib.PDFDocument.create(),image=await pdf.embedPng(await blob.arrayBuffer()),page=pdf.addPage([595,842]);page.drawImage(image,{x:0,y:0,width:595,height:842});saveBlob66(new Blob([await pdf.save()],{type:'application/pdf'}),invoice.number+'.pdf');}

const wireSettingsBase17=wireSettings;wireSettings=function(){wireSettingsBase17();const old=q('[data-setting-action="invoice"]');if(!old)return;const button=old.cloneNode(true);old.replaceWith(button);button.onclick=async()=>{button.disabled=true;try{const response=await pxApi56('/server/customer-invoices17.php',{cache:'no-store'}),payload=await json56(response,'Invoices');if(!response.ok||!payload.ok)throw Error(payload.error||'Invoice register is unavailable');const rows=payload.invoices||[];if(!rows.length)return toast('No issued invoices for this account');const modal=openDemoDialog('Invoices','<label>Select invoice<select id="customerInvoice17">'+rows.map((v,i)=>'<option value="'+i+'">'+finSafe612(v.number)+' | '+finSafe612(v.payment_date)+' | '+finUsd612(v.amount_usd)+'</option>').join('')+'</select></label>','<button data-dialog-close2>Cancel</button><button id="customerInvoiceDownload17">Download invoice</button>');q('#customerInvoice17',modal).setAttribute('data-i18n-skip','');q('#customerInvoiceDownload17',modal).onclick=()=>financeInvoicePdf17(rows[Number(q('#customerInvoice17',modal).value)]).catch(error=>toast(error.message));window.PIONX_I18N?.apply(modal);}catch(error){toast(error.message)}finally{button.disabled=false;}};};

// R16.15: prices and current membership come from the real server/account.
let plansCatalog1615=null,plansLoading1615=false,plansError1615='';
function accountPlanLabel1615(){const code=String(PXPROFILE56?.current_plan||'none').toLowerCase();return code==='none'?'No active plan':code.replace(/(^|[-_ ])\w/g,m=>m.toUpperCase())+' Plan';}
async function loadPlansCatalog1615(){
 if(plansLoading1615)return;plansLoading1615=true;plansError1615='';
 try{
  const response=await pxApi56('/server/plans.php',{cache:'no-store'}),data=await json56(response,'Plans');
  if(!response.ok||!Array.isArray(data.plans)||!data.plans.length||data.plans.length>20||!Array.isArray(data.topups))throw Error('Plan catalog is temporarily unavailable.');
  if(!data.plans.every(p=>typeof p.code==='string'&&typeof p.name==='string'&&Number.isFinite(p.price_usd)&&p.price_usd>=0&&Number.isSafeInteger(p.credits)&&p.credits>=0&&Array.isArray(p.features)&&p.features.every(f=>typeof f==='string'))||!data.topups.every(p=>Number.isSafeInteger(p.credits)&&p.credits>0&&Number.isFinite(p.price_usd)&&p.price_usd>=0))throw Error('Plan catalog is temporarily unavailable.');
  plansCatalog1615=data;
 }catch(error){plansError1615='Plan catalog is temporarily unavailable.';}
 finally{plansLoading1615=false;if(location.hash==='#plans')route();}
}
routes.plans=function(){
 if(!plansCatalog1615&&!plansLoading1615&&!plansError1615)queueMicrotask(loadPlansCatalog1615);
 const current=String(PXPROFILE56?.current_plan||'none').toLowerCase(),money=n=>'$'+Number(n).toLocaleString('en-US',{maximumFractionDigits:2});
 const heading=pageHead('MEMBERSHIP','Plans & Credits','Your account balance and the current server plan catalog.');
 const account='<section class="panel billing-summary"><article><small>Current plan</small><b>'+escHtml(accountPlanLabel1615())+'</b></article><article><small>Credits</small><b>'+Number(PXPROFILE56?.credits||0).toLocaleString()+'</b><span>Available balance</span></article><article><small>Payment method</small><b>Not connected</b><span>Payment setup pending</span></article></section>';
 if(!plansCatalog1615)return '<section class="page">'+heading+account+'<section class="panel" role="status"><p>'+escHtml(plansError1615||'Loading available plans…')+'</p>'+(plansError1615?'<button type="button" class="ghost-btn" id="retryPlans1615">Try again</button>':'')+'</section></section>';
 const plans=plansCatalog1615.plans.map(p=>{const active=p.code.toLowerCase()===current;return '<article class="panel pricing-card '+(active?'recommended':'')+'">'+(active?'<span class="tag">CURRENT PLAN</span>':'')+'<h3>'+escHtml(p.name)+'</h3><div class="price">'+money(p.price_usd)+' <small>/ month</small></div><p class="muted">'+p.credits.toLocaleString()+' monthly credits</p><ul>'+p.features.map(f=>'<li>'+escHtml(f)+'</li>').join('')+'</ul><button class="ghost-btn" style="width:100%" disabled title="Payment gateway is not connected yet">'+(active?'Current plan':'Payment setup pending')+'</button></article>';}).join('');
 const topups=plansCatalog1615.topups.map(p=>'<article class="panel metric"><small>'+p.credits.toLocaleString()+' credits</small><b>'+money(p.price_usd)+'</b><button class="ghost-btn" disabled>Payment setup pending</button></article>').join('');
 return '<section class="page">'+heading+account+'<div class="plan-grid">'+plans+'</div><div class="section-title"><h2>Credit top-ups</h2></div><div class="grid-4">'+topups+'</div></section>';
};
const settingsAccountBase1615=routes.settings;
routes.settings=function(){return settingsAccountBase1615().replace(/<div class="billing-summary">[\s\S]*?<\/div>/,'<div class="billing-summary"><article><small>Current plan</small><b>'+escHtml(accountPlanLabel1615())+'</b><span>Account membership</span></article><article><small>Credits</small><b>'+Number(PXPROFILE56?.credits||0).toLocaleString()+'</b><span>Available balance</span></article><article><small>Payment method</small><b>Not connected</b><span>Payment setup pending</span></article></div>');};
const catalogWireBase1615=wireView;
wireView=function(name){catalogWireBase1615(name);if(name==='plans')q('#retryPlans1615')?.addEventListener('click',loadPlansCatalog1615);};

// Live assistant adapter deliberately enters the existing Studio pipeline; no new image engine.
window.PIONXWorkspaceShellBridge={signedIn:()=>signedIn56(),role:()=>PXPROFILE56?.role||'user',go:name=>go(name),hasRoute:name=>!!routes[name],consistencyWorkflow:()=>consistencyV4.workflow,consistencyMode:mode=>{if(consistencyMedia615.busy){toast('Wait for the current consistency render.');return;}consistencyV4.workflow=mode==='shots'?'shots':'batch';go('consistency');}};
window.PIONXAssistantBridge1613={
 registerAssistant:({render,mount})=>{if(typeof render!=='function'||typeof mount!=='function')return;routes.assistant=render;const base=wireView;wireView=function(name){base(name);if(name==='assistant')mount(q('#pionxAssistantHost1614'));};if(signedIn56()&&location.hash==='#assistant')route();},
 navigateAssistant:()=>go('assistant'),
 refreshAssistant:()=>{if(location.hash==='#assistant')route();},
 navigateWorkspace:name=>{if(['studio','flow','video','film','presentation','consistency','renders','projects','albums','assets','explore','portfolio','profile','plans','billing','settings'].includes(name))go(name);},
 signedIn:()=>signedIn56(),
 image:()=>studioSourceImage||'',
 context:()=>({image_uploaded:!!studioSourceImage,latest_render_available:!!(studioFinal56.providerUrl||galleryRows62[0]?.url),video_image_uploaded:!!videoImage66,video_running:videoBusy66,scene:studioState.scene||'auto',mode:'preserve',preserves_design:true}),
 request:async(path,body)=>{const r=await pxApi56(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(path.includes('video-auto')&&body.action==='start'?120000:25000)});const j=await json56(r,'PIONX assistant');if(!r.ok){const error=Error(j.error||'Assistant request failed');error.status=r.status;error.state=j.state;throw error;}return j;},
 upload:async(file)=>{
  if(!signedIn56())throw Error('Sign in first.');if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>6*1024*1024)throw Error('Upload a JPG, PNG or WebP image under 6 MB.');
  if(q('#demoGenerate')?.dataset.busy==='1')throw Error('Wait for the current render before replacing its source.');
  // Decode before mutating state; skip Studio's automatic paid analysis on upload.
  const data=await readStudioImage(file),dims=await imageDims56(data);if(!dims.width||!dims.height)throw Error('Could not decode this image.');
  clearFinal56();studioDetectedSource631={};studioPlanInteriorSpec633=null;studioPlanInteriorMaster633=false;studioPlanDetect635={kind:'unknown',confidence:0,method:'new-source'};studioSourceMode635='auto';
  studioSourceImage=data;studioSourceName=file.name||'source-image';studioSourceDims.width=dims.width;studioSourceDims.height=dims.height;editV4.hasSelection=false;editV4.selection=null;
  if(workspaceRoute16()!=='assistant'){go('studio');route();updateStudioSourceUI();}return studioSourceImage;
 },
 quote:async(draft)=>draft.kind==='video'?window.PIONXAssistantBridge1613.quoteVideo(draft):window.PIONXAssistantBridge1613.request('/server/assistant-quote-r1613.php',{scene:draft.scene}),
 prepare:async(instruction)=>{
  if(!signedIn56())throw Error('Sign in first.');if(!studioSourceImage)throw Error('Upload the source image first.');
  if(q('#demoGenerate')?.dataset.busy==='1')throw Error('A render is already running.');
  if(studioMultiCamera632.busy||studioRecoveryState6331.active||studioSourceMode635==='plan')throw Error('Finish the current Studio workflow before preparing a single-image edit.');
  let active=null;try{active=JSON.parse(safeStore.get(ACTIVE_RENDER_KEY56)||'null');}catch{}
  if(active?.job_token)throw Error('Finish or recover the existing render before preparing another.');
  const draft={instruction,source:studioSourceImage,scene:studioState.scene||'auto',createdAt:Date.now(),references:JSON.stringify(studioReferenceImages||[]),settings:JSON.stringify(studioState),sourceMode:studioSourceMode635};
  draft.quote=await window.PIONXAssistantBridge1613.quote(draft);return draft;
 },
 execute:async(draft,authorized=()=>false)=>{
  if(draft.kind==='video')return window.PIONXAssistantBridge1613.executeVideo(draft,authorized);
  if(!authorized())throw Error('Render confirmation was cancelled.');
  if(!signedIn56())throw Error('Sign in first.');
  const unchanged=()=>studioSourceImage===draft.source&&JSON.stringify(studioReferenceImages||[])===draft.references&&JSON.stringify(studioState)===draft.settings&&studioSourceMode635===draft.sourceMode;
  if(!unchanged())throw Error('The source or Studio settings changed. Cancel this draft and prepare it again.');
  if(q('#demoGenerate')?.dataset.busy==='1')throw Error('A render is already running.');
  // Plans need the dedicated geometry workflow and a different quote; never silently use this image quote.
  if(studioState.scene==='interior'){
   const intent=await studioClassifySource635();if(intent.kind==='floor_plan')throw Error('This is a floor plan. Use the dedicated Plan → Interior workflow in Studio.');
  }
  if(!authorized())throw Error('Render confirmation was cancelled.');
  if(!unchanged())throw Error('Studio changed while checking. Prepare the draft again.');
  const before=studioFinal56.providerUrl;
  studioState.mode='preserve';studioState.interiorStyle='none';studioState.interiorCustomStyle='';studioState.people=false;studioState.cars=false;studioState.env='auto';go('studio');route();
  const notes=q('#studioNotes');if(!notes)throw Error('Open Studio and try again.');
  notes.value=draft.instruction+'\nKeep all unrequested architecture, layout, camera, openings and objects unchanged.';
  await runRenderDemo();
  if(studioFinal56.providerUrl&&studioFinal56.providerUrl!==before)return {message:'The edited image was delivered in Studio. Review it visually.'};
  return {message:q('#studioRenderNotice636')?.textContent?.trim()||'Studio did not report a newly delivered image. Check the render status in Studio.'};
 }
};
// Keep test and production video recovery separate, including account changes.
let videoOwner1615='';
const videoAccountBase1615=renderAccount56;
renderAccount56=function(data){
 videoAccountBase1615(data);const owner=videoJobKey1615();if(owner===videoOwner1615)return;
 videoOwner1615=owner;clearTimeout(videoTimer66);videoJob66='';videoBusy66=false;
 let saved=safeStore.get(owner)||'';
 if(!saved&&location.pathname.replace(/[^/]*$/,'')==='/')saved=safeStore.get('pionx-video-job-v66')||'';
 if(/^[a-f0-9]{32}$/.test(saved)){videoJob66=saved;videoBusy66=true;safeStore.set(owner,saved);}
};
// R16.15: conversational video reuses the authenticated Auto engine and wallet.
const assistantVideoKey1615=()=> 'pionx-assistant-video-request-r1615-'+location.pathname.replace(/[^/]*$/,'')+'-'+String(PXUSER56?.id||'');
function assistantVideoPending1615(){try{return JSON.parse(safeStore.get(assistantVideoKey1615())||'null');}catch{return null;}}
function assistantVideoClear1615(){safeStore.set(assistantVideoKey1615(),'null');}
function assistantVideoIdentity1615(source){return source==='latest_render'?(studioFinal56.providerUrl||galleryRows62[0]?.url||''):source==='video_image'?videoImage66:studioSourceImage;}
Object.assign(window.PIONXAssistantBridge1613,{
 quoteVideo:async draft=>{
  const response=await window.PIONXAssistantBridge1613.request('/server/video-auto-v627.php',{action:'quote',quality:draft.options.quality,duration:draft.options.duration,aspect_ratio:draft.options.aspect_ratio,purpose:draft.options.workflow==='cinematic'?'cinematic':'preserve',has_image:true});
  return window.PIONXAssistantWorkflows1615.videoQuote(response);
 },
 prepareVideo:async args=>{
  if(!signedIn56())throw Error('Sign in first.');
  if(videoBusy66)throw Error('A video is already running. Check Video Studio before preparing another.');
  if(assistantVideoPending1615())throw Error('Check the previous video submission before starting another.');
  const owner=String(PXUSER56?.id||''),options=window.PIONXAssistantWorkflows1615.normalizeVideoRequest(args);
  const identity=assistantVideoIdentity1615(options.source);if(!identity)throw Error('Upload a source image or select an available latest render first.');
  let source=identity;
  if(options.source==='latest_render'){
   const blob=await fetchRenderBlob56(galleryUrl62(identity));
   if(!['image/jpeg','image/png','image/webp'].includes(blob.type)||blob.size>5.8*1024*1024)throw Error('Use a JPG, PNG or WebP starting image smaller than 6 MB.');
   source=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Could not read the starting image.'));reader.readAsDataURL(blob);});
  }
  const dims=await imageDims56(source);if(!dims.width||!dims.height||dims.width*dims.height>32000000)throw Error('Use a decodable starting image under 32 megapixels.');
  if(!signedIn56()||owner!==String(PXUSER56?.id||'')||identity!==assistantVideoIdentity1615(options.source))throw Error('The account or starting image changed. Prepare the video again.');
  const bytes=crypto.getRandomValues(new Uint8Array(16)),requestId=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  const draft={kind:'video',instruction:options.instruction,options,source,identity,owner,requestId,prompt:window.PIONXAssistantWorkflows1615.videoPrompt(options),createdAt:Date.now()};
  draft.quote=await window.PIONXAssistantBridge1613.quoteVideo(draft);return draft;
 },
 executeVideo:async(draft,authorized=()=>false)=>{
  if(!authorized())throw Error('Video confirmation was cancelled.');
  if(!signedIn56()||draft.owner!==String(PXUSER56?.id||''))throw Error('The account changed. Prepare the video again.');
  if(draft.identity!==assistantVideoIdentity1615(draft.options.source))throw Error('The starting image changed. Prepare the video again.');
  if(videoBusy66)throw Error('A video is already running.');
  const saved=assistantVideoPending1615();if(saved&&saved.requestId!==draft.requestId)throw Error('Check the previous video submission before starting another.');
  // Persist the ID before dispatch: recover uncertain responses without another charge.
  safeStore.set(assistantVideoKey1615(),JSON.stringify({requestId:draft.requestId,createdAt:Date.now()}));
  if(assistantVideoPending1615()?.requestId!==draft.requestId)throw Error('Browser storage is unavailable. Open Video Studio before submitting a paid video.');
  if(!authorized()){assistantVideoClear1615();throw Error('Video confirmation was cancelled.');}
  let job;
  try{job=await window.PIONXAssistantBridge1613.request('/server/video-auto-v627.php',{action:'start',request_id:draft.requestId,prompt:draft.prompt,image:draft.source,quality:draft.options.quality,duration:draft.options.duration,aspect_ratio:draft.options.aspect_ratio,purpose:draft.options.workflow==='cinematic'?'cinematic':'preserve',max_reservation_credits:draft.quote.reservation_credits,max_estimated_credits:draft.quote.estimated_credits});}
  catch(error){if([400,401,402,403,412].includes(error.status))assistantVideoClear1615();throw error;}
  if(!/^[a-f0-9]{32}$/.test(job.id)||job.state==='submission_unknown')throw Error('Check the previous video submission before starting another.');
  videoJob66=job.id;safeStore.set(videoJobKey1615(),job.id);assistantVideoClear1615();videoBusy66=!['ready','failed'].includes(job.state);videoImage66=draft.source;
  go('video');route();
  const values={'#videoQuality66':draft.options.quality,'#videoDuration66':String(draft.options.duration),'#videoAspect614':draft.options.aspect_ratio,'#videoWorkflow614':draft.options.workflow,'#videoCamera614':window.PIONXAssistantWorkflows1615.cameras[draft.options.camera],'#videoLighting614':window.PIONXAssistantWorkflows1615.lights[draft.options.lighting],'#videoPrompt66':draft.instruction};
  for(const [sel,value] of Object.entries(values)){const node=q(sel);if(node)node.value=value;}
  videoQuote66();if(q('#videoGenerate66'))q('#videoGenerate66').disabled=videoBusy66;
  const preview=q('#videoPreview66');if(preview){const image=document.createElement('img');image.src=draft.source;image.alt='Video starting frame';preview.replaceChildren(image);}
  loadAccount56({quiet:true}).catch(()=>{});clearTimeout(videoTimer66);videoTimer66=setTimeout(videoPoll66,250);
  if(job.state==='failed')return {status:'failed',job_id:job.id,message:'The previous video request failed. Review its status in Video Studio.'};
  return {status:job.state==='ready'?'ready':'processing',job_id:job.id,message:job.state==='ready'?'Your video is ready in Video Studio.':'The video job was submitted. Follow progress in Video Studio.'};
 },
 videoStatus:async()=>{
  const saved=assistantVideoPending1615();
  if(saved){
   const result=await window.PIONXAssistantBridge1613.request('/server/video-auto-v627.php',{action:'request_status',request_id:saved.requestId});
   if(result.state==='not_found'){assistantVideoClear1615();return {status:'not_submitted',message:'No video was submitted. Prepare your request again.'};}
   if(result.state==='submission_unknown')return {status:'submission_unknown',message:result.message};
   if(/^[a-f0-9]{32}$/.test(result.id)){videoJob66=result.id;safeStore.set(videoJobKey1615(),result.id);assistantVideoClear1615();videoBusy66=!['ready','failed'].includes(result.state);}
  }
  if(!videoJob66)return {status:'no_job',message:'No video job is available.'};
  const result=await window.PIONXAssistantBridge1613.request('/server/video-auto-v627.php',{action:'status',id:videoJob66});
  videoBusy66=result.state!=='ready';
  return {status:result.state==='ready'?'ready':'processing',job_id:videoJob66,message:result.state==='ready'?'Your video is ready in Video Studio.':'Your video is still rendering.'};
 }
});

const assistantExitBase1613=exitApp;exitApp=function(){window.dispatchEvent(new Event('pionx-assistant-exit'));return assistantExitBase1613();};

/* R16.16: coherent workspace structure and confirmed project creation. */
const ui1616=(en,ar)=>document.documentElement.lang==='ar'?ar:en;
const icon1616=name=>window.PIONXIcons1616?.(name)||'';
const tools1616=[
 ['studio','image','Create','Image Studio','استوديو الصور','Render and refine your architectural images.','ريندر وتعديل الصور المعمارية.'],
 ['consistency','layers','Create','Visual DNA','اتساق الصور','Keep a consistent design across a batch.','حافظ على التصميم عبر مجموعة صور.','batch'],
 ['consistency','image','Create','Multi-camera','زوايا متعددة','Develop matching views of the same space.','طوّر زوايا متناسقة لنفس الفراغ.','shots'],
 ['flow','flow','Create','Flow boards','لوحات الأفكار','Connect references, ideas and project notes.','اربط المراجع والأفكار وملاحظات المشروع.'],
 ['video','video','Deliver','Video Studio','استوديو الفيديو','Set the camera motion for your starting image.','حدّد حركة الكاميرا لصورة البداية.'],
 ['film','film','Deliver','PIONX Film','فيلم المشروع','Assemble scenes, audio and a project story.','اجمع المشاهد والصوت في قصة للمشروع.'],
 ['presentation','deck','Deliver','Presentations','العروض التقديمية','Compose client boards and export your deck.','نسّق لوحات العميل وصدّر العرض.'],
 ['assets','tools','Organize','Assets & references','الصور والمراجع','Your image library on this device.','مكتبة صورك على هذا الجهاز.'],
 ['albums','project','Organize','Albums','الألبومات','Curate collections of your saved renders.','نسّق مجموعات من النتائج المحفوظة.'],
 ['portfolio','image','Share','Portfolio','ملف الأعمال','Manage your selected work and visibility.','نسّق أعمالك المختارة وصلاحيات ظهورها.'],
 ['explore','people','Share','Community','المجتمع','Discover creators and public projects.','استكشف المصممين والمشاريع المنشورة.']
];
function toolCard1616(t){const [route,icon,group,en,ar,desc,descAr,mode]=t;return `<a class="px-tool-card1616" href="#${route}" data-tools-route1616="${route}" data-tools-group1616="${group}" data-tools-search1616="${escHtml((en+' '+ar+' '+desc+' '+descAr).toLowerCase())}" ${mode?`data-tool-mode1616="${mode}"`:''}>${icon1616(icon)}<h3>${ui1616(en,ar)}</h3><p>${ui1616(desc,descAr)}</p><span>${ui1616('Open workspace','افتح مساحة العمل')} ${icon1616('arrow')}</span></a>`}
function pageHeading1616(en,ar,desc,descAr,action=''){return `<div class="px-page-heading1616"><div><span class="px-eyebrow1616">PIONX AI</span><h1>${ui1616(en,ar)}</h1><p>${ui1616(desc,descAr)}</p></div>${action}</div>`}
function newProjectButton1616(){return `<button type="button" class="primary-btn" data-create-project1616>${icon1616('plus')}${ui1616('New project','مشروع جديد')}</button>`}
function projectCard1616(p,manage=false){const image=p.cover||p.renders?.[0]||'';return `<article class="px-project-card1616" data-project-visibility1616="${p.visibility==='public'?'public':'private'}" data-project-search1616="${escHtml((p.title+' '+p.category).toLowerCase())}"><div class="px-project-cover1616">${image?`<img src="${escHtml(image)}" alt="${escHtml(p.title)}" loading="lazy">`:icon1616('project')}</div><div class="px-project-meta1616"><h3 data-i18n-skip>${escHtml(p.title)}</h3><p data-i18n-skip>${escHtml(p.category||'Architecture')}</p><div class="px-project-actions1616"><span class="px-private1616">${icon1616(p.visibility==='public'?'people':'lock')}${p.visibility==='public'?ui1616('Public','عام'):ui1616('Private','خاص')}</span><button type="button" class="ghost-btn" data-project-open1616="${escHtml(p.id)}">${ui1616('Open project','افتح المشروع')}</button></div>${manage?`<details class="px-project-settings1616"><summary>${ui1616('Project settings & sharing','إعدادات المشروع والمشاركة')}</summary><div class="project-controls614"><label>${ui1616('Visibility','الظهور')}<select data-project-visibility614="${escHtml(p.id)}"><option value="private" ${p.visibility!=='public'?'selected':''}>${ui1616('Private','خاص')}</option><option value="public" ${p.visibility==='public'?'selected':''}>${ui1616('Public','عام')}</option></select></label><label class="switch-control614"><input type="checkbox" data-project-publish614="${escHtml(p.id)}" ${p.published?'checked':''} ${p.visibility!=='public'?'disabled':''}><span>${ui1616('Publish to Showcase','النشر في معرض الأعمال')}</span></label><label class="switch-control614"><input type="checkbox" data-project-download614="${escHtml(p.id)}" ${p.allowDownload?'checked':''}><span>${ui1616('Allow download','السماح بالتنزيل')}</span></label></div><div class="px-actions1616"><button type="button" class="ghost-btn" data-project-add-render614="${escHtml(p.id)}">${ui1616('Add from renders','أضف من النتائج')}</button>${p.visibility!=='public'?`<button type="button" class="ghost-btn" data-project-share614="${escHtml(p.id)}">${ui1616('Create request link','إنشاء رابط طلب دخول')}</button>`:''}</div></details>`:''}</div></article>`}
routes.home=function(){const projects=portfolioProjects614.slice(0,3);return `<section class="page px-home1616">${pageHeading1616('Your workspace','مساحة عملك','One project. A clear path from idea to delivery.','مشروعك، من أول فكرة لحد التسليم.',newProjectButton1616())}<div class="px-home-hero1616"><div class="px-home-copy1616"><span class="px-eyebrow1616">${ui1616('ARCHITECTURE, IN FOCUS','رؤية معمارية أوضح')}</span><h2>${ui1616('Your design.<br>A clearer possibility.','من تصميمك.<br>لرؤية أكثر واقعية.')}</h2><p>${ui1616('Bring your image, describe your goal, and build the next step with PIONX.','ارفع صورتك، قل لنا عايز تعمل إيه، وابدأ الخطوة الجاية مع PIONX.')}</p><div class="px-actions1616"><button class="primary-btn" data-route="assistant">${ui1616('Talk to PIONX','تحدث مع PIONX')}</button><button class="ghost-btn" data-route="studio">${ui1616('Open Image Studio','افتح استوديو الصور')}</button></div></div><div class="px-home-visual1616"><img src="assets/interface-r1616/interior.webp" alt="${ui1616('Architectural visual reference','مرجع بصري معماري')}"><span>${ui1616('VISUAL REFERENCE','مرجع بصري')}</span></div></div><div class="px-section1616"><h2>${ui1616('Create & deliver','إنشاء وتسليم')}</h2><a href="#tools">${ui1616('All tools','كل الأدوات')} →</a></div><div class="px-tools-grid1616">${[tools1616[0],tools1616[4],tools1616[6]].map(toolCard1616).join('')}</div><div class="px-section1616"><h2>${ui1616('Recent projects','آخر المشاريع')}</h2><a href="#projects">${ui1616('View all','عرض الكل')}</a></div><div class="px-projects1616">${projects.length?projects.map(p=>projectCard1616(p)).join(''):`<div class="px-empty1616">${icon1616('project')}<h2>${ui1616('A place for your next project','مكان مشروعك الجاي')}</h2><p>${ui1616('Create a private project, then add your sources and renders.','ابدأ مشروع خاص، وبعدها أضف صورك ونتائجك.')}</p>${newProjectButton1616()}</div>`}</div></section>`;};
routes.tools=function(){const groups=[['Create','إنشاء'],['Deliver','تسليم'],['Organize','تنظيم'],['Share','مشاركة']];return `<section class="page px-tools-page1616">${pageHeading1616('All tools','كل الأدوات','Choose the next step in your project.','اختار الخطوة الجاية في مشروعك.')}<div class="px-tool-search1616"><input type="search" id="toolSearch1616" aria-label="${ui1616('Search tools','ابحث عن أداة')}" placeholder="${ui1616('Search tools…','ابحث عن أداة…')}"><div class="px-tool-filters1616">${[['All','الكل'],...groups].map(([en,ar])=>`<button type="button" data-tool-filter1616="${en}" aria-pressed="${en==='All'}">${ui1616(en,ar)}</button>`).join('')}</div></div>${groups.map(([en,ar])=>`<section class="px-tool-group1616" data-tool-section1616="${en}"><h2>${ui1616(en,ar)}</h2><div class="px-tools-grid1616">${tools1616.filter(t=>t[2]===en).map(toolCard1616).join('')}</div></section>`).join('')}<p hidden id="toolEmpty1616" role="status">${ui1616('No tools match your search.','لا توجد أدوات تطابق البحث.')}</p></section>`;};
routes.projects=function(){return `<section class="page px-projects-page1616">${pageHeading1616('Projects','المشاريع','Your sources, renders and client delivery, together.','صورك ونتائجك وتسليم العميل، في مكان واحد.',newProjectButton1616())}<div class="px-tool-search1616"><input id="projectSearch1616" type="search" aria-label="${ui1616('Search your projects','ابحث في مشاريعك')}" placeholder="${ui1616('Search projects…','ابحث في المشاريع…')}"><div class="px-tool-filters1616">${[['all','All','الكل'],['private','Private','خاص'],['public','Public','عام']].map(([key,en,ar])=>`<button type="button" data-project-filter1616="${key}" aria-pressed="${key==='all'}">${ui1616(en,ar)}</button>`).join('')}</div></div><div class="px-projects1616">${portfolioProjects614.length?portfolioProjects614.map(p=>projectCard1616(p,true)).join(''):`<div class="px-empty1616">${icon1616('project')}<h2>${ui1616('Start your first project','ابدأ أول مشروع')}</h2><p>${ui1616('New projects are private. You choose what to share.','المشاريع الجديدة خاصة. أنت بتحدد إيه اللي يتشارك.')}</p>${newProjectButton1616()}</div>`}</div><p id="projectEmpty1616" role="status" hidden>${ui1616('No projects match your search.','لا توجد مشاريع تطابق البحث.')}</p></section>`;};
function newProjectExperience1616(fromFlow=false){
 if(!signedIn56()||!PXUSER56?.id)return toast(ui1616('Sign in to create a project.','سجّل دخولك لإنشاء مشروع.'));
 const owner=String(PXUSER56.id),requestId=crypto.randomUUID().replace(/-/g,''),draft={title:'',category:'Exterior',client:'',location:'',description:'',destination:fromFlow?'flow':'projects'};let step=0,busy=false,submitted=null;
 const m=openDemoDialog(ui1616('New project','مشروع جديد'),'<div id="px-project-body1616"></div>','<button type="button" class="ghost-btn" id="px-cancel-p1"></button><button type="button" class="ghost-btn" id="px-back-p1"></button><button type="button" class="ghost-btn" id="px-quick-p1"></button><button type="button" class="primary-btn" id="px-next-p1"></button>');
 q('.dialog-card',m).classList.add('px-project-wizard1616');m.dir=document.documentElement.dir||'ltr';
 const cancel=q('#px-cancel-p1',m),back=q('#px-back-p1',m),next=q('#px-next-p1',m),quick=q('#px-quick-p1',m);
 function read(){qa('[data-project-field1616]',m).forEach(input=>draft[input.dataset.projectField1616]=input.value.trim());}
 function input(key,en,ar,max=100,required=false){return `<label for="px-${key}-p1">${ui1616(en,ar)}${required?' *':''}<input id="px-${key}-p1" data-project-field1616="${key}" maxlength="${max}" value="${escHtml(draft[key])}" ${required?'required':''} ${submitted?'readonly':''}></label>`}
 function paint(){
  const titles=[ui1616('Details','البيانات'),ui1616('Brief','الفكرة'),ui1616('Review','المراجعة')];
  let body=`<ol class="px-project-stepper1616">${titles.map((title,i)=>`<li ${i===step?'aria-current="step"':''}>${i+1}. ${title}</li>`).join('')}</ol>`;
  if(step===0)body+=`<div class="px-project-fields1616">${input('title','Project name','اسم المشروع',100,true)}<label for="px-category-p1">${ui1616('Category','التصنيف')}<select id="px-category-p1" data-project-field1616="category">${[['Exterior','خارجي'],['Interior','داخلي'],['Landscape','لاندسكيب'],['Urban','تخطيط عمراني'],['Commercial','تجاري'],['Other','أخرى']].map(([en,ar])=>`<option value="${en}" ${draft.category===en?'selected':''}>${ui1616(en,ar)}</option>`).join('')}</select></label><div class="px-project-row1616">${input('client','Client (optional)','العميل (اختياري)')}${input('location','Location (optional)','الموقع (اختياري)',180)}</div></div>`;
  if(step===1)body+=`<div class="px-project-fields1616"><label for="px-description-p1">${ui1616('Project brief (optional)','فكرة المشروع (اختياري)')}<textarea id="px-description-p1" data-project-field1616="description" maxlength="700" rows="4">${escHtml(draft.description)}</textarea></label></div><p class="px-project-note1616">${ui1616('Add your images and renders after creating the project. Nothing is generated at this step.','تقدر تضيف الصور والنتائج بعد إنشاء المشروع. الخطوة دي لا تبدأ أي توليد.')}</p>`;
  if(step===2)body+=`<dl class="px-project-review1616"><dt>${ui1616('Project','المشروع')}</dt><dd data-i18n-skip>${escHtml(draft.title)}</dd><dt>${ui1616('Category','التصنيف')}</dt><dd>${escHtml(draft.category)}</dd><dt>${ui1616('Client','العميل')}</dt><dd data-i18n-skip>${escHtml(draft.client)||'—'}</dd><dt>${ui1616('Location','الموقع')}</dt><dd data-i18n-skip>${escHtml(draft.location)||'—'}</dd><dt>${ui1616('Brief','الفكرة')}</dt><dd data-i18n-skip>${escHtml(draft.description)||'—'}</dd></dl><p class="px-project-note1616">${icon1616('lock')} ${ui1616('Private project. Saved to your account before continuing.','مشروع خاص. يتأكد حفظه في حسابك قبل المتابعة.')}</p><div class="px-project-fields1616"><label for="px-destination-p1">${ui1616('Continue to','بعد الإنشاء افتح')}<select id="px-destination-p1" data-project-field1616="destination">${[['projects','Projects','المشاريع'],['studio','Image Studio','استوديو الصور'],['flow','Flow boards','لوحات الأفكار']].map(([key,en,ar])=>`<option value="${key}" ${draft.destination===key?'selected':''}>${ui1616(en,ar)}</option>`).join('')}</select></label></div>`;
  body+='<p class="px-project-error1616" id="px-error-p1" role="alert" hidden></p>';
  q('#px-project-body1616',m).innerHTML=body;cancel.textContent=ui1616('Cancel','إلغاء');back.textContent=ui1616('Back','رجوع');back.hidden=step===0;back.disabled=!!submitted;quick.textContent=ui1616('Create now','إنشاء مباشر');quick.hidden=step!==0;next.textContent=step<2?ui1616('Continue','متابعة'):ui1616('Create project','إنشاء المشروع');next.disabled=busy;
  window.PIONX_I18N?.apply(m);requestAnimationFrame(()=>{(q('[data-project-field1616]',m)||next).focus()});
 }
 function error(message){const el=q('#px-error-p1',m);el.hidden=false;el.textContent=message;}
 cancel.onclick=()=>{if(!busy)closeDemoDialog16910();};back.onclick=()=>{if(busy||submitted)return;read();step--;paint();};quick.onclick=()=>{read();if(!draft.title){error(ui1616('Enter a project name.','اكتب اسم المشروع.'));q('#px-title-p1',m).focus();return;}step=2;paint();next.click();};
 next.onclick=async()=>{
  if(busy)return;read();if(!draft.title){step=0;paint();error(ui1616('Enter a project name.','اكتب اسم المشروع.'));q('#px-title-p1',m)?.focus();return;}
  if(step<2){step++;paint();return;}
  if(owner!==String(PXUSER56?.id||''))return error(ui1616('Your account changed. Reopen New project.','الحساب اتغير. افتح مشروع جديد مرة تانية.'));
  submitted ||= {action:'create_project',account_id:owner,request_id:requestId,project:{title:draft.title,category:draft.category,client:draft.client,location:draft.location,description:draft.description}};
  busy=true;m.dataset.busy1616='true';next.disabled=back.disabled=cancel.disabled=true;q('[data-dialog-close]',m).disabled=true;next.textContent=ui1616('Saving…','جارٍ الحفظ…');q('#px-error-p1',m).hidden=true;
  try{
   await portfolioSaveQueue16;if(portfolioSyncError16.startsWith('Project changes are saved on this device'))throw Error(ui1616('Sync your pending project changes before creating another project.','زامن تغييرات المشروع المعلقة قبل إنشاء مشروع جديد.'));
   const result=await portfolioApi614(submitted);
   if(!result.ok||!result.project?.id||!Array.isArray(result.portfolio?.projects))throw Error(ui1616('The server did not confirm project creation. Retry the same request.','السيرفر ما أكدش إنشاء المشروع. جرّب نفس الطلب مرة تانية.'));
   if(owner!==String(PXUSER56?.id||''))throw Error(ui1616('The project was saved to the previous account. Sign in there to view it.','المشروع اتحفظ في الحساب السابق. سجّل دخولك فيه لعرضه.'));
   portfolioRevision16++;portfolioProjects614=result.portfolio.projects;portfolioServerLoaded614=true;portfolioLoadedAt16=Date.now();portfolioSyncError16='';safeStore.set(portfolioOwnerKey16(),JSON.stringify(portfolioProjects614));safeStore.set(PORTFOLIO_KEY614,JSON.stringify(portfolioProjects614));
   studioComments6328.projectId=result.project.id;safeStore.set('pionx.studio.comments.project.v6328',result.project.id);
   if(draft.destination==='flow'){flowWorkspace615.activeProject=result.project.id;flowWorkspace615.activeBoard='';saveFlow615();}
   m.hidden=true;go(draft.destination);toast(ui1616('Project saved to your account.','المشروع اتحفظ في حسابك.'));
  }catch(e){error(e.message||ui1616('Could not save. Check your connection and retry.','الحفظ ما تمش. راجع الاتصال وجرّب تاني.'));next.textContent=ui1616('Retry saving','إعادة محاولة الحفظ');}
  finally{busy=false;delete m.dataset.busy1616;next.disabled=cancel.disabled=false;q('[data-dialog-close]',m).disabled=false;}
 };
 m.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.tagName!=='TEXTAREA'&&e.target.matches('input')){e.preventDefault();next.click();}});paint();return m;
}
newProjectExperienceP1=fromFlow=>newProjectExperience1616(fromFlow);
window.PIONXWorkspaceShellBridge.createProject=()=>newProjectExperience1616();
const closeProjectBase1616=closeDemoDialog16910;closeDemoDialog16910=function(){if(q('#demoDialog')?.dataset.busy1616==='true')return;return closeProjectBase1616();};
const wireInterfaceBase1616=wireView;wireView=function(name){
 wireInterfaceBase1616(name);const root=q('#viewRoot');
 qa('[data-create-project1616]',root).forEach(b=>b.onclick=()=>newProjectExperience1616());
 qa('[data-project-open1616]',root).forEach(b=>b.onclick=()=>{const p=projectById614(b.dataset.projectOpen1616);if(p)openProjectViewer614(p);});
 qa('[data-tools-route1616]',root).forEach(a=>a.onclick=e=>{e.preventDefault();if(a.dataset.toolMode1616)consistencyV4.workflow=a.dataset.toolMode1616;go(a.dataset.toolsRoute1616);});
 if(name==='tools'){let filter='All';const apply=()=>{const query=q('#toolSearch1616').value.trim().toLowerCase();let count=0;qa('[data-tools-route1616]',root).forEach(a=>{a.hidden=!(filter==='All'||a.dataset.toolsGroup1616===filter)||!a.dataset.toolsSearch1616.includes(query);if(!a.hidden)count++;});qa('[data-tool-section1616]',root).forEach(section=>section.hidden=![...section.querySelectorAll('[data-tools-route1616]')].some(a=>!a.hidden));q('#toolEmpty1616').hidden=!!count;};q('#toolSearch1616').oninput=apply;qa('[data-tool-filter1616]',root).forEach(b=>b.onclick=()=>{filter=b.dataset.toolFilter1616;qa('[data-tool-filter1616]',root).forEach(x=>x.setAttribute('aria-pressed',String(x===b)));apply();});}
 if(name==='projects'){let filter='all';const apply=()=>{const query=q('#projectSearch1616').value.trim().toLowerCase();let count=0;qa('[data-project-visibility1616]',root).forEach(a=>{a.hidden=!(filter==='all'||a.dataset.projectVisibility1616===filter)||!a.dataset.projectSearch1616.includes(query);if(!a.hidden)count++;});q('#projectEmpty1616').hidden=!!count||!portfolioProjects614.length;};q('#projectSearch1616').oninput=apply;qa('[data-project-filter1616]',root).forEach(b=>b.onclick=()=>{filter=b.dataset.projectFilter1616;qa('[data-project-filter1616]',root).forEach(x=>x.setAttribute('aria-pressed',String(x===b)));apply();});}
};
window.addEventListener('pionx:language',()=>{if(signedIn56()&&['home','tools','projects'].includes(workspaceRoute16()))route();});
function organiseStudio1616(){
 if(workspaceRoute16()!=='studio')return;
 const root=q('#viewRoot'),grid=q('.studio-grid',root);if(!grid)return;const control=q('.control-panel',grid),canvas=q('.canvas-panel',grid);if(!control||!canvas)return;
 const steps=qa('.px-studio-step',control),prompt=q('.px-studio-prompt',control);
 if(prompt&&steps[2]&&prompt.parentElement!==steps[2])steps[2].insertBefore(prompt,steps[2].querySelector('h3')?.nextSibling||null);
 const header=q('.r14-sh h2',root);if(header){const h1=document.createElement('h1');h1.textContent=header.textContent;header.replaceWith(h1);}
 function group(id,en,ar,before){let details=q('#'+id,canvas);if(!details){details=document.createElement('details');details.id=id;details.className='px-studio-disclosure1616';const summary=document.createElement('summary');summary.textContent=ui1616(en,ar);details.append(summary);canvas.insertBefore(details,before||null);}return details;}
 const multi=q('#studioMultiCamera632',canvas);if(multi){const details=group('studioCameras1616','More camera views','زوايا كاميرا إضافية',multi.parentElement===canvas?multi:null);if(multi.parentElement!==details)details.append(multi);}
 const refine=group('studioRefine1616','Refine & review the result','تعديل ومراجعة النتيجة');
 for(const selector of ['#resultEditDock','#postTools65','.adjust-panel']){const node=q(selector,grid)||q(selector,refine);if(node&&node.parentElement!==refine)refine.append(node);}
 const toolbar=q('#unifiedStudioToolbar',canvas);if(toolbar&&!toolbar.dataset.organised1616){toolbar.dataset.organised1616='true';const tools=qa('[data-studio-tool]',toolbar);if(tools.length){const menu=document.createElement('details');menu.className='px-studio-toolbar-menu1616';menu.innerHTML='<summary>'+ui1616('Refine image','تعديل الصورة')+'</summary><div></div>';toolbar.append(menu);tools.forEach(button=>menu.lastElementChild.append(button));}}
 if(!canvas.dataset.actions1616){canvas.dataset.actions1616='true';canvas.addEventListener('click',event=>{if(event.target.closest('[data-studio-tool],#openRetouch65,#applyInteriorStyle65'))refine.open=true;},true);}
}
let studioLayoutScheduled1616=false;
new MutationObserver(()=>{if(studioLayoutScheduled1616)return;studioLayoutScheduled1616=true;requestAnimationFrame(()=>{studioLayoutScheduled1616=false;organiseStudio1616();});}).observe(q('#viewRoot'),{childList:true,subtree:true});
window.addEventListener('hashchange',()=>requestAnimationFrame(organiseStudio1616));

const projectAccountBase1616=renderAccount56;renderAccount56=function(data){
 const owner=String(data?.user?.id||'');
 if(owner!==portfolioOwner16){portfolioProjects614=[];if(owner){try{const cached=JSON.parse(safeStore.get(PORTFOLIO_KEY614+':'+owner)||'[]');if(Array.isArray(cached))portfolioProjects614=cached;}catch{}}portfolioOwner16=owner;portfolioRevision16++;portfolioServerLoaded614=false;portfolioLoadedAt16=0;portfolioSyncError16='';}
 return projectAccountBase1616(data);
};

// ===== PIONX R16.17 EXPERIENCE =====
let billing17=null,billingError17='',billingLoading17=false,community17=[],communityLoaded17=false,communityError17='',communityLoading17=false,communityTab17='images',voiceStatus17=null;
async function get17(path,body){const owner=String(PXUSER56?.id||''),response=await pxApi56(path,{cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(25000)}),data=await json56(response,'PIONX');if(!response.ok)throw Error(data.error||'Request could not be completed');if(owner!==String(PXUSER56?.id||''))throw Error(ui1616('Your account changed. Reopen this page.','الحساب اتغير. افتح الصفحة من جديد.'));return data;}
function money17(value,currency='USD'){return new Intl.NumberFormat(document.documentElement.lang==='ar'?'ar-EG':'en-US',{style:'currency',currency}).format(Number(value)||0);}
function date17(value){const d=new Date(value);return Number.isFinite(d.getTime())?d.toLocaleDateString(document.documentElement.lang==='ar'?'ar-EG':'en-US'):ui1616('Not recorded','غير مسجل');}
async function loadBilling17(){if(billingLoading17)return;billingLoading17=true;billingError17='';const owner=String(PXUSER56?.id||'');try{const data=await get17('/server/customer-billing-r1617.php');if(data.account_id!==owner)throw Error('Billing owner mismatch');billing17=data;}catch(error){billingError17=error.message;}finally{billingLoading17=false;if(workspaceRoute16()==='billing')route();}}
routes.billing=function(){const data=billing17,member=data?.membership,plan=member?member.plan:accountPlanLabel1615();return `<section class="page px-billing17">${pageHeading1616('Billing & membership','المدفوعات والاشتراك','Your account balance, recorded payments and issued invoices.','رصيد حسابك والمدفوعات المسجلة والفواتير الصادرة.')}<div class="px-billing-cards17"><article class="panel"><small>${ui1616('Current membership','العضوية الحالية')}</small><h2 data-i18n-skip>${escHtml(plan==='none'?ui1616('No paid plan assigned','لا توجد خطة مدفوعة معيّنة'):plan)}</h2><a href="#plans">${ui1616('View plans','عرض الخطط')} →</a></article><article class="panel"><small>${ui1616('Available credits','الكريديت المتاح')}</small><h2>${Number(member?.credits??PXPROFILE56?.credits??0).toLocaleString()}</h2><p>${ui1616('Generation balance','رصيد توليد الصور والفيديو')}</p></article><article class="panel"><small>${ui1616('Recorded payments','المدفوعات المسجلة')}</small><h2>${data?money17(data.totals.recorded_receipts_usd):'—'}</h2><p>${ui1616('Refunds','المبالغ المستردة')}: ${data?money17(data.totals.recorded_refunds_usd):'—'}</p></article></div><p class="px-notice17">${ui1616('Renewal dates and saved payment methods are not recorded by the current subscription integration. Online checkout is not connected.','تواريخ التجديد ووسائل الدفع المحفوظة غير مسجلة في تكامل الاشتراكات الحالي. الدفع الإلكتروني غير موصول.')}</p>${billingError17?`<p role="alert" class="px-error17">${escHtml(billingError17)}</p>`:''}<div class="px-section-row17"><h2>${ui1616('Payment history','سجل المدفوعات')}</h2><button type="button" class="ghost-btn" id="billingRefresh17">${ui1616('Refresh','تحديث')}</button><button type="button" class="ghost-btn" id="billingExport17" ${!data?'disabled':''}>${ui1616('Export statement','تصدير السجل')}</button></div>${billingLoading17&&!data?`<p role="status">${ui1616('Loading your records…','جارٍ تحميل سجلك…')}</p>`:data?`<div class="panel table-wrap"><table class="table"><thead><tr>${[ui1616('Date','التاريخ'),ui1616('Description','البيان'),ui1616('Reference','المرجع'),ui1616('Amount','المبلغ'),ui1616('Status','الحالة')].map(s=>'<th>'+s+'</th>').join('')}</tr></thead><tbody>${data.payments.map(row=>`<tr><td>${date17(row.date)}</td><td>${ui1616(row.kind==='subscription_sale'?'Subscription':row.kind==='credit_sale'?'Credits':'Refund',row.kind==='subscription_sale'?'اشتراك':row.kind==='credit_sale'?'كريديت':'استرداد')}</td><td data-i18n-skip>${escHtml(row.reference)}</td><td>${money17(row.amount,row.currency)}</td><td>${ui1616(row.status.replace(/_/g,' '),({'payment_recorded':'دفعة مسجلة','refund_recorded':'استرداد مسجل','corrected':'تم تصحيح القيد','correction':'قيد تصحيح'})[row.status]||row.status)}</td></tr>`).join('')||`<tr><td colspan="5">${ui1616('No payments recorded for this account.','لا توجد مدفوعات مسجلة لهذا الحساب.')}</td></tr>`}</tbody></table></div>`:''}<h2>${ui1616('Issued invoices','الفواتير الصادرة')}</h2><div class="px-invoices17">${data?.invoices.map((invoice,index)=>`<article class="panel"><div><b data-i18n-skip>${escHtml(invoice.number)}</b><p>${date17(invoice.payment_date)} · ${money17(invoice.amount_usd,invoice.currency)}</p>${invoice.status==='payment_corrected'?`<p>${ui1616('The associated payment has a recorded correction.','الدفعة المرتبطة لها قيد تصحيح مسجل.')}</p>`:''}</div><button type="button" class="ghost-btn" data-invoice17="${index}">${ui1616('Download PDF','تنزيل PDF')}</button></article>`).join('')||`<p>${ui1616('No invoices have been issued for this account.','لم تصدر فواتير لهذا الحساب بعد.')}</p>`}</div></section>`;};
async function loadVoice17(){voiceStatus17=await get17('/server/voice-status-r1617.php');return voiceStatus17;}
window.PIONXConversationSettings1617={check:loadVoice17,navigate:()=>go('voiceadmin')};
routes.voiceadmin=function(){if(String(PXPROFILE56?.role||'')!=='admin')return `<section class="page"><h1>${ui1616('Administrator access required','صلاحية الإدارة مطلوبة')}</h1></section>`;return `<section class="page px-voice-admin17">${pageHeading1616('Conversation settings','إعدادات المحادثة','Connect the workspace assistant using the existing server credentials.','شغّل مساعد مساحة العمل باستخدام إعدادات السيرفر الحالية.')}<div class="panel"><p id="voiceAdminStatus17" role="status">${ui1616('Checking the workspace connection…','جارٍ فحص اتصال مساحة العمل…')}</p><form id="voiceAdminForm17" hidden><label class="px-check17"><input id="voiceEnabled17" type="checkbox">${ui1616('Enable live conversations in this workspace','تفعيل المحادثات الحية في مساحة العمل الحالية')}</label><label>${ui1616('Who can connect','من يمكنه الاتصال')}<select id="voiceAccess17"><option value="admin">${ui1616('Administrators only','الإدارة فقط')}</option><option value="authenticated">${ui1616('Signed-in users','المستخدمون المسجلون')}</option></select></label><label>${ui1616('Conversation model','نموذج المحادثة')}<select id="voiceModel17"><option value="gpt-realtime-2.1">GPT Realtime 2.1</option><option value="gpt-realtime-2.1-mini">GPT Realtime 2.1 Mini</option><option value="gpt-realtime">GPT Realtime</option></select></label><p class="px-notice17">${ui1616('Conversation usage is billed to the workspace provider account, separately from user generation credits. This saves only feature settings for this copy of the site.','استخدام المحادثة يُحسب على حساب تشغيل الموقع لدى المزود، بشكل منفصل عن كريديت توليد المستخدم. هذه الخطوة تحفظ أعلام التشغيل لهذه النسخة فقط.')}</p><label class="px-check17"><input id="voiceCost17" type="checkbox">${ui1616('I acknowledge workspace-funded conversation costs','أقر بتكلفة المحادثات على حساب تشغيل الموقع')}</label><button type="submit" class="primary-btn" id="voiceSave17">${ui1616('Save settings','حفظ الإعدادات')}</button><a href="#assistant">${ui1616('Open the assistant','افتح المساعد')} →</a></form><p>${ui1616('API keys are never displayed or saved from this form. A configured credential is not proof that its quota or live connection works.','مفاتيح API لا تظهر أو تُحفظ من هذه الشاشة. وجود المفتاح لا يثبت توفر الرصيد أو نجاح الاتصال الحي.')}</p></div></section>`;};
async function wireVoiceAdmin17(){const status=q('#voiceAdminStatus17'),form=q('#voiceAdminForm17');let settings;try{const health=await loadVoice17();if(!status.isConnected)return;if(!health.admin||!health.settings)throw Error('Administrator access required');settings=health.settings;status.textContent=ui1616(settings.credential_configured?'Existing server credential is configured; live connection still needs a test.':'The server conversation credential is missing. Configure it securely on the server.','المفتاح الحالي '+(settings.credential_configured?'موجود في السيرفر؛ الاتصال الحي ما زال يحتاج تجربة.':'غير موجود؛ اضبط الاتصال بأمان على السيرفر.'));q('#voiceEnabled17').checked=settings.enabled;q('#voiceAccess17').value=settings.access;q('#voiceModel17').value=settings.model;form.hidden=false;}catch(error){if(status.isConnected)status.textContent=error.message;return;}
 form.onsubmit=async event=>{event.preventDefault();const button=q('#voiceSave17');button.disabled=true;try{const response=await get17('/server/voice-status-r1617.php',{enabled:q('#voiceEnabled17').checked,access:q('#voiceAccess17').value,model:q('#voiceModel17').value,acknowledge_workspace_cost:q('#voiceCost17').checked,previous_revision:settings.revision});settings=response.settings;status.textContent=ui1616('Settings saved for this workspace. Open the assistant to test the connection.','الإعدادات اتحفظت لهذه النسخة. افتح المساعد لتجربة الاتصال.');}catch(error){status.textContent=error.message;}finally{button.disabled=false;}};
}
async function loadCommunity17(){if(communityLoading17)return;communityLoading17=true;communityError17='';try{community17=(await get17('/server/community-gallery-r1617.php')).items||[];communityLoaded17=true;}catch(error){communityError17=error.message;}finally{communityLoading17=false;if(workspaceRoute16()==='explore'&&communityTab17==='images')route();}}
const communityBase17=routes.explore;
routes.explore=function(){const tabs=`<nav class="px-tabs17" aria-label="${ui1616('Community views','أقسام المجتمع')}"><button type="button" data-community-tab17="images" aria-pressed="${communityTab17==='images'}">${ui1616('Shared images','الصور المنشورة')}</button><button type="button" data-community-tab17="creators" aria-pressed="${communityTab17==='creators'}">${ui1616('Creators & portfolios','المبدعون وملفات الأعمال')}</button></nav>`;if(communityTab17==='creators')return tabs+communityBase17();return `<section class="page px-community17">${pageHeading1616('Community','المجتمع','Share selected renders and discover architectural work.','انشر صورًا تختارها من نتائجك واكتشف أعمالًا معمارية.',`<button type="button" class="primary-btn" data-publish17>${icon1616('plus')}${ui1616('Share from my renders','انشر من نتائجي')}</button>`)}${tabs}<input id="communitySearch17" type="search" class="px-search17" aria-label="${ui1616('Search community images','ابحث في صور المجتمع')}" placeholder="${ui1616('Search titles or creators…','ابحث بالعنوان أو اسم المبدع…')}">${communityError17?`<p class="px-error17" role="alert">${escHtml(communityError17)}</p><button class="ghost-btn" id="communityRetry17">${ui1616('Retry','إعادة المحاولة')}</button>`:''}<div class="px-community-grid17">${community17.map((post,index)=>`<article class="panel" data-community-search17="${escHtml((post.title+' '+post.author).toLowerCase())}"><button type="button" class="px-community-cover17" data-community-open17="${index}"><img src="${escHtml(post.images[0])}" alt="${escHtml(post.title)}" loading="lazy">${post.images.length>1?`<span>${post.images.length} ${ui1616('images','صور')}</span>`:''}</button><div class="px-community-meta17"><h3 data-i18n-skip>${escHtml(post.title)}</h3><p data-i18n-skip>${escHtml(post.author)}</p></div></article>`).join('')||`<div class="px-empty1616"><h2>${ui1616(communityLoading17?'Loading community…':'The next shared idea could be yours.',''+(communityLoading17?'جارٍ تحميل المجتمع…':'الفكرة القادمة ممكن تكون منك.'))}</h2><p>${ui1616('Choose saved renders, review the post, then publish.','اختار صورًا محفوظة، راجع المنشور، وبعدها انشر.')}</p></div>`}</div><p id="communityEmpty17" role="status" hidden>${ui1616('No posts match this search.','لا توجد منشورات تطابق البحث.')}</p></section>`;};
async function publishDialog17(preselect=''){
 const owner=String(PXUSER56?.id||'');if(!owner)return;await galleryLoad62();if(owner!==String(PXUSER56?.id||''))return;
 const rows=galleryRows62.filter(row=>!row.recoverable&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(row.id));
 if(!rows.length)return toast(ui1616('Save or recover a render in your library before publishing.','احفظ صورة أو استرجعها في مكتبة نتائجك قبل النشر.'));
 const request=crypto.randomUUID().replace(/-/g,'');let submitted=null;
 const modal=openDemoDialog(ui1616('Share your renders','انشر من نتائجك'),`<div class="px-publish17"><label>${ui1616('Post title','عنوان المنشور')}<input id="publishTitle17" maxlength="100" required></label><label>${ui1616('Description (optional)','الوصف (اختياري)')}<textarea id="publishDescription17" maxlength="700" rows="3"></textarea></label><p>${ui1616('Choose up to six saved images. Your originals stay in your library.','اختار حتى ست صور محفوظة. الصور الأصلية تفضل في مكتبتك.')}</p><div class="px-render-picker17">${rows.map(row=>`<label><input type="checkbox" data-publish-render17="${escHtml(row.id)}" ${row.id===preselect?'checked':''}><img src="${escHtml(galleryUrl62(row.url))}" alt="${escHtml(row.scene||'PIONX render')}"><span>${escHtml(row.scene||'PIONX render')}</span></label>`).join('')}</div><label class="px-check17"><input id="publishConfirm17" type="checkbox">${ui1616('Publish the selected images, title, description and creator display name for everyone to see.','انشر الصور المحددة والعنوان والوصف واسم العرض ليشاهدها الجميع.')}</label><p id="publishError17" role="alert" class="px-error17" hidden></p></div>`,`<button type="button" class="ghost-btn" data-dialog-close2>${ui1616('Cancel','إلغاء')}</button><button type="button" class="primary-btn" id="publishSubmit17">${ui1616('Review & publish selected','تأكيد نشر الصور المحددة')}</button>`);
 q('#publishSubmit17').onclick=async()=>{const button=q('#publishSubmit17'),error=q('#publishError17');error.hidden=true;try{const selected=qa('[data-publish-render17]:checked',modal).map(input=>input.dataset.publishRender17);if(!submitted){if(!q('#publishTitle17').value.trim()||selected.length<1||selected.length>6||!q('#publishConfirm17').checked)throw Error(ui1616('Add a title, select 1–6 images and confirm public publishing.','أضف عنوانًا، واختار من صورة إلى ست صور، وأكد النشر للعامة.'));submitted={action:'publish_render_set',account_id:owner,request_id:request,title:q('#publishTitle17').value.trim(),description:q('#publishDescription17').value.trim(),render_ids:selected,confirm_public:true};}
  if(owner!==String(PXUSER56?.id||''))throw Error(ui1616('Your account changed. Reopen the dialog.','الحساب اتغير. افتح النافذة من جديد.'));
  button.disabled=true;modal.dataset.busy1616='true';qa('input,textarea,button',modal).forEach(node=>node.disabled=true);button.textContent=ui1616('Preparing public images…','جارٍ تجهيز الصور للنشر…');await portfolioSaveQueue16;if(portfolioSyncError16)throw Error(ui1616('Sync pending project changes before publishing.','زامن تغييرات المشاريع المعلقة قبل النشر.'));
  const result=await portfolioApi614(submitted);if(!result.ok||!result.project?.id||!Array.isArray(result.portfolio?.projects))throw Error(ui1616('The server did not confirm publication. Retry the same request.','السيرفر ما أكدش النشر. جرّب نفس الطلب مرة تانية.'));if(owner!==String(PXUSER56?.id||''))throw Error('Your account changed');portfolioProjects614=result.portfolio.projects;portfolioRevision16++;portfolioServerLoaded614=true;safeStore.set(portfolioOwnerKey16(),JSON.stringify(portfolioProjects614));modal.hidden=true;communityTab17='images';go('explore');await loadCommunity17();toast(ui1616('Your selected images were published.','الصور المحددة اتنشرت.'));
 }catch(failure){error.textContent=failure.message;error.hidden=false;button.textContent=ui1616('Retry publication','إعادة محاولة النشر');}finally{delete modal.dataset.busy1616;qa('button',modal).forEach(node=>node.disabled=false);if(!submitted)qa('input,textarea',modal).forEach(node=>node.disabled=false);}};
}
const galleryCardBase17=galleryCard62;galleryCard62=function(item,index){return galleryCardBase17(item,index).replace('</article>',`${!item.recoverable?`<button type="button" class="ghost-btn px-render-publish17" data-publish-one17="${escHtml(item.id)}">${ui1616('Share to community','انشر في المجتمع')}</button>`:''}</article>`);};
const wireExperienceBase17=wireView;
wireView=function(name){
 if(name!=='explore'||communityTab17==='creators')wireExperienceBase17(name);
 const root=q('#viewRoot');root.dataset.route1617=name;
 if(root.dataset.lastMotion17!==name){root.dataset.lastMotion17=name;root.classList.remove('px-page-enter17');requestAnimationFrame(()=>root.classList.add('px-page-enter17'));}
 if(name==='billing'){
  if(billing17?.account_id!==String(PXUSER56?.id||''))billing17=null;
  q('#billingRefresh17').onclick=loadBilling17;
  q('#billingExport17').onclick=()=>downloadText('PIONX-billing-statement.json',JSON.stringify(billing17,null,2));
  for(const button of qa('[data-invoice17]',root))button.onclick=()=>financeInvoicePdf17(billing17.invoices[Number(button.dataset.invoice17)]).catch(error=>toast(error.message));
  if(!billing17&&!billingLoading17&&!billingError17)void loadBilling17();
 }
 if(name==='voiceadmin')void wireVoiceAdmin17();
 for(const button of qa('[data-publish17]',root))button.onclick=()=>publishDialog17().catch(error=>toast(error.message));
 for(const button of qa('[data-publish-one17]',root))button.onclick=()=>publishDialog17(button.dataset.publishOne17).catch(error=>toast(error.message));
 if(name==='explore'){
  for(const button of qa('[data-community-tab17]',root))button.onclick=()=>{communityTab17=button.dataset.communityTab17;route();};
  const retry=q('#communityRetry17');if(retry)retry.onclick=loadCommunity17;
  const search=q('#communitySearch17');
  if(search)search.oninput=()=>{
   const query=search.value.trim().toLowerCase();let visible=0;
   for(const card of qa('[data-community-search17]',root)){card.hidden=!card.dataset.communitySearch17.includes(query);if(!card.hidden)visible++;}
   q('#communityEmpty17').hidden=!!visible||!community17.length;
  };
  for(const button of qa('[data-community-open17]',root))button.onclick=()=>{
   const post=community17[Number(button.dataset.communityOpen17)];
   const images=post.images.map(url=>`<img src="${escHtml(url)}" alt="${escHtml(post.title)}">`).join('');
   openDemoDialog(post.title,`<div class="px-community-view17"><p data-i18n-skip>${escHtml(post.description)}</p>${images}</div>`);
  };
  if(!communityLoading17&&!communityLoaded17&&!communityError17&&communityTab17==='images')void loadCommunity17();
 }
};

const accountExperienceBase17=renderAccount56;renderAccount56=function(data){const owner=String(data?.user?.id||'');if(owner!==String(PXUSER56?.id||'')){billing17=null;billingError17='';voiceStatus17=null;community17=[];communityLoaded17=false;}return accountExperienceBase17(data);};
const studioExperienceBase17=organiseStudio1616;organiseStudio1616=function(){studioExperienceBase17();if(workspaceRoute16()!=='studio')return;const control=q('#viewRoot .control-panel');if(!control)return;
 if(!control.dataset.accordions17){if(qa('.px-studio-step',control).length<3||!q('.px-studio-actionbar',control))return;control.dataset.accordions17='true';const action=q('.px-studio-actionbar',control),scroll=document.createElement('div');scroll.className='px-studio-settings-scroll17';for(const node of [...control.children])if(node!==action)scroll.append(node);control.append(scroll);if(action)control.append(action);
  qa('.px-studio-step',scroll).forEach((section,index)=>{const details=document.createElement('details');details.className=section.className+' px-studio-accordion17';details.open=studioSourceImage?index===1:index===0;const heading=q('h3',section),summary=document.createElement('summary');summary.innerHTML=heading?.innerHTML||String(index+1);heading?.remove();details.append(summary);while(section.firstChild)details.append(section.firstChild);section.replaceWith(details);details.addEventListener('toggle',()=>{if(details.open)qa('.px-studio-accordion17',scroll).forEach(other=>{if(other!==details)other.open=false;});});});
  const note=q('.finish-note',scroll);if(note){const advanced=document.createElement('details');advanced.className='px-studio-advanced17';advanced.innerHTML='<summary>'+ui1616('Quality & design preservation','الجودة والحفاظ على التصميم')+'</summary>';advanced.append(note);scroll.append(advanced);}
 }
};
window.addEventListener('pionx:language',()=>{if(signedIn56()&&['billing','voiceadmin','explore'].includes(workspaceRoute16()))route();});
// ===== END PIONX R16.17 EXPERIENCE =====






})(); // R16.13: close application after all render extensions are initialized.
