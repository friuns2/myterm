const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const ENV_FILE_PATH = path.join(__dirname, '..', '.crush', 'global_env.json');

// Ensure the .crush directory exists
function ensureCrushDir() {
    const crushDir = path.dirname(ENV_FILE_PATH);
    if (!fs.existsSync(crushDir)) {
        fs.mkdirSync(crushDir, { recursive: true });
    }
}

// Load global environment variables from file
function loadGlobalEnv() {
    try {
        if (fs.existsSync(ENV_FILE_PATH)) {
            const data = fs.readFileSync(ENV_FILE_PATH, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading global environment variables:', error);
    }
    return {};
}

// Save global environment variables to file
function saveGlobalEnv(envVars) {
    try {
        ensureCrushDir();
        fs.writeFileSync(ENV_FILE_PATH, JSON.stringify(envVars, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving global environment variables:', error);
        return false;
    }
}

// Get all global environment variables
router.get('/', (req, res) => {
    try {
        const globalEnv = loadGlobalEnv();
        res.json(globalEnv);
    } catch (error) {
        console.error('Error getting global environment variables:', error);
        res.status(500).json({ error: 'Failed to get environment variables' });
    }
});

// Set or update global environment variables
router.post('/', express.json(), (req, res) => {
    try {
        const { variables } = req.body;
        
        if (!variables || typeof variables !== 'object') {
            return res.status(400).json({ error: 'Variables object is required' });
        }
        
        // Validate variable names and values
        for (const [key, value] of Object.entries(variables)) {
            if (typeof key !== 'string' || key.trim() === '') {
                return res.status(400).json({ error: 'Variable names must be non-empty strings' });
            }
            if (typeof value !== 'string') {
                return res.status(400).json({ error: 'Variable values must be strings' });
            }
        }
        
        const currentEnv = loadGlobalEnv();
        const updatedEnv = { ...currentEnv, ...variables };
        
        if (saveGlobalEnv(updatedEnv)) {
            res.json({ success: true, message: 'Environment variables updated successfully' });
        } else {
            res.status(500).json({ error: 'Failed to save environment variables' });
        }
    } catch (error) {
        console.error('Error updating global environment variables:', error);
        res.status(500).json({ error: 'Failed to update environment variables' });
    }
});

// Delete specific global environment variables
router.delete('/', express.json(), (req, res) => {
    try {
        const { keys } = req.body;
        
        if (!keys || !Array.isArray(keys)) {
            return res.status(400).json({ error: 'Keys array is required' });
        }
        
        const currentEnv = loadGlobalEnv();
        
        // Remove specified keys
        keys.forEach(key => {
            delete currentEnv[key];
        });
        
        if (saveGlobalEnv(currentEnv)) {
            res.json({ success: true, message: 'Environment variables deleted successfully' });
        } else {
            res.status(500).json({ error: 'Failed to save environment variables' });
        }
    } catch (error) {
        console.error('Error deleting global environment variables:', error);
        res.status(500).json({ error: 'Failed to delete environment variables' });
    }
});

// Clear all global environment variables
router.delete('/all', (req, res) => {
    try {
        if (saveGlobalEnv({})) {
            res.json({ success: true, message: 'All environment variables cleared successfully' });
        } else {
            res.status(500).json({ error: 'Failed to clear environment variables' });
        }
    } catch (error) {
        console.error('Error clearing global environment variables:', error);
        res.status(500).json({ error: 'Failed to clear environment variables' });
    }
});

// Export the router and utility functions
module.exports = router;
module.exports.loadGlobalEnv = loadGlobalEnv;