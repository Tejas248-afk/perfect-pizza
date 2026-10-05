// src/controllers/adminActivityController.js
const ActivityLog = require('../models/ActivityLog');

exports.listActivity = async (req, res, next) => {
  try {
    const { limit = 100, entityType, userId } = req.query;

    const query = {};
    if (entityType) query.entityType = entityType;
    if (userId) query.user = userId;

    const logs = await ActivityLog.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit) || 100)
      .lean();

    res.json(logs);
  } catch (err) {
    next(err);
  }
};