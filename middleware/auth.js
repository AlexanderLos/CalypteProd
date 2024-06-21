const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
  const token = req.header('Authorization').replace('Bearer ', '');

  if (!token) return res.status(401).send('Access Denied. No token provided.');

  try {
    const verified = jwt.verify(token, 'secret');
    req.user = verified;
    next();
  } catch (error) {
    res.status(400).send('Invalid token');
  }
}

module.exports = { verifyToken };
