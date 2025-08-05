const fs = require('fs');
const path = require('path');
const config = require('./config');

class FileManager {
  constructor() {
    this.projectsDir = config.PROJECTS_DIR;
  }

  browse(requestPath = '') {
    const safePath = this.getSafePath(requestPath);
    
    if (!fs.existsSync(safePath)) {
      throw new Error('Path not found');
    }

    const stats = fs.statSync(safePath);
    
    if (stats.isFile()) {
      return {
        type: 'file',
        name: path.basename(safePath),
        path: requestPath,
        size: stats.size,
        modified: stats.mtime
      };
    }

    if (stats.isDirectory()) {
      const items = fs.readdirSync(safePath, { withFileTypes: true })
        .map(dirent => {
          const itemPath = path.join(safePath, dirent.name);
          const itemStats = fs.statSync(itemPath);
          const relativePath = path.join(requestPath, dirent.name).replace(/\\/g, '/');
          
          return {
            name: dirent.name,
            type: dirent.isDirectory() ? 'directory' : 'file',
            path: relativePath,
            size: dirent.isFile() ? itemStats.size : null,
            modified: itemStats.mtime
          };
        })
        .sort((a, b) => {
          // Directories first, then files, both alphabetically
          if (a.type !== b.type) {
            return a.type === 'directory' ? -1 : 1;
          }
          return a.name.localeCompare(b.name);
        });

      return {
        type: 'directory',
        name: path.basename(safePath) || 'root',
        path: requestPath,
        items: items
      };
    }

    throw new Error('Invalid path type');
  }

  readFile(filePath) {
    const safePath = this.getSafePath(filePath);
    
    if (!fs.existsSync(safePath)) {
      throw new Error('File not found');
    }

    const stats = fs.statSync(safePath);
    if (!stats.isFile()) {
      throw new Error('Path is not a file');
    }

    // Check if file is too large (> 1MB)
    if (stats.size > 1024 * 1024) {
      throw new Error('File too large to display');
    }

    const content = fs.readFileSync(safePath, 'utf8');
    
    return {
      name: path.basename(safePath),
      path: filePath,
      content: content,
      size: stats.size,
      modified: stats.mtime
    };
  }

  writeFile(filePath, content) {
    const safePath = this.getSafePath(filePath);
    
    // Ensure directory exists
    const dir = path.dirname(safePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(safePath, content, 'utf8');
    
    const stats = fs.statSync(safePath);
    return {
      name: path.basename(safePath),
      path: filePath,
      size: stats.size,
      modified: stats.mtime
    };
  }

  createFolder(folderPath) {
    const safePath = this.getSafePath(folderPath);
    
    if (fs.existsSync(safePath)) {
      throw new Error('Folder already exists');
    }

    fs.mkdirSync(safePath, { recursive: true });
    
    const stats = fs.statSync(safePath);
    return {
      name: path.basename(safePath),
      path: folderPath,
      type: 'directory',
      modified: stats.mtime
    };
  }

  getSafePath(requestPath) {
    // Normalize the path and resolve it relative to projects directory
    const normalizedPath = path.normalize(requestPath || '').replace(/^[\/\\]+/, '');
    const safePath = path.resolve(this.projectsDir, normalizedPath);
    
    // Ensure the path is within the projects directory
    if (!safePath.startsWith(path.resolve(this.projectsDir))) {
      throw new Error('Access denied: Path outside allowed directory');
    }
    
    return safePath;
  }
}

module.exports = new FileManager();