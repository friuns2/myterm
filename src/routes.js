const express = require('express');
const sessionManager = require('./sessionManager');
const projectManager = require('./projectManager');
const fileManager = require('./fileManager');

const router = express.Router();

// Middleware for JSON parsing
router.use(express.json());

// API endpoint to get projects list
router.get('/projects', (req, res) => {
  try {
    const projects = projectManager.getProjects();
    res.json(projects);
  } catch (error) {
    console.error('Error reading projects:', error);
    res.status(500).json({ error: 'Failed to read projects' });
  }
});

// API endpoint to create a new project
router.post('/projects', (req, res) => {
  try {
    const project = projectManager.createProject(req.body.name);
    res.status(201).json(project);
  } catch (error) {
    console.error('Error creating project:', error);
    if (error.message === 'Project name is required') {
      res.status(400).json({ error: error.message });
    } else if (error.message === 'Project already exists') {
      res.status(409).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to create project' });
    }
  }
});

// API endpoint to delete a project
router.delete('/projects/:projectName', (req, res) => {
  try {
    projectManager.deleteProject(req.params.projectName);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting project:', error);
    if (error.message === 'Project not found') {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to delete project' });
    }
  }
});

// API endpoint to get all sessions
router.get('/sessions', (req, res) => {
  try {
    const sessions = sessionManager.getAllSessions();
    res.json(sessions);
  } catch (error) {
    console.error('Error getting sessions:', error);
    res.status(500).json({ error: 'Failed to get sessions' });
  }
});

// API endpoint to delete a session
router.delete('/sessions/:sessionId', (req, res) => {
  try {
    const success = sessionManager.deleteSession(req.params.sessionId);
    if (success) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Session not found' });
    }
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

// API endpoint to get projects with worktrees
router.get('/projects-with-worktrees', async (req, res) => {
  try {
    const projectsWithWorktrees = await projectManager.getProjectsWithWorktrees();
    res.json(projectsWithWorktrees);
  } catch (error) {
    console.error('Error getting projects with worktrees:', error);
    res.status(500).json({ error: 'Failed to get projects with worktrees' });
  }
});

// API endpoint to get worktrees for a specific project
router.get('/projects/:projectName/worktrees', async (req, res) => {
  try {
    const result = await projectManager.getWorktrees(req.params.projectName);
    res.json(result);
  } catch (error) {
    console.error('Error getting worktrees:', error);
    if (error.message === 'Project not found') {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to get worktrees' });
    }
  }
});

// API endpoint to create a new worktree
router.post('/projects/:projectName/worktrees', async (req, res) => {
  try {
    const { worktreeName, branch } = req.body;
    const result = await projectManager.createWorktree(req.params.projectName, worktreeName, branch);
    res.status(201).json(result);
  } catch (error) {
    console.error('Error creating worktree:', error);
    if (error.message.includes('not found') || error.message.includes('not a git repository')) {
      res.status(404).json({ error: error.message });
    } else if (error.message.includes('already exists')) {
      res.status(409).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to create worktree' });
    }
  }
});

// API endpoint to merge a worktree
router.post('/projects/:projectName/worktrees/:worktreeName/merge', async (req, res) => {
  try {
    const { targetBranch } = req.body;
    const result = await projectManager.mergeWorktree(req.params.projectName, req.params.worktreeName, targetBranch);
    res.json(result);
  } catch (error) {
    console.error('Error merging worktree:', error);
    if (error.message === 'Project not found') {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to merge worktree' });
    }
  }
});

// API endpoint to delete a worktree
router.delete('/projects/:projectName/worktrees/:worktreeName', async (req, res) => {
  try {
    const result = await projectManager.deleteWorktree(req.params.projectName, req.params.worktreeName);
    res.json(result);
  } catch (error) {
    console.error('Error deleting worktree:', error);
    if (error.message === 'Project not found') {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to delete worktree' });
    }
  }
});

// API endpoint to get sessions for a specific project
router.get('/projects/:projectName/sessions', (req, res) => {
  try {
    const sessions = sessionManager.getSessionsByProject(req.params.projectName);
    res.json(sessions);
  } catch (error) {
    console.error('Error getting project sessions:', error);
    res.status(500).json({ error: 'Failed to get project sessions' });
  }
});

// API endpoint to browse files and directories
router.get('/browse', (req, res) => {
  try {
    const requestPath = req.query.path || '';
    const result = fileManager.browse(requestPath);
    res.json(result);
  } catch (error) {
    console.error('Error browsing:', error);
    if (error.message === 'Path not found') {
      res.status(404).json({ error: error.message });
    } else if (error.message.includes('Access denied')) {
      res.status(403).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to browse path' });
    }
  }
});

// API endpoint to read a file
router.get('/file', (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }
    
    const result = fileManager.readFile(filePath);
    res.json(result);
  } catch (error) {
    console.error('Error reading file:', error);
    if (error.message === 'File not found' || error.message === 'Path is not a file') {
      res.status(404).json({ error: error.message });
    } else if (error.message === 'File too large to display') {
      res.status(413).json({ error: error.message });
    } else if (error.message.includes('Access denied')) {
      res.status(403).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to read file' });
    }
  }
});

// API endpoint to write a file
router.post('/file', (req, res) => {
  try {
    const { path: filePath, content } = req.body;
    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }
    
    const result = fileManager.writeFile(filePath, content || '');
    res.json(result);
  } catch (error) {
    console.error('Error writing file:', error);
    if (error.message.includes('Access denied')) {
      res.status(403).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to write file' });
    }
  }
});

// API endpoint to create a folder
router.post('/folder', (req, res) => {
  try {
    const { path: folderPath } = req.body;
    if (!folderPath) {
      return res.status(400).json({ error: 'Folder path is required' });
    }
    
    const result = fileManager.createFolder(folderPath);
    res.status(201).json(result);
  } catch (error) {
    console.error('Error creating folder:', error);
    if (error.message === 'Folder already exists') {
      res.status(409).json({ error: error.message });
    } else if (error.message.includes('Access denied')) {
      res.status(403).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to create folder' });
    }
  }
});

module.exports = router;