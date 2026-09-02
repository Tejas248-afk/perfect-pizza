const User = require('../models/User');

const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Not authorized for this action' });
      }

      next();
    } catch (err) {
      console.error('roleMiddleware error:', err);
      return res
        .status(500)
        .json({ message: 'Authorization error, please try again later.' });
    }
  };
};

module.exports = authorizeRoles;