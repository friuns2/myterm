const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');

const router = express.Router();
const SETTINGS_PATH = path.join(os.homedir(), '.myshell-settings');

function readSettings() {
    try {
        if (fs.existsSync(SETTINGS_PATH)) {
            return fs.readFileSync(SETTINGS_PATH, 'utf8');
        }
    } catch (e) {
        console.error('Error reading settings:', e);
    }
    return '';
}

router.get('/', (_req, res) => {
    try {
        const text = readSettings();
        res.json({ text, path: SETTINGS_PATH, exists: fs.existsSync(SETTINGS_PATH) });
    } catch (e) {
        res.status(500).json({ error: 'Failed to read settings' });
    }
});

router.post('/', express.json(), (req, res) => {
    try {
        const { text } = req.body || {};
        if (typeof text !== 'string') {
            return res.status(400).json({ error: 'Invalid text format' });
        }
        fs.writeFileSync(SETTINGS_PATH, text, 'utf8');
        res.json({ success: true, size: Buffer.byteLength(text, 'utf8') });
    } catch (e) {
        console.error('Error writing settings:', e);
        res.status(500).json({ error: 'Failed to save settings' });
    }
});

module.exports = router;


