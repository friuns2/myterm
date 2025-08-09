const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');

const router = express.Router();

// Store settings locally under the project directory
const SETTINGS_DIR = path.join(__dirname, '..', 'settings');
const SETTINGS_FILE = path.join(SETTINGS_DIR, 'aliases.zsh');

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

// Update .zshrc with new aliases
function updateZshrcWithAliases(aliasesText) {
    try {
        let zshrcContent = readZshrc();
        const startIndex = zshrcContent.indexOf(ALIASES_SECTION_START);
        const endIndex = zshrcContent.indexOf(ALIASES_SECTION_END);
        
        const newAliasesSection = `${ALIASES_SECTION_START}\n${aliasesText}\n${ALIASES_SECTION_END}`;
        
        if (startIndex !== -1 && endIndex !== -1) {
            // Replace existing section
            zshrcContent = zshrcContent.substring(0, startIndex) + 
                          newAliasesSection + 
                          zshrcContent.substring(endIndex + ALIASES_SECTION_END.length);
        } else {
            // Add new section at the end
            if (zshrcContent && !zshrcContent.endsWith('\n')) {
                zshrcContent += '\n';
            }
            zshrcContent += '\n' + newAliasesSection + '\n';
        }
        
        fs.writeFileSync(ZSHRC_PATH, zshrcContent);
        return true;
    } catch (error) {
        console.error('Error updating .zshrc file:', error);
        return false;
    }
}

// Get all managed aliases as plain text
router.get('/', (req, res) => {
    try {
        const aliasesText = readLocalSettings();
        const exists = fs.existsSync(SETTINGS_FILE);
        res.json({
            text: aliasesText,
            // Keep legacy fields for the UI: point to local settings file
            zshrcPath: SETTINGS_FILE,
            hasZshrc: exists,
            // New explicit fields
            settingsPath: SETTINGS_FILE,
            hasSettings: exists
        });
    } catch (error) {
        console.error('Error getting aliases:', error);
        res.status(500).json({ error: 'Failed to get aliases' });
    }
});

// Set/update aliases from plain text
router.post('/', express.json(), (req, res) => {
    try {
        const { text } = req.body;
        
        if (typeof text !== 'string') {
            return res.status(400).json({ error: 'Invalid text format' });
        }
        
        // Save the text exactly as provided without parsing/formatting
        if (writeLocalSettings(text)) {
            const aliasCount = (text.match(/^\s*alias\s+/gm) || []).length;
            res.json({ 
                success: true, 
                message: 'Aliases updated successfully',
                aliasCount
            });
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

module.exports = router;