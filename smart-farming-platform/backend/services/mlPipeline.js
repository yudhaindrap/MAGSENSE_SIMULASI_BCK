const { spawn } = require('child_process');
const path = require('path');
const pool = require('../db');

function runXGBoostInference(boxId) {
    return new Promise((resolve, reject) => {
        // Just pass boxId, python will connect to DB and fetch the full dataset itself
        const pythonProcess = spawn('python', [
            path.join(__dirname, '..', 'predict_xgb.py'),
            boxId.toString()
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
                const lines = result.trim().split('\n');
                const lastLine = lines[lines.length - 1]; // Often python prints pandas warnings, just get the json
                const parsed = JSON.parse(lastLine);
                if (parsed.error) reject(parsed.error);
                else resolve(parsed.harvest_predictions);
            } catch (e) {
                console.error("Raw python output:", result);
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
                // Call python ML directly to retrain and predict using historical postgres data
                const predictionDays = await runXGBoostInference(boxId);

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
            console.error("❌ Auto-Prediction Pipeline Error:", err);
        }
    }, 15000); // 15s interval
}

module.exports = { initMLPipeline };
