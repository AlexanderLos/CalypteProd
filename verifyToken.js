const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const token = req.headers['authorization'];
    console.log('Token:', token); // Add this line for logging
    if (!token) return res.status(403).send('Token is required');
    
    const tokenPart = token.split(' ')[1]; // Extract the token part
    jwt.verify(tokenPart, 'b9e9790c91b03230a299d1ec220a65522d884e497061184e401e083bd08635ed32026e9b3fb5d4a9f5b446b8669544d4e2edd375c98fcfc8f42af35de1728861', (err, decoded) => {
        if (err) {
            console.error('JWT Error:', err); // Add this line for logging errors
            return res.status(401).send('Invalid token');
        }
        console.log('Decoded Token:', decoded); // Add this line for logging decoded token
        req.userId = decoded.userId;
        next();
    });
};

module.exports = verifyToken;
