const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const PORT = process.env.PORT || 3000;

// 🛡️ CSP strict (no unsafe-eval)
app.use((req, res, next) => {
    res.setHeader("Content-Security-Policy",
        "default-src 'self'; " +
        "script-src 'self'; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data:; " +
        "connect-src 'self' ws:;"
    );
    next();
});

// 📦 Serve static files
app.use(express.static('public'));

// 📄 Serve index.html
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// 🌍 Stage state for new users
let stageState = [];

// 🌐 Socket.IO connections
io.on('connection', (socket) => {
    console.log(`👋 User connected: ${socket.id}`);

    // Send current stage to new user
    socket.emit('init', stageState);

    // Inform others about new user
    const otherUsers = Array.from(io.sockets.sockets.keys()).filter(id => id !== socket.id);
    socket.emit('users', otherUsers);
    socket.broadcast.emit('users', [socket.id]);

    // 🆕 Spawn
    socket.on('spawn', (data) => {
        if (!stageState.find(el => el.id === data.id)) {
            stageState.push({ ...data, x: 0, y: 0, width: 320, height: 240, filters: {} });
            socket.broadcast.emit('spawn', data);
        }
    });

    // ↔️ Move
    socket.on('move', (data) => {
        const item = stageState.find(el => el.id === data.id);
        if (item) {
            item.x = data.x;
            item.y = data.y;
        }
        socket.broadcast.emit('move', data);
    });

    // 📐 Resize
    socket.on('resize', (data) => {
        const item = stageState.find(el => el.id === data.id);
        if (item) {
            item.width = data.width;
            item.height = data.height;
        }
        socket.broadcast.emit('resize', data);
    });

    // 🎨 Filters
    socket.on('filter', (data) => {
        const item = stageState.find(el => el.id === data.id);
        if (item) {
            item.filters = data.filters;
        }
        socket.broadcast.emit('filter', data);
    });

    // ❌ Delete
    socket.on('delete', (data) => {
        stageState = stageState.filter(el => el.id !== data.id);
        socket.broadcast.emit('delete', data);
    });

    // 📡 WebRTC signaling
    socket.on('signal', ({ to, signal }) => {
        io.to(to).emit('signal', { from: socket.id, signal });
    });

    // 📴 Disconnect
    socket.on('disconnect', () => {
        console.log(`👋 User disconnected: ${socket.id}`);
        io.emit('user-left', socket.id);
    });
});

// 🚀 Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running at http://0.0.0.0:${PORT}`);
});

