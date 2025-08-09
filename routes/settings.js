const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
// Prefer ZDOTDIR provided at server start; fallback to project ./settings
const SETTINGS_DIR = process.env.ZDOTDIR || path.resolve(__dirname, '..', 'settings');
const ZSHRC_PATH = path.join(SETTINGS_DIR, '.zshrc');
const ALIASES_SECTION_START = '# === MyShell24 Aliases Start ===';
const ALIASES_SECTION_END = '# === MyShell24 Aliases End ===';

// Read current .zshrc file from settings directory
function readZshrc() {
    try {
        if (fs.existsSync(ZSHRC_PATH)) {
            return fs.readFileSync(ZSHRC_PATH, 'utf8');
        }
    } catch (error) {
        console.error('Error reading .zshrc file:', error);
    }
    return '';
}

// Extract aliases from .zshrc managed by MyShell24
function extractManagedAliases(zshrcContent) {
    const startIndex = zshrcContent.indexOf(ALIASES_SECTION_START);
    const endIndex = zshrcContent.indexOf(ALIASES_SECTION_END);
    
    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
        const aliasesSection = zshrcContent.substring(
            startIndex + ALIASES_SECTION_START.length,
            endIndex
        );
        return aliasesSection;
    }
    
    return '';
}

// Update .zshrc with new aliases
function updateZshrcWithAliases(aliasesText) {
    try {
        // Ensure settings directory exists
        fs.mkdirSync(SETTINGS_DIR, { recursive: true });
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
        const zshrcContent = readZshrc();
        const aliasesText = extractManagedAliases(zshrcContent);
        
        res.json({ 
            text: aliasesText,
            zshrcPath: ZSHRC_PATH,
            hasZshrc: fs.existsSync(ZSHRC_PATH)
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
        if (updateZshrcWithAliases(text)) {
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
        if (updateZshrcWithAliases('')) {
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