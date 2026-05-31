const express = require('express');
const router = express.Router();
const pool = require('../db');
const verifyToken = require('../middleware/auth');
const { getAggregatedMikroklimat, getLatestPredictions } = require('../services/dataService');

router.get('/all', verifyToken, async (req, res) => {
    try {
        const summaries = await getAggregatedMikroklimat();
        const predictions = await getLatestPredictions();
        
        const boxes = [1, 2, 3];
        const result = [];
        
        for (const id of boxes) {
            const summary = summaries.find(s => s.box_id === id);
            const p = predictions.find(pred => pred.box_id === id);
            const sensor = await pool.query('SELECT * FROM sensor_data WHERE box_id = $1 ORDER BY timestamp DESC LIMIT 1', [id]);

            if (sensor.rows.length > 0 && summary) {
                const s = sensor.rows[0];
                result.push({
                    id: s.box_id,
                    floor: s.box_id,
                    temp: parseFloat(summary.avg_temp), // USING AGGREGATED METRIC (Requirement 3)
                    humidity: parseFloat(summary.avg_humidity), // USING AGGREGATED METRIC (Requirement 3)
                    media: parseFloat(summary.avg_media_humidity), // USING AGGREGATED METRIC (Requirement 3)
                    tempStatus: summary.avg_temp > 28 ? 'warning' : 'normal',
                    humStatus: 'normal',
                    mediaStatus: summary.avg_media_humidity < 40 ? 'warning' : 'normal',
                    phase: p ? p.dominant_phase : 'Monitoring',
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