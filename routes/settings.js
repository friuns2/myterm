const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');

const router = express.Router();

// Store settings locally under the project directory
const SETTINGS_DIR = path.join(__dirname, '..', 'settings');
const SETTINGS_FILE = path.join(SETTINGS_DIR, 'settings.zsh');
const RULES_FILE = path.join(SETTINGS_DIR, 'rules.txt');

// Read current local settings file
function readLocalSettings() {
    try {
        if (!fs.existsSync(SETTINGS_DIR)) {
            fs.mkdirSync(SETTINGS_DIR, { recursive: true });
        }
        if (fs.existsSync(SETTINGS_FILE)) {
            return fs.readFileSync(SETTINGS_FILE, 'utf8');
        }
    } catch (error) {
        console.error('Error reading local settings file:', error);
    }
    return '';
}

// Write local settings file with given text
function writeLocalSettings(aliasesText) {
    try {
        if (!fs.existsSync(SETTINGS_DIR)) {
            fs.mkdirSync(SETTINGS_DIR, { recursive: true });
        }
        fs.writeFileSync(SETTINGS_FILE, aliasesText || '');
        return true;
    } catch (error) {
        console.error('Error writing local settings file:', error);
        return false;
    }
}

// Read current global rules file
function readRules() {
    try {
        if (!fs.existsSync(SETTINGS_DIR)) {
            fs.mkdirSync(SETTINGS_DIR, { recursive: true });
        }
        if (fs.existsSync(RULES_FILE)) {
            return fs.readFileSync(RULES_FILE, 'utf8');
        }
    } catch (error) {
        console.error('Error reading rules file:', error);
    }
    return '';
}

// Write global rules file with given text
function writeRules(rulesText) {
    try {
        if (!fs.existsSync(SETTINGS_DIR)) {
            fs.mkdirSync(SETTINGS_DIR, { recursive: true });
        }
        fs.writeFileSync(RULES_FILE, rulesText || '');
        return true;
    } catch (error) {
        console.error('Error writing rules file:', error);
        return false;
    }
}

// Get all managed aliases as plain text
router.get('/', (req, res) => {
    try {
        const aliasesText = readLocalSettings();
        const rulesText = readRules();
        const exists = fs.existsSync(SETTINGS_FILE);
        const hasRules = fs.existsSync(RULES_FILE);
        res.json({
            text: aliasesText,
            // Keep legacy fields for the UI: point to local settings file
            zshrcPath: SETTINGS_FILE,
            hasZshrc: exists,
            // New explicit fields
            settingsPath: SETTINGS_FILE,
            hasSettings: exists,
            // Rules data
            rulesText,
            rulesPath: RULES_FILE,
            hasRules
        });
    } catch (error) {
        console.error('Error getting aliases:', error);
        res.status(500).json({ error: 'Failed to get aliases' });
    }
});

// Set/update settings from plain text
router.post('/', express.json(), (req, res) => {
    try {
        const { text } = req.body;
        
        if (typeof text !== 'string') {
            return res.status(400).json({ error: 'Invalid text format' });
        }
        
        if (writeLocalSettings(text)) {
            res.json({ success: true, message: 'Settings updated successfully' });
        } else {
            res.status(500).json({ error: 'Failed to save aliases' });
        }
    } catch (error) {
        console.error('Error setting aliases:', error);
        res.status(500).json({ error: 'Failed to set aliases' });
    }
});

// Clear all managed aliases
router.delete('/all', (req, res) => {
    try {
        if (writeLocalSettings('')) {
            res.json({ success: true, message: 'All aliases cleared successfully' });
        } else {
            res.status(500).json({ error: 'Failed to clear aliases' });
        }
    } catch (error) {
        console.error('Error clearing aliases:', error);
        res.status(500).json({ error: 'Failed to clear aliases' });
    }
});

// Set/update global rules from plain text
router.post('/rules', express.json(), (req, res) => {
    try {
        const { text } = req.body;
        if (typeof text !== 'string') {
            return res.status(400).json({ error: 'Invalid text format' });
        }
        if (writeRules(text)) {
            res.json({ success: true, message: 'Rules updated successfully', length: text.length });
        } else {
            res.status(500).json({ error: 'Failed to save rules' });
        }
    } catch (error) {
        console.error('Error setting rules:', error);
        res.status(500).json({ error: 'Failed to set rules' });
    }
});

// Clear rules
router.delete('/rules', (req, res) => {
    try {
        if (writeRules('')) {
            res.json({ success: true, message: 'Rules cleared successfully' });
        } else {
            res.status(500).json({ error: 'Failed to clear rules' });
        }
    } catch (error) {
        console.error('Error clearing rules:', error);
        res.status(500).json({ error: 'Failed to clear rules' });
    }
});

module.exports = router;