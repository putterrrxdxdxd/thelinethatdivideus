# The Line That Divide Us - Daily.co Integration

This collaborative archive editing app now uses Daily.co for video communication instead of WebRTC.

## Setup Instructions

### 1. Create a Daily.co Account
1. Go to [https://dashboard.daily.co/](https://dashboard.daily.co/)
2. Sign up for a free account
3. Create a new room or use an existing one

### 2. Configure the Room URL
1. Open `public/config.js`
2. Replace the `roomUrl` with your actual Daily.co room URL:
   ```javascript
   roomUrl: 'https://your-domain.daily.co/your-room-name'
   ```

### 3. Install Dependencies
```bash
npm install
```

### 4. Start the Server
```bash
npm start
```

### 5. Access the Application
Open your browser and go to `http://localhost:3000`

## Features

- **Video Communication**: Uses Daily.co for reliable video calls
- **Collaborative Stage**: Multiple users can work on the same stage
- **Media Support**: Drag and drop images and videos
- **Real-time Sync**: All changes sync across connected users
- **Interactive Elements**: Move, resize, and apply filters to media

## Keyboard Shortcuts

- `W` - Spawn webcam
- `V` - Spawn video
- `I` - Spawn image
- `D` - Open file dialog
- `X` - Delete hovered element
- `G` - Toggle grayscale filter
- `B` - Toggle blur filter
- `I` - Toggle invert filter
- `C` - Toggle contrast filter
- `L` - Toggle brightness filter
- `[` - Decrease filter intensity
- `]` - Increase filter intensity
- `↑` - Increase opacity
- `↓` - Decrease opacity

## Daily.co Integration Benefits

- **Reliable Connection**: Daily.co handles WebRTC complexity
- **Better Performance**: Optimized video streaming
- **Cross-platform**: Works on all modern browsers
- **Scalable**: Handles multiple participants efficiently
- **Built-in Features**: Screen sharing, recording, etc.

## Troubleshooting

### Video Not Working
1. Check that your browser supports getUserMedia
2. Ensure you have granted camera/microphone permissions
3. Verify your Daily.co room URL is correct
4. Check browser console for error messages

### Connection Issues
1. Verify your internet connection
2. Check that Daily.co services are accessible
3. Try refreshing the page
4. Check browser console for connection errors

## Configuration Options

You can customize the Daily.co integration in `public/config.js`:

```javascript
const DAILY_CONFIG = {
    roomUrl: 'your-room-url',
    apiKey: 'your-api-key', // Optional
    roomSettings: {
        maxParticipants: 10,
        enableChat: false,
        enableRecording: false,
        enableScreenshare: true
    }
};
```

## Development

The app uses:
- **Express.js** - Server framework
- **Socket.IO** - Real-time communication
- **Daily.co** - Video communication
- **Interact.js** - Drag and drop functionality
