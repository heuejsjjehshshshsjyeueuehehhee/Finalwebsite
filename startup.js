/**
 * AnimeVerse-Pro: Startup Script
 * Final Production Version (Crash Fixed & Port 80 Enabled)
 */

const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const flash = require('connect-flash');
const config = require('./config.json');

// --- APP SETUP ---
const app = express();
// 👇 PORT ko 80 par fix kar diya hai
const PORT = 19101; 

// --- DIRECTORY SETUP ---
const DATA_DIR = path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOADS_DIR = path.join(__dirname, 'public/uploads');

function initializeSystem() {
    console.log("⚙️  Initializing AnimeVerse-Pro System...");

    // 1. Create Directories
    [DATA_DIR, PUBLIC_DIR, UPLOADS_DIR].forEach(dir => {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });

    // 2. Define Default Database Files
    const dbFiles = {
        'users.json': [], 
        'anime_library.json': [],
        'tracker_queue.json': [],
        'notifications.json': [],
        'site_settings.json': {
            siteName: "WeebDuniya",
            themeColor: "#ffb43a",
            logoUrl: null,
            maintenanceMode: false
        }
    };

    // 3. Create Files if Missing
    for (const [filename, defaultData] of Object.entries(dbFiles)) {
        const filePath = path.join(DATA_DIR, filename);
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 4));
        }
    }

    // --- FIX: Robust Admin Creation Logic ---
    const usersPath = path.join(DATA_DIR, 'users.json');
    let users = [];
    
    try {
        const fileData = fs.readFileSync(usersPath, 'utf8');
        users = JSON.parse(fileData || '[]');
        
        if (!Array.isArray(users)) {
            console.warn("⚠️ Warning: users.json was invalid (Object). Resetting to Array [].");
            users = [];
        }
    } catch (err) {
        console.error("❌ Error reading users.json. Resetting db.");
        users = [];
    }

    const adminConfig = config.initialAdmin || { username: 'admin', password: 'password' }; // Fallback added
    const adminExists = users.find(u => u.username === adminConfig.username);

    if (!adminExists) {
        const hashedPassword = bcrypt.hashSync(adminConfig.password, 10);
        users.push({
            id: Date.now(),
            username: adminConfig.username,
            password: hashedPassword,
            role: 'admin',
            createdAt: new Date().toISOString()
        });
        
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 4));
        console.log(`   [AUTH] ✅ Admin Created: ${adminConfig.username}`);
    } else {
        console.log(`   [AUTH] 👌 Admin account '${adminConfig.username}' verified.`);
    }
}

// Initialize immediately
initializeSystem();

// --- MIDDLEWARE ---
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

app.use(session({
    secret: config.server.secretKey || 'fallback_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 86400000 } // 24 Hours
}));

app.use(flash());

// Site Config Middleware (Make sure this file exists)
try {
    const siteConfig = require('./middleware/siteConfig');
    app.use(siteConfig);
} catch (e) {
    console.warn("⚠️ siteConfig middleware not found, skipping.");
}

// Global Variables
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error = req.flash('error');
    res.locals.user = req.session.user || null;
    next();
});

// --- ROUTES --- (Wrapped in try-catch in case files are missing)
try {
    app.use('/', require('./routes/indexRoutes'));
    app.use('/admin', require('./routes/adminRoutes'));
    app.use('/auth', require('./routes/authRoutes'));
} catch (e) {
    console.warn("⚠️ Some routes are missing, skipping router setup.");
}

// --- START AUTO-TRACKER ---
try {
    const autoTracker = require('./modules/autoTracker');
    if (autoTracker && typeof autoTracker.start === 'function') {
        autoTracker.start();
    } else {
        console.warn("⚠️ AutoTracker module not configured correctly.");
    }
} catch (e) {
    console.error("⚠️ Failed to start AutoTracker:", e.message);
}

// --- SERVER LAUNCH ---
app.listen(PORT, () => {
    console.log(`\n🚀 AnimeVerse-Pro is Live!`);
    console.log(`🌍 URL: http://localhost (Port 80)`);
    console.log(`🔑 Admin Login: http://localhost/auth/login`);
});