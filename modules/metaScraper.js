const axios = require('axios');
const cheerio = require('cheerio');
const { HttpsProxyAgent } = require('https-proxy-agent');

// --- PROXY SETTINGS ---
const PROXY_HOST = "dc.oxylabs.io";
const PROXY_PORT = 8001;
const PROXY_USER = "Piro5975_mBBc7";
const PROXY_PASS = "wiF8~e_UZI5Mcje8";

const agent = new HttpsProxyAgent(`http://${PROXY_USER}:${PROXY_PASS}@${PROXY_HOST}:${PROXY_PORT}`);

// --- ANILIST API ---
const CONSUMET_API = "https://testj-seven.vercel.app/meta/anilist";

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Referer': 'https://animesalt.top/' // ✅ Updated for AnimeSalt
};

// --- HELPER: Safe Request (Handles 407 Error) ---
async function safeGet(url) {
    try {
        // 1. Try Proxy
        return await axios.get(url, { 
            httpsAgent: agent, 
            headers: HEADERS, 
            timeout: 10000 
        });
    } catch (e) {
        // 2. If Proxy Fails (407 or Timeout), Switch to Direct
        if (e.response && e.response.status === 407) {
            console.log("⚠️ Scraper Proxy Auth Failed. Switching to Direct...");
        } else {
            console.log(`⚠️ Scraper Proxy Error (${e.message}). Switching to Direct...`);
        }
        
        // Fallback Direct
        try {
            return await axios.get(url, { 
                headers: HEADERS, 
                timeout: 10000 
            });
        } catch (directError) {
            console.error("❌ Direct Scrape Failed:", directError.message);
            throw directError;
        }
    }
}

// --- HELPER: Title Case ---
function toTitleCase(str) {
    if (!str) return "";
    return str.replace(
        /\w\S*/g,
        function(txt) {
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        }
    );
}

async function fetchDetails(seriesUrl) {
    let data = {
        title: "",
        description: "",
        thumbnail: "",
        genres: [],
        slug: "",
        type: "TV",
        totalEpisodes: 0,
        isMovie: false 
    };

    try {
        // 1. Slug Extraction
        const urlObj = new URL(seriesUrl);
        const parts = urlObj.pathname.split('/').filter(p => p.length > 0);
        data.slug = parts[parts.length - 1];

        // 2. SCRAPE WEBSITE (Using SafeGet)
        console.log(`📄 Fetching Meta: ${seriesUrl}`);
        const pageResp = await safeGet(seriesUrl);
        
        const $ = cheerio.load(pageResp.data);
        
        // A. Title Extraction (AnimeSalt Specific)
        let rawTitle = $('h1.entry-title').text().trim() || $('h1').first().text().trim();
        // Remove "Anime" word if present at the end
        data.title = toTitleCase(rawTitle.replace(/Anime$/, '').trim());

        // B. Genres Extraction
        $('.genres a, .genxed a, a[rel="category tag"]').each((i, el) => {
            data.genres.push($(el).text().trim());
        });

        // C. Description & Image (Site Fallback)
        data.description = $('.entry-content p').first().text().trim() || $('.description').text().trim();
        data.thumbnail = $('.thumb img').attr('src') || $('.poster img').attr('src') || $('meta[property="og:image"]').attr('content');

        // 🟢 D. MOVIE DETECTION LOGIC
        const urlLower = seriesUrl.toLowerCase();
        const titleLower = data.title.toLowerCase();
        
        if (urlLower.includes('movie') || titleLower.includes('movie')) {
            data.type = 'Movie';
            data.isMovie = true;
            data.totalEpisodes = 1;
        } else {
            // Count episodes in list (AnimeSalt uses .episodes or .listing)
            const epList = $('.episodes li, .listing li, #episode_related li');
            if (epList.length > 0) {
                data.totalEpisodes = epList.length;
            } else {
                data.totalEpisodes = 1; // Fallback
            }
        }
        
        console.log(`✅ Scraped: ${data.title} [${data.type}] - ${data.totalEpisodes} Eps`);

        // 3. FETCH ANILIST DATA (HQ Image & Desc)
        const searchQuery = data.slug.replace(/-/g, ' ');
        // console.log(`📡 Fetching Anilist Data for: "${searchQuery}"`);

        try {
            const apiResp = await axios.get(`${CONSUMET_API}/${encodeURIComponent(searchQuery)}`);
            
            if (apiResp.data.results && apiResp.data.results.length > 0) {
                const anime = apiResp.data.results[0];
                
                // Update Image
                if (anime.image) data.thumbnail = anime.image;
                
                // Update Description
                if (anime.description) {
                    data.description = anime.description.replace(/<[^>]*>?/gm, ''); 
                }
                
                console.log("✅ Metadata synced with Anilist");
            }
        } catch (apiErr) {
            console.log("⚠️ Anilist API Error (Using website fallback):", apiErr.message);
        }

    } catch (error) {
        console.error("❌ MetaScraper Error:", error.message);
        // Error Fallback
        data.title = data.title || "Unknown Anime";
        data.description = "No description available.";
        data.thumbnail = "/images/no-cover.jpg";
        data.isMovie = true; // Safety default
    }

    return data;
}

module.exports = { fetchDetails };