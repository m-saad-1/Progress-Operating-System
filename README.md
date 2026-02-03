# Progress Operating System

A comprehensive personal productivity operating system built with Electron, React, and TypeScript. Designed to help you manage tasks, track habits, and maintain consistency with a local-first approach.

## Key Features

### ✅ Task Management
- **Smart Daily Reset**: Automatic midnight reset for continuous tasks while preserving history.
- **Task Duration Types**: Support for "Today-only" tasks and "Continuous" multi-day tasks.
- **Intelligent Sorting**: "Today's Tasks" and "Yesterday's Tasks" views to keep you focused.
- **History Tracking**: Complete history preservation without metric inflation.

### 📊 Habit Tracking
- **Monthly Overview**: Visual heatmap and calendar view of habit performance.
- **Smart Marking Rules**: Prevents marking habits before their creation date for accurate analytics.
- **Analytics**: Consistency scores, streak calculations, and trend analysis.

### 🔒 Local & Private
- **Local Database**: Built on SQLite3 for complete data ownership.
- **Offline First**: Works without an internet connection.

## Project Structure

- `main/`: Electron main process code
- `renderer/`: React renderer process code
- `database/`: Database schema and migrations
- `shared/`: Shared types and constants
- `backup/`: Backup related logic
- `sync/`: Synchronization related logic
- `undo/`: Undo/Redo related logic
- `build/`: Build assets (icons, etc.)
- `dist/`: Build output

## Getting Started

1. **Install dependencies:**
   `npm install`

2. **Run the application in development mode:**
   `npm start`

3. **Package the application:**
   `npm run package`

4. **Make installers for the application:**
   `npm run make`

## Scripts

- `npm start`: Starts the Electron application in development mode.
- `npm run package`: Packages the application for your current platform.
- `npm run make`: Creates installers for your current platform.
- `npm run lint`: Lints the TypeScript code.
- `npm run type-check`: Checks TypeScript types.

## Technologies Used

- Electron
- React
- TypeScript
- Tailwind CSS
- Zustand (for state management)
- React Router DOM
- SQLite3 (for local database)

## Contributing

Feel free to contribute to this project. Please open an issue or pull request.

## License

MIT License
