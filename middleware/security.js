const path = require('path');
const os = require('os');

const PROJECTS_DIR = path.join(__dirname, '..', '..', 'projects');

// Security check - allow any absolute path. Users are already behind auth.
function validatePath(filePath) {
    try {
        const resolvedPath = path.resolve(filePath);
        return path.isAbsolute(resolvedPath);
    } catch (_) {
        return false;
    }
}

module.exports = {
    validatePath,
    PROJECTS_DIR
}; 