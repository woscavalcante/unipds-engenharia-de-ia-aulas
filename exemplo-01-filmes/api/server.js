import express from 'express';
import cors from 'cors';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const app = express();

app.use(cors());

// Equivalente a servir data/products.json no exemplo-01, agora vindo do Postgres.
app.get('/api/movies', async (req, res) => {
    const { rows } = await pool.query(
        'SELECT id, name, category, price, color FROM movies ORDER BY id'
    );
    res.json(rows);
});

// Equivalente a servir data/users.json: cada usuário já traz os filmes que
// curtiu (rating >= 4) embutidos em "purchases", no mesmo formato do exemplo-01.
app.get('/api/users', async (req, res) => {
    const { rows: users } = await pool.query('SELECT id, name, age FROM users ORDER BY id');
    const { rows: purchases } = await pool.query(`
        SELECT p.user_id, m.id, m.name, m.category, m.price, m.color
        FROM purchases p
        JOIN movies m ON m.id = p.movie_id
    `);

    const purchasesByUser = new Map();
    for (const { user_id, ...movie } of purchases) {
        if (!purchasesByUser.has(user_id)) purchasesByUser.set(user_id, []);
        purchasesByUser.get(user_id).push(movie);
    }

    res.json(users.map(user => ({
        ...user,
        purchases: purchasesByUser.get(user.id) || [],
    })));
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`API de filmes rodando na porta ${port}`));
