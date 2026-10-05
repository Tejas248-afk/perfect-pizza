// src/services/activityService.js
const ActivityLog = require('../models/ActivityLog');

async function logActivity({
  reqUser,     // req.user object (logged in user)
  action,
  entityType,
  entityId,
  entityName,
  before,
  after,
  meta,
}) {
  try {
    if (!reqUser || !reqUser._id) return;

    await ActivityLog.create({
      user: reqUser._id,
      userName: reqUser.name || reqUser.contact || reqUser.email || 'User',
      userRole: reqUser.role || 'USER',
      action,
      entityType,
      entityId: entityId ? String(entityId) : '',
      entityName: entityName || '',
      before,
      after,
      meta,
    });
  } catch (err) {
    // Activity log fail ho jaye to bhi main flow nahi tootna chahiye
    console.error('Activity log failed:', err.message || err);
  }
}

module.exports = { logActivity };