const User = require('../models/User');

exports.requireAdminPassword = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (user.adminPassword) {
      if (!req.session.adminAuthenticated) {
        // Redirect to a password prompt page
        return res.redirect('/pos/admin/admin-login');
      }
    } else {
      return res.redirect('/pos/admin/dashboard');
    }
  } catch (error) {
    console.error("Error in requireAdminPassword middleware: ", error);
    return res.status(500).send("Internal server error");
  }
  next();
};