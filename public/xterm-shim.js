// Expose xterm and fit addon as globals from local symlinked sources
import { Terminal } from '/xterm/lib/xterm.mjs';
import { FitAddon } from '/xterm/addons/addon-fit/lib/addon-fit.mjs';

window.Terminal = Terminal;
window.FitAddon = { FitAddon };

// Expose xterm and fit addon as globals from local symlinked sources
import { Terminal } from '/xterm/lib/xterm.mjs';
import { FitAddon } from '/xterm/addons/addon-fit/lib/addon-fit.mjs';

// Maintain the same global shape expected by existing code
window.Terminal = Terminal;
window.FitAddon = { FitAddon };


