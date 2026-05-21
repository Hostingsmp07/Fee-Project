// Landing page logic
// public/scripts/landing.js
import {
  registerUser,
  loginUser,
  setToken,
  isAuthenticated,
} from './api.js';

document.addEventListener('DOMContentLoaded', () => {
  const yearEl = document.getElementById('year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  const getStartedButtons = [
    document.getElementById('nav-get-started'),
    document.getElementById('hero-get-started'),
  ].filter(Boolean);

  getStartedButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (isAuthenticated()) {
        window.location.href = '/app';
      } else {
        openAuthModal('register');
      }
    });
  });

  const scrollFeaturesBtn = document.getElementById('hero-scroll-features');
  if (scrollFeaturesBtn) {
    scrollFeaturesBtn.addEventListener('click', () => {
      const featuresSection = document.getElementById('features');
      if (featuresSection) {
        featuresSection.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  const authModal = document.getElementById('auth-modal');
  const authBackdrop = document.getElementById('auth-backdrop');
  const authCloseBtn = document.getElementById('auth-close-btn');
  const authForm = document.getElementById('auth-form');
  const authTitle = document.getElementById('auth-title');
  const authSubmitBtn = document.getElementById('auth-submit-btn');
  const authToggleBtn = document.getElementById('auth-toggle-mode');
  const authToggleMessage = document.getElementById('auth-toggle-message');
  const authError = document.getElementById('auth-error');
  const authEmail = document.getElementById('auth-email');
  const authPassword = document.getElementById('auth-password');
  const authConfirmPassword = document.getElementById('auth-confirm-password');
  const confirmPasswordField = document.getElementById('confirm-password-field');
  const emailError = document.getElementById('email-error');
  const passwordError = document.getElementById('password-error');
  const confirmPasswordError = document.getElementById('confirm-password-error');
  const openLoginBtn = document.getElementById('btn-open-login');

  let authMode = 'login';

  // ── Validation helpers ──────────────────────────────────────────────────────

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function setFieldError(inputEl, errorEl, message) {
    errorEl.textContent = message;
    inputEl.classList.toggle('input-invalid', !!message);
  }

  function clearErrors() {
    [emailError, passwordError, confirmPasswordError].forEach(el => el.textContent = '');
    [authEmail, authPassword, authConfirmPassword].forEach(el => el.classList.remove('input-invalid'));
    authError.textContent = '';
  }

  function validateForm() {
    let valid = true;
    const email = authEmail.value.trim();
    const password = authPassword.value;
    const confirm = authConfirmPassword.value;

    // Email
    if (!email) {
      setFieldError(authEmail, emailError, 'Email is required.');
      valid = false;
    } else if (!isValidEmail(email)) {
      setFieldError(authEmail, emailError, 'Please enter a valid email address.');
      valid = false;
    } else {
      setFieldError(authEmail, emailError, '');
    }

    // Password
    if (!password) {
      setFieldError(authPassword, passwordError, 'Password is required.');
      valid = false;
    } else if (authMode === 'register' && password.length < 8) {
      setFieldError(authPassword, passwordError, 'Password must be at least 8 characters.');
      valid = false;
    } else if (authMode === 'register' && !/[A-Z]/.test(password)) {
      setFieldError(authPassword, passwordError, 'Password must contain at least one uppercase letter.');
      valid = false;
    } else if (authMode === 'register' && !/[0-9]/.test(password)) {
      setFieldError(authPassword, passwordError, 'Password must contain at least one number.');
      valid = false;
    } else {
      setFieldError(authPassword, passwordError, '');
    }

    // Confirm password (register only)
    if (authMode === 'register') {
      if (!confirm) {
        setFieldError(authConfirmPassword, confirmPasswordError, 'Please confirm your password.');
        valid = false;
      } else if (confirm !== password) {
        setFieldError(authConfirmPassword, confirmPasswordError, 'Passwords do not match.');
        valid = false;
      } else {
        setFieldError(authConfirmPassword, confirmPasswordError, '');
      }
    }

    return valid;
  }

  // Live validation on blur
  authEmail.addEventListener('blur', () => {
    const email = authEmail.value.trim();
    if (!email) {
      setFieldError(authEmail, emailError, 'Email is required.');
    } else if (!isValidEmail(email)) {
      setFieldError(authEmail, emailError, 'Please enter a valid email address.');
    } else {
      setFieldError(authEmail, emailError, '');
    }
  });

  authPassword.addEventListener('blur', () => {
    const password = authPassword.value;
    if (!password) {
      setFieldError(authPassword, passwordError, 'Password is required.');
    } else if (authMode === 'register' && password.length < 8) {
      setFieldError(authPassword, passwordError, 'Password must be at least 8 characters.');
    } else if (authMode === 'register' && !/[A-Z]/.test(password)) {
      setFieldError(authPassword, passwordError, 'Password must contain at least one uppercase letter.');
    } else if (authMode === 'register' && !/[0-9]/.test(password)) {
      setFieldError(authPassword, passwordError, 'Password must contain at least one number.');
    } else {
      setFieldError(authPassword, passwordError, '');
    }
  });

  authConfirmPassword.addEventListener('blur', () => {
    if (authMode !== 'register') return;
    const confirm = authConfirmPassword.value;
    if (!confirm) {
      setFieldError(authConfirmPassword, confirmPasswordError, 'Please confirm your password.');
    } else if (confirm !== authPassword.value) {
      setFieldError(authConfirmPassword, confirmPasswordError, 'Passwords do not match.');
    } else {
      setFieldError(authConfirmPassword, confirmPasswordError, '');
    }
  });

  // ── Modal open/close ────────────────────────────────────────────────────────

  function openAuthModal(mode = 'login') {
    authMode = mode;
    clearErrors();
    authEmail.value = '';
    authPassword.value = '';
    authConfirmPassword.value = '';

    const isRegister = authMode === 'register';

    authTitle.textContent = isRegister ? 'Create account' : 'Log in';
    authSubmitBtn.textContent = isRegister ? 'Sign up' : 'Log in';
    authToggleMessage.textContent = isRegister ? 'Already have an account?' : 'New here?';
    authToggleBtn.textContent = isRegister ? 'Log in instead' : 'Create an account';

    // Show/hide confirm password field
    confirmPasswordField.classList.toggle('hidden', !isRegister);
    authPassword.setAttribute('autocomplete', isRegister ? 'new-password' : 'current-password');

    authModal.classList.remove('hidden');
    authModal.setAttribute('aria-hidden', 'false');
    authEmail.focus();
  }

  function closeAuthModal() {
    authModal.classList.add('hidden');
    authModal.setAttribute('aria-hidden', 'true');
    clearErrors();
  }

  if (openLoginBtn) {
    openLoginBtn.addEventListener('click', () => openAuthModal('login'));
  }

  if (authBackdrop) {
    authBackdrop.addEventListener('click', closeAuthModal);
  }

  if (authCloseBtn) {
    authCloseBtn.addEventListener('click', closeAuthModal);
  }

  if (authToggleBtn) {
    authToggleBtn.addEventListener('click', () => {
      openAuthModal(authMode === 'login' ? 'register' : 'login');
    });
  }

  if (authForm) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      authError.textContent = '';

      if (!validateForm()) return;

      authSubmitBtn.disabled = true;
      authSubmitBtn.textContent = authMode === 'login' ? 'Logging in...' : 'Signing up...';

      const email = authEmail.value.trim();
      const password = authPassword.value;

      try {
        let result;
        if (authMode === 'login') {
          result = await loginUser({ email, password });
        } else {
          result = await registerUser({ email, password });
        }

        if (result.token) {
          setToken(result.token);
          window.location.href = '/app';
        } else {
          authError.textContent = 'Unexpected response from server.';
        }
      } catch (err) {
        authError.textContent = err.message || 'Authentication failed.';
      } finally {
        authSubmitBtn.disabled = false;
        authSubmitBtn.textContent = authMode === 'login' ? 'Log in' : 'Sign up';
      }
    });
  }

  // Optional: auto-redirect logged-in users
  // if (isAuthenticated()) {
  //   window.location.href = '/app';
  // }
});