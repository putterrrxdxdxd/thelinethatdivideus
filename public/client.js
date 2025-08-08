const socket = io({
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 20000
});

let dailyCall = null;
let localStream = null;
let highestZ = 1;
let participants = new Map();
let isConnected = false;

const stage = document.getElementById('stage');
const dropZone = document.getElementById('drop-zone');

// Socket.IO Connection Management
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

// 📷 Get webcam stream using Daily.co
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

// 🌐 Daily.co connection management
async function initializeDailyCall() {
    if (dailyCall) return dailyCall;
    
    // Use room URL from configuration
    const roomUrl = window.DAILY_CONFIG?.roomUrl || 'https://your-daily-domain.daily.co/your-room-name';
    
    dailyCall = window.DailyIframe.createFrame(document.createElement('div'), {
        iframeStyle: {
            width: '100%',
            height: '100%',
            border: '0',
            borderRadius: '12px',
        },
        showLeaveButton: true,
    });

    dailyCall.on('joined-meeting', () => {
        console.log('Joined Daily.co meeting');
    });

    dailyCall.on('participant-joined', (event) => {
        console.log('Participant joined:', event.participant);
        participants.set(event.participant.session_id, event.participant);
        spawnRemoteParticipant(event.participant);
    });

    dailyCall.on('participant-updated', (event) => {
        console.log('Participant updated:', event.participant);
        participants.set(event.participant.session_id, event.participant);
        updateRemoteParticipant(event.participant);
    });

    dailyCall.on('participant-left', (event) => {
        console.log('Participant left:', event.participant);
        participants.delete(event.participant.session_id);
        removeRemoteParticipant(event.participant.session_id);
    });

    dailyCall.on('camera-error', (event) => {
        console.error('Camera error:', event);
        alert('Camera error: ' + event.errorMsg);
    });

    dailyCall.on('mic-error', (event) => {
        console.error('Microphone error:', event);
        alert('Microphone error: ' + event.errorMsg);
    });

    try {
        await dailyCall.join({ url: roomUrl });
        return dailyCall;
    } catch (error) {
        console.error('Failed to join Daily.co call:', error);
        alert('Failed to join video call: ' + error.errorMsg);
        return null;
    }
}

// Spawn remote participant video
function spawnRemoteParticipant(participant) {
    if (participant.local) return; // Don't spawn local participant
    
    const containerId = `daily-participant-${participant.session_id}`;
    if (document.querySelector(`[data-id="${containerId}"]`)) return;

    const container = document.createElement('div');
    container.dataset.id = containerId;
    container.dataset.participant = participant.session_id;
    container.style.position = 'absolute';
    container.style.top = `${200 + Math.floor(Math.random() * 200)}px`;
    container.style.left = `${200 + Math.floor(Math.random() * 200)}px`;
    container.style.width = '320px';
    container.style.height = '260px';
    container.style.backgroundColor = '#000';
    container.style.borderRadius = '8px';
    container.style.overflow = 'hidden';

    stage.appendChild(container);
    makeInteractive(container);

    const video = document.createElement('video');
    video.dataset.id = `video-${participant.session_id}`;
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.width = 320;
    video.height = 240;
    video.style.display = 'block';
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'cover';

    const controls = document.createElement('div');
    controls.style.position = 'absolute';
    controls.style.bottom = '0';
    controls.style.left = '0';
    controls.style.right = '0';
    controls.style.background = 'rgba(0,0,0,0.7)';
    controls.style.padding = '4px';
    controls.style.display = 'flex';
    controls.style.gap = '4px';

    const muteBtn = document.createElement('button');
    muteBtn.textContent = 'Mute';
    muteBtn.style.flex = '1';
    muteBtn.style.padding = '2px';
    muteBtn.style.fontSize = '10px';
    muteBtn.style.cursor = 'pointer';
    muteBtn.addEventListener('click', () => {
        video.muted = !video.muted;
        muteBtn.textContent = video.muted ? 'Unmute' : 'Mute';
    });

    const nameLabel = document.createElement('span');
    nameLabel.textContent = participant.user_name || 'Anonymous';
    nameLabel.style.color = 'white';
    nameLabel.style.fontSize = '10px';
    nameLabel.style.flex = '2';
    nameLabel.style.textAlign = 'center';
    nameLabel.style.lineHeight = '16px';

    controls.appendChild(nameLabel);
    controls.appendChild(muteBtn);
    container.appendChild(video);
    container.appendChild(controls);

    // Set video source from Daily.co
    if (participant.video) {
        video.srcObject = participant.video;
    }
}

// Update remote participant video
function updateRemoteParticipant(participant) {
    const containerId = `daily-participant-${participant.session_id}`;
    const container = document.querySelector(`[data-id="${containerId}"]`);
    if (!container) return;

    const video = container.querySelector('video');
    if (video && participant.video) {
        video.srcObject = participant.video;
    }

    const nameLabel = container.querySelector('span');
    if (nameLabel) {
        nameLabel.textContent = participant.user_name || 'Anonymous';
    }
}

// Remove remote participant video
function removeRemoteParticipant(sessionId) {
    const containerId = `daily-participant-${sessionId}`;
    const container = document.querySelector(`[data-id="${containerId}"]`);
    if (container) {
        container.remove();
    }
}

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
        getWebcamStream().then(s => { if (s) webcam.srcObject = s; });
    }

    if (!id.includes('-from-server') && isConnected) {
        socket.emit('spawn', { type: 'webcam', id, peerId });
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
    if (!id.includes('-from-server') && isConnected) socket.emit('spawn', { type: 'video', src, id });
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
    if (!id.includes('-from-server') && isConnected) socket.emit('spawn', { type: 'image', src, id });
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

socket.on('spawn', (data) => {
    if (data.type === 'webcam') {
        spawnWebcam(data.id, data.peerId);
    } else if (data.type === 'video') {
        spawnVideo(data.src, data.id);
    } else if (data.type === 'image') {
        spawnImage(data.src, data.id);
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
    if (send && isConnected) socket.emit('filter', { id: el.dataset.id, filters, sender: socket.id });
}

// ----- Keyboard shortcuts -----
document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (key === 'w') {
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
    if (key === 'x' && hoveredElement) {
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

// Initialize Daily.co call when page loads
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM Content Loaded');
    await initializeDailyCall();
    initializeControlPanel();
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (dailyCall) {
        dailyCall.destroy();
    }
});
// Control Panel Functionality
function initializeControlPanel() {
    console.log('Initializing control panel...');
    
    // Wait a bit to ensure DOM is fully loaded
    setTimeout(() => {
        const controlBtn = document.getElementById('control-btn');
        const controlPanel = document.getElementById('control-panel');
        const closeBtn = document.getElementById('close-control-panel');
        
        console.log('Control button found:', controlBtn);
        console.log('Control panel found:', controlPanel);
        console.log('Close button found:', closeBtn);
        
        if (!controlBtn) {
            console.error('Control button not found!');
            return;
        }
        
        if (!controlPanel) {
            console.error('Control panel not found!');
            return;
        }
        
        if (!closeBtn) {
            console.error('Close button not found!');
            return;
        }
        
        // Toggle control panel
        controlBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Control button clicked!');
            const currentDisplay = controlPanel.style.display;
            console.log('Current display:', currentDisplay);
            controlPanel.style.display = currentDisplay === 'block' ? 'none' : 'block';
            console.log('New display:', controlPanel.style.display);
        });
        
        // Close control panel
        closeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Close button clicked!');
            controlPanel.style.display = 'none';
        });
        
        // Close panel when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === controlPanel) {
                controlPanel.style.display = 'none';
            }
        });
        
        // Test button functionality
        console.log('Adding test click handler...');
        controlBtn.onclick = function(e) {
            e.preventDefault();
            console.log('Test click handler triggered!');
            controlPanel.style.display = controlPanel.style.display === 'block' ? 'none' : 'block';
        };
        
        // Media Controls
        const spawnWebcamBtn = document.getElementById('spawn-webcam-btn');
        const spawnVideoBtn = document.getElementById('spawn-video-btn');
        const spawnImageBtn = document.getElementById('spawn-image-btn');
        const uploadMediaBtn = document.getElementById('upload-media-btn');
        
        if (spawnWebcamBtn) {
            spawnWebcamBtn.addEventListener('click', () => {
                spawnWebcam();
                controlPanel.style.display = 'none';
            });
        }
        
        if (spawnVideoBtn) {
            spawnVideoBtn.addEventListener('click', () => {
                spawnVideo();
                controlPanel.style.display = 'none';
            });
        }
        
        if (spawnImageBtn) {
            spawnImageBtn.addEventListener('click', () => {
                spawnImage('archives/image1.jpg');
                controlPanel.style.display = 'none';
            });
        }
        
        if (uploadMediaBtn) {
            uploadMediaBtn.addEventListener('click', () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'video/*,image/*';
                input.multiple = true;
                input.onchange = ev => { 
                    for (const file of ev.target.files) handleFile(file); 
                };
                input.click();
                controlPanel.style.display = 'none';
            });
        }
        
        // Quick Actions
        const deleteSelectedBtn = document.getElementById('delete-selected-btn');
        const bringToFrontBtn = document.getElementById('bring-to-front-btn');
        const sendToBackBtn = document.getElementById('send-to-back-btn');
        
        if (deleteSelectedBtn) {
            deleteSelectedBtn.addEventListener('click', () => {
                if (hoveredElement) {
                    const id = hoveredElement.dataset.id;
                    hoveredElement.remove();
                    socket.emit('delete', { id });
                    hoveredElement = null;
                }
                controlPanel.style.display = 'none';
            });
        }
        
        if (bringToFrontBtn) {
            bringToFrontBtn.addEventListener('click', () => {
                if (hoveredElement) {
                    bringToFront(hoveredElement);
                }
                controlPanel.style.display = 'none';
            });
        }
        
        if (sendToBackBtn) {
            sendToBackBtn.addEventListener('click', () => {
                if (hoveredElement) {
                    hoveredElement.style.zIndex = '0';
                }
                controlPanel.style.display = 'none';
            });
        }
        
        // Daily.co Controls
        const joinCallBtn = document.getElementById('join-call-btn');
        const leaveCallBtn = document.getElementById('leave-call-btn');
        const toggleMicBtn = document.getElementById('toggle-mic-btn');
        const toggleCameraBtn = document.getElementById('toggle-camera-btn');
        
        if (joinCallBtn) {
            joinCallBtn.addEventListener('click', async () => {
                if (!dailyCall) {
                    await initializeDailyCall();
                }
                controlPanel.style.display = 'none';
            });
        }
        
        if (leaveCallBtn) {
            leaveCallBtn.addEventListener('click', () => {
                if (dailyCall) {
                    dailyCall.destroy();
                    dailyCall = null;
                }
                controlPanel.style.display = 'none';
            });
        }
        
        if (toggleMicBtn) {
            toggleMicBtn.addEventListener('click', () => {
                if (dailyCall) {
                    dailyCall.setLocalAudio(!dailyCall.localAudio());
                }
                controlPanel.style.display = 'none';
            });
        }
        
        if (toggleCameraBtn) {
            toggleCameraBtn.addEventListener('click', () => {
                if (dailyCall) {
                    dailyCall.setLocalVideo(!dailyCall.localVideo());
                }
                controlPanel.style.display = 'none';
            });
        }
        
        // Filter Controls
        const filterSliders = [
            { id: 'grayscale-slider', filter: 'grayscale' },
            { id: 'blur-slider', filter: 'blur' },
            { id: 'brightness-slider', filter: 'brightness' },
            { id: 'contrast-slider', filter: 'contrast' },
            { id: 'invert-slider', filter: 'invert' },
            { id: 'opacity-slider', filter: 'opacity' }
        ];
        
        filterSliders.forEach(({ id, filter }) => {
            const slider = document.getElementById(id);
            if (slider) {
                slider.addEventListener('input', (e) => {
                    if (hoveredElement) {
                        const filters = JSON.parse(hoveredElement.dataset.filters || '{}');
                        const value = filter === 'opacity' ? e.target.value / 100 : e.target.value;
                        filters[filter] = value;
                        hoveredElement.dataset.filters = JSON.stringify(filters);
                        updateFilters(hoveredElement);
                    }
                });
            }
        });
        
        console.log('Control panel initialization complete!');
    }, 100);
}

