const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    pingTimeout: 60000,
    pingInterval: 25000
});

const PORT = process.env.PORT || 3000;

// 🛡️ CSP: Secure, allow base64 images/videos, allow WebSockets (ws and wss)
app.use((req, res, next) => {
    res.setHeader("Content-Security-Policy",
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-eval' https://unpkg.com https://*.daily.co; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data:; " +
        "media-src 'self' data: blob:; " + // for local video blob URLs
        "connect-src 'self' ws: wss: https://*.daily.co; " +
        "frame-src https://*.daily.co;"
    );
    next();
});

// 📦 Serve static files from 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Make sure Interact.js is served if in /vendor (optional fallback)
app.use('/vendor', express.static(path.join(__dirname, 'public', 'vendor')));

// 📄 Serve index.html at root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 🌍 In-memory stage state
let stageState = [];

// 🌐 Socket.IO for real-time sync & signaling
io.on('connection', (socket) => {
    console.log(`👋 User connected: ${socket.id}`);

    // Send the whole stage to the new user
    socket.emit('init', stageState);

    // Inform about other users
    const otherUsers = Array.from(io.sockets.sockets.keys()).filter(id => id !== socket.id);
    socket.emit('users', otherUsers);
    socket.broadcast.emit('users', [socket.id]);

    // SPAWN: add new item to stage and broadcast
    socket.on('spawn', (data) => {
        try {
            if (!stageState.find(el => el.id === data.id)) {
                stageState.push({ ...data, x: 0, y: 0, width: 320, height: 240, filters: {} });
                socket.broadcast.emit('spawn', data);
                console.log(`📦 Spawned: ${data.type} (${data.id})`);
            }
        } catch (error) {
            console.error('❌ Spawn error:', error);
        }
    });

    // MOVE: update position & broadcast
    socket.on('move', (data) => {
        try {
            const item = stageState.find(el => el.id === data.id);
            if (item) {
                item.x = data.x;
                item.y = data.y;
                socket.broadcast.emit('move', data);
            }
        } catch (error) {
            console.error('❌ Move error:', error);
        }
    });

    // RESIZE: update size & broadcast
    socket.on('resize', (data) => {
        try {
            const item = stageState.find(el => el.id === data.id);
            if (item) {
                item.width = data.width;
                item.height = data.height;
                socket.broadcast.emit('resize', data);
            }
        } catch (error) {
            console.error('❌ Resize error:', error);
        }
    });

    // FILTER: update filters & broadcast
    socket.on('filter', (data) => {
        try {
            const item = stageState.find(el => el.id === data.id);
            if (item) {
                item.filters = data.filters;
                socket.broadcast.emit('filter', data);
            }
        } catch (error) {
            console.error('❌ Filter error:', error);
        }
    });

    // DELETE: remove item & broadcast
    socket.on('delete', (data) => {
        try {
            stageState = stageState.filter(el => el.id !== data.id);
            socket.broadcast.emit('delete', data);
            console.log(`🗑️ Deleted: ${data.id}`);
        } catch (error) {
            console.error('❌ Delete error:', error);
        }
    });

    // On disconnect: notify others
    socket.on('disconnect', () => {
        console.log(`👋 User disconnected: ${socket.id}`);
        io.emit('user-left', socket.id);
    });

    // Error handling
    socket.on('error', (error) => {
        console.error(`❌ Socket error for ${socket.id}:`, error);
    });
});

// 🚀 Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running at http://0.0.0.0:${PORT}`);
    console.log(`📊 Socket.IO ready for connections`);
});
