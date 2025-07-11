const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const PORT = process.env.PORT || 3000;

// Serve static files from 'public' folder
app.use(express.static('public'));

// 🗂 Stage state (so new users get the current scene)
let stageState = [];

// 🌐 Socket.IO connection
io.on('connection', (socket) => {
    console.log('👋 A user connected:', socket.id);

    // Send current stage to the new user
    socket.emit('init', stageState);

    // 🆕 Handle spawn (add new archive)
    socket.on('spawn', (data) => {
        console.log('📦 Spawn:', data);
        stageState.push(data); // Add to stage state
        socket.broadcast.emit('spawn', data); // Send to others
    });

    // ↔️ Handle move
    socket.on('move', (data) => {
        console.log('📍 Move:', data);
        const item = stageState.find(el => el.id === data.id);
        if (item) {
            item.x = data.x;
            item.y = data.y;
        }
        socket.broadcast.emit('move', data);
    });

    // 📐 Handle resize
    socket.on('resize', (data) => {
        console.log('📏 Resize:', data);
        const item = stageState.find(el => el.id === data.id);
        if (item) {
            item.width = data.width;
            item.height = data.height;
        }
        socket.broadcast.emit('resize', data);
    });

    // 🎨 Handle filters (opacity, blur, etc.)
    socket.on('filter', (data) => {
        console.log('🎨 Filter:', data);
        socket.broadcast.emit('filter', data);
    });

    // ❌ Handle delete
    socket.on('delete', (data) => {
        console.log('🗑 Delete:', data.id);
        stageState = stageState.filter(el => el.id !== data.id);
        socket.broadcast.emit('delete', data);
    });

    socket.on('disconnect', () => {
        console.log('👋 User disconnected:', socket.id);
    });
});

// 🚀 Start server
server.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});


