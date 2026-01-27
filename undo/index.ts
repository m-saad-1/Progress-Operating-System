import crypto from 'crypto';

export interface Command {
  id: string;
  description: string;
  timestamp: Date;
  execute(): Promise<void>;
  undo(): Promise<void>;
  redo(): Promise<void>;
}

export class CommandManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private maxHistory = 100;
  private isExecuting = false;
  
  async execute(command: Command): Promise<void> {
    if (this.isExecuting) {
      throw new Error('Another command is being executed');
    }
    
    this.isExecuting = true;
    
    try {
      await command.execute();
      this.undoStack.push(command);
      this.redoStack = []; // Clear redo stack on new command
      
      // Limit history size
      if (this.undoStack.length > this.maxHistory) {
        this.undoStack.shift();
      }
      
      console.log(`Command executed: ${command.description}`);
      
    } catch (error) {
      console.error('Command execution failed:', error);
      throw error;
    } finally {
      this.isExecuting = false;
    }
  }
  
  async undo(): Promise<boolean> {
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
    } catch (error) {
      console.error('Undo failed:', error);
      // Restore to stack on error
      if (this.redoStack.length > 0) {
        const lastRedo = this.redoStack.pop();
        if (lastRedo) {
          this.undoStack.push(lastRedo);
        }
      }
      return false;
    } finally {
      this.isExecuting = false;
    }
  }
  
  async redo(): Promise<boolean> {
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
    } catch (error) {
      console.error('Redo failed:', error);
      // Restore to stack on error
      if (this.undoStack.length > 0) {
        const lastUndo = this.undoStack.pop();
        if (lastUndo) {
          this.redoStack.push(lastUndo);
        }
      }
      return false;
    } finally {
      this.isExecuting = false;
    }
  }
  
  canUndo(): boolean {
    return this.undoStack.length > 0 && !this.isExecuting;
  }
  
  canRedo(): boolean {
    return this.redoStack.length > 0 && !this.isExecuting;
  }
  
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    console.log('Command history cleared');
  }
  
  getHistory(): { undo: Command[]; redo: Command[] } {
    return {
      undo: [...this.undoStack],
      redo: [...this.redoStack],
    };
  }
  
  getHistoryStats(): { undoCount: number; redoCount: number } {
    return {
      undoCount: this.undoStack.length,
      redoCount: this.redoStack.length,
    };
  }
  
  getLastCommand(): Command | null {
    return this.undoStack.length > 0 ? this.undoStack[this.undoStack.length - 1] : null;
  }
}

// Concrete command implementations

export class CreateGoalCommand implements Command {
  id: string;
  description: string;
  timestamp: Date;
  
  private goalData: any;
  private goalId: string;
  private db: any;
  
  constructor(goalData: any, db: any) {
    this.id = crypto.randomUUID();
    this.description = `Create goal: ${goalData.title}`;
    this.timestamp = new Date();
    this.goalData = goalData;
    this.db = db;
    this.goalId = crypto.randomUUID();
  }
  
  async execute(): Promise<void> {
    await this.db.insertData('goals', {
      ...this.goalData,
      id: this.goalId,
    });
  }
  
  async undo(): Promise<void> {
    await this.db.deleteData('goals', this.goalId, true);
  }
  
  async redo(): Promise<void> {
    await this.execute();
  }
}

export class UpdateTaskCommand implements Command {
  id: string;
  description: string;
  timestamp: Date;
  
  private taskId: string;
  private updates: any;
  private oldData: any;
  private db: any;
  
  constructor(taskId: string, updates: any, db: any) {
    this.id = crypto.randomUUID();
    this.description = `Update task: ${updates.title || taskId}`;
    this.timestamp = new Date();
    this.taskId = taskId;
    this.updates = updates;
    this.db = db;
    
    // Store current state for undo
    const tasks = this.db.getData('tasks', { id: taskId });
    this.oldData = tasks[0];
  }
  
  async execute(): Promise<void> {
    await this.db.updateData('tasks', this.taskId, this.updates);
  }
  
  async undo(): Promise<void> {
    if (this.oldData) {
      await this.db.updateData('tasks', this.taskId, this.oldData);
    }
  }
  
  async redo(): Promise<void> {
    await this.execute();
  }
}

export class DeleteHabitCommand implements Command {
  id: string;
  description: string;
  timestamp: Date;
  
  private habitId: string;
  private habitData: any;
  private db: any;
  
  constructor(habitId: string, db: any) {
    this.id = crypto.randomUUID();
    
    // Get habit data for description
    const habits = db.getData('habits', { id: habitId });
    const habit = habits[0];
    
    this.description = `Delete habit: ${habit?.title || habitId}`;
    this.timestamp = new Date();
    this.habitId = habitId;
    this.db = db;
    
    // Store current state for undo
    this.habitData = habit;
  }
  
  async execute(): Promise<void> {
    await this.db.deleteData('habits', this.habitId, true);
  }
  
  async undo(): Promise<void> {
    if (this.habitData) {
      // Remove id and timestamps to let database generate new ones
      const { id, created_at, updated_at, deleted_at, ...rest } = this.habitData;
      await this.db.insertData('habits', rest);
    }
  }
  
  async redo(): Promise<void> {
    await this.execute();
  }
}

export class BulkUpdateCommand implements Command {
  id: string;
  description: string;
  timestamp: Date;
  
  private commands: Command[];
  
  constructor(commands: Command[], description: string = 'Bulk update') {
    this.id = crypto.randomUUID();
    this.description = description;
    this.timestamp = new Date();
    this.commands = commands;
  }
  
  async execute(): Promise<void> {
    for (const command of this.commands) {
      await command.execute();
    }
  }
  
  async undo(): Promise<void> {
    // Undo in reverse order
    for (let i = this.commands.length - 1; i >= 0; i--) {
      await this.commands[i].undo();
    }
  }
  
  async redo(): Promise<void> {
    await this.execute();
  }
}

// Command factories for common operations

export class CommandFactory {
  static createGoal(goalData: any, db: any): CreateGoalCommand {
    return new CreateGoalCommand(goalData, db);
  }
  
  static updateTask(taskId: string, updates: any, db: any): UpdateTaskCommand {
    return new UpdateTaskCommand(taskId, updates, db);
  }
  
  static deleteHabit(habitId: string, db: any): DeleteHabitCommand {
    return new DeleteHabitCommand(habitId, db);
  }
  
  static bulkUpdate(commands: Command[], description?: string): BulkUpdateCommand {
    return new BulkUpdateCommand(commands, description);
  }
}

// Singleton instance
let commandManager: CommandManager | null = null;

export function getCommandManager(): CommandManager {
  if (!commandManager) {
    commandManager = new CommandManager();
  }
  return commandManager;
}

// export function setupCommandManager(): void {
//   const manager = getCommandManager();
  
//   // Setup keyboard shortcuts for undo/redo
//   if (typeof window !== 'undefined') {
//     window.addEventListener('keydown', (event) => {
//       if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
//         if (event.shiftKey) {
//           manager.redo();
//         } else {
//           manager.undo();
//         }
//         event.preventDefault();
//       }
      
//       if ((event.ctrlKey || event.metaKey) && event.key === 'y') {
//         manager.redo();
//         event.preventDefault();
//       }
//     });
//   }
// }