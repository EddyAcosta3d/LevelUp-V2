'use strict';

/**
 * @module tienda
 * @description Store/shop for rewards
 *
 * PUBLIC EXPORTS:
 * - renderTienda, closeStoreItemModal, saveStoreItem
 */

// Import dependencies
import {
  $,
  $$,
  state,
  escapeHtml,
  uid
} from './core_globals.js';

import { saveLocal } from './store.js';
import { currentHero, renderHeroDetail } from './fichas.js';

// Import celebration functions
let toast, openConfirmModal, showBigReward;

// Lazy load celebration functions (to avoid circular dependencies)
function ensureCelebrationFunctions() {
  if (!toast || !openConfirmModal || !showBigReward) {
    try {
      const celebrations = window.LevelUp?.celebrations;
      if (celebrations) {
        toast = celebrations.toast || (() => {});
        openConfirmModal = celebrations.openConfirmModal || ((opts) => Promise.resolve(confirm(opts.message)));
        showBigReward = celebrations.showBigReward || (() => {});
      } else {
        // Fallbacks
        toast = window.toast || ((msg) => console.log('[Toast]', msg));
        openConfirmModal = window.openConfirmModal || ((opts) => Promise.resolve(confirm(opts.message)));
        showBigReward = window.showBigReward || (() => {});
      }
    } catch (e) {
      console.warn('Could not load celebration functions:', e);
      toast = (msg) => console.log('[Toast]', msg);
      openConfirmModal = (opts) => Promise.resolve(confirm(opts.message));
      showBigReward = () => {};
    }
  }
}

// ============================================
// TIENDA - Sistema completo de canje de medallas
// ============================================

export function renderTienda(){
  const container = $('#tiendaContainer');
  if (!container) return;
  
  const hero = currentHero();
  if (!hero) {
    container.innerHTML = '<div class="muted">Selecciona un héroe para ver la tienda.</div>';
    return;
  }

  const store = state.data?.store || { items: [] };
  const items = Array.isArray(store.items) ? store.items : [];
  const heroMedals = Number(hero.medals ?? 0);
  
  // Header de la tienda
  const header = `
    <div class="tiendaHeader">
      <div class="tiendaHeader__info">
        <div class="tiendaHeader__eyebrow">RECOMPENSAS</div>
        <div class="tiendaHeader__title">Tienda del Héroe</div>
        <div class="tiendaHeader__medals">
          <div class="medalBadgeLarge">
            <svg viewBox="0 0 24 24" class="medalIcon">
              <path d="M7 2h4l1 5-3 2-2-7zM13 2h4l-2 7-3-2 1-5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
              <circle cx="12" cy="16" r="5" fill="none" stroke="currentColor" stroke-width="2"/>
              <path d="M12 13v6M9 16h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <span class="medalCount">${heroMedals}</span>
          </div>
          <div class="medalLabel">Medallas disponibles para canjear</div>
        </div>
      </div>
      ${state.role === 'teacher' ? `
        <button class="pill pill--small" id="btnAddStoreItem" type="button">+ Agregar Item</button>
      ` : ''}
    </div>
  `;

  // Grid de items
  let itemsHTML = '';
  
  if (items.length === 0) {
    itemsHTML = `
      <div class="tiendaEmpty">
        <div class="tiendaEmpty__icon">🏪</div>
        <div class="tiendaEmpty__title">La tienda está vacía</div>
        <div class="muted">
          ${state.role === 'teacher' 
            ? 'Agrega items para que los alumnos puedan canjear sus medallas.' 
            : 'Aún no hay items disponibles.'}
        </div>
      </div>
    `;
  } else {
    itemsHTML = '<div class="tiendaGrid">';
    
    items.forEach(item => {
      const cost = Number(item.cost ?? 0);
      const available = item.available !== false;
      const stock = Number(item.stock ?? 0);
      const hasStock = stock === 999 || stock > 0;
      
      // Check if hero already claimed this item
      const heroClaims = Array.isArray(hero.storeClaims) ? hero.storeClaims : [];
      const hasClaimed = heroClaims.some(c => String(c.itemId) === String(item.id));
      
      // Can afford?
      const canAfford = heroMedals >= cost;
      
      // Can claim?
      const canClaim = available && hasStock && canAfford && !hasClaimed && state.role === 'teacher';
      
      // Status
      let status = '';
      let statusClass = '';
      if (!available) {
        status = 'No disponible';
        statusClass = 'status--unavailable';
      } else if (!hasStock) {
        status = 'Agotado';
        statusClass = 'status--sold-out';
      } else if (hasClaimed) {
        status = '✓ Ya canjeado';
        statusClass = 'status--claimed';
      } else if (!canAfford) {
        status = `Necesitas ${cost - heroMedals} más`;
        statusClass = 'status--insufficient';
      } else {
        status = 'Disponible';
        statusClass = 'status--available';
      }
      
      itemsHTML += `
        <div class="tiendaItem ${hasClaimed ? 'is-claimed' : ''} ${!canAfford ? 'is-locked' : ''}" data-item-id="${escapeHtml(item.id)}">
          <div class="tiendaItem__icon">${escapeHtml(item.icon || '🎁')}</div>
          <div class="tiendaItem__body">
            <div class="tiendaItem__name">${escapeHtml(item.name || 'Item')}</div>
            <div class="tiendaItem__desc">${escapeHtml(item.description || '')}</div>
            <div class="tiendaItem__footer">
              <div class="tiendaItem__cost">
                <svg viewBox="0 0 24 24" class="costIcon">
                  <circle cx="12" cy="16" r="5" fill="none" stroke="currentColor" stroke-width="2"/>
                </svg>
                ${cost}
              </div>
              <div class="tiendaItem__status ${statusClass}">${status}</div>
            </div>
            ${state.role === 'teacher' ? `
              <div class="tiendaItem__adminBtns">
                <button class="iconBtn iconBtn--small" data-action="edit" title="Editar">✎</button>
                <button class="iconBtn iconBtn--small iconBtn--danger" data-action="delete" title="Eliminar">🗑</button>
              </div>
            ` : ''}
          </div>
          ${canClaim ? `
            <button class="tiendaItem__claimBtn pill pill--small" data-action="claim">
              Canjear
            </button>
          ` : ''}
        </div>
      `;
    });
    
    itemsHTML += '</div>';
  }
  
  container.innerHTML = header + itemsHTML;
  
  // Bind events
  bindTiendaEvents();
}

export function bindTiendaEvents(){
  const container = $('#tiendaContainer');
  if (!container) return;

  // Add item button
  const btnAdd = container.querySelector('#btnAddStoreItem');
  if (btnAdd) {
    btnAdd.addEventListener('click', () => openStoreItemModal('create'));
  }

  // Remove previous event listener if exists to prevent memory leaks
  if (container.__tiendaHandler) {
    container.removeEventListener('click', container.__tiendaHandler);
    container.__tiendaHandler = null;
  }

  // Item actions handler (event delegation)
  const clickHandler = async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.getAttribute('data-action');
    const itemCard = btn.closest('[data-item-id]');
    if (!itemCard) return;

    const itemId = itemCard.getAttribute('data-item-id');
    const item = (state.data?.store?.items || []).find(i => String(i.id) === String(itemId));
    if (!item) return;

    // Use try-catch to handle async errors
    try {
      if (action === 'claim') {
        await claimStoreItem(itemId);
      } else if (action === 'edit') {
        openStoreItemModal('edit', item);
      } else if (action === 'delete') {
        await deleteStoreItem(itemId);
      }
    } catch (err) {
      console.error('Error en acción de tienda:', err);
      ensureCelebrationFunctions();
      toast('❌ Error al procesar la acción. Intenta de nuevo.');
    }
  };

  // Store handler reference for later removal
  container.__tiendaHandler = clickHandler;
  container.addEventListener('click', clickHandler);
}

async function claimStoreItem(itemId){
  try {
    // Ensure celebration functions are available
    ensureCelebrationFunctions();

    // Get hero and save hero ID to prevent race condition
    const hero = currentHero();
    if (!hero) {
      toast('❌ Selecciona un héroe primero');
      return;
    }
    const heroId = hero.id;

    const store = state.data?.store || { items: [] };
    const item = store.items.find(i => String(i.id) === String(itemId));
    if (!item) {
      toast('❌ Item no encontrado');
      return;
    }

    const cost = Number(item.cost ?? 0);
    if (cost < 0) {
      toast('❌ Item con costo inválido');
      return;
    }

    const heroMedals = Number(hero.medals ?? 0);

    // Validations
    if (heroMedals < cost) {
      toast(`❌ No tienes suficientes medallas (necesitas ${cost}, tienes ${heroMedals})`);
      return;
    }

    // Check if already claimed
    hero.storeClaims = Array.isArray(hero.storeClaims) ? hero.storeClaims : [];
    const hasClaimed = hero.storeClaims.some(c => String(c.itemId) === String(itemId));
    if (hasClaimed) {
      toast('❌ Ya canjeaste este item');
      return;
    }

    // Check stock before claiming
    const stock = Number(item.stock ?? 0);
    if (item.stock !== 999 && stock <= 0) {
      toast('❌ Item sin stock disponible');
      return;
    }

    // Confirm
    const ok = await openConfirmModal({
      title: 'Canjear item',
      message: `¿Canjear "${item.name}" por ${cost} medallas para ${hero.name}?`,
      okText: 'Canjear',
      cancelText: 'Cancelar'
    });

    if (!ok) return;

    // CRITICAL: Verify hero hasn't changed during modal (race condition fix)
    const heroNow = currentHero();
    if (!heroNow || heroNow.id !== heroId) {
      toast('❌ Cambió el héroe seleccionado. Intenta de nuevo.');
      return;
    }

    // Deduct medals
    heroNow.medals = Number(heroNow.medals ?? 0) - cost;

    // Add to claims
    if (!Array.isArray(heroNow.storeClaims)) {
      heroNow.storeClaims = [];
    }
    heroNow.storeClaims.push({
      itemId: String(itemId),
      itemName: item.name,
      cost: cost,
      claimedAt: Date.now()
    });

    // Decrease stock if not infinite
    if (item.stock !== 999) {
      item.stock = Math.max(0, stock - 1);
    }

    // Validate data structure before saving
    if (!state.data) state.data = {};
    if (!state.data.heroes) state.data.heroes = [];

    saveLocal(state.data);

    // Re-render (with validation)
    if (typeof renderTienda === 'function') renderTienda();
    if (typeof renderHeroDetail === 'function') renderHeroDetail();

    // Celebration
    toast(`🎉 ¡${heroNow.name} canjeó "${item.name}"!`);
    showBigReward({
      title: '¡Item Canjeado!',
      subtitle: item.name,
      icon: item.icon || '🎁',
      duration: 2500
    });

  } catch (err) {
    console.error('Error al canjear item:', err);
    ensureCelebrationFunctions();
    toast('❌ Error al canjear el item. Intenta de nuevo.');
  }
}

async function deleteStoreItem(itemId){
  try {
    ensureCelebrationFunctions();

    const ok = await openConfirmModal({
      title: 'Eliminar item',
      message: '¿Eliminar este item de la tienda?',
      okText: 'Eliminar',
      cancelText: 'Cancelar'
    });

    if (!ok) return;

    // Validate and ensure data structure exists
    if (!state.data) state.data = {};
    if (!state.data.store) state.data.store = {};
    if (!Array.isArray(state.data.store.items)) {
      state.data.store.items = [];
    }

    state.data.store.items = state.data.store.items.filter(i => String(i.id) !== String(itemId));

    saveLocal(state.data);

    if (typeof renderTienda === 'function') renderTienda();

    toast('✅ Item eliminado');

  } catch (err) {
    console.error('Error al eliminar item:', err);
    ensureCelebrationFunctions();
    toast('❌ Error al eliminar el item. Intenta de nuevo.');
  }
}

export function openStoreItemModal(mode, item = null){
  let modal = $('#storeItemModal');
  if (!modal) {
    createStoreItemModal();
    modal = $('#storeItemModal');
    if (!modal) return; // guard against creation failure
  }
  
  const title = modal.querySelector('#storeItemModalTitle');
  if (title) {
    title.textContent = mode === 'edit' ? 'Editar Item' : 'Nuevo Item';
  }
  
  // Populate form
  const form = {
    id: modal.querySelector('#storeItemId'),
    name: modal.querySelector('#storeItemName'),
    desc: modal.querySelector('#storeItemDesc'),
    icon: modal.querySelector('#storeItemIcon'),
    cost: modal.querySelector('#storeItemCost'),
    stock: modal.querySelector('#storeItemStock'),
    available: modal.querySelector('#storeItemAvailable')
  };
  
  if (mode === 'edit' && item) {
    if (form.id) form.id.value = item.id || '';
    if (form.name) form.name.value = item.name || '';
    if (form.desc) form.desc.value = item.description || '';
    if (form.icon) form.icon.value = item.icon || '🎁';
    if (form.cost) form.cost.value = item.cost ?? 5;
    if (form.stock) form.stock.value = item.stock ?? 999;
    if (form.available) form.available.checked = item.available !== false;
  } else {
    if (form.id) form.id.value = '';
    if (form.name) form.name.value = '';
    if (form.desc) form.desc.value = '';
    if (form.icon) form.icon.value = '🎁';
    if (form.cost) form.cost.value = 5;
    if (form.stock) form.stock.value = 999;
    if (form.available) form.available.checked = true;
  }
  
  modal.hidden = false;
}

export function closeStoreItemModal(){
  const modal = $('#storeItemModal');
  if (modal) modal.hidden = true;
}

export function saveStoreItem(){
  try {
    ensureCelebrationFunctions();

    const modal = $('#storeItemModal');
    if (!modal) {
      toast('❌ Modal no encontrado');
      return;
    }

    const form = {
      id: modal.querySelector('#storeItemId'),
      name: modal.querySelector('#storeItemName'),
      desc: modal.querySelector('#storeItemDesc'),
      icon: modal.querySelector('#storeItemIcon'),
      cost: modal.querySelector('#storeItemCost'),
      stock: modal.querySelector('#storeItemStock'),
      available: modal.querySelector('#storeItemAvailable')
    };

    const id = form.id?.value?.trim() || '';
    const name = form.name?.value?.trim() || '';
    const description = form.desc?.value?.trim() || '';
    const icon = form.icon?.value?.trim() || '🎁';
    const cost = Number(form.cost?.value ?? 5);
    const stock = Number(form.stock?.value ?? 999);
    const available = form.available?.checked ?? true;

    // Validations
    if (!name) {
      toast('❌ El item necesita un nombre');
      form.name?.focus();
      return;
    }

    if (cost < 0) {
      toast('❌ El costo debe ser 0 o mayor');
      form.cost?.focus();
      return;
    }

    if (stock < 0 && stock !== 999) {
      toast('❌ El stock debe ser 0 o mayor (999 = ilimitado)');
      form.stock?.focus();
      return;
    }

    // Ensure data structure exists before saving
    if (!state.data) state.data = {};
    if (!state.data.store) state.data.store = {};
    if (!Array.isArray(state.data.store.items)) {
      state.data.store.items = [];
    }

    if (id) {
      // Edit existing
      const existing = state.data.store.items.find(i => String(i.id) === String(id));
      if (existing) {
        existing.name = name;
        existing.description = description;
        existing.icon = icon;
        existing.cost = cost;
        existing.stock = stock;
        existing.available = available;
        toast('✅ Item actualizado');
      } else {
        toast('❌ Item no encontrado');
        return;
      }
    } else {
      // Create new
      const newItem = {
        id: uid('store'),
        name,
        description,
        icon,
        cost,
        stock,
        available
      };
      state.data.store.items.push(newItem);
      toast('✅ Item creado');
    }

    saveLocal(state.data);

    if (typeof renderTienda === 'function') renderTienda();
    closeStoreItemModal();

  } catch (err) {
    console.error('Error al guardar item:', err);
    ensureCelebrationFunctions();
    toast('❌ Error al guardar el item. Intenta de nuevo.');
  }
}

export function createStoreItemModal(){
  const existingModal = $('#storeItemModal');
  if (existingModal) return;

  const modal = document.createElement('div');
  modal.id = 'storeItemModal';
  modal.className = 'modal';
  modal.hidden = true;

  // Remove onclick inline, use data-attributes instead
  modal.innerHTML = `
    <div class="modal__backdrop" data-action="close"></div>
    <div class="modal__card" role="dialog" aria-labelledby="storeItemModalTitle">
      <div class="modal__header">
        <div class="cardTitle" id="storeItemModalTitle">Nuevo Item</div>
        <button class="pill pill--small pill--ghost" data-action="close">✕</button>
      </div>
      <div class="modal__body">
        <input type="hidden" id="storeItemId" />

        <div class="field">
          <label class="label">Nombre del item</label>
          <input class="input" id="storeItemName" placeholder="Ej: Clase con juegos de mesa" />
        </div>

        <div class="field">
          <label class="label">Descripción</label>
          <textarea class="textarea" id="storeItemDesc" placeholder="Descripción detallada..."></textarea>
        </div>

        <div class="fields2">
          <div class="field">
            <label class="label">Icono (emoji)</label>
            <input class="input" id="storeItemIcon" placeholder="🎁" maxlength="4" />
          </div>

          <div class="field">
            <label class="label">Costo (medallas)</label>
            <input class="input" id="storeItemCost" type="number" min="0" value="5" />
          </div>
        </div>

        <div class="fields2">
          <div class="field">
            <label class="label">Stock (999 = ilimitado)</label>
            <input class="input" id="storeItemStock" type="number" min="0" value="999" />
          </div>

          <div class="field">
            <label class="label">Estado</label>
            <label class="checkbox">
              <input type="checkbox" id="storeItemAvailable" checked />
              <span>Disponible</span>
            </label>
          </div>
        </div>

        <div style="height:16px"></div>
        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button class="pill pill--ghost" data-action="cancel">Cancelar</button>
          <button class="pill" data-action="save">Guardar</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Add event delegation to modal (avoid onclick inline)
  modal.addEventListener('click', (e) => {
    const actionBtn = e.target.closest('[data-action]');
    if (!actionBtn) return;

    const action = actionBtn.dataset.action;
    if (action === 'close' || action === 'cancel') {
      closeStoreItemModal();
    } else if (action === 'save') {
      saveStoreItem();
    }
  });
}

// Exponer funciones globalmente
window.renderTienda = renderTienda;
window.closeStoreItemModal = closeStoreItemModal;
window.saveStoreItem = saveStoreItem;
