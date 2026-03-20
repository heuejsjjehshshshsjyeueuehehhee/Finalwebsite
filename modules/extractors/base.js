const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

// --- PROXY SETTINGS ---
const PROXY_HOST = "dc.oxylabs.io";
const PROXY_PORT = 8001;
const PROXY_USER = "Piro5975_mBBc7";
const PROXY_PASS = "EfU=7WR3tKiH5";

const agent = new HttpsProxyAgent(`http://${PROXY_USER}:${PROXY_PASS}@${PROXY_HOST}:${PROXY_PORT}`);
const TIMEOUT_MS = 8000;

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://watchanimeworld.net/',
    'Accept': '*/*'
};

// --- HELPER FUNCTIONS ---
async function safeGet(url) {
    try {
        const response = await axios.get(url, { 
            httpsAgent: agent, 
            headers: HEADERS, 
            timeout: TIMEOUT_MS,
            validateStatus: status => status < 400
        });
        return response;
    } catch (e) { return null; }
}

async function unshortenLink(url) {
    if (!url) return null;
    const resp = await safeGet(url);
    return resp ? (resp.request.res.responseUrl || url) : url;
}

async function extractM3U8(pageUrl) {
    const resp = await safeGet(pageUrl);
    if (!resp) return null;
    const html = resp.data;
    
    let match = html.match(/file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i) || 
                html.match(/source\s*=\s*["']([^"']+\.m3u8[^"']*)["']/i);
    return match ? match[1] : null;
}

// --- CORE EXTRACTION LOGIC (SMART MATCH) ---
async function findByLanguage(url, targetLang) {
    // console.log(`      🔎 Checking for language: ${targetLang}`);
    let resultData = { masterUrl: null, embedUrl: null };
    const resp = await safeGet(url);
    if (!resp) return null;
    const html = resp.data;

    const apiRegex = /(https?:\/\/[^\s"']+\?data=([a-zA-Z0-9+/=]+))/g;
    let match;

    while ((match = apiRegex.exec(html)) !== null) {
        try {
            const decoded = Buffer.from(match[2], 'base64').toString('utf-8');
            if (decoded.includes('link') || decoded.includes('short.icu')) {
                const parsed = JSON.parse(decoded);
                if (Array.isArray(parsed)) {
                    
                    // DEBUG: Print all available languages
                    const available = parsed.map(p => p.language);
                    console.log(`      👀 Website Languages: [${available.join(', ')}]`);

                    // SMART MATCH: 'Tamil' will match 'Tamil', 'Tamil Audio', 'tam'
                    const entry = parsed.find(x => 
                        x.language && 
                        x.language.toLowerCase().includes(targetLang.toLowerCase())
                    );
                    
                    if (entry) {
                        console.log(`      ✅ MATCHED: Requested '${targetLang}' -> Found '${entry.language}'`);
                        
                        if (entry.link) {
                            let shortLink = entry.link.replace(/\\\//g, '/');
                            const realUrl = await unshortenLink(shortLink);
                            resultData.embedUrl = realUrl;
                            const m3u8 = await extractM3U8(realUrl);
                            if (m3u8) resultData.masterUrl = m3u8;
                            return resultData; 
                        }
                    }
                }
            }
        } catch (e) {}
    }
    return null;
}

module.exports = { findByLanguage, safeGet, extractM3U8 };