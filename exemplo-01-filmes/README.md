# Sistema de Sugestão de Filmes

Evolução do `exemplo-01` (recomendação de e-commerce com TensorFlow.js) aplicada
ao domínio de filmes, agora com um banco de dados PostgreSQL real por trás da
API, tudo orquestrado via Docker Compose.

## Dataset

[The Movies Dataset](https://www.kaggle.com/datasets/rounakbanik/the-movies-dataset)
(Kaggle, rounakbanik). Usamos apenas 3 dos arquivos do pacote:

- `movies_metadata.csv` — catálogo de ~45 mil filmes (título, gêneros, idioma
  original, nota média, popularidade, data de lançamento).
- `ratings_small.csv` — 100.004 avaliações de 671 usuários sobre 9.066 filmes.
- `links_small.csv` — mapeia o `movieId` do MovieLens (usado em `ratings_small`)
  para o `id` do TMDB (usado em `movies_metadata`).

Baixe o dataset e extraia esses arquivos em `data/kaggle/movies/` antes de subir
os containers (essa pasta é ignorada pelo git por causa do tamanho).

## Banco de dados

PostgreSQL 16, rodando em container, com 3 tabelas (`db/init/001_schema.sql`):

- `movies(id, name, category, price, color, popularity, release_year)` —
  equivalente ao antigo `data/products.json`. `category` = gênero principal,
  `price` = nota média (0-10), `color` = idioma original.
- `users(id, name, age)` — `age` é sintética (o MovieLens não tem demografia),
  gerada de forma determinística a partir do id só para preservar a dimensão
  de "afinidade por idade" do modelo original.
- `purchases(user_id, movie_id, rating)` — equivalente às "compras" do
  exemplo-01: avaliações com nota >= 4 (filme curtido).

O script `seed/seed.js` lê os CSVs, cura um catálogo de ~150 filmes mais
avaliados e ~50 usuários mais ativos (para manter o treinamento rápido no
navegador, como no exemplo original) e popula essas tabelas.

## Arquitetura

```
data/kaggle/movies/*.csv  -->  seed (Node)  -->  Postgres  -->  api (Express)  -->  web (nginx / TensorFlow.js no browser)
```

- **db**: Postgres 16.
- **seed**: roda uma vez, popula o banco a partir dos CSVs (idempotente —
  usar `docker compose run --rm seed node seed.js --force` para repopular).
- **api**: Express expõe `GET /api/movies` e `GET /api/users`, no mesmo
  formato dos antigos `products.json`/`users.json`.
- **web**: nginx servindo o front estático (mesma arquitetura MVC do
  exemplo-01: `view/controller/service/events/workers`), que treina o modelo
  de recomendação com TensorFlow.js direto no navegador, num Web Worker.

O front-end e a lógica de ML (pesos, normalização, rede neural) seguem
exatamente a mesma metodologia do `exemplo-01` — só trocamos "produto" por
"filme" e a fonte dos dados (JSON estático -> Postgres via API).

## Como rodar

```bash
docker compose up --build
```

- Front-end: http://localhost:8080
- API: http://localhost:3000/api/movies
- Adminer (inspecionar o banco): http://localhost:8081 (sistema: PostgreSQL,
  servidor: `db`, usuário/senha/banco: `filmes`)

## Estrutura

```
├── docker-compose.yml
├── db/init/001_schema.sql
├── api/            # Express: GET /api/movies, GET /api/users
├── seed/            # popula o Postgres a partir dos CSVs do Kaggle
├── data/kaggle/movies/  # CSVs baixados manualmente (não versionado)
├── index.html, style.css
└── src/
    ├── view/       # MovieView, UserView, ModelTrainingView, TFVisorView
    ├── controller/ # MovieController, UserController, ...
    ├── service/    # MovieService, UserService (chamam a API)
    ├── events/
    └── workers/movieTrainingWorker.js  # treina o modelo no navegador
```
