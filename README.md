# Personal Operating System (Personal OS)

A sophisticated productivity and personal management desktop application built with modern web technologies. Personal OS empowers users to streamline their workflows with integrated task management, goal tracking, habit monitoring, time management, and comprehensive analytics.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-informational)

## 🌟 Features

### Core Productivity Tools
- **Dashboard** - Central hub with real-time overview of tasks, goals, and metrics
- **Task Management** - Create, organize, and track tasks with priorities and deadlines
- **Goal Tracking** - Set and monitor personal and professional goals with progress visualization
- **Habit Tracker** - Build positive habits with streak tracking and daily check-ins
- **Notes** - Rich text editor for capturing ideas and information

### Time & Analytics
- **Pomodoro Timer** - Built-in productivity timer for focused work sessions
- **Time Tracking** - Monitor time spent on different activities
- **Analytics Dashboard** - Comprehensive productivity metrics and insights
- **Progress Charts** - Visual representation of achievements and trends
- **Monthly Analytics** - In-depth analysis of monthly productivity patterns

### Advanced Features
- **Reviews** - Periodic review system to reflect on progress and plan ahead
- **Archive** - Organize completed and archived items
- **Backup & Sync** - Automatic backup and sync across devices
- **Offline Support** - Full functionality works offline with automatic sync when online
- **Dark/Light Theme** - Customizable appearance with theme picker
- **Context Tips** - Intelligent contextual help throughout the application
- **Command Palette** - Keyboard shortcuts and command search for power users

### User Experience
- **Error Boundaries** - Graceful error handling with recovery options
- **Keyboard Shortcuts** - Complete keyboard navigation support
- **Responsive Design** - Adapts to different window sizes
- **Performance Optimized** - Lazy-loaded pages and optimized asset loading
- **Real-time Sync** - Seamless data synchronization across tabs/windows

## 🏗️ Architecture

### Technology Stack

**Frontend:**
- [React 18](https://react.dev/) - UI library
- [TypeScript](https://www.typescriptlang.org/) - Type-safe JavaScript
- [Vite](https://vitejs.dev/) - Fast build tool and dev server
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [Radix UI](https://www.radix-ui.com/) - Unstyled accessible components
- [React Router](https://reactrouter.com/) - Client-side routing
- [React Query](https://tanstack.com/query/) - Server state management with offline support
- [Recharts](https://recharts.org/) - Composable charting library
- [Lucide React](https://lucide.dev/) - Beautiful SVG icon library

**Desktop:**
- [Electron](https://www.electronjs.org/) - Cross-platform desktop framework
- [Electron Forge](https://www.electronforge.io/) - Build and distribution tooling
- [Webpack](https://webpack.js.org/) - Module bundler

**Backend/IPC:**
- Node.js - Runtime for Electron main process
- IPC (Inter-Process Communication) - Secure communication between processes
- SQLite - Lightweight database for local data storage

### Project Structure

```
PersonalOS/
├── main/                       # Electron main process
│   ├── src/
│   │   ├── index.ts           # Main entry point
│   │   ├── ipc.ts             # IPC event handlers
│   │   ├── preload.ts         # Preload script for secure context
│   │   ├── protocol.ts        # Custom protocol handlers
│   │   ├── updater.ts         # Auto-update functionality
│   │   ├── feedback-service.ts # Feedback collection
│   │   └── database/          # Database management
│   └── package.json
│
├── renderer/                   # React renderer process
│   ├── src/
│   │   ├── pages/             # Page components (Dashboard, Tasks, etc.)
│   │   ├── components/        # Reusable React components
│   │   │   ├── ui/            # Base UI components (Radix UI wrapped)
│   │   │   └── layouts/       # Layout components
│   │   ├── hooks/             # Custom React hooks
│   │   ├── lib/               # Utility libraries
│   │   ├── store/             # State management (Zustand)
│   │   └── App.tsx            # Main App component
│   ├── vite.config.ts         # Vite configuration
│   ├── tailwind.config.ts     # Tailwind configuration
│   └── package.json
│
├── shared/                     # Shared types and constants
├── sync/                       # Sync service utilities
├── undo/                       # Undo/Redo functionality
├── types/                      # Global TypeScript definitions
├── scripts/                    # Build and utility scripts
└── package.json               # Root package configuration
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v16 or higher)
- **pnpm** (v8 or higher) - Fast, disk space efficient package manager
- **Git** - For version control

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/m-saad-1/Progress-Operating-System.git
cd Progress-Operating-System
```

2. **Install dependencies:**
```bash
pnpm install
```

3. **Build shared modules:**
```bash
pnpm run build:undo
pnpm run build:sync
```

### Development

1. **Start the development server:**
```bash
pnpm start
```
This command starts both the Electron main process and the Vite dev server with hot reloading.

2. **Type checking:**
```bash
pnpm run type-check
```

3. **Linting:**
```bash
pnpm run lint
```

### Building

1. **Create application package:**
```bash
pnpm run package
```

2. **Create installers:**
```bash
pnpm run make
```
This generates platform-specific installers in the `out/make/` directory.

### Cleaning

1. **Clean build artifacts:**
```bash
pnpm run clean
```

2. **Clean dependencies (aggressive):**
```bash
pnpm run clean:deps
```

## 📋 Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm start` | Start development with Electron |
| `pnpm run package` | Create application package |
| `pnpm run make` | Generate platform installers |
| `pnpm run clean` | Remove build artifacts and caches |
| `pnpm run clean:deps` | Remove node_modules |
| `pnpm run lint` | Run ESLint on TypeScript files |
| `pnpm run type-check` | Run TypeScript type checking |
| `pnpm run build:undo` | Build undo/redo module |
| `pnpm run build:sync` | Build sync service module |
| `pnpm run electron-rebuild` | Rebuild native modules for Electron |
| `pnpm run feedback:test` | Test SMTP feedback service |
| `pnpm run emailjs:test` | Test EmailJS feedback service |

## 🔌 IPC Communication

The application uses Electron's IPC for secure communication between the main process and renderer process:

**Main Process (main/src/ipc.ts):**
- Event handlers for renderer requests
- Database operations
- File system operations
- System integrations

**Preload Script (main/src/preload.ts):**
- Secure context bridge
- Safe IPC channel exposure
- API definitions for renderer

## 📦 Database

- **Type:** SQLite
- **Location:** Application user data directory
- **Schema:** Defined in `main/src/database/schema.ts`
- **Operations:** Handled in `main/src/database/index.ts`

## 🔐 Security Features

- **Preload Script** - Isolates renderer process from main process
- **Context Isolation** - Enabled for enhanced security
- **Sandbox** - Renderer process runs in sandbox
- **IPC Validation** - All IPC messages are validated
- **CSP Headers** - Content Security Policy configured

## 🌐 Offline Support

The application includes robust offline functionality:
- Local-first data storage
- React Query for intelligent caching
- Automatic sync when connection restored
- Offline indicators and queue management
- Service worker integration ready

## 🎨 Theming

- **Dark Mode** - Complete dark theme support
- **Light Mode** - Clean light theme
- **System Theme** - Auto-detect system preference
- **Custom Colors** - Tailwind CSS for theme customization

## 🧪 Testing

Testing scripts are available for key features:

```bash
# Test EmailJS feedback
pnpm run emailjs:test

# Test SMTP feedback
pnpm run feedback:test
```

## 📚 Documentation

- **IPC Events** - See `main/src/ipc.ts` for available events
- **Database Schema** - See `main/src/database/schema.ts` for data structure
- **Type Definitions** - Comprehensive TypeScript types in `renderer/src/types.ts`
- **Component Library** - Radix UI components with Tailwind styling

## 🔄 State Management

- **Local State** - React hooks for component state
- **Global State** - Zustand store for app-wide state
- **Server State** - React Query for data synchronization
- **Undo/Redo** - Custom undo module for state history

## 🚀 Performance Optimizations

- **Lazy Loading** - Pages are lazy-loaded on route changes
- **Code Splitting** - Webpack bundle optimization
- **Asset Optimization** - Automatic asset relocation in Webpack
- **Efficient Queries** - React Query caching and refetch strategies
- **CSS Purging** - Tailwind purges unused CSS in production

## 📱 Cross-Platform Support

- **Windows** - MSI installer via Squirrel
- **macOS** - DMG distribution
- **Linux** - DEB and RPM packages
- **Code Signing** - macOS entitlements configured

## 🐛 Troubleshooting

### Webpack Error: "Cannot find module"
```bash
pnpm run clean
pnpm install
pnpm start
```

### Electron Not Starting
Ensure all native dependencies are built:
```bash
pnpm run electron-rebuild
```

### Theme Not Changing
Clear app data and restart:
```bash
pnpm run clean
```

## 📝 Environment Configuration

Create a `.env.local` file for local environment variables:
```env
# Example variables (see .env.example)
VITE_API_URL=http://localhost:3000
VITE_APP_NAME=Personal OS
```

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please ensure:
- Code follows the existing style (use `pnpm lint`)
- Types are properly defined (run `pnpm run type-check`)
- Changes are documented

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👨‍💻 Author

**M. Saad**
- GitHub: [@m-saad-1](https://github.com/m-saad-1)
- Project: [Progress Operating System](https://github.com/m-saad-1/Progress-Operating-System)

## 🙏 Acknowledgments

- [Electron](https://www.electronjs.org/) - For the desktop framework
- [React](https://react.dev/) - For the UI library
- [Tailwind CSS](https://tailwindcss.com/) - For styling utilities
- [Radix UI](https://www.radix-ui.com/) - For accessible components
- [Recharts](https://recharts.org/) - For charting components
- All other open-source contributors

## 📞 Support

For support, please:
- Open an [issue on GitHub](https://github.com/m-saad-1/Progress-Operating-System/issues)
- Check existing documentation and FAQ
- Review the help section within the application

## 🎯 Roadmap

Future enhancements planned:
- [ ] Cloud sync integration
- [ ] Mobile app companion
- [ ] Advanced AI-powered scheduling
- [ ] Team collaboration features
- [ ] Plugin system for extensions
- [ ] Advanced calendar integration
- [ ] More visualization options
- [ ] Export/Import utilities

---

**Made with ❤️ for productivity and personal growth**
