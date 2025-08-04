# CRUSH.md

Build, run, lint, test
- Install: npm install
- Start server: npm run start (serves /public on http://localhost:3000)
- Dev shell backend only: npm run shell
- Lint: (none configured). If adding ESLint, prefer eslint@latest with eslint-config-standard and prettier.
- Test: (none configured). If adding tests, prefer vitest or jest; expose: npm test, npm run test:watch, and npm run test -t "pattern" for a single test.

Project overview
- Node.js/Express server (server.js), WebSocket (ws), PTY (node-pty), UUID sessions; static client in public/ using xterm.js via globals.
- No TypeScript; CommonJS require/module.exports style; keep this convention unless converting repo-wide.

Code style
- Imports: builtins, third-party, then local; one const per require; destructure where idiomatic (e.g., { v4: uuidv4 }).
- Formatting: 2-space indent, single quotes, trailing commas when multi-line objects/arrays; max line length ~100; no semicolons change.
- Naming: camelCase for vars/functions, PascalCase for classes/constructors, UPPER_SNAKE for constants.
- Types: use JSDoc for important shapes and function contracts; prefer explicit param/return docs for exported APIs.
- Errors: never swallow; log with context and include error.message; send minimal info to clients; avoid leaking env; validate and guard inputs from WebSocket messages.
- Async: use async/await; propagate errors; avoid unhandled promise rejections.
- Security: never expose secrets; sanitize/validate any user-provided data written to PTY; enforce timeouts; avoid logging session IDs.

Frontend (public/)
- Plain JS using window.Terminal and FitAddon; keep DOM queries cached; debounce resize handlers; avoid inline styles.
- Events: guard JSON.parse with try/catch; switch on message.type with default.

Cursor/Copilot rules
- .cursor/rules not present; no Copilot instruction file. If added later, reflect them here.
