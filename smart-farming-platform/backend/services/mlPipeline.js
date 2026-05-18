const { spawn } = require('child_process');
const path = require('path');

function runXGBoostInference(features) {
    return new Promise((resolve, reject) => {
        const pythonProcess = spawn('python', [
            path.join(__dirname, '..', 'predict_xgb.py'),
            JSON.stringify(features)
        ]);

        let result = '';
        pythonProcess.stdout.on('data', (data) => {
            result += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error(`Python ML Error: ${data}`);
        });

        pythonProcess.on('close', (code) => {
            try {
                const parsed = JSON.parse(result);
                if (parsed.error) reject(parsed.error);
                else resolve(parsed.harvest_predictions);
            } catch (e) {
                reject("Failed to parse ML output");
            }
        });
    });
}

function initMLPipeline(io, pool) {
    setInterval(async () => {
        try {
            const activeBoxes = [1, 2, 3];
            for (const boxId of activeBoxes) {
                const sensorRes = await pool.query('SELECT * FROM sensor_data WHERE box_id = $1 ORDER BY timestamp DESC LIMIT 1', [boxId]);
                const cvRes = await pool.query('SELECT * FROM cv_detections WHERE box_id = $1 ORDER BY detected_at DESC LIMIT 1', [boxId]);

                if (sensorRes.rows.length === 0 || cvRes.rows.length === 0) continue;

                const s = sensorRes.rows[0];
                const c = cvRes.rows[0];
                const counts = c.detection_counts || {};

                const features = {
                    suhu_udara_c: s.air_temp,
                    kelembapan_udara_pct: s.air_humidity,
                    kelembapan_media_pct: s.media_humidity,
                    jumlah_baby_larva: counts.baby_larva || 0,
                    jumlah_adult_larva: counts.adult_larva || 0,
                    jumlah_prepupa: counts.prepupa || 0,
                    jumlah_pupa: counts.pupa || 0
                };

                const predictionDays = await runXGBoostInference(features);

                await pool.query(`
                    INSERT INTO harvest_predictions (box_id, estimated_days, predicted_at)
                    VALUES ($1, $2, NOW())
                `, [boxId, Math.round(predictionDays)]);

                io.emit("ml_harvest_update", {
                    box_id: boxId,
                    estimated_days: Math.round(predictionDays)
                });
            }
        } catch (err) {
            console.error("❌ Auto-Prediction Pipeline Error:", err.message);
        }
    }, 15000);
}

module.exports = { initMLPipeline };
