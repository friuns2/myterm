const path = require('path');
const os = require('os');

const PROJECTS_DIR = path.join(__dirname, '..', '..', 'projects');

// Security check - ensure path is within allowed directories
function validatePath(filePath) {
    const resolvedPath = path.resolve(filePath);
    const projectsPath = path.resolve(PROJECTS_DIR);
    const homePath = path.resolve(os.homedir());

    return resolvedPath.startsWith(projectsPath) || resolvedPath.startsWith(homePath);
}

module.exports = {
    validatePath,
    PROJECTS_DIR
}; 