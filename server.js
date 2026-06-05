import app from "./src/app.js";
import connectDb from "./src/config/db.js";
import { Server } from "socket.io";
import http from "http";
import socketHandler from "./src/socket/socketHandler.js";

connectDb();

const port = process.env.PORT || 5000;

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO with CORS
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Initialize socket handlers
socketHandler(io);

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});