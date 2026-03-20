/**
 * Database Adapter
 * Handles Safe JSON Reading & Writing
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');

const dbAdapter = {
    // Read JSON File
    read: (filename) => {
        try {
            if (!filename.endsWith('.json')) filename += '.json';
            const filePath = path.join(DATA_DIR, filename);
            
            if (!fs.existsSync(filePath)) {
                fs.writeFileSync(filePath, '[]'); // Create if missing
                return [];
            }
            const data = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(data || '[]');
        } catch (error) {
            console.error(`❌ DB Read Error (${filename}):`, error.message);
            return [];
        }
    },

    // Write JSON File
    write: (filename, data) => {
        try {
            if (!filename.endsWith('.json')) filename += '.json';
            const filePath = path.join(DATA_DIR, filename);
            fs.writeFileSync(filePath, JSON.stringify(data, null, 4));
            return true;
        } catch (error) {
            console.error(`❌ DB Write Error (${filename}):`, error.message);
            return false;
        }
    },

    // Add New Item to Array
    push: (filename, item) => {
        const data = dbAdapter.read(filename);
        data.push(item);
        dbAdapter.write(filename, data);
    },

    // Find One Item
    findOne: (filename, key, value) => {
        const data = dbAdapter.read(filename);
        return data.find(item => item[key] === value);
    }
};

module.exports = dbAdapter;