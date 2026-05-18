const express = require('express');
const router = express.Router();
const pool = require('../db');
const verifyToken = require('../middleware/auth');

router.get('/all', verifyToken, async (req, res) => {
    try {
        const boxes = [1, 2, 3];
        const result = [];
        for (const id of boxes) {
            const sensor = await pool.query('SELECT * FROM sensor_data WHERE box_id = $1 ORDER BY timestamp DESC LIMIT 1', [id]);
            const cv = await pool.query('SELECT * FROM cv_detections WHERE box_id = $1 ORDER BY detected_at DESC LIMIT 1', [id]);

            if (sensor.rows.length > 0) {
                const s = sensor.rows[0];
                const c = cv.rows[0] || { dominant_phase: "Monitoring", confidence_score: 100, detection_counts: {} };
                result.push({
                    id: s.box_id,
                    floor: s.box_id,
                    temp: parseFloat(s.air_temp),
                    humidity: parseFloat(s.air_humidity),
                    media: parseFloat(s.media_humidity),
                    tempStatus: s.air_temp > 28 ? 'warning' : 'normal',
                    humStatus: 'normal',
                    mediaStatus: s.media_humidity < 40 ? 'warning' : 'normal',
                    phase: c.dominant_phase,
                    activeActuators: [
                        ...(s.air_temp > 28 ? ['Kipas Exhaust'] : []),
                        ...(s.media_humidity < 40 ? ['Solenoid Valve'] : []),
                        ...(s.air_temp < 25 ? ['Lampu Heater'] : [])
                    ]
                });
            }
        }
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
