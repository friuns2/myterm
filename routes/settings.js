const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');

const router = express.Router();

// Store settings locally under the project directory
const SETTINGS_DIR = path.join(__dirname, '..', 'settings');
const RULES_FILE = path.join(SETTINGS_DIR, 'rules.txt');

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

// Get rules info
router.get('/', (req, res) => {
    try {
        const rulesText = readRules();
        const hasRules = fs.existsSync(RULES_FILE);
        res.json({
            rulesText,
            rulesPath: RULES_FILE,
            hasRules
        });
    } catch (error) {
        console.error('Error getting rules:', error);
        res.status(500).json({ error: 'Failed to get rules' });
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