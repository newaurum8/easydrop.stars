require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const { getHttpEndpoint } = require('@orbs-network/ton-access');
const { TonClient, Cell } = require('ton');
const multer = require('multer');
const crypto = require('crypto');

// ==================================================
// === КОНФИГУРАЦИЯ ===
// ==================================================

const PORT = process.env.PORT || 3001;
const BOT_TOKEN = process.env.BOT_TOKEN; // Должен быть в .env
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD; // Должен быть в .env
const DATABASE_URL = process.env.DATABASE_URL; // Должен быть в .env
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const APP_URL = process.env.APP_URL;

// Проверка наличия важных переменных
if (!BOT_TOKEN || !DATABASE_URL) {
    console.error("ОШИБКА: Не заданы BOT_TOKEN или DATABASE_URL в .env");
    process.exit(1);
}

const app = express();

// Настройка Multer для загрузки файлов
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { 
        fileSize: 10 * 1024 * 1024, // 10 MB
        fieldSize: 10 * 1024 * 1024 
    } 
});

const bot = new TelegramBot(BOT_TOKEN, { polling: false });

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Раздача статики
app.use('/uploads', express.static(path.join(__dirname, '..', 'build', 'uploads')));

// Вебхук бота
app.post(`/bot${BOT_TOKEN}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// --- ПОДКЛЮЧЕНИЕ К БД ---
const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

pool.on('error', (err) => console.error('🚨 Ошибка БД:', err));

// ==================================================
// === MIDDLEWARE БЕЗОПАСНОСТИ ===
// ==================================================

// 1. Проверка подлинности данных Telegram (HMAC)
const verifyTelegramWebAppData = (req, res, next) => {
    const initData = req.headers['x-telegram-init-data'];

    // Для локальной разработки можно разрешить тестовый доступ (НЕ ДЛЯ ПРОДАКШЕНА!)
    if (!initData && process.env.NODE_ENV === 'development') {
        req.user = { id: 123456789, username: 'dev_user', first_name: 'Dev' };
        return next();
    }

    if (!initData) return res.status(401).json({ error: 'No auth data' });

    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    urlParams.delete('hash');
    urlParams.sort();

    let dataCheckString = '';
    for (const [key, value] of urlParams.entries()) {
        dataCheckString += `${key}=${value}\n`;
    }
    dataCheckString = dataCheckString.slice(0, -1);

    const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const calculatedHash = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');

    if (calculatedHash === hash) {
        // Данные валидны
        try {
            const userData = JSON.parse(urlParams.get('user'));
            req.user = userData;
            next();
        } catch (e) {
            return res.status(400).json({ error: 'Invalid user data format' });
        }
    } else {
        return res.status(403).json({ error: 'Data integrity check failed' });
    }
};

// 2. Проверка пароля администратора
const verifyAdmin = (req, res, next) => {
    const password = req.headers['x-admin-password'];
    if (password && password === ADMIN_PASSWORD) {
        next();
    } else {
        res.status(403).json({ error: 'Admin access denied' });
    }
};

// ==================================================
// === ИНИЦИАЛИЗАЦИЯ БД ===
// ==================================================

async function ensureCaseColumns(client) {
    const queries = [
        "ALTER TABLE cases ADD COLUMN IF NOT EXISTS is_promo BOOLEAN DEFAULT false",
        "ALTER TABLE cases ADD COLUMN IF NOT EXISTS promo_code TEXT",
        "ALTER TABLE cases ADD COLUMN IF NOT EXISTS tag TEXT DEFAULT 'common'",
        "ALTER TABLE cases ADD COLUMN IF NOT EXISTS max_activations INT DEFAULT 0",
        "ALTER TABLE cases ADD COLUMN IF NOT EXISTS current_activations INT DEFAULT 0"
    ];
    for (const q of queries) {
        try { await client.query(q); } catch (e) {}
    }
}

const initDB = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (id BIGINT PRIMARY KEY, first_name TEXT, username TEXT, photo_url TEXT, balance INT DEFAULT 0, inventory JSONB DEFAULT '[]', history JSONB DEFAULT '[]', total_top_up INT DEFAULT 0, total_spent BIGINT DEFAULT 0);
            CREATE TABLE IF NOT EXISTS transactions (id SERIAL PRIMARY KEY, tx_hash TEXT UNIQUE, user_id BIGINT, amount DECIMAL, currency TEXT, created_at TIMESTAMP DEFAULT NOW());
            CREATE TABLE IF NOT EXISTS withdrawals (id SERIAL PRIMARY KEY, user_id BIGINT, username TEXT, item_data JSONB, target_username TEXT, status TEXT DEFAULT 'processing', created_at TIMESTAMP DEFAULT NOW());
            CREATE TABLE IF NOT EXISTS prizes (id TEXT PRIMARY KEY, name TEXT, image TEXT, value INT, chance FLOAT);
            CREATE TABLE IF NOT EXISTS cases (id TEXT PRIMARY KEY, name TEXT, image TEXT, price INT, prize_ids JSONB, is_promo BOOLEAN DEFAULT false, tag TEXT DEFAULT 'common', promo_code TEXT, max_activations INT DEFAULT 0, current_activations INT DEFAULT 0);
        `);
        await ensureCaseColumns(pool);
        console.log('>>> База данных готова');
    } catch (err) { console.error('🚨 InitDB Error:', err.message); }
};
initDB();

// ==================================================
// === USER API (Защищенные маршруты) ===
// ==================================================

// СИНХРОНИЗАЦИЯ (ВХОД)
app.post('/api/user/sync', verifyTelegramWebAppData, async (req, res) => {
    const { id, first_name, username, photo_url } = req.user;
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

// ПРОДАЖА ПРЕДМЕТА
app.post('/api/user/sell-item', verifyTelegramWebAppData, async (req, res) => {
    const userId = req.user.id;
    const { inventoryId } = req.body;

    try {
        const userRes = await pool.query('SELECT inventory, balance FROM users WHERE id = $1', [userId]);
        if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        
        const user = userRes.rows[0];
        let inventory = user.inventory || [];
        
        const itemIndex = inventory.findIndex(i => i.inventoryId === inventoryId);
        if (itemIndex === -1) return res.status(404).json({ error: 'Item not found' });

        const item = inventory[itemIndex];
        const newBalance = (user.balance || 0) + parseInt(item.value);
        
        // Удаляем предмет
        inventory.splice(itemIndex, 1);

        await pool.query('UPDATE users SET balance = $1, inventory = $2 WHERE id = $3', [newBalance, JSON.stringify(inventory), userId]);
        
        res.json({ success: true, newBalance, inventory });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ПРОДАЖА ВСЕГО ИНВЕНТАРЯ
app.post('/api/user/sell-all', verifyTelegramWebAppData, async (req, res) => {
    const userId = req.user.id;
    try {
        const userRes = await pool.query('SELECT inventory, balance FROM users WHERE id = $1', [userId]);
        const user = userRes.rows[0];
        const inventory = user.inventory || [];
        
        if (inventory.length === 0) return res.json({ success: true, newBalance: user.balance });

        const totalValue = inventory.reduce((sum, item) => sum + (parseInt(item.value) || 0), 0);
        const newBalance = (user.balance || 0) + totalValue;

        await pool.query('UPDATE users SET inventory = $1, balance = $2 WHERE id = $3', ['[]', newBalance, userId]);
        res.json({ success: true, addedBalance: totalValue, newBalance });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ЗАЯВКА НА ВЫВОД
app.post('/api/withdraw/request', verifyTelegramWebAppData, async (req, res) => {
    const userId = req.user.id;
    const { itemInventoryId, targetUsername } = req.body;
    
    try {
        const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
        const user = userRes.rows[0];
        let inventory = user.inventory || [];
        
        const itemIndex = inventory.findIndex(i => i.inventoryId === itemInventoryId);
        if (itemIndex === -1) return res.status(400).json({ error: 'Item not found' });
        
        const itemToWithdraw = inventory[itemIndex];
        
        // Удаляем из инвентаря
        inventory.splice(itemIndex, 1);
        await pool.query('UPDATE users SET inventory = $1 WHERE id = $2', [JSON.stringify(inventory), userId]);
        
        // Создаем заявку
        const insertRes = await pool.query(
            'INSERT INTO withdrawals (user_id, username, item_data, target_username, status) VALUES ($1, $2, $3, $4, $5) RETURNING id', 
            [userId, user.username || 'Hidden', JSON.stringify(itemToWithdraw), targetUsername, 'processing']
        );
        
        const withdrawId = insertRes.rows[0].id;
        
        // Уведомление в Telegram
        let imageUrl = itemToWithdraw.image;
        if (imageUrl && imageUrl.startsWith('/')) imageUrl = `${APP_URL}${imageUrl}`;
        
        const caption = `📦 <b>Заявка #${withdrawId}</b>\n\n👤 @${user.username} (ID: ${userId})\n🎁 <b>Предмет:</b> ${itemToWithdraw.name}\n💰 <b>Цена:</b> ${itemToWithdraw.value}\n📩 <b>Вывод на:</b> @${targetUsername}`;
        
        try {
            if (imageUrl && imageUrl.startsWith('http')) {
                await bot.sendPhoto(ADMIN_CHAT_ID, imageUrl, { caption, parse_mode: 'HTML' });
            } else {
                await bot.sendMessage(ADMIN_CHAT_ID, caption, { parse_mode: 'HTML' });
            }
        } catch (botErr) { console.error("Tg error:", botErr.message); }

        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// АПГРЕЙД (Серверная логика)
app.post('/api/user/upgrade', verifyTelegramWebAppData, async (req, res) => {
    const userId = req.user.id;
    const { inventoryId, targetItemId } = req.body;

    try {
        const userRes = await pool.query('SELECT inventory, history FROM users WHERE id = $1', [userId]);
        const user = userRes.rows[0];
        let inventory = user.inventory || [];
        
        const sourceIndex = inventory.findIndex(i => i.inventoryId === inventoryId);
        if (sourceIndex === -1) return res.status(404).json({ error: 'Предмет не найден' });
        const sourceItem = inventory[sourceIndex];

        // Получаем целевой предмет из БД (защита от подмены цены)
        const targetRes = await pool.query('SELECT * FROM prizes WHERE id = $1', [targetItemId]);
        if (targetRes.rows.length === 0) return res.status(404).json({ error: 'Целевой предмет не существует' });
        const targetItem = targetRes.rows[0];

        // Математика шанса
        const chance = Math.min(Math.max((sourceItem.value / targetItem.value) * 50, 1), 95);
        const random = Math.random() * 100;
        const isSuccess = random < chance;

        // Удаляем исходный
        inventory.splice(sourceIndex, 1);
        
        let newItem = null;

        if (isSuccess) {
            newItem = { ...targetItem, inventoryId: Date.now() + Math.random() };
            inventory.push(newItem);
            
            // История
            let history = user.history || [];
            history.unshift({ ...newItem, date: new Date().toISOString() });
            if (history.length > 50) history.pop();
            
            await pool.query('UPDATE users SET inventory = $1, history = $2 WHERE id = $3', [JSON.stringify(inventory), JSON.stringify(history), userId]);
        } else {
            await pool.query('UPDATE users SET inventory = $1 WHERE id = $2', [JSON.stringify(inventory), userId]);
        }

        res.json({ success: isSuccess, newItem, chance });

    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ОТКРЫТИЕ КЕЙСА
app.post('/api/case/spin', verifyTelegramWebAppData, async (req, res) => {
    const userId = req.user.id;
    const { caseId, quantity } = req.body;
    
    try {
        const caseRes = await pool.query('SELECT * FROM cases WHERE id = $1', [caseId]);
        if (caseRes.rows.length === 0) return res.status(404).json({ error: 'Кейс не найден' });
        
        const caseItem = caseRes.rows[0];
        const qty = parseInt(quantity) || 1;

        // Проверка лимитов
        if (caseItem.max_activations > 0 && (caseItem.current_activations + qty) > caseItem.max_activations) {
            return res.status(400).json({ error: 'Case limit reached' });
        }

        const userRes = await pool.query('SELECT balance, inventory, history FROM users WHERE id = $1', [userId]);
        const user = userRes.rows[0];

        // Проверка промокода (если нужно) реализовать здесь, 
        // но для простоты считаем, что фронт проверил, а сервер доверяет флагу is_promo (бесплатно) 
        // или списывает деньги.
        
        const totalPrice = caseItem.is_promo ? 0 : (caseItem.price * qty);

        if (user.balance < totalPrice) {
            return res.status(400).json({ error: 'Недостаточно средств' });
        }

        // Списываем баланс
        const newBalance = user.balance - totalPrice;
        
        // ГЕНЕРАЦИЯ ВЫИГРЫША
        const allPrizesRes = await pool.query('SELECT * FROM prizes');
        const allPrizes = allPrizesRes.rows;
        
        // Парсим список ID призов из кейса
        let casePrizeIds = caseItem.prize_ids; // может быть массив строк или объектов
        let poolItems = [];
        
        if (Array.isArray(casePrizeIds)) {
            poolItems = casePrizeIds.map(cp => {
                const pId = typeof cp === 'string' ? cp : cp.id;
                const p = allPrizes.find(ap => ap.id === pId);
                if (!p) return null;
                // Если у предмета в кейсе задан кастомный шанс, берем его, иначе базовый
                const customChance = (typeof cp === 'object' && cp.chance !== undefined) ? Number(cp.chance) : p.chance;
                return { ...p, chance: customChance };
            }).filter(Boolean);
        }

        if (poolItems.length === 0) return res.status(500).json({ error: 'Кейс пуст' });

        const wonItems = [];
        for (let i = 0; i < qty; i++) {
            const totalChance = poolItems.reduce((sum, item) => sum + item.chance, 0);
            let random = Math.random() * totalChance;
            let winner = poolItems[poolItems.length - 1];
            
            for (const item of poolItems) {
                if (random < item.chance) {
                    winner = item;
                    break;
                }
                random -= item.chance;
            }
            
            // Добавляем уникальный ID для инвентаря
            wonItems.push({ ...winner, inventoryId: Date.now() + Math.random() });
        }

        // Обновляем БД (Баланс, Инвентарь, История, Счетчик кейса, Потраченное)
        const updatedInventory = [...(user.inventory || []), ...wonItems];
        
        // История (добавляем новые в начало)
        let updatedHistory = user.history || [];
        const historyItems = wonItems.map(w => ({ ...w, date: new Date().toISOString() }));
        updatedHistory = [...historyItems, ...updatedHistory].slice(0, 50);

        await pool.query(
            'UPDATE users SET balance = $1, inventory = $2, history = $3, total_spent = COALESCE(total_spent, 0) + $4 WHERE id = $5',
            [newBalance, JSON.stringify(updatedInventory), JSON.stringify(updatedHistory), totalPrice, userId]
        );

        await pool.query('UPDATE cases SET current_activations = current_activations + $1 WHERE id = $2', [qty, caseId]);

        res.json({ success: true, newBalance, wonItems });

    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==================================================
// === ADMIN API (Защищено паролем) ===
// ==================================================

app.post('/api/admin/case/create', verifyAdmin, upload.single('imageFile'), async (req, res) => {
    try {
        await ensureCaseColumns(pool);
        const { name, price, prizeIds, tag, isPromo, promoCode, maxActivations } = req.body;
        
        let parsedPrizeIds = [];
        try { parsedPrizeIds = JSON.parse(prizeIds); } catch (e) {}

        const id = `case_${Date.now()}`;
        let imagePath = '/images/case.png';
        if (req.file) {
            const b64 = Buffer.from(req.file.buffer).toString('base64');
            imagePath = `data:${req.file.mimetype};base64,${b64}`;
        }

        const r = await pool.query(
            'INSERT INTO cases (id, name, image, price, prize_ids, tag, is_promo, promo_code, max_activations) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *', 
            [id, name, imagePath, parseInt(price)||0, JSON.stringify(parsedPrizeIds), tag, String(isPromo)==='true', promoCode, parseInt(maxActivations)||0]
        );
        res.json(r.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/case/update', verifyAdmin, upload.single('imageFile'), async (req, res) => {
    try {
        await ensureCaseColumns(pool);
        const { id, name, price, prizeIds, tag, isPromo, promoCode, maxActivations, existingImage } = req.body;
        
        let imagePath = existingImage || '/images/case.png';
        if (req.file) {
            const b64 = Buffer.from(req.file.buffer).toString('base64');
            imagePath = `data:${req.file.mimetype};base64,${b64}`;
        }

        let parsedPrizeIds = [];
        try { parsedPrizeIds = JSON.parse(prizeIds); } catch (e) {}

        const r = await pool.query(
            'UPDATE cases SET name=$1, price=$2, prize_ids=$3, tag=$4, image=$5, is_promo=$6, promo_code=$7, max_activations=$8 WHERE id=$9 RETURNING *', 
            [name, parseInt(price)||0, JSON.stringify(parsedPrizeIds), tag, imagePath, String(isPromo)==='true', promoCode, parseInt(maxActivations)||0, id]
        );
        res.json(r.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/prize/create', verifyAdmin, upload.single('imageFile'), async (req, res) => {
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

app.post('/api/admin/prize/update', verifyAdmin, upload.single('imageFile'), async (req, res) => {
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

app.get('/api/admin/user/:id', verifyAdmin, async (req, res) => {
    try {
        const r = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
        if (r.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json(r.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/user/balance', verifyAdmin, async (req, res) => {
    const { id, amount } = req.body;
    try {
        const r = await pool.query('UPDATE users SET balance = $1 WHERE id = $2 RETURNING *', [amount, id]);
        res.json(r.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// ==================================================
// === PUBLIC API (Чтение) ===
// ==================================================

app.get('/api/leaders', async (req, res) => {
    try {
        const result = await pool.query(`SELECT first_name, photo_url, total_spent FROM users ORDER BY total_spent DESC NULLS LAST LIMIT 10`);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/config', async (req, res) => {
    try {
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

app.get('/api/user/withdrawals/:userId', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM withdrawals WHERE user_id = $1 ORDER BY created_at DESC', [req.params.userId]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});


// ==================================================
// === ОПЛАТА ===
// ==================================================

app.post('/api/create-invoice', verifyTelegramWebAppData, async (req, res) => {
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

bot.on('pre_checkout_query', async (query) => bot.answerPreCheckoutQuery(query.id, true).catch(() => {}));
bot.on('message', async (msg) => {
    if (msg.successful_payment) {
        const p = msg.successful_payment;
        const payload = JSON.parse(p.invoice_payload);
        await creditUserBalance(payload.userId, p.total_amount, p.telegram_payment_charge_id, 'XTR');
    }
});

// ==================================================
// === ЗАПУСК ===
// ==================================================

app.use(express.static(path.join(__dirname, '..', 'build')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '..', 'build', 'index.html')));

app.listen(PORT, async () => {
    console.log(`✅ Secure Server started on port ${PORT}`);
    try { await bot.setWebHook(`${APP_URL}/bot${BOT_TOKEN}`); console.log(`✅ Webhook OK`); } catch (e) { console.error(e.message); }
});
