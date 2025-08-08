const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');

const router = express.Router();
// Allow overriding zshrc path for testing/sandbox via env var
const ZSHRC_PATH = process.env.MYSHELL_ZSHRC_PATH || path.join(os.homedir(), '.zshrc');
const ALIASES_SECTION_START = '# === MyShell24 Aliases Start ===';
const ALIASES_SECTION_END = '# === MyShell24 Aliases End ===';

// Read current .zshrc file
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
        ).trim();
        return aliasesSection;
    }
    
    return '';
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
        
        // Ensure target directory exists (important when using a sandbox path)
        const targetDir = path.dirname(ZSHRC_PATH);
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
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
        
        // Validate aliases format
        const lines = text.split('\n').filter(line => line.trim());
        const validAliases = [];
        const errors = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line && !line.startsWith('#')) {
                // Check if line starts with 'alias ' and has proper format
                if (line.startsWith('alias ') && line.includes('=')) {
                    validAliases.push(line);
                } else if (!line.startsWith('alias ')) {
                    // Auto-format if it's just name=value
                    const equalIndex = line.indexOf('=');
                    if (equalIndex > 0) {
                        const name = line.substring(0, equalIndex).trim();
                        const value = line.substring(equalIndex + 1).trim();
                        if (name && value) {
                            validAliases.push(`alias ${name}=${value}`);
                        } else {
                            errors.push(`Line ${i + 1}: Invalid alias format`);
                        }
                    } else {
                        errors.push(`Line ${i + 1}: Invalid alias format`);
                    }
                } else {
                    errors.push(`Line ${i + 1}: Invalid alias format`);
                }
            } else if (line.startsWith('#')) {
                // Keep comments
                validAliases.push(line);
            }
        }
        
        if (errors.length > 0) {
            return res.status(400).json({ error: 'Invalid alias format', details: errors });
        }
        
        const formattedText = validAliases.join('\n');
        
        if (updateZshrcWithAliases(formattedText)) {
            res.json({ 
                success: true, 
                message: 'Aliases updated successfully',
                aliasCount: validAliases.filter(line => line.startsWith('alias ')).length
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