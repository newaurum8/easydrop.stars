const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api'); // <-- Импортируем библиотеку

// --- Переменные окружения ---
const BOT_TOKEN = process.env.BOT_TOKEN; // Токен вашего бота из @BotFather

if (!process.env.DATABASE_URL) {
    console.error('FATAL ERROR: Переменная окружения DATABASE_URL не установлена.');
    process.exit(1);
}
if (!BOT_TOKEN) {
    console.error('FATAL ERROR: Переменная окружения BOT_TOKEN не установлена.');
    process.exit(1);
}

// --- Инициализация ---
const bot = new TelegramBot(BOT_TOKEN); // Инициализация бота
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
        const invoice = {
            title: `Пополнение на ${amount} звезд`,
            description: `Пополнение баланса в приложении Easydrop Stars на ${amount} звезд.`,
            // Уникальный payload, чтобы понять, какой платеж обрабатывать
            payload: JSON.stringify({ userId, amount, type: 'topup' }),
            currency: 'XTR', // Валюта для Telegram Stars
            prices: [{ label: `${amount} звезд`, amount: parseInt(amount) }]
        };

        const invoiceLink = await bot.createInvoiceLink(invoice);
        res.status(200).json({ invoiceLink });

    } catch (err) {
        console.error('Ошибка при создании счета в Telegram:', err.response ? err.response.body : err);
        res.status(500).json({ error: 'Не удалось создать счет для оплаты.' });
    }
});

// Webhook для получения обновлений от Telegram (включая информацию об оплате)
app.post(`/webhook/${BOT_TOKEN}`, express.json(), async (req, res) => {
    const update = req.body;

    // 1. Подтверждаем готовность принять платеж
    if (update.pre_checkout_query) {
        try {
            await bot.answerPreCheckoutQuery(update.pre_checkout_query.id, true);
        } catch (err) {
            console.error('Ошибка подтверждения pre_checkout_query:', err);
        }
    }
    // 2. Обрабатываем успешный платеж
    else if (update.message && update.message.successful_payment) {
        console.log('Получен успешный платеж:', update.message.successful_payment);

        try {
            const payload = JSON.parse(update.message.successful_payment.invoice_payload);
            const { userId, amount } = payload;

            // Начисляем звезды пользователю в базе данных
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
            // Здесь стоит добавить логику для оповещения администратора,
            // т.к. деньги списались, а звезды не зачислились.
        }
    }

    res.sendStatus(200); // Всегда отвечаем 200, чтобы Telegram не повторял отправку
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

// Этот эндпоинт больше не нужен для пополнения, но может использоваться для других целей
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
app.listen(PORT, async () => {
    console.log(`--- Сервер запущен и слушает порт ${PORT}`);
    try {
        // Установка Webhook (нужно выполнить один раз после деплоя)
        // const WEBHOOK_URL = `https://your-app-domain.com/webhook/${BOT_TOKEN}`;
        // await bot.setWebHook(WEBHOOK_URL, {
        //     allowed_updates: ["pre_checkout_query", "message"]
        // });
        // console.log(`Webhook успешно установлен на: ${WEBHOOK_URL}`);
    } catch (err) {
        console.error("Ошибка установки webhook:", err);
    }
});
