'use strict';

/**
 * @module student_actions
 * @description Widget para que el alumno envíe evidencias y reclame recompensas
 * 
 * CÓMO SE USA:
 * - Se importa en app.bindings.js
 * - initStudentActions() se llama al cargar la app
 * - Agrega botones a la UI solo cuando hay sesión de alumno activa
 */

import { getSession } from './hero_session.js';
import {
  insertSubmission,
  insertStoreClaim,
  uploadEvidencia
} from './supabase_client.js';
import { state } from './core_globals.js';

// ============================================
// INIT — llama esto desde app.bindings.js
// ============================================
export function initStudentActions() {
  const session = getSession();
  if (!session || session.isAdmin) return; // Solo para alumnos

  // Seleccionar automáticamente la ficha del alumno
  autoSelectHero(session.heroId);

  // Escuchar cuando se selecciona un desafío → mostrar botón de enviar
  document.addEventListener('challengeSelected', (e) => {
    renderSubmitButton(session, e.detail?.challengeId);
  });

  // Escuchar cuando se abre la tienda → agregar lógica de canje via Supabase
  document.addEventListener('storeItemAction', (e) => {
    if (e.detail?.action === 'claim') {
      handleStoreClaim(session, e.detail.item);
    }
  });
}

// ============================================
// AUTO-SELECT — selecciona la ficha del alumno automáticamente
// ============================================
function autoSelectHero(heroId) {
  const trySelect = () => {
    const hero = state.data?.heroes?.find(h => h.id === heroId);
    if (!hero) { setTimeout(trySelect, 500); return; }

    // Cambiar al grupo correcto
    state.group = hero.group;
    const groupBtn = document.querySelector(`[data-group="${hero.group}"]`);
    if (groupBtn) groupBtn.click();

    // Seleccionar la ficha
    setTimeout(() => {
      const heroCard = document.querySelector(`[data-hero-id="${heroId}"]`);
      if (heroCard) heroCard.click();
    }, 300);
  };
  trySelect();
}

// ============================================
// ENVIAR EVIDENCIA — botón que aparece al ver un desafío
// ============================================
export function renderSubmitButton(session, challengeId) {
  // Remover botón previo si existe
  document.getElementById('studentSubmitBtn')?.remove();

  if (!challengeId) return;

  const hero = state.data?.heroes?.find(h => h.id === session.heroId);
  if (!hero) return;

  const challenge = state.data?.challenges?.find(c => c.id === challengeId);
  if (!challenge) return;

  // Si el profe ya usa asignación explícita, solo permitir envío en desafíos asignados.
  const assigned = hero.assignedChallenges;
  const isUnlocked = Array.isArray(assigned) && assigned.includes(String(challengeId));
  if (!isUnlocked) return;

  // Verificar si ya fue enviado
  const container = document.getElementById('challengeDetail') ||
                    document.getElementById('challengeBody') ||
                    document.querySelector('.challenge-detail');
  if (!container) return;

  const btn = document.createElement('div');
  btn.id = 'studentSubmitBtn';
  btn.innerHTML = `
    <div style="
      margin-top:1.5rem;
      padding:1rem;
      background:rgba(255,209,102,0.06);
      border:1px solid rgba(255,209,102,0.15);
      border-radius:12px;
    ">
      <div style="font-size:0.8rem; color:rgba(255,255,255,0.5); margin-bottom:0.75rem;">
        📎 Envía tu evidencia de este desafío
      </div>
      <textarea id="submitComment" placeholder="Comentario opcional..." style="
        width:100%; background:rgba(255,255,255,0.05);
        border:1px solid rgba(255,255,255,0.1);
        border-radius:8px; padding:0.6rem 0.9rem;
        color:#fff; font-size:0.82rem;
        resize:vertical; min-height:55px;
        margin-bottom:0.75rem; display:block;
      "></textarea>
      <label style="
        display:flex; align-items:center; gap:0.6rem;
        background:rgba(255,255,255,0.05);
        border:1px solid rgba(255,255,255,0.1);
        border-radius:8px; padding:0.6rem 0.9rem;
        cursor:pointer; margin-bottom:0.75rem;
        font-size:0.82rem; color:rgba(255,255,255,0.6);
      ">
        📁 <span id="fileLabel">Adjuntar archivo (foto, PDF...)</span>
        <input type="file" id="evidFile" accept="image/*,.pdf,.doc,.docx"
          style="display:none" onchange="updateFileLabel(this)">
      </label>
      <button id="btnSubmitEvid" onclick="submitEvidence('${session.heroId}', '${challengeId}')"
        style="
          background:#FFD166; color:#0a0a0f;
          border:none; border-radius:10px;
          padding:0.7rem 1.25rem;
          font-size:0.88rem; font-weight:700;
          cursor:pointer; width:100%;
        ">
        📤 Enviar evidencia
      </button>
    </div>
  `;
  container.appendChild(btn);
}

// Actualizar label del archivo
if (typeof window !== 'undefined') {
  window.updateFileLabel = function(input) {
    const label = document.getElementById('fileLabel');
    if (label && input.files[0]) label.textContent = `✅ ${input.files[0].name}`;
  };

  window.submitEvidence = async function(heroId, challengeId) {
    const btn = document.getElementById('btnSubmitEvid');
    const comment = document.getElementById('submitComment')?.value || '';
    const fileInput = document.getElementById('evidFile');
    const file = fileInput?.files[0];

    btn.disabled = true;
    btn.textContent = '⏳ Enviando...';

    try {
      const hero = state.data?.heroes?.find(h => h.id === heroId);
      const challenge = state.data?.challenges?.find(c => c.id === challengeId);

      let fileUrl = null;
      let fileName = null;

      if (file) {
        fileUrl = await uploadEvidencia(heroId, challengeId, file);
        fileName = file.name;
      }

      await insertSubmission({
        hero_id: heroId,
        hero_name: hero?.name || heroId,
        hero_group: hero?.group || '?',
        challenge_id: challengeId,
        challenge_title: challenge?.title || challengeId,
        file_url: fileUrl,
        file_name: fileName,
        comment: comment || null,
        status: 'pending'
      });

      btn.textContent = '✅ ¡Enviado!';
      btn.style.background = 'rgba(80,200,120,0.3)';
      btn.style.color = '#4ade80';

      setTimeout(() => {
        document.getElementById('studentSubmitBtn')?.remove();
      }, 2000);

    } catch (err) {
      btn.disabled = false;
      btn.textContent = '❌ Error, intenta de nuevo';
      btn.style.background = 'rgba(255,80,80,0.2)';
      btn.style.color = '#ff6b6b';
      console.error('Submit error:', err);
    }
  };
}

// ============================================
// CANJE DE TIENDA — intercepta el canje del alumno
// ============================================
export async function handleStoreClaim(session, item) {
  const hero = state.data?.heroes?.find(h => h.id === session.heroId);
  if (!hero) return;

  if (Number(hero.medals) < Number(item.cost)) {
    window.toast?.('No tienes suficientes medallas 🏅');
    return;
  }

  try {
    await insertStoreClaim({
      hero_id: session.heroId,
      hero_name: hero.name,
      hero_group: hero.group,
      item_id: item.id,
      item_name: item.name,
      item_cost: item.cost,
      status: 'pending'
    });
    window.toast?.(`🏅 ¡${item.name} reclamado! Tu profe lo confirmará pronto.`);
  } catch (err) {
    window.toast?.('❌ Error al reclamar: ' + err.message);
  }
}

// Exponer para uso global
if (typeof window !== 'undefined') {
  window.LevelUp = window.LevelUp || {};
  window.LevelUp.studentActions = { initStudentActions, renderSubmitButton, handleStoreClaim };
}
