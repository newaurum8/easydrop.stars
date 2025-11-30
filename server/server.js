const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const { getHttpEndpoint } = require('@orbs-network/ton-access');
const { TonClient, Cell } = require('ton');
const multer = require('multer');
const fs = require('fs');

// ==================================================
// === КОНФИГУРАЦИЯ ===
// ==================================================

const BOT_TOKEN = process.env.BOT_TOKEN || '7749005658:AAGMH6gGvb-tamh6W6sa47jBXUQ8Tl4pans'; 

// ID чата админа или группы для уведомлений о выводах
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || '-1003208391916'; 

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_UjHpMaRQo56v@ep-wild-rain-a4ouqppu-pooler.us-east-1.aws.neon.tech/neondb';
const APP_URL = process.env.APP_URL || 'https://easydrop-stars-1.onrender.com';

const app = express();
const PORT = process.env.PORT || 3001;

// --- НАСТРОЙКА ЗАГРУЗКИ ФАЙЛОВ ---
// Исправление ошибки "Field value too long"
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { 
        fileSize: 50 * 1024 * 1024, // 50 MB для файлов
        fieldSize: 50 * 1024 * 1024 // 50 MB для текстовых полей (исправляет ошибку при отправке base64)
    } 
});

// Инициализация бота (polling: false для вебхуков)
const bot = new TelegramBot(BOT_TOKEN, { polling: false });

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Раздача статических файлов (картинок)
app.use('/uploads', express.static(path.join(__dirname, '..', 'build', 'uploads')));

// Вебхук для бота
app.post(`/bot${BOT_TOKEN}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// --- ПОДКЛЮЧЕНИЕ К БД ---
const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

pool.on('error', (err) => {
    console.error('🚨 Критическая ошибка БД:', err);
});

// ==================================================
// === ФУНКЦИЯ ДЛЯ ГАРАНТИРОВАННОГО ОБНОВЛЕНИЯ ТАБЛИЦ ===
// ==================================================
async function ensureCaseColumns(client) {
    // Эта функция принудительно добавляет колонки, если их нет
    const queries = [
        "ALTER TABLE cases ADD COLUMN IF NOT EXISTS is_promo BOOLEAN DEFAULT false",
        "ALTER TABLE cases ADD COLUMN IF NOT EXISTS promo_code TEXT",
        "ALTER TABLE cases ADD COLUMN IF NOT EXISTS tag TEXT DEFAULT 'common'",
        "ALTER TABLE cases ADD COLUMN IF NOT EXISTS max_activations INT DEFAULT 0",
        "ALTER TABLE cases ADD COLUMN IF NOT EXISTS current_activations INT DEFAULT 0"
    ];
    for (const q of queries) {
        try { await client.query(q); } catch (e) { 
            // Ошибки игнорируем (например, если колонка уже есть)
        }
    }
}

// --- ИНИЦИАЛИЗАЦИЯ ПРИ ЗАПУСКЕ ---
const initDB = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (id BIGINT PRIMARY KEY, first_name TEXT, username TEXT, photo_url TEXT, balance INT DEFAULT 0, inventory JSONB DEFAULT '[]', history JSONB DEFAULT '[]', total_top_up INT DEFAULT 0, total_spent BIGINT DEFAULT 0);
            CREATE TABLE IF NOT EXISTS transactions (id SERIAL PRIMARY KEY, tx_hash TEXT UNIQUE, user_id BIGINT, amount DECIMAL, currency TEXT, created_at TIMESTAMP DEFAULT NOW());
            CREATE TABLE IF NOT EXISTS withdrawals (id SERIAL PRIMARY KEY, user_id BIGINT, username TEXT, item_data JSONB, target_username TEXT, status TEXT DEFAULT 'processing', created_at TIMESTAMP DEFAULT NOW());
            CREATE TABLE IF NOT EXISTS prizes (id TEXT PRIMARY KEY, name TEXT, image TEXT, value INT, chance FLOAT);
            CREATE TABLE IF NOT EXISTS cases (id TEXT PRIMARY KEY, name TEXT, image TEXT, price INT, prize_ids JSONB, is_promo BOOLEAN DEFAULT false, tag TEXT DEFAULT 'common', promo_code TEXT, max_activations INT DEFAULT 0, current_activations INT DEFAULT 0);
        `);
        
        // Пробуем обновить структуру сразу при старте
        await ensureCaseColumns(pool);
        
        console.log('>>> База данных инициализирована и проверена');
    } catch (err) { console.error('🚨 Ошибка InitDB:', err.message); }
};
initDB();


// ==================================================
// === АДМИНСКИЕ API (ИСПРАВЛЕННЫЕ) ===
// ==================================================

// --- СОЗДАНИЕ КЕЙСА ---
app.post('/api/admin/case/create', upload.single('imageFile'), async (req, res) => {
    try {
        // 1. Сначала чиним базу перед записью
        await ensureCaseColumns(pool);

        const { name, price, prizeIds, tag, isPromo, promoCode, maxActivations } = req.body;
        
        // 2. Валидация JSON
        let parsedPrizeIds = [];
        try { parsedPrizeIds = JSON.parse(prizeIds); } catch (e) { parsedPrizeIds = []; }

        const id = `case_${Date.now()}`;
        let imagePath = '/images/case.png';
        if (req.file) {
            const b64 = Buffer.from(req.file.buffer).toString('base64');
            imagePath = `data:${req.file.mimetype};base64,${b64}`;
        }

        // 3. Преобразование типов (защита от NaN)
        const priceInt = parseInt(price) || 0;
        const maxActivationsInt = parseInt(maxActivations) || 0;
        const isPromoBool = String(isPromo) === 'true'; 

        // 4. Вставка
        const r = await pool.query(
            'INSERT INTO cases (id, name, image, price, prize_ids, tag, is_promo, promo_code, max_activations) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *', 
            [id, name, imagePath, priceInt, JSON.stringify(parsedPrizeIds), tag, isPromoBool, promoCode, maxActivationsInt]
        );
        
        res.json(r.rows[0]);

    } catch (err) { 
        console.error("ОШИБКА СОЗДАНИЯ КЕЙСА:", err);
        res.status(500).json({ error: "Ошибка сервера: " + err.message }); 
    }
});

// --- ОБНОВЛЕНИЕ КЕЙСА ---
app.post('/api/admin/case/update', upload.single('imageFile'), async (req, res) => {
    try {
        // 1. Принудительное лечение базы перед обновлением
        await ensureCaseColumns(pool);

        const { id, name, price, prizeIds, tag, isPromo, promoCode, maxActivations, existingImage } = req.body;
        
        let imagePath = existingImage || '/images/case.png';
        if (req.file) {
            const b64 = Buffer.from(req.file.buffer).toString('base64');
            imagePath = `data:${req.file.mimetype};base64,${b64}`;
        }

        let parsedPrizeIds = [];
        try { parsedPrizeIds = JSON.parse(prizeIds); } catch (e) { parsedPrizeIds = []; }

        const priceInt = parseInt(price) || 0;
        const maxActivationsInt = parseInt(maxActivations) || 0;
        const isPromoBool = String(isPromo) === 'true';

        console.log(`Обновление кейса ${id}...`);

        const r = await pool.query(
            'UPDATE cases SET name=$1, price=$2, prize_ids=$3, tag=$4, image=$5, is_promo=$6, promo_code=$7, max_activations=$8 WHERE id=$9 RETURNING *', 
            [name, priceInt, JSON.stringify(parsedPrizeIds), tag, imagePath, isPromoBool, promoCode, maxActivationsInt, id]
        );

        if (r.rows.length === 0) {
            throw new Error("Кейс не найден в базе (ID неверен)");
        }

        res.json(r.rows[0]);

    } catch (err) { 
        console.error("ОШИБКА ОБНОВЛЕНИЯ КЕЙСА:", err);
        res.status(500).json({ error: "Ошибка сервера: " + err.message }); 
    }
});

// --- СОЗДАНИЕ ПРЕДМЕТА ---
app.post('/api/admin/prize/create', upload.single('imageFile'), async (req, res) => {
    try {
        const { name, value, chance } = req.body;
        const id = `item_${Date.now()}`;
        let imagePath = '/images/case/item.png';
        if (req.file) {
            const b64 = Buffer.from(req.file.buffer).toString('base64');
            imagePath = `data:${req.file.mimetype};base64,${b64}`;
        }
        const r = await pool.query('INSERT INTO prizes (id, name, image, value, chance) VALUES ($1, $2, $3, $4, $5) RETURNING *', [id, name, imagePath, parseInt(value), parseFloat(chance)]);
        res.json(r.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- ОБНОВЛЕНИЕ ПРЕДМЕТА ---
app.post('/api/admin/prize/update', upload.single('imageFile'), async (req, res) => {
    try {
        const { id, name, value, chance, existingImage } = req.body;
        let imagePath = existingImage;
        if (req.file) {
            const b64 = Buffer.from(req.file.buffer).toString('base64');
            imagePath = `data:${req.file.mimetype};base64,${b64}`;
        }
        const r = await pool.query('UPDATE prizes SET name=$1, value=$2, chance=$3, image=$4 WHERE id=$5 RETURNING *', [name, parseInt(value), parseFloat(chance), imagePath, id]);
        res.json(r.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==================================================
// === ОСТАЛЬНЫЕ API ===
// ==================================================

// РЕЙТИНГ
app.get('/api/leaders', async (req, res) => {
    try {
        const result = await pool.query(`SELECT first_name, photo_url, total_spent FROM users ORDER BY total_spent DESC NULLS LAST LIMIT 10`);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// КОНФИГ (Список кейсов и предметов для фронтенда)
app.get('/api/config', async (req, res) => {
    try {
        // Гарантируем колонки и при чтении
        await ensureCaseColumns(pool);

        const prizes = await pool.query('SELECT * FROM prizes ORDER BY value ASC');
        const cases = await pool.query('SELECT * FROM cases ORDER BY price ASC');
        
        const activeCases = cases.rows.filter(c => {
            if (c.max_activations > 0 && c.current_activations >= c.max_activations) return false; 
            return true;
        });

        const mappedCases = activeCases.map(c => {
            let items = c.prize_ids;
            if (Array.isArray(items) && items.length > 0 && typeof items[0] === 'string') {
                items = items.map(pid => {
                    const p = prizes.rows.find(pz => pz.id === pid);
                    return { id: pid, chance: p ? p.chance : 0 };
                });
            }
            return {
                id: c.id, name: c.name, image: c.image || '/images/case.png', price: c.price, 
                prizeIds: items, isPromo: c.is_promo, tag: c.tag || 'common',
                promoCode: c.promo_code, maxActivations: c.max_activations, currentActivations: c.current_activations
            };
        });

        res.json({ prizes: prizes.rows, cases: mappedCases });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ОТКРЫТИЕ КЕЙСА
app.post('/api/case/spin', async (req, res) => {
    const { caseId, userId, quantity } = req.body;
    try {
        const check = await pool.query('SELECT price, max_activations, current_activations, is_promo, promo_code FROM cases WHERE id = $1', [caseId]);
        if (check.rows.length > 0) {
            const c = check.rows[0];
            const qty = parseInt(quantity) || 1;

            if (c.max_activations > 0 && (c.current_activations + qty) > c.max_activations) {
                return res.status(400).json({ error: 'Case limit reached' });
            }
            
            await pool.query('UPDATE cases SET current_activations = current_activations + $1 WHERE id = $2', [qty, caseId]);

            const price = Number(c.price);
            if (!c.is_promo && userId && price > 0) {
                const totalCost = price * qty;
                await pool.query('UPDATE users SET total_spent = COALESCE(total_spent, 0) + $1 WHERE id = $2::bigint', [totalCost, userId]);
            }
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ЮЗЕР (Синхронизация)
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

app.post('/api/user/save', async (req, res) => {
    const { id, balance, inventory, history } = req.body;
    try {
        await pool.query('UPDATE users SET balance = $1, inventory = $2, history = $3 WHERE id = $4', [balance, JSON.stringify(inventory), JSON.stringify(history), id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/user/sell-all', async (req, res) => {
    const { userId } = req.body;
    try {
        const userRes = await pool.query('SELECT inventory, balance FROM users WHERE id = $1', [userId]);
        if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        const user = userRes.rows[0];
        const inventory = user.inventory || [];
        if (inventory.length === 0) return res.json({ success: true, addedBalance: 0, newBalance: user.balance });

        const totalValue = inventory.reduce((sum, item) => sum + (parseInt(item.value) || 0), 0);
        const newBalance = (user.balance || 0) + totalValue;

        await pool.query('UPDATE users SET inventory = $1, balance = $2 WHERE id = $3', ['[]', newBalance, userId]);
        res.json({ success: true, addedBalance: totalValue, newBalance });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ЗАЯВКА НА ВЫВОД
app.post('/api/withdraw/request', async (req, res) => {
    const { userId, itemInventoryId, targetUsername } = req.body;
    try {
        const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
        if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        const user = userRes.rows[0];
        const inventory = user.inventory || [];
        const itemIndex = inventory.findIndex(i => i.inventoryId === itemInventoryId);
        if (itemIndex === -1) return res.status(400).json({ error: 'Item not found in inventory' });
        const itemToWithdraw = inventory[itemIndex];
        const newInventory = inventory.filter(i => i.inventoryId !== itemInventoryId);
        await pool.query('UPDATE users SET inventory = $1 WHERE id = $2', [JSON.stringify(newInventory), userId]);
        
        const insertRes = await pool.query('INSERT INTO withdrawals (user_id, username, item_data, target_username, status) VALUES ($1, $2, $3, $4, $5) RETURNING id', [userId, user.username || 'Hidden', JSON.stringify(itemToWithdraw), targetUsername, 'processing']);
        const withdrawId = insertRes.rows[0].id;
        
        // Телеграм уведомление
        let imageUrl = itemToWithdraw.image;
        if (imageUrl && imageUrl.startsWith('/')) imageUrl = `${APP_URL}${imageUrl}`;
        const caption = `📦 <b>Заявка #${withdrawId}</b>\n\n👤 <b>Юзернейм:</b> @${user.username}\n🆔: <code>${userId}</code>\n🎁 <b>Предмет:</b> ${itemToWithdraw.name}\n📩 <b>Вывод на:</b> @${targetUsername}\n💰 <b>Цена:</b> ${itemToWithdraw.value}`;
        const options = { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '✅ Подтвердить', callback_data: `accept_${withdrawId}` }, { text: '❌ Отклонить', callback_data: `reject_${withdrawId}` }]] } };
        try {
            if (imageUrl) await bot.sendPhoto(ADMIN_CHAT_ID, imageUrl, { caption: caption, ...options });
            else await bot.sendMessage(ADMIN_CHAT_ID, caption, options);
        } catch (botErr) { console.error("Tg send error:", botErr.message); }

        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/user/withdrawals/:userId', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM withdrawals WHERE user_id = $1 ORDER BY created_at DESC', [req.params.userId]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// АДМИН УТИЛИТЫ (Пользователи)
app.get('/api/admin/user/:id', async (req, res) => {
    try {
        const r = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
        if (r.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json(r.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/user/balance', async (req, res) => {
    const { id, amount, type } = req.body;
    try {
        const query = type === 'set' ? 'UPDATE users SET balance = $1 WHERE id = $2 RETURNING *' : 'UPDATE users SET balance = balance + $1 WHERE id = $2 RETURNING *';
        const r = await pool.query(query, [amount, id]);
        res.json(r.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ОПЛАТА
app.post('/api/create-invoice', async (req, res) => {
    const { amount, userId } = req.body;
    try {
        const link = await bot.createInvoiceLink(`Пополнение`, `Stars`, JSON.stringify({ userId, amount, ts: Date.now() }), "", "XTR", [{ label: "Stars", amount: parseInt(amount) }]);
        res.json({ invoiceLink: link });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

async function creditUserBalance(userId, amount, txHash, currency) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const check = await client.query('SELECT id FROM transactions WHERE tx_hash = $1', [txHash]);
        if (check.rows.length > 0) { await client.query('ROLLBACK'); return { success: false }; }
        await client.query('INSERT INTO transactions (tx_hash, user_id, amount, currency) VALUES ($1, $2, $3, $4)', [txHash, userId, amount, currency]);
        const stars = currency === 'TON' ? amount * 3000 : amount * 50;
        await client.query('UPDATE users SET balance = balance + $1, total_top_up = total_top_up + $1 WHERE id = $2', [Math.floor(stars), userId]);
        await client.query('COMMIT');
        return { success: true };
    } catch (err) { await client.query('ROLLBACK'); return { success: false }; } finally { client.release(); }
}

app.post('/api/verify-ton-payment', async (req, res) => {
    const { boc, userId, amount } = req.body;
    try {
        const cell = Cell.fromBase64(boc);
        const client = new TonClient({ endpoint: await getHttpEndpoint({ network: 'mainnet' }) });
        await client.sendFile(cell.toBoc());
        const resBal = await creditUserBalance(userId, amount, cell.hash().toString('hex'), 'TON');
        if(resBal.success) res.json({ success: true }); else res.status(409).json({ error: 'Processed' });
    } catch (err) { res.status(500).json({ error: 'Verify failed' }); }
});

// Обработка платежей через бота
bot.on('pre_checkout_query', async (query) => bot.answerPreCheckoutQuery(query.id, true).catch(() => {}));
bot.on('message', async (msg) => {
    if (msg.successful_payment) {
        const p = msg.successful_payment;
        const payload = JSON.parse(p.invoice_payload);
        await creditUserBalance(payload.userId, p.total_amount, p.telegram_payment_charge_id, 'XTR');
    }
});

// --- ССЫЛКА ДЛЯ РУЧНОГО ИСПРАВЛЕНИЯ БАЗЫ ---
app.get('/api/fix-database-full', async (req, res) => {
    try {
        await ensureCaseColumns(pool);
        
        const client = await pool.connect();
        const result = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'cases';");
        client.release();
        
        const columns = result.rows.map(r => r.column_name).sort().join(', ');
        
        res.send(`
            <h1>✅ База данных успешно восстановлена!</h1>
            <p>Все необходимые колонки добавлены.</p>
            <p><b>Текущие столбцы в таблице cases:</b><br/> ${columns}</p>
            <p>Теперь попробуйте сохранить кейс в админке.</p>
        `);
    } catch (err) {
        res.send(`<h1>❌ Ошибка при исправлении</h1><pre>${err.message}</pre>`);
    }
});

// ГЛОБАЛЬНЫЙ ОБРАБОТЧИК ОШИБОК
app.use((err, req, res, next) => {
    console.error("🔥 GLOBAL ERROR:", err);
    // Отправляем JSON, чтобы фронтенд мог отобразить ошибку в alert
    res.status(500).json({ error: "Internal Server Error: " + err.message });
});

// --- ЗАПУСК ---
app.use(express.static(path.join(__dirname, '..', 'build')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '..', 'build', 'index.html')));

app.listen(PORT, async () => {
    console.log(`Server started on port ${PORT}`);
    try { await bot.setWebHook(`${APP_URL}/bot${BOT_TOKEN}`); console.log(`Webhook OK`); } catch (e) { console.error(e.message); }
});
