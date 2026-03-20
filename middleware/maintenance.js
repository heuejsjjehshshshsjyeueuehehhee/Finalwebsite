const checkMaintenance = (req, res, next) => {
    const site = res.locals.site; 
    
    if (!site || !site.maintenanceMode) {
        return next();
    }

    if (req.session && req.session.user && req.session.user.role === 'admin') {
        return next();
    }

    if (req.path.startsWith('/auth') || req.path.startsWith('/admin')) {
        return next();
    }

    res.status(503).send(`
        <body style="background:#111; color:white; display:flex; align-items:center; justify-content:center; height:100vh; font-family:sans-serif; text-align:center;">
            <div>
                <h1 style="color:${site.themeColor || '#3498db'}; font-size:3rem;">Maintenance Mode</h1>
                <p>We are currently upgrading the servers.</p>
                <p>Please check back later.</p>
            </div>
        </body>
    `);
};

module.exports = checkMaintenance;