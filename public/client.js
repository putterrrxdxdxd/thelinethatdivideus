const socket = io();
let peers = {};
let localStream = null;
let highestZ = 1;

const stage = document.getElementById('stage');
const dropZone = document.getElementById('drop-zone');

// 📷 Get (and keep) a single webcam stream per user
async function getWebcamStream() {
    if (localStream) return localStream;
    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Webcam not supported');
        }
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        return localStream;
    } catch (err) {
        console.error('Webcam error:', err);
        alert('Could not access webcam: ' + err.message);
    }
}

// 🌐 WebRTC connection: always send your webcam if asked
async function startPeerConnection(peerId, initiator) {
    if (peers[peerId]) return;
    const peer = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    peers[peerId] = peer;

    // Always add webcam tracks if you have them (so others can see your face)
    if (localStream) {
        localStream.getTracks().forEach(track => peer.addTrack(track, localStream));
    }

    peer.ontrack = (e) => {
        // Create a unique video element for this track + peer combination
        const streamId = e.streams[0].id;
        const videoId = `remote-${peerId}-${streamId}`;
        let remoteVideo = document.querySelector(`[data-id="${videoId}"]`);
        if (!remoteVideo) {
            remoteVideo = document.createElement('video');
            remoteVideo.dataset.id = videoId;
            remoteVideo.dataset.peer = peerId;
            remoteVideo.autoplay = true;
            remoteVideo.playsInline = true;
            remoteVideo.muted = false;
            remoteVideo.style.position = 'absolute';
            remoteVideo.style.top = '200px';
            remoteVideo.style.left = '200px';
            remoteVideo.width = 320;
            remoteVideo.height = 240;
            stage.appendChild(remoteVideo);
            makeInteractive(remoteVideo);
        }
        // Assign stream to video element
        if (remoteVideo.srcObject !== e.streams[0]) {
            remoteVideo.srcObject = e.streams[0];
        }
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

// ------- SIGNAL HANDLER --------
socket.on('signal', async ({ from, signal }) => {
    let peer = peers[from];
    if (!peer) {
        await startPeerConnection(from, false);
        peer = peers[from];
    }
    if (signal.description) {
        if (signal.description.type === 'offer') {
            await peer.setRemoteDescription(new RTCSessionDescription(signal.description));
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            socket.emit('signal', { to: from, signal: { description: peer.localDescription } });
        } else if (signal.description.type === 'answer') {
            if (peer.signalingState === 'have-local-offer') {
                await peer.setRemoteDescription(new RTCSessionDescription(signal.description));
            }
        }
    }
    if (signal.candidate) {
        try {
            await peer.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } catch (e) {
            console.warn('Failed to add ICE candidate:', e);
        }
    }
});

socket.on('users', (users) => {
    users.forEach(userId => {
        if (userId !== socket.id && !peers[userId]) startPeerConnection(userId, true);
    });
});
socket.on('user-left', (userId) => {
    const peer = peers[userId];
    if (peer) {
        peer.close();
        delete peers[userId];
        // Remove ALL remote webcam boxes for this peer
        document.querySelectorAll(`[data-peer="${userId}"]`).forEach(v => v.remove());
    }
});

// --------- Move/Resize/Filter/Delete ---------
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

// ---------- SPAWN WEBCAM: unlimited clones
function spawnWebcam(id = null, peerId = socket.id) {
    id = id || `webcam-${socket.id}-${Date.now()}`; // Unique per webcam box!
    const webcam = document.createElement('video');
    webcam.dataset.id = id;
    webcam.dataset.peer = peerId;
    webcam.autoplay = true;
    webcam.playsInline = true;
    webcam.muted = peerId === socket.id; // Only mute self
    webcam.style.position = 'absolute';
    webcam.style.top = '100px';
    webcam.style.left = '100px';
    webcam.width = 320;
    webcam.height = 240;
    stage.appendChild(webcam);
    makeInteractive(webcam);

    if (peerId === socket.id) {
        // If this is *my* webcam, show my local stream
        getWebcamStream().then(s => { if (s) webcam.srcObject = s; });
    }
    // If remote, will get stream via peer.ontrack later

    if (!id.includes('-from-server')) {
        socket.emit('spawn', { type: 'webcam', id, peerId }); // Tell everyone
    }
}

// ---- Spawn other media ----
function spawnVideo(src = 'archives/video1.mp4', id = null) {
    id = id || `video-${Date.now()}`;
    if (document.querySelector(`[data-id="${id}"]`)) return;
    const video = document.createElement('video');
    video.dataset.id = id;
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
    if (!id.includes('-from-server')) socket.emit('spawn', { type: 'video', src, id });
}

function spawnImage(src, id = null) {
    id = id || `image-${Date.now()}`;
    if (document.querySelector(`[data-id="${id}"]`)) return;
    const img = document.createElement('img');
    img.dataset.id = id;
    img.src = src;
    img.style.position = 'absolute';
    img.style.top = '200px';
    img.style.left = '200px';
    img.width = 320;
    img.height = 240;
    stage.appendChild(img);
    makeInteractive(img);
    if (!id.includes('-from-server')) socket.emit('spawn', { type: 'image', src, id });
}

// -------- File and Drag-and-Drop handling --------
function handleFile(file) {
    if (!file) return;
    if (file.type.startsWith('video/')) {
        const url = URL.createObjectURL(file);
        spawnVideo(url);
    } else if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => spawnImage(event.target.result);
        reader.readAsDataURL(file);
    } else {
        alert('Unsupported file type: ' + file.type);
    }
}
window.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.display = 'flex';
});
window.addEventListener('dragleave', () => dropZone.style.display = 'none');
window.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.display = 'none';
    for (const file of e.dataTransfer.files) handleFile(file);
});

// ---------- Collaborative events ----------
socket.on('filter', ({ id, filters, sender }) => {
    if (sender === socket.id) return;
    const el = document.querySelector(`[data-id="${id}"]`);
    if (el) {
        el.dataset.filters = JSON.stringify(filters);
        updateFilters(el, false);
    }
});
socket.on('spawn', data => {
    if (data.type === 'webcam') {
        spawnWebcam(data.id, data.peerId); // Show remote or local, use peerId for source
    }
    if (data.type === 'video') spawnVideo(data.src, data.id + '-from-server');
    if (data.type === 'image') spawnImage(data.src, data.id + '-from-server');
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

// -------- FILTER & DELETE KEYBOARD SHORTCUTS --------
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
    if (send) socket.emit('filter', { id: el.dataset.id, filters, sender: socket.id });
}

// ----- Keyboard shortcuts -----
document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (key === 'w') {
        spawnWebcam(); // Spawns ANOTHER webcam box
        return;
    }
    if (key === 'v') return spawnVideo();
    if (key === 'i') return spawnImage('archives/image1.jpg');
    if (key === 'd') { // D for "Dialog": open file dialog
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'video/*,image/*';
        input.multiple = true;
        input.onchange = ev => { for (const file of ev.target.files) handleFile(file); };
        input.click();
        return;
    }
    if (key === 'x' && hoveredElement) {
        const id = hoveredElement.dataset.id;
        hoveredElement.remove();
        socket.emit('delete', { id });
        hoveredElement = null;
        return;
    }
    if (!hoveredElement) return;
    const filters = JSON.parse(hoveredElement.dataset.filters || '{}');
    if (key === 'g') filters.grayscale = filters.grayscale ? 0 : 100;
    if (key === 'b') filters.blur = filters.blur ? 0 : 5;
    if (key === 'i') filters.invert = filters.invert ? 0 : 100;
    if (key === 'c') filters.contrast = filters.contrast ? 0 : 150;
    if (key === 'l') filters.brightness = filters.brightness ? 0 : 150;
    if (e.key === '[') {
        for (const k in filters) {
            if (filters[k] > 0 && k !== 'opacity') filters[k] = Math.max(0, filters[k] - 10);
        }
    }
    if (e.key === ']') {
        for (const k in filters) {
            if (filters[k] > 0 && k !== 'opacity') filters[k] = Math.min(200, filters[k] + 10);
        }
    }
    if (e.key === 'ArrowUp') {
        filters.opacity = parseFloat(filters.opacity) || 1;
        filters.opacity = Math.min(filters.opacity + 0.1, 1);
    }
    if (e.key === 'ArrowDown') {
        filters.opacity = parseFloat(filters.opacity) || 1;
        filters.opacity = Math.max(filters.opacity - 0.1, 0);
    }
    hoveredElement.dataset.filters = JSON.stringify(filters);
    updateFilters(hoveredElement);
});

// ---- Hovered element outline for easy targeting ----
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
