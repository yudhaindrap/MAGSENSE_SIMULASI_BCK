// backend/seed.js
require('dotenv').config();
const { Client } = require('pg');
const bcrypt = require('bcrypt');

// Konfigurasi koneksi dari file .env
const client = new Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASS,
    port: process.env.DB_PORT,
});

async function seedDatabase() {
    try {
        console.log('Menghubungkan ke database...');
        await client.connect();
        console.log('Koneksi berhasil. Memulai proses seeding...\n');

        // 1. Bersihkan data lama (opsional, hati-hati di production!)
        // CASCADE digunakan agar data terkait di tabel relasional ikut terhapus
        console.log('Membersihkan tabel lama...');
        await client.query(`
            TRUNCATE TABLE users, boxes, sensor_data, actuators, 
            cv_detections, harvest_predictions, thresholds CASCADE;
        `);

        // 2. Insert User (Admin & Operator)
        console.log('Menambahkan pengguna...');
        const salt = await bcrypt.genSalt(10);
        const adminPassword = await bcrypt.hash('admin123', salt);
        const operatorPassword = await bcrypt.hash('operator123', salt);

        await client.query(`
            INSERT INTO users (email, password_hash, role) VALUES 
            ('admin@undip.ac.id', $1, 'admin'),
            ('operator_lt2@undip.ac.id', $2, 'operator')
        `, [adminPassword, operatorPassword]);

        // 3. Insert Boxes (Lantai 2 dan 3)
        console.log('Menambahkan data box budidaya...');
        const boxResult = await client.query(`
            INSERT INTO boxes (name, floor_level, is_active) VALUES 
            ('Box Alpha', 2, true),
            ('Box Beta', 2, true),
            ('Box Gamma', 3, true)
            RETURNING id;
        `);
        const boxIds = boxResult.rows.map(row => row.id);

        // 4. Insert Data Sensor & Aktuator untuk setiap box
        console.log('Menambahkan data sensor dan status aktuator...');
        for (const boxId of boxIds) {
            // Data Sensor Historis (3 data per box)
            await client.query(`
                INSERT INTO sensor_data (box_id, air_temp, air_humidity, media_humidity) VALUES 
                ($1, 26.5, 85.0, 70.5),
                ($1, 26.8, 84.5, 69.8),
                ($1, 27.1, 83.0, 68.0)
            `, [boxId]);

            // Data Aktuator saat ini
            const actuators = ['heater', 'fan_in', 'fan_out', 'solenoid', 'servo', 'pump'];
            for (const type of actuators) {
                // Buat status random (true/false) untuk aktuator
                const status = Math.random() > 0.5;
                await client.query(`
                    INSERT INTO actuators (box_id, type, status) VALUES ($1, $2, $3)
                `, [boxId, type, status]);
            }

            // 5. Insert CV Detections
            await client.query(`
                INSERT INTO cv_detections (box_id, image_url, dominant_phase, confidence_score, detection_counts) VALUES 
                ($1, '/mock-images/box${boxId}_latest.jpg', 'Primordia', 92.5, '{"pinhead": 15, "primordia": 40, "harvestable": 2}')
            `, [boxId]);

            // 6. Insert Harvest Predictions
            const estDays = Math.floor(Math.random() * 10) + 1; // 1-10 hari
            const urgency = estDays <= 3 ? 'red' : (estDays <= 6 ? 'yellow' : 'green');
            await client.query(`
                INSERT INTO harvest_predictions (box_id, estimated_days, urgency_level) VALUES 
                ($1, $2, $3)
            `, [boxId, estDays, urgency]);
        }

        // 7. Insert Thresholds (Parameter Ambang)
        console.log('Menetapkan parameter ambang batas...');
        await client.query(`
            INSERT INTO thresholds (floor_level, temp_min, temp_max, air_hum_min, air_hum_max, media_hum_min, media_hum_max) VALUES 
            (2, 24.0, 28.0, 80.0, 95.0, 60.0, 80.0),
            (3, 24.0, 28.0, 80.0, 95.0, 60.0, 80.0),
            (NULL, 22.0, 30.0, 75.0, 99.0, 50.0, 90.0) -- Global fallback
        `);

        console.log('\n✅ Database berhasil diisi dengan data dummy!');

    } catch (error) {
        console.error('❌ Terjadi kesalahan saat seeding:', error);
    } finally {
        await client.end();
        console.log('Koneksi database ditutup.');
    }
}

seedDatabase();