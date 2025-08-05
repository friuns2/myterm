// API client module
class APIClient {
    constructor() {
        this.baseURL = '';
    }

    // Generic fetch wrapper with error handling
    async request(url, options = {}) {
        try {
            const response = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            } else {
                return await response.text();
            }
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    // Project management APIs
    async getProjects() {
        return await this.request('/api/projects');
    }

    async createProject(projectName) {
        return await this.request('/api/projects', {
            method: 'POST',
            body: JSON.stringify({ name: projectName })
        });
    }

    // Worktree management APIs
    async getWorktrees(projectName) {
        return await this.request(`/api/projects/${encodeURIComponent(projectName)}/worktrees`);
    }

    async createWorktree(projectName, worktreeName, branch) {
        return await this.request(`/api/projects/${encodeURIComponent(projectName)}/worktrees`, {
            method: 'POST',
            body: JSON.stringify({ name: worktreeName, branch: branch })
        });
    }

    async openWorktree(projectName, worktreeName) {
        return await this.request(`/api/projects/${encodeURIComponent(projectName)}/worktrees/${encodeURIComponent(worktreeName)}/open`, {
            method: 'POST'
        });
    }

    async mergeWorktree(projectName, worktreeName) {
        return await this.request(`/api/projects/${encodeURIComponent(projectName)}/worktrees/${encodeURIComponent(worktreeName)}/merge`, {
            method: 'POST'
        });
    }

    async deleteWorktree(projectName, worktreeName) {
        return await this.request(`/api/projects/${encodeURIComponent(projectName)}/worktrees/${encodeURIComponent(worktreeName)}`, {
            method: 'DELETE'
        });
    }

    // Session management APIs
    async getSessions(projectName) {
        return await this.request(`/api/projects/${encodeURIComponent(projectName)}/sessions`);
    }

    async killSession(projectName, sessionID) {
        return await this.request(`/api/projects/${encodeURIComponent(projectName)}/sessions/${encodeURIComponent(sessionID)}`, {
            method: 'DELETE'
        });
    }

    // File browser APIs
    async browseDirectory(projectName, path = '') {
        const encodedPath = encodeURIComponent(path);
        return await this.request(`/api/projects/${encodeURIComponent(projectName)}/browse?path=${encodedPath}`);
    }

    async readFile(projectName, filePath) {
        const encodedPath = encodeURIComponent(filePath);
        return await this.request(`/api/projects/${encodeURIComponent(projectName)}/files?path=${encodedPath}`);
    }

    async saveFile(projectName, filePath, content) {
        return await this.request(`/api/projects/${encodeURIComponent(projectName)}/files`, {
            method: 'POST',
            body: JSON.stringify({ path: filePath, content: content })
        });
    }

    async createFolder(projectName, folderPath) {
        return await this.request(`/api/projects/${encodeURIComponent(projectName)}/folders`, {
            method: 'POST',
            body: JSON.stringify({ path: folderPath })
        });
    }

    // Utility methods for handling responses
    async handleResponse(response, successMessage, errorMessage) {
        try {
            const result = await response;
            if (successMessage) {
                console.log(successMessage, result);
            }
            return result;
        } catch (error) {
            if (errorMessage) {
                console.error(errorMessage, error);
            }
            throw error;
        }
    }

    // Batch operations
    async batchRequest(requests) {
        try {
            const promises = requests.map(req => this.request(req.url, req.options));
            return await Promise.all(promises);
        } catch (error) {
            console.error('Batch request failed:', error);
            throw error;
        }
    }

    // Upload file (for future use)
    async uploadFile(projectName, file, path) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('path', path);

        return await this.request(`/api/projects/${encodeURIComponent(projectName)}/upload`, {
            method: 'POST',
            body: formData,
            headers: {} // Let browser set Content-Type for FormData
        });
    }

    // Download file (for future use)
    async downloadFile(projectName, filePath) {
        const encodedPath = encodeURIComponent(filePath);
        const response = await fetch(`/api/projects/${encodeURIComponent(projectName)}/download?path=${encodedPath}`);
        
        if (!response.ok) {
            throw new Error(`Download failed: ${response.status}`);
        }
        
        return response.blob();
    }
}

// Create global instance
window.apiClient = new APIClient();