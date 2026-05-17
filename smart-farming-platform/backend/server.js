require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const mqtt = require('mqtt');
const os = require('os'); // Untuk mendeteksi IP lokal otomatis

const pool = require('./db');

const app = express();
const server = http.createServer(app);

/* =========================
   SOCKET.IO CONFIG
========================= */
const io = new Server(server, {
    cors: {
        origin: "*", // Mengizinkan semua perangkat di jaringan yang sama
        methods: ["GET", "POST"]
    }
});

/* =========================
   MIDDLEWARE
========================= */
app.use(helmet());
app.use(cors());
app.use(express.json());

/* =========================
   MQTT CLIENT
========================= */
const mqttClient = mqtt.connect("mqtt://broker.hivemq.com");

mqttClient.on("connect", () => {
    console.log("✅ Backend terhubung ke MQTT Broker");
    mqttClient.subscribe("maggot/kandang/sensor", (err) => {
        if (!err) console.log("📡 Subscribe topic: maggot/kandang/sensor");
        else console.error("❌ Gagal subscribe:", err.message);
    });
});

/* =========================
   MQTT HANDLER
========================= */
mqttClient.on("message", async (topic, message) => {
    try {
        const data = JSON.parse(message.toString());
        console.log("📩 Data MQTT diterima:", data);

        // 1. SIMPAN KE DATABASE
        const query = `
            INSERT INTO sensor_data 
            (box_id, air_temp, air_humidity, media_humidity, timestamp)
            VALUES ($1, $2, $3, $4, NOW())
        `;
        await pool.query(query, [
            data.lantai,
            data.suhu,
            data.kelembapan_udara,
            data.kelembapan_media
        ]);

        // 2. LOGIKA AKTUATOR OTOMATIS
        const actuators = {
            fan_in: data.suhu > 28,
            pump: data.kelembapan_media < 40,
            heater: data.suhu < 25
        };

        // 3. REALTIME KE FRONTEND (Socket.io)
        io.emit("telemetry_update", {
            box_id: parseInt(data.lantai),
            temperature: data.suhu,
            humidity: data.kelembapan_udara,
            media_humidity: data.kelembapan_media,
            phase: ["Larva", "Prepupa", "Pupa"][Math.floor(Math.random() * 3)],
            confidence: Math.floor(Math.random() * 10) + 90,
            fan_in: actuators.fan_in,
            pump: actuators.pump,
            heater: actuators.heater,
            harvest_est: Math.floor(Math.random() * 7),
            node_id: data.node_id,
            timestamp: new Date()
        });
    } catch (err) {
        console.error("❌ Error processing MQTT message:", err.message);
    }
});

/* =========================
   AUTH MIDDLEWARE
========================= */
function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(403).json({ message: "Token tidak ada" });

    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ message: "Token tidak valid" });
        req.user = decoded;
        next();
    });
}

/* =========================
   ROUTES (AUTH, DASHBOARD, HISTORY)
========================= */
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
        if (result.rows.length === 0) return res.status(401).json({ message: "User tidak ditemukan" });

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) return res.status(401).json({ message: "Password salah" });

        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        res.json({ token, role: user.role, email: user.email });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/dashboard', verifyToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT box_id, AVG(air_temp) AS avg_temp, AVG(air_humidity) AS avg_humidity
            FROM sensor_data GROUP BY box_id ORDER BY box_id
        `);
        res.json({ user: req.user, summary: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/history', verifyToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM sensor_data ORDER BY timestamp DESC LIMIT 20
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

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
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
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