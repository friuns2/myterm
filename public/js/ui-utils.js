// UI utilities module

function showNavigationBar() {
    const navbar = document.getElementById('navbar');
    if (navbar) {
        navbar.style.display = 'flex';
    }
}

function hideNavigationBar() {
    const navbar = document.getElementById('navbar');
    if (navbar) {
        navbar.style.display = 'none';
    }
}

function goBackToProjectList() {
    window.currentProject = null;
    window.sessionID = null;
    window.URLModule.clearURLParams();
    window.ProjectModule.showProjectList();
}

function goBackToSessionsList() {
    window.currentProject = null;
    window.sessionID = null;
    window.URLModule.clearURLParams();
    window.ProjectModule.showSessionsAndProjectsList();
}

function showVirtualKeyboard() {
    const keyboard = document.getElementById('virtual-keyboard');
    if (keyboard) {
        keyboard.style.display = 'block';
    }
}

function hideVirtualKeyboard() {
    const keyboard = document.getElementById('virtual-keyboard');
    if (keyboard) {
        keyboard.style.display = 'none';
    }
}

function toggleVirtualKeyboard() {
    const keyboard = document.getElementById('virtual-keyboard');
    if (keyboard) {
        if (keyboard.style.display === 'none' || keyboard.style.display === '') {
            showVirtualKeyboard();
        } else {
            hideVirtualKeyboard();
        }
    }
}

function createVirtualKeyboard() {
    const keyboardHtml = `
        <div id="virtual-keyboard" class="virtual-keyboard" style="display: none;">
            <div class="keyboard-row">
                <button class="key" data-key="Escape">Esc</button>
                <button class="key" data-key="F1">F1</button>
                <button class="key" data-key="F2">F2</button>
                <button class="key" data-key="F3">F3</button>
                <button class="key" data-key="F4">F4</button>
                <button class="key" data-key="F5">F5</button>
                <button class="key" data-key="F6">F6</button>
                <button class="key" data-key="F7">F7</button>
                <button class="key" data-key="F8">F8</button>
                <button class="key" data-key="F9">F9</button>
                <button class="key" data-key="F10">F10</button>
                <button class="key" data-key="F11">F11</button>
                <button class="key" data-key="F12">F12</button>
            </div>
            <div class="keyboard-row">
                <button class="key" data-key="\`">\`</button>
                <button class="key" data-key="1">1</button>
                <button class="key" data-key="2">2</button>
                <button class="key" data-key="3">3</button>
                <button class="key" data-key="4">4</button>
                <button class="key" data-key="5">5</button>
                <button class="key" data-key="6">6</button>
                <button class="key" data-key="7">7</button>
                <button class="key" data-key="8">8</button>
                <button class="key" data-key="9">9</button>
                <button class="key" data-key="0">0</button>
                <button class="key" data-key="-">-</button>
                <button class="key" data-key="=">=</button>
                <button class="key wide" data-key="Backspace">Backspace</button>
            </div>
            <div class="keyboard-row">
                <button class="key wide" data-key="Tab">Tab</button>
                <button class="key" data-key="q">Q</button>
                <button class="key" data-key="w">W</button>
                <button class="key" data-key="e">E</button>
                <button class="key" data-key="r">R</button>
                <button class="key" data-key="t">T</button>
                <button class="key" data-key="y">Y</button>
                <button class="key" data-key="u">U</button>
                <button class="key" data-key="i">I</button>
                <button class="key" data-key="o">O</button>
                <button class="key" data-key="p">P</button>
                <button class="key" data-key="[">[</button>
                <button class="key" data-key="]">]</button>
                <button class="key" data-key="\\">\\</button>
            </div>
            <div class="keyboard-row">
                <button class="key extra-wide" data-key="CapsLock">Caps</button>
                <button class="key" data-key="a">A</button>
                <button class="key" data-key="s">S</button>
                <button class="key" data-key="d">D</button>
                <button class="key" data-key="f">F</button>
                <button class="key" data-key="g">G</button>
                <button class="key" data-key="h">H</button>
                <button class="key" data-key="j">J</button>
                <button class="key" data-key="k">K</button>
                <button class="key" data-key="l">L</button>
                <button class="key" data-key=";">;</button>
                <button class="key" data-key="'">'</button>
                <button class="key extra-wide" data-key="Enter">Enter</button>
            </div>
            <div class="keyboard-row">
                <button class="key extra-wide" data-key="Shift">Shift</button>
                <button class="key" data-key="z">Z</button>
                <button class="key" data-key="x">X</button>
                <button class="key" data-key="c">C</button>
                <button class="key" data-key="v">V</button>
                <button class="key" data-key="b">B</button>
                <button class="key" data-key="n">N</button>
                <button class="key" data-key="m">M</button>
                <button class="key" data-key=",">,</button>
                <button class="key" data-key=".">.</button>
                <button class="key" data-key="/">/</button>
                <button class="key extra-wide" data-key="Shift">Shift</button>
            </div>
            <div class="keyboard-row">
                <button class="key" data-key="Control">Ctrl</button>
                <button class="key" data-key="Meta">Cmd</button>
                <button class="key" data-key="Alt">Alt</button>
                <button class="key space" data-key=" ">Space</button>
                <button class="key" data-key="Alt">Alt</button>
                <button class="key" data-key="Meta">Cmd</button>
                <button class="key" data-key="ArrowLeft">←</button>
                <button class="key" data-key="ArrowUp">↑</button>
                <button class="key" data-key="ArrowDown">↓</button>
                <button class="key" data-key="ArrowRight">→</button>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', keyboardHtml);
    
    // Add event listeners to virtual keyboard
    document.querySelectorAll('.key').forEach(key => {
        key.addEventListener('click', async (e) => {
            const keyValue = e.target.getAttribute('data-key');
            
            if (keyValue === 'Control') {
                const { value: nextKey } = await Swal.fire({
                    title: 'Ctrl Combination',
                    input: 'text',
                    inputLabel: 'Enter key to combine with Ctrl',
                    inputPlaceholder: 'e.g., c, v, z',
                    showCancelButton: true,
                    inputValidator: (value) => {
                        if (!value) {
                            return 'You need to enter a key!';
                        }
                    }
                });
                
                if (nextKey) {
                    window.WebSocketModule.sendVirtualKey(`ctrl+${nextKey.toLowerCase()}`);
                }
            } else {
                window.WebSocketModule.sendVirtualKey(keyValue);
            }
        });
    });
}

function initializeUI() {
    createVirtualKeyboard();
}

// Export functions for use in other modules
window.UIModule = {
    showNavigationBar,
    hideNavigationBar,
    goBackToProjectList,
    goBackToSessionsList,
    showVirtualKeyboard,
    hideVirtualKeyboard,
    toggleVirtualKeyboard,
    createVirtualKeyboard,
    initializeUI
};