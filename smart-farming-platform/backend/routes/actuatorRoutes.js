const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/auth');
const { mqttClient } = require('../services/mqttService');

router.post('/toggle', verifyToken, async (req, res) => {
    try {
        const { box_id, actuator, state } = req.body;
        const payload = JSON.stringify({ box_id, actuator, state, source: 'web_manual' });

        if (mqttClient && mqttClient.connected) {
            mqttClient.publish("maggot/kandang/kontrol", payload);
            console.log(`🎮 Manual Control Published: ${payload}`);
            res.json({ message: `Manual control sent: ${actuator} ${state ? 'ON' : 'OFF'}` });
        } else {
            console.error("MQTT Client not connected. Cannot send command.");
            res.status(503).json({ error: "Service Unavailable: MQTT Broker disconnected." });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
