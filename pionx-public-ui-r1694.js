'use strict';
document.addEventListener('DOMContentLoaded', () => {
      // The signed-in button is owned by the core theme controller.
      const publicThemeBtn=document.getElementById('themeBtnPublic');
      let savedTheme='light';
      try { savedTheme=(localStorage.getItem('pionx-theme')||localStorage.getItem('pionx_theme'))==='dark'?'dark':'light'; } catch (_) {}
      const syncPublicTheme=(theme)=>{
        document.documentElement.setAttribute('data-theme',theme);
        document.dispatchEvent(new CustomEvent('pionx:theme',{detail:theme}));
        const meta=document.querySelector('meta[name=\"theme-color\"]');
        if(meta)meta.setAttribute('content',theme==='light'?'#ffffff':'#060911');
        if(publicThemeBtn){
          publicThemeBtn.textContent=theme==='dark'?'☼':'☾';
          publicThemeBtn.setAttribute('aria-label',theme==='dark'?'Switch to light theme':'Switch to dark theme');
          publicThemeBtn.title=theme==='dark'?'Switch to light theme':'Switch to dark theme';
        }
      };
      syncPublicTheme(savedTheme);
      if(publicThemeBtn){publicThemeBtn.addEventListener('click',()=>{
        const theme=document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark';
        syncPublicTheme(theme);
        try { localStorage.setItem('pionx-theme',theme);localStorage.setItem('pionx_theme',theme); } catch (_) {}
      });}
      // 3. PASSWORD VISIBILITY TOGGLE (EYE ICON)
      function setupEyeToggle(btnId, inputId) {
        const btn = document.getElementById(btnId);
        const input = document.getElementById(inputId);
        if (!btn || !input) return;
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const isPassword = input.type === 'password';
          input.type = isPassword ? 'text' : 'password';
          btn.setAttribute('aria-pressed',String(isPassword));btn.setAttribute('aria-label',isPassword?'Hide password':'Show password');
          btn.innerHTML = isPassword
            ? `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`
            : `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
        });
      }
      setupEyeToggle('toggleSigninPassword', 'signinPassword');
      setupEyeToggle('toggleSignupPassword', 'signupPassword');

      // 5. BEFORE/AFTER SLIDER INTERACTION
      const sliderWrapper = document.getElementById('slider-box');
      const beforeLayer = document.getElementById('sliderBeforeLayer');
      const handle = document.getElementById('sliderHandle');
      if (sliderWrapper && beforeLayer && handle) {
        let isSliding = false;
        const updateSlider = (clientX) => {
          const rect = sliderWrapper.getBoundingClientRect();
          let offsetX = clientX - rect.left;
          if (offsetX < 0) offsetX = 0;
          if (offsetX > rect.width) offsetX = rect.width;
          const percentage = (offsetX / rect.width) * 100;
          beforeLayer.style.width = percentage + '%';
          handle.style.left = percentage + '%';
        };
        const onStart = (e) => { isSliding = true; updateSlider(e.clientX || e.touches[0].clientX); };
        const onEnd = () => { isSliding = false; };
        const onMove = (e) => { if (isSliding) updateSlider(e.clientX || (e.touches && e.touches[0].clientX)); };
        sliderWrapper.addEventListener('mousedown', onStart);
        window.addEventListener('mouseup', onEnd);
        window.addEventListener('mousemove', onMove);
        sliderWrapper.addEventListener('touchstart', onStart, { passive: true });
        window.addEventListener('touchend', onEnd);
        window.addEventListener('touchmove', onMove, { passive: true });
      }

      // Feature illustrations must never overwrite user project or render media.
      const viewRoot=document.getElementById('viewRoot');
      if(viewRoot){
        function enhanceWorkspaceCards(){
          viewRoot.querySelectorAll('article.feature-card[data-route]').forEach(card=>{
            if(card.dataset.enhanced)return;card.dataset.enhanced='true';
            const img=card.querySelector('img');if(img)img.loading='lazy';
          });
        }
        new MutationObserver(enhanceWorkspaceCards).observe(viewRoot,{childList:true,subtree:true});
        enhanceWorkspaceCards();
      }
    });
