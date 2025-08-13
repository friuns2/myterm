const express = require('express');
const path = require('path');
const { PROJECTS_DIR } = require('../middleware/security');
const { execSync } = require('child_process');

const router = express.Router();

// API endpoint to get all sessions across all projects
router.get('/', (req, res) => {
    // Source of truth: list tmux sessions; augment with in-memory attach clients if any
    let tmuxSessions = [];
    try {
        const out = execSync('tmux list-sessions -F "#{session_name}|#{session_created_string}|#{session_path}"', { encoding: 'utf8' });
        tmuxSessions = out
            .split('\n')
            .filter(Boolean)
            .map(line => {
                const [name, createdStr, pathStr] = line.split('|');
                return { name, createdStr, pathStr };
            });
    } catch (e) {
        // No tmux or no sessions
        tmuxSessions = [];
    }

	// Build response: include raw pane thumbnail (visible screen with ANSI)
	const all = tmuxSessions.map(ts => {
		let thumbnail = '';
		let lastCommitSubject = '';
		let lastCommitShortHash = '';
		let gitBranch = '';
		let gitDirty = false;
		try {
			const safeName = JSON.stringify(ts.name).slice(1, -1); // safely quoted tmux target
			// Resize pane to 200x200 cells and capture visible pane with ANSI for thumbnail
			try { execSync(`tmux resize-pane -t ${safeName} -x 200 -y 200`); } catch (_) {}
			const thumbCmd = `tmux capture-pane -pet ${safeName}`; // -p print, -e include escapes, -t target
			thumbnail = execSync(thumbCmd, { encoding: 'utf8' });
		} catch (_) {
			thumbnail = '';
		}

        // Try to fetch last commit details if inside a git repo
        try {
            if (ts.pathStr) {
                const isGit = execSync(`git -C ${JSON.stringify(ts.pathStr).slice(1, -1)} rev-parse --is-inside-work-tree 2>/dev/null || echo no`, { encoding: 'utf8' }).trim();
                if (isGit === 'true') {
                    lastCommitSubject = execSync(`git -C ${JSON.stringify(ts.pathStr).slice(1, -1)} log -1 --pretty=%s`, { encoding: 'utf8' }).trim();
                    lastCommitShortHash = execSync(`git -C ${JSON.stringify(ts.pathStr).slice(1, -1)} log -1 --pretty=%h`, { encoding: 'utf8' }).trim();
                }
            }
        } catch (_) {
            // ignore git errors
        }

		// Derive project name from session path relative to PROJECTS_DIR to preserve slashes
		let projectName = 'Unknown';
		try {
			if (ts.pathStr) {
				const rel = path.relative(PROJECTS_DIR, ts.pathStr);
				if (rel && !rel.startsWith('..')) {
					projectName = rel.split(path.sep).join('/');
				} else {
					projectName = path.basename(ts.pathStr);
				}
			}
		} catch (_) {}

		// Git branch and dirty status
		try {
			if (ts.pathStr) {
				const isGit = execSync(`git -C ${JSON.stringify(ts.pathStr).slice(1, -1)} rev-parse --is-inside-work-tree 2>/dev/null || echo no`, { encoding: 'utf8' }).trim();
				if (isGit === 'true') {
					gitBranch = execSync(`git -C ${JSON.stringify(ts.pathStr).slice(1, -1)} rev-parse --abbrev-ref HEAD`, { encoding: 'utf8' }).trim();
					const porcelain = execSync(`git -C ${JSON.stringify(ts.pathStr).slice(1, -1)} status --porcelain`, { encoding: 'utf8' });
					gitDirty = porcelain.trim().length > 0;
				}
			}
		} catch (_) {}

		return {
			id: ts.name,
			thumbnail: thumbnail || '',
			lastCommitSubject,
			lastCommitShortHash,
			title: projectName || ts.name,
			gitBranch,
			gitDirty,
			created: ts.createdStr || new Date().toISOString(),
			projectName
		};
    });

    res.json(all);
});



// API endpoint to kill a session
router.delete('/:sessionId', (req, res) => {
    const sessionId = req.params.sessionId;
    try {
        execSync(`tmux kill-session -t ${sessionId}`);
        res.json({ success: true, message: 'Tmux session killed successfully' });
    } catch (e) {
        res.status(404).json({ success: false, message: 'Session not found or failed to kill' });
    }
});

module.exports = router;