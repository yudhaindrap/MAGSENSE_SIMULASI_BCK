const express = require('express');
const router = express.Router();
const pool = require('../db');
const verifyToken = require('../middleware/auth');

router.get('/:box_id', verifyToken, async (req, res) => {
    try {
        const { box_id } = req.params;
        const result = await pool.query(`
            SELECT to_char(timestamp, 'HH24:MI') as time, air_temp as temp, air_humidity as hum
            FROM sensor_data WHERE box_id = $1 ORDER BY timestamp DESC LIMIT 20
        `, [box_id]);
        res.json(result.rows.reverse());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
