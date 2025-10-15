const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios'); // Для прямых HTTP-запросов к API Telegram
const { getHttpEndpoint } = require('@orbs-network/ton-access');
const { TonClient, Cell } = require('ton');

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
const bot = new TelegramBot(BOT_TOKEN); // Используется для обработки вебхуков
const app = express();
const PORT = process.env.PORT || 3001;

// --- Подключение к PostgreSQL ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
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

// Эндпоинт для создания счета в Telegram Stars
app.post('/api/create-invoice', async (req, res) => {
    const { amount, userId } = req.body;
    if (!amount || amount <= 0 || !userId) {
        return res.status(400).json({ error: 'Неверная сумма или ID пользователя' });
    }

    const TELEGRAM_API_URL = `https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`;
    const invoiceData = {
        title: `Пополнение на ${amount} звезд`,
        description: `Пополнение баланса в приложении Easydrop Stars на ${amount} звезд.`,
        payload: JSON.stringify({ userId, amount, type: 'topup' }),
        currency: 'XTR',
        prices: [{ label: `${amount} звезд`, amount: parseInt(amount) }]
    };

    try {
        const response = await axios.post(TELEGRAM_API_URL, invoiceData);
        if (response.data.ok) {
            res.status(200).json({ invoiceLink: response.data.result });
        } else {
            res.status(500).json({ error: response.data.description });
        }
    } catch (err) {
        console.error('Критическая ошибка при запросе к API Telegram:', err.response ? err.response.data : err.message);
        const errorDescription = err.response ? (err.response.data.description || 'Не удалось создать счет для оплаты.') : 'Не удалось создать счет для оплаты.';
        res.status(500).json({ error: errorDescription });
    }
});

// Эндпоинт для проверки TON транзакции (ТРЕБУЕТ ДОРАБОТКИ ДЛЯ PRODUCTION)
app.post('/api/verify-ton-payment', async (req, res) => {
    const { boc, userId } = req.body;
    if (!boc || !userId) {
        return res.status(400).json({ error: 'BOC or userId is missing' });
    }
    try {
        const endpoint = await getHttpEndpoint({ network: 'mainnet' });
        const client = new TonClient({ endpoint });
        await client.sendFile(Cell.fromBoc(Buffer.from(boc, 'base64'))[0].toBoc());
        
        // ВАЖНО: Это упрощенная логика. Для реального проекта нужна полноценная
        // проверка транзакции в блокчейне перед начислением.
        console.log(`Транзакция от пользователя ${userId} отправлена в сеть.`);
        
        res.status(200).json({ success: true, message: 'Платеж в обработке.' });
    } catch (error) {
        console.error('Ошибка проверки TON транзакции:', error);
        res.status(500).json({ success: false, error: 'Failed to verify transaction' });
    }
});


// Webhook для получения обновлений от Telegram
app.post(`/webhook/${BOT_TOKEN}`, express.json(), async (req, res) => {
    const update = req.body;
    if (update.pre_checkout_query) {
        bot.answerPreCheckoutQuery(update.pre_checkout_query.id, true).catch(err => console.error('Ошибка pre_checkout_query:', err));
    } else if (update.message && update.message.successful_payment) {
        try {
            const payload = JSON.parse(update.message.successful_payment.invoice_payload);
            const { userId, amount } = payload;
            
            // Запрос на обновление данных пользователя
            const query = `
              INSERT INTO users (id, total_top_up)
              VALUES ($1, $2)
              ON CONFLICT (id) DO UPDATE
              SET total_top_up = users.total_top_up + $2;
            `;
            await pool.query(query, [userId, amount]);
            console.log(`Пользователю ${userId} успешно зачислено ${amount} звезд.`);
        } catch (err) {
            console.error('Ошибка при зачислении звезд в БД:', err);
        }
    }
    res.sendStatus(200);
});


// Эндпоинт для получения рейтинга
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

// Эндпоинт для ручного обновления данных пользователя (не для платежей)
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

// --- ЗАПУСК СЕРВЕРА ---
app.listen(PORT, () => {
    console.log(`--- Сервер запущен и слушает порт ${PORT}`);
    // Вебхук уже должен быть установлен. Если нет, используйте код из предыдущих ответов для одноразовой установки.
});
