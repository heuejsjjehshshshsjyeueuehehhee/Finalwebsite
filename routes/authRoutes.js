const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../modules/dbAdapter');
const { forwardAuth } = require('../middleware/authMiddleware');

// 1. LOGIN PAGE
router.get('/login', forwardAuth, (req, res) => {
    res.render('login', { error: req.query.error, success: req.query.success });
});

// 2. SIGNUP PAGE
router.get('/signup', forwardAuth, (req, res) => {
    res.render('signup', { error: req.query.error });
});

// 3. PROCESS LOGIN
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = db.findOne('users', 'username', username);
    
    if (!user) return res.redirect('/auth/login?error=User not found');

    if (bcrypt.compareSync(password, user.password)) {
        req.session.user = user;
        // Redirect based on Role
        if (user.role === 'admin') {
            res.redirect('/admin/dashboard');
        } else {
            res.redirect('/'); // Normal user to Home
        }
    } else {
        res.redirect('/auth/login?error=Incorrect Password');
    }
});

// 4. PROCESS SIGNUP
router.post('/signup', (req, res) => {
    const { username, password } = req.body;
    const users = db.read('users');

    if (users.find(u => u.username === username)) {
        return res.redirect('/auth/signup?error=Username already taken');
    }

    const newUser = {
        id: Date.now(),
        username,
        password: bcrypt.hashSync(password, 10),
        role: 'user', // Default role is USER
        createdAt: new Date().toISOString()
    };

    db.push('users', newUser);
    res.redirect('/auth/login?success=Account created! Please login.');
});

// 5. LOGOUT
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/auth/login');
});

module.exports = router;