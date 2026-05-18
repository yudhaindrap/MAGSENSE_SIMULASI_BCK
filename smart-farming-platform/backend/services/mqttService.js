const mqtt = require('mqtt');
const mqttClient = mqtt.connect("mqtt://broker.hivemq.com");

function initMQTT(io, pool) {
    mqttClient.on("connect", () => {
        console.log("✅ Backend terhubung ke MQTT Broker");
        mqttClient.subscribe("maggot/kandang/sensor", (err) => {
            if (!err) console.log("📡 Subscribe topic: maggot/kandang/sensor");
            else console.error("❌ Gagal subscribe:", err.message);
        });
    });

    mqttClient.on("message", async (topic, message) => {
        try {
            const data = JSON.parse(message.toString());
            console.log("📩 Data MQTT diterima:", data);

            const query = `
                INSERT INTO sensor_data 
                (box_id, air_temp, air_humidity, media_humidity, timestamp)
                VALUES ($1, $2, $3, $4, NOW())
            `;
            await pool.query(query, [
                data.lantai,
                data.suhu,
                data.kelembapan_udara,
                data.kelembapan_media
            ]);

            const actuators = {
                fan_in: data.suhu > 28,
                pump: data.kelembapan_media < 40,
                heater: data.suhu < 25
            };

            io.emit("telemetry_update", {
                box_id: parseInt(data.lantai),
                temperature: data.suhu,
                humidity: data.kelembapan_udara,
                media_humidity: data.kelembapan_media,
                phase: ["Larva", "Prepupa", "Pupa"][Math.floor(Math.random() * 3)],
                confidence: Math.floor(Math.random() * 10) + 90,
                fan_in: actuators.fan_in,
                pump: actuators.pump,
                heater: actuators.heater,
                harvest_est: Math.floor(Math.random() * 7),
                node_id: data.node_id,
                timestamp: new Date()
            });
        } catch (err) {
            console.error("❌ Error processing MQTT message:", err.message);
        }
    });
}

module.exports = { mqttClient, initMQTT };
