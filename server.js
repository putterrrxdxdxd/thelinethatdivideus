const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const PORT = process.env.PORT || 3000;

// Serve static files from 'public' folder
app.use(express.static('public'));

// Store stage state
let stageState = [];

// Socket.IO connection
io.on('connection', (socket) => {
    console.log('👋 User connected:', socket.id);

    // Send current stage to new user
    socket.emit('init', stageState);

    // Handle spawn
    socket.on('spawn', (data) => {
        console.log('📦 Spawn:', data);
        stageState.push(data);
        socket.broadcast.emit('spawn', data);
    });

    // Handle move
    socket.on('move', (data) => {
        const item = stageState.find(el => el.id === data.id);
        if (item) {
            item.x = data.x;
            item.y = data.y;
        }
        socket.broadcast.emit('move', data);
    });

    // Handle resize
    socket.on('resize', (data) => {
        const item = stageState.find(el => el.id === data.id);
        if (item) {
            item.width = data.width;
            item.height = data.height;
        }
        socket.broadcast.emit('resize', data);
    });

    // Handle delete
    socket.on('delete', (data) => {
        console.log('🗑 Delete:', data.id);
        stageState = stageState.filter(el => el.id !== data.id);
        socket.broadcast.emit('delete', data);
    });

    socket.on('disconnect', () => {
        console.log('👋 User disconnected:', socket.id);
    });
});

// Start server
server.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});


