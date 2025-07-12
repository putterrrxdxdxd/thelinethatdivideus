const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const PORT = process.env.PORT || 3000;

// 🛡️ Content Security Policy (safer for browser)
app.use((req, res, next) => {
    res.setHeader("Content-Security-Policy",
        "default-src 'self'; " +
        "script-src 'self'; " +
        "style-src 'self'; " +
        "img-src 'self' data:; " +
        "connect-src 'self' ws:;"
    );
    next();
});

// 📦 Serve static files
app.use(express.static('public'));

// 📄 Serve index.html on root
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// 🌍 Stage state for syncing new users
let stageState = []; // [{ id, type, src?, x, y, width, height, filters }]

// 🌐 Socket.IO connections
io.on('connection', (socket) => {
    console.log(`👋 User connected: ${socket.id}`);

    // Send current stage state to the new user
    socket.emit('init', stageState);

    // Tell existing users about the new user
    const otherUsers = Array.from(io.sockets.sockets.keys()).filter(id => id !== socket.id);
    socket.emit('users', otherUsers);
    socket.broadcast.emit('users', [socket.id]);

    // 🆕 Spawn new element
    socket.on('spawn', (data) => {
        console.log('📦 Spawn:', data);
        if (!stageState.find(el => el.id === data.id)) {
            stageState.push({
                id: data.id,
                type: data.type,
                src: data.src || null,
                x: 0,
                y: 0,
                width: 320,
                height: 240,
                filters: {}
            });
            socket.broadcast.emit('spawn', data);
        }
    });

    // ↔️ Move element
    socket.on('move', (data) => {
        const item = stageState.find(el => el.id === data.id);
        if (item) {
            item.x = data.x;
            item.y = data.y;
        }
        socket.broadcast.emit('move', data);
    });

    // 📐 Resize element
    socket.on('resize', (data) => {
        const item = stageState.find(el => el.id === data.id);
        if (item) {
            item.width = data.width;
            item.height = data.height;
        }
        socket.broadcast.emit('resize', data);
    });

    // 🎨 Apply filters
    socket.on('filter', (data) => {
        const item = stageState.find(el => el.id === data.id);
        if (item) {
            item.filters = data.filters;
        }
        socket.broadcast.emit('filter', data);
    });

    // ❌ Delete element
    socket.on('delete', (data) => {
        stageState = stageState.filter(el => el.id !== data.id);
        socket.broadcast.emit('delete', data);
    });

    // 📡 WebRTC signaling pass-through
    socket.on('signal', ({ to, signal }) => {
        console.log(`📡 Signal from ${socket.id} to ${to}`);
        io.to(to).emit('signal', { from: socket.id, signal });
    });

    // 📴 User disconnects
    socket.on('disconnect', () => {
        console.log(`👋 User disconnected: ${socket.id}`);
        io.emit('user-left', socket.id);
        // Optional: Clean up remote webcams (if tied to socket.id)
        stageState = stageState.filter(el => el.id !== `remote-${socket.id}`);
    });
});

// 🚀 Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running at http://0.0.0.0:${PORT}`);
});
