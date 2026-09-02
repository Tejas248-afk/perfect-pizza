// src/sockets/socket.js
const { Server } = require('socket.io');

let io = null;

function initSocket(server) {
  io = new Server(server, {
    cors: {
      // Dev / project ke liye open rakho, taaki Live Server, file:// etc. sab chal jaye
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
    }
  });

  io.on('connection', socket => {
    console.log('[Socket] connected:', socket.id);

    // Frontend se user info aayega
    socket.on('registerUser', payload => {
      try {
        const { userId, role } = payload || {};
        if (!userId) return;

        socket.join(`user:${userId}`);

        if (role === 'KITCHEN' || role === 'ADMIN') {
          socket.join('kitchen');
        }
        if (role === 'ADMIN') {
          socket.join('admin');
        }

        console.log(
          `[Socket] user registered: ${userId}, role=${role}, rooms=${Array.from(
            socket.rooms
          ).join(',')}`
        );
      } catch (err) {
        console.error('registerUser error:', err);
      }
    });

    socket.on('disconnect', reason => {
      console.log('[Socket] disconnected:', socket.id, reason);
    });
  });
}

function emitNewOrder(order) {
  if (!io || !order) return;

  const payload = {
    _id: order._id,
    status: order.status,
    grandTotal: order.grandTotal,
    createdAt: order.createdAt,
    user: order.user,
    delivery: order.delivery
  };

  console.log('[Socket] emitNewOrder → kitchen/admin:', String(order._id));

  // Kitchen & admin ko new order
  io.to('kitchen').emit('newOrder', payload);
  io.to('admin').emit('newOrder', payload);

  // Customer ko bhi placed status bhej do
  io.to(`user:${order.user}`).emit('orderStatusUpdated', payload);
}

function emitOrderStatusUpdated(order) {
  if (!io || !order) return;

  const payload = {
    _id: order._id,
    status: order.status,
    grandTotal: order.grandTotal,
    updatedAt: order.updatedAt,
    delivery: order.delivery
  };

  console.log(
    '[Socket] emitOrderStatusUpdated → kitchen/admin/user:',
    String(order._id),
    'status:',
    order.status
  );

  io.to('kitchen').emit('orderStatusUpdated', payload);
  io.to('admin').emit('orderStatusUpdated', payload);
  io.to(`user:${order.user}`).emit('orderStatusUpdated', payload);
}

module.exports = {
  initSocket,
  emitNewOrder,
  emitOrderStatusUpdated
};