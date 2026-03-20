const base = require('./extractors/base');

// --- LOAD ALL EXTRACTORS ---
const hindiExtractor = require('./extractors/hindi');
const tamilExtractor = require('./extractors/tamil');
const teluguExtractor = require('./extractors/telugu');
const englishExtractor = require('./extractors/english');
const japaneseExtractor = require('./extractors/japanese');
const malayalamExtractor = require('./extractors/malayalam');
const kannadaExtractor = require('./extractors/kannada');
const bengaliExtractor = require('./extractors/bengali');
const marathiExtractor = require('./extractors/marathi');

const videoExtractor = {
    extractLink: async (episodeUrl, preferredLanguages = ['Hindi']) => {
        console.log(`\n   🎬 Processing: ${episodeUrl}`);
        
        let streams = {}; 

        // Loop through user preferences
        for (let lang of preferredLanguages) {
            let langData = null;
            let cleanLang = lang.trim().toLowerCase();

            // Match language to extractor
            switch (cleanLang) {
                case 'hindi': langData = await hindiExtractor.extract(episodeUrl); break;
                case 'tamil': langData = await tamilExtractor.extract(episodeUrl); break;
                case 'telugu': langData = await teluguExtractor.extract(episodeUrl); break;
                case 'malayalam': langData = await malayalamExtractor.extract(episodeUrl); break;
                case 'kannada': langData = await kannadaExtractor.extract(episodeUrl); break;
                case 'bengali': langData = await bengaliExtractor.extract(episodeUrl); break;
                case 'marathi': langData = await marathiExtractor.extract(episodeUrl); break;
                case 'english': langData = await englishExtractor.extract(episodeUrl); break;
                case 'japanese': langData = await japaneseExtractor.extract(episodeUrl); break;
                
                // Fallback: Default Base Search
                default: langData = await base.findByLanguage(episodeUrl, lang); break;
            }

            if (langData && (langData.masterUrl || langData.embedUrl)) {
                console.log(`      ✅ Found Stream: ${lang}`);
                streams[lang] = langData.masterUrl || langData.embedUrl;
            }
        }

        if (Object.keys(streams).length > 0) {
            return streams;
        } else {
            console.log(`   ❌ No Streams Found.`);
            return null;
        }
    }
};

module.exports = videoExtractor;