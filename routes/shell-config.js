const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');

const router = express.Router();
const SHELL_CONFIG_PATH = path.join(os.homedir(), '.crush', 'shell_configs.json');

// Ensure the .crush directory exists
function ensureCrushDir() {
    const crushDir = path.dirname(SHELL_CONFIG_PATH);
    if (!fs.existsSync(crushDir)) {
        fs.mkdirSync(crushDir, { recursive: true });
    }
}

// Load shell configurations
function loadShellConfigs() {
    try {
        ensureCrushDir();
        if (fs.existsSync(SHELL_CONFIG_PATH)) {
            const data = fs.readFileSync(SHELL_CONFIG_PATH, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading shell configurations:', error);
    }
    return {
        profiles: {
            default: {
                name: 'Default',
                description: 'Default shell configuration',
                zshrc_content: '# Default zsh configuration\nexport PATH="$PATH:/usr/local/bin"\nalias ll="ls -la"\nalias la="ls -A"\nalias l="ls -CF"\n\n# Enable command completion\nautoload -U compinit\ncompinit\n\n# History settings\nHISTSIZE=10000\nSAVEHIST=10000\nsetopt HIST_IGNORE_DUPS\nsetopt HIST_FIND_NO_DUPS\nsetopt SHARE_HISTORY',
                environment_vars: {},
                created_at: new Date().toISOString()
            }
        },
        active_profile: 'default'
    };
}

// Save shell configurations
function saveShellConfigs(configs) {
    try {
        ensureCrushDir();
        fs.writeFileSync(SHELL_CONFIG_PATH, JSON.stringify(configs, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving shell configurations:', error);
        return false;
    }
}

// Get all shell configurations
router.get('/', (req, res) => {
    const configs = loadShellConfigs();
    res.json(configs);
});

// Get specific shell profile
router.get('/profiles/:profileName', (req, res) => {
    const configs = loadShellConfigs();
    const profile = configs.profiles[req.params.profileName];
    
    if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
    }
    
    res.json(profile);
});

// Create new shell profile
router.post('/profiles', (req, res) => {
    const { name, description, zshrc_content, environment_vars } = req.body;
    
    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Profile name is required' });
    }
    
    const profileKey = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const configs = loadShellConfigs();
    
    if (configs.profiles[profileKey]) {
        return res.status(400).json({ error: 'Profile already exists' });
    }
    
    configs.profiles[profileKey] = {
        name: name.trim(),
        description: description || '',
        zshrc_content: zshrc_content || '# Custom shell configuration\n',
        environment_vars: environment_vars || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
    
    if (saveShellConfigs(configs)) {
        res.json({ success: true, profileKey, profile: configs.profiles[profileKey] });
    } else {
        res.status(500).json({ error: 'Failed to save shell configuration' });
    }
});

// Update shell profile
router.put('/profiles/:profileName', (req, res) => {
    const { name, description, zshrc_content, environment_vars } = req.body;
    const configs = loadShellConfigs();
    
    if (!configs.profiles[req.params.profileName]) {
        return res.status(404).json({ error: 'Profile not found' });
    }
    
    const profile = configs.profiles[req.params.profileName];
    
    if (name && name.trim()) profile.name = name.trim();
    if (description !== undefined) profile.description = description;
    if (zshrc_content !== undefined) profile.zshrc_content = zshrc_content;
    if (environment_vars !== undefined) profile.environment_vars = environment_vars;
    profile.updated_at = new Date().toISOString();
    
    if (saveShellConfigs(configs)) {
        res.json({ success: true, profile });
    } else {
        res.status(500).json({ error: 'Failed to update shell configuration' });
    }
});

// Delete shell profile
router.delete('/profiles/:profileName', (req, res) => {
    const configs = loadShellConfigs();
    
    if (!configs.profiles[req.params.profileName]) {
        return res.status(404).json({ error: 'Profile not found' });
    }
    
    if (req.params.profileName === 'default') {
        return res.status(400).json({ error: 'Cannot delete default profile' });
    }
    
    if (configs.active_profile === req.params.profileName) {
        configs.active_profile = 'default';
    }
    
    delete configs.profiles[req.params.profileName];
    
    if (saveShellConfigs(configs)) {
        res.json({ success: true });
    } else {
        res.status(500).json({ error: 'Failed to delete shell configuration' });
    }
});

// Set active profile
router.post('/active/:profileName', (req, res) => {
    const configs = loadShellConfigs();
    
    if (!configs.profiles[req.params.profileName]) {
        return res.status(404).json({ error: 'Profile not found' });
    }
    
    configs.active_profile = req.params.profileName;
    
    if (saveShellConfigs(configs)) {
        res.json({ success: true, active_profile: req.params.profileName });
    } else {
        res.status(500).json({ error: 'Failed to set active profile' });
    }
});

// Export functions for use in other modules
module.exports = {
    router,
    loadShellConfigs,
    saveShellConfigs
};