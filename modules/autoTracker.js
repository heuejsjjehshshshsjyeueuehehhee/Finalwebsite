const db = require('./dbAdapter');
const videoExtractor = require('./videoExtractor');

const CHECK_INTERVAL = 10 * 60 * 1000; // 10 Minutes

async function checkNewEpisodes() {
    console.log(`\n==================================================`);
    console.log(`🔄 [TRACKER] Checking for New Episodes...`);
    
    let library = db.read('anime_library') || [];
    let updatesFound = false;

    for (let anime of library) {
        let slug = anime.slug;
        let preferredLangs = anime.languages || ['Hindi'];

        // 🟢 MOVIE
        if (anime.type === 'Movie') {
            if (!anime.seasons[0] || !anime.seasons[0].episodes.length) {
                console.log(`🎬 Checking Movie: ${anime.title}`);
                let link = await videoExtractor.extractLink(`https://watchanimeworld.net/movies/${slug}/`, preferredLangs);
                if (link) {
                    if (!anime.seasons) anime.seasons = [{season:1, episodes:[]}];
                    anime.seasons[0].episodes.push({
                        episode: 1, title: "Full Movie", url: link, streams: link,
                        releaseDate: new Date().toISOString().split('T')[0]
                    });
                    updatesFound = true;
                    console.log(`   ✨ Movie Found!`);
                }
            }
            continue;
        }

        // 🔵 SERIES
        for (let seasonObj of anime.seasons) {
            let sNum = seasonObj.season;
            let target = seasonObj.targetEpisode || 9999;
            
            // ✅ FORCE START LOGIC
            let startEp = parseInt(seasonObj.startEpisode || 1);
            
            // Last added episode nikalo
            let lastAdded = 0;
            if (seasonObj.episodes.length > 0) {
                lastAdded = parseInt(seasonObj.episodes[seasonObj.episodes.length-1].episode);
            }

            // Next check karne wala episode
            let nextEp = Math.max(lastAdded + 1, startEp);

            if (nextEp > target) continue;

            let keepChecking = true;
            while (keepChecking) {
                if (nextEp > target) break;

                console.log(`   🔎 Checking ${anime.title} S${sNum}-EP${nextEp} (Langs: ${preferredLangs.join(',')})`);
                
                let checkUrl = `https://watchanimeworld.net/episode/${slug}-${sNum}x${nextEp}/`;
                let links = await videoExtractor.extractLink(checkUrl, preferredLangs);

                if (links) {
                    console.log(`      ✅ Found! Adding Episode ${nextEp}`);
                    seasonObj.episodes.push({
                        episode: nextEp, title: `Episode ${nextEp}`,
                        url: links, streams: links,
                        releaseDate: new Date().toISOString().split('T')[0]
                    });
                    updatesFound = true;
                    nextEp++;
                } else {
                    console.log(`      ❌ Not available yet.`);
                    keepChecking = false;
                }
                
                if(keepChecking) await new Promise(r => setTimeout(r, 2000));
            }
        }
    }

    if (updatesFound) {
        db.write('anime_library', library);
        console.log("💾 Database Updated.");
    }
}

function start() { checkNewEpisodes(); setInterval(checkNewEpisodes, CHECK_INTERVAL); }
module.exports = { start, checkNewEpisodes };