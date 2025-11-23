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
const ADMIN_WALLET_ADDRESS = 'UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJKZ'; 
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_UjHpMaRQo56v@ep-wild-rain-a4ouqppu-pooler.us-east-1.aws.neon.tech/neondb';
const APP_URL = process.env.APP_URL || 'https://easydrop-stars-1.onrender.com';

const app = express();
const PORT = process.env.PORT || 3001;

// --- НАСТРОЙКА ЗАГРУЗКИ ФАЙЛОВ (Multer) ---
// Папка для загрузок: build/uploads (чтобы файлы были доступны как статика)
const uploadDir = path.join(__dirname, '..', 'build', 'uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir)
    },
    filename: function (req, file, cb) {
        // Генерируем уникальное имя файла
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, uniqueSuffix + path.extname(file.originalname))
    }
});

const upload = multer({ storage: storage });

// --- БОТ И MIDDLEWARE ---
const bot = new TelegramBot(BOT_TOKEN, { polling: false });
app.use(cors());
app.use(express.json());

// Раздаем папку с загрузками как статику
app.use('/uploads', express.static(uploadDir));

app.post(`/bot${BOT_TOKEN}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// --- ПОДКЛЮЧЕНИЕ К БД ---
const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

pool.connect((err) => {
    if (err) console.error('🚨 ОШИБКА БД:', err.message);
    else console.log('✅ Подключение к БД успешно');
});

// ==================================================
// === ДАННЫЕ ПО УМОЛЧАНИЮ (Используются только при первой инициализации) ===
// ==================================================

const INITIAL_PRIZES = [
    { id: 'c1_item_1', name: 'Золотые часы', image: '/images/case/item.png', value: 250000, chance: 1 },
    { id: 'c1_item_2', name: 'Кепка Telegram', image: '/images/case/item1.png', value: 12000, chance: 5 },
    // ... остальные призы можно оставить или добавить по желанию ...
];

const INITIAL_CASES = [
    { id: 'case_1', name: 'Классический', image: '/images/case.png', price: 2500, prizeIds: ['c1_item_1','c1_item_2'], isPromo: false, tag: 'common' }
];

// ==================================================
// === ИНИЦИАЛИЗАЦИЯ БД ===
// ==================================================

const initDB = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (id BIGINT PRIMARY KEY, first_name TEXT, username TEXT, photo_url TEXT);
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

        // Миграции (добавляем недостающие колонки для старых баз данных)
        try { await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS balance INT DEFAULT 0`); } catch(e){}
        try { await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS inventory JSONB DEFAULT '[]'`); } catch(e){}
        try { await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS history JSONB DEFAULT '[]'`); } catch(e){}
        try { await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS total_top_up INT DEFAULT 0`); } catch(e){}
        try { await pool.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS tag TEXT DEFAULT 'common'`); } catch(e){}
        try { await pool.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS image TEXT`); } catch(e){}
        // НОВЫЕ КОЛОНКИ
        try { await pool.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS promo_code TEXT`); } catch(e){}
        try { await pool.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS max_activations INT DEFAULT 0`); } catch(e){}
        try { await pool.query(`ALTER TABLE cases ADD COLUMN IF NOT EXISTS current_activations INT DEFAULT 0`); } catch(e){}
        
        // Первоначальное заполнение (только если пусто)
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

app.get('/api/config', async (req, res) => {
    try {
        const prizes = await pool.query('SELECT * FROM prizes ORDER BY value ASC');
        const cases = await pool.query('SELECT * FROM cases ORDER BY price ASC');
        
        // Фильтрация кейсов: Скрываем те, где лимит исчерпан
        const activeCases = cases.rows.filter(c => {
            if (c.max_activations > 0 && c.current_activations >= c.max_activations) {
                return false; // Лимит достигнут, скрываем
            }
            return true;
        });

        const mappedCases = activeCases.map(c => {
            let items = c.prize_ids;
            // Обработка старого формата (массив строк) -> новый формат (объекты с шансом)
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
                promoCode: c.promo_code,           // Передаем клиенту (для проверки)
                maxActivations: c.max_activations,
                currentActivations: c.current_activations
            };
        });

        res.json({ prizes: prizes.rows, cases: mappedCases });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// НОВЫЙ ЭНДПОИНТ: Фиксация прокрута кейса
app.post('/api/case/spin', async (req, res) => {
    const { caseId } = req.body;
    try {
        // Проверяем лимиты перед спином
        const check = await pool.query('SELECT max_activations, current_activations FROM cases WHERE id = $1', [caseId]);
        if (check.rows.length > 0) {
            const c = check.rows[0];
            if (c.max_activations > 0 && c.current_activations >= c.max_activations) {
                return res.status(400).json({ error: 'Case limit reached' });
            }
            // Увеличиваем счетчик
            await pool.query('UPDATE cases SET current_activations = current_activations + 1 WHERE id = $1', [caseId]);
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
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

// ОБНОВЛЕНО: Создание кейса с картинкой и новыми полями
app.post('/api/admin/case/create', upload.single('imageFile'), async (req, res) => {
    const { name, price, prizeIds, tag, isPromo, promoCode, maxActivations } = req.body;
    const id = `case_${Date.now()}`;
    
    let imagePath = '/images/case.png';
    if (req.file) {
        imagePath = `/uploads/${req.file.filename}`;
    }

    try {
        // FormData передает JSON как строку, парсим обратно
        const parsedPrizeIds = JSON.parse(prizeIds);
        
        const r = await pool.query(
            'INSERT INTO cases (id, name, image, price, prize_ids, tag, is_promo, promo_code, max_activations) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *', 
            [id, name, imagePath, price, JSON.stringify(parsedPrizeIds), tag, isPromo === 'true', promoCode, maxActivations || 0]
        );
        res.json(r.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ОБНОВЛЕНО: Обновление кейса с картинкой и новыми полями
app.post('/api/admin/case/update', upload.single('imageFile'), async (req, res) => {
    const { id, name, price, prizeIds, tag, isPromo, promoCode, maxActivations, existingImage } = req.body;

    let imagePath = existingImage;
    if (req.file) {
        imagePath = `/uploads/${req.file.filename}`;
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

app.post('/api/admin/prize/update', async (req, res) => {
    const { id, value, chance } = req.body;
    try {
        const r = await pool.query('UPDATE prizes SET value=$1, chance=$2 WHERE id=$3 RETURNING *', [value, chance, id]);
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
