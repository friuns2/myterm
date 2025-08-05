const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');
const config = require('./config');

class ProjectManager {
  constructor() {
    this.projectsDir = config.PROJECTS_DIR;
  }

  ensureProjectsDir() {
    if (!fs.existsSync(this.projectsDir)) {
      fs.mkdirSync(this.projectsDir, { recursive: true });
    }
  }

  getProjects() {
    this.ensureProjectsDir();
    return fs.readdirSync(this.projectsDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
  }

  createProject(name) {
    if (!name || typeof name !== 'string' || name.trim() === '') {
      throw new Error('Project name is required');
    }
    
    const projectPath = path.join(this.projectsDir, name.trim());
    if (fs.existsSync(projectPath)) {
      throw new Error('Project already exists');
    }
    
    fs.mkdirSync(projectPath, { recursive: true });
    
    // Create a README file
    const readmePath = path.join(projectPath, 'README.md');
    const readmeContent = `# ${name.trim()}\n\nProject created on ${new Date().toISOString()}\n`;
    fs.writeFileSync(readmePath, readmeContent);
    
    return { name: name.trim(), path: projectPath };
  }

  deleteProject(projectName) {
    const projectPath = path.join(this.projectsDir, projectName);
    if (!fs.existsSync(projectPath)) {
      throw new Error('Project not found');
    }
    
    fs.rmSync(projectPath, { recursive: true, force: true });
  }

  getProjectsWithWorktrees() {
    return new Promise((resolve, reject) => {
      this.ensureProjectsDir();
      const projects = this.getProjects();
      const projectsWithWorktrees = [];
      let completed = 0;

      if (projects.length === 0) {
        return resolve([]);
      }

      projects.forEach(projectName => {
        const projectPath = path.join(this.projectsDir, projectName);
        
        // Check if it's a git repository
        const gitPath = path.join(projectPath, '.git');
        if (!fs.existsSync(gitPath)) {
          projectsWithWorktrees.push({
            name: projectName,
            isGitRepo: false,
            worktrees: []
          });
          completed++;
          if (completed === projects.length) {
            resolve(projectsWithWorktrees);
          }
          return;
        }

        // Get worktrees for git repository
        exec('git worktree list --porcelain', { cwd: projectPath }, (error, stdout, stderr) => {
          const worktrees = [];
          
          if (!error && stdout) {
            const lines = stdout.trim().split('\n');
            let currentWorktree = {};
            
            lines.forEach(line => {
              if (line.startsWith('worktree ')) {
                if (Object.keys(currentWorktree).length > 0) {
                  worktrees.push(currentWorktree);
                }
                currentWorktree = {
                  path: line.substring(9),
                  branch: null,
                  head: null,
                  bare: false,
                  detached: false
                };
              } else if (line.startsWith('HEAD ')) {
                currentWorktree.head = line.substring(4);
              } else if (line.startsWith('branch ')) {
                currentWorktree.branch = line.substring(7);
              } else if (line === 'bare') {
                currentWorktree.bare = true;
              } else if (line === 'detached') {
                currentWorktree.detached = true;
              }
            });
            
            if (Object.keys(currentWorktree).length > 0) {
              worktrees.push(currentWorktree);
            }
          }
          
          projectsWithWorktrees.push({
            name: projectName,
            isGitRepo: true,
            worktrees: worktrees
          });
          
          completed++;
          if (completed === projects.length) {
            resolve(projectsWithWorktrees);
          }
        });
      });
    });
  }

  getWorktrees(projectName) {
    return new Promise((resolve, reject) => {
      const projectPath = path.join(this.projectsDir, projectName);
      
      if (!fs.existsSync(projectPath)) {
        return reject(new Error('Project not found'));
      }

      const gitPath = path.join(projectPath, '.git');
      if (!fs.existsSync(gitPath)) {
        return resolve({ isGitRepo: false, worktrees: [] });
      }

      exec('git worktree list --porcelain', { cwd: projectPath }, (error, stdout, stderr) => {
        if (error) {
          return reject(new Error(`Git error: ${stderr || error.message}`));
        }

        const worktrees = [];
        if (stdout) {
          const lines = stdout.trim().split('\n');
          let currentWorktree = {};
          
          lines.forEach(line => {
            if (line.startsWith('worktree ')) {
              if (Object.keys(currentWorktree).length > 0) {
                worktrees.push(currentWorktree);
              }
              currentWorktree = {
                path: line.substring(9),
                branch: null,
                head: null,
                bare: false,
                detached: false
              };
            } else if (line.startsWith('HEAD ')) {
              currentWorktree.head = line.substring(4);
            } else if (line.startsWith('branch ')) {
              currentWorktree.branch = line.substring(7);
            } else if (line === 'bare') {
              currentWorktree.bare = true;
            } else if (line === 'detached') {
              currentWorktree.detached = true;
            }
          });
          
          if (Object.keys(currentWorktree).length > 0) {
            worktrees.push(currentWorktree);
          }
        }
        
        resolve({ isGitRepo: true, worktrees });
      });
    });
  }

  createWorktree(projectName, worktreeName, branch) {
    return new Promise((resolve, reject) => {
      const projectPath = path.join(this.projectsDir, projectName);
      
      if (!fs.existsSync(projectPath)) {
        return reject(new Error('Project not found'));
      }

      const gitPath = path.join(projectPath, '.git');
      if (!fs.existsSync(gitPath)) {
        return reject(new Error('Project is not a git repository'));
      }

      const worktreePath = path.join(projectPath, '..', `${projectName}-${worktreeName}`);
      
      if (fs.existsSync(worktreePath)) {
        return reject(new Error('Worktree directory already exists'));
      }

      const command = branch ? 
        `git worktree add "${worktreePath}" -b "${worktreeName}" "${branch}"` :
        `git worktree add "${worktreePath}" -b "${worktreeName}"`;

      exec(command, { cwd: projectPath }, (error, stdout, stderr) => {
        if (error) {
          return reject(new Error(`Git error: ${stderr || error.message}`));
        }
        resolve({ worktreeName, path: worktreePath, branch: worktreeName });
      });
    });
  }

  mergeWorktree(projectName, worktreeName, targetBranch) {
    return new Promise((resolve, reject) => {
      const projectPath = path.join(this.projectsDir, projectName);
      
      if (!fs.existsSync(projectPath)) {
        return reject(new Error('Project not found'));
      }

      const commands = [
        `git checkout "${targetBranch}"`,
        `git merge "${worktreeName}"`,
        'git push origin HEAD'
      ];

      let currentCommand = 0;
      
      const executeCommand = () => {
        if (currentCommand >= commands.length) {
          return resolve({ success: true, message: 'Merge completed successfully' });
        }
        
        exec(commands[currentCommand], { cwd: projectPath }, (error, stdout, stderr) => {
          if (error) {
            return reject(new Error(`Git error at step ${currentCommand + 1}: ${stderr || error.message}`));
          }
          currentCommand++;
          executeCommand();
        });
      };
      
      executeCommand();
    });
  }

  deleteWorktree(projectName, worktreeName) {
    return new Promise((resolve, reject) => {
      const projectPath = path.join(this.projectsDir, projectName);
      
      if (!fs.existsSync(projectPath)) {
        return reject(new Error('Project not found'));
      }

      const worktreePath = path.join(projectPath, '..', `${projectName}-${worktreeName}`);
      
      exec(`git worktree remove "${worktreePath}"`, { cwd: projectPath }, (error, stdout, stderr) => {
        if (error) {
          return reject(new Error(`Git error: ${stderr || error.message}`));
        }
        resolve({ success: true });
      });
    });
  }
}

module.exports = new ProjectManager();