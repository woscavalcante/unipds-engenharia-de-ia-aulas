import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { parse } from 'csv-parse/sync';

const DATA_DIR = process.env.DATA_DIR || '/data';
const MOVIE_LIMIT = Number(process.env.MOVIE_LIMIT || 150);
const USER_LIMIT = Number(process.env.USER_LIMIT || 50);
const MIN_LIKED = Number(process.env.MIN_LIKED || 3);
const MAX_LIKED = Number(process.env.MAX_LIKED || 20);
const LIKED_THRESHOLD = 4; // rating >= 4 == "comprou" (curtiu o filme)
const FORCE = process.argv.includes('--force') || process.env.SEED_FORCE === 'true';

function readCsv(fileName) {
    const filePath = path.join(DATA_DIR, fileName);
    const raw = fs.readFileSync(filePath, 'utf-8');
    return parse(raw, {
        columns: true,
        skip_records_with_error: true,
        relax_column_count: true,
    });
}

// Idade sintética determinística: o MovieLens não traz demografia, então
// geramos um número estável por userId só para preservar a dimensão de
// "afinidade por idade" que o worker original usa.
function syntheticAge(userId) {
    const hash = Math.abs((userId * 2654435761) % 2147483647);
    return 18 + (hash % 48); // 18..65
}

export function extractPrimaryGenre(genresRaw) {
    const match = /'name':\s*'([^']+)'/.exec(genresRaw || '');
    return match ? match[1] : 'Sem Gênero';
}

export function loadMovies() {
    console.log('Lendo movies_metadata.csv...');
    const rows = readCsv('movies_metadata.csv');
    const moviesById = new Map();

    for (const row of rows) {
        const id = parseInt(row.id, 10);
        const name = row.title || row.original_title;
        if (Number.isNaN(id) || !name) continue; // linhas corrompidas do dataset

        moviesById.set(id, {
            id,
            name,
            category: extractPrimaryGenre(row.genres),
            price: parseFloat(row.vote_average) || 0,
            color: row.original_language || 'en',
            popularity: parseFloat(row.popularity) || 0,
            release_year: row.release_date ? parseInt(row.release_date.slice(0, 4), 10) || null : null,
        });
    }

    console.log(`  -> ${moviesById.size} filmes válidos carregados`);
    return moviesById;
}

export function loadLinks() {
    console.log('Lendo links_small.csv...');
    const rows = readCsv('links_small.csv');
    const tmdbIdByMovieLensId = new Map();

    for (const row of rows) {
        const movieLensId = parseInt(row.movieId, 10);
        const tmdbId = parseInt(row.tmdbId, 10);
        if (Number.isNaN(movieLensId) || Number.isNaN(tmdbId)) continue;
        tmdbIdByMovieLensId.set(movieLensId, tmdbId);
    }

    return tmdbIdByMovieLensId;
}

export function loadRatings(tmdbIdByMovieLensId, moviesById) {
    console.log('Lendo ratings_small.csv...');
    const rows = readCsv('ratings_small.csv');
    const ratings = [];

    for (const row of rows) {
        const movieLensId = parseInt(row.movieId, 10);
        const userId = parseInt(row.userId, 10);
        const rating = parseFloat(row.rating);
        const tmdbId = tmdbIdByMovieLensId.get(movieLensId);

        if (!tmdbId || !moviesById.has(tmdbId) || Number.isNaN(rating)) continue;

        ratings.push({ userId, movieId: tmdbId, rating });
    }

    console.log(`  -> ${ratings.length} avaliações mapeadas para filmes conhecidos`);
    return ratings;
}

export function curateMovies(ratings, moviesById) {
    const countByMovie = new Map();
    for (const r of ratings) {
        countByMovie.set(r.movieId, (countByMovie.get(r.movieId) || 0) + 1);
    }

    const curatedIds = [...countByMovie.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, MOVIE_LIMIT)
        .map(([id]) => id);

    return new Map(curatedIds.map(id => [id, moviesById.get(id)]));
}

export function curateUsers(ratings, curatedMovies) {
    const likedByUser = new Map();

    for (const r of ratings) {
        if (!curatedMovies.has(r.movieId) || r.rating < LIKED_THRESHOLD) continue;

        if (!likedByUser.has(r.userId)) likedByUser.set(r.userId, []);
        likedByUser.get(r.userId).push({ movieId: r.movieId, rating: r.rating });
    }

    // Fica só na faixa [MIN_LIKED, MAX_LIKED]: descarta usuários com poucos dados
    // (não dá pra aprender nada) e os "super avaliadores" que curtiram quase todo
    // o catálogo (deixariam o treino desbalanceado, quase tudo rótulo positivo).
    const curatedUserIds = [...likedByUser.entries()]
        .filter(([, liked]) => liked.length >= MIN_LIKED && liked.length <= MAX_LIKED)
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, USER_LIMIT)
        .map(([userId]) => userId);

    const purchasesByUser = new Map(
        curatedUserIds.map(userId => [userId, likedByUser.get(userId)])
    );

    return { curatedUserIds, purchasesByUser };
}

async function seed() {
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();

    try {
        const { rows: [{ count }] } = await client.query('SELECT COUNT(*)::int FROM movies');
        if (count > 0 && !FORCE) {
            console.log(`Banco já populado (${count} filmes). Use --force para recriar. Encerrando.`);
            return;
        }

        const moviesById = loadMovies();
        const links = loadLinks();
        const ratings = loadRatings(links, moviesById);
        const curatedMovies = curateMovies(ratings, moviesById);
        const { curatedUserIds, purchasesByUser } = curateUsers(ratings, curatedMovies);

        console.log(`Catálogo curado: ${curatedMovies.size} filmes, ${curatedUserIds.length} usuários`);

        await client.query('BEGIN');
        await client.query('DELETE FROM purchases');
        await client.query('DELETE FROM movies');
        await client.query('DELETE FROM users');

        for (const movie of curatedMovies.values()) {
            await client.query(
                `INSERT INTO movies (id, name, category, price, color, popularity, release_year)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [movie.id, movie.name, movie.category, movie.price, movie.color, movie.popularity, movie.release_year]
            );
        }

        for (const userId of curatedUserIds) {
            await client.query(
                `INSERT INTO users (id, name, age) VALUES ($1, $2, $3)`,
                [userId, `Usuário ${userId}`, syntheticAge(userId)]
            );

            for (const { movieId, rating } of purchasesByUser.get(userId)) {
                await client.query(
                    `INSERT INTO purchases (user_id, movie_id, rating) VALUES ($1, $2, $3)
                     ON CONFLICT DO NOTHING`,
                    [userId, movieId, rating]
                );
            }
        }

        await client.query('COMMIT');
        console.log('Seed concluído com sucesso.');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        await client.end();
    }
}

const isMainModule = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
    seed().catch(err => {
        console.error('Falha ao popular o banco:', err);
        process.exit(1);
    });
}
