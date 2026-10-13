/* PIONX same-origin password gateway. Tokens are never persisted by this module. */
(function(){
 'use strict';
 let until=0,timer=null;
 function url(file){return new URL('server/'+file,new URL('./',location.href)).href}
 function status(message){const el=document.getElementById('authStatus');if(el){el.textContent=message;el.setAttribute('role','status');el.setAttribute('aria-live','polite')}}
 function countdown(seconds){
  until=Date.now()+Math.max(1,Math.min(900,seconds))*1000;clearInterval(timer);
  const draw=()=>{const left=Math.max(0,Math.ceil((until-Date.now())/1000)),button=document.getElementById('publicSignIn');
   if(button){button.disabled=left>0;button.textContent=left>0?'Try again in '+left+'s':'Sign in'}
   if(left>0)status('Sign-in temporarily paused. Try again in '+Math.floor(left/60)+':'+String(left%60).padStart(2,'0')+'.');
   else{clearInterval(timer);timer=null;status('You can try signing in again.')}};
  draw();timer=setInterval(draw,1000);
 }
 async function post(file,body){
  const response=await fetch(url(file),{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  let data;try{data=await response.json()}catch{throw new Error('Authentication service returned an invalid response.')}
  if(!response.ok){const error=new Error(data.error||'Authentication service unavailable.');error.retryAfter=Number(data.retry_after||response.headers.get('Retry-After')||0);error.status=response.status;throw error}
  return data;
 }
 function bindPasswords(){
  ['signinPassword','signupPassword','recoveryNewPassword','recoveryConfirmPassword'].forEach(id=>{
   const input=document.getElementById(id);if(!input)return;
   let wrap=input.closest('.password-wrapper');if(!wrap){wrap=document.createElement('div');wrap.className='password-wrapper';input.replaceWith(wrap);wrap.append(input)}
   let button=wrap.querySelector('button');if(!button){button=document.createElement('button');button.className='eye-toggle-btn';button.textContent='◉';wrap.append(button)}
   // Capture prevents existing legacy visibility listeners toggling a second time.
   button.type='button';button.setAttribute('aria-label','Show password');button.setAttribute('aria-pressed','false');button.setAttribute('aria-controls',id);
   button.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();const show=input.type==='password';input.type=show?'text':'password';button.setAttribute('aria-label',show?'Hide password':'Show password');button.setAttribute('aria-pressed',String(show))},true);
  });
 }
 window.PIONXAuth={
  signIn:(email,password)=>post('auth-login.php',{email,password}),
  requestRecovery:email=>post('auth-recovery.php',{action:'request',email}),
  verifyRecovery:payload=>post('auth-recovery.php',{...payload,action:'verify'}),
  updatePassword:password=>post('auth-recovery.php',{action:'update',password}),
  locked:()=>Date.now()<until,
  resumeButton:button=>{if(Date.now()<until){countdown(Math.ceil((until-Date.now())/1000));return}if(button){button.disabled=false;button.textContent='Sign in'}},
  showError:error=>{if(error.retryAfter>0)countdown(error.retryAfter);else status(error.message||'Authentication failed.')},
  bindPasswords
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bindPasswords,{once:true});else bindPasswords();
})();
