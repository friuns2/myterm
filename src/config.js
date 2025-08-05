// Configuration constants
const path = require('path');

module.exports = {
  PORT: 3111,
  SESSION_TIMEOUT: 2 * 60 * 60 * 1000, // 2 hours
  MAX_BUFFER_SIZE: 0, // Maximum number of characters to buffer
  PROJECTS_DIR: path.join(__dirname, '..', 'projects'),
  WEBSOCKET_CONFIG: {
    cols: 80,
    rows: 24
  }
};