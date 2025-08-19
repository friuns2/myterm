# MyShell25 - Web-Based Terminal Emulator

A modern, web-based terminal emulator with PTY support that provides a full-featured shell experience through your browser. Built with Node.js, Express, and WebSocket technology.

## 🚀 Features

- **Full PTY Support**: Compatible with interactive applications like nano, tmux, vim, and more
- **Web-Based Interface**: Access your terminal from any modern web browser
- **File Management**: Built-in file browser with upload/download capabilities
- **Project Management**: Organize and manage multiple projects and sessions
- **Git Worktrees Support**: Advanced Git worktree management
- **Real-time Terminal**: WebSocket-based real-time terminal communication
- **Security**: Basic authentication middleware for secure access
- **Responsive Design**: Modern UI built with Tailwind CSS and DaisyUI
- **Auto Port Generation**: Automatically generates unique ports based on directory hash

## 📋 Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Unix-like operating system (Linux, macOS)

## 🛠️ Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd myshell25
```

2. Install dependencies:
```bash
npm install
```

3. Create environment configuration (optional):
```bash
cp .env.example .env
# Edit .env with your preferred settings
```

## 🚀 Usage

### Starting the Server

```bash
npm start
```

The server will automatically generate a unique port based on your current directory and start listening on `0.0.0.0:<generated-port>`.

### Accessing the Terminal

1. Open your web browser
2. Navigate to `http://localhost:<generated-port>`
3. Enter your authentication credentials if prompted
4. Start using the terminal interface

### Available Scripts

- `npm start` - Start the production server
- `npm run ngrok` - Expose the server via ngrok tunnel

## 🏗️ Project Structure

```
myshell25/
├── middleware/          # Authentication and security middleware
├── public/             # Frontend static files
│   ├── index.html     # Main web interface
│   ├── script.js      # Frontend JavaScript
│   ├── style.css      # Custom styles
│   └── ...            # Other frontend assets
├── routes/            # Express.js API routes
│   ├── files.js       # File management endpoints
│   ├── projects.js    # Project management
│   ├── sessions.js    # Session handling
│   ├── settings.js    # Application settings
│   └── worktrees.js   # Git worktree management
├── settings/          # Configuration files
│   ├── rules.txt      # Application rules
│   └── settings.zsh   # Shell configuration
├── websocket/         # WebSocket handlers
│   └── terminal.js    # Terminal WebSocket implementation
├── server.js          # Main server file
└── package.json       # Project dependencies
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Basic Authentication (optional)
BASIC_AUTH_USERNAME=your_username
BASIC_AUTH_PASSWORD=your_password

# Custom port (optional - overrides auto-generation)
PORT=3551
```

### Shell Settings

The application includes shell configuration in `settings/settings.zsh` that provides additional functionality and aliases.

## 🌐 API Endpoints

- `GET /api/projects` - List all projects
- `GET /api/sessions` - Manage terminal sessions
- `GET /api/files` - File system operations
- `GET /api/worktrees` - Git worktree management
- `GET /api/settings` - Application settings
- `GET /api/predictions` - Command predictions and suggestions

## 🔒 Security Features

- Basic HTTP authentication
- Request validation middleware
- Secure WebSocket upgrade handling
- File upload restrictions

## 🎨 Frontend Features

- **Modern UI**: Built with Tailwind CSS and DaisyUI
- **Dark Theme**: Optimized for terminal usage
- **File Browser**: Integrated file management interface
- **Responsive Design**: Works on desktop and mobile devices
- **Real-time Updates**: Live terminal output via WebSocket

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🐛 Troubleshooting

### Common Issues

1. **Port already in use**: The application generates unique ports, but if you encounter conflicts, set a custom `PORT` in your `.env` file.

2. **PTY not working**: Ensure you're running on a Unix-like system with proper PTY support.

3. **Authentication issues**: Check your `.env` file for correct `BASIC_AUTH_USERNAME` and `BASIC_AUTH_PASSWORD` values.

4. **WebSocket connection failed**: Verify that your firewall allows the generated port and WebSocket connections.

## 🔮 Future Enhancements

- [ ] Multi-user support
- [ ] Session persistence
- [ ] Plugin system
- [ ] Advanced file editor integration
- [ ] Docker support
- [ ] Cloud deployment options

## 📞 Support

For support, please open an issue on the GitHub repository or contact the maintainers.

---

**Note**: This is a powerful tool that provides shell access through a web interface. Use responsibly and ensure proper security measures are in place when deploying in production environments.