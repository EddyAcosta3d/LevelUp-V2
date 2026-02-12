(()=>{
  const SPLASH_ENABLED = false;
  const el = document.getElementById('splash');
  if (!el) return;

  if (!SPLASH_ENABLED){
    try { el.remove(); } catch (_e) {}
    return;
  }

  const MIN_MS = 2000;
  const start = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

  let done = false;
  function hide(){
    if (done) return;
    done = true;
    try { el.classList.add('is-hide'); } catch (e) {}
    window.setTimeout(() => { try { el.remove(); } catch (e) {} }, 700);
  }

  function scheduleHide(){
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const elapsed = now - start;
    const wait = Math.max(0, MIN_MS - elapsed);
    window.setTimeout(() => {
      if (!document.getElementById('splash')) return;
      hide();
    }, wait);
  }

  window.addEventListener('load', scheduleHide, { once: true });

  // Fallback (very rare)
  window.setTimeout(() => {
    if (!document.getElementById('splash')) return;
    hide();
  }, 4000);
})();
