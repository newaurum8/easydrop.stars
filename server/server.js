const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

try {
    const app = express();
    const PORT = process.env.PORT || 3001;

    console.log('Server starting...');

    if (!process.env.DATABASE_URL) {
        console.error('FATAL ERROR: Переменная окружения DATABASE_URL не установлена.');
        process.exit(1);
    }

    // --- ПОДКЛЮЧЕНИЕ К POSTGRESQL ---
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });

    // Пробный запрос для проверки подключения
    pool.query('SELECT NOW()', (err, res) => {
        if (err) {
            console.error('!!! Ошибка подключения к базе данных:', err);
            process.exit(1); // Завершаем процесс с ошибкой, если не удалось подключиться
        } else {
            console.log('--- База данных успешно подключена:', res.rows[0].now);
        }
    });

    app.use(cors());
    app.use(express.json());

    // --- API ЭНДПОИНТЫ ---
    app.get('/api/leaderboard', async (req, res) => {
        try {
            const result = await pool.query(
                'SELECT id, first_name, username, photo_url, total_top_up FROM users ORDER BY total_top_up DESC LIMIT 15'
            );
            const leaderboard = result.rows.map((user, index) => ({
                ...user,
                rank: index + 1,
                name: user.first_name || user.username || `User ${user.id}`,
                amount: user.total_top_up,
                avatar: user.photo_url || '/images/profile.png'
            }));
            res.json(leaderboard);
        } catch (err) {
            console.error('Ошибка при получении рейтинга:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    app.post('/api/topup', async (req, res) => {
        const { userId, firstName, username, photoUrl, amount } = req.body;
        if (!userId || !amount) {
            return res.status(400).json({ error: 'userId and amount are required' });
        }
        try {
            const query = `
              INSERT INTO users (id, first_name, username, photo_url, total_top_up)
              VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT (id) DO UPDATE
              SET total_top_up = users.total_top_up + $5,
                  first_name = EXCLUDED.first_name,
                  username = EXCLUDED.username,
                  photo_url = EXCLUDED.photo_url
              RETURNING *;
            `;
            const values = [userId, firstName || null, username || null, photoUrl || null, amount];
            const result = await pool.query(query, values);
            res.status(200).json(result.rows[0]);
        } catch (err) {
            console.error('Ошибка при пополнении:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // --- РАЗДАЧА ФРОНТЕНДА ---
    app.use(express.static(path.join(__dirname, '..', 'build')));
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '..', 'build', 'index.html'));
    });

    app.listen(PORT, () => {
        console.log(`--- Сервер запущен и слушает порт ${PORT}`);
    });

} catch (e) {
    console.error('Критическая ошибка при запуске сервера:', e);
    process.exit(1);
}
