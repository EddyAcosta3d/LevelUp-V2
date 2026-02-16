'use strict';

/**
 * @module projector
 * @description Projector mode for classroom display
 *
 * FEATURES:
 * - Large leaderboard with all students
 * - Group statistics
 * - Top 3 highlighted
 * - Auto-refresh
 */

import { state, escapeHtml } from './core_globals.js';

/**
 * Initialize projector mode
 */
export function initProjectorMode() {
  // Hide everything except projector
  const shell = document.getElementById('shell');
  if (!shell) return;

  // Clear shell and add projector container
  shell.innerHTML = `
    <div class="projector-container" id="projectorContainer">
      <div class="projector-header">
        <h1 class="projector-title">🏆 RANKING DE LA CLASE</h1>
        <p class="projector-subtitle">LevelUp - Gamificación Educativa</p>
      </div>

      <div class="projector-stats" id="projectorStats"></div>

      <div class="projector-leaderboard">
        <h2 class="projector-leaderboard-title">
          <span>🎯</span>
          <span>Clasificación General</span>
        </h2>
        <div class="projector-list" id="projectorList"></div>
      </div>
    </div>
  `;

  // Render data
  renderProjectorStats();
  renderProjectorLeaderboard();

  // Auto-refresh every 30 seconds
  setInterval(() => {
    renderProjectorStats();
    renderProjectorLeaderboard();
  }, 30000);
}

/**
 * Render group statistics
 */
function renderProjectorStats() {
  const container = document.getElementById('projectorStats');
  if (!container) return;

  const heroes = state.data?.heroes || [];
  const activeHeroes = heroes.filter(h => h && (h.xp || 0) > 0);

  // Calculate stats
  const totalStudents = heroes.length;
  const totalXP = heroes.reduce((sum, h) => sum + (h.xp || 0), 0);
  const avgXP = totalStudents > 0 ? Math.round(totalXP / totalStudents) : 0;
  const avgLevel = totalStudents > 0 ? Math.round(heroes.reduce((sum, h) => sum + (h.level || 1), 0) / totalStudents) : 1;
  const totalChallenges = heroes.reduce((sum, h) => {
    const completions = h.challengeCompletions || {};
    return sum + Object.keys(completions).filter(k => completions[k]).length;
  }, 0);

  container.innerHTML = `
    <div class="projector-stat-card">
      <div class="projector-stat-value">${totalStudents}</div>
      <div class="projector-stat-label">Estudiantes</div>
    </div>
    <div class="projector-stat-card">
      <div class="projector-stat-value">${totalXP.toLocaleString()}</div>
      <div class="projector-stat-label">XP Total</div>
    </div>
    <div class="projector-stat-card">
      <div class="projector-stat-value">${avgXP}</div>
      <div class="projector-stat-label">XP Promedio</div>
    </div>
    <div class="projector-stat-card">
      <div class="projector-stat-value">Nivel ${avgLevel}</div>
      <div class="projector-stat-label">Nivel Promedio</div>
    </div>
    <div class="projector-stat-card">
      <div class="projector-stat-value">${totalChallenges}</div>
      <div class="projector-stat-label">Desafíos Completados</div>
    </div>
  `;
}

/**
 * Render leaderboard
 */
function renderProjectorLeaderboard() {
  const container = document.getElementById('projectorList');
  if (!container) return;

  const heroes = state.data?.heroes || [];

  // Sort by XP (descending)
  const sorted = [...heroes].sort((a, b) => {
    const xpA = a.xp || 0;
    const xpB = b.xp || 0;
    return xpB - xpA;
  });

  // Render
  const html = sorted.map((hero, index) => {
    const rank = index + 1;
    const name = escapeHtml(hero.name || 'Sin nombre');
    const level = hero.level || 1;
    const xp = hero.xp || 0;
    const avatar = hero.avatar || '';
    const medals = hero.medals || 0;

    // Medal icon
    const medalIcon = `
      <svg viewBox="0 0 24 24" class="medalSvg" aria-hidden="true" style="width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;">
        <path d="M7 2h4l1 5-3 2-2-7zM13 2h4l-2 7-3-2 1-5z" stroke-linejoin="round"/>
        <circle cx="12" cy="16" r="5"/>
        <path d="M12 13v6M9 16h6" stroke-linecap="round"/>
      </svg>
    `;

    // Rank emoji
    let rankDisplay = rank;
    if (rank === 1) rankDisplay = '🥇';
    else if (rank === 2) rankDisplay = '🥈';
    else if (rank === 3) rankDisplay = '🥉';

    return `
      <div class="projector-hero-item rank-${rank <= 3 ? rank : 'other'}">
        <div class="projector-rank">${rankDisplay}</div>
        <div class="projector-avatar">
          ${avatar ? `<img src="${avatar}" alt="${name}" />` : ''}
        </div>
        <div class="projector-info">
          <div class="projector-name">${name}</div>
          <div class="projector-level">Nivel ${level}</div>
        </div>
        ${medals > 0 ? `
          <div class="projector-medals">
            ${medalIcon}
            <span>${medals}</span>
          </div>
        ` : ''}
        <div class="projector-xp">${xp.toLocaleString()} XP</div>
      </div>
    `;
  }).join('');

  container.innerHTML = html;
}

/**
 * Check if we're in projector mode
 */
export function isProjectorMode() {
  const urlParams = new URLSearchParams(location.search);
  return urlParams.has('mode') && urlParams.get('mode') === 'projector';
}
