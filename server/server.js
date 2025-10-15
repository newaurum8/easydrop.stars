const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');

// --- Переменные окружения ---
const BOT_TOKEN = process.env.BOT_TOKEN;

if (!process.env.DATABASE_URL) {
    console.error('FATAL ERROR: Переменная окружения DATABASE_URL не установлена.');
    process.exit(1);
}
if (!BOT_TOKEN) {
    console.error('FATAL ERROR: Переменная окружения BOT_TOKEN не установлена.');
    process.exit(1);
}

// --- Инициализация ---
const bot = new TelegramBot(BOT_TOKEN);
const app = express();
const PORT = process.env.PORT || 3001;

// --- Подключение к PostgreSQL ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('!!! Ошибка подключения к базе данных:', err);
        process.exit(1);
    } else {
        console.log('--- База данных успешно подключена:', res.rows[0].now);
    }
});

// --- Middleware ---
app.use(cors());
app.use(express.json());


// --- API ЭНДПОИНТЫ ---

// Эндпоинт для создания счета на оплату
app.post('/api/create-invoice', async (req, res) => {
    const { amount, userId } = req.body;

    if (!amount || amount <= 0 || !userId) {
        return res.status(400).json({ error: 'Неверная сумма или ID пользователя' });
    }

    try {
        const title = `Top up for ${amount} stars`;
        const description = `Balance top-up in Easydrop Stars for ${amount} stars.`;
        const payload = JSON.stringify({ userId, amount, type: 'topup' });
        const currency = 'XTR';
        const prices = [{ label: `${amount} stars`, amount: parseInt(amount) }];

        const invoiceOptions = {
            title,
            description,
            payload,
            currency,
            prices,
            is_flexible: false,
        };

        const invoiceLink = await bot.createInvoiceLink(invoiceOptions);
        res.status(200).json({ invoiceLink });

    } catch (err) {
        const errorBody = err.response ? err.response.body : err.message;
        console.error('Ошибка при создании счета в Telegram:', errorBody);
        const errorDescription = err.response ? JSON.parse(err.response.body).description : 'Не удалось создать счет для оплаты.';
        res.status(500).json({ error: errorDescription });
    }
});

// Webhook для получения обновлений от Telegram
app.post(`/webhook/${BOT_TOKEN}`, express.json(), async (req, res) => {
    const update = req.body;

    if (update.pre_checkout_query) {
        try {
            await bot.answerPreCheckoutQuery(update.pre_checkout_query.id, true);
        } catch (err) {
            console.error('Ошибка подтверждения pre_checkout_query:', err);
        }
    } else if (update.message && update.message.successful_payment) {
        console.log('Получен успешный платеж:', update.message.successful_payment);
        try {
            const payload = JSON.parse(update.message.successful_payment.invoice_payload);
            const { userId, amount } = payload;
            const query = `
              INSERT INTO users (id, total_top_up)
              VALUES ($1, $2)
              ON CONFLICT (id) DO UPDATE
              SET total_top_up = users.total_top_up + $2
              RETURNING *;
            `;
            const values = [userId, amount];
            await pool.query(query, values);
            console.log(`Пользователю ${userId} успешно зачислено ${amount} звезд.`);
        } catch (err) {
            console.error('Ошибка при зачислении звезд в БД:', err);
        }
    }
    res.sendStatus(200);
});

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
        console.error('Ошибка при ручном пополнении:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// --- РАЗДАЧА ФРОНТЕНДА ---
app.use(express.static(path.join(__dirname, '..', 'build')));
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'build', 'index.html'));
});

// --- ЗАПУСК СЕРВERA И УСТАНОВКА ВЕБХУКА ---
app.listen(PORT, async () => {
    console.log(`--- Сервер запущен и слушает порт ${PORT}`);
    try {
        // Установка Webhook (этот код выполнится один раз при запуске)
        const WEBHOOK_URL = `https://easydrop-stars-1.onrender.com/webhook/${BOT_TOKEN}`;
        await bot.setWebHook(WEBHOOK_URL, {
            allowed_updates: ["pre_checkout_query", "message"]
        });
        console.log(`Webhook успешно установлен на: ${WEBHOOK_URL}`);
    } catch (err) {
        console.error("Ошибка установки webhook:", err);
    }
});
