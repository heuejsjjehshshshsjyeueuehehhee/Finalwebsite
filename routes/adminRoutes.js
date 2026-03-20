const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

// ✅ MODULES IMPORT
const db = require('../modules/dbAdapter');
const metaScraper = require('../modules/metaScraper');
const autoTracker = require('../modules/autoTracker');
const videoExtractor = require('../modules/videoExtractor'); 
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

// ✅ MULTER (Logo Upload ke liye)
const storage = multer.diskStorage({
    destination: './public/uploads/',
    filename: (req, file, cb) => cb(null, 'logo_' + Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

// ✅ AUTH PROTECTION (Sabhi routes ke liye)
router.use(requireAuth, requireAdmin);

// ==========================================
// 1. DASHBOARD
// ==========================================
router.get('/dashboard', (req, res) => {
    try {
        const library = db.read('anime_library') || [];
        const logs = db.read('system_logs') || [];
        
        let totalEpisodes = 0;
        let activeTrackers = 0;

        library.forEach(a => {
            if (a.seasons) {
                a.seasons.forEach(s => {
                    if (s.episodes) totalEpisodes += s.episodes.length;
                    
                    let lastEp = s.episodes && s.episodes.length > 0 ? s.episodes[s.episodes.length - 1].episode : 0;
                    let targetEp = s.targetEpisode || 12;
                    if (lastEp < targetEp) {
                        activeTrackers++;
                    }
                });
            }
        });

        res.render('admin/dashboard', { 
            stats: { 
                totalAnime: library.length, 
                totalEpisodes: totalEpisodes, 
                activeTracking: activeTrackers 
            }, 
            logs: logs.slice(0, 15),
            notifications: [] 
        });
    } catch (e) {
        console.error(e);
        res.send("Dashboard Error: " + e.message);
    }
});

// ==========================================
// 2. RUN TRACKER (Manual Trigger)
// ==========================================
router.get('/run-tracker', async (req, res) => {
    try {
        await autoTracker.checkNewEpisodes();
        res.redirect('/admin/dashboard?msg=Tracker Cycle Completed');
    } catch (e) {
        res.redirect('/admin/dashboard?error=' + encodeURIComponent(e.message));
    }
});

// ==========================================
// 3. MANAGE ANIME (List & Delete)
// ==========================================
router.get('/manage-anime', (req, res) => {
    const library = db.read('anime_library') || [];
    res.render('admin/manage_anime', { library: library.reverse() });
});

router.post('/delete-anime', (req, res) => {
    try {
        const idToDelete = String(req.body.animeId);
        let library = db.read('anime_library') || [];
        
        const newLibrary = library.filter(a => String(a.id) !== idToDelete);
        db.write('anime_library', newLibrary);
        
        ['trending', 'spotlight'].forEach(file => {
            let list = db.read(file) || [];
            db.write(file, list.filter(id => String(id) !== idToDelete));
        });

        res.redirect('/admin/manage-anime?msg=Anime Deleted');
    } catch (e) {
        res.redirect('/admin/manage-anime?error=Delete Failed');
    }
});

// ==========================================
// 4. ADD ANIME (Fixed Logic)
// ==========================================
router.get('/add-anime', (req, res) => res.render('admin/add_anime'));

router.post('/add-anime', async (req, res) => {
    try {
        let { url, type } = req.body;

        // 🟢 1. Language Handling
        let languages = req.body.languages || ['Hindi'];
        if (!Array.isArray(languages)) {
            languages = [languages];
        }

        // 🟢 2. Season Handling
        let seasons = [].concat(req.body.season || []).map(Number);
        let startEps = [].concat(req.body.episode || []).map(Number);
        let targetEps = [].concat(req.body.targetEpisode || []).map(Number);

        // 🟢 3. Scrape Metadata
        const meta = await metaScraper.fetchDetails(url);
        if (!meta || !meta.title) throw new Error("Scraper failed to get details. Check URL.");

        let library = db.read('anime_library') || [];
        
        let existingAnime = library.find(a => a.slug === meta.slug);
        let animeId = existingAnime ? existingAnime.id : uuidv4();
        
        let animeEntry = existingAnime || { 
            id: animeId, 
            ...meta, 
            type: type || meta.type || 'TV', 
            languages: languages, 
            seasons: [] 
        };

        // Always update details
        animeEntry.languages = languages;
        if(meta.thumbnail) animeEntry.thumbnail = meta.thumbnail;
        if(meta.description) animeEntry.description = meta.description;

        if (!existingAnime) library.push(animeEntry);

        // 🟢 4. Process Seasons (CRITICAL FIX HERE)
        for (let i = 0; i < seasons.length; i++) {
            let sNum = seasons[i];
            let startEp = startEps[i] || 1; // Default to 1 if missing
            let targetEp = targetEps[i] || 12;

            // Find or Create Season Object
            let sObj = animeEntry.seasons.find(s => s.season === sNum);
            if (!sObj) {
                sObj = { 
                    season: sNum, 
                    episodes: [], 
                    targetEpisode: targetEp,
                    startEpisode: startEp // ✅ AB START EPISODE SAVE HOGA
                };
                animeEntry.seasons.push(sObj);
            } else {
                // Update existing season
                sObj.targetEpisode = targetEp;
                sObj.startEpisode = startEp; // ✅ EXISTING SEASON UPDATE
            }
            
            console.log(`Setup: ${animeEntry.title} S${sNum} -> Start: ${startEp}, Target: ${targetEp}`);
        }

        db.write('anime_library', library);
        
        // Trigger Tracker immediately to pick up changes
        autoTracker.checkNewEpisodes();

        res.redirect('/admin/dashboard?msg=Anime Added Successfully');

    } catch (e) {
        console.error("Add Anime Error:", e);
        res.redirect('/admin/add-anime?error=' + encodeURIComponent(e.message));
    }
});

// ==========================================
// 5. TRENDING & SPOTLIGHT
// ==========================================
router.get('/trending', (req, res) => {
    let library = db.read('anime_library') || [];
    const trendingIds = (db.read('trending') || []).map(String);
    const spotlightIds = (db.read('spotlight') || []).map(String);
    
    library.sort((a, b) => {
        let idA = String(a.id), idB = String(b.id);
        let sA = spotlightIds.indexOf(idA), sB = spotlightIds.indexOf(idB);
        let tA = trendingIds.indexOf(idA), tB = trendingIds.indexOf(idB);

        if (sA !== -1 && sB === -1) return -1;
        if (sA === -1 && sB !== -1) return 1;
        if (tA !== -1 && tB === -1) return -1;
        if (tA === -1 && tB !== -1) return 1;
        return 0; 
    });

    res.render('admin/manage_trending', { library, trendingIds, spotlightIds });
});

router.post('/trending', (req, res) => {
    try {
        const data = JSON.parse(req.body.payload);
        let newSpotlight = [], newTrending = [];

        data.forEach(item => {
            if (item.s > 0) newSpotlight.push({ id: String(item.id), rank: Number(item.s) });
            if (item.t > 0) newTrending.push({ id: String(item.id), rank: Number(item.t) });
        });

        newSpotlight.sort((a, b) => a.rank - b.rank);
        newTrending.sort((a, b) => a.rank - b.rank);

        db.write('spotlight', newSpotlight.map(x => x.id));
        db.write('trending', newTrending.map(x => x.id));
        res.redirect('/admin/trending?msg=Layout Saved');
    } catch (e) { res.redirect('/admin/trending?error=Error Saving'); }
});

// ==========================================
// 6. SETTINGS
// ==========================================
router.get('/settings', (req, res) => res.render('admin/settings'));

router.post('/settings', upload.single('logo'), (req, res) => {
    try {
        let settings = db.read('site_settings') || {};
        let newSettings = { ...settings, ...req.body, maintenanceMode: req.body.maintenanceMode === 'on' };
        
        if (req.file) {
            newSettings.logoUrl = '/uploads/' + req.file.filename;
        }
        
        fs.writeFileSync(path.join(__dirname, '../data/site_settings.json'), JSON.stringify(newSettings, null, 4));
        res.redirect('/admin/settings?msg=Settings Saved');
    } catch (e) { res.redirect('/admin/settings?error=Failed to save settings'); }
});

// ==========================================
// 7. SCRAPE HELPER
// ==========================================
router.post('/scrape', async (req, res) => {
    try {
        const { url } = req.body;
        const link = await videoExtractor.extractLink(url, ['Hindi', 'Tamil', 'English']);
        
        if (link) {
            res.json({ data: [{ title: "Source Found", url: link }] });
        } else {
            res.json({ data: [] });
        }
    } catch (e) { 
        res.json({ data: [], error: e.message }); 
    }
});

module.exports = router;