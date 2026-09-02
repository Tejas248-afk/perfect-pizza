document.addEventListener('DOMContentLoaded', () => {
  setupAuthNav();

  // Agar login page hai (customer/staff panels)
  if (
    document.getElementById('customer-auth-panel') ||
    document.getElementById('staff-auth-panel')
  ) {
    initAuthPage();
  }
});

/* ---------- Navbar auth state ---------- */

function setupAuthNav() {
  const user = Api.getStoredUser();
  const userNameEl = document.querySelector('[data-user-name]');
  const loginLink = document.querySelector('[data-login-link]');
  const logoutLink = document.querySelector('[data-logout-link]');
  const profileBtn = document.querySelector('[data-profile-btn]');
  const profileInitialEl = document.querySelector('[data-profile-initial]');

  if (!user) {
    if (userNameEl) userNameEl.textContent = '';
    if (loginLink) loginLink.style.display = 'inline-flex';
    if (logoutLink) logoutLink.style.display = 'none';
    if (profileBtn) profileBtn.style.display = 'none';
    return;
  }

  if (userNameEl) userNameEl.textContent = user.name;
  if (loginLink) loginLink.style.display = 'none';
  if (logoutLink) logoutLink.style.display = 'inline-flex';

  // Sirf CUSTOMER ke liye profile icon show karo
  if (profileBtn) {
    if (user.role === 'CUSTOMER') {
      profileBtn.style.display = 'inline-flex';
      if (profileInitialEl && user.name) {
        profileInitialEl.textContent = user.name.charAt(0).toUpperCase();
      }

      if (!profileBtn.dataset.bound) {
        profileBtn.dataset.bound = 'true';
        profileBtn.addEventListener('click', () => {
          window.location.href = 'profile.html';
        });
      }
    } else {
      profileBtn.style.display = 'none';
    }
  }

  if (logoutLink && !logoutLink.dataset.bound) {
    logoutLink.dataset.bound = 'true';
    logoutLink.addEventListener('click', e => {
      e.preventDefault();
      Api.clearAuth();
      window.location.href = '/login.html';
    });
  }
}

/* ---------- Login page (Customer OTP + Staff) ---------- */

function initAuthPage() {
  // Toggle buttons
  const toggleBtns = document.querySelectorAll('.auth-toggle-btn');
  const customerPanel = document.getElementById('customer-auth-panel');
  const staffPanel = document.getElementById('staff-auth-panel');

  toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.authMode;
      toggleBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (mode === 'staff') {
        if (customerPanel) customerPanel.style.display = 'none';
        if (staffPanel) staffPanel.style.display = 'block';
      } else {
        if (customerPanel) customerPanel.style.display = 'block';
        if (staffPanel) staffPanel.style.display = 'none';
      }
    });
  });

  // Customer OTP handlers
  const sendOtpBtn = document.getElementById('customer-send-otp-btn');
  const verifyOtpBtn = document.getElementById('customer-verify-otp-btn');
  const otpInput = document.getElementById('customer-otp');

  if (sendOtpBtn) {
    sendOtpBtn.addEventListener('click', handleCustomerSendOtp);
  }
  if (verifyOtpBtn) {
    verifyOtpBtn.addEventListener('click', handleCustomerVerifyOtp);
  }

  if (otpInput) {
    otpInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleCustomerVerifyOtp();
      }
    });
  }

  // Staff login form
  const staffForm = document.getElementById('staff-login-form');
  if (staffForm) {
    staffForm.addEventListener('submit', handleStaffLogin);
  }
}

/* ---------- Customer OTP Flow ---------- */

async function handleCustomerSendOtp() {
  const contactInput = document.getElementById('customer-contact');
  const errorBox = document.getElementById('customer-error');
  const otpSection = document.getElementById('customer-otp-section');
  const btn = document.getElementById('customer-send-otp-btn');

  if (!contactInput) return;

  const contact = contactInput.value.trim();
  if (!contact) {
    if (errorBox) {
      errorBox.textContent = 'Mobile number daalna zaroori hai.';
      errorBox.style.display = 'block';
    }
    return;
  }

  if (errorBox) {
    errorBox.textContent = '';
    errorBox.style.display = 'none';
  }

  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'OTP bhej rahe hain...';

  try {
    await Api.post('/auth/customer/send-otp', { contact });

    if (otpSection) otpSection.style.display = 'block';

    if (errorBox) {
      errorBox.textContent = 'OTP bhej diya gaya hai. Apne phone pe check karein.';
      errorBox.classList.remove('alert-error');
      errorBox.classList.add('alert-success');
      errorBox.style.display = 'block';
    }
  } catch (err) {
    console.error('Send OTP error', err);
    if (errorBox) {
      errorBox.classList.remove('alert-success');
      errorBox.classList.add('alert-error');
      errorBox.textContent =
        err.message || 'OTP nahi bhej paaye, thodi der baad dobara try karein.';
      errorBox.style.display = 'block';
    }
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

async function handleCustomerVerifyOtp() {
  const contactInput = document.getElementById('customer-contact');
  const otpInput = document.getElementById('customer-otp');
  const errorBox = document.getElementById('customer-error');
  const btn = document.getElementById('customer-verify-otp-btn');

  if (!contactInput || !otpInput) return;

  const contact = contactInput.value.trim();
  const otp = otpInput.value.trim();

  if (!contact || !otp) {
    if (errorBox) {
      errorBox.textContent = 'Mobile number aur OTP dono required hain.';
      errorBox.style.display = 'block';
    }
    return;
  }

  if (errorBox) {
    errorBox.textContent = '';
    errorBox.style.display = 'none';
  }

  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Verifying...';

  try {
    const res = await Api.post('/auth/customer/verify-otp', {
      contact,
      otp
    });

    Api.setAuth(res.token, res.user);

    // CUSTOMER ke liye direct menu
    window.location.href = 'menu.html';
  } catch (err) {
    console.error('Verify OTP error', err);
    if (errorBox) {
      errorBox.textContent =
        err.message || 'OTP verify nahi ho paaya, dubara try karein.';
      errorBox.style.display = 'block';
    }
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

/* ---------- Staff Login (Admin/Kitchen) ---------- */

async function handleStaffLogin(e) {
  e.preventDefault();

  const form = e.target;
  const contactInput = document.getElementById('staff-contact');
  const passwordInput = document.getElementById('staff-password');
  const errorBox = document.getElementById('staff-error');
  const submitBtn = form.querySelector('button[type="submit"]');

  const contact = contactInput.value.trim();
  const password = passwordInput.value.trim();

  if (!contact || !password) {
    if (errorBox) {
      errorBox.textContent = 'Contact aur password dono chahiye.';
      errorBox.style.display = 'block';
    }
    return;
  }

  if (errorBox) {
    errorBox.textContent = '';
    errorBox.style.display = 'none';
  }

  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Login kar rahe hain...';

  try {
    const res = await Api.post('/auth/login', {
      contact,
      password
    });

    const user = res.user;
    Api.setAuth(res.token, user);

    const role = user?.role;

    if (role === 'KITCHEN') {
      window.location.href = 'kitchen/orders.html';
    } else if (role === 'ADMIN') {
      window.location.href = 'admin/index.html';
    } else {
      // Agar kisi reason se CUSTOMER aa gaya, fir bhi handle kar lo
      window.location.href = 'menu.html';
    }
  } catch (err) {
    console.error('Staff login error', err);
    if (errorBox) {
      errorBox.textContent =
        err.message ||
        'Login nahi ho paya, details check karein (sirf staff ke liye).';
      errorBox.style.display = 'block';
    }
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}