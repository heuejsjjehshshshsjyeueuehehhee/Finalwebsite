const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');

const db = require('../modules/dbAdapter');
const metaScraper = require('../modules/metaScraper'); // Consumet + Proxy Logic
const autoTracker = require('../modules/autoTracker'); // Base64 Logic
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

// --- FILE UPLOAD (Logo) ---
const storage = multer.diskStorage({
    destination: './public/uploads/',
    filename: (req, file, cb) => {
        cb(null, 'logo_' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Protect all routes
router.use(requireAuth, requireAdmin);

// 1. DASHBOARD
router.get('/dashboard', (req, res) => {
    const library = db.read('anime_library');
    const queue = db.read('tracker_queue');
    const notifs = db.read('notifications').reverse();

    res.render('admin/dashboard', {
        stats: {
            totalAnime: library.length,
            tracking: queue.length,
            completed: queue.filter(q => q.completed).length
        },
        notifications: notifs
    });
});

// 2. ADD ANIME PAGE
router.get('/add-anime', (req, res) => {
    res.render('admin/add_anime');
});

// 3. PROCESS ADD ANIME (Main Logic)
router.post('/add-anime', async (req, res) => {
    const { url, season, episode, targetEpisode } = req.body;
    const seasonNum = parseInt(season);
    
    try {
        // Step A: Fetch Metadata (Using your metaScraper.js logic)
        const meta = await metaScraper.fetchDetails(url);
        
        let library = db.read('anime_library');
        let queue = db.read('tracker_queue');
        
        // Step B: Update Library (Merge Logic)
        let existingAnime = library.find(a => a.slug === meta.slug);
        let animeId;

        if (existingAnime) {
            console.log(`ℹ️ Updating Anime: ${meta.title}`);
            animeId = existingAnime.id;
            
            // Check Season
            let seasonExists = existingAnime.seasons.find(s => s.season === seasonNum);
            if (!seasonExists) {
                existingAnime.seasons.push({ season: seasonNum, episodes: [] });
            }
            db.write('anime_library', library);
        } else {
            console.log(`✨ Creating New Anime: ${meta.title}`);
            animeId = Date.now();
            const newAnime = {
                id: animeId,
                ...meta,
                seasons: [{ season: seasonNum, episodes: [] }]
            };
            db.push('anime_library', newAnime);
        }

        // Step C: Update Tracker Queue
        let alreadyTracking = queue.find(q => q.slug === meta.slug && q.season === seasonNum);
        
        if (alreadyTracking) {
            // Update settings
            alreadyTracking.lastEpisode = parseInt(episode) - 1;
            alreadyTracking.targetEpisode = targetEpisode ? parseInt(targetEpisode) : null;
            alreadyTracking.completed = false; // Restart tracking
            db.write('tracker_queue', queue);
        } else {
            // Create New Task
            const newTrack = {
                id: Date.now() + 1,
                libraryId: animeId,
                title: meta.title,
                slug: meta.slug,
                season: seasonNum,
                lastEpisode: parseInt(episode) - 1,
                targetEpisode: targetEpisode ? parseInt(targetEpisode) : null,
                totalEpisodes: meta.totalEpisodes,
                url: url,
                completed: false
            };
            db.push('tracker_queue', newTrack);
        }

        // Trigger Scan Immediately
        autoTracker.checkAll();

        res.redirect('/admin/dashboard?msg=Anime Added & Scanning Started');

    } catch (error) {
        console.error(error);
        res.redirect('/admin/add-anime?error=Failed to fetch details');
    }
});

// 4. SETTINGS
router.get('/settings', (req, res) => {
    res.render('admin/settings');
});

router.post('/settings', upload.single('logo'), (req, res) => {
    const { siteName, themeColor, maintenanceMode } = req.body;
    let newSettings = {
        ...db.read('site_settings'),
        siteName,
        themeColor,
        maintenanceMode: maintenanceMode === 'on'
    };

    if (req.file) {
        newSettings.logoUrl = '/uploads/' + req.file.filename;
    }

    // Direct write for settings
    const fs = require('fs');
    fs.writeFileSync(path.join(__dirname, '../data/site_settings.json'), JSON.stringify(newSettings, null, 4));

    res.redirect('/admin/settings?msg=Settings Saved');
});

// 5. FORCE RUN TRACKER
router.post('/run-tracker', async (req, res) => {
    await autoTracker.checkAll();
    res.redirect('/admin/dashboard?msg=Tracker Cycle Finished');
});

module.exports = router;