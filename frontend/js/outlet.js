// frontend/js/outlet.js
(function () {
  // YAHAN backend/.env se DEFAULT_OUTLET_ID paste karo
  const DEFAULT_OUTLET_ID = '6a96509834dfb4052f1e0aa0';
  const DEFAULT_OUTLET_NAME =
    'Perfect Pizza – Singhpur Chauraha, Kalyanpur';

  const ID_KEY = 'pp_outlet_id';
  const NAME_KEY = 'pp_outlet_name';

  function ensureDefaultOutlet() {
    // Agar pehli baar user aa raha hai to default outlet set kar do
    if (!localStorage.getItem(ID_KEY)) {
      if (DEFAULT_OUTLET_ID && DEFAULT_OUTLET_ID !== '6a96509834dfb4052f1e0aa0') {
        localStorage.setItem(ID_KEY, DEFAULT_OUTLET_ID);
      }
      localStorage.setItem(NAME_KEY, DEFAULT_OUTLET_NAME);
    }
  }

  function getOutletName() {
    return (
      localStorage.getItem(NAME_KEY) || DEFAULT_OUTLET_NAME
    );
  }

  function applyOutletNameToPage() {
    const name = getOutletName();
    document
      .querySelectorAll('[data-outlet-name]')
      .forEach(el => {
        el.textContent = name;
      });
  }

  ensureDefaultOutlet();

  document.addEventListener('DOMContentLoaded', () => {
    applyOutletNameToPage();
  });

  // Optional helper global pe expose kar diya future use ke liye
  window.OutletUtil = {
    getCurrentOutletId: () => localStorage.getItem(ID_KEY),
    getCurrentOutletName: getOutletName
  };
})();