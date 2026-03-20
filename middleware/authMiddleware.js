const requireAuth = (req, res, next) => {
    if (req.session && req.session.user) {
        return next();
    } else {
        return res.redirect('/auth/login?error=Please login first');
    }
};

const forwardAuth = (req, res, next) => {
    if (req.session && req.session.user) {
        return res.redirect('/admin/dashboard');
    } else {
        return next();
    }
};

const requireAdmin = (req, res, next) => {
    if (req.session && req.session.user && req.session.user.role === 'admin') {
        return next();
    } else {
        return res.status(403).send("Access Denied: Admins Only");
    }
};

module.exports = { requireAuth, forwardAuth, requireAdmin };