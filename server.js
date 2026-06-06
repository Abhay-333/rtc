import app from "./src/app.js";
import connectDb from "./src/config/db.js";
import { Server } from "socket.io";
import http from "http";
import socketHandler from "./src/socket/socketHandler.js";
import path from 'path';
import express from 'express';
import fs from 'fs';
import { fileURLToPath } from 'url';

connectDb();

const port = process.env.PORT || 3000;

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO with CORS
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Initialize socket handlers
socketHandler(io);

// Serve frontend static build if available
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendBuildPath = process.env.FRONTEND_BUILD_PATH || path.resolve(__dirname, '..', 'frontend', 'dist');

if (fs.existsSync(frontendBuildPath)) {
  console.log('Serving frontend from', frontendBuildPath);
  app.use((req, res, next) => {
    // Let API and socket routes proceed
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
    return next();
  });
  app.use(express.static(frontendBuildPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
  });
} else {
  console.log('Frontend build not found at', frontendBuildPath);
}

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});