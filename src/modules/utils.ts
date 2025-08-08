// Minimal ANSI to HTML converter used for small text snippets, not for xterm
export function ansiToHtml(text: string): string {
  const ansiColors: Record<string, string> = {
    '30': 'color: #000000',
    '31': 'color: #ff0000',
    '32': 'color: #00ff00',
    '33': 'color: #ffff00',
    '34': 'color: #0000ff',
    '35': 'color: #ff00ff',
    '36': 'color: #00ffff',
    '37': 'color: #ffffff',
    '90': 'color: #808080',
    '91': 'color: #ff8080',
    '92': 'color: #80ff80',
    '93': 'color: #ffff80',
    '94': 'color: #8080ff',
    '95': 'color: #ff80ff',
    '96': 'color: #80ffff',
    '97': 'color: #ffffff'
  };

  let result = text;
  let openSpans = 0;

  result = result.replace(/\x1b\[38;2;(\d+);(\d+);(\d+)m/g, (_m, r, g, b) => {
    openSpans++;
    return `<span style="color: rgb(${r}, ${g}, ${b})">`;
  });

  result = result.replace(/\x1b\[(\d+)m/g, (_m, code) => {
    if (code === '0' || code === 'm') {
      const closeSpans = '</span>'.repeat(openSpans);
      openSpans = 0;
      return closeSpans;
    }
    if (ansiColors[code]) {
      openSpans++;
      return `<span style="${ansiColors[code]}">`;
    }
    return '';
  });

  result = result.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
  result += '</span>'.repeat(openSpans);
  return result;
}


