const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');

const router = express.Router();

// Define the path for the aliases file
const ALIASES_FILE_PATH = path.join(os.homedir(), '.crush', 'aliases.json');

// Ensure the .crush directory exists
function ensureCrushDir() {
    const crushDir = path.dirname(ALIASES_FILE_PATH);
    if (!fs.existsSync(crushDir)) {
        fs.mkdirSync(crushDir, { recursive: true });
    }
}

// Load aliases from file
function loadAliases() {
    try {
        if (fs.existsSync(ALIASES_FILE_PATH)) {
            const data = fs.readFileSync(ALIASES_FILE_PATH, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading aliases:', error);
    }
    
    // Return default aliases if file doesn't exist or has errors
    return {
        'qwen': 'qwen --yolo',
        'gemini': 'gemini --yolo'
    };
}

// Save aliases to file
function saveAliases(aliases) {
    try {
        ensureCrushDir();
        fs.writeFileSync(ALIASES_FILE_PATH, JSON.stringify(aliases, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving aliases:', error);
        return false;
    }
}

// GET /api/aliases - Get all aliases
router.get('/', (req, res) => {
    try {
        const aliases = loadAliases();
        res.json({ success: true, aliases });
    } catch (error) {
        console.error('Error getting aliases:', error);
        res.status(500).json({ success: false, error: 'Failed to load aliases' });
    }
});

// POST /api/aliases - Save aliases
router.post('/', express.json(), (req, res) => {
    try {
        const { aliases } = req.body;
        
        if (!aliases || typeof aliases !== 'object') {
            return res.status(400).json({ success: false, error: 'Invalid aliases data' });
        }
        
        const success = saveAliases(aliases);
        
        if (success) {
            res.json({ success: true, message: 'Aliases saved successfully' });
        } else {
            res.status(500).json({ success: false, error: 'Failed to save aliases' });
        }
    } catch (error) {
        console.error('Error saving aliases:', error);
        res.status(500).json({ success: false, error: 'Failed to save aliases' });
    }
});

module.exports = {
    router,
    loadAliases,
    saveAliases
};