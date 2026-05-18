const express = require('express');
const router = express.Router();
const pool = require('../db');
const verifyToken = require('../middleware/auth');

// 1. GET thresholds berdasarkan lantai (Dinamis)
router.get('/:floor', verifyToken, async (req, res) => {
    const floor = parseInt(req.params.floor) || 1;
    try {
        const result = await pool.query('SELECT * FROM thresholds WHERE floor_level = $1', [floor]);

        // Jika konfigurasi lantai belum ada di DB, kirim nilai default ke frontend
        if (result.rows.length === 0) {
            return res.json({
                floorLevel: floor,
                tempMin: 25.0, tempMax: 35.0,
                mediaMin: 40.0, mediaMax: 65.0,
                humAirMin: 60.0, humAirMax: 85.0
            });
        }

        const t = result.rows[0];
        res.json({
            floorLevel: parseInt(t.floor_level),
            tempMin: parseFloat(t.temp_min),
            tempMax: parseFloat(t.temp_max),
            mediaMin: parseFloat(t.media_hum_min),
            mediaMax: parseFloat(t.media_hum_max),
            humAirMin: parseFloat(t.air_hum_min),
            humAirMax: parseFloat(t.air_hum_max)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. POST untuk simpan/update thresholds (Aman tanpa ON CONFLICT)
router.post('/', verifyToken, async (req, res) => {
    try {
        const { floorLevel, tempMin, tempMax, mediaMin, mediaMax, humAirMin, humAirMax } = req.body;

        // Langkah A: Cek apakah data untuk lantai ini sudah pernah terdaftar
        const checkExist = await pool.query('SELECT id FROM thresholds WHERE floor_level = $1', [floorLevel]);

        if (checkExist.rows.length > 0) {
            // Langkah B: Jika sudah ada, lakukan UPDATE berdasarkan floor_level
            const updateQuery = `
                UPDATE thresholds SET 
                    temp_min = $1, 
                    temp_max = $2, 
                    media_hum_min = $3, 
                    media_hum_max = $4, 
                    air_hum_min = $5, 
                    air_hum_max = $6
                WHERE floor_level = $7
            `;
            await pool.query(updateQuery, [tempMin, tempMax, mediaMin, mediaMax, humAirMin, humAirMax, floorLevel]);
        } else {
            // Langkah C: Jika belum ada, lakukan INSERT data baru
            const insertQuery = `
                INSERT INTO thresholds (floor_level, temp_min, temp_max, media_hum_min, media_hum_max, air_hum_min, air_hum_max)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `;
            await pool.query(insertQuery, [floorLevel, tempMin, tempMax, mediaMin, mediaMax, humAirMin, humAirMax]);
        }

        // Kirim sinyal update ke Socket.io untuk sinkronisasi otomatis
        const io = req.app.get('io');
        if (io) {
            io.emit("thresholds_updated", req.body);
        }

        res.json({ message: `Thresholds untuk Lantai ${floorLevel} berhasil diperbarui` });
    } catch (err) {
        console.error("Update error:", err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;