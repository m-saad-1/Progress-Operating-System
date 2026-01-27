"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandFactory = exports.BulkUpdateCommand = exports.DeleteHabitCommand = exports.UpdateTaskCommand = exports.CreateGoalCommand = exports.CommandManager = void 0;
exports.getCommandManager = getCommandManager;
exports.setupCommandManager = setupCommandManager;
const crypto_1 = __importDefault(require("crypto"));
class CommandManager {
    undoStack = [];
    redoStack = [];
    maxHistory = 100;
    isExecuting = false;
    async execute(command) {
        if (this.isExecuting) {
            throw new Error('Another command is being executed');
        }
        this.isExecuting = true;
        try {
            await command.execute();
            this.undoStack.push(command);
            this.redoStack = [];
            if (this.undoStack.length > this.maxHistory) {
                this.undoStack.shift();
            }
            console.log(`Command executed: ${command.description}`);
        }
        catch (error) {
            console.error('Command execution failed:', error);
            throw error;
        }
        finally {
            this.isExecuting = false;
        }
    }
    async undo() {
        if (this.undoStack.length === 0 || this.isExecuting) {
            return false;
        }
        this.isExecuting = true;
        try {
            const command = this.undoStack.pop();
            if (command) {
                await command.undo();
                this.redoStack.push(command);
                console.log(`Command undone: ${command.description}`);
                return true;
            }
            return false;
        }
        catch (error) {
            console.error('Undo failed:', error);
            if (this.redoStack.length > 0) {
                const lastRedo = this.redoStack.pop();
                if (lastRedo) {
                    this.undoStack.push(lastRedo);
                }
            }
            return false;
        }
        finally {
            this.isExecuting = false;
        }
    }
    async redo() {
        if (this.redoStack.length === 0 || this.isExecuting) {
            return false;
        }
        this.isExecuting = true;
        try {
            const command = this.redoStack.pop();
            if (command) {
                await command.redo();
                this.undoStack.push(command);
                console.log(`Command redone: ${command.description}`);
                return true;
            }
            return false;
        }
        catch (error) {
            console.error('Redo failed:', error);
            if (this.undoStack.length > 0) {
                const lastUndo = this.undoStack.pop();
                if (lastUndo) {
                    this.redoStack.push(lastUndo);
                }
            }
            return false;
        }
        finally {
            this.isExecuting = false;
        }
    }
    canUndo() {
        return this.undoStack.length > 0 && !this.isExecuting;
    }
    canRedo() {
        return this.redoStack.length > 0 && !this.isExecuting;
    }
    clear() {
        this.undoStack = [];
        this.redoStack = [];
        console.log('Command history cleared');
    }
    getHistory() {
        return {
            undo: [...this.undoStack],
            redo: [...this.redoStack],
        };
    }
    getHistoryStats() {
        return {
            undoCount: this.undoStack.length,
            redoCount: this.redoStack.length,
        };
    }
    getLastCommand() {
        return this.undoStack.length > 0 ? this.undoStack[this.undoStack.length - 1] : null;
    }
}
exports.CommandManager = CommandManager;
class CreateGoalCommand {
    id;
    description;
    timestamp;
    goalData;
    goalId;
    db;
    constructor(goalData, db) {
        this.id = crypto_1.default.randomUUID();
        this.description = `Create goal: ${goalData.title}`;
        this.timestamp = new Date();
        this.goalData = goalData;
        this.db = db;
        this.goalId = crypto_1.default.randomUUID();
    }
    async execute() {
        await this.db.insertData('goals', {
            ...this.goalData,
            id: this.goalId,
        });
    }
    async undo() {
        await this.db.deleteData('goals', this.goalId, true);
    }
    async redo() {
        await this.execute();
    }
}
exports.CreateGoalCommand = CreateGoalCommand;
class UpdateTaskCommand {
    id;
    description;
    timestamp;
    taskId;
    updates;
    oldData;
    db;
    constructor(taskId, updates, db) {
        this.id = crypto_1.default.randomUUID();
        this.description = `Update task: ${updates.title || taskId}`;
        this.timestamp = new Date();
        this.taskId = taskId;
        this.updates = updates;
        this.db = db;
        const tasks = this.db.getData('tasks', { id: taskId });
        this.oldData = tasks[0];
    }
    async execute() {
        await this.db.updateData('tasks', this.taskId, this.updates);
    }
    async undo() {
        if (this.oldData) {
            await this.db.updateData('tasks', this.taskId, this.oldData);
        }
    }
    async redo() {
        await this.execute();
    }
}
exports.UpdateTaskCommand = UpdateTaskCommand;
class DeleteHabitCommand {
    id;
    description;
    timestamp;
    habitId;
    habitData;
    db;
    constructor(habitId, db) {
        this.id = crypto_1.default.randomUUID();
        const habits = db.getData('habits', { id: habitId });
        const habit = habits[0];
        this.description = `Delete habit: ${habit?.title || habitId}`;
        this.timestamp = new Date();
        this.habitId = habitId;
        this.db = db;
        this.habitData = habit;
    }
    async execute() {
        await this.db.deleteData('habits', this.habitId, true);
    }
    async undo() {
        if (this.habitData) {
            const { id, created_at, updated_at, deleted_at, ...rest } = this.habitData;
            await this.db.insertData('habits', rest);
        }
    }
    async redo() {
        await this.execute();
    }
}
exports.DeleteHabitCommand = DeleteHabitCommand;
class BulkUpdateCommand {
    id;
    description;
    timestamp;
    commands;
    constructor(commands, description = 'Bulk update') {
        this.id = crypto_1.default.randomUUID();
        this.description = description;
        this.timestamp = new Date();
        this.commands = commands;
    }
    async execute() {
        for (const command of this.commands) {
            await command.execute();
        }
    }
    async undo() {
        for (let i = this.commands.length - 1; i >= 0; i--) {
            await this.commands[i].undo();
        }
    }
    async redo() {
        await this.execute();
    }
}
exports.BulkUpdateCommand = BulkUpdateCommand;
class CommandFactory {
    static createGoal(goalData, db) {
        return new CreateGoalCommand(goalData, db);
    }
    static updateTask(taskId, updates, db) {
        return new UpdateTaskCommand(taskId, updates, db);
    }
    static deleteHabit(habitId, db) {
        return new DeleteHabitCommand(habitId, db);
    }
    static bulkUpdate(commands, description) {
        return new BulkUpdateCommand(commands, description);
    }
}
exports.CommandFactory = CommandFactory;
let commandManager = null;
function getCommandManager() {
    if (!commandManager) {
        commandManager = new CommandManager();
    }
    return commandManager;
}
function setupCommandManager() {
    const manager = getCommandManager();
    if (typeof window !== 'undefined') {
        window.addEventListener('keydown', (event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
                if (event.shiftKey) {
                    manager.redo();
                }
                else {
                    manager.undo();
                }
                event.preventDefault();
            }
            if ((event.ctrlKey || event.metaKey) && event.key === 'y') {
                manager.redo();
                event.preventDefault();
            }
        });
    }
}
//# sourceMappingURL=index.js.map