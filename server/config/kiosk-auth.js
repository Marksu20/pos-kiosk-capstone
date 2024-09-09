const jwt = require('jsonwebtoken');

function generateKioskLink(req, res) {
  const user = req.user;
  const token = jwt.sign({ id: user._id, email: user.emailAddress }, process.env.JWT_SECRET, { expiresIn: '1h' });

  const kioskLink = `http://localhost:5000/kiosk?token=${token}`;

  res.json({ link: kioskLink });
}