const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { validatePath, PROJECTS_DIR } = require('../middleware/security');

const router = express.Router();

// API endpoint to browse directory contents
router.get('/browse', (req, res) => {
    const dirPath = req.query.path || process.cwd();
    
    try {
        if (!validatePath(dirPath)) {
            return res.status(403).json({ error: 'Access denied to this directory' });
        }
        
        const resolvedPath = path.resolve(dirPath);
        
        if (!fs.existsSync(resolvedPath)) {
            return res.status(404).json({ error: 'Directory not found' });
        }
        
        const items = fs.readdirSync(resolvedPath, { withFileTypes: true })
            .map(dirent => ({
                name: dirent.name,
                type: dirent.isDirectory() ? 'directory' : 'file',
                path: path.join(resolvedPath, dirent.name)
            }))
            .sort((a, b) => {
                // Directories first, then files, both alphabetically
                if (a.type !== b.type) {
                    return a.type === 'directory' ? -1 : 1;
                }
                return a.name.localeCompare(b.name);
            });
        
        res.json({
            currentPath: resolvedPath,
            parentPath: path.dirname(resolvedPath),
            items
        });
    } catch (error) {
        console.error('Error browsing directory:', error);
        res.status(500).json({ error: 'Failed to browse directory' });
    }
});

// API endpoint to read file content
router.get('/file', (req, res) => {
    const filePath = req.query.path;
    
    if (!filePath) {
        return res.status(400).json({ error: 'File path is required' });
    }
    
    try {
        if (!validatePath(filePath)) {
            return res.status(403).json({ error: 'Access denied to this file' });
        }
        
        const resolvedPath = path.resolve(filePath);
        
        if (!fs.existsSync(resolvedPath)) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        const stats = fs.statSync(resolvedPath);
        if (stats.isDirectory()) {
            return res.status(400).json({ error: 'Path is a directory, not a file' });
        }
        
        // Check if file is too large (limit to 1MB)
        if (stats.size > 1024 * 1024) {
            return res.status(413).json({ error: 'File too large to edit' });
        }
        
        const content = fs.readFileSync(resolvedPath, 'utf8');
        res.json({ content, path: resolvedPath });
    } catch (error) {
        console.error('Error reading file:', error);
        res.status(500).json({ error: 'Failed to read file' });
    }
});

// API endpoint to save file content
router.post('/file', express.json(), (req, res) => {
    const { path: filePath, content } = req.body;
    
    if (!filePath) {
        return res.status(400).json({ error: 'File path is required' });
    }
    
    try {
        if (!validatePath(filePath)) {
            return res.status(403).json({ error: 'Access denied to this file' });
        }
        
        const resolvedPath = path.resolve(filePath);
        
        // Ensure directory exists
        const dirPath = path.dirname(resolvedPath);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
        
        fs.writeFileSync(resolvedPath, content || '', 'utf8');
        res.json({ success: true, path: resolvedPath });
    } catch (error) {
        console.error('Error saving file:', error);
        res.status(500).json({ error: 'Failed to save file' });
    }
});

// API endpoint to create folder
router.post('/folder', express.json(), (req, res) => {
    const { path: folderPath } = req.body;
    
    if (!folderPath) {
        return res.status(400).json({ error: 'Folder path is required' });
    }
    
    try {
        if (!validatePath(folderPath)) {
            return res.status(403).json({ error: 'Access denied to this location' });
        }
        
        const resolvedPath = path.resolve(folderPath);
        
        if (fs.existsSync(resolvedPath)) {
            return res.status(409).json({ error: 'Folder already exists' });
        }
        
        fs.mkdirSync(resolvedPath, { recursive: true });
        res.json({ success: true, path: resolvedPath });
    } catch (error) {
        console.error('Error creating folder:', error);
        res.status(500).json({ error: 'Failed to create folder' });
    }
});

module.exports = router; 