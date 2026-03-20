const base = require('./base');

module.exports = {
    extract: async (url) => {
        return await base.findByLanguage(url, 'Malayalam');
    }
};