const socket = io({
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 20000
});

let highestZ = 1;
let isConnected = false;
let hoveredElement = null;
let localStream = null;

const stage = document.getElementById('stage');
const dropZone = document.getElementById('drop-zone');

// ---------------- CONNECTION STATUS ----------------
function updateConnectionStatus(status, text) {
    const statusEl = document.getElementById('connection-status');
    const textEl = document.getElementById('status-text');
    if (statusEl && textEl) {
        statusEl.className = `connection-status ${status}`;
        textEl.textContent = text;
    }
}

socket.on('connect', () => {
    console.log('✅ Connected to server');
    isConnected = true;
    updateConnectionStatus('connected', 'Connected');
});

socket.on('disconnect', () => {
    console.log('❌ Disconnected from server');
    isConnected = false;
    updateConnectionStatus('disconnected', 'Disconnected');
});

socket.on('connect_error', (error) => {
    console.error('❌ Connection error:', error);
    isConnected = false;
    updateConnectionStatus('disconnected', 'Connection Error');
});

socket.on('reconnect', (attemptNumber) => {
    console.log(`✅ Reconnected after ${attemptNumber} attempts`);
    isConnected = true;
    updateConnectionStatus('connected', 'Reconnected');
});

socket.on('reconnect_error', (error) => {
    console.error('❌ Reconnection error:', error);
    updateConnectionStatus('connecting', 'Reconnecting...');
});

socket.on('reconnect_failed', () => {
    console.error('❌ Reconnection failed');
    updateConnectionStatus('disconnected', 'Connection Failed');
    alert('Connection lost. Please refresh the page.');
});

// ---------------- SIMPLE LOCAL WEBCAM SPAWN ----------------
async function spawnWebcam(id = null) {
    id = id || `webcam-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    if (document.querySelector(`[data-id="${id}"]`)) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Webcam not supported');
        return;
    }
    try {
        if (!localStream) {
            localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
        const video = document.createElement('video');
        video.dataset.id = id;
        video.dataset.filters = '{}';
        video.autoplay = true;
        video.playsInline = true;
        video.muted = true;
        video.srcObject = localStream;
        video.style.position = 'absolute';
        video.style.top = `${100 + Math.floor(Math.random() * 200)}px`;
        video.style.left = `${100 + Math.floor(Math.random() * 200)}px`;
        video.width = 320;
        video.height = 240;
        video.style.objectFit = 'cover';
        video.style.borderRadius = '8px';
        video.style.border = '2px solid #28a745';
        video.style.backgroundColor = '#000';
        stage.appendChild(video);
        makeInteractive(video);
    } catch (err) {
        alert('Could not access webcam: ' + err.message);
    }
}

// ---------------- MEDIA SPAWN ----------------
function spawnVideo(src = 'archives/video1.mp4', id = null) {
    id = id || `video-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    if (document.querySelector(`[data-id="${id}"]`)) return;
    const video = document.createElement('video');
    video.dataset.id = id;
    video.dataset.filters = '{}';
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
    video.style.borderRadius = '8px';
    stage.appendChild(video);
    makeInteractive(video);
    if (isConnected) socket.emit('spawn', { type: 'video', src, id });
}

function spawnImage(src, id = null) {
    id = id || `image-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    if (document.querySelector(`[data-id="${id}"]`)) return;
    const img = document.createElement('img');
    img.dataset.id = id;
    img.dataset.filters = '{}';
    img.src = src;
    img.style.position = 'absolute';
    img.style.top = '200px';
    img.style.left = '200px';
    img.width = 320;
    img.height = 240;
    img.style.borderRadius = '8px';
    stage.appendChild(img);
    makeInteractive(img);
    if (isConnected) socket.emit('spawn', { type: 'image', src, id });
}

// --- TEXT BOX SPAWN ---
function spawnTextBox({ text = '', id = null, x = 100, y = 100, width = 200, height = 50 } = {}) {
    id = id || `text-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    if (document.querySelector(`[data-id="${id}"]`)) return;
    const box = document.createElement('div');
    box.dataset.id = id;
    box.dataset.type = 'text';
    box.contentEditable = true;
    box.innerText = text;
    box.style.position = 'absolute';
    box.style.top = y + 'px';
    box.style.left = x + 'px';
    box.style.width = width + 'px';
    box.style.height = height + 'px';
    box.style.background = 'rgba(255,255,200,0.95)';
    box.style.border = '1.5px solid #888';
    box.style.borderRadius = '8px';
    box.style.padding = '8px';
    box.style.fontSize = '18px';
    box.style.overflow = 'auto';
    box.style.zIndex = highestZ;
    stage.appendChild(box);
    makeInteractive(box);
    box.addEventListener('input', () => {
        if (isConnected) socket.emit('text-update', { id, text: box.innerText });
    });
    if (isConnected) socket.emit('spawn', { type: 'text', text, id, x, y, width, height });
}

// --- CLICK TO SPAWN TEXT BOX ---
stage.addEventListener('click', (e) => {
    // Only spawn if not clicking on an existing element
    if (e.target === stage) {
        spawnTextBox({ x: e.offsetX, y: e.offsetY });
    }
});

// ---------------- SOCKET EVENTS ----------------
socket.on('spawn', (data) => {
    if (data.type === 'video') spawnVideo(data.src, data.id);
    if (data.type === 'image') spawnImage(data.src, data.id);
    if (data.type === 'text') spawnTextBox(data);
    if (data.type === 'daily-cam' && data.session_id) {
        // Set position in store
        if (!window.dailyPositions) window.dailyPositions = {};
        window.dailyPositions[data.session_id] = { x: data.x, y: data.y };
        // Find participant info
        if (dailyCall && dailyCall.participants()[data.session_id]) {
            handleParticipant({ participant: dailyCall.participants()[data.session_id] });
        }
    }
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

socket.on('filter', ({ id, filters, sender }) => {
    if (sender === socket.id) return;
    const el = document.querySelector(`[data-id="${id}"]`);
    if (el) {
        el.dataset.filters = JSON.stringify(filters);
        updateFilters(el, false);
    }
});

socket.on('delete', ({ id }) => removeElement(id));
socket.on('text-update', ({ id, text }) => {
    const el = document.querySelector(`[data-id="${id}"]`);
    if (el && el.dataset.type === 'text') {
        el.innerText = text;
    }
});

function removeElement(id) {
    const el = document.querySelector(`[data-id="${id}"]`);
    if (el) el.remove();
}

// ---------------- INTERACT.JS ----------------
function bringToFront(el) {
    highestZ++;
    el.style.zIndex = highestZ;
}

// --- When moving a Daily video, update the position store and emit move ---
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
                    // If it's a Daily video, update the position store
                    if (t.dataset.id && t.dataset.id.startsWith('daily-')) {
                        const sessionId = t.dataset.id.replace('daily-', '');
                        if (!window.dailyPositions) window.dailyPositions = {};
                        window.dailyPositions[sessionId] = { x, y };
                        if (isConnected) {
                            socket.emit('move', { id: t.dataset.id, x, y });
                        }
                    } else if (isConnected) {
                        socket.emit('move', { id: t.dataset.id, x, y });
                    }
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
                    if (isConnected) {
                        socket.emit('resize', { id: t.dataset.id, width: e.rect.width, height: e.rect.height });
                    }
                }
            }
        });
}

// ---------------- FILTERS ----------------
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
    if (send && isConnected) socket.emit('filter', { id: el.dataset.id, filters, sender: socket.id });
}

// ---------------- FILE DROP ----------------
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

// ---------------- KEYBOARD SHORTCUTS ----------------
document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (key === 'm') {
        toggleDailyAudioMute();
        return;
    }
    if (key === 'n') {
        toggleDailyVideoMute();
        return;
    }
    if (key === 'w') {
        // Respawn local Daily cam if missing
        const local = dailyCall && dailyCall.participants().local;
        if (local && !document.querySelector(`[data-id="daily-${local.session_id}"]`)) {
            respawnLocalDailyCam();
            return;
        }
        // Otherwise, spawnWebcam (legacy local webcam)
        spawnWebcam();
        return;
    }
    if (key === 'v') return spawnVideo();
    if (key === 'i') return spawnImage('archives/image1.jpg');
    if (key === 'd') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'video/*,image/*';
        input.multiple = true;
        input.onchange = ev => { for (const file of ev.target.files) handleFile(file); };
        input.click();
        return;
    }
    if (key === '/' && hoveredElement) {
        const id = hoveredElement.dataset.id;
        hoveredElement.remove();
        if (isConnected) socket.emit('delete', { id });
        hoveredElement = null;
        return;
    }
    if (!hoveredElement) return;
    const filters = JSON.parse(hoveredElement.dataset.filters || '{}');
    if (key === 'g') filters.grayscale = filters.grayscale ? 0 : 100;
    if (key === 'b') filters.blur = filters.blur ? 0 : 5;
    if (key === 'j') filters.invert = filters.invert ? 0 : 100;
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

// ---------------- HOVER EFFECTS ----------------
stage.addEventListener('mouseover', (e) => {
    let targetElement = e.target;
    if (!targetElement.dataset.id && targetElement.parentElement && targetElement.parentElement.querySelector('[data-id]')) {
        targetElement = targetElement.parentElement.querySelector('[data-id]');
    }
    if (targetElement.tagName === 'VIDEO' || targetElement.tagName === 'IMG' || targetElement.dataset.id) {
        hoveredElement = targetElement;
        targetElement.style.outline = '2px solid red';
    }
});
stage.addEventListener('mouseout', (e) => {
    if (hoveredElement && (e.target === hoveredElement || e.target.parentElement?.querySelector('[data-id]') === hoveredElement)) {
        hoveredElement.style.outline = 'none';
        hoveredElement = null;
    }
});

// Minimal Daily.co integration
let dailyCall = null;
let dailyParticipants = {};

function setupDaily() {
    if (!window.DailyIframe) {
        console.error('Daily.co SDK not loaded!');
        return;
    }
    dailyCall = window.DailyIframe.createCallObject();
    dailyCall.join({ url: 'https://testtheline.daily.co/thelinemonolith' });
    dailyCall.on('participant-joined', handleParticipant);
    dailyCall.on('participant-updated', handleParticipant);
    dailyCall.on('participant-left', (ev) => {
        const id = ev.participant.session_id;
        const el = document.querySelector(`[data-id="daily-${id}"]`);
        if (el) el.remove();
        delete dailyParticipants[id];
    });
}

function handleParticipant(ev) {
    const p = ev.participant;
    if (!p || !p.videoTrack) return;
    let video = document.querySelector(`[data-id="daily-${p.session_id}"]`);
    // --- Collaborative position storage ---
    // Try to get stored position from window.dailyPositions
    if (!window.dailyPositions) window.dailyPositions = {};
    let pos = window.dailyPositions[p.session_id] || { x: 0, y: 0 };
    if (!video) {
        video = document.createElement('video');
        video.dataset.id = `daily-${p.session_id}`;
        video.autoplay = true;
        video.playsInline = true;
        video.muted = p.local;
        video.width = 320;
        video.height = 240;
        video.style.position = 'absolute';
        video.style.top = `${pos.y || 100 + Math.floor(Math.random() * 200)}px`;
        video.style.left = `${pos.x || 100 + Math.floor(Math.random() * 200)}px`;
        video.style.borderRadius = '8px';
        video.style.border = p.local ? '2px solid #28a745' : '2px solid #007bff';
        video.dataset.x = pos.x;
        video.dataset.y = pos.y;
        video.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
        stage.appendChild(video);
        makeInteractive(video);
    }
    // Attach both video and audio tracks if available
    const tracks = [];
    if (p.videoTrack) tracks.push(p.videoTrack);
    if (p.audioTrack) tracks.push(p.audioTrack);
    const stream = new MediaStream(tracks);
    video.srcObject = stream;
    dailyParticipants[p.session_id] = video;
}

// --- Daily cam mute/unmute controls ---
function toggleDailyAudioMute() {
    if (dailyCall) {
        const isMuted = dailyCall.localAudio();
        dailyCall.setLocalAudio(!isMuted);
        alert('Audio ' + (isMuted ? 'unmuted' : 'muted'));
    }
}
function toggleDailyVideoMute() {
    if (dailyCall) {
        const isMuted = dailyCall.localVideo();
        dailyCall.setLocalVideo(!isMuted);
        alert('Video ' + (isMuted ? 'unmuted' : 'muted'));
    }
}
// --- Respawn local Daily cam if deleted ---
function respawnLocalDailyCam() {
    if (!dailyCall) return;
    const local = dailyCall.participants().local;
    if (!local) return;
    // Use stored position if available
    let pos = { x: 0, y: 0 };
    if (window.dailyPositions && window.dailyPositions[local.session_id]) {
        pos = window.dailyPositions[local.session_id];
    }
    // Broadcast spawn event for Daily cam
    if (isConnected) {
        socket.emit('spawn', {
            type: 'daily-cam',
            id: `daily-${local.session_id}`,
            session_id: local.session_id,
            x: pos.x,
            y: pos.y
        });
    }
    // Also create locally
    handleParticipant({ participant: local });
}

// --- Wire up Daily cam control buttons ---
document.addEventListener('DOMContentLoaded', () => {
    updateConnectionStatus('connecting', 'Connecting...');
    setupDaily();
    // Button event listeners
    const btnAudio = document.getElementById('btn-daily-audio');
    const btnVideo = document.getElementById('btn-daily-video');
    const btnRespawn = document.getElementById('btn-daily-respawn');
    if (btnAudio) btnAudio.onclick = toggleDailyAudioMute;
    if (btnVideo) btnVideo.onclick = toggleDailyVideoMute;
    if (btnRespawn) btnRespawn.onclick = respawnLocalDailyCam;
});

window.addEventListener('beforeunload', () => {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
});