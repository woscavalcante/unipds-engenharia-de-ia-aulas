import { View } from './View.js';

export class MovieView extends View {
    // DOM elements
    #movieList = document.querySelector('#movieList');

    #buttons;
    // Templates and callbacks
    #movieTemplate;
    #onFavoriteMovie;

    constructor() {
        super();
        this.init();
    }

    async init() {
        this.#movieTemplate = await this.loadTemplate('./src/view/templates/movie-card.html');
    }

    onUserSelected(user) {
        // Habilita os botões se um usuário estiver selecionado
        this.setButtonsState(user.id ? false : true);
    }

    registerFavoriteMovieCallback(callback) {
        this.#onFavoriteMovie = callback;
    }

    render(movies, disableButtons = true) {
        if (!this.#movieTemplate) return;
        const html = movies.map(movie => {
            return this.replaceTemplate(this.#movieTemplate, {
                id: movie.id,
                name: movie.name,
                category: movie.category,
                price: movie.price,
                color: movie.color,
                movie: JSON.stringify(movie)
            });
        }).join('');

        this.#movieList.innerHTML = html;
        this.attachFavoriteButtonListeners();

        this.setButtonsState(disableButtons);
    }

    setButtonsState(disabled) {
        if (!this.#buttons) {
            this.#buttons = document.querySelectorAll('.favorite-btn');
        }
        this.#buttons.forEach(button => {
            button.disabled = disabled;
        });
    }

    attachFavoriteButtonListeners() {
        this.#buttons = document.querySelectorAll('.favorite-btn');
        this.#buttons.forEach(button => {

            button.addEventListener('click', (event) => {
                const movie = JSON.parse(button.dataset.movie);
                const originalText = button.innerHTML;

                button.innerHTML = '<i class="bi bi-check-circle-fill"></i> Favoritado';
                button.classList.remove('btn-primary');
                button.classList.add('btn-success');
                setTimeout(() => {
                    button.innerHTML = originalText;
                    button.classList.remove('btn-success');
                    button.classList.add('btn-primary');
                }, 500);
                this.#onFavoriteMovie(movie, button);

            });
        });
    }
}
