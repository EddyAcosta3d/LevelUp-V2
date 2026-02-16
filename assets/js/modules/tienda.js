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
  state,
  escapeHtml
} from './core_globals.js';

import { saveLocal } from './store.js';
import { currentHero } from './fichas.js';

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
        <div class="tiendaHeader__medals">
          <div class="medalBadgeLarge">
            <svg viewBox="0 0 24 24" class="medalIcon">
              <path d="M7 2h4l1 5-3 2-2-7zM13 2h4l-2 7-3-2 1-5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
              <circle cx="12" cy="16" r="5" fill="none" stroke="currentColor" stroke-width="2"/>
              <path d="M12 13v6M9 16h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <span class="medalCount">${heroMedals}</span>
          </div>
          <div class="medalLabel">Tus medallas</div>
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
          </div>
          ${canClaim ? `
            <button class="tiendaItem__claimBtn pill pill--small" data-action="claim">
              Canjear
            </button>
          ` : ''}
          ${state.role === 'teacher' ? `
            <div class="tiendaItem__adminBtns">
              <button class="iconBtn iconBtn--small" data-action="edit" title="Editar">✎</button>
              <button class="iconBtn iconBtn--small iconBtn--danger" data-action="delete" title="Eliminar">🗑</button>
            </div>
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

  // Item actions (event delegation) — avoid duplicate listeners on the persistent container
  if (container.__tiendaBound) return;
  container.__tiendaBound = true;
  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    
    const action = btn.getAttribute('data-action');
    const itemCard = btn.closest('[data-item-id]');
    if (!itemCard) return;
    
    const itemId = itemCard.getAttribute('data-item-id');
    const item = (state.data?.store?.items || []).find(i => String(i.id) === String(itemId));
    if (!item) return;
    
    if (action === 'claim') {
      await claimStoreItem(itemId);
    } else if (action === 'edit') {
      openStoreItemModal('edit', item);
    } else if (action === 'delete') {
      await deleteStoreItem(itemId);
    }
  });
}

async function claimStoreItem(itemId){
  const hero = currentHero();
  if (!hero) return;
  
  const store = state.data?.store || { items: [] };
  const item = store.items.find(i => String(i.id) === String(itemId));
  if (!item) return;
  
  const cost = Number(item.cost ?? 0);
  const heroMedals = Number(hero.medals ?? 0);
  
  // Validations
  if (heroMedals < cost) {
    toast(`❌ No tienes suficientes medallas (necesitas ${cost})`);
    return;
  }
  
  // Check if already claimed
  hero.storeClaims = Array.isArray(hero.storeClaims) ? hero.storeClaims : [];
  const hasClaimed = hero.storeClaims.some(c => String(c.itemId) === String(itemId));
  if (hasClaimed) {
    toast('❌ Ya canjeaste este item');
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
  
  // Deduct medals
  hero.medals = heroMedals - cost;
  
  // Add to claims
  hero.storeClaims.push({
    itemId: String(itemId),
    itemName: item.name,
    cost: cost,
    claimedAt: Date.now()
  });
  
  // Decrease stock if not infinite
  if (item.stock !== 999) {
    item.stock = Math.max(0, Number(item.stock ?? 0) - 1);
  }
  
  saveLocal(state.data);
  renderTienda();
  renderHeroDetail();
  
  // Celebración
  toast(`🎉 ¡${hero.name} canjeó "${item.name}"!`);
  showBigReward({
    title: '¡Item Canjeado!',
    subtitle: item.name,
    icon: item.icon || '🎁',
    duration: 2500
  });
}

async function deleteStoreItem(itemId){
  const ok = await openConfirmModal({
    title: 'Eliminar item',
    message: '¿Eliminar este item de la tienda?',
    okText: 'Eliminar',
    cancelText: 'Cancelar'
  });
  
  if (!ok) return;
  
  state.data = state.data || {};
  state.data.store = state.data.store || { items: [] };
  state.data.store.items = state.data.store.items.filter(i => String(i.id) !== String(itemId));
  
  saveLocal(state.data);
  renderTienda();
  toast('Item eliminado');
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
  const modal = $('#storeItemModal');
  if (!modal) return;
  
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
  
  state.data = state.data || {};
  state.data.store = state.data.store || { items: [] };
  
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
  renderTienda();
  closeStoreItemModal();
}

export function createStoreItemModal(){
  const existingModal = $('#storeItemModal');
  if (existingModal) return;
  
  const modal = document.createElement('div');
  modal.id = 'storeItemModal';
  modal.className = 'modal';
  modal.hidden = true;
  
  modal.innerHTML = `
    <div class="modal__backdrop" onclick="closeStoreItemModal()"></div>
    <div class="modal__card" role="dialog" aria-labelledby="storeItemModalTitle">
      <div class="modal__header">
        <div class="cardTitle" id="storeItemModalTitle">Nuevo Item</div>
        <button class="pill pill--small pill--ghost" onclick="closeStoreItemModal()">✕</button>
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
          <button class="pill pill--ghost" onclick="closeStoreItemModal()">Cancelar</button>
          <button class="pill" onclick="saveStoreItem()">Guardar</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
}

// Exponer funciones globalmente
window.renderTienda = renderTienda;
window.closeStoreItemModal = closeStoreItemModal;
window.saveStoreItem = saveStoreItem;
