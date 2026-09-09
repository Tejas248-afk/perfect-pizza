// Simple global socket helper
window.AppSocket = (function () {
  let socket = null;
  let connected = false;
  const SOCKET_URL = 'https://perfect-pizza-pa9n.onrender.com';

  function ensureConnected() {
    if (socket && connected) return socket;

    if (!window.io) {
      console.error('Socket.IO client library (io) not loaded');
      return null;
    }

    socket = window.io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    socket.on('connect', () => {
      connected = true;
      console.log('[Socket] connected', socket.id);
      registerCurrentUser();
    });

    socket.on('disconnect', reason => {
      connected = false;
      console.log('[Socket] disconnected', reason);
    });

    socket.on('connect_error', err => {
      console.error('[Socket] connect_error', err.message);
    });

    return socket;
  }

  function registerCurrentUser() {
    if (!socket || !connected) return;
    const user = Api.getStoredUser && Api.getStoredUser();
    if (!user || !user.id) {
      console.log('[Socket] No logged-in user, skip registerUser');
      return;
    }
    console.log('[Socket] registerUser', { id: user.id, role: user.role });
    socket.emit('registerUser', {
      userId: user.id,
      role: user.role
    });
  }

  function onNewOrderForKitchen(handler) {
    const s = ensureConnected();
    if (!s) return;
    // pehle purane listeners hata do
    if (typeof s.off === 'function') {
      s.off('newOrder');
    }
    s.on('newOrder', data => {
      console.log('[Socket] newOrder event:', data);
      if (handler) handler(data);
    });
    registerCurrentUser();
  }

  function onOrderStatusUpdated(handler) {
    const s = ensureConnected();
    if (!s) return;
    if (typeof s.off === 'function') {
      s.off('orderStatusUpdated');
    }
    s.on('orderStatusUpdated', data => {
      console.log('[Socket] orderStatusUpdated event:', data);
      if (handler) handler(data);
    });
    registerCurrentUser();
  }

  return {
    ensureConnected,
    registerCurrentUser,
    onNewOrderForKitchen,
    onOrderStatusUpdated
  };
})();