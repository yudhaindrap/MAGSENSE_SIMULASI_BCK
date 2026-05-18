const express = require('express');
const router = express.Router();
const pool = require('../db');
const verifyToken = require('../middleware/auth');

router.get('/', verifyToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT box_id, AVG(air_temp) AS avg_temp, AVG(air_humidity) AS avg_humidity, AVG(media_humidity) AS avg_media_humidity
            FROM sensor_data GROUP BY box_id ORDER BY box_id
        `);
        res.json({ user: req.user, summary: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/latest/:box_id', verifyToken, async (req, res) => {
    try {
        const { box_id } = req.params;

        const sensorRes = await pool.query('SELECT * FROM sensor_data WHERE box_id = $1 ORDER BY timestamp DESC LIMIT 1', [box_id]);
        const cvRes = await pool.query('SELECT * FROM cv_detections WHERE box_id = $1 ORDER BY detected_at DESC LIMIT 1', [box_id]);
        const predRes = await pool.query('SELECT * FROM harvest_predictions WHERE box_id = $1 ORDER BY predicted_at DESC LIMIT 1', [box_id]);

        if (sensorRes.rows.length === 0) return res.status(404).json({ error: "Data belum tersedia" });

        const s = sensorRes.rows[0];
        const c = cvRes.rows.length > 0 ? cvRes.rows[0] : null;
        const p = predRes.rows.length > 0 ? predRes.rows[0] : null;

        const actuators = {
            fan_in: s.air_temp > 28,
            pump: s.media_humidity < 40,
            heater: s.air_temp < 25
        };

        res.json({
            box_id: parseInt(box_id),
            air_temp: s.air_temp,
            air_humidity: s.air_humidity,
            media_humidity: s.media_humidity,
            cv_latest: {
                phase: c ? c.dominant_phase : "Monitoring",
                confidence: c ? c.confidence_score : 100,
                counts: c ? c.detection_counts : {}
            },
            harvest_est: p ? p.estimated_days : 0,
            actuators: actuators,
            timestamp: s.timestamp
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
