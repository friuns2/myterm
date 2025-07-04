const { exec, execSync } = require('child_process');

// Async execution with callback
function runCommand(command, callback) {
  exec(command, (error, stdout, stderr) => {
    if (error) {
      callback(error, null);
      return;
    }
    callback(null, { stdout: stdout.trim(), stderr: stderr.trim() });
  });
}

// Sync execution
function runCommandSync(command) {
  try {
    const stdout = execSync(command, { encoding: 'utf8' });
    return stdout.trim();
  } catch (error) {
    throw new Error(`Command failed: ${error.message}`);
  }
}

// Promise-based async execution
function runCommandAsync(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}

// Examples
if (require.main === module) {
  // Sync example
  try {
    console.log('Current directory:', runCommandSync('pwd'));
    console.log('Date:', runCommandSync('date'));
  } catch (error) {
    console.error('Sync error:', error.message);
  }

  // Async callback example
  runCommand('ls -la', (error, result) => {
    if (error) {
      console.error('Async error:', error.message);
      return;
    }
    console.log('Directory listing:\n', result.stdout);
  });

  // Promise example
  runCommandAsync('whoami')
    .then(result => console.log('Current user:', result.stdout))
    .catch(error => console.error('Promise error:', error.message));
}

module.exports = { runCommand, runCommandSync, runCommandAsync }; 