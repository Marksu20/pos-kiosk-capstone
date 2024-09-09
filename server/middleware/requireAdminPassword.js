const User = require('../models/User');

exports.requireAdminPassword = async (req, res, next) => {
  const user = await User.findById(req.user.id);

  if (user.adminPassword) {
    if (!req.session.adminAuthenticated) {
      // Redirect to a password prompt page
      return res.redirect('/pos/admin/admin-login');
    }
  }

  next();
};