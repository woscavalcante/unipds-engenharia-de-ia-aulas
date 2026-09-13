-- Catálogo de filmes (equivalente a data/products.json do exemplo-01)
CREATE TABLE IF NOT EXISTS movies (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,        -- gênero principal (ex: Comédia)
    price NUMERIC NOT NULL,        -- nota média (vote_average, 0-10)
    color TEXT NOT NULL,           -- idioma original (ex: en, fr, ja)
    popularity NUMERIC,
    release_year INTEGER
);

-- Usuários (equivalente a data/users.json). Idade é sintética: o MovieLens
-- não traz dados demográficos, então geramos uma idade determinística por id
-- só para preservar a dimensão "afinidade por idade" do modelo original.
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    age INTEGER NOT NULL
);

-- "Compras" do exemplo-01 = avaliações com rating >= 4 (filme curtido)
CREATE TABLE IF NOT EXISTS purchases (
    user_id INTEGER NOT NULL REFERENCES users(id),
    movie_id INTEGER NOT NULL REFERENCES movies(id),
    rating NUMERIC NOT NULL,
    PRIMARY KEY (user_id, movie_id)
);
