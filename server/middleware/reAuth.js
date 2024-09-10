const User = require('../models/User');

exports.reAuth = async (req, res, next) => {
  const now = Date.now();
  const timeLimit = 1 * 60 * 1000; // 1 minute in milliseconds

 // Check for last activity
 if (req.session.lastActivity && now - req.session.lastActivity > timeLimit) {
  try {
    // Find the user (assuming there's only one admin user)
    const user = await User.findOne();

    // If adminPassword is set, log them out and redirect to admin login
    if (user && user.adminPassword) {
      req.session.adminAuthenticated = false;
      return res.redirect('/pos/admin/admin-login');
    } else {
      // If no password, allow access to other routes
      return next();
    }
  } catch (error) {
    console.error("Error in reAuth middleware: ", error);
    return res.status(500).send("Internal server error");
  }
}

// Update the last activity time
req.session.lastActivity = now;
next();
}