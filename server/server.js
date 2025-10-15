const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios'); // <-- 1. Импортируем axios

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
// Оставляем bot для вебхуков, но не для создания счета
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
pool.query('SELECT NOW()', (err) => {
    if (err) {
        console.error('!!! Ошибка подключения к базе данных:', err);
        process.exit(1);
    } else {
        console.log('--- База данных успешно подключена');
    }
});

// --- Middleware ---
app.use(cors());
app.use(express.json());


// --- API ЭНДПОИНТЫ ---

// --- 2. ПОЛНОСТЬЮ ПЕРЕПИСАННЫЙ ЭНДПОИНТ ---
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
            // Telegram вернул успешный ответ, в котором есть ссылка
            res.status(200).json({ invoiceLink: response.data.result });
        } else {
            // Telegram вернул ошибку
            res.status(500).json({ error: response.data.description });
        }

    } catch (err) {
        console.error('Критическая ошибка при запросе к API Telegram:', err.response ? err.response.data : err.message);
        const errorDescription = err.response ? err.response.data.description : 'Не удалось создать счет для оплаты.';
        res.status(500).json({ error: errorDescription });
    }
});


// Webhook для получения обновлений от Telegram
app.post(`/webhook/${BOT_TOKEN}`, express.json(), async (req, res) => {
    const update = req.body;
    if (update.pre_checkout_query) {
        bot.answerPreCheckoutQuery(update.pre_checkout_query.id, true).catch(err => console.error('Ошибка pre_checkout_query:', err));
    } else if (update.message && update.message.successful_payment) {
        console.log('Получен успешный платеж:', update.message.successful_payment);
        try {
            const payload = JSON.parse(update.message.successful_payment.invoice_payload);
            const { userId, amount } = payload;
            const query = `
              INSERT INTO users (id, total_top_up) VALUES ($1, $2)
              ON CONFLICT (id) DO UPDATE SET total_top_up = users.total_top_up + $2;
            `;
            await pool.query(query, [userId, amount]);
            console.log(`Пользователю ${userId} успешно зачислено ${amount} звезд.`);
        } catch (err) {
            console.error('Ошибка при зачислении звезд в БД:', err);
        }
    }
    res.sendStatus(200);
});

// ... (остальные ваши эндпоинты: /api/leaderboard, /api/topup)
app.get('/api/leaderboard', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, first_name, username, photo_url, total_top_up FROM users ORDER BY total_top_up DESC LIMIT 15'
        );
        res.json(result.rows.map((user, index) => ({
            ...user,
            rank: index + 1,
            name: user.first_name || user.username || `User ${user.id}`,
            amount: user.total_top_up,
            avatar: user.photo_url || '/images/profile.png'
        })));
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
            VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO UPDATE
            SET total_top_up = users.total_top_up + $5,
                first_name = EXCLUDED.first_name,
                username = EXCLUDED.username,
                photo_url = EXCLUDED.photo_url;
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
