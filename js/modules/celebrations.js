// ============================================
// SISTEMA DE CELEBRACIONES Y FEEDBACK VISUAL
// ============================================
// Uses global escapeHtml() from core_globals.js

/**
 * Muestra una pantalla de celebración grande
 * @param {Object} options - { title, subtitle, icon, duration }
 */
function showBigReward(options = {}) {
  const {
    title = '¡Felicidades!',
    subtitle = '',
    icon = '⭐',
    duration = 2500
  } = options;

  // Crear overlay de celebración
  let overlay = document.getElementById('bigRewardOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'bigRewardOverlay';
    overlay.className = 'bigRewardOverlay';
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="bigReward">
      <div class="bigReward__icon">${escapeHtml(icon)}</div>
      <div class="bigReward__title">${escapeHtml(title)}</div>
      ${subtitle ? `<div class="bigReward__subtitle">${escapeHtml(subtitle)}</div>` : ''}
    </div>
  `;

  overlay.classList.add('is-visible');
  
  // Confeti
  showConfetti();

  // Ocultar después de duration
  setTimeout(() => {
    overlay.classList.remove('is-visible');
  }, duration);
}

/**
 * Efecto de confeti
 */
function showConfetti() {
  const count = 50;
  const container = document.getElementById('confettiContainer');
  
  let confettiEl = container;
  if (!confettiEl) {
    confettiEl = document.createElement('div');
    confettiEl.id = 'confettiContainer';
    confettiEl.className = 'confettiContainer';
    document.body.appendChild(confettiEl);
  }

  const colors = ['#ffd700', '#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#ff9ff3'];

  for (let i = 0; i < count; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    confetti.style.left = Math.random() * 100 + '%';
    confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.animationDelay = Math.random() * 0.5 + 's';
    confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';
    confettiEl.appendChild(confetti);

    // Limpiar después de la animación
    setTimeout(() => {
      confetti.remove();
    }, 4000);
  }
}

/**
 * Animación de XP ganada
 */
function showXpGain(amount, element) {
  if (!element) element = document.body;
  
  const xpFloat = document.createElement('div');
  xpFloat.className = 'xpFloat';
  xpFloat.textContent = `+${amount} XP`;
  
  const rect = element.getBoundingClientRect();
  xpFloat.style.left = (rect.left + rect.width / 2) + 'px';
  xpFloat.style.top = rect.top + 'px';
  
  document.body.appendChild(xpFloat);
  
  setTimeout(() => {
    xpFloat.classList.add('is-animating');
  }, 10);
  
  setTimeout(() => {
    xpFloat.remove();
  }, 2000);
}

/**
 * Animar barra de XP
 */
function animateXpBar(heroId) {
  const hero = (state.data?.heroes || []).find(h => h.id === heroId);
  if (!hero) return;
  
  const xpFill = document.getElementById('xpFill');
  if (!xpFill) return;
  
  const xp = Number(hero.xp ?? 0);
  const xpMax = Number(hero.xpMax ?? 100);
  const percent = Math.max(0, Math.min(100, (xp / xpMax) * 100));
  
  xpFill.style.transition = 'width 0.8s cubic-bezier(0.4, 0.0, 0.2, 1)';
  xpFill.style.width = percent + '%';
  
  // Efecto de brillo
  xpFill.classList.add('is-pulsing');
  setTimeout(() => {
    xpFill.classList.remove('is-pulsing');
  }, 800);
}

/**
 * Shake effect para elementos
 */
function shakeElement(element) {
  if (!element) return;
  element.classList.add('is-shaking');
  setTimeout(() => {
    element.classList.remove('is-shaking');
  }, 500);
}

// Exponer globalmente
window.showBigReward = showBigReward;
window.showConfetti = showConfetti;
window.showXpGain = showXpGain;
window.animateXpBar = animateXpBar;
window.shakeElement = shakeElement;
