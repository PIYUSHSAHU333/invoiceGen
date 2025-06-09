const jwt = require('jsonwebtoken');
const User = require('../models/users.js');

console.log("--- AUTH MIDDLEWARE FILE LOADED ---"); // NEW LOG

const authMiddleware = async (req, res, next) => {
    console.log('AuthMiddleware: Function Entered!'); // This should hit IF the route applies this middleware
    console.log('AuthMiddleware: Full Authorization Header:', req.headers.authorization); 

    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            console.log('AuthMiddleware: Extracted Token for Verification:', token); 
            console.log('AuthMiddleware: JWT_SECRET used for verification:', process.env.JWT_SECRET); 

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            console.log('AuthMiddleware: Token decoded payload:', decoded); 

            req.user = await User.findById(decoded.id).select('-password');

            if (!req.user) {
                console.log('AuthMiddleware: User not found for ID:', decoded.id);
                return res.status(401).json({ message: 'Not authorized, user not found' });
            }

            console.log('AuthMiddleware: User authenticated:', req.user.email);
            next();
        } catch (error) {
            console.error('AuthMiddleware: Token verification error:', error);
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ message: 'Not authorized, token expired' });
            }
            return res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        console.log('AuthMiddleware: No token found in Authorization header. Sending 401.');
        return res.status(401).json({ message: 'Not authorized, no token' });
    }
};

module.exports = authMiddleware; 