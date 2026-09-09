(function () {
  const API_BASE_URL = 'https://perfect-pizza-pa9n.onrender.com/api';

  const STORAGE_KEYS = {
    TOKEN: 'pp_token',
    USER: 'pp_user'
  };

  function getToken() {
    return localStorage.getItem(STORAGE_KEYS.TOKEN);
  }

  function getStoredUser() {
    const raw = localStorage.getItem(STORAGE_KEYS.USER);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function setAuth(token, user) {
    if (token) {
      localStorage.setItem(STORAGE_KEYS.TOKEN, token);
    }
    if (user) {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    }
  }

  function clearAuth() {
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
  }

  async function request(method, path, body, extraOptions) {
    const url = API_BASE_URL + path;

    const headers = extraOptions?.headers
      ? { ...extraOptions.headers }
      : {};

    if (!(body instanceof FormData)) {
      headers['Content-Type'] =
        headers['Content-Type'] || 'application/json';
    }

    const token = getToken();
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }

    const options = {
      method,
      headers,
      ...(extraOptions || {})
    };

    if (body) {
      options.body = body instanceof FormData ? body : JSON.stringify(body);
    }

    let res;
    try {
      res = await fetch(url, options);
    } catch (err) {
      throw {
        networkError: true,
        message: 'Server se connect nahi ho pa rahe, thodi der baad try karo.'
      };
    }

    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (!res.ok) {
      throw {
        status: res.status,
        message: data?.message || 'Request failed',
        data
      };
    }

    return data;
  }

  const Api = {
    get: (path, options) => request('GET', path, null, options),
    post: (path, body, options) => request('POST', path, body, options),
    put: (path, body, options) => request('PUT', path, body, options),
    patch: (path, body, options) => request('PATCH', path, body, options),
    delete: (path, options) => request('DELETE', path, null, options),
    getToken,
    getStoredUser,
    setAuth,
    clearAuth
  };

  window.Api = Api;
})();