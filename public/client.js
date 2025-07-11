// Connect to Socket.IO server
const socket = io();

let highestZ = 1; // Track topmost layer
const stage = document.getElementById('stage');
const dropZone = document.getElementById('drop-zone');

// Bring element to front
function bringToFront(el) {
    highestZ++;
    el.style.zIndex = highestZ;
}

// Make element interactive (drag, resize, z-index control)
function makeInteractive(el) {
    bringToFront(el);
    interact(el)
        .draggable({
            listeners: {
                start(event) {
                    bringToFront(event.target);
                },
                move(event) {
                    const target = event.target;
                    const x = (parseFloat(target.dataset.x) || 0) + event.dx;
                    const y = (parseFloat(target.dataset.y) || 0) + event.dy;
                    target.style.transform = `translate(${x}px, ${y}px)`;
                    target.dataset.x = x;
                    target.dataset.y = y;

                    // Sync move with server
                    socket.emit('move', {
                        id: target.dataset.id,
                        x, y
                    });
                }
            }
        })
        .resizable({
            edges: { left: true, right: true, bottom: true, top: true },
            listeners: {
                move(event) {
                    const target = event.target;
                    target.style.width = `${event.rect.width}px`;
                    target.style.height = `${event.rect.height}px`;

                    // Sync resize with server
                    socket.emit('resize', {
                        id: target.dataset.id,
                        width: event.rect.width,
                        height: event.rect.height
                    });
                }
            }
        });
}

// Spawn Webcam
function spawnWebcam(id = null) {
    const webcam = document.createElement('video');
    webcam.dataset.id = id || Date.now();
    webcam.autoplay = true;
    webcam.playsInline = true;
    webcam.muted = true;
    webcam.style.position = 'absolute';
    webcam.style.top = '100px';
    webcam.style.left = '100px';
    webcam.width = 320;
    webcam.height = 240;
    stage.appendChild(webcam);
    makeInteractive(webcam);

    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then(stream => { webcam.srcObject = stream; })
        .catch(err => console.error('Webcam error:', err));

    if (!id) {
        socket.emit('spawn', { type: 'webcam', id: webcam.dataset.id });
    }
}

// Spawn Video
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

    if (!id) {
        socket.emit('spawn', { type: 'video', src, id: video.dataset.id });
    }
}

// Spawn Image
function spawnImage(src = 'archives/image1.jpg', id = null) {
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

    if (!id) {
        socket.emit('spawn', { type: 'image', src, id: img.dataset.id });
    }
}

// Handle file drop/upload
function handleFile(file) {
    if (!file) return;
    const url = URL.createObjectURL(file);

    if (file.type.startsWith('video/')) {
        spawnVideo(url);
    } else if (file.type.startsWith('image/')) {
        spawnImage(url);
    } else {
        alert('Unsupported file type: ' + file.type);
    }
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    switch (e.key.toLowerCase()) {
        case 'w': spawnWebcam(); break;
        case 'v': spawnVideo(); break;
        case 'i': spawnImage(); break;
        case 'd': {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'video/*,image/*';
            input.onchange = ev => handleFile(ev.target.files[0]);
            input.click();
            break;
        }
        case 'delete': {
            if (hoveredElement) {
                const id = hoveredElement.dataset.id;
                hoveredElement.remove();
                socket.emit('delete', { id });
                hoveredElement = null;
            }
            break;
        }
    }
});

// Drag & drop files
window.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.display = 'flex';
});
window.addEventListener('dragleave', () => {
    dropZone.style.display = 'none';
});
window.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.display = 'none';
    const file = e.dataTransfer.files[0];
    handleFile(file);
});

// Hover tracking for filters
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

// Listen for updates from server
socket.on('spawn', data => {
    if (data.type === 'webcam') spawnWebcam(data.id);
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

