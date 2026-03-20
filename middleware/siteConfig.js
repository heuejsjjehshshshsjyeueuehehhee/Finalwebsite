const fs = require('fs');
const path = require('path');

const SETTINGS_PATH = path.join(__dirname, '../data/site_settings.json');

const siteConfig = (req, res, next) => {
    try {
        if (fs.existsSync(SETTINGS_PATH)) {
            // Read file FRESH every time
            const data = fs.readFileSync(SETTINGS_PATH, 'utf8');
            const settings = JSON.parse(data);
            
            res.locals.site = {
                siteName: settings.siteName || "WeebDuniya", // FIXED
                themeColor: settings.themeColor || "#ffb43a",
                
                // LOGO LOGIC FIX
                logoNavbar: settings.logoNavbar || null, // Wide Logo
                logoNormal: settings.logoNormal || null, // Square Logo
                logoUrl: settings.logoUrl || null,       // Old fallback
                
                maintenanceMode: settings.maintenanceMode === true,
                announcement: settings.announcement || "",
                footerText: settings.footerText || "© 2026 WeebDuniya",
                headerCode: settings.headerCode || ""
            };
        } else {
            // DEFAULT FALLBACK (Agar DB fail ho jaye)
            res.locals.site = { 
                siteName: "WeebDuniya", // FIXED: Pehle yahan AnimeVerse tha
                themeColor: "#ffb43a",
                maintenanceMode: false 
            };
        }
    } catch (err) {
        console.error("⚠️ Error loading settings:", err.message);
        res.locals.site = { siteName: "WeebDuniya", themeColor: "#ffb43a" };
    }
    next();
};

module.exports = siteConfig;