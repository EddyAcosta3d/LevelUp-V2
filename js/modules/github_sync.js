'use strict';

/**
 * @module github_sync
 * @description GitHub API integration for auto-saving data
 *
 * FEATURES:
 * - Auto-save data.json to GitHub repository
 * - Token management (stored in localStorage)
 * - Retry logic for network failures
 * - Status feedback
 *
 * USAGE:
 * 1. User provides GitHub Personal Access Token (PAT) with 'repo' scope
 * 2. Token is stored in localStorage (only on teacher's device)
 * 3. saveToGitHub() pushes data.json to GitHub
 */

import { state, CONFIG } from './core_globals.js';

// GitHub configuration
const GITHUB_CONFIG = {
  owner: 'EddyAcosta3d',  // Your GitHub username
  repo: 'LevelUp-V2',      // Your repository name
  path: 'data/data.json',  // Path to data file
  branch: 'main',          // Preferred branch to push to
  tokenKey: 'github_pat',  // localStorage key for token
  branchKey: 'github_branch', // localStorage key for resolved branch
};

function getStoredBranch() {
  try {
    return localStorage.getItem(GITHUB_CONFIG.branchKey) || null;
  } catch (_e) {
    return null;
  }
}

function setStoredBranch(branch) {
  try {
    if (branch) localStorage.setItem(GITHUB_CONFIG.branchKey, String(branch));
  } catch (_e) {}
}

/**
 * Check if GitHub token is configured
 * @returns {boolean}
 */
export function hasGitHubToken() {
  try {
    const token = localStorage.getItem(GITHUB_CONFIG.tokenKey);
    return !!(token && token.trim().length > 0);
  } catch (e) {
    return false;
  }
}

/**
 * Get stored GitHub token
 * @returns {string|null}
 */
function getToken() {
  try {
    return localStorage.getItem(GITHUB_CONFIG.tokenKey);
  } catch (e) {
    return null;
  }
}

/**
 * Store GitHub token
 * @param {string} token - GitHub Personal Access Token
 * @returns {boolean} Success
 */
export function setGitHubToken(token) {
  try {
    if (!token || typeof token !== 'string') {
      console.error('Invalid token');
      return false;
    }
    localStorage.setItem(GITHUB_CONFIG.tokenKey, token.trim());
    return true;
  } catch (e) {
    console.error('Failed to store token:', e);
    return false;
  }
}

/**
 * Remove stored GitHub token
 */
export function clearGitHubToken() {
  try {
    localStorage.removeItem(GITHUB_CONFIG.tokenKey);
  } catch (e) {
    console.error('Failed to clear token:', e);
  }
}

/**
 * Get current file SHA (required for GitHub API update)
 * @param {string} token - GitHub PAT
 * @returns {Promise<string|null>} File SHA or null
 */
async function getCurrentFileSHA(token, branch) {
  try {
    const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.path}?ref=${encodeURIComponent(branch)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.sha || null;
  } catch (error) {
    console.error('Failed to get file SHA:', error);
    return null;
  }
}

async function resolveWorkingBranch(token) {
  const candidates = [
    getStoredBranch(),
    GITHUB_CONFIG.branch,
    'main',
    'master'
  ].filter(Boolean);

  const tried = new Set();
  for (const branch of candidates) {
    if (tried.has(branch)) continue;
    tried.add(branch);
    const sha = await getCurrentFileSHA(token, branch);
    if (sha) {
      setStoredBranch(branch);
      return { branch, sha };
    }
  }

  return { branch: GITHUB_CONFIG.branch, sha: null };
}

/**
 * Convert data to Base64 (GitHub API requirement)
 * @param {Object} data - Data object
 * @returns {string} Base64 encoded string
 */
function toBase64(data) {
  try {
    // Convert to JSON string
    const jsonString = JSON.stringify(data, null, 2);

    // Encode to UTF-8 then Base64
    // For UTF-8 support, we need to encode using encodeURIComponent
    const utf8String = unescape(encodeURIComponent(jsonString));
    return btoa(utf8String);
  } catch (e) {
    console.error('Failed to encode to Base64:', e);
    throw e;
  }
}

/**
 * Save current data to GitHub
 * @param {Object} options - Save options
 * @param {string} options.message - Commit message (optional)
 * @param {Function} options.onProgress - Progress callback (optional)
 * @returns {Promise<Object>} Result object
 */
export async function saveToGitHub(options = {}) {
  const {
    message = null,
    onProgress = null
  } = options;

  try {
    // Step 1: Check token
    if (onProgress) onProgress('Verificando token...');
    const token = getToken();
    if (!token) {
      throw new Error('No se encontró token de GitHub. Configúralo primero.');
    }

    // Step 2: Get current file SHA
    if (onProgress) onProgress('Obteniendo información del archivo...');
    const { branch, sha } = await resolveWorkingBranch(token);
    if (!sha) {
      throw new Error('No se pudo obtener información del archivo en GitHub.');
    }

    // Step 3: Prepare data
    if (onProgress) onProgress('Preparando datos...');
    const data = state.data;
    if (!data) {
      throw new Error('No hay datos para guardar.');
    }

    // Update metadata
    if (data.meta) {
      data.meta.updatedAt = new Date().toISOString();
    }

    // Step 4: Encode to Base64
    const content = toBase64(data);

    // Step 5: Prepare commit message
    const commitMessage = message || `Actualización automática - ${new Date().toLocaleString('es-MX', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })}`;

    // Step 6: Push to GitHub
    if (onProgress) onProgress('Guardando en GitHub...');
    const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.path}`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: commitMessage,
        content: content,
        sha: sha,
        branch
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`GitHub API error: ${response.status} - ${errorData.message || response.statusText}`);
    }

    const result = await response.json();

    if (onProgress) onProgress('¡Guardado exitoso!');

    return {
      success: true,
      message: `Datos guardados en GitHub correctamente (${branch})`,
      commit: result.commit,
      url: result.content?.html_url
    };

  } catch (error) {
    console.error('GitHub save failed:', error);
    return {
      success: false,
      message: error.message || 'Error desconocido al guardar en GitHub',
      error: error
    };
  }
}

/**
 * Test GitHub connection and token validity
 * @returns {Promise<Object>} Test result
 */
export async function testGitHubConnection() {
  try {
    const token = getToken();
    if (!token) {
      return { success: false, message: 'No hay token configurado' };
    }

    // Try to get file info (read-only test)
    const { branch, sha } = await resolveWorkingBranch(token);

    if (sha) {
      return { success: true, message: `Conexión exitosa con GitHub (${branch})` };
    } else {
      return { success: false, message: 'No se pudo acceder al archivo en GitHub' };
    }
  } catch (error) {
    return {
      success: false,
      message: error.message || 'Error al conectar con GitHub'
    };
  }
}

/**
 * Get GitHub save status info
 * @returns {Object} Status info
 */
export function getGitHubStatus() {
  return {
    hasToken: hasGitHubToken(),
    owner: GITHUB_CONFIG.owner,
    repo: GITHUB_CONFIG.repo,
    path: GITHUB_CONFIG.path,
    branch: getStoredBranch() || GITHUB_CONFIG.branch
  };
}

/**
 * Open GitHub configuration modal
 */
export function openGitHubConfigModal() {
  const modal = document.getElementById('githubConfigModal');
  if (!modal) {
    console.warn('GitHub config modal not found');
    return;
  }

  // Close all other modals first
  if (typeof window.closeAllModals === 'function') {
    window.closeAllModals('githubConfigModal');
  }

  // Load current token (if exists)
  const tokenInput = document.getElementById('inGitHubToken');
  if (tokenInput && hasGitHubToken()) {
    tokenInput.value = getToken() || '';
  }

  // Update status text
  updateGitHubStatusText();

  // Show modal
  modal.hidden = false;

  // Ensure modal bindings are set up
  bindGitHubModalEvents();
}

/**
 * Close GitHub configuration modal
 */
export function closeGitHubConfigModal() {
  const modal = document.getElementById('githubConfigModal');
  if (modal) {
    modal.hidden = true;
  }
}

/**
 * Update GitHub status text in modal
 */
function updateGitHubStatusText() {
  const statusEl = document.getElementById('githubStatusText');
  if (!statusEl) return;

  if (hasGitHubToken()) {
    statusEl.textContent = '✅ Token configurado';
    statusEl.style.color = 'rgba(0, 255, 100, 0.8)';
  } else {
    statusEl.textContent = 'No configurado';
    statusEl.style.color = 'rgba(255, 255, 255, 0.5)';
  }
}

/**
 * Bind events for GitHub modal (only binds once)
 */
function bindGitHubModalEvents() {
  // Prevent duplicate bindings
  if (window.__githubModalBound) return;
  window.__githubModalBound = true;

  const toast = window.toast || ((msg) => console.log(msg));

  // Close button
  document.getElementById('btnCloseGitHubConfig')?.addEventListener('click', closeGitHubConfigModal);

  // Backdrop click
  document.getElementById('githubConfigBackdrop')?.addEventListener('click', closeGitHubConfigModal);

  // Save token button
  document.getElementById('btnSaveGitHubToken')?.addEventListener('click', () => {
    const tokenInput = document.getElementById('inGitHubToken');
    if (!tokenInput) return;

    const token = tokenInput.value.trim();
    if (!token) {
      toast('❌ Por favor ingresa un token válido');
      return;
    }

    if (setGitHubToken(token)) {
      toast('✅ Token guardado correctamente');
      updateGitHubStatusText();
    } else {
      toast('❌ Error al guardar el token');
    }
  });

  // Clear token button
  document.getElementById('btnClearGitHubToken')?.addEventListener('click', () => {
    clearGitHubToken();
    const tokenInput = document.getElementById('inGitHubToken');
    if (tokenInput) tokenInput.value = '';
    toast('Token eliminado');
    updateGitHubStatusText();
  });

  // Test connection button
  document.getElementById('btnTestGitHub')?.addEventListener('click', async () => {
    toast('Probando conexión...');
    const result = await testGitHubConnection();
    if (result.success) {
      toast('✅ ' + result.message);
      updateGitHubStatusText();
    } else {
      toast('❌ ' + result.message);
    }
  });
}

// Export modal functions for global access
if (typeof window !== 'undefined') {
  window.openGitHubConfigModal = openGitHubConfigModal;
  window.closeGitHubConfigModal = closeGitHubConfigModal;
}
