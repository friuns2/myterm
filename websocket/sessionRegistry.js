const fs = require('fs');
const path = require('path');

const REGISTRY_DIR = path.join(__dirname, '..', 'sessions');
const REGISTRY_FILE = path.join(REGISTRY_DIR, 'registry.json');

function load() {
    try {
        if (!fs.existsSync(REGISTRY_FILE)) return {};
        const raw = fs.readFileSync(REGISTRY_FILE, 'utf8');
        return JSON.parse(raw || '{}');
    } catch (_) {
        return {};
    }
}

function save(db) {
    if (!fs.existsSync(REGISTRY_DIR)) fs.mkdirSync(REGISTRY_DIR, { recursive: true });
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(db, null, 2));
}

function registerSession(sessionId, projectName) {
    const db = load();
    if (!db[sessionId]) db[sessionId] = {};
    db[sessionId].projectName = projectName || null;
    db[sessionId].created = db[sessionId].created || new Date().toISOString();
    save(db);
}

function unregisterSession(sessionId) {
    const db = load();
    if (db[sessionId]) {
        delete db[sessionId];
        save(db);
    }
}

function getSessionInfo(sessionId) {
    const db = load();
    return db[sessionId] || null;
}

function getAllSessionsInfo() {
    return load();
}

module.exports = {
    registerSession,
    unregisterSession,
    getSessionInfo,
    getAllSessionsInfo
};


