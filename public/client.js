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
function spawnVideo(src = 'archives/video1.mp4', id = null, x = 150, y = 150, filters = {}, width = 320, height = 240) {
    id = id || `video-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    if (document.querySelector(`[data-id="${id}"]`)) return;
    const video = document.createElement('video');
    video.dataset.id = id;
    video.dataset.filters = JSON.stringify(filters || {});
    video.src = src;
    video.autoplay = true;
    video.loop = true;
    video.muted = true;
    video.controls = true;
    video.style.position = 'absolute';
    video.style.top = `${y}px`;
    video.style.left = `${x}px`;
    video.width = width;
    video.height = height;
    video.style.borderRadius = '0';
    video.style.border = '1px solid rgba(255,255,255,0.15)';
    video.dataset.x = x;
    video.dataset.y = y;
    video.style.width = `${width}px`;
    video.style.height = `${height}px`;
    stage.appendChild(video);
    makeInteractive(video);
    updateFilters(video, false);
    if (isConnected) socket.emit('spawn', { type: 'video', src, id, x, y, filters, width, height });
}

function spawnImage(src, id = null, x = 200, y = 200, filters = {}, width = 320, height = 240) {
    id = id || `image-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    if (document.querySelector(`[data-id="${id}"]`)) return;
    const img = document.createElement('img');
    img.dataset.id = id;
    img.dataset.filters = JSON.stringify(filters || {});
    img.src = src;
    img.style.position = 'absolute';
    img.style.top = `${y}px`;
    img.style.left = `${x}px`;
    img.width = width;
    img.height = height;
    img.style.borderRadius = '0';
    img.style.border = '1px solid rgba(255,255,255,0.15)';
    img.dataset.x = x;
    img.dataset.y = y;
    img.style.width = `${width}px`;
    img.style.height = `${height}px`;
    stage.appendChild(img);
    makeInteractive(img);
    updateFilters(img, false);
    if (isConnected) socket.emit('spawn', { type: 'image', src, id, x, y, filters, width, height });
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
    box.style.background = 'transparent';
    box.style.border = 'none';
    box.style.borderRadius = '0';
    box.style.padding = '0';
    box.style.fontSize = (height * 0.6) + 'px';
    box.style.lineHeight = height + 'px';
    box.style.color = '#fff';
    box.style.overflow = 'hidden';
    box.style.zIndex = highestZ;
    stage.appendChild(box);
    makeInteractive(box);
    // Update font size on resize
    box._resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
            const h = entry.target.offsetHeight;
            entry.target.style.fontSize = Math.max(10, h * 0.6) + 'px';
            entry.target.style.lineHeight = h + 'px';
        }
    });
    box._resizeObserver.observe(box);
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
    if (data.type === 'video') spawnVideo(data.src, data.id, data.x, data.y, data.filters, data.width, data.height);
    if (data.type === 'image') spawnImage(data.src, data.id, data.x, data.y, data.filters, data.width, data.height);
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
    if (data.type === 'daily-cam-duplicate' && data.session_id) {
        // Set position in store for this duplicate
        if (!window.dailyPositions) window.dailyPositions = {};
        window.dailyPositions[data.id] = { x: data.x, y: data.y };
        // Find participant info
        if (dailyCall && dailyCall.participants()[data.session_id]) {
            handleParticipant({ participant: dailyCall.participants()[data.session_id], forceDuplicate: true, id: data.id, x: data.x, y: data.y });
        }
    }
});

socket.on('init', (stageState) => {
    // Remove all current elements from the stage
    document.querySelectorAll('[data-id]').forEach(el => el.remove());
    // Recreate all elements from the state
    for (const data of stageState) {
        if (data.type === 'video') spawnVideo(data.src, data.id, data.x, data.y, data.filters, data.width, data.height);
        else if (data.type === 'image') spawnImage(data.src, data.id, data.x, data.y, data.filters, data.width, data.height);
        else if (data.type === 'text') spawnTextBox(data);
        else if (data.type === 'daily-cam' && data.session_id) {
            if (!window.dailyPositions) window.dailyPositions = {};
            window.dailyPositions[data.session_id] = { x: data.x, y: data.y };
            if (dailyCall && dailyCall.participants()[data.session_id]) {
                handleParticipant({ participant: dailyCall.participants()[data.session_id], x: data.x, y: data.y, filters: data.filters, width: data.width, height: data.height });
            }
        } else if (data.type === 'daily-cam-duplicate' && data.session_id) {
            if (!window.dailyPositions) window.dailyPositions = {};
            window.dailyPositions[data.id] = { x: data.x, y: data.y };
            if (dailyCall && dailyCall.participants()[data.session_id]) {
                handleParticipant({ participant: dailyCall.participants()[data.session_id], forceDuplicate: true, id: data.id, x: data.x, y: data.y, filters: data.filters, width: data.width, height: data.height });
            }
        }
    }
});

socket.on('move', ({ id, x, y }) => {
    const el = document.querySelector(`[data-id="${id}"]`);
    if (el) {
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
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

// --- When a Daily video is deleted, promote audio to next duplicate if any ---
function removeElement(id) {
    const el = document.querySelector(`[data-id="${id}"]`);
    if (el) {
        // If it's a Daily video, promote audio to next duplicate
        if (id.startsWith('daily-')) {
            const sessionId = id.replace('daily-', '');
            el.remove();
            // Find next duplicate
            const next = document.querySelector(`[data-id="daily-${sessionId}"]`);
            if (next && dailyCall && dailyCall.participants()[sessionId]) {
                // Re-attach with audio
                handleParticipant({ participant: dailyCall.participants()[sessionId] });
            }
            return;
        }
        el.remove();
    }
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
                start: (e) => {
                    bringToFront(e.target);
                    // Fix: set dataset.x/y to current left/top on drag start
                    const t = e.target;
                    t.dataset.x = parseInt(t.style.left, 10) || 0;
                    t.dataset.y = parseInt(t.style.top, 10) || 0;
                },
                move: (e) => {
                    const t = e.target;
                    const x = (parseFloat(t.dataset.x) || 0) + e.dx;
                    const y = (parseFloat(t.dataset.y) || 0) + e.dy;
                    t.style.left = `${x}px`;
                    t.style.top = `${y}px`;
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

// --- Compress image to max 1280x1280 and under 1MB ---
async function compressImage(file, maxSize = 1024 * 1024, maxDim = 1280) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();
        reader.onload = (e) => {
            img.onload = () => {
                let width = img.width;
                let height = img.height;
                if (width > maxDim || height > maxDim) {
                    if (width > height) {
                        height = Math.round(height * (maxDim / width));
                        width = maxDim;
                    } else {
                        width = Math.round(width * (maxDim / height));
                        height = maxDim;
                    }
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                // Try different qualities to get under maxSize
                let quality = 0.92;
                function tryCompress() {
                    const dataUrl = canvas.toDataURL('image/jpeg', quality);
                    // Estimate size in bytes
                    const size = Math.ceil((dataUrl.length - 'data:image/jpeg;base64,'.length) * 3 / 4);
                    if (size <= maxSize || quality < 0.5) {
                        resolve(dataUrl);
                    } else {
                        quality -= 0.07;
                        tryCompress();
                    }
                }
                tryCompress();
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ---------------- FILE DROP ----------------
function handleFile(file) {
    if (!file) return;
    if (file.type.startsWith('video/')) {
        if (file.size > 1024 * 1024) {
            alert('Video file too large! Max 1MB allowed.');
            return;
        }
        const url = URL.createObjectURL(file);
        spawnVideo(url);
    } else if (file.type.startsWith('image/')) {
        compressImage(file).then(dataUrl => {
            spawnImage(dataUrl);
        }).catch(() => {
            alert('Failed to compress image.');
        });
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
    // Prevent shortcuts if typing in input, textarea, or contenteditable
    const target = e.target;
    if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
    ) {
        return;
    }
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
        if (local) {
            const mainId = `daily-${local.session_id}`;
            const mainEl = document.querySelector(`[data-id="${mainId}"]`);
            if (!mainEl) {
                respawnLocalDailyCam();
                return;
            } else {
                // Create a collaborative duplicate
                const dupId = `daily-${local.session_id}-dup-${Date.now()}`;
                // Use stored position if available
                let pos = { x: 0, y: 0 };
                if (window.dailyPositions && window.dailyPositions[local.session_id]) {
                    pos = window.dailyPositions[local.session_id];
                }
                if (isConnected) {
                    socket.emit('spawn', {
                        type: 'daily-cam-duplicate',
                        id: dupId,
                        session_id: local.session_id,
                        x: pos.x + 40, // offset so it's not on top
                        y: pos.y + 40
                    });
                }
                // Also create locally for instant feedback
                handleParticipant({ participant: local, forceDuplicate: true, id: dupId, x: pos.x + 40, y: pos.y + 40 });
                return;
            }
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
    // Use custom id for duplicates
    const id = ev.id || `daily-${p.session_id}`;
    // Find all video elements for this participant with this id
    let video = document.querySelector(`[data-id="${id}"]`);
    // If this is a new duplicate, create a new element
    if (!video) {
        video = document.createElement('video');
        video.dataset.id = id;
        video.autoplay = true;
        video.playsInline = true;
        video.muted = p.local;
        // Use stored position if available
        let pos = { x: 0, y: 0 };
        if (typeof ev.x === 'number' && typeof ev.y === 'number') {
            pos = { x: ev.x, y: ev.y };
        } else if (window.dailyPositions && window.dailyPositions[id]) {
            pos = window.dailyPositions[id];
        }
        let width = ev.width || 320;
        let height = ev.height || 240;
        video.style.position = 'absolute';
        video.style.top = `${pos.y || 100 + Math.floor(Math.random() * 200)}px`;
        video.style.left = `${pos.x || 100 + Math.floor(Math.random() * 200)}px`;
        video.style.borderRadius = '0';
        video.style.border = '1px solid rgba(255,255,255,0.15)';
        video.dataset.x = pos.x;
        video.dataset.y = pos.y;
        video.style.width = `${width}px`;
        video.style.height = `${height}px`;
        video.width = width;
        video.height = height;
        // Set filters if provided
        video.dataset.filters = JSON.stringify(ev.filters || {});
        stage.appendChild(video);
        makeInteractive(video);
        updateFilters(video, false);
    }
    // --- Only one element per participant gets audio ---
    // If this is the main element (id === daily-<session_id>), attach both video and audio tracks
    // Otherwise, attach only the video track
    let tracks = [];
    if (p.videoTrack) tracks.push(p.videoTrack);
    if (id === `daily-${p.session_id}` && p.audioTrack) tracks.push(p.audioTrack);
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
    // Mobile upload button
    const btnMobileUpload = document.getElementById('mobile-upload-btn');
    if (btnMobileUpload) {
        btnMobileUpload.onclick = () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'video/*,image/*';
            input.multiple = true;
            input.onchange = ev => { for (const file of ev.target.files) handleFile(file); };
            input.click();
        };
    }
});

window.addEventListener('beforeunload', () => {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
});

// --- Joystick for viewport panning ---
(function setupJoystick() {
    const container = document.getElementById('joystick-container');
    const joystick = document.getElementById('joystick');
    const knob = document.getElementById('joystick-knob');
    if (!container || !joystick || !knob) return;
    let dragging = false;
    let startX = 0, startY = 0;
    let knobX = 0, knobY = 0;
    let panInterval = null;
    const maxDist = 20; // max px from center
    function setKnob(x, y) {
        knob.style.transform = `translate(${x}px, ${y}px)`;
    }
    function resetKnob() {
        knobX = 0; knobY = 0;
        setKnob(0, 0);
    }
    function panStage() {
        // Pan the stage by scrolling or transform
        // We'll use window.scrollBy for now (assuming the stage is larger than viewport)
        window.scrollBy(knobX * 0.5, knobY * 0.5);
    }
    function onMove(e) {
        if (!dragging) return;
        let clientX, clientY;
        if (e.touches && e.touches.length) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }
        let dx = clientX - startX;
        let dy = clientY - startY;
        // Clamp to maxDist
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > maxDist) {
            const angle = Math.atan2(dy, dx);
            dx = Math.cos(angle) * maxDist;
            dy = Math.sin(angle) * maxDist;
        }
        knobX = dx;
        knobY = dy;
        setKnob(dx, dy);
    }
    function onStart(e) {
        dragging = true;
        if (e.touches && e.touches.length) {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        } else {
            startX = e.clientX;
            startY = e.clientY;
        }
        panInterval = setInterval(panStage, 16); // ~60fps
        document.addEventListener('mousemove', onMove);
        document.addEventListener('touchmove', onMove, {passive:false});
        document.addEventListener('mouseup', onEnd);
        document.addEventListener('touchend', onEnd);
    }
    function onEnd() {
        dragging = false;
        resetKnob();
        clearInterval(panInterval);
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('mouseup', onEnd);
        document.removeEventListener('touchend', onEnd);
    }
    joystick.addEventListener('mousedown', onStart);
    joystick.addEventListener('touchstart', onStart, {passive:false});
})();