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
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_UjHpMaRQo56v@ep-wild-rain-a4ouqppu-pooler.us-east-1.aws.neon.tech/neondb';
const APP_URL = process.env.APP_URL || 'https://easydrop-stars-1.onrender.com';

const app = express();
const PORT = process.env.PORT || 3001;

// --- НАСТРОЙКА ЗАГРУЗКИ ФАЙЛОВ (Multer - Memory Storage) ---
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const bot = new TelegramBot(BOT_TOKEN, { polling: false });
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Раздача статики (для встроенных картинок)
app.use('/uploads', express.static(path.join(__dirname, '..', 'build', 'uploads')));

app.post(`/bot${BOT_TOKEN}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// --- ПОДКЛЮЧЕНИЕ К БД ---
const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

pool.on('error', (err, client) => {
    console.error('🚨 Ошибка в пуле БД (idle client):', err.message);
});

pool.connect((err) => {
    if (err) console.error('🚨 ОШИБКА БД:', err.message);
    else console.log('✅ Подключение к БД успешно');
});

// ==================================================
// === ИНИЦИАЛИЗАЦИЯ БД ===
// ==================================================

const INITIAL_PRIZES = [
    { id: 'c1_item_1', name: 'Золотые часы', image: '/images/case/item.png', value: 250000, chance: 1 },
    { id: 'c1_item_2', name: 'Кепка Telegram', image: '/images/case/item1.png', value: 12000, chance: 5 },
];

const INITIAL_CASES = [
    { id: 'case_1', name: 'Классический', image: '/images/case.png', price: 2500, prizeIds: ['c1_item_1','c1_item_2'], isPromo: false, tag: 'common' }
];

const initDB = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (id BIGINT PRIMARY KEY, first_name TEXT, username TEXT, photo_url TEXT, balance INT DEFAULT 0, inventory JSONB DEFAULT '[]', history JSONB DEFAULT '[]', total_top_up INT DEFAULT 0);
            CREATE TABLE IF NOT EXISTS transactions (id SERIAL PRIMARY KEY, tx_hash TEXT UNIQUE, user_id BIGINT, amount DECIMAL, currency TEXT, created_at TIMESTAMP DEFAULT NOW());
            CREATE TABLE IF NOT EXISTS prizes (id TEXT PRIMARY KEY, name TEXT, image TEXT, value INT, chance FLOAT);
            CREATE TABLE IF NOT EXISTS cases (
                id TEXT PRIMARY KEY, 
                name TEXT, 
                image TEXT, 
                price INT, 
                prize_ids JSONB, 
                is_promo BOOLEAN, 
                tag TEXT,
                promo_code TEXT,
                max_activations INT DEFAULT 0,
                current_activations INT DEFAULT 0
            );
        `);

        // Миграции
        try { await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS balance INT DEFAULT 0`); } catch(e){}
        try { await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS inventory JSONB DEFAULT '[]'`); } catch(e){}
        try { await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS history JSONB DEFAULT '[]'`); } catch(e){}
        try { await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS total_top_up INT DEFAULT 0`); } catch(e){}
        
        // ВАЖНО: Добавляем колонку для учета потраченных средств
        try { await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS total_spent BIGINT DEFAULT 0`); } catch(e){}
        
        try { await pool.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS tag TEXT DEFAULT 'common'`); } catch(e){}
        try { await pool.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS image TEXT`); } catch(e){}
        try { await pool.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS promo_code TEXT`); } catch(e){}
        try { await pool.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS max_activations INT DEFAULT 0`); } catch(e){}
        try { await pool.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS current_activations INT DEFAULT 0`); } catch(e){}
        
        // Заливка начальных данных
        const prizeCount = await pool.query('SELECT COUNT(*) FROM prizes');
        if (parseInt(prizeCount.rows[0].count) === 0) {
            console.log('🌱 Заливка начальных призов...');
            for (const item of INITIAL_PRIZES) {
                await pool.query(
                    'INSERT INTO prizes (id, name, image, value, chance) VALUES ($1, $2, $3, $4, $5)', 
                    [item.id, item.name, item.image, item.value, item.chance]
                );
            }
        }

        const caseCount = await pool.query('SELECT COUNT(*) FROM cases');
        if (parseInt(caseCount.rows[0].count) === 0) {
            console.log('🌱 Заливка начальных кейсов...');
            for (const c of INITIAL_CASES) {
                const formattedPrizeIds = c.prizeIds.map(pid => {
                    const p = INITIAL_PRIZES.find(prize => prize.id === pid);
                    return { id: pid, chance: p ? p.chance : 0 };
                });

                await pool.query(
                    'INSERT INTO cases (id, name, image, price, prize_ids, is_promo, tag) VALUES ($1, $2, $3, $4, $5, $6, $7)', 
                    [c.id, c.name, c.image, c.price, JSON.stringify(formattedPrizeIds), c.isPromo || false, c.tag || 'common']
                );
            }
        }
        
        console.log('>>> БД готова!');
    } catch (err) { console.error('🚨 Init Error:', err.message); }
};

initDB();

// ==================================================
// === API ENDPOINTS ===
// ==================================================

// 1. ПОЛУЧЕНИЕ РЕЙТИНГА (Топ по total_spent)
app.get('/api/leaders', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT first_name, photo_url, total_spent 
            FROM users 
            ORDER BY total_spent DESC NULLS LAST
            LIMIT 10
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/config', async (req, res) => {
    try {
        const prizes = await pool.query('SELECT * FROM prizes ORDER BY value ASC');
        const cases = await pool.query('SELECT * FROM cases ORDER BY price ASC');
        
        const activeCases = cases.rows.filter(c => {
            if (c.max_activations > 0 && c.current_activations >= c.max_activations) {
                return false; 
            }
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
                id: c.id, 
                name: c.name, 
                image: c.image || '/images/case.png', 
                price: c.price, 
                prizeIds: items,
                isPromo: c.is_promo,
                tag: c.tag || 'common',
                promoCode: c.promo_code,
                maxActivations: c.max_activations,
                currentActivations: c.current_activations
            };
        });

        res.json({ prizes: prizes.rows, cases: mappedCases });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. ОТКРЫТИЕ КЕЙСА (Обновление статистики трат)
app.post('/api/case/spin', async (req, res) => {
    const { caseId, userId, quantity } = req.body;
    try {
        const check = await pool.query('SELECT price, max_activations, current_activations FROM cases WHERE id = $1', [caseId]);
        if (check.rows.length > 0) {
            const c = check.rows[0];
            const qty = parseInt(quantity) || 1;

            // Проверка лимитов
            if (c.max_activations > 0 && (c.current_activations + qty) > c.max_activations) {
                return res.status(400).json({ error: 'Case limit reached' });
            }
            
            // Обновляем счетчик кейса
            await pool.query('UPDATE cases SET current_activations = current_activations + $1 WHERE id = $2', [qty, caseId]);

            // Если это не промо-кейс, засчитываем траты пользователю
            const price = Number(c.price);
            if (userId && price > 0) {
                const totalCost = price * qty;
                
                // ЛОГИРОВАНИЕ ДЛЯ ОТЛАДКИ (можно убрать потом)
                console.log(`[SPIN] User ${userId} spent ${totalCost} stars on case ${caseId}`);
                
                // ИСПРАВЛЕНИЕ: Явное приведение id к bigint ($2::bigint) для надежности поиска
                await pool.query(
                    'UPDATE users SET total_spent = COALESCE(total_spent, 0) + $1 WHERE id = $2::bigint', 
                    [totalCost, userId]
                );
            } else {
                console.log(`[SPIN] Skipped total_spent update: userId=${userId}, price=${price}`);
            }
        }
        res.json({ success: true });
    } catch (err) { 
        console.error('SPIN ERROR:', err);
        res.status(500).json({ error: err.message }); 
    }
});

app.post('/api/user/sync', async (req, res) => {
    const { id, first_name, username, photo_url } = req.body;
    try {
        const query = `INSERT INTO users (id, first_name, username, photo_url, balance) VALUES ($1, $2, $3, $4, 0) ON CONFLICT (id) DO UPDATE SET first_name = EXCLUDED.first_name, username = EXCLUDED.username, photo_url = EXCLUDED.photo_url RETURNING *;`;
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

// --- АДМИНСКИЕ API ---

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

// --- КЕЙСЫ (С загрузкой фото) ---

app.post('/api/admin/case/create', upload.single('imageFile'), async (req, res) => {
    const { name, price, prizeIds, tag, isPromo, promoCode, maxActivations } = req.body;
    const id = `case_${Date.now()}`;
    
    let imagePath = '/images/case.png';
    if (req.file) {
        const b64 = Buffer.from(req.file.buffer).toString('base64');
        const mimeType = req.file.mimetype; 
        imagePath = `data:${mimeType};base64,${b64}`;
    }

    try {
        const parsedPrizeIds = JSON.parse(prizeIds);
        const r = await pool.query(
            'INSERT INTO cases (id, name, image, price, prize_ids, tag, is_promo, promo_code, max_activations) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *', 
            [id, name, imagePath, price, JSON.stringify(parsedPrizeIds), tag, isPromo === 'true', promoCode, maxActivations || 0]
        );
        res.json(r.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/case/update', upload.single('imageFile'), async (req, res) => {
    const { id, name, price, prizeIds, tag, isPromo, promoCode, maxActivations, existingImage } = req.body;

    let imagePath = existingImage;
    if (req.file) {
        const b64 = Buffer.from(req.file.buffer).toString('base64');
        const mimeType = req.file.mimetype;
        imagePath = `data:${mimeType};base64,${b64}`;
    }

    try {
        const parsedPrizeIds = JSON.parse(prizeIds);
        const r = await pool.query(
            'UPDATE cases SET name=$1, price=$2, prize_ids=$3, tag=$4, image=$5, is_promo=$6, promo_code=$7, max_activations=$8 WHERE id=$9 RETURNING *', 
            [name, price, JSON.stringify(parsedPrizeIds), tag, imagePath, isPromo === 'true', promoCode, maxActivations || 0, id]
        );
        res.json(r.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- ПРЕДМЕТЫ (С загрузкой фото и созданием) ---

app.post('/api/admin/prize/create', upload.single('imageFile'), async (req, res) => {
    const { name, value, chance } = req.body;
    const id = `item_${Date.now()}`;
    
    let imagePath = '/images/case/item.png';
    if (req.file) {
        const b64 = Buffer.from(req.file.buffer).toString('base64');
        const mimeType = req.file.mimetype;
        imagePath = `data:${mimeType};base64,${b64}`;
    }

    try {
        const r = await pool.query(
            'INSERT INTO prizes (id, name, image, value, chance) VALUES ($1, $2, $3, $4, $5) RETURNING *', 
            [id, name, imagePath, parseInt(value), parseFloat(chance)]
        );
        res.json(r.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/prize/update', upload.single('imageFile'), async (req, res) => {
    const { id, name, value, chance, existingImage } = req.body;
    
    let imagePath = existingImage;
    if (req.file) {
        const b64 = Buffer.from(req.file.buffer).toString('base64');
        const mimeType = req.file.mimetype;
        imagePath = `data:${mimeType};base64,${b64}`;
    }

    try {
        const r = await pool.query(
            'UPDATE prizes SET name=$1, value=$2, chance=$3, image=$4 WHERE id=$5 RETURNING *', 
            [name, parseInt(value), parseFloat(chance), imagePath, id]
        );
        res.json(r.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- ОПЛАТА ---

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
        // При пополнении обновляем и total_top_up
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

// --- ЗАПУСК ---
app.use(express.static(path.join(__dirname, '..', 'build')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '..', 'build', 'index.html')));

app.listen(PORT, async () => {
    console.log(`Server started on port ${PORT}`);
    try { await bot.setWebHook(`${APP_URL}/bot${BOT_TOKEN}`); console.log(`Webhook OK`); } catch (e) { console.error(e.message); }
});
