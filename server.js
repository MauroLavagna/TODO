const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(cors());
app.use(express.static(path.join(__dirname)));

const filePath = './tasks.json';
const clients = [];

const loadTasks = () => {
    if (fs.existsSync(filePath)) {
        try {
            const data = fs.readFileSync(filePath, 'utf8');
            const tasks = JSON.parse(data);
            return tasks;
        } catch (error) {
            console.error("Error loading tasks from file:", error);
            return { "Personal": [], "Work": [], "Shopping": [] };
        }
    } else {
        return { "Personal": [], "Work": [], "Shopping": [] };
    }
};

const saveTasks = (tasks) => {
    try {
        if (typeof tasks !== 'object' || tasks === null) {
            throw new Error('Invalid tasks structure');
        }
        fs.writeFileSync(filePath, JSON.stringify(tasks, null, 2));
    } catch (error) {
        console.error('Error saving tasks:', error);
    }
};

const notifyClients = () => {
    const tasks = loadTasks();
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(tasks));
        }
    });
};

app.get('/tasks', (req, res) => {
    res.json(loadTasks());
});

app.post('/tasks', (req, res) => {
    const tasks = loadTasks();
    const { group, subGroup, task } = req.body;
    if (!tasks[group]) {
        tasks[group] = [];
    }
    if (subGroup) {
        if (!tasks[group][subGroup]) {
            tasks[group][subGroup] = [];
        }
        tasks[group][subGroup].push(task);
    } else {
        tasks[group].push(task);
    }
    saveTasks(tasks);
    notifyClients();
    res.json(tasks);
});

app.put('/tasks', (req, res) => {
    const tasks = loadTasks();
    const { group, subGroup, index, task } = req.body;
    if (subGroup) {
        if (tasks[group] && tasks[group][subGroup] && tasks[group][subGroup][index]) {
            tasks[group][subGroup][index] = task;
        } else {
            return res.status(400).json({ error: 'Invalid subGroup or task index' });
        }
    } else {
        if (tasks[group] && tasks[group][index]) {
            tasks[group][index] = task;
        } else {
            return res.status(400).json({ error: 'Invalid group or task index' });
        }
    }
    saveTasks(tasks);
    notifyClients();
    res.json(tasks);
});

app.delete('/tasks', (req, res) => {
    const tasks = loadTasks();
    const { group, subGroup, index } = req.body;

    if (subGroup) {
        if (tasks[group] && tasks[group][subGroup] && tasks[group][subGroup][index] !== undefined) {
            tasks[group][subGroup].splice(index, 1);
        } else {
            return res.status(400).json({ error: 'Invalid subGroup or task index' });
        }
    } else {
        if (tasks[group] && tasks[group][index] !== undefined) {
            tasks[group].splice(index, 1);
        } else {
            return res.status(400).json({ error: 'Invalid group or task index' });
        }
    }
    saveTasks(tasks);
    notifyClients();
    res.json(tasks);
});

app.delete('/groups/:groupName/:subGroupName?', (req, res) => {
    const tasks = loadTasks();
    const { groupName, subGroupName } = req.params;

    if (subGroupName) {
        if (tasks[groupName] && tasks[groupName][subGroupName]) {
            delete tasks[groupName][subGroupName];
        } else {
            return res.status(400).json({ error: 'Invalid subGroup name' });
        }
    } else {
        if (tasks[groupName]) {
            delete tasks[groupName];
        } else {
            return res.status(400).json({ error: 'Invalid group name' });
        }
    }
    saveTasks(tasks);
    notifyClients();
    res.json(tasks);
});

app.put('/tasks/reorder', (req, res) => {
    const tasks = loadTasks();
    const { group, subGroup, tasks: reorderedTasks } = req.body;
    if (subGroup) {
        if (tasks[group] && tasks[group][subGroup]) {
            tasks[group][subGroup] = reorderedTasks;
        } else {
            return res.status(400).json({ error: 'Invalid subGroup' });
        }
    } else {
        if (tasks[group]) {
            tasks[group] = reorderedTasks;
        } else {
            return res.status(400).json({ error: 'Invalid group' });
        }
    }
    saveTasks(tasks);
    notifyClients();
    res.json(tasks);
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const server = app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    clients.push(ws);
    ws.on('close', () => {
        clients.splice(clients.indexOf(ws), 1);
    });
    ws.send(JSON.stringify(loadTasks()));
});
