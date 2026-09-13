import { View } from './View.js';

export class TFVisorView extends View {
    #weights = null;
    #catalog = [];
    #users = [];
    #logs = [];
    #lossPoints = [];
    #accPoints = [];
    constructor() {
        super();

        tfvis.visor().open();
        this.reserveSpaceForVisor();
    }

    // O painel do tfjs-vis é fixed/right e não empurra o layout: ao "Hide"
    // ele só desliza pra fora da tela (mesma largura, right negativo), então
    // observamos a interseção com o viewport pra saber se está visível.
    reserveSpaceForVisor() {
        const visorEl = document.querySelector('.visor');
        if (!visorEl) return;

        const observer = new IntersectionObserver(([entry]) => {
            document.body.style.setProperty(
                '--visor-width',
                entry.isIntersecting ? `${Math.round(entry.boundingClientRect.width)}px` : '0px'
            );
        }, { threshold: 0 });

        observer.observe(visorEl);
    }

    renderData(data) {

        this.#weights = data.weights;
        this.#catalog = data.catalog;
        this.#users = data.users;
    }
    resetDashboard() {
        this.#weights = null;
        this.#catalog = [];
        this.#users = [];
        this.#logs = [];
        this.#lossPoints = [];
        this.#accPoints = [];
    }

    handleTrainingLog(log) {
        const { epoch, loss, accuracy } = log;
        this.#lossPoints.push({ x: epoch, y: loss });
        this.#accPoints.push({ x: epoch, y: accuracy });
        this.#logs.push(log);

        tfvis.render.linechart(
            {
                name: 'Precisão do Modelo',
                tab: 'Treinamento',
                style: { display: 'inline-block', width: '49%' }
            },
            { values: this.#accPoints, series: ['precisão'] },
            {
                xLabel: 'Época (Ciclos de Treinamento)',
                yLabel: 'Precisão (%)',
                height: 300
            }
        );

        tfvis.render.linechart(
            {
                name: 'Erro de Treinamento',
                tab: 'Treinamento',
                style: { display: 'inline-block', width: '49%' }
            },
            { values: this.#lossPoints, series: ['erros'] },
            {
                xLabel: 'Época (Ciclos de Treinamento)',
                yLabel: 'Valor do Erro',
                height: 300
            }
        );

    }




}
