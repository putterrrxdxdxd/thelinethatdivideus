const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const PORT = process.env.PORT || 3000;

// 📦 Serve static files from 'public' folder
app.use(express.static('public'));

// 🛡 Add strict Content Security Policy (CSP)
app.use((req, res, next) => {
    res.setHeader(
        "Content-Security-Policy",
        [
            "default-src 'self';",
            "script-src 'self';", // No unsafe-eval
            "style-src 'self' 'unsafe-inline';", // Allow inline styles for now
            "img-src 'self' data:;", // Images from same origin & base64
            "media-src 'self' blob:;", // Allow webcam & video streams
            "connect-src 'self' ws://* wss://*;" // Allow WebSockets
        ].join(' ')
    );
    next();
});

// 📝 Store stage state (archives, positions, sizes)
let stageState = [];

// 🌐 Socket.IO connection
io.on('connection', (socket) => {
    console.log('👤 User connected:', socket.id);

    // 📨 Send existing users to the new user
    const otherUsers = Array.from(io.sockets.sockets.keys()).filter(id => id !== socket.id);
    socket.emit('users', otherUsers);

    // 🔄 Relay WebRTC signaling data
    socket.on('signal', (data) => {
        console.log('📡 Signal from', socket.id, 'to', data.to);
        io.to(data.to).emit('signal', {
            from: socket.id,
            signal: data.signal
        });
    });

    // 📦 Handle archive spawn
    socket.on('spawn', (data) => {
        console.log('📦 Spawn:', data);
        stageState.push(data);
        socket.broadcast.emit('spawn', data);
    });

    // ✋ Handle move
    socket.on('move', (data) => {
        const item = stageState.find(el => el.id === data.id);
        if (item) {
            item.x = data.x;
            item.y = data.y;
        }
        socket.broadcast.emit('move', data);
    });

    // 📐 Handle resize
    socket.on('resize', (data) => {
        const item = stageState.find(el => el.id === data.id);
        if (item) {
            item.width = data.width;
            item.height = data.height;
        }
        socket.broadcast.emit('resize', data);
    });

    // 🗑 Handle delete
    socket.on('delete', (data) => {
        console.log('🗑 Delete:', data.id);
        stageState = stageState.filter(el => el.id !== data.id);
        socket.broadcast.emit('delete', data);
    });

    // 👋 Handle disconnect
    socket.on('disconnect', () => {
        console.log('👤 User disconnected:', socket.id);
        socket.broadcast.emit('user-left', socket.id);
    });
});

// 🚀 Start server
server.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
});
