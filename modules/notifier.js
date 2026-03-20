const db = require('./dbAdapter');

const notifier = {
    alert: (title, message, type = 'info') => {
        const notif = {
            title,
            message,
            type,
            date: new Date().toLocaleString()
        };
        db.push('notifications', notif);
        console.log(`[NOTIF] ${title}: ${message}`);
    }
};

module.exports = notifier;