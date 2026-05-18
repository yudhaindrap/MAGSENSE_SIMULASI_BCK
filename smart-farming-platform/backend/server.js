require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const { Server } = require('socket.io');
const os = require('os');
const pool = require('./db');

// Import Background Services
const { initMQTT } = require('./services/mqttService');
const { initMLPipeline } = require('./services/mlPipeline');

// Import Routes
const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const historyRoutes = require('./routes/historyRoutes');
const monitoringRoutes = require('./routes/monitoringRoutes');
const predictionRoutes = require('./routes/predictionRoutes');
const thresholdsRoutes = require('./routes/thresholdsRoutes');
const actuatorRoutes = require('./routes/actuatorRoutes');
const profileRoutes = require('./routes/profileRoutes');
const chartsRoutes = require('./routes/chartsRoutes');

const app = express();
const server = http.createServer(app);

/* =========================
   SOCKET.IO CONFIG
========================= */
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// Attach io to Express app instance to be accessible in routes
app.set('io', io);

/* =========================
   MIDDLEWARE
========================= */
app.use(helmet());
app.use(cors());
app.use(express.json());

/* =========================
   INITIALIZE SERVICES
========================= */
initMQTT(io, pool);
initMLPipeline(io, pool);

/* =========================
   REGISTER ROUTES
========================= */
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/predictions', predictionRoutes);
app.use('/api/thresholds', thresholdsRoutes);
app.use('/api/actuators', actuatorRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/charts', chartsRoutes);

/* =========================
   SOCKET CONNECTION LOG
========================= */
io.on("connection", (socket) => {
    console.log(`🔌 Client connected to Node.js Backend: ${socket.id}`);
    socket.on("disconnect", () => {
        console.log(`❌ Client disconnected from Node.js Backend: ${socket.id}`);
    });
});

/* =========================
   START SERVER & IP DETECTION
========================= */
const PORT = process.env.PORT || 5000;
const getLocalIP = () => {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) return iface.address;
        }
    }
    return 'localhost';
};

server.listen(PORT, '0.0.0.0', () => {
    const localIP = getLocalIP();
    console.log(`\n🚀 Server Backend sudah aktif!`);
    console.log(`-----------------------------------------`);
    console.log(`🏠 Local:   http://localhost:${PORT}`);
    console.log(`🌐 Network: http://${localIP}:${PORT}`);
    console.log(`-----------------------------------------\n`);
});