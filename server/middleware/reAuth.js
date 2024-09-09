exports.reAuth = (req, res, next) => {
  const now = Date.now();
  const timeLimit = 1 * 60 * 1000; // 1 minute in milliseconds

  if (req.session.lastActivity && now - req.session.lastActivity > timeLimit) {
    // Logout the user if they have been inactive for more than 1 minute
    req.session.adminAuthenticated = false;
    return res.redirect('/pos/admin/admin-login');
  }

  // Update the last activity time
  req.session.lastActivity = now;
  next();
}