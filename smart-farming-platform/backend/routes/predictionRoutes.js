const express = require('express');
const router = express.Router();
const pool = require('../db');
const verifyToken = require('../middleware/auth');

router.get('/all', verifyToken, async (req, res) => {
    try {
        const query = `
            SELECT p.*, s.air_temp, s.air_humidity, s.media_humidity, c.dominant_phase, c.detection_counts
            FROM harvest_predictions p
            LEFT JOIN sensor_data s ON p.box_id = s.box_id 
            AND s.timestamp = (SELECT MAX(timestamp) FROM sensor_data WHERE box_id = p.box_id)
            LEFT JOIN cv_detections c ON p.box_id = c.box_id
            AND c.detected_at = (SELECT MAX(detected_at) FROM cv_detections WHERE box_id = p.box_id)
            WHERE p.predicted_at IN (SELECT MAX(predicted_at) FROM harvest_predictions GROUP BY box_id)
        `;
        const result = await pool.query(query);
        res.json(result.rows.map(row => {
            const counts = row.detection_counts || {};
            return {
                boxId: row.box_id,
                floor: row.box_id,
                input: `Suhu ${row.air_temp}°C, RH ${row.air_humidity}%, Media ${row.media_humidity}%`,
                dist: `${counts.adult_larva || 0} Adult, ${counts.prepupa || 0} Prepupa`,
                days: row.estimated_days,
                progress: Math.max(0, Math.min(100, 100 - (row.estimated_days * 3))),
                status: row.estimated_days <= 7 ? "warning" : "safe",
                date: new Date(Date.now() + row.estimated_days * 86400000).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
            };
        }));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
