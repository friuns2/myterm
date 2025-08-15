const express = require('express');
const { setupWebSocketServer } = require('./websocket/terminal');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { basicAuthMiddleware, rejectUpgradeIfUnauthorized } = require('./middleware/basicAuth');
const https = require('https');

const app = express();
const port = 3537;

// Serve static files
app.use(basicAuthMiddleware);
app.use(express.static('public'));

// Import route modules
const projectsRouter = require('./routes/projects');
const sessionsRouter = require('./routes/sessions');
const filesRouter = require('./routes/files');
const worktreesRouter = require('./routes/worktrees');
const settingsRouter = require('./routes/settings');

// Use route modules
app.use('/api/projects', projectsRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api', filesRouter);
app.use('/api', worktreesRouter);
app.use('/api/settings', settingsRouter);

// Move the projects-with-worktrees endpoint here to avoid routing conflicts
app.get('/api/projects-with-worktrees', require('./routes/projects').getProjectsWithWorktrees);

// AI predictions endpoint using OpenRouter
app.post('/api/predict', express.json(), async (req, res) => {
  try {
    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY; // allow fallback if set that way
    const OPENROUTER_API_MODEL = process.env.OPENROUTER_API_MODEL || process.env.OPENAI_MODEL || 'qwen/qwen3-coder:free';

    const { input = '', history = [], cwd = '' } = req.body || {};

    if (!OPENROUTER_API_KEY) {
      // No key configured; return empty suggestions gracefully
      return res.json({ suggestions: [] });
    }

    // Build prompt for predictions
    const systemPrompt = 'You are a helpful shell assistant. Given the user\'s current partial input and recent command history, predict the next shell commands they are most likely to run. Output a strict JSON object with exactly three concise shell commands in the array field "suggestions". Do not include explanations, code fences, or extra text.';

    const userPrompt = [
      `Current input: ${input}`,
      cwd ? `Working directory: ${cwd}` : null,
      history && history.length ? `Recent history (newest first):\n- ${history.join('\n- ')}` : null,
      'Constraints: Return JSON like {"suggestions":["cmd1","cmd2","cmd3"]} with exactly 3 items.'
    ].filter(Boolean).join('\n\n');

    const body = JSON.stringify({
      model: OPENROUTER_API_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 256
    });

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        // OpenRouter recommends these headers, but they are optional
        'HTTP-Referer': 'http://localhost',
        'X-Title': 'myshell'
      }
    };

    // Make HTTPS request
    const request = https.request('https://openrouter.ai/api/v1/chat/completions', options, (resp) => {
      let data = '';
      resp.on('data', (chunk) => { data += chunk; });
      resp.on('end', () => {
        try {
          const json = JSON.parse(data);
          const content = json && json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content ? json.choices[0].message.content : '';
          let suggestions = [];
          if (content) {
            // Try to parse as JSON first
            try {
              const parsed = JSON.parse(content);
              if (parsed && Array.isArray(parsed.suggestions)) {
                suggestions = parsed.suggestions.filter(s => typeof s === 'string').slice(0, 3);
              }
            } catch (_) {
              // Fallback: split by newlines and take first 3 non-empty lines
              suggestions = content.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 3);
            }
          }
          // Final sanitation
          suggestions = suggestions.map(s => s.replace(/^```.*$/g, '').trim()).filter(Boolean).slice(0, 3);
          res.json({ suggestions });
        } catch (e) {
          console.error('Error parsing OpenRouter response:', e.message);
          res.json({ suggestions: [] });
        }
      });
    });

    request.on('error', (err) => {
      console.error('OpenRouter request error:', err.message);
      res.json({ suggestions: [] });
    });

    request.write(body);
    request.end();
  } catch (error) {
    console.error('Prediction endpoint error:', error.message);
    res.json({ suggestions: [] });
  }
});

const ZSHRC_PATH = path.join(os.homedir(), '.zshrc');


// Ensure ~/.zshrc sources local settings file under this project
function ensureLocalSettingsIncluded() {
    try {
        const settingsFilePath = path.join(__dirname, 'settings', 'settings.zsh');
        let zshrcContent = fs.existsSync(ZSHRC_PATH) ? fs.readFileSync(ZSHRC_PATH, 'utf8') : '';
        const includeLine = `[ -f "${settingsFilePath}" ] && source "${settingsFilePath}"`;
        if (!zshrcContent.includes(settingsFilePath)) {
            const newContent = zshrcContent + (zshrcContent.endsWith('\n') ? '' : '\n') + includeLine + '\n';
            fs.writeFileSync(ZSHRC_PATH, newContent);
        }
    } catch (error) {
        console.error('Error ensuring local settings include in ~/.zshrc:', error.message);
    }
}

const server = app.listen(port, () => {
    console.log(`Web Terminal running at http://localhost:${port}`);
    // Ensure ~/.zshrc includes local settings file
    ensureLocalSettingsIncluded();
});

// Enforce Basic Auth on WebSocket upgrades
server.on('upgrade', (req, socket) => {
    if (rejectUpgradeIfUnauthorized(req, socket)) {
        return;
    }
    // If authorized, do nothing; ws server will handle the upgrade
});

// Set up WebSocket server
setupWebSocketServer(server);

// Global safety nets to avoid crashing the whole process
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});