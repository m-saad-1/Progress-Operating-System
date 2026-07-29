const fs = require('fs');

let content = fs.readFileSync('src/lib/database.ts', 'utf-8');

// Using regex to safely replace goal_id inside Habit
content = content.replace(/export interface Habit {[\s\S]*?goal_id: string \| null;/g, (match) => {
    return match.replace('goal_id: string | null;', 'goal_id?: string;');
});

fs.writeFileSync('src/lib/database.ts', content);
