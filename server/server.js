const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// PORT CONFIGURATION
const HTTP_PORT = 5000; // API runs here
const WS_PORT = 3001;   // WebSockets run here

// 1. WEBSOCKET SERVER (The Bridge to TouchDesigner)
const wss = new WebSocket.Server({ port: WS_PORT });

wss.on('connection', (ws) => {
    console.log('Client connected to DJ Deck');
    
    ws.on('message', (message) => {
        // Broadcast the message to TouchDesigner (and everyone else)
        wss.clients.forEach(client => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    });
});

// 2. SEARCH API (The YouTube Proxy)
app.get('/api/search', async (req, res) => {
    const query = req.query.q;
    const API_KEY = process.env.YOUTUBE_API_KEY;

    if (!API_KEY) {
        // Mock data if you haven't set up the key yet
        return res.json({ items: [
            { id: { videoId: 'dQw4w9WgXcQ' }, snippet: { title: 'Mock Video - Add API Key', thumbnails: { medium: { url: '' } } } } 
        ]});
    }

    try {
        const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
            params: { part: 'snippet', maxResults: 10, q: query, type: 'video', key: API_KEY }
        });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(HTTP_PORT, () => {
    console.log(`Backend running! API: http://localhost:${HTTP_PORT}, WS: ws://localhost:${WS_PORT}`);
});