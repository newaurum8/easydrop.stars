require('dotenv').config();
const Fastify = require('fastify');
const { Pool } = require('pg');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const { getHttpEndpoint } = require('@orbs-network/ton-access');
const { TonClient, Cell } = require('ton');
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

// Инициализация Fastify
// bodyLimit увеличен до 50MB для загрузки картинок
const fastify = Fastify({ 
    logger: true,
    bodyLimit: 50 * 1024 * 1024 
});

const bot = new TelegramBot(BOT_TOKEN, { polling: false });

// --- ПЛАГИНЫ ---

// 1. CORS
fastify.register(require('@fastify/cors'), { 
    origin: true // В продакшене лучше указать конкретный домен
});

// 2. Multipart (загрузка файлов)
fastify.register(require('@fastify/multipart'), {
    attachFieldsToBody: true, // Поля и файлы будут доступны в req.body
    limits: { fileSize: 10 * 1024 * 1024 } // 10 MB
});

// 3. Статические файлы (Vite собирает в папку dist)
fastify.register(require('@fastify/static'), {
    root: path.join(__dirname, '..', 'dist'),
    prefix: '/', // Раздавать от корня
    wildcard: false // Отключаем wildcard, чтобы работал наш SPA fallback
});

// --- ПОДКЛЮЧЕНИЕ К БД ---
const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

pool.on('error', (err) => console.error('🚨 Ошибка подключения к БД:', err));

// ==================================================
// === ИНИЦИАЛИЗАЦИЯ ТАБЛИЦ ===
// ==================================================

async function initDatabase() {
    const client = await pool.connect();
    try {
        console.log("🔄 Проверка и создание таблиц БД...");

        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id BIGINT PRIMARY KEY,
                first_name TEXT,
                username TEXT,
                photo_url TEXT,
                balance INT DEFAULT 0,
                total_spent INT DEFAULT 0,
                total_top_up INT DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS prizes (
                id TEXT PRIMARY KEY,
                name TEXT,
                image TEXT,
                value INT DEFAULT 0,
                chance FLOAT DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS cases (
                id TEXT PRIMARY KEY,
                name TEXT,
                image TEXT,
                price INT DEFAULT 0,
                prize_ids JSONB,
                tag TEXT DEFAULT 'common',
                is_promo BOOLEAN DEFAULT false,
                promo_code TEXT,
                max_activations INT DEFAULT 0,
                current_activations INT DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS inventory_items (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                user_id BIGINT REFERENCES users(id),
                item_id TEXT REFERENCES prizes(id),
                created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS history_logs (
                id SERIAL PRIMARY KEY,
                user_id BIGINT,
                item_id TEXT,
                action_type TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS withdrawals (
                id SERIAL PRIMARY KEY,
                user_id BIGINT,
                username TEXT,
                item_id TEXT,
                item_uuid UUID,
                target_username TEXT,
                status TEXT DEFAULT 'processing',
                created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS transactions (
                id SERIAL PRIMARY KEY,
                tx_hash TEXT,
                user_id BIGINT,
                amount FLOAT,
                currency TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log("✅ Таблицы базы данных успешно инициализированы.");
    } catch (e) {
        console.error("🚨 Ошибка инициализации БД:", e);
    } finally {
        client.release();
    }
}

// ==================================================
// === DECORATORS (MIDDLEWARE) ===
// ==================================================

// Проверка данных Telegram
fastify.decorate('verifyTelegramWebAppData', async (request, reply) => {
    const initData = request.headers['x-telegram-init-data'];

    // DEV-режим
    if (!initData && process.env.NODE_ENV === 'development') {
        request.user = { id: 123456789, username: 'dev_user', first_name: 'Dev' };
        return;
    }

    if (!initData) {
        reply.code(401).send({ error: 'Authorization required' });
        return;
    }

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
            request.user = JSON.parse(urlParams.get('user'));
        } catch (e) {
            reply.code(400).send({ error: 'Invalid user data format' });
        }
    } else {
        console.error("⚠️ Auth Failed: Hash mismatch.");
        reply.code(403).send({ error: 'Data integrity check failed' });
    }
});

// Проверка админа
fastify.decorate('verifyAdmin', async (request, reply) => {
    const password = request.headers['x-admin-password'];
    if (!password || password !== ADMIN_PASSWORD) {
        reply.code(403).send({ error: 'Admin access denied' });
    }
});

// ==================================================
// === API ROUTES ===
// ==================================================

// Вебхук для бота
fastify.post(`/bot${BOT_TOKEN}`, async (request, reply) => {
    bot.processUpdate(request.body);
    return { status: 'ok' };
});

// 1. СИНХРОНИЗАЦИЯ
fastify.post('/api/user/sync', { preHandler: [fastify.verifyTelegramWebAppData] }, async (req, reply) => {
    const { id, first_name, username, photo_url } = req.user;
    const client = await pool.connect();
    try {
        await client.query(
            `INSERT INTO users (id, first_name, username, photo_url) VALUES ($1, $2, $3, $4)
             ON CONFLICT (id) DO UPDATE SET first_name = EXCLUDED.first_name, username = EXCLUDED.username, photo_url = EXCLUDED.photo_url`,
            [id, first_name, username, photo_url]
        );

        const userRes = await client.query('SELECT * FROM users WHERE id = $1', [id]);
        const invRes = await client.query(
            `SELECT i.id as "inventoryId", p.id, p.name, p.image, p.value, p.chance, i.created_at 
             FROM inventory_items i JOIN prizes p ON i.item_id = p.id 
             WHERE i.user_id = $1 ORDER BY i.created_at DESC`, [id]
        );
        const histRes = await client.query(
            `SELECT h.created_at as date, p.name, p.image, p.value 
             FROM history_logs h JOIN prizes p ON h.item_id = p.id 
             WHERE h.user_id = $1 ORDER BY h.created_at DESC LIMIT 50`, [id]
        );

        return { ...userRes.rows[0], inventory: invRes.rows, history: histRes.rows };
    } catch (e) {
        reply.code(500).send({ error: 'Database sync error: ' + e.message });
    } finally {
        client.release();
    }
});

// 2. ОТКРЫТИЕ КЕЙСА
fastify.post('/api/case/spin', { preHandler: [fastify.verifyTelegramWebAppData] }, async (req, reply) => {
    const userId = req.user.id;
    const { caseId, quantity } = req.body;
    const qty = parseInt(quantity);

    if (!qty || qty < 1 || qty > 10) return reply.code(400).send({ error: 'Invalid quantity (1-10)' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const userRes = await client.query('SELECT balance FROM users WHERE id = $1 FOR UPDATE', [userId]);
        if (userRes.rows.length === 0) throw new Error('User not found');
        const userBalance = parseInt(userRes.rows[0].balance);

        const caseRes = await client.query('SELECT * FROM cases WHERE id = $1', [caseId]);
        if (caseRes.rows.length === 0) throw new Error('Case not found');
        const caseItem = caseRes.rows[0];

        if (caseItem.max_activations > 0 && (caseItem.current_activations + qty) > caseItem.max_activations) {
            throw new Error('Case limit reached');
        }

        const totalCost = caseItem.is_promo ? 0 : (parseInt(caseItem.price) * qty);
        if (userBalance < totalCost) {
            await client.query('ROLLBACK');
            return reply.code(400).send({ error: 'Недостаточно средств' });
        }

        // Генерация лута
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

        await client.query('UPDATE users SET balance = balance - $1, total_spent = total_spent + $1 WHERE id = $2', [totalCost, userId]);
        await client.query('UPDATE cases SET current_activations = current_activations + $1 WHERE id = $2', [qty, caseId]);

        for (const item of wonItems) {
            await client.query('INSERT INTO inventory_items (user_id, item_id) VALUES ($1, $2)', [userId, item.id]);
            await client.query('INSERT INTO history_logs (user_id, item_id, action_type) VALUES ($1, $2, $3)', [userId, item.id, 'drop']);
        }

        await client.query('COMMIT');

        const newInvRes = await client.query(
            `SELECT i.id as "inventoryId", p.* FROM inventory_items i 
             JOIN prizes p ON i.item_id = p.id 
             WHERE i.user_id = $1 ORDER BY i.created_at DESC LIMIT $2`,
            [userId, qty]
        );

        return { success: true, newBalance: userBalance - totalCost, wonItems: newInvRes.rows };

    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Spin error:", e);
        return reply.code(500).send({ error: e.message || 'Server Error' });
    } finally {
        client.release();
    }
});

// 3. ПРОДАЖА ПРЕДМЕТА
fastify.post('/api/user/sell-item', { preHandler: [fastify.verifyTelegramWebAppData] }, async (req, reply) => {
    const userId = req.user.id;
    const { inventoryId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const itemRes = await client.query(
            `SELECT i.id, p.value FROM inventory_items i JOIN prizes p ON i.item_id = p.id 
             WHERE i.id = $1 AND i.user_id = $2 FOR UPDATE`, [inventoryId, userId]
        );

        if (itemRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return reply.code(404).send({ error: 'Item not found or already sold' });
        }

        await client.query('DELETE FROM inventory_items WHERE id = $1', [inventoryId]);
        const userUpd = await client.query('UPDATE users SET balance = balance + $1 WHERE id = $2 RETURNING balance', [itemRes.rows[0].value, userId]);
        
        await client.query('COMMIT');
        return { success: true, newBalance: userUpd.rows[0].balance };
    } catch (e) {
        await client.query('ROLLBACK');
        return reply.code(500).send({ error: 'Server error: ' + e.message });
    } finally {
        client.release();
    }
});

// 4. ПРОДАЖА ВСЕГО
fastify.post('/api/user/sell-all', { preHandler: [fastify.verifyTelegramWebAppData] }, async (req, reply) => {
    const userId = req.user.id;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const sumRes = await client.query(
            `SELECT SUM(p.value) as total FROM inventory_items i JOIN prizes p ON i.item_id = p.id WHERE i.user_id = $1`,
            [userId]
        );
        const totalValue = parseInt(sumRes.rows[0].total) || 0;

        if (totalValue > 0) {
            await client.query('DELETE FROM inventory_items WHERE user_id = $1', [userId]);
            const userUpd = await client.query('UPDATE users SET balance = balance + $1 WHERE id = $2 RETURNING balance', [totalValue, userId]);
            await client.query('COMMIT');
            return { success: true, addedBalance: totalValue, newBalance: userUpd.rows[0].balance };
        } else {
            await client.query('ROLLBACK');
            return { success: true, addedBalance: 0 };
        }
    } catch (e) {
        await client.query('ROLLBACK');
        return reply.code(500).send({ error: 'Server error: ' + e.message });
    } finally {
        client.release();
    }
});

// 5. АПГРЕЙД
fastify.post('/api/user/upgrade', { preHandler: [fastify.verifyTelegramWebAppData] }, async (req, reply) => {
    const userId = req.user.id;
    const { inventoryId, targetItemId } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const sourceRes = await client.query(
            `SELECT i.id, p.value FROM inventory_items i JOIN prizes p ON i.item_id = p.id 
             WHERE i.id = $1 AND i.user_id = $2 FOR UPDATE`, [inventoryId, userId]
        );
        if (sourceRes.rows.length === 0) throw new Error('Source item not found');
        const sourceItem = sourceRes.rows[0];

        const targetRes = await client.query('SELECT * FROM prizes WHERE id = $1', [targetItemId]);
        if (targetRes.rows.length === 0) throw new Error('Target item invalid');
        const targetItem = targetRes.rows[0];

        await client.query('DELETE FROM inventory_items WHERE id = $1', [inventoryId]);

        const chance = Math.min(Math.max((sourceItem.value / targetItem.value) * 50, 1), 95);
        const isSuccess = Math.random() * 100 < chance;
        
        let newItem = null;
        if (isSuccess) {
            const ins = await client.query(
                'INSERT INTO inventory_items (user_id, item_id) VALUES ($1, $2) RETURNING id, created_at',
                [userId, targetItem.id]
            );
            await client.query('INSERT INTO history_logs (user_id, item_id, action_type) VALUES ($1, $2, $3)', [userId, targetItem.id, 'upgrade_success']);
            newItem = { ...targetItem, inventoryId: ins.rows[0].id };
        } else {
            await client.query('INSERT INTO history_logs (user_id, item_id, action_type) VALUES ($1, $2, $3)', [userId, targetItem.id, 'upgrade_fail']);
        }

        await client.query('COMMIT');
        return { success: isSuccess, newItem, chance };
    } catch (e) {
        await client.query('ROLLBACK');
        return reply.code(500).send({ error: e.message });
    } finally {
        client.release();
    }
});

// 6. ВЫВОД
fastify.post('/api/withdraw/request', { preHandler: [fastify.verifyTelegramWebAppData] }, async (req, reply) => {
    const userId = req.user.id;
    const { itemInventoryId, targetUsername } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const itemRes = await client.query(
            `SELECT i.id, i.item_id, p.name, p.value, p.image FROM inventory_items i 
             JOIN prizes p ON i.item_id = p.id WHERE i.id = $1 AND i.user_id = $2 FOR UPDATE`, [itemInventoryId, userId]
        );
        if (itemRes.rows.length === 0) throw new Error('Item not found');
        const item = itemRes.rows[0];

        await client.query('DELETE FROM inventory_items WHERE id = $1', [itemInventoryId]);
        const withRes = await client.query(
            `INSERT INTO withdrawals (user_id, username, item_id, item_uuid, target_username) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [userId, req.user.username, item.item_id, itemInventoryId, targetUsername]
        );
        await client.query('COMMIT');

        // Уведомление в TG
        const caption = `📦 <b>Заявка #${withRes.rows[0].id}</b>\n🎁 ${item.name}\n💰 ${item.value}\n👤 @${req.user.username}\n👉 @${targetUsername}`;
        try {
            if (item.image && item.image.startsWith('http')) await bot.sendPhoto(ADMIN_CHAT_ID, item.image, {caption, parse_mode:'HTML'});
            else await bot.sendMessage(ADMIN_CHAT_ID, caption, {parse_mode:'HTML'});
        } catch(e) {}

        return { success: true };
    } catch (e) {
        await client.query('ROLLBACK');
        return reply.code(500).send({ error: e.message });
    } finally {
        client.release();
    }
});

fastify.get('/api/user/withdrawals/:userId', async (req, reply) => {
    const res = await pool.query(
        `SELECT w.*, p.name, p.image FROM withdrawals w
         LEFT JOIN prizes p ON w.item_id = p.id
         WHERE w.user_id = $1 ORDER BY w.created_at DESC`, [req.params.userId]
    );
    return res.rows.map(row => ({
        id: row.id, status: row.status, created_at: row.created_at, target_username: row.target_username,
        item_data: { name: row.name, image: row.image }
    }));
});

// ПУБЛИЧНЫЕ
fastify.get('/api/leaders', async (req, reply) => {
    const res = await pool.query(`SELECT first_name, photo_url, total_spent FROM users ORDER BY total_spent DESC NULLS LAST LIMIT 10`);
    return res.rows;
});

fastify.get('/api/config', async (req, reply) => {
    const prizes = await pool.query('SELECT * FROM prizes ORDER BY value ASC');
    const cases = await pool.query('SELECT * FROM cases ORDER BY price ASC');
    
    const activeCases = cases.rows.filter(c => !(c.max_activations > 0 && c.current_activations >= c.max_activations));
    
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

    return { prizes: prizes.rows, cases: mappedCases };
});

// ОПЛАТА
fastify.post('/api/create-invoice', { preHandler: [fastify.verifyTelegramWebAppData] }, async (req, reply) => {
    const { amount, userId } = req.body;
    try {
        const link = await bot.createInvoiceLink(
            `Пополнение`, `Stars`, JSON.stringify({ userId, amount, ts: Date.now() }), "", "XTR", [{ label: "Stars", amount: parseInt(amount) }]
        );
        return { invoiceLink: link };
    } catch (err) { return reply.code(500).send({ error: err.message }); }
});

fastify.post('/api/verify-ton-payment', async (req, reply) => {
    const { boc, userId, amount } = req.body;
    try {
        const cell = Cell.fromBase64(boc);
        const client = new TonClient({ endpoint: await getHttpEndpoint({ network: 'mainnet' }) });
        await client.sendFile(cell.toBoc());
        
        // Логика зачисления (вынесена для краткости)
        const clientDB = await pool.connect();
        try {
            await clientDB.query('BEGIN');
            const hash = cell.hash().toString('hex');
            const check = await clientDB.query('SELECT id FROM transactions WHERE tx_hash = $1', [hash]);
            if (check.rows.length > 0) { await clientDB.query('ROLLBACK'); return { success: false }; }
            
            await clientDB.query('INSERT INTO transactions (tx_hash, user_id, amount, currency) VALUES ($1, $2, $3, $4)', [hash, userId, amount, 'TON']);
            const stars = amount * 3000;
            await clientDB.query('UPDATE users SET balance = balance + $1, total_top_up = total_top_up + $1 WHERE id = $2', [Math.floor(stars), userId]);
            await clientDB.query('COMMIT');
            return { success: true };
        } catch(e) { await clientDB.query('ROLLBACK'); throw e; } finally { clientDB.release(); }
    } catch (err) { return reply.code(500).send({ error: 'Verify failed' }); }
});

// ==================================================
// === ADMIN ROUTES (С загрузкой файлов) ===
// ==================================================

// Вспомогательная функция для обработки файлов
const processUpload = async (parts) => {
    // В Fastify multipart при attachFieldsToBody: true,
    // текстовые поля доступны как parts.field.value, а файлы как объекты
    const data = {};
    let imagePath = null;

    // Перебираем ключи тела
    for (const key in parts) {
        const field = parts[key];
        if (field && field.type === 'file') {
            // Это файл
            const buffer = await field.toBuffer();
            const b64 = buffer.toString('base64');
            imagePath = `data:${field.mimetype};base64,${b64}`;
        } else if (field && field.value !== undefined) {
            // Это текстовое поле
            data[key] = field.value;
        } else {
            // Обычное поле (если не file object)
            data[key] = field;
        }
    }
    return { data, imagePath };
};

fastify.post('/api/admin/case/create', { preHandler: [fastify.verifyAdmin] }, async (req, reply) => {
    try {
        // Fastify multipart кладет всё в req.body
        const { data, imagePath } = await processUpload(req.body);
        const finalImg = imagePath || '/images/case.png';
        const id = `case_${Date.now()}`;
        
        let parsedPrizeIds = [];
        try { parsedPrizeIds = JSON.parse(data.prizeIds); } catch (e) {}

        const r = await pool.query(
            'INSERT INTO cases (id, name, image, price, prize_ids, tag, is_promo, promo_code, max_activations) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
            [id, data.name, finalImg, parseInt(data.price)||0, JSON.stringify(parsedPrizeIds), data.tag, data.isPromo === 'true', data.promoCode, parseInt(data.maxActivations)||0]
        );
        return r.rows[0];
    } catch (err) { return reply.code(500).send({ error: err.message }); }
});

fastify.post('/api/admin/case/update', { preHandler: [fastify.verifyAdmin] }, async (req, reply) => {
    try {
        const { data, imagePath } = await processUpload(req.body);
        const finalImg = imagePath || data.existingImage || '/images/case.png';
        let parsedPrizeIds = [];
        try { parsedPrizeIds = JSON.parse(data.prizeIds); } catch (e) {}

        const r = await pool.query(
            'UPDATE cases SET name=$1, price=$2, prize_ids=$3, tag=$4, image=$5, is_promo=$6, promo_code=$7, max_activations=$8 WHERE id=$9 RETURNING *',
            [data.name, parseInt(data.price)||0, JSON.stringify(parsedPrizeIds), data.tag, finalImg, data.isPromo==='true', data.promoCode, parseInt(data.maxActivations)||0, data.id]
        );
        return r.rows[0];
    } catch (err) { return reply.code(500).send({ error: err.message }); }
});

fastify.post('/api/admin/prize/create', { preHandler: [fastify.verifyAdmin] }, async (req, reply) => {
    try {
        const { data, imagePath } = await processUpload(req.body);
        const finalImg = imagePath || '/images/case/item.png';
        const id = `item_${Date.now()}`;
        
        const r = await pool.query('INSERT INTO prizes (id, name, image, value, chance) VALUES ($1, $2, $3, $4, $5) RETURNING *', 
            [id, data.name, finalImg, parseInt(data.value), parseFloat(data.chance)]);
        return r.rows[0];
    } catch (err) { return reply.code(500).send({ error: err.message }); }
});

fastify.post('/api/admin/prize/update', { preHandler: [fastify.verifyAdmin] }, async (req, reply) => {
    try {
        const { data, imagePath } = await processUpload(req.body);
        const finalImg = imagePath || data.existingImage;
        const r = await pool.query('UPDATE prizes SET name=$1, value=$2, chance=$3, image=$4 WHERE id=$5 RETURNING *', 
            [data.name, parseInt(data.value), parseFloat(data.chance), finalImg, data.id]);
        return r.rows[0];
    } catch (err) { return reply.code(500).send({ error: err.message }); }
});

fastify.get('/api/admin/user/:id', { preHandler: [fastify.verifyAdmin] }, async (req, reply) => {
    const r = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (r.rows.length === 0) return reply.code(404).send({ error: 'User not found' });
    return r.rows[0];
});

fastify.post('/api/admin/user/balance', { preHandler: [fastify.verifyAdmin] }, async (req, reply) => {
    const { id, amount } = req.body;
    const r = await pool.query('UPDATE users SET balance = $1 WHERE id = $2 RETURNING *', [amount, id]);
    return r.rows[0];
});

// SPA FALLBACK для React (Vite)
fastify.setNotFoundHandler((req, reply) => {
    // Если запрос не начинается с /api и не к статическому файлу (который бы обработал @fastify/static),
    // возвращаем index.html
    if (req.raw.url.startsWith('/api')) {
        reply.code(404).send({ error: 'Not Found' });
    } else {
        reply.sendFile('index.html');
    }
});

// ==================================================
// === ЗАПУСК СЕРВЕРА ===
// ==================================================

const start = async () => {
    try {
        // Инициализация БД
        await initDatabase();

        await fastify.listen({ port: PORT, host: '0.0.0.0' });
        console.log(`✅ Fastify Server running on port ${PORT}`);

        // Webhook бота
        if (APP_URL && BOT_TOKEN) {
            try {
                await bot.setWebHook(`${APP_URL}/bot${BOT_TOKEN}`);
                console.log(`✅ Webhook set: ${APP_URL}/bot${BOT_TOKEN}`);
            } catch (e) {
                console.error("Webhook error:", e.message);
            }
        }
        
        // Обработка платежей XTR (Stars) через polling (если вебхук не сработает или для надежности)
        bot.on('pre_checkout_query', async (query) => {
            bot.answerPreCheckoutQuery(query.id, true).catch(() => {});
        });
        
        bot.on('message', async (msg) => {
            if (msg.successful_payment) {
                const p = msg.successful_payment;
                try {
                    const payload = JSON.parse(p.invoice_payload);
                    const client = await pool.connect();
                    try {
                        // Зачисление Stars
                        await client.query('BEGIN');
                        const txHash = p.telegram_payment_charge_id;
                        const check = await client.query('SELECT id FROM transactions WHERE tx_hash = $1', [txHash]);
                        if (check.rows.length === 0) {
                            await client.query('INSERT INTO transactions (tx_hash, user_id, amount, currency) VALUES ($1, $2, $3, $4)', [txHash, payload.userId, p.total_amount, 'XTR']);
                            // 1 XTR = 50 звезд (примерный курс, настройте под себя)
                            const stars = p.total_amount * 50; 
                            await client.query('UPDATE users SET balance = balance + $1, total_top_up = total_top_up + $1 WHERE id = $2', [stars, payload.userId]);
                            await client.query('COMMIT');
                        } else {
                            await client.query('ROLLBACK');
                        }
                    } catch(e) { await client.query('ROLLBACK'); console.error(e); } finally { client.release(); }
                } catch(e) { console.error('Payload error', e); }
            }
        });

    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
