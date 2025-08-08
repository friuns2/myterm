const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');

const router = express.Router();

const SETTINGS_DIR = path.join(os.homedir(), '.myshell24');
const SETTINGS_PATH = path.join(SETTINGS_DIR, 'settings.conf');

function ensureSettingsDir() {
    if (!fs.existsSync(SETTINGS_DIR)) {
        fs.mkdirSync(SETTINGS_DIR, { recursive: true });
    }
}

function readSettingsFile() {
    try {
        if (fs.existsSync(SETTINGS_PATH)) {
            return fs.readFileSync(SETTINGS_PATH, 'utf8');
        }
    } catch (error) {
        console.error('Error reading settings file:', error);
    }
    return '';
}

router.get('/', (_req, res) => {
    try {
        const text = readSettingsFile();
        res.json({ text, settingsPath: SETTINGS_PATH, hasFile: fs.existsSync(SETTINGS_PATH) });
    } catch (error) {
        console.error('Error getting settings:', error);
        res.status(500).json({ error: 'Failed to get settings' });
    }
});

router.post('/', express.json(), (req, res) => {
    try {
        const { text } = req.body;
        if (typeof text !== 'string') {
            return res.status(400).json({ error: 'Invalid text format' });
        }
        ensureSettingsDir();
        fs.writeFileSync(SETTINGS_PATH, text);
        res.json({ success: true, message: 'Settings saved', bytes: Buffer.byteLength(text, 'utf8') });
    } catch (error) {
        console.error('Error saving settings:', error);
        res.status(500).json({ error: 'Failed to save settings' });
    }
});

module.exports = router;


