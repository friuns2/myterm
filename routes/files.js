const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { validatePath, PROJECTS_DIR } = require('../middleware/security');

// Function to check if a file is text-based
function isTextFile(filePath) {
    const textExtensions = [
        '.txt', '.md', '.js', '.ts', '.jsx', '.tsx', '.json', '.xml', '.html', '.htm', '.css', '.scss', '.sass', '.less',
        '.py', '.rb', '.php', '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.go', '.rs', '.swift', '.kt', '.scala',
        '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd', '.yml', '.yaml', '.toml', '.ini', '.cfg', '.conf',
        '.log', '.sql', '.r', '.m', '.pl', '.lua', '.vim', '.dockerfile', '.gitignore', '.gitattributes', '.editorconfig',
        '.env', '.properties', '.makefile', '.cmake', '.gradle', '.maven', '.sbt', '.clj', '.cljs', '.edn', '.ex', '.exs',
        '.elm', '.hs', '.lhs', '.ml', '.mli', '.fs', '.fsi', '.fsx', '.vb', '.pas', '.pp', '.inc', '.asm', '.s'
    ];
    
    const ext = path.extname(filePath).toLowerCase();
    return textExtensions.includes(ext) || !ext; // Files without extension are assumed to be text
}

const router = express.Router();

function normalizePath(inputPath) {
    if (!inputPath) return inputPath;
    let p = String(inputPath);
    if (p === '~' || p.startsWith('~/')) {
        p = path.join(os.homedir(), p.slice(1));
    }
    return path.resolve(p);
}

// API endpoint to browse directory contents
router.get('/browse', (req, res) => {
    const dirPath = req.query.path || process.cwd();
    
    try {
        if (!validatePath(dirPath)) {
            return res.status(403).json({ error: 'Access denied to this directory' });
        }
        const resolvedPath = normalizePath(dirPath);
        
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

// API endpoint to serve files directly
router.get('/view', (req, res) => {
    const filePath = req.query.path;
    
    if (!filePath) {
        return res.status(400).json({ error: 'File path is required' });
    }
    
    try {
        if (!validatePath(filePath)) {
            return res.status(403).json({ error: 'Access denied to this file' });
        }
        const resolvedPath = normalizePath(filePath);
        
        if (!fs.existsSync(resolvedPath)) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        const stats = fs.statSync(resolvedPath);
        if (stats.isDirectory()) {
            return res.status(400).json({ error: 'Path is a directory, not a file' });
        }
        
        // Get file extension to determine MIME type
        const ext = path.extname(resolvedPath).toLowerCase();
        const mimeTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.webp': 'image/webp',
            '.pdf': 'application/pdf',
            '.mp4': 'video/mp4',
            '.webm': 'video/webm',
            '.mp3': 'audio/mpeg',
            '.wav': 'audio/wav',
            '.ogg': 'audio/ogg'
        };
        
        const mimeType = mimeTypes[ext] || 'application/octet-stream';
        
        // Set appropriate headers for inline viewing
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', 'inline');
        
        // Stream the file
        const fileStream = fs.createReadStream(resolvedPath);
        fileStream.pipe(res);
        
    } catch (error) {
        console.error('Error serving file:', error);
        res.status(500).json({ error: 'Failed to serve file' });
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
        const resolvedPath = normalizePath(filePath);
        
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
        
        // Check if file is text-based
        if (!isTextFile(resolvedPath)) {
            return res.status(400).json({ error: 'File is not a text file', isTextFile: false });
        }
        
        const content = fs.readFileSync(resolvedPath, 'utf8');
        res.json({ content, path: resolvedPath, isTextFile: true });
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
        const resolvedPath = normalizePath(filePath);
        
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
        const resolvedPath = normalizePath(folderPath);
        
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