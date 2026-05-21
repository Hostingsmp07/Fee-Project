// public/scripts/api.js
const API_BASE = '';

const TOKEN_KEY = 'ai-scholar-token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || null;
}

export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function isAuthenticated() {
  return !!getToken();
}

async function apiRequest(path, options = {}) {
  const url = `${API_BASE}${path}`;

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  const response = await fetch(url, config);

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const data = await response.json();
      if (data && data.message) message = data.message;
    } catch (_) {}
    throw new Error(message);
  }

  if (response.status === 204) return null;
  return response.json();
}

// Auth API
export async function registerUser({ email, password }) {
  return apiRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function loginUser({ email, password }) {
  return apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

// Plans API
export async function fetchPlans() {
  return apiRequest('/api/plans');
}

export async function createPlan(payload) {
  return apiRequest('/api/plans', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updatePlan(id, payload) {
  return apiRequest(`/api/plans/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deletePlan(id) {
  return apiRequest(`/api/plans/${id}`, {
    method: 'DELETE',
  });
}

// Sessions API
export async function fetchSessions() {
  return apiRequest('/api/sessions');
}

export async function createSession(payload) {
  return apiRequest('/api/sessions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// AI API
export async function aiSuggestGoal(payload) {
  return apiRequest('/api/ai/suggest', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function aiGeneratePlan(payload) {
  return apiRequest('/api/ai/generate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}