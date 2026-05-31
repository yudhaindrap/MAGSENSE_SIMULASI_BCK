const pool = require('../db');

async function getAggregatedMikroklimat() {
    const result = await pool.query(`
        SELECT box_id, AVG(air_temp) AS avg_temp, AVG(air_humidity) AS avg_humidity, AVG(media_humidity) AS avg_media_humidity
        FROM sensor_data GROUP BY box_id ORDER BY box_id
    `);
    return result.rows;
}

async function getLatestPredictions() {
    const query = `
        SELECT p.*, s.air_temp, s.air_humidity, s.media_humidity, c.dominant_phase, c.detection_counts
        FROM harvest_predictions p
        LEFT JOIN sensor_data s ON p.box_id = s.box_id 
        AND s.timestamp = (SELECT MAX(timestamp) FROM sensor_data WHERE box_id = p.box_id)
        LEFT JOIN cv_detections c ON p.box_id = c.box_id
        AND c.detected_at = (SELECT MAX(detected_at) FROM cv_detections WHERE box_id = p.box_id)
        WHERE p.predicted_at IN (SELECT MAX(predicted_at) FROM harvest_predictions GROUP BY box_id)
        ORDER BY p.box_id ASC
    `;
    const result = await pool.query(query);
    return result.rows;
}

module.exports = { getAggregatedMikroklimat, getLatestPredictions };
