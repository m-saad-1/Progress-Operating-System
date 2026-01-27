class ProgressApp {
    constructor() {
        this.data = null;
        this.loadData();
        this.setupEventListeners();
        this.initializeApp();
    }

    async loadData() {
        try {
            const result = await window.electron.invoke('load-data');
            if (result.success) {
                this.data = result.data;
                this.renderDashboard();
            } else {
                console.error('Failed to load data:', result.error);
                this.showError('Failed to load data. Starting with fresh data.');
                this.data = this.createEmptyData();
            }
        } catch (error) {
            console.error('Error loading data:', error);
            this.data = this.createEmptyData();
        }
    }

    async saveData() {
        try {
            this.data.lastUpdated = new Date().toISOString();
            const result = await window.electron.invoke('save-data', this.data);
            if (!result.success) {
                console.error('Failed to save data:', result.error);
                this.showError('Failed to save data. Please check storage permissions.');
            }
        } catch (error) {
            console.error('Error saving data:', error);
        }
    }

    createEmptyData() {
        return {
            version: '1.0.0',
            lastUpdated: new Date().toISOString(),
            user: {
                name: 'User',
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                weekStart: 'monday',
                theme: 'dark'
            },
            goals: [],
            tasks: [],
            habits: [],
            notes: [],
            backups: []
        };
    }

    setupEventListeners() {
        // Auto-save on changes
        ['goals', 'tasks', 'habits', 'notes'].forEach(key => {
            this.data[key] = new Proxy(this.data[key], {
                set: (target, property, value) => {
                    target[property] = value;
                    this.saveData();
                    return true;
                }
            });
        });

        // Setup keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key.toLowerCase()) {
                    case 'n':
                        e.preventDefault();
                        if (this.currentSection === 'tasks') addTask();
                        else if (this.currentSection === 'goals') addGoal();
                        else if (this.currentSection === 'habits') addHabit();
                        break;
                    case 's':
                        e.preventDefault();
                        this.saveData();
                        this.showToast('Data saved successfully!');
                        break;
                    case 'e':
                        e.preventDefault();
                        exportData();
                        break;
                }
            }
        });
    }

    initializeApp() {
        // Set today's date in date inputs
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('taskDueDate').value = today;
        document.getElementById('goalStartDate').value = today;
        
        // Initialize charts
        this.initializeCharts();
        
        // Start periodic auto-save
        setInterval(() => this.saveData(), 60000); // Save every minute
        
        // Setup habit check auto-update
        this.setupHabitAutoUpdate();
    }

    initializeCharts() {
        // Initialize progress charts
        this.weeklyChart = new Chart(document.getElementById('weeklyChart'), {
            type: 'line',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'Task Completion',
                    data: [0, 0, 0, 0, 0, 0, 0],
                    borderColor: '#4F46E5',
                    backgroundColor: 'rgba(79, 70, 229, 0.1)'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }

    setupHabitAutoUpdate() {
        // Check and update streaks daily
        const lastCheck = localStorage.getItem('lastHabitCheck');
        const today = new Date().toDateString();
        
        if (lastCheck !== today) {
            this.updateHabitStreaks();
            localStorage.setItem('lastHabitCheck', today);
        }
    }

    updateHabitStreaks() {
        this.data.habits.forEach(habit => {
            const lastCompletion = habit.completions?.[habit.completions.length - 1];
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            
            if (lastCompletion && new Date(lastCompletion.date).toDateString() === yesterday.toDateString()) {
                if (lastCompletion.completed) {
                    habit.streak++;
                    if (habit.streak > habit.longestStreak) {
                        habit.longestStreak = habit.streak;
                    }
                } else {
                    habit.streak = 0;
                }
            }
        });
        this.saveData();
    }

    renderDashboard() {
        if (!this.data) return;

        const today = new Date().toISOString().split('T')[0];
        
        // Update counters
        const todayTasks = this.data.tasks.filter(task => 
            task.dueDate === today && task.status !== 'completed'
        ).length;
        
        const activeGoals = this.data.goals.filter(goal => 
            goal.status === 'active'
        ).length;
        
        const maxStreak = this.data.habits.reduce((max, habit) => 
            Math.max(max, habit.streak || 0), 0
        );
        
        const completedTasks = this.data.tasks.filter(task => 
            task.status === 'completed'
        ).length;
        
        const completionRate = this.data.tasks.length > 0 
            ? Math.round((completedTasks / this.data.tasks.length) * 100) 
            : 0;
        
        document.getElementById('today-tasks-count').textContent = todayTasks;
        document.getElementById('active-goals-count').textContent = activeGoals;
        document.getElementById('habit-streak').textContent = maxStreak;
        document.getElementById('completion-rate').textContent = `${completionRate}%`;
        
        // Render today's tasks
        this.renderTodayTasks(today);
        
        // Render active goals
        this.renderActiveGoals();
        
        // Render today's habits
        this.renderTodayHabits(today);
        
        // Update progress bars
        this.updateProgressBars();
    }

    renderTodayTasks(today) {
        const container = document.getElementById('today-tasks');
        const tasks = this.data.tasks.filter(task => 
            task.dueDate === today && task.status !== 'completed'
        ).sort((a, b) => {
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });
        
        if (tasks.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4 text-muted">
                    <i class="fas fa-check-circle fa-2x mb-3"></i>
                    <p>No tasks for today!</p>
                    <button class="btn btn-sm btn-primary" onclick="addTask()">
                        <i class="fas fa-plus"></i> Add a task
                    </button>
                </div>
            `;
            return;
        }
        
        container.innerHTML = tasks.map(task => `
            <div class="task-item d-flex align-items-center justify-content-between p-3 priority-${task.priority}">
                <div class="d-flex align-items-center">
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" 
                               onchange="completeTask('${task.id}')"
                               ${task.status === 'completed' ? 'checked' : ''}>
                    </div>
                    <div class="ms-3">
                        <h6 class="mb-0">${task.title}</h6>
                        ${task.description ? `<small class="text-muted">${task.description}</small>` : ''}
                    </div>
                </div>
                <div class="d-flex align-items-center gap-2">
                    <span class="status-badge status-${task.status || 'pending'}">
                        ${(task.status || 'pending').replace('-', ' ')}
                    </span>
                    ${task.estimatedTime ? `<small class="text-muted"><i class="far fa-clock"></i> ${task.estimatedTime}m</small>` : ''}
                    <button class="btn btn-sm btn-outline-secondary" onclick="editTask('${task.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    renderActiveGoals() {
        const container = document.getElementById('active-goals');
        const goals = this.data.goals.filter(goal => goal.status === 'active');
        
        if (goals.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4 text-muted">
                    <i class="fas fa-bullseye fa-2x mb-3"></i>
                    <p>No active goals!</p>
                    <button class="btn btn-sm btn-primary" onclick="addGoal()">
                        <i class="fas fa-plus"></i> Create a goal
                    </button>
                </div>
            `;
            return;
        }
        
        container.innerHTML = goals.map(goal => `
            <div class="mb-3">
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <h6 class="mb-0">${goal.title}</h6>
                    <span class="badge bg-${this.getCategoryColor(goal.category)}">${goal.category}</span>
                </div>
                <div class="progress">
                    <div class="progress-bar" style="width: ${goal.progress || 0}%">
                        ${goal.progress || 0}%
                    </div>
                </div>
                <div class="d-flex justify-content-between mt-1">
                    <small class="text-muted">Started: ${new Date(goal.startDate).toLocaleDateString()}</small>
                    <small class="text-muted">${goal.targetDate ? `Target: ${new Date(goal.targetDate).toLocaleDateString()}` : 'No deadline'}</small>
                </div>
            </div>
        `).join('');
    }

    renderTodayHabits(today) {
        const container = document.getElementById('today-habits');
        const habits = this.data.habits.filter(habit => 
            habit.frequency === 'daily' || 
            (habit.frequency === 'weekly' && new Date().getDay().toString() === habit.schedule)
        );
        
        if (habits.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4 text-muted">
                    <i class="fas fa-repeat fa-2x mb-3"></i>
                    <p>No habits for today!</p>
                    <button class="btn btn-sm btn-primary" onclick="addHabit()">
                        <i class="fas fa-plus"></i> Create a habit
                    </button>
                </div>
            `;
            return;
        }
        
        container.innerHTML = habits.map(habit => {
            const isCompleted = habit.completions?.some(c => c.date === today && c.completed);
            return `
                <div class="d-flex align-items-center justify-content-between p-2 mb-2 border rounded">
                    <div class="d-flex align-items-center">
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" 
                                   onchange="toggleHabitCompletion('${habit.id}', this.checked)"
                                   ${isCompleted ? 'checked' : ''}>
                        </div>
                        <div class="ms-3">
                            <h6 class="mb-0">${habit.title}</h6>
                            <small class="text-muted">${habit.category}</small>
                        </div>
                    </div>
                    <div class="d-flex align-items-center gap-2">
                        <span class="habit-streak">
                            <i class="fas fa-fire"></i> ${habit.streak || 0}
                        </span>
                        <small class="text-muted">${habit.time}</small>
                    </div>
                </div>
            `;
        }).join('');
    }

    updateProgressBars() {
        // Weekly progress (mock data for now)
        const weeklyProgress = Math.min(100, (this.data.tasks.filter(t => t.status === 'completed').length / 20) * 100);
        document.getElementById('weekly-progress').style.width = `${weeklyProgress}%`;
        
        // Goal progress
        const goalProgress = this.data.goals.length > 0 
            ? this.data.goals.reduce((sum, goal) => sum + (goal.progress || 0), 0) / this.data.goals.length
            : 0;
        document.getElementById('goal-progress').style.width = `${goalProgress}%`;
        
        // Habit consistency
        const habitConsistency = this.data.habits.length > 0
            ? this.data.habits.reduce((sum, habit) => sum + (habit.consistency || 0), 0) / this.data.habits.length
            : 0;
        document.getElementById('habit-consistency').style.width = `${habitConsistency}%`;
    }

    getCategoryColor(category) {
        const colors = {
            career: 'primary',
            health: 'success',
            learning: 'info',
            finance: 'warning',
            personal: 'danger'
        };
        return colors[category] || 'secondary';
    }

    showError(message) {
        const alert = document.createElement('div');
        alert.className = 'alert alert-danger alert-dismissible fade show position-fixed top-0 end-0 m-3';
        alert.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        document.body.appendChild(alert);
        setTimeout(() => alert.remove(), 5000);
    }

    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast align-items-center text-bg-${type} border-0 position-fixed bottom-0 end-0 m-3`;
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;
        document.body.appendChild(toast);
        new bootstrap.Toast(toast).show();
        setTimeout(() => toast.remove(), 3000);
    }
}

// Global app instance
let app;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    app = new ProgressApp();
    
    // Check if we're in Electron
    if (typeof window.electron !== 'undefined') {
        console.log('Running in Electron environment');
    } else {
        console.warn('Not running in Electron. Some features may not work.');
        // Mock electron API for browser testing
        window.electron = {
            invoke: async (method, ...args) => {
                console.log(`Mock electron call: ${method}`, args);
                // Mock implementations for testing
                switch(method) {
                    case 'save-data':
                        localStorage.setItem('progress-data', JSON.stringify(args[0]));
                        return { success: true };
                    case 'load-data':
                        const data = localStorage.getItem('progress-data');
                        return { 
                            success: true, 
                            data: data ? JSON.parse(data) : app.createEmptyData() 
                        };
                    default:
                        return { success: false, error: 'Not implemented in mock' };
                }
            }
        };
    }
});

// UI Functions
function showSection(section) {
    document.querySelectorAll('.section').forEach(s => s.classList.add('d-none'));
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    
    document.getElementById(`${section}-section`).classList.remove('d-none');
    event.target.classList.add('active');
    app.currentSection = section;
}

function addTask() {
    document.getElementById('taskTitle').value = '';
    document.getElementById('taskDescription').value = '';
    document.getElementById('taskDueDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('taskPriority').value = 'medium';
    document.getElementById('taskEstimate').value = '';
    
    const modal = new bootstrap.Modal(document.getElementById('taskModal'));
    modal.show();
}

function saveTask() {
    const task = {
        id: uuidv4(),
        title: document.getElementById('taskTitle').value,
        description: document.getElementById('taskDescription').value,
        dueDate: document.getElementById('taskDueDate').value,
        priority: document.getElementById('taskPriority').value,
        estimatedTime: document.getElementById('taskEstimate').value ? parseInt(document.getElementById('taskEstimate').value) : null,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    app.data.tasks.push(task);
    app.saveData();
    app.renderDashboard();
    
    bootstrap.Modal.getInstance(document.getElementById('taskModal')).hide();
    app.showToast('Task added successfully!');
}

function addGoal() {
    document.getElementById('goalTitle').value = '';
    document.getElementById('goalDescription').value = '';
    document.getElementById('goalCategory').value = 'personal';
    document.getElementById('goalStartDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('goalTargetDate').value = '';
    document.getElementById('goalPriority').value = 'medium';
    document.getElementById('goalReview').value = 'weekly';
    document.getElementById('goalMotivation').value = '';
    
    const modal = new bootstrap.Modal(document.getElementById('goalModal'));
    modal.show();
}

function saveGoal() {
    const goal = {
        id: uuidv4(),
        title: document.getElementById('goalTitle').value,
        description: document.getElementById('goalDescription').value,
        category: document.getElementById('goalCategory').value,
        startDate: document.getElementById('goalStartDate').value,
        targetDate: document.getElementById('goalTargetDate').value || null,
        priority: document.getElementById('goalPriority').value,
        reviewFrequency: document.getElementById('goalReview').value,
        motivation: document.getElementById('goalMotivation').value,
        status: 'active',
        progress: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    app.data.goals.push(goal);
    app.saveData();
    app.renderDashboard();
    
    bootstrap.Modal.getInstance(document.getElementById('goalModal')).hide();
    app.showToast('Goal added successfully!');
}

function addHabit() {
    document.getElementById('habitTitle').value = '';
    document.getElementById('habitDescription').value = '';
    document.getElementById('habitFrequency').value = 'daily';
    document.getElementById('habitCategory').value = 'health';
    document.getElementById('habitTime').value = 'morning';
    
    const modal = new bootstrap.Modal(document.getElementById('habitModal'));
    modal.show();
}

function saveHabit() {
    const habit = {
        id: uuidv4(),
        title: document.getElementById('habitTitle').value,
        description: document.getElementById('habitDescription').value,
        frequency: document.getElementById('habitFrequency').value,
        category: document.getElementById('habitCategory').value,
        time: document.getElementById('habitTime').value,
        streak: 0,
        longestStreak: 0,
        consistency: 0,
        completions: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    app.data.habits.push(habit);
    app.saveData();
    app.renderDashboard();
    
    bootstrap.Modal.getInstance(document.getElementById('habitModal')).hide();
    app.showToast('Habit added successfully!');
}

function toggleHabitCompletion(habitId, completed) {
    const habit = app.data.habits.find(h => h.id === habitId);
    if (!habit) return;
    
    const today = new Date().toISOString().split('T')[0];
    const existingIndex = habit.completions?.findIndex(c => c.date === today) ?? -1;
    
    if (existingIndex >= 0) {
        habit.completions[existingIndex].completed = completed;
    } else {
        if (!habit.completions) habit.completions = [];
        habit.completions.push({
            date: today,
            completed: completed
        });
    }
    
    // Update streak
    if (completed) {
        habit.streak = (habit.streak || 0) + 1;
        if (habit.streak > (habit.longestStreak || 0)) {
            habit.longestStreak = habit.streak;
        }
    } else {
        habit.streak = 0;
    }
    
    // Update consistency (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentCompletions = habit.completions?.filter(c => new Date(c.date) >= thirtyDaysAgo) || [];
    const completedCount = recentCompletions.filter(c => c.completed).length;
    habit.consistency = recentCompletions.length > 0 ? Math.round((completedCount / recentCompletions.length) * 100) : 0;
    
    app.saveData();
    app.renderDashboard();
}

function completeTask(taskId) {
    const task = app.data.tasks.find(t => t.id === taskId);
    if (task) {
        task.status = 'completed';
        task.completedAt = new Date().toISOString();
        task.updatedAt = new Date().toISOString();
        app.saveData();
        app.renderDashboard();
        app.showToast('Task completed!');
    }
}

async function exportData() {
    try {
        const result = await window.electron.invoke('export-data', app.data);
        if (result.success) {
            app.showToast(`Data exported to: ${result.path}`);
        }
    } catch (error) {
        console.error('Export failed:', error);
        app.showError('Failed to export data');
    }
}

async function createBackup() {
    const backup = {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        data: JSON.parse(JSON.stringify(app.data))
    };
    
    if (!app.data.backups) app.data.backups = [];
    app.data.backups.push(backup);
    
    // Keep only last 10 backups
    if (app.data.backups.length > 10) {
        app.data.backups.shift();
    }
    
    await app.saveData();
    app.showToast('Backup created successfully!');
}

// UUID generator
function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}