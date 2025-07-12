const socket = io();
let peers = {};
let localStream = null;
let highestZ = 1;

const stage = document.getElementById('stage');
const dropZone = document.getElementById('drop-zone');

// 📷 Get webcam stream
async function getWebcamStream() {
    if (localStream) return localStream;
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        return localStream;
    } catch (err) {
        console.error('Webcam error:', err);
    }
}

// 🌐 WebRTC connection
async function startPeerConnection(peerId, initiator) {
    const peer = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    peers[peerId] = peer;

    const stream = await getWebcamStream();
    stream.getTracks().forEach(track => peer.addTrack(track, stream));

    peer.ontrack = (e) => {
        console.log('🎥 Received remote stream');
        spawnWebcam(Date.now(), e.streams[0], true);
    };

    peer.onicecandidate = (e) => {
        if (e.candidate) {
            socket.emit('signal', { to: peerId, signal: { candidate: e.candidate } });
        }
    };

    if (initiator) {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        socket.emit('signal', { to: peerId, signal: { description: peer.localDescription } });
    }
}

socket.on('signal', async ({ from, signal }) => {
    let peer = peers[from];
    if (!peer) {
        await startPeerConnection(from, false);
        peer = peers[from];
    }
    if (signal.description) {
        await peer.setRemoteDescription(new RTCSessionDescription(signal.description));
        if (signal.description.type === 'offer') {
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            socket.emit('signal', { to: from, signal: { description: peer.localDescription } });
        }
    }
    if (signal.candidate) {
        await peer.addIceCandidate(new RTCIceCandidate(signal.candidate));
    }
});

socket.on('users', (users) => {
    users.forEach(userId => {
        if (!peers[userId]) startPeerConnection(userId, true);
    });
});

socket.on('user-left', (userId) => {
    if (peers[userId]) {
        peers[userId].close();
        delete peers[userId];
    }
});

function bringToFront(el) {
    highestZ++;
    el.style.zIndex = highestZ;
}

function makeInteractive(el) {
    bringToFront(el);
    interact(el)
        .draggable({
            listeners: {
                start: (e) => bringToFront(e.target),
                move: (e) => {
                    const t = e.target;
                    const x = (parseFloat(t.dataset.x) || 0) + e.dx;
                    const y = (parseFloat(t.dataset.y) || 0) + e.dy;
                    t.style.transform = `translate(${x}px, ${y}px)`;
                    t.dataset.x = x;
                    t.dataset.y = y;
                    socket.emit('move', { id: t.dataset.id, x, y });
                }
            }
        })
        .resizable({
            edges: { left: true, right: true, bottom: true, top: true },
            listeners: {
                move: (e) => {
                    const t = e.target;
                    t.style.width = `${e.rect.width}px`;
                    t.style.height = `${e.rect.height}px`;
                    socket.emit('resize', { id: t.dataset.id, width: e.rect.width, height: e.rect.height });
                }
            }
        });
}

function spawnWebcam(id = null, peerStream = null, remote = false) {
    const webcam = document.createElement('video');
    webcam.dataset.id = id || Date.now();
    webcam.autoplay = true;
    webcam.playsInline = true;
    webcam.muted = !peerStream; // Local muted, remote unmuted
    webcam.style.position = 'absolute';
    webcam.style.top = '100px';
    webcam.style.left = '100px';
    webcam.width = 320;
    webcam.height = 240;
    stage.appendChild(webcam);
    makeInteractive(webcam);

    if (peerStream) {
        webcam.srcObject = peerStream;
    } else {
        getWebcamStream().then(s => webcam.srcObject = s);
        if (!remote) socket.emit('spawn', { type: 'webcam', id: webcam.dataset.id });
    }
}

function spawnVideo(src = 'archives/video1.mp4', id = null) {
    const video = document.createElement('video');
    video.dataset.id = id || Date.now();
    video.src = src;
    video.autoplay = true;
    video.loop = true;
    video.muted = true;
    video.controls = true;
    video.style.position = 'absolute';
    video.style.top = '150px';
    video.style.left = '150px';
    video.width = 320;
    video.height = 240;
    stage.appendChild(video);
    makeInteractive(video);
    if (!id) socket.emit('spawn', { type: 'video', src, id: video.dataset.id });
}

function spawnImage(src, id = null) {
    const img = document.createElement('img');
    img.dataset.id = id || Date.now();
    img.src = src;
    img.style.position = 'absolute';
    img.style.top = '200px';
    img.style.left = '200px';
    img.width = 320;
    img.height = 240;
    stage.appendChild(img);
    makeInteractive(img);
    if (!id) socket.emit('spawn', { type: 'image', src, id: img.dataset.id });
}

let hoveredElement = null;
stage.addEventListener('mouseover', (e) => {
    if (e.target.tagName === 'VIDEO' || e.target.tagName === 'IMG') {
        hoveredElement = e.target;
        e.target.style.outline = '2px solid red';
    }
});
stage.addEventListener('mouseout', (e) => {
    if (e.target === hoveredElement) {
        e.target.style.outline = 'none';
        hoveredElement = null;
    }
});

// 🎨 Update filters
function updateFilters(el, send = true) {
    const filters = JSON.parse(el.dataset.filters || '{}');
    const filterStrings = [];

    for (const [name, value] of Object.entries(filters)) {
        if (name === 'grayscale') filterStrings.push(`grayscale(${value}%)`);
        if (name === 'blur') filterStrings.push(`blur(${value}px)`);
        if (name === 'brightness') filterStrings.push(`brightness(${value}%)`);
        if (name === 'contrast') filterStrings.push(`contrast(${value}%)`);
        if (name === 'invert') filterStrings.push(`invert(${value}%)`);
    }

    el.style.filter = filterStrings.join(' ');
    el.style.opacity = filters.opacity !== undefined ? filters.opacity : 1;

    if (send) {
        socket.emit('filter', { id: el.dataset.id, filters, sender: socket.id });
    }
}

// ☑️ Receive filters from others
socket.on('filter', ({ id, filters, sender }) => {
    if (sender === socket.id) return; // 🛡️ Skip self updates
    const el = document.querySelector(`[data-id="${id}"]`);
    if (el) {
        el.dataset.filters = JSON.stringify(filters);
        updateFilters(el, false); // Don’t re-emit
    }
});

// 🔄 Sync archives
socket.on('spawn', data => {
    if (data.type === 'webcam') spawnWebcam(data.id, null, true);
    if (data.type === 'video') spawnVideo(data.src, data.id);
    if (data.type === 'image') spawnImage(data.src, data.id);
});
socket.on('move', ({ id, x, y }) => {
    const el = document.querySelector(`[data-id="${id}"]`);
    if (el) {
        el.style.transform = `translate(${x}px, ${y}px)`;
        el.dataset.x = x;
        el.dataset.y = y;
    }
});
socket.on('resize', ({ id, width, height }) => {
    const el = document.querySelector(`[data-id="${id}"]`);
    if (el) {
        el.style.width = `${width}px`;
        el.style.height = `${height}px`;
    }
});
socket.on('delete', ({ id }) => {
    const el = document.querySelector(`[data-id="${id}"]`);
    if (el) el.remove();
});

