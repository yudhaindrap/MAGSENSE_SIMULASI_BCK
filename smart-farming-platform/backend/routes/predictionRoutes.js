const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const { getLatestPredictions } = require('../services/dataService');

router.get('/all', verifyToken, async (req, res) => {
    try {
        const rows = await getLatestPredictions();
        res.json(rows.map(row => {
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
