const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const { getAggregatedMikroklimat, getLatestPredictions } = require('../services/dataService');
const pool = require('../db');

router.get('/', verifyToken, async (req, res) => {
    try {
        const summary = await getAggregatedMikroklimat();
        res.json({ user: req.user, summary });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/latest/:box_id', verifyToken, async (req, res) => {
    try {
        const { box_id } = req.params;

        const sensorRes = await pool.query('SELECT * FROM sensor_data WHERE box_id = $1 ORDER BY timestamp DESC LIMIT 1', [box_id]);
        
        // Use consistent latest prediction
        const allPredictions = await getLatestPredictions();
        const p = allPredictions.find(pred => pred.box_id === parseInt(box_id)) || null;

        if (sensorRes.rows.length === 0) return res.status(404).json({ error: "Data belum tersedia" });

        const s = sensorRes.rows[0];

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
                phase: p ? p.dominant_phase : "Monitoring",
                confidence: 100,
                counts: p ? p.detection_counts : {}
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
