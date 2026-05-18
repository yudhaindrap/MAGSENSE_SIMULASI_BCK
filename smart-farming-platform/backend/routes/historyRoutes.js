const express = require('express');
const router = express.Router();
const pool = require('../db');
const verifyToken = require('../middleware/auth');

router.get('/', verifyToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM sensor_data ORDER BY timestamp DESC LIMIT 20
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/extended', verifyToken, async (req, res) => {
    try {
        const query = `
            SELECT s.*, c.dominant_phase 
            FROM sensor_data s
            LEFT JOIN cv_detections c ON s.box_id = c.box_id AND s.timestamp = c.detected_at
            ORDER BY s.timestamp DESC LIMIT 50
        `;
        const result = await pool.query(query);
        res.json(result.rows.map(r => ({
            id: r.id,
            time: new Date(r.timestamp).toLocaleString('id-ID'),
            box: r.box_id,
            temp: parseFloat(r.air_temp),
            rh: parseFloat(r.air_humidity),
            media: parseFloat(r.media_humidity),
            phase: r.dominant_phase || 'Monitoring',
            act: r.air_temp > 28 ? 'Kipas' : (r.media_humidity < 40 ? 'Valve' : '-'),
            status: (r.air_temp > 28 || r.media_humidity < 40) ? 'warning' : 'normal'
        })));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
