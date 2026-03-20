const express = require('express');
const router = express.Router();
const db = require('../modules/dbAdapter');
const siteConfig = require('../middleware/siteConfig');

router.use(siteConfig);

// ==========================================
// 1. HOME PAGE
// ==========================================
router.get('/', (req, res) => {
    const library = db.read('anime_library') || [];
    
    // Convert IDs to String for safety
    const trendingIds = (db.read('trending') || []).map(String);
    const spotlightIds = (db.read('spotlight') || []).map(String);

    let trendingAnime = [];
    if (trendingIds.length > 0) {
        trendingAnime = trendingIds.map(id => library.find(a => String(a.id) === id)).filter(a => a);
    }

    let spotlightList = [];
    if (spotlightIds.length > 0) {
        spotlightList = spotlightIds.map(id => library.find(a => String(a.id) === id)).filter(a => a);
    }

    // Fill Spotlight if empty
    if (spotlightList.length < 5) {
        let needed = 5 - spotlightList.length;
        let fillers = trendingAnime.filter(t => !spotlightList.some(s => String(s.id) === String(t.id)));
        spotlightList = [...spotlightList, ...fillers.slice(0, needed)];
    }

    if (spotlightList.length < 5) {
        let needed = 5 - spotlightList.length;
        let latestFillers = [...library].reverse().filter(l => !spotlightList.some(s => String(s.id) === String(l.id)));
        spotlightList = [...spotlightList, ...latestFillers.slice(0, needed)];
    }

    const latestAnime = [...library].reverse().slice(0, 12);

    res.render('index', {
        title: 'Home',
        spotlightList, 
        trending: trendingAnime,
        animeList: latestAnime,
        sectionTitle: 'Latest Additions', 
        user: req.user || null
    });
});

// ==========================================
// 2. MOVIES PAGE
// ==========================================
router.get('/movies', (req, res) => {
    const library = db.read('anime_library') || [];
    const movies = library.filter(a => a.type && a.type.toLowerCase() === 'movie');
    res.render('catalog', { title: 'Movies', animeList: movies, user: req.user || null });
});

// ==========================================
// 3. SERIES PAGE
// ==========================================
router.get('/series', (req, res) => {
    const library = db.read('anime_library') || [];
    const series = library.filter(a => a.type && ['tv', 'ona', 'ova'].includes(a.type.toLowerCase()));
    res.render('catalog', { title: 'TV Series', animeList: series, user: req.user || null });
});

// ==========================================
// 4. ANIME DETAILS
// ==========================================
router.get('/anime/:slug', (req, res) => {
    const slug = req.params.slug;
    const library = db.read('anime_library') || [];
    const anime = library.find(a => a.slug === slug);
    
    // FIX: Crash Proof 404
    if (!anime) return res.status(404).send("<h1>404 - Anime Not Found</h1><a href='/'>Go Home</a>");
    
    res.render('details', { title: anime.title, anime, user: req.user || null });
});

// ==========================================
// 5. WATCH PAGE (Smart Handler)
// ==========================================
router.get('/watch/:slug', (req, res) => {
    const slug = req.params.slug;
    const library = db.read('anime_library') || [];
    const anime = library.find(a => a.slug === slug);

    if (!anime) return res.status(404).send("<h1>Anime not found</h1><a href='/'>Go Home</a>");

    // Default to Season 1 if not specified
    let seasonNum = req.query.season ? parseInt(req.query.season) : 1;
    let episodeNum = req.query.episode ? parseInt(req.query.episode) : 1;

    // Find Season Data
    let seasonData = anime.seasons.find(s => parseInt(s.season) === seasonNum);
    
    // Fallback: Agar season nahi mila, to pehla available season uthao
    if (!seasonData && anime.seasons.length > 0) {
        seasonData = anime.seasons[0];
        seasonNum = parseInt(seasonData.season);
    }

    if (!seasonData) return res.status(404).send("<h1>Season not found</h1><a href='/'>Go Home</a>");

    // Find Episode Data
    let currentEpisode = seasonData.episodes.find(e => parseInt(e.episode) === episodeNum);
    
    // Fallback: Agar episode nahi mila, to pehla episode uthao
    if (!currentEpisode && seasonData.episodes.length > 0) {
        currentEpisode = seasonData.episodes[0];
        episodeNum = parseInt(currentEpisode.episode);
    }

    if (!currentEpisode) return res.status(404).send("<h1>Episode not found</h1><a href='/'>Go Home</a>");

    // NEXT / PREV CALCULATIONS
    let nextEpisodeLink = null;
    let prevEpisodeLink = null;
    
    // Sirf Series ke liye calculate karo
    if (!anime.type || anime.type.toLowerCase() !== 'movie') {
        const currentIndex = seasonData.episodes.findIndex(e => parseInt(e.episode) === episodeNum);
        
        // Next Episode
        if (currentIndex !== -1 && currentIndex < seasonData.episodes.length - 1) {
            let nextEp = seasonData.episodes[currentIndex + 1];
            nextEpisodeLink = `/watch/${slug}?season=${seasonNum}&episode=${nextEp.episode}`;
        } else {
            // Check Next Season
            let nextSeason = anime.seasons.find(s => parseInt(s.season) === seasonNum + 1);
            if (nextSeason && nextSeason.episodes.length > 0) {
                let firstEp = nextSeason.episodes[0].episode || 1;
                nextEpisodeLink = `/watch/${slug}?season=${nextSeason.season}&episode=${firstEp}`;
            }
        }

        // Prev Episode
        if (currentIndex > 0) {
            let prevEp = seasonData.episodes[currentIndex - 1];
            prevEpisodeLink = `/watch/${slug}?season=${seasonNum}&episode=${prevEp.episode}`;
        }
    }

    res.render('watch', {
        title: `Watch ${anime.title}`,
        anime, 
        currentSeason: seasonNum, 
        currentEpisode, 
        nextEpisodeLink, // Pass null if movie
        prevEpisodeLink, // Pass null if movie
        user: req.user || null
    });
});

// ==========================================
// 6. SEARCH & API
// ==========================================
router.get('/search', (req, res) => {
    const query = req.query.q ? req.query.q.toLowerCase() : '';
    const library = db.read('anime_library') || [];
    let results = query ? library.filter(a => a.title.toLowerCase().includes(query)) : [];
    res.render('search', { title: `Search: ${query}`, results, searchQuery: query, user: req.user || null });
});

router.get('/api/search', (req, res) => {
    const query = req.query.q ? req.query.q.toLowerCase() : '';
    const library = db.read('anime_library') || [];
    let results = query.length > 1 ? library.filter(a => a.title.toLowerCase().includes(query)).slice(0, 5) : [];
    res.json(results);
});

module.exports = router;