// Daily.co Configuration
// IMPORTANT: Replace the roomUrl below with your actual Daily.co room URL
// You can create a room at https://dashboard.daily.co/
const DAILY_CONFIG = {
    // TODO: Replace this with your actual Daily.co room URL
    // Example: roomUrl: 'https://mydomain.daily.co/collaborative-room'
    roomUrl: 'https://testtheline.daily.co/thelinemonolith',
    
    // Optional: Add your Daily.co API key for more features
    // Get this from https://dashboard.daily.co/developers
    // apiKey: 'your-daily-api-key',
    
    // Optional: Configure room settings
    roomSettings: {
        maxParticipants: 10,
        enableChat: false,
        enableRecording: false,
        enableScreenshare: true
    }
};

// Export for use in client.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DAILY_CONFIG;
} else {
    window.DAILY_CONFIG = DAILY_CONFIG;
}
