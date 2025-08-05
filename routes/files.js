// File management routes
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { PROJECTS_DIR, isSafePath } = require('./projects');

const router = express.Router({ mergeParams: true });

// Helper function to check if path is within project directory
function isValidProjectPath(projectName, requestedPath) {
    const projectPath = path.join(PROJECTS_DIR, projectName);
    const fullPath = path.resolve(projectPath, requestedPath || '.');
    return fullPath.startsWith(path.resolve(projectPath));
}

// Helper function to get file stats
async function getFileStats(filePath) {
    try {
        const stats = await fs.stat(filePath);
        return {
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime,
            isDirectory: stats.isDirectory(),
            isFile: stats.isFile(),
            permissions: stats.mode
        };
    } catch (error) {
        return null;
    }
}

// Browse directory contents
router.get('/browse', async (req, res) => {
    try {
        const { projectName } = req.params;
        const requestedPath = req.query.path || '';
        
        if (!isSafePath(projectName)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        if (!isValidProjectPath(projectName, requestedPath)) {
            return res.status(403).json({ error: 'Path access denied' });
        }
        
        const projectPath = path.join(PROJECTS_DIR, projectName);
        const fullPath = path.resolve(projectPath, requestedPath);
        
        try {
            const items = await fs.readdir(fullPath);
            const fileList = [];
            
            for (const item of items) {
                // Skip hidden files starting with . (except .git, .gitignore, etc.)
                if (item.startsWith('.') && !item.match(/^\.(git|gitignore|env|dockerignore)$/)) {
                    continue;
                }
                
                const itemPath = path.join(fullPath, item);
                const stats = await getFileStats(itemPath);
                
                if (stats) {
                    fileList.push({
                        name: item,
                        path: path.relative(projectPath, itemPath),
                        isDirectory: stats.isDirectory,
                        size: stats.isDirectory ? null : stats.size,
                        modified: stats.modified,
                        created: stats.created
                    });
                }
            }
            
            // Sort: directories first, then files, both alphabetically
            fileList.sort((a, b) => {
                if (a.isDirectory && !b.isDirectory) return -1;
                if (!a.isDirectory && b.isDirectory) return 1;
                return a.name.localeCompare(b.name);
            });
            
            res.json(fileList);
            
        } catch (error) {
            if (error.code === 'ENOENT') {
                res.status(404).json({ error: 'Directory not found' });
            } else if (error.code === 'ENOTDIR') {
                res.status(400).json({ error: 'Path is not a directory' });
            } else {
                throw error;
            }
        }
        
    } catch (error) {
        console.error('Error browsing directory:', error);
        res.status(500).json({ error: 'Failed to browse directory' });
    }
});

// Read file content
router.get('/files', async (req, res) => {
    try {
        const { projectName } = req.params;
        const requestedPath = req.query.path;
        
        if (!requestedPath) {
            return res.status(400).json({ error: 'File path is required' });
        }
        
        if (!isSafePath(projectName)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        if (!isValidProjectPath(projectName, requestedPath)) {
            return res.status(403).json({ error: 'File access denied' });
        }
        
        const projectPath = path.join(PROJECTS_DIR, projectName);
        const filePath = path.resolve(projectPath, requestedPath);
        
        try {
            const stats = await fs.stat(filePath);
            
            if (stats.isDirectory()) {
                return res.status(400).json({ error: 'Path is a directory, not a file' });
            }
            
            // Check file size (limit to 10MB for safety)
            if (stats.size > 10 * 1024 * 1024) {
                return res.status(413).json({ error: 'File too large to read' });
            }
            
            const content = await fs.readFile(filePath, 'utf8');
            
            res.json({
                content,
                path: requestedPath,
                size: stats.size,
                modified: stats.mtime
            });
            
        } catch (error) {
            if (error.code === 'ENOENT') {
                res.status(404).json({ error: 'File not found' });
            } else if (error.code === 'EISDIR') {
                res.status(400).json({ error: 'Path is a directory, not a file' });
            } else {
                throw error;
            }
        }
        
    } catch (error) {
        console.error('Error reading file:', error);
        res.status(500).json({ error: 'Failed to read file' });
    }
});

// Save file content
router.post('/files', async (req, res) => {
    try {
        const { projectName } = req.params;
        const { path: requestedPath, content } = req.body;
        
        if (!requestedPath) {
            return res.status(400).json({ error: 'File path is required' });
        }
        
        if (content === undefined) {
            return res.status(400).json({ error: 'File content is required' });
        }
        
        if (!isSafePath(projectName)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        if (!isValidProjectPath(projectName, requestedPath)) {
            return res.status(403).json({ error: 'File access denied' });
        }
        
        const projectPath = path.join(PROJECTS_DIR, projectName);
        const filePath = path.resolve(projectPath, requestedPath);
        
        // Ensure directory exists
        const dirPath = path.dirname(filePath);
        await fs.mkdir(dirPath, { recursive: true });
        
        // Write file
        await fs.writeFile(filePath, content, 'utf8');
        
        const stats = await fs.stat(filePath);
        
        res.json({
            message: 'File saved successfully',
            path: requestedPath,
            size: stats.size,
            modified: stats.mtime
        });
        
    } catch (error) {
        console.error('Error saving file:', error);
        res.status(500).json({ error: 'Failed to save file' });
    }
});

// Create new folder
router.post('/folders', async (req, res) => {
    try {
        const { projectName } = req.params;
        const { path: requestedPath } = req.body;
        
        if (!requestedPath) {
            return res.status(400).json({ error: 'Folder path is required' });
        }
        
        if (!isSafePath(projectName)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        if (!isValidProjectPath(projectName, requestedPath)) {
            return res.status(403).json({ error: 'Folder access denied' });
        }
        
        const projectPath = path.join(PROJECTS_DIR, projectName);
        const folderPath = path.resolve(projectPath, requestedPath);
        
        // Check if folder already exists
        try {
            const stats = await fs.stat(folderPath);
            if (stats.isDirectory()) {
                return res.status(409).json({ error: 'Folder already exists' });
            } else {
                return res.status(409).json({ error: 'A file with this name already exists' });
            }
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
            // Folder doesn't exist, continue with creation
        }
        
        // Create folder
        await fs.mkdir(folderPath, { recursive: true });
        
        const stats = await fs.stat(folderPath);
        
        res.json({
            message: 'Folder created successfully',
            path: requestedPath,
            created: stats.birthtime
        });
        
    } catch (error) {
        console.error('Error creating folder:', error);
        res.status(500).json({ error: 'Failed to create folder' });
    }
});

// Delete file or folder
router.delete('/items', async (req, res) => {
    try {
        const { projectName } = req.params;
        const { path: requestedPath } = req.body;
        
        if (!requestedPath) {
            return res.status(400).json({ error: 'Path is required' });
        }
        
        if (!isSafePath(projectName)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        if (!isValidProjectPath(projectName, requestedPath)) {
            return res.status(403).json({ error: 'Path access denied' });
        }
        
        const projectPath = path.join(PROJECTS_DIR, projectName);
        const itemPath = path.resolve(projectPath, requestedPath);
        
        try {
            const stats = await fs.stat(itemPath);
            
            if (stats.isDirectory()) {
                await fs.rm(itemPath, { recursive: true, force: true });
                res.json({ message: 'Folder deleted successfully', path: requestedPath });
            } else {
                await fs.unlink(itemPath);
                res.json({ message: 'File deleted successfully', path: requestedPath });
            }
            
        } catch (error) {
            if (error.code === 'ENOENT') {
                res.status(404).json({ error: 'File or folder not found' });
            } else {
                throw error;
            }
        }
        
    } catch (error) {
        console.error('Error deleting item:', error);
        res.status(500).json({ error: 'Failed to delete item' });
    }
});

// Get file/folder information
router.get('/info', async (req, res) => {
    try {
        const { projectName } = req.params;
        const requestedPath = req.query.path || '';
        
        if (!isSafePath(projectName)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        if (!isValidProjectPath(projectName, requestedPath)) {
            return res.status(403).json({ error: 'Path access denied' });
        }
        
        const projectPath = path.join(PROJECTS_DIR, projectName);
        const itemPath = path.resolve(projectPath, requestedPath);
        
        try {
            const stats = await getFileStats(itemPath);
            
            if (!stats) {
                return res.status(404).json({ error: 'Item not found' });
            }
            
            res.json({
                path: requestedPath,
                name: path.basename(itemPath),
                ...stats
            });
            
        } catch (error) {
            if (error.code === 'ENOENT') {
                res.status(404).json({ error: 'Item not found' });
            } else {
                throw error;
            }
        }
        
    } catch (error) {
        console.error('Error getting item info:', error);
        res.status(500).json({ error: 'Failed to get item information' });
    }
});

module.exports = router;