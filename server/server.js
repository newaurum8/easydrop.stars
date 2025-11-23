const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const { getHttpEndpoint } = require('@orbs-network/ton-access');
const { TonClient, Cell } = require('ton');

// --- КОНФИГУРАЦИЯ ---

// 1. Токен бота (Укажите свой токен)
const BOT_TOKEN = process.env.BOT_TOKEN || '7749005658:AAFWYi3WOr05YliMALym8klSl5zX8qK01tQ'; 

// 2. Кошелек админа (Для справки, переводы идут на кошелек, указанный в клиенте)
const ADMIN_WALLET_ADDRESS = 'UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJKZ'; 

// 3. База данных (Строка подключения к PostgreSQL)
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_UjHpMaRQo56v@ep-wild-rain-a4ouqppu-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const app = express();
const PORT = process.env.PORT || 3001;

// Инициализация бота (polling для обработки платежей Stars)
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

app.use(cors());
app.use(express.json());

// --- ПОДКЛЮЧЕНИЕ К БД ---
const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: true
});

// --- ДАННЫЕ ДЛЯ ИНИЦИАЛИЗАЦИИ (SEEDING) ---
// Используются только если база данных пустая
const INITIAL_PRIZES = [
    { id: 'c1_item_1', name: 'Золотые часы', image: '/images/case/item.png', value: 250000, chance: 1 },
    { id: 'c1_item_2', name: 'Кепка Telegram', image: '/images/case/item1.png', value: 12000, chance: 5 },
    { id: 'c1_item_3', name: 'Роза', image: '/images/case/item2.png', value: 10000, chance: 10 },
    { id: 'c1_item_4', name: 'Подарок', image: '/images/case/item3.png', value: 2600, chance: 20 },
    { id: 'c1_item_5', name: 'Цилиндр', image: '/images/case/item4.png', value: 1500, chance: 24 },
    { id: 'c1_item_6', name: 'Ретро-авто', image: '/images/case/item5.png', value: 900, chance: 40 },
    { id: 'c1_item_7', name: 'Обезьянка', image: '/images/case/item6.png', value: 500, chance: 50 },
    { id: 'c1_item_8', name: 'Бенгальский огонь', image: '/images/case/item7.png', value: 300, chance: 60 },
    { id: 'c1_item_9', name: 'Бриллиант', image: '/images/case/item8.png', value: 100, chance: 70 },
    { id: 'c2_item_1', name: 'Кольцо с бриллиантом', image: '/images/case1/item1.png', value: 300000, chance: 1 },
    { id: 'c2_item_2', name: 'Леденец', image: '/images/case1/item2.png', value: 15000, chance: 5 },
    { id: 'c2_item_3', name: 'Ракета', image: '/images/case1/item3.png', value: 12000, chance: 10 },
    { id: 'c2_item_4', name: 'Золотой кубок', image: '/images/case1/item4.png', value: 8000, chance: 20 },
    { id: 'c2_item_5', name: 'Коробка с бантом', image: '/images/case1/item5.png', value: 4000, chance: 24 },
    { id: 'c2_item_6', name: 'Синий бриллиант', image: '/images/case1/item6.png', value: 2000, chance: 40 },
    { id: 'c2_item_7', name: 'Букет тюльпанов', image: '/images/case1/item7.png', value: 1000, chance: 50 },
    { id: 'c2_item_8', name: 'Искорка', image: '/images/case1/item8.png', value: 500, chance: 60 },
];

const INITIAL_CASES = [
    { id: 'case_1', name: 'Классический', image: '/images/case.png', price: 2500, prizeIds: ['c1_item_1','c1_item_2','c1_item_3','c1_item_4','c1_item_5','c1_item_6','c1_item_7','c1_item_8','c1_item_9'], isPromo: false, tag: 'common' },
    { id: 'case_2', name: 'Сладкий', image: '/images/case1.png', price: 7500, prizeIds: ['c2_item_1','c2_item_2','c2_item_3','c2_item_4','c2_item_5','c2_item_6','c2_item_7','c2_item_8'], isPromo: false, tag: 'common' },
    { id: 'case_3', name: 'Праздничный', image: '/images/case2.png', price: 15000, prizeIds: ['c1_item_5','c1_item_6','c1_item_7','c1_item_8','c2_item_1','c2_item_2','c2_item_3','c2_item_4'], isPromo: false, tag: 'rare' },
    { id: 'case_4', name: 'Редкий', image: '/images/case3.png', price: 20000, prizeIds: ['c2_item_1','c2_item_2','c2_item_3','c2_item_4','c2_item_5','c2_item_6'], isPromo: false, tag: 'rare' },
    { id: 'case_5', name: 'Элитный', image: '/images/case4.png', price: 50000, prizeIds: ['c1_item_1','c1_item_2','c1_item_3','c1_item_4'], isPromo: false, tag: 'legendary' },
    { id: 'case_6', name: 'Коллекционный', image: '/images/case5.png', price: 100000, prizeIds: ['c2_item_1','c2_item_2','c2_item_3'], isPromo: false, tag: 'legendary' },
    { id: 'case_7', name: 'Мифический', image: '/images/case6.png', price: 250000, prizeIds: ['c1_item_1', 'c2_item_1'], isPromo: false, tag: 'legendary' },
    { id: 'case_8', name: 'Легендарный', image: '/images/case7.png', price: 500000, prizeIds: ['c1_item_1', 'c2_item_1', 'c1_item_2'], isPromo: false, tag: 'legendary' },
    { id: 'promo_case', name: 'Промо-кейс', image: '/images/case8.png', price: 0, prizeIds: ['c1_item_4','c1_item_5','c1_item_6','c2_item_7','c2_item_8'], isPromo: true, tag: 'promo' }
];

// --- ИНИЦИАЛИЗАЦИЯ ТАБЛИЦ БД ---
const initDB = async () => {
    try {
        // Таблица пользователей
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id BIGINT PRIMARY KEY, 
                first_name TEXT, 
                username TEXT, 
                photo_url TEXT, 
                balance INT DEFAULT 0, 
                inventory JSONB DEFAULT '[]', 
                history JSONB DEFAULT '[]', 
                total_top_up INT DEFAULT 0
            );
        `);
        
        // Таблица транзакций
        await pool.query(`
            CREATE TABLE IF NOT EXISTS transactions (
                id SERIAL PRIMARY KEY, 
                tx_hash TEXT UNIQUE NOT NULL, 
                user_id BIGINT NOT NULL, 
                amount DECIMAL NOT NULL, 
                currency TEXT NOT NULL, 
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        
        // Таблица предметов (призов)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS prizes (
                id TEXT PRIMARY KEY, 
                name TEXT NOT NULL, 
                image TEXT NOT NULL, 
                value INT NOT NULL, 
                chance FLOAT NOT NULL
            );
        `);
        
        // Таблица кейсов
        await pool.query(`
            CREATE TABLE IF NOT EXISTS cases (
                id TEXT PRIMARY KEY, 
                name TEXT NOT NULL, 
                image TEXT NOT NULL, 
                price INT NOT NULL, 
                prize_ids JSONB NOT NULL, 
                is_promo BOOLEAN DEFAULT FALSE, 
                tag TEXT DEFAULT 'common'
            );
        `);
        
        // --- МИГРАЦИИ (для обновления существующих таблиц) ---
        try {
            // Добавляем колонку tag, если её нет (для редкости кейса)
            await pool.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS tag TEXT DEFAULT 'common'`);
            // Добавляем колонку image, если её нет
            await pool.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS image TEXT`);
        } catch (e) { 
            console.log('Migration info:', e.message); 
        }

        // --- ЗАПОЛНЕНИЕ ДАННЫМИ (SEEDING) ---
        const prizeCount = await pool.query('SELECT COUNT(*) FROM prizes');
        if (parseInt(prizeCount.rows[0].count) === 0) {
            console.log('Seeding prizes...');
            for (const item of INITIAL_PRIZES) {
                await pool.query(
                    'INSERT INTO prizes (id, name, image, value, chance) VALUES ($1, $2, $3, $4, $5)', 
                    [item.id, item.name, item.image, item.value, item.chance]
                );
            }
        }

        const caseCount = await pool.query('SELECT COUNT(*) FROM cases');
        if (parseInt(caseCount.rows[0].count) === 0) {
            console.log('Seeding cases...');
            for (const c of INITIAL_CASES) {
                await pool.query(
                    'INSERT INTO cases (id, name, image, price, prize_ids, is_promo, tag) VALUES ($1, $2, $3, $4, $5, $6, $7)', 
                    [c.id, c.name, c.image, c.price, JSON.stringify(c.prizeIds), c.isPromo || false, c.tag || 'common']
                );
            }
        }
        console.log('>>> DB initialized successfully');
    } catch (err) { 
        console.error('DB Init Error:', err); 
    }
};

initDB();

// --- ЛОГИКА НАЧИСЛЕНИЯ БАЛАНСА ---
async function creditUserBalance(userId, amount, txHash, currency) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Проверка на дубликаты транзакций
        const check = await client.query('SELECT id FROM transactions WHERE tx_hash = $1', [txHash]);
        if (check.rows.length > 0) {
            await client.query('ROLLBACK');
            return { success: false, message: 'Transaction already processed' };
        }
        
        // Запись транзакции
        await client.query(
            'INSERT INTO transactions (tx_hash, user_id, amount, currency) VALUES ($1, $2, $3, $4)', 
            [txHash, userId, amount, currency]
        );

        // Расчет звезд (Курс конвертации)
        let starsToAdd = 0;
        if (currency === 'TON') {
            // 1 TON = 3000 звезд
            starsToAdd = amount * 3000; 
        } else {
            // 1 Telegram Star (XTR) = 50 внутренних звезд
            starsToAdd = amount * 50; 
        }

        // Обновление баланса пользователя
        await client.query(
            'UPDATE users SET balance = balance + $1, total_top_up = total_top_up + $1 WHERE id = $2', 
            [Math.floor(starsToAdd), userId]
        );
        
        await client.query('COMMIT');
        console.log(`User ${userId} credited with ${starsToAdd} stars (${amount} ${currency})`);
        return { success: true };
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Credit Balance Error:', err);
        return { success: false, message: 'DB Error' };
    } finally {
        client.release();
    }
}

// ==================================================
// === ОБРАБОТЧИКИ TELEGRAM (STARS) ===
// ==================================================

bot.on('pre_checkout_query', async (query) => {
    try {
        await bot.answerPreCheckoutQuery(query.id, true);
        console.log(`✅ Pre-checkout allowed for ${query.id}`);
    } catch (error) {
        console.error('❌ Pre-checkout failed:', error.message);
    }
});

bot.on('message', async (msg) => {
    if (msg.successful_payment) {
        const payment = msg.successful_payment;
        const payload = JSON.parse(payment.invoice_payload);
        
        console.log(`💰 Payment success: ${payment.total_amount} XTR from user ${payload.userId}`);
        
        await creditUserBalance(
            payload.userId, 
            payment.total_amount, 
            payment.telegram_payment_charge_id, 
            'XTR'
        );
    }
});

// ==================================================
// === API ENDPOINTS ===
// ==================================================

// Создание счета на оплату в Stars
app.post('/api/create-invoice', async (req, res) => {
    const { amount, userId } = req.body;
    try {
        const balanceAmount = amount * 50; 
        const title = `Пополнение на ${balanceAmount} звезд`;
        const description = `Оплата ${amount} Telegram Stars`;

        const link = await bot.createInvoiceLink(
            title, 
            description, 
            JSON.stringify({ userId, amount, ts: Date.now() }), 
            "", // Provider token пустой для Stars
            "XTR", 
            [{ label: "Stars", amount: parseInt(amount) }]
        );
        res.json({ invoiceLink: link });
    } catch (err) {
        console.error("Invoice Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Проверка оплаты TON (через фронтенд и смарт-контракт)
app.post('/api/verify-ton-payment', async (req, res) => {
    const { boc, userId, amount } = req.body;
    try {
        const cell = Cell.fromBase64(boc);
        const endpoint = await getHttpEndpoint({ network: 'mainnet' });
        const client = new TonClient({ endpoint });
        
        // Отправляем BOC в сеть (если еще не отправлен)
        await client.sendFile(cell.toBoc());
        
        // Используем хеш ячейки как ID транзакции
        const txHash = cell.hash().toString('hex');
        
        const result = await creditUserBalance(userId, amount, txHash, 'TON');
        if(result.success) res.json({ success: true });
        else res.status(409).json({ error: 'Transaction already processed' });
    } catch (err) { 
        console.error("TON Verify Error:", err);
        res.status(500).json({ error: 'Verify failed' }); 
    }
});

// Получение конфигурации (кейсы и предметы) для фронтенда
app.get('/api/config', async (req, res) => {
    try {
        const prizes = await pool.query('SELECT * FROM prizes ORDER BY value ASC');
        const cases = await pool.query('SELECT * FROM cases ORDER BY price ASC');
        
        const mappedCases = cases.rows.map(c => ({
            id: c.id, 
            name: c.name, 
            image: c.image || '/images/case.png', 
            price: c.price, 
            prizeIds: c.prize_ids, 
            isPromo: c.is_promo,
            tag: c.tag || 'common'
        }));
        res.json({ prizes: prizes.rows, cases: mappedCases });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Синхронизация данных пользователя при входе
app.post('/api/user/sync', async (req, res) => {
    const { id, first_name, username, photo_url } = req.body;
    try {
        const query = `
            INSERT INTO users (id, first_name, username, photo_url, balance) 
            VALUES ($1, $2, $3, $4, 0) 
            ON CONFLICT (id) 
            DO UPDATE SET first_name = EXCLUDED.first_name, username = EXCLUDED.username, photo_url = EXCLUDED.photo_url 
            RETURNING *;
        `;
        const result = await pool.query(query, [id, first_name, username, photo_url]);
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Сохранение состояния пользователя (инвентарь, история, баланс)
app.post('/api/user/save', async (req, res) => {
    const { id, balance, inventory, history } = req.body;
    try {
        await pool.query(
            'UPDATE users SET balance = $1, inventory = $2, history = $3 WHERE id = $4', 
            [balance, JSON.stringify(inventory), JSON.stringify(history), id]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==================================================
// === АДМИНСКИЕ API (Новые функции) ===
// ==================================================

// 1. Получение информации о пользователе по ID
app.get('/api/admin/user/:id', async (req, res) => {
    try {
        const r = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
        if (r.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json(r.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. Изменение баланса пользователя
app.post('/api/admin/user/balance', async (req, res) => {
    const { id, amount, type } = req.body;
    try {
        const query = type === 'set' 
            ? 'UPDATE users SET balance = $1 WHERE id = $2 RETURNING *' 
            : 'UPDATE users SET balance = balance + $1 WHERE id = $2 RETURNING *';
        const r = await pool.query(query, [amount, id]);
        res.json(r.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 3. Обновление параметров кейса (название, цена, предметы, редкость, картинка)
app.post('/api/admin/case/update', async (req, res) => {
    const { id, name, price, prizeIds, tag, image, isPromo } = req.body;
    try {
        const r = await pool.query(
            'UPDATE cases SET name=$1, price=$2, prize_ids=$3, tag=$4, image=$5, is_promo=$6 WHERE id=$7 RETURNING *',
            [name, price, JSON.stringify(prizeIds), tag, image, isPromo, id]
        );
        res.json(r.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Создание нового кейса
app.post('/api/admin/case/create', async (req, res) => {
    const { id, name, image, price, prizeIds, tag, isPromo } = req.body;
    try {
        const r = await pool.query(
            'INSERT INTO cases (id, name, image, price, prize_ids, tag, is_promo) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [id, name, image, price, JSON.stringify(prizeIds), tag, isPromo || false]
        );
        res.json(r.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Обновление предмета (цена и шанс выпадения)
app.post('/api/admin/prize/update', async (req, res) => {
    const { id, value, chance } = req.body;
    try {
        const r = await pool.query(
            'UPDATE prizes SET value=$1, chance=$2 WHERE id=$3 RETURNING *',
            [value, chance, id]
        );
        res.json(r.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- ЗАПУСК СЕРВЕРА ---

// Раздача статики (React Frontend)
app.use(express.static(path.join(__dirname, '..', 'build')));

// Любой другой запрос отправляет index.html (для React Router)
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '..', 'build', 'index.html')));

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));

