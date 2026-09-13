import { View } from './View.js';

export class ModelView extends View {
    #trainModelBtn = document.querySelector('#trainModelBtn');
    #favoritesArrow = document.querySelector('#favoritesArrow');
    #favoritesDiv = document.querySelector('#favoritesDiv');
    #allUsersFavoritesList = document.querySelector('#allUsersFavoritesList');
    #runRecommendationBtn = document.querySelector('#runRecommendationBtn');
    #onTrainModel;
    #onRunRecommendation;

    constructor() {
        super();
        this.attachEventListeners();
    }

    registerTrainModelCallback(callback) {
        this.#onTrainModel = callback;
    }
    registerRunRecommendationCallback(callback) {
        this.#onRunRecommendation = callback;
    }

    attachEventListeners() {
        this.#trainModelBtn.addEventListener('click', () => {
            this.#onTrainModel();
        });
        this.#runRecommendationBtn.addEventListener('click', () => {
            this.#onRunRecommendation();
        });

        this.#favoritesDiv.addEventListener('click', () => {
            const favoritesList = this.#allUsersFavoritesList;

            const isHidden = window.getComputedStyle(favoritesList).display === 'none';

            if (isHidden) {
                favoritesList.style.display = 'block';
                this.#favoritesArrow.classList.remove('bi-chevron-down');
                this.#favoritesArrow.classList.add('bi-chevron-up');
            } else {
                favoritesList.style.display = 'none';
                this.#favoritesArrow.classList.remove('bi-chevron-up');
                this.#favoritesArrow.classList.add('bi-chevron-down');
            }
        });

    }
    enableRecommendButton() {
        this.#runRecommendationBtn.disabled = false;
    }
    updateTrainingProgress(progress) {
        this.#trainModelBtn.disabled = true;
        this.#trainModelBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Treinando...';

        if (progress.progress === 100) {
            this.#trainModelBtn.disabled = false;
            this.#trainModelBtn.innerHTML = 'Treinar Modelo de Recomendação';
        }
    }

    renderAllUsersFavorites(users) {
        const html = users.map(user => {
            const favoritesHtml = user.purchases.map(favorite => {
                return `<span class="badge bg-light text-dark me-1 mb-1">${favorite.name}</span>`;
            }).join('');

            return `
                <div class="user-purchase-summary">
                    <h6>${user.name} (Idade: ${user.age})</h6>
                    <div class="purchases-badges">
                        ${favoritesHtml || '<span class="text-muted">Nenhum filme favoritado</span>'}
                    </div>
                </div>
            `;
        }).join('');

        this.#allUsersFavoritesList.innerHTML = html;
    }
}
