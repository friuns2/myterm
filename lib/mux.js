const pty = require('node-pty-prebuilt-multiarch');
const path = require('path');

class SessionRegistry {
	constructor() {
		this.nameToSession = new Map();
	}

	createSession(name, cwd, options = {}) {
		if (this.nameToSession.has(name)) return this.nameToSession.get(name);
		const shell = process.env.SHELL || '/bin/bash';
		const cols = options.cols || 120;
		const rows = options.rows || 40;
		const p = pty.spawn(shell, [], {
			name: 'xterm-color',
			cols,
			rows,
			cwd: cwd || process.cwd(),
			env: process.env
		});
		const sess = {
			name,
			cwd: path.resolve(cwd || process.cwd()),
			pty: p,
			created: new Date(),
			cols,
			rows,
			buffer: '',
			bufferLimit: 200000 // store ~200k chars of recent output
		};
		p.onData((d) => {
			sess.buffer += d;
			if (sess.buffer.length > sess.bufferLimit) {
				sess.buffer = sess.buffer.slice(-sess.bufferLimit);
			}
		});
		p.onExit(() => {
			this.nameToSession.delete(name);
		});
		this.nameToSession.set(name, sess);
		return sess;
	}

	hasSession(name) {
		return this.nameToSession.has(name);
	}

	getSession(name) {
		return this.nameToSession.get(name) || null;
	}

	listSessions() {
		return Array.from(this.nameToSession.values()).map(s => ({
			name: s.name,
			createdStr: s.created.toISOString(),
			pathStr: s.cwd,
			cols: s.cols,
			rows: s.rows
		}));
	}

	resizeWindow(name, x, y) {
		const s = this.getSession(name);
		if (!s) return false;
		if (Number.isFinite(x) && Number.isFinite(y)) {
			s.pty.resize(x, y);
			s.cols = x; s.rows = y;
			return true;
		}
		return false;
	}

	capturePane(name, opts = {}) {
		const s = this.getSession(name);
		if (!s) return '';
		const includeEscapes = opts.includeEscapes !== false; // keep ANSI by default
		const lastLines = Number.isFinite(opts.lastLines) ? opts.lastLines : 40;
		// Split buffer into lines and take the tail
		const lines = s.buffer.split(/\r?\n/);
		const tail = lines.slice(-lastLines).join('\n');
		return includeEscapes ? tail : tail.replace(/\x1B\[[0-9;?]*[ -\/]*[@-~]/g, '');
	}

	killSession(name) {
		const s = this.getSession(name);
		if (!s) return false;
		try { s.pty.kill(); } catch (_) {}
		this.nameToSession.delete(name);
		return true;
	}
}

const registry = new SessionRegistry();

module.exports = {
	createSession: (name, cwd, options) => registry.createSession(name, cwd, options),
	hasSession: (name) => registry.hasSession(name),
	getSession: (name) => registry.getSession(name),
	listSessions: () => registry.listSessions(),
	resizeWindow: (name, x, y) => registry.resizeWindow(name, x, y),
	capturePane: (name, opts) => registry.capturePane(name, opts),
	killSession: (name) => registry.killSession(name)
};


