# UNIPDS - Engenharia de IA - Aulas

Repositório com os exemplos práticos desenvolvidos ao longo das aulas de Engenharia de IA. Cada aula fica isolada em sua própria pasta.

## Estrutura de pastas

```
.
├── LICENSE
├── README.md
├── exemplo-01/         # Sistema de recomendação de e-commerce (TensorFlow.js)
├── exemplo-01-filmes/  # Sistema de sugestão de filmes (TensorFlow.js + Postgres + Docker)
└── exemplo-02/         # IA jogando Duck Hunt (TensorFlow.js + YOLOv5n)
```

Novas aulas serão adicionadas como pastas irmãs (`exemplo-02/`, `exemplo-03/`, ...), cada uma com seu próprio `README.md`, `package.json` e código-fonte.

## Aulas

- [`exemplo-01/`](./exemplo-01) - Sistema de recomendação de e-commerce com TensorFlow.js
- [`exemplo-01-filmes/`](./exemplo-01-filmes) - Sistema de sugestão de filmes com TensorFlow.js, API Node/Express e PostgreSQL via Docker
- [`exemplo-02/`](./exemplo-02) - IA jogando Duck Hunt: fork do jogo [DuckHunt-JS](https://github.com/MattSurabian/DuckHunt-JS) com um módulo de visão computacional (`machine-learning/`) que roda o modelo YOLOv5n via TensorFlow.js em um Web Worker para detectar os patos na tela e disparar os cliques automaticamente
