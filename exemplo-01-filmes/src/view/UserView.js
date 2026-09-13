import { View } from './View.js';

export class UserView extends View {
    #userSelect = document.querySelector('#userSelect');
    #userAge = document.querySelector('#userAge');
    #pastFavoritesList = document.querySelector('#pastFavoritesList');

    #favoriteTemplate;
    #onUserSelect;
    #onFavoriteRemove;
    #pastFavoriteElements = [];

    constructor() {
        super();
        this.init();
    }

    async init() {
        this.#favoriteTemplate = await this.loadTemplate('./src/view/templates/past-favorite.html');
        this.attachUserSelectListener();
    }

    registerUserSelectCallback(callback) {
        this.#onUserSelect = callback;
    }

    registerFavoriteRemoveCallback(callback) {
        this.#onFavoriteRemove = callback;
    }

    renderUserOptions(users) {
        const options = users.map(user => {
            return `<option value="${user.id}">${user.name}</option>`;
        }).join('');

        this.#userSelect.innerHTML += options;
    }

    renderUserDetails(user) {
        this.#userAge.value = user.age;
    }

    renderPastFavorites(pastFavorites) {
        if (!this.#favoriteTemplate) return;

        if (!pastFavorites || pastFavorites.length === 0) {
            this.#pastFavoritesList.innerHTML = '<p>Nenhum filme favoritado ainda.</p>';
            return;
        }

        const html = pastFavorites.map(movie => {
            return this.replaceTemplate(this.#favoriteTemplate, {
                ...movie,
                movie: JSON.stringify(movie)
            });
        }).join('');

        this.#pastFavoritesList.innerHTML = html;
        this.attachFavoriteClickHandlers();
    }

    addPastFavorite(movie) {

        if (this.#pastFavoritesList.innerHTML.includes('Nenhum filme favoritado')) {
            this.#pastFavoritesList.innerHTML = '';
        }

        const favoriteHtml = this.replaceTemplate(this.#favoriteTemplate, {
            ...movie,
            movie: JSON.stringify(movie)
        });

        this.#pastFavoritesList.insertAdjacentHTML('afterbegin', favoriteHtml);

        const newFavorite = this.#pastFavoritesList.firstElementChild.querySelector('.past-favorite');
        newFavorite.classList.add('past-favorite-highlight');

        setTimeout(() => {
            newFavorite.classList.remove('past-favorite-highlight');
        }, 1000);

        this.attachFavoriteClickHandlers();
    }

    attachUserSelectListener() {
        this.#userSelect.addEventListener('change', (event) => {
            const userId = event.target.value ? Number(event.target.value) : null;

            if (userId) {
                if (this.#onUserSelect) {
                    this.#onUserSelect(userId);
                }
            } else {
                this.#userAge.value = '';
                this.#pastFavoritesList.innerHTML = '';
            }
        });
    }

    attachFavoriteClickHandlers() {
        this.#pastFavoriteElements = [];

        const favoriteElements = document.querySelectorAll('.past-favorite');

        favoriteElements.forEach(favoriteElement => {
            this.#pastFavoriteElements.push(favoriteElement);

            favoriteElement.onclick = (event) => {

                const movie = JSON.parse(favoriteElement.dataset.movie);
                const userId = this.getSelectedUserId();
                const element = favoriteElement.closest('.col-md-6');

                this.#onFavoriteRemove({ element, userId, movie });

                element.style.transition = 'opacity 0.5s ease';
                element.style.opacity = '0';

                setTimeout(() => {
                    element.remove();

                    if (document.querySelectorAll('.past-favorite').length === 0) {
                        this.renderPastFavorites([]);
                    }

                }, 500);

            }
        });
    }

    getSelectedUserId() {
        return this.#userSelect.value ? Number(this.#userSelect.value) : null;
    }
}
