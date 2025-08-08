const socket = io({
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 20000
});

let dailyCall = null;
let highestZ = 1;
let participants = new Map();
let isConnected = false;
let hoveredElement = null;

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

// ---------------- DAILY.CO INIT ----------------
async function initializeDailyCall() {
    if (dailyCall) return dailyCall;

    const roomUrl = window.DAILY_CONFIG?.roomUrl;
    if (!roomUrl) {
        alert("❌ No Daily.co room URL configured");
        return;
    }

    console.log('🔗 Connecting to Daily.co room:', roomUrl);

    dailyCall = window.DailyIframe.createFrame(document.createElement('div'), {
        iframeStyle: { width: '100%', height: '100%', border: '0' }
    });

    // Append the Daily.co iframe to the hidden container so camera/mic access works
    const dailyContainer = document.getElementById('daily-container');
    if (dailyContainer && !dailyCall.iframe().parentElement) {
        dailyContainer.appendChild(dailyCall.iframe());
    }

    dailyCall.on('joined-meeting', () => {
        console.log('✅ Joined Daily.co meeting');
    });

    dailyCall.on('participant-joined', (event) => {
        console.log('👤 Participant joined:', event.participant);
        participants.set(event.participant.session_id, event.participant);
        spawnWebcam();
    });

    dailyCall.on('track-started', (event) => {
        console.log('🎥 Track started:', event.participant);
        spawnWebcam();
    });

    dailyCall.on('participant-updated', (event) => {
        console.log('🔄 Participant updated:', event.participant);
        participants.set(event.participant.session_id, event.participant);
    });

    dailyCall.on('participant-left', (event) => {
        console.log('👋 Participant left:', event.participant);
        participants.delete(event.participant.session_id);
        removeElement(`daily-webcam-${event.participant.session_id}`);
    });

    dailyCall.on('camera-error', (event) => {
        console.error('📹 Camera error:', event);
        alert('Camera error: ' + event.errorMsg);
    });

    dailyCall.on('mic-error', (event) => {
        console.error('🎤 Microphone error:', event);
        alert('Microphone error: ' + event.errorMsg);
    });

    dailyCall.on('error', (event) => {
        console.error('❌ Daily.co error:', event);
        alert('Daily.co error: ' + event.errorMsg);
    });

    await dailyCall.join({ url: roomUrl });

    const localParticipant = dailyCall.participants().local;
    if (localParticipant) {
        console.log('👤 Local participant:', localParticipant);
        participants.set(localParticipant.session_id, localParticipant);
    }
    return dailyCall;
}

// ---------------- SPAWN WEBCAM ----------------
function spawnWebcam() {
    if (!dailyCall) {
        console.log('❌ Daily.co not initialized - cannot spawn webcam');
        return;
    }

    const allParticipants = dailyCall.participants();
    console.log('📊 All participants:', allParticipants);

    Object.values(allParticipants).forEach(participant => {
        const participantId = `daily-webcam-${participant.session_id}`;
        if (document.querySelector(`[data-id="${participantId}"]`)) {
            console.log('📹 Webcam already exists for participant:', participant.session_id);
            return;
        }

        console.log('📹 Spawning webcam for participant:', participant.session_id, participant.local ? '(local)' : '(remote)');

        // Create video element
        const video = document.createElement('video');
        video.dataset.id = participantId;
        video.dataset.filters = '{}';
        video.autoplay = true;
        video.playsInline = true;
        video.muted = participant.local; // Mute local to avoid echo
        video.style.position = 'absolute';
        video.style.top = `${100 + Math.floor(Math.random() * 200)}px`;
        video.style.left = `${100 + Math.floor(Math.random() * 200)}px`;
        video.width = 320;
        video.height = 240;
        video.style.objectFit = 'cover';
        video.style.borderRadius = '8px';
        video.style.border = participant.local ? '2px solid #28a745' : '2px solid #007bff';
        video.style.backgroundColor = '#000';

        // Create name label
        const nameLabel = document.createElement('div');
        nameLabel.textContent = participant.user_name || (participant.local ? 'You' : 'Participant');
        nameLabel.style.position = 'absolute';
        nameLabel.style.top = '-20px';
        nameLabel.style.left = '0';
        nameLabel.style.background = 'rgba(0,0,0,0.7)';
        nameLabel.style.color = 'white';
        nameLabel.style.padding = '2px 6px';
        nameLabel.style.fontSize = '10px';
        nameLabel.style.borderRadius = '3px';
        nameLabel.style.zIndex = '10';

        // Create container
        const container = document.createElement('div');
        container.style.position = 'relative';
        container.appendChild(video);
        container.appendChild(nameLabel);

        stage.appendChild(container);
        makeInteractive(container);

        // Attach Daily.co tracks using the video element
        try {
            dailyCall.attachParticipantTracks(
                participant.session_id,
                video,
                { video: true, audio: !participant.local }
            );
            console.log('✅ Video tracks attached for participant:', participant.session_id);
        } catch (error) {
            console.error('❌ Failed to attach tracks for participant:', participant.session_id, error);
            
            // Fallback: try to get tracks manually
            try {
                if (participant.video) {
                    video.srcObject = participant.video;
                    console.log('✅ Fallback: Manual video stream attached for participant:', participant.session_id);
                }
            } catch (fallbackError) {
                console.error('❌ Fallback failed for participant:', participant.session_id, fallbackError);
            }
        }
    });

    if (isConnected) {
        socket.emit('spawn', { type: 'webcam', id: 'daily-webcam', peerId: socket.id });
        console.log('📤 Broadcasted webcam spawn to other users');
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

    if (!id.includes('-from-server') && isConnected) {
        socket.emit('spawn', { type: 'video', src, id });
    }
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

    if (!id.includes('-from-server') && isConnected) {
        socket.emit('spawn', { type: 'image', src, id });
    }
}

// ---------------- SOCKET EVENTS ----------------
socket.on('spawn', (data) => {
    console.log('📥 Received spawn event:', data);
    if (data.type === 'webcam') spawnWebcam();
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

socket.on('filter', ({ id, filters, sender }) => {
    if (sender === socket.id) return;
    const el = document.querySelector(`[data-id="${id}"]`);
    if (el) {
        el.dataset.filters = JSON.stringify(filters);
        updateFilters(el, false);
    }
});

socket.on('delete', ({ id }) => removeElement(id));

function removeElement(id) {
    const el = document.querySelector(`[data-id="${id}"]`);
    if (el) {
        console.log('🗑️ Removing element:', id);
        el.remove();
    }
}

// ---------------- INTERACT.JS ----------------
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
                    if (isConnected) {
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
    
    // Media spawning shortcuts
    if (key === 'w') {
        spawnWebcam();
        return;
    }
    if (key === 'v') {
        spawnVideo();
        return;
    }
    if (key === 'i') {
        spawnImage('archives/image1.jpg');
        return;
    }
    if (key === 'd') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'video/*,image/*';
        input.multiple = true;
        input.onchange = ev => { for (const file of ev.target.files) handleFile(file); };
        input.click();
        return;
    }
    
    // Delete selected element
    if (key === 'x' && hoveredElement) {
        const id = hoveredElement.dataset.id;
        hoveredElement.remove();
        if (isConnected) socket.emit('delete', { id });
        hoveredElement = null;
        return;
    }
    
    // Daily.co status check
    if (key === 's' && e.ctrlKey) {
        checkDailyCoStatus();
        return;
    }
    
    // Debug elements
    if (key === 'e' && e.ctrlKey) {
        debugElements();
        return;
    }
    
    // Filter shortcuts (only if element is hovered)
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
    // Find the element with data-id (could be the target or its parent container)
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

// ---------------- DAILY.CO STATUS CHECK ----------------
function checkDailyCoStatus() {
    if (!dailyCall) {
        console.log('❌ Daily.co not initialized');
        return false;
    }
    
    console.log('📊 Daily.co Status:');
    console.log('- Local Audio:', dailyCall.localAudio());
    console.log('- Local Video:', dailyCall.localVideo());
    console.log('- Participants:', participants.size);
    console.log('- Room URL:', window.DAILY_CONFIG?.roomUrl);
    
    return true;
}

// ---------------- DEBUG FUNCTIONS ----------------
function debugElements() {
    const allElements = document.querySelectorAll('[data-id]');
    console.log('🔍 All elements on stage:', allElements.length);
    allElements.forEach(el => {
        console.log(`- ${el.dataset.id}: ${el.tagName} at (${el.style.left}, ${el.style.top})`);
        console.log(`  Visible: ${el.offsetWidth > 0 && el.offsetHeight > 0}`);
        console.log(`  Style: width=${el.style.width}, height=${el.style.height}`);
    });
}

// ---------------- INIT ----------------
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Initializing Daily.co...');
    try {
        await initializeDailyCall();
        updateConnectionStatus('connected', 'Connected + Daily Ready');
        console.log('✅ Daily.co initialized successfully');
    } catch (err) {
        console.error('❌ Failed to initialize Daily.co:', err);
        updateConnectionStatus('disconnected', 'Daily Failed');
    }
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (dailyCall) {
        dailyCall.destroy();
    }
});