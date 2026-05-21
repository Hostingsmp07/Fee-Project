import {
  fetchPlans,
  createPlan,
  updatePlan,
  deletePlan,
  fetchSessions,
  createSession,
  aiSuggestGoal,
  aiGeneratePlan,
} from './api.js';
import { FocusTimer } from './timer.js';
import { isAuthenticated, setToken } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
  // Optional auth guard: if you want to force login before app
  if (!isAuthenticated()) {
    window.location.href = '/';
    return;
  }

  // Core elements
  const planForm = document.getElementById('plan-form');
  const planList = document.getElementById('plan-list');
  const timerValueEl = document.getElementById('timer-value');
  const timerPlanSelect = document.getElementById('timer-plan-select');
  const timerStartBtn = document.getElementById('timer-start');
  const timerPauseBtn = document.getElementById('timer-pause');
  const timerResetBtn = document.getElementById('timer-reset');
  const sessionList = document.getElementById('session-list');
  const backToLandingBtn = document.getElementById('back-to-landing');
  const presetButtons = document.querySelectorAll('.timer-presets .chip-clickable');
  const sidebarLinks = document.querySelectorAll('.sidebar-link');
  const viewPanels = document.querySelectorAll('.view-panel');
  const aiSuggestBtn = document.getElementById('btn-ai-suggest');
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const greetingEl = document.getElementById('user-greeting-name');
  const logoutBtn = document.getElementById('btn-logout');
  const authStatusChip = document.getElementById('auth-status-chip');
  const sidebar = document.querySelector('.sidebar');
  const sidebarToggleBtn = document.getElementById('btn-sidebar-toggle');

  // Dashboard refs
  const dashActivePlans = document.getElementById('dash-active-plans');
  const dashTodayHours = document.getElementById('dash-today-hours');
  const dashWeekHours = document.getElementById('dash-week-hours');

  // Plan generator refs
  const genTopicInput = document.getElementById('gen-topic');
  const genDifficultySelect = document.getElementById('gen-difficulty');
  const genSessionsInput = document.getElementById('gen-sessions');
  const genButton = document.getElementById('btn-generate-plan');
  const generatedPlanBox = document.getElementById('generated-plan');

  // Analytics view
  const analyticsTable = document.getElementById('analytics-table');

  // Profile/settings
  const userNameInput = document.getElementById('user-name');
  const userThemeSelect = document.getElementById('user-theme');
  const saveSettingsBtn = document.getElementById('btn-save-settings');

  let currentPlans = [];
  let isEditingPlanId = null;

  let sessionTotalsByPlan = {};
  let todayTotalHours = 0;
  let overallTotalHours = 0;
  let mostFocusedPlanId = null;
  let weekTotalHours = 0;

  const SETTINGS_KEY = 'ai-scholar-settings';

  if (authStatusChip) {
    authStatusChip.textContent = 'Logged in';
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      setToken(null);
      window.location.href = '/';
    });
  }

  if (sidebar && sidebarToggleBtn) {
    sidebarToggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('sidebar-open');
    });
  }

  const timer = new FocusTimer({
    onTick: (formatted) => {
      if (timerValueEl) {
        timerValueEl.textContent = formatted;
      }
    },
    onComplete: async (planId, durationSeconds) => {
      if (!planId || !durationSeconds) return;
      try {
        await createSession({ planId, durationSeconds });
        await loadSessions();
      } catch (err) {
        console.error('Failed to log session', err);
      }
    },
  });

  // ---------- Theme / Settings helpers ----------

  function applyTheme(theme) {
    document.body.classList.remove('theme-dark', 'theme-light', 'theme-high-contrast');

    if (theme === 'light') {
      document.body.classList.add('theme-light');
    } else if (theme === 'high-contrast') {
      document.body.classList.add('theme-high-contrast');
    } else {
      document.body.classList.add('theme-dark');
    }
  }

  function loadSettingsFromStorage() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);

      if (!raw) {
        applyTheme('default');
        if (greetingEl) greetingEl.textContent = 'Hi, Scholar';
        return;
      }

      const settings = JSON.parse(raw);

      if (settings.name && userNameInput) {
        userNameInput.value = settings.name;
      }

      if (settings.theme && userThemeSelect) {
        userThemeSelect.value = settings.theme;
        applyTheme(settings.theme);
      } else {
        applyTheme('default');
      }

      if (greetingEl) {
        const name = settings.name && settings.name.trim();
        greetingEl.textContent = name ? `Hi, ${name}` : 'Hi, Scholar';
      }
    } catch (err) {
      console.error('Failed to load settings', err);
      applyTheme('default');
      if (greetingEl) greetingEl.textContent = 'Hi, Scholar';
    }
  }

  function saveSettingsToStorage() {
    if (!userNameInput || !userThemeSelect) return;

    const settings = {
      name: userNameInput.value.trim(),
      theme: userThemeSelect.value,
    };

    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      applyTheme(settings.theme);

      if (greetingEl) {
        greetingEl.textContent = settings.name
          ? `Hi, ${settings.name}`
          : 'Hi, Scholar';
      }

      alert('Settings saved locally.');
    } catch (err) {
      console.error('Failed to save settings', err);
      alert('Could not save settings.');
    }
  }

  // ---------- AI suggestion helpers (fallback heuristic) ----------

  function getSuggestedHours(topic, difficulty) {
    const diff = (difficulty || 'medium').toLowerCase();
    let base;

    if (diff === 'easy') base = 5;
    else if (diff === 'hard') base = 18;
    else base = 10;

    const t = topic.toLowerCase();

    if (t.includes('ml') || t.includes('machine learning')) base += 3;
    else if (t.includes('deep learning') || t.includes('neural')) base += 4;
    else if (t.includes('dsa') || t.includes('data structure')) base += 2;
    else if (t.includes('math') || t.includes('probability')) base += 2;
    else if (t.includes('ai')) base += 2;

    return Math.min(Math.max(base, 1), 300);
  }

  function buildSuggestedTitle(topic) {
    const cleaned = topic.trim();
    if (!cleaned) return '';
    if (/^mastering/i.test(cleaned)) return cleaned;
    return `Mastering ${cleaned}`;
  }

  // ---------- View navigation ----------

  function setActiveView(view) {
    sidebarLinks.forEach(btn => {
      const isActive = btn.dataset.view === view;
      btn.classList.toggle('active', isActive);
    });

    viewPanels.forEach(panel => {
      panel.classList.toggle('hidden', panel.id !== `view-${view}`);
    });
  }

  sidebarLinks.forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      setActiveView(view);
    });
  });

  // ---------- Event bindings ----------

  if (backToLandingBtn) {
    backToLandingBtn.addEventListener('click', () => {
      window.location.href = '/';
    });
  }

  if (aiSuggestBtn) {
    aiSuggestBtn.addEventListener('click', async () => {
      const topic = planForm.title.value.trim();
      const difficulty = planForm.difficulty.value;

      if (!topic) {
        alert('Enter a topic/title first so AI can estimate hours.');
        return;
      }

      aiSuggestBtn.disabled = true;
      aiSuggestBtn.textContent = 'Talking to AI...';

      try {
        const res = await aiSuggestGoal({ topic, difficulty });
        const suggestedHours = Number(res.suggestedHours) || getSuggestedHours(topic, difficulty);
        const suggestedTitle = buildSuggestedTitle(topic);

        planForm.goalHours.value = suggestedHours;
        if (suggestedTitle) {
          planForm.title.value = suggestedTitle;
        }
      } catch (err) {
        console.error('AI suggestGoal error', err);
        alert(err.message || 'AI suggestion failed, using local heuristic.');
        const fallback = getSuggestedHours(topic, difficulty);
        const fallbackTitle = buildSuggestedTitle(topic);
        planForm.goalHours.value = fallback;
        if (fallbackTitle) {
          planForm.title.value = fallbackTitle;
        }
      } finally {
        aiSuggestBtn.disabled = false;
        aiSuggestBtn.textContent = '⚙ AI Suggest Goal';
      }
    });
  }

  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', () => {
      saveSettingsToStorage();
    });
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      let settings = { name: '', theme: 'default' };
      try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (raw) settings = { ...settings, ...JSON.parse(raw) };
      } catch (_) {}

      const current = settings.theme || 'default';
      const order = ['default', 'light', 'high-contrast'];
      const idx = order.indexOf(current);
      const next = order[(idx + 1) % order.length];

      settings.theme = next;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      applyTheme(next);

      if (userThemeSelect) {
        userThemeSelect.value = next;
      }
    });
  }

  // Plan generator with AI
  if (genButton) {
    genButton.addEventListener('click', async () => {
      const topic = (genTopicInput.value || '').trim();
      const difficulty = genDifficultySelect.value;
      const sessionsCount = Number(genSessionsInput.value) || 6;

      if (!topic) {
        alert('Please enter a topic.');
        return;
      }

      generatedPlanBox.innerHTML = '<p class="text-muted">Asking AI for a plan...</p>';
      genButton.disabled = true;
      genButton.textContent = 'Generating with AI...';

      try {
        const res = await aiGeneratePlan({ topic, difficulty, sessionsCount });

        const totalHours = Number(res.totalHours) || 0;
        const sessions = Array.isArray(res.sessions) ? res.sessions : [];

        if (!sessions.length) {
          generatedPlanBox.innerHTML =
            '<p class="text-muted">AI could not generate a plan. Try again or adjust your topic.</p>';
          return;
        }

        let html = '';
        if (totalHours > 0) {
          html += `<p>Suggested total: <strong>${totalHours.toFixed(1)} h</strong> across <strong>${sessions.length}</strong> sessions.</p>`;
        } else {
          html += `<p>Suggested outline for <strong>${sessions.length}</strong> sessions.</p>`;
        }

        html += '<ol>';
        sessions.forEach((s, index) => {
          const title = s.title || `Session ${index + 1}`;
          const duration = s.durationHours != null ? Number(s.durationHours).toFixed(1) + ' h' : '';
          const desc = s.description || '';
          html += `<li><strong>${title}</strong>${duration ? ` — ${duration}` : ''}<br>${desc}</li>`;
        });
        html += '</ol>';

        generatedPlanBox.innerHTML = html;
      } catch (err) {
        console.error('AI generatePlan error', err);
        generatedPlanBox.innerHTML =
          '<p class="text-muted">AI plan generation failed. Please try again later.</p>';
      } finally {
        genButton.disabled = false;
        genButton.textContent = 'Generate suggestions';
      }
    });
  }

  // Timer controls
  timerPlanSelect.addEventListener('change', () => {
    timer.setPlan(timerPlanSelect.value || null);
  });

  timerStartBtn.addEventListener('click', () => {
    if (!timerPlanSelect.value) {
      alert('Please select a plan for this focus session.');
      return;
    }
    timer.start();
  });

  timerPauseBtn.addEventListener('click', () => {
    timer.pause();
  });

  timerResetBtn.addEventListener('click', () => {
    timer.reset();
  });

  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const minutes = Number(btn.dataset.minutes);
      timer.setDurationMinutes(minutes);
    });
  });

  // ---------- Data loading ----------

  async function loadPlans() {
    try {
      currentPlans = await fetchPlans();
      renderPlans();
      populateTimerPlanSelect();
      renderDashboard();
      renderAnalyticsSummary();
      renderAnalyticsTable();
    } catch (err) {
      console.error('Failed to load plans', err);
    }
  }

  async function loadSessions() {
    try {
      const sessions = await fetchSessions();

      sessionTotalsByPlan = sessions.reduce((acc, s) => {
        const hours = s.durationSeconds / 3600;
        acc[s.planId] = (acc[s.planId] || 0) + hours;
        return acc;
      }, {});

      overallTotalHours = sessions.reduce((sum, s) => sum + s.durationSeconds / 3600, 0);

      const todayStr = new Date().toISOString().slice(0, 10);
      todayTotalHours = sessions.reduce((sum, s) => {
        const loggedDay = s.loggedAt.slice(0, 10);
        if (loggedDay === todayStr) {
          return sum + s.durationSeconds / 3600;
        }
        return sum;
      }, 0);

      const now = new Date();
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(now.getDate() - 6);
      weekTotalHours = sessions.reduce((sum, s) => {
        const d = new Date(s.loggedAt);
        if (d >= sevenDaysAgo && d <= now) {
          return sum + s.durationSeconds / 3600;
        }
        return sum;
      }, 0);

      let maxHours = 0;
      mostFocusedPlanId = null;
      Object.entries(sessionTotalsByPlan).forEach(([planId, hours]) => {
        if (hours > maxHours) {
          maxHours = hours;
          mostFocusedPlanId = planId;
        }
      });

      renderSessions(sessions);
      renderPlans();
      renderAnalyticsSummary();
      renderDashboard();
      renderAnalyticsTable();
    } catch (err) {
      console.error('Failed to load sessions', err);
    }
  }

  // ---------- Render helpers ----------

  function renderAnalyticsSummary() {
    const todayEl = document.getElementById('analytics-today');
    const totalEl = document.getElementById('analytics-total');
    const mostFocusedEl = document.getElementById('analytics-most-focused');

    if (!todayEl || !totalEl || !mostFocusedEl) return;

    todayEl.textContent = `${todayTotalHours.toFixed(1)} h`;
    totalEl.textContent = `${overallTotalHours.toFixed(1)} h`;

    if (!mostFocusedPlanId) {
      mostFocusedEl.textContent = '–';
      return;
    }

    const plan = currentPlans.find(p => p.id === mostFocusedPlanId);
    mostFocusedEl.textContent = plan ? plan.title : 'Unknown';
  }

  function renderDashboard() {
    if (dashActivePlans) {
      dashActivePlans.textContent = currentPlans.length.toString();
    }
    if (dashTodayHours) {
      dashTodayHours.textContent = `${todayTotalHours.toFixed(1)} h`;
    }
    if (dashWeekHours) {
      dashWeekHours.textContent = `${weekTotalHours.toFixed(1)} h`;
    }
  }

  function renderAnalyticsTable() {
    if (!analyticsTable) return;

    if (!currentPlans.length) {
      analyticsTable.innerHTML = '<p class="text-muted">No plans yet.</p>';
      return;
    }

    let html = '<table><thead><tr><th>Plan</th><th>Goal (h)</th><th>Focused (h)</th><th>% Complete</th></tr></thead><tbody>';
    currentPlans.forEach(plan => {
      const total = sessionTotalsByPlan[plan.id] || 0;
      const pct = plan.goalHours ? Math.min(100, (total / plan.goalHours) * 100) : 0;
      html += `<tr>
        <td>${plan.title}</td>
        <td>${plan.goalHours}</td>
        <td>${total.toFixed(1)}</td>
        <td>${Math.round(pct)}%</td>
      </tr>`;
    });
    html += '</tbody></table>';
    analyticsTable.innerHTML = html;
  }

  function renderPlans() {
    planList.innerHTML = '';
    if (!currentPlans.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.innerHTML = `
        <div class="empty-icon">📚</div>
        <h3>No plans yet</h3>
        <p>Let’s create your first focused study plan.</p>
      `;
      planList.appendChild(empty);
      return;
    }

    currentPlans.forEach(plan => {
      const card = document.createElement('article');
      card.className = 'plan-card';

      const main = document.createElement('div');
      main.className = 'plan-main';

      const titleEl = document.createElement('h3');
      titleEl.className = 'plan-title';
      titleEl.textContent = plan.title;

      const titleRow = document.createElement('div');
      titleRow.style.display = 'flex';
      titleRow.style.alignItems = 'center';
      titleRow.style.gap = '0.4rem';
      titleRow.appendChild(titleEl);

      if (plan.id === mostFocusedPlanId && (sessionTotalsByPlan[plan.id] || 0) > 0) {
        const badge = document.createElement('span');
        badge.textContent = 'Most Focused';
        badge.className = 'chip chip-soft';
        badge.style.fontSize = '0.65rem';
        titleRow.appendChild(badge);
      }

      const meta = document.createElement('div');
      meta.className = 'plan-meta';

      const goalSpan = document.createElement('span');
      goalSpan.className = 'plan-goal-pill';
      goalSpan.textContent = `${plan.goalHours} hr goal`;

      const difficultySpan = document.createElement('span');
      difficultySpan.textContent = `Difficulty: ${plan.difficulty}`;

      const createdSpan = document.createElement('span');
      const createdAt = new Date(plan.createdAt);
      createdSpan.textContent = `Added ${createdAt.toLocaleDateString()}`;

      meta.appendChild(goalSpan);
      meta.appendChild(difficultySpan);
      meta.appendChild(createdSpan);

      const totalHours = sessionTotalsByPlan[plan.id] || 0;
      if (totalHours > 0) {
        const totalSpan = document.createElement('span');
        totalSpan.textContent = `Focused: ${totalHours.toFixed(1)} h`;
        meta.appendChild(totalSpan);
      }

      main.appendChild(titleRow);
      main.appendChild(meta);

      const progressWrapper = document.createElement('div');
      progressWrapper.className = 'plan-progress';

      const bar = document.createElement('div');
      bar.className = 'plan-progress-bar';

      const fill = document.createElement('div');
      fill.className = 'plan-progress-fill';

      const percentage = plan.goalHours
        ? Math.min(100, (totalHours / plan.goalHours) * 100)
        : 0;

      fill.style.width = `${percentage}%`;

      bar.appendChild(fill);

      const text = document.createElement('div');
      text.className = 'plan-progress-text';

      const leftText = document.createElement('span');
      leftText.textContent = `${totalHours.toFixed(1)} / ${plan.goalHours} h`;

      const rightText = document.createElement('span');
      rightText.textContent = `${Math.round(percentage)}%`;

      text.appendChild(leftText);
      text.appendChild(rightText);

      progressWrapper.appendChild(bar);
      progressWrapper.appendChild(text);

      main.appendChild(progressWrapper);

      const actions = document.createElement('div');
      actions.className = 'plan-actions';

      const editBtn = document.createElement('button');
      editBtn.textContent = 'Edit';
      editBtn.className = 'edit-btn';
      editBtn.addEventListener('click', () => startEditingPlan(plan));

      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Delete';
      deleteBtn.className = 'delete-btn';
      deleteBtn.addEventListener('click', () => handleDeletePlan(plan.id));

      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);

      card.appendChild(main);
      card.appendChild(actions);
      planList.appendChild(card);
    });
  }

  function populateTimerPlanSelect() {
    const currentSelection = timerPlanSelect.value;
    timerPlanSelect.innerHTML = '<option value="">Select a plan to focus on</option>';
    currentPlans.forEach(plan => {
      const option = document.createElement('option');
      option.value = plan.id;
      option.textContent = plan.title;
      timerPlanSelect.appendChild(option);
    });

    if (currentSelection) {
      timerPlanSelect.value = currentSelection;
      timer.setPlan(timerPlanSelect.value || null);
    }
  }

  function renderSessions(sessions) {
    sessionList.innerHTML = '';
    if (!sessions.length) {
      const empty = document.createElement('p');
      empty.textContent = 'No sessions logged yet. Start the timer to log your first focus block.';
      empty.classList.add('text-muted');
      sessionList.appendChild(empty);
      return;
    }

    sessions
      .slice()
      .sort((a, b) => new Date(b.loggedAt) - new Date(a.loggedAt))
      .forEach(session => {
        const plan = currentPlans.find(p => p.id === session.planId);
        const item = document.createElement('div');
        item.className = 'session-item';

        const left = document.createElement('div');
        left.className = 'session-left';

        const title = document.createElement('span');
        title.className = 'session-title';
        title.textContent = plan ? plan.title : 'Unknown plan';

        const meta = document.createElement('span');
        meta.className = 'session-meta';
        const loggedAtDate = new Date(session.loggedAt);
        meta.textContent = loggedAtDate.toLocaleString();

        left.appendChild(title);
        left.appendChild(meta);

        const duration = document.createElement('span');
        duration.className = 'session-duration';
        const minutes = Math.round(session.durationSeconds / 60);
        duration.textContent = `${minutes} min`;

        item.appendChild(left);
        item.appendChild(duration);
        sessionList.appendChild(item);
      });
  }

  function startEditingPlan(plan) {
    isEditingPlanId = plan.id;
    planForm.title.value = plan.title;
    planForm.goalHours.value = plan.goalHours;
    planForm.difficulty.value = plan.difficulty;
    setActiveView('plans');
  }

  async function handleDeletePlan(planId) {
    const confirmDelete = confirm('Delete this study plan?');
    if (!confirmDelete) return;
    try {
      await deletePlan(planId);
      await loadPlans();
      await loadSessions();
    } catch (err) {
      console.error('Failed to delete plan', err);
    }
  }

  planForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(planForm);
    const payload = {
      title: formData.get('title').trim(),
      goalHours: Number(formData.get('goalHours')),
      difficulty: formData.get('difficulty'),
    };

    if (!payload.title || !payload.goalHours) {
      alert('Please fill in title and goal hours.');
      return;
    }

    try {
      if (isEditingPlanId) {
        await updatePlan(isEditingPlanId, payload);
      } else {
        await createPlan(payload);
      }
      planForm.reset();
      isEditingPlanId = null;
      await loadPlans();
      await loadSessions();
    } catch (err) {
      console.error('Failed to save plan', err);
      alert(err.message);
    }
  });

  // ---------- Init ----------

  loadSettingsFromStorage();
  loadPlans();
  loadSessions();
  setActiveView('dashboard');
});