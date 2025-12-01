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
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const DATABASE_URL = process.env.DATABASE_URL;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const APP_URL = process.env.APP_URL;

// Проверка наличия критических переменных
if (!BOT_TOKEN || !DATABASE_URL) {
    console.error("⛔ CRITICAL ERROR: Не заданы BOT_TOKEN или DATABASE_URL в .env файле.");
    process.exit(1);
}

const app = express();
const bot = new TelegramBot(BOT_TOKEN, { polling: false });

// Настройка загрузки файлов (для админки)
const storage = multer.memoryStorage();
const upload = multer({ 
    storage, 
    limits: { fileSize: 10 * 1024 * 1024 } // 10 MB лимит
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Раздача статических файлов (сборка React)
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

pool.on('error', (err) => console.error('🚨 Ошибка подключения к БД:', err));

// ==================================================
// === MIDDLEWARE БЕЗОПАСНОСТИ ===
// ==================================================

// 1. Проверка подлинности данных Telegram (HMAC SHA-256)
const verifyTelegramWebAppData = (req, res, next) => {
    const initData = req.headers['x-telegram-init-data'];

    // DEV-режим: разрешаем тестового юзера ТОЛЬКО если явно задан NODE_ENV=development
    if (!initData && process.env.NODE_ENV === 'development') {
        // console.warn("⚠️ DEV MODE: Using mock user"); 
        req.user = { id: 123456789, username: 'dev_user', first_name: 'Dev' };
        return next();
    }

    if (!initData) return res.status(401).json({ error: 'Authorization required' });

    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    urlParams.delete('hash');
    urlParams.sort();

    let checkString = '';
    for (const [key, value] of urlParams.entries()) {
        checkString += `${key}=${value}\n`;
    }
    checkString = checkString.slice(0, -1);

    const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const calculatedHash = crypto.createHmac('sha256', secret).update(checkString).digest('hex');

    if (calculatedHash === hash) {
        try {
            req.user = JSON.parse(urlParams.get('user'));
            next();
        } catch (e) {
            return res.status(400).json({ error: 'Invalid user data format' });
        }
    } else {
        console.error("⚠️ Auth Failed: Hash mismatch. Check BOT_TOKEN.");
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
// === ИНИЦИАЛИЗАЦИЯ И МИГРАЦИИ ===
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
        try { await client.query(q); } catch (e) { /* игнорируем ошибки дублирования */ }
    }
}

// ==================================================
// === ПОЛЬЗОВАТЕЛЬСКИЕ API (БЕЗОПАСНЫЕ) ===
// ==================================================

// 1. СИНХРОНИЗАЦИЯ (ВХОД)
app.post('/api/user/sync', verifyTelegramWebAppData, async (req, res) => {
    const { id, first_name, username, photo_url } = req.user;
    
    const client = await pool.connect();
    try {
        // Upsert пользователя
        await client.query(
            `INSERT INTO users (id, first_name, username, photo_url) VALUES ($1, $2, $3, $4)
             ON CONFLICT (id) DO UPDATE SET first_name = EXCLUDED.first_name, username = EXCLUDED.username, photo_url = EXCLUDED.photo_url`,
            [id, first_name, username, photo_url]
        );

        // Получаем данные
        const userRes = await client.query('SELECT * FROM users WHERE id = $1', [id]);
        const user = userRes.rows[0];

        // Получаем инвентарь (JOIN с prizes)
        // ВАЖНО: Если тут падает, значит нет таблицы inventory_items
        const invRes = await client.query(
            `SELECT i.id as "inventoryId", p.id, p.name, p.image, p.value, p.chance, i.created_at 
             FROM inventory_items i 
             JOIN prizes p ON i.item_id = p.id 
             WHERE i.user_id = $1 
             ORDER BY i.created_at DESC`,
            [id]
        );

        // Получаем историю
        const histRes = await client.query(
            `SELECT h.created_at as date, p.name, p.image, p.value 
             FROM history_logs h 
             JOIN prizes p ON h.item_id = p.id 
             WHERE h.user_id = $1 
             ORDER BY h.created_at DESC LIMIT 50`,
            [id]
        );

        res.json({ 
            ...user, 
            inventory: invRes.rows, 
            history: histRes.rows 
        });
    } catch (e) {
        console.error("Sync Error:", e);
        res.status(500).json({ error: 'Database sync error: ' + e.message });
    } finally {
        client.release();
    }
});

// 2. ОТКРЫТИЕ КЕЙСА (Транзакция + Валидация)
app.post('/api/case/spin', verifyTelegramWebAppData, async (req, res) => {
    const userId = req.user.id;
    const { caseId, quantity } = req.body;
    const qty = parseInt(quantity);

    // Валидация
    if (!qty || qty < 1 || qty > 10) return res.status(400).json({ error: 'Invalid quantity (1-10)' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // --- НАЧАЛО ТРАНЗАКЦИИ ---

        // 1. Блокируем строку пользователя (защита от race condition)
        const userRes = await client.query('SELECT balance FROM users WHERE id = $1 FOR UPDATE', [userId]);
        if (userRes.rows.length === 0) throw new Error('User not found');
        const userBalance = parseInt(userRes.rows[0].balance);

        // 2. Получаем кейс
        const caseRes = await client.query('SELECT * FROM cases WHERE id = $1', [caseId]);
        if (caseRes.rows.length === 0) throw new Error('Case not found');
        const caseItem = caseRes.rows[0];

        // 3. Проверка лимитов
        if (caseItem.max_activations > 0 && (caseItem.current_activations + qty) > caseItem.max_activations) {
            throw new Error('Case limit reached');
        }

        // 4. Расчет стоимости
        const totalCost = caseItem.is_promo ? 0 : (parseInt(caseItem.price) * qty);
        if (userBalance < totalCost) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Недостаточно средств' });
        }

        // 5. Генерация лута (Server-side)
        const allPrizesRes = await client.query('SELECT * FROM prizes');
        const allPrizes = allPrizesRes.rows;
        
        let poolItems = [];
        if (Array.isArray(caseItem.prize_ids)) {
            poolItems = caseItem.prize_ids.map(cp => {
                const pId = typeof cp === 'string' ? cp : cp.id;
                const p = allPrizes.find(ap => ap.id === pId);
                const chance = (typeof cp === 'object' && cp.chance !== undefined) ? Number(cp.chance) : (p ? p.chance : 0);
                return p ? { ...p, chance } : null;
            }).filter(Boolean);
        }

        if (poolItems.length === 0) throw new Error('Case is empty configuration');

        const wonItems = [];
        for (let i = 0; i < qty; i++) {
            const totalChance = poolItems.reduce((acc, el) => acc + el.chance, 0);
            let random = Math.random() * totalChance;
            let winner = poolItems[poolItems.length - 1];
            
            for (const item of poolItems) {
                if (random < item.chance) {
                    winner = item;
                    break;
                }
                random -= item.chance;
            }
            wonItems.push(winner);
        }

        // 6. Запись в БД
        
        // Списание баланса
        await client.query(
            'UPDATE users SET balance = balance - $1, total_spent = total_spent + $1 WHERE id = $2',
            [totalCost, userId]
        );
        
        // Обновление кейса
        await client.query('UPDATE cases SET current_activations = current_activations + $1 WHERE id = $2', [qty, caseId]);

        // Добавление предметов в инвентарь и логов
        for (const item of wonItems) {
            await client.query(
                'INSERT INTO inventory_items (user_id, item_id) VALUES ($1, $2)',
                [userId, item.id]
            );
            await client.query(
                'INSERT INTO history_logs (user_id, item_id, action_type) VALUES ($1, $2, $3)',
                [userId, item.id, 'drop']
            );
        }

        await client.query('COMMIT'); // --- ПРИМЕНЯЕМ ИЗМЕНЕНИЯ ---

        // Получаем обновленный список выигранных предметов с их новыми UUID
        const newInvRes = await client.query(
            `SELECT i.id as "inventoryId", p.* FROM inventory_items i 
             JOIN prizes p ON i.item_id = p.id 
             WHERE i.user_id = $1 ORDER BY i.created_at DESC LIMIT $2`,
            [userId, qty]
        );

        res.json({ 
            success: true, 
            newBalance: userBalance - totalCost, 
            wonItems: newInvRes.rows 
        });

    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Spin error:", e);
        res.status(500).json({ error: e.message || 'Server Error' });
    } finally {
        client.release();
    }
});

// 3. ПРОДАЖА ПРЕДМЕТА
app.post('/api/user/sell-item', verifyTelegramWebAppData, async (req, res) => {
    const userId = req.user.id;
    const { inventoryId } = req.body; // UUID

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Ищем предмет и блокируем
        const itemRes = await client.query(
            `SELECT i.id, p.value FROM inventory_items i 
             JOIN prizes p ON i.item_id = p.id 
             WHERE i.id = $1 AND i.user_id = $2 FOR UPDATE`,
            [inventoryId, userId]
        );

        if (itemRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Item not found or already sold' });
        }

        const price = itemRes.rows[0].value;

        // Удаляем предмет
        await client.query('DELETE FROM inventory_items WHERE id = $1', [inventoryId]);

        // Начисляем баланс
        const userUpd = await client.query(
            'UPDATE users SET balance = balance + $1 WHERE id = $2 RETURNING balance',
            [price, userId]
        );

        await client.query('COMMIT');
        res.json({ success: true, newBalance: userUpd.rows[0].balance });

    } catch (e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'Server error during sale: ' + e.message });
    } finally {
        client.release();
    }
});

// 4. ПРОДАЖА ВСЕГО ИНВЕНТАРЯ
app.post('/api/user/sell-all', verifyTelegramWebAppData, async (req, res) => {
    const userId = req.user.id;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const sumRes = await client.query(
            `SELECT SUM(p.value) as total FROM inventory_items i 
             JOIN prizes p ON i.item_id = p.id 
             WHERE i.user_id = $1`,
            [userId]
        );
        const totalValue = parseInt(sumRes.rows[0].total) || 0;

        if (totalValue > 0) {
            await client.query('DELETE FROM inventory_items WHERE user_id = $1', [userId]);
            
            const userUpd = await client.query(
                'UPDATE users SET balance = balance + $1 WHERE id = $2 RETURNING balance',
                [totalValue, userId]
            );
            
            await client.query('COMMIT');
            res.json({ success: true, addedBalance: totalValue, newBalance: userUpd.rows[0].balance });
        } else {
            await client.query('ROLLBACK');
            res.json({ success: true, addedBalance: 0 });
        }
    } catch (e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: 'Server error: ' + e.message });
    } finally {
        client.release();
    }
});

// 5. АПГРЕЙД ПРЕДМЕТА
app.post('/api/user/upgrade', verifyTelegramWebAppData, async (req, res) => {
    const userId = req.user.id;
    const { inventoryId, targetItemId } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const sourceRes = await client.query(
            `SELECT i.id, p.value FROM inventory_items i 
             JOIN prizes p ON i.item_id = p.id 
             WHERE i.id = $1 AND i.user_id = $2 FOR UPDATE`,
            [inventoryId, userId]
        );
        
        if (sourceRes.rows.length === 0) throw new Error('Source item not found');
        const sourceItem = sourceRes.rows[0];

        const targetRes = await client.query('SELECT * FROM prizes WHERE id = $1', [targetItemId]);
        if (targetRes.rows.length === 0) throw new Error('Target item invalid');
        const targetItem = targetRes.rows[0];

        await client.query('DELETE FROM inventory_items WHERE id = $1', [inventoryId]);

        const chance = Math.min(Math.max((sourceItem.value / targetItem.value) * 50, 1), 95);
        const random = Math.random() * 100;
        const isSuccess = random < chance;
        
        let newItem = null;
        if (isSuccess) {
            const ins = await client.query(
                'INSERT INTO inventory_items (user_id, item_id) VALUES ($1, $2) RETURNING id, created_at',
                [userId, targetItem.id]
            );
            
            await client.query(
                'INSERT INTO history_logs (user_id, item_id, action_type) VALUES ($1, $2, $3)',
                [userId, targetItem.id, 'upgrade_success']
            );
            
            newItem = { 
                ...targetItem, 
                inventoryId: ins.rows[0].id 
            };
        } else {
            await client.query(
                'INSERT INTO history_logs (user_id, item_id, action_type) VALUES ($1, $2, $3)',
                [userId, targetItem.id, 'upgrade_fail']
            );
        }

        await client.query('COMMIT');
        res.json({ success: isSuccess, newItem, chance });

    } catch (e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally {
        client.release();
    }
});

// 6. ЗАЯВКА НА ВЫВОД
app.post('/api/withdraw/request', verifyTelegramWebAppData, async (req, res) => {
    const userId = req.user.id;
    const { itemInventoryId, targetUsername } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const itemRes = await client.query(
            `SELECT i.id, i.item_id, p.name, p.value, p.image 
             FROM inventory_items i 
             JOIN prizes p ON i.item_id = p.id 
             WHERE i.id = $1 AND i.user_id = $2 FOR UPDATE`,
            [itemInventoryId, userId]
        );

        if (itemRes.rows.length === 0) throw new Error('Item not found in inventory');
        const item = itemRes.rows[0];

        await client.query('DELETE FROM inventory_items WHERE id = $1', [itemInventoryId]);

        const withRes = await client.query(
            `INSERT INTO withdrawals (user_id, username, item_id, item_uuid, target_username) 
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [userId, req.user.username, item.item_id, itemInventoryId, targetUsername]
        );

        await client.query('COMMIT');

        const caption = `📦 <b>Заявка #${withRes.rows[0].id}</b>\n🎁 ${item.name}\n💰 ${item.value}\n👤 @${req.user.username}\n👉 @${targetUsername}`;
        try {
            if (item.image && item.image.startsWith('http')) {
                await bot.sendPhoto(ADMIN_CHAT_ID, item.image, {caption, parse_mode:'HTML'});
            } else {
                await bot.sendMessage(ADMIN_CHAT_ID, caption, {parse_mode:'HTML'});
            }
        } catch(e) { console.error('TG Notification failed', e.message); }

        res.json({ success: true });

    } catch (e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally {
        client.release();
    }
});

// Получение выводов
app.get('/api/user/withdrawals/:userId', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT w.*, p.name, p.image 
             FROM withdrawals w
             LEFT JOIN prizes p ON w.item_id = p.id
             WHERE w.user_id = $1 
             ORDER BY w.created_at DESC`, 
            [req.params.userId]
        );
        const withdrawals = result.rows.map(row => ({
            id: row.id,
            status: row.status,
            created_at: row.created_at,
            target_username: row.target_username,
            item_data: { name: row.name, image: row.image }
        }));
        res.json(withdrawals);
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
// === PUBLIC API ===
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

// ==================================================
// === ОПЛАТА ===
// ==================================================

app.post('/api/create-invoice', verifyTelegramWebAppData, async (req, res) => {
    const { amount, userId } = req.body;
    try {
        const link = await bot.createInvoiceLink(
            `Пополнение`, 
            `Stars`, 
            JSON.stringify({ userId, amount, ts: Date.now() }), 
            "", 
            "XTR", 
            [{ label: "Stars", amount: parseInt(amount) }]
        );
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
    } catch (err) { 
        await client.query('ROLLBACK'); 
        console.error("Payment error:", err);
        return { success: false }; 
    } finally { client.release(); }
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
        try {
            const payload = JSON.parse(p.invoice_payload);
            await creditUserBalance(payload.userId, p.total_amount, p.telegram_payment_charge_id, 'XTR');
        } catch(e) { console.error('Payload error', e); }
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
