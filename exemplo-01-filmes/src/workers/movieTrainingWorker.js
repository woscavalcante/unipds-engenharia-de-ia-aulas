import 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js';
import { workerEvents } from '../events/constants.js';

const MOVIES_API_URL = 'http://localhost:3000/api/movies';

let _globalCtx = {};
let _model = null

const WEIGHTS = {
    category: 0.4, // gênero
    color: 0.3,    // idioma original
    price: 0.2,    // nota média (vote_average)
    age: 0.1,
};


// 🔢 Normalize continuous values (nota, idade) to 0–1 range
// Why? Keeps all features balanced so no one dominates training
// Formula: (val - min) / (max - min)
const normalize = (value, min, max) => (value - min) / ((max - min) || 1)

function makeContext(movies, users) {
    const ages = users.map(u => u.age)
    const prices = movies.map(m => m.price) // nota média (0-10)

    const minAge = Math.min(...ages)
    const maxAge = Math.max(...ages)

    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)

    const colors = [...new Set(movies.map(m => m.color))] // idiomas
    const categories = [...new Set(movies.map(m => m.category))] // gêneros

    const colorsIndex = Object.fromEntries(
        colors.map((color, index) => {
            return [color, index]
        }))
    const categoriesIndex = Object.fromEntries(
        categories.map((category, index) => {
            return [category, index]
        }))

    // Computar a média de idade de quem favoritou cada filme
    // (ajuda a personalizar)
    const midAge = (minAge + maxAge) / 2
    const ageSums = {}
    const ageCounts = {}

    users.forEach(user => {
        user.purchases.forEach(m => {
            ageSums[m.name] = (ageSums[m.name] || 0) + user.age
            ageCounts[m.name] = (ageCounts[m.name] || 0) + 1
        })
    })

    const movieAvgAgeNorm = Object.fromEntries(
        movies.map(movie => {
            const avg = ageCounts[movie.name] ?
                ageSums[movie.name] / ageCounts[movie.name] :
                midAge

            return [movie.name, normalize(avg, minAge, maxAge)]
        })
    )

    return {
        movies,
        users,
        colorsIndex,
        categoriesIndex,
        movieAvgAgeNorm,
        minAge,
        maxAge,
        minPrice,
        maxPrice,
        numCategories: categories.length,
        numColors: colors.length,
        // nota + idade + gêneros + idiomas
        dimentions: 2 + categories.length + colors.length
    }
}

// Vetores construídos com arrays JS puros (sem tensores intermediários).
// Criar um tensor por feature/por item, 7500x no double loop de treino,
// era o gargalo real: milhares de ops de dispatch + tensores nunca
// descartados (leak) deixavam o treino cada vez mais lento.
function encodeMovie(movie, context) {
    const price = normalize(
        movie.price,
        context.minPrice,
        context.maxPrice
    ) * WEIGHTS.price

    const age = (
        context.movieAvgAgeNorm[movie.name] ?? 0.5
    ) * WEIGHTS.age

    const category = new Array(context.numCategories).fill(0)
    category[context.categoriesIndex[movie.category]] = WEIGHTS.category

    const color = new Array(context.numColors).fill(0)
    color[context.colorsIndex[movie.color]] = WEIGHTS.color

    return [price, age, ...category, ...color]
}

function encodeUser(user, context) {
    if (user.purchases.length) {
        const vectors = user.purchases.map(movie => encodeMovie(movie, context))
        const mean = new Array(context.dimentions).fill(0)
        vectors.forEach(vector => {
            vector.forEach((value, i) => { mean[i] += value })
        })
        return mean.map(sum => sum / vectors.length)
    }

    return [
        0, // nota é ignorada,
        normalize(user.age, context.minAge, context.maxAge) * WEIGHTS.age,
        ...new Array(context.numCategories).fill(0), // gênero ignorado,
        ...new Array(context.numColors).fill(0), // idioma ignorado,
    ]
}

function createTrainingData(context) {
    const inputs = []
    const labels = []
    context.users
        .filter(u => u.purchases.length)
        .forEach(user => {
            const userVector = encodeUser(user, context)
            const purchasedNames = new Set(user.purchases.map(m => m.name))

            context.movieVectors.forEach(({ name, vector: movieVector }) => {
                const label = purchasedNames.has(name) ? 1 : 0
                // combinar user + movie
                inputs.push([...userVector, ...movieVector])
                labels.push(label)
            })
        })

    return {
        xs: tf.tensor2d(inputs),
        ys: tf.tensor2d(labels, [labels.length, 1]),
        inputDimention: context.dimentions * 2
        // tamanho = userVector + movieVector
    }
}

// ====================================================================
// 🧠 Configuração e treinamento da rede neural
// ====================================================================
async function configureNeuralNetAndTrain(trainData) {

    const model = tf.sequential()
    model.add(
        tf.layers.dense({
            inputShape: [trainData.inputDimention],
            units: 128,
            activation: 'relu'
        })
    )
    model.add(
        tf.layers.dense({
            units: 64,
            activation: 'relu'
        })
    )
    model.add(
        tf.layers.dense({
            units: 32,
            activation: 'relu'
        })
    )
    model.add(
        tf.layers.dense({ units: 1, activation: 'sigmoid' })
    )

    model.compile({
        optimizer: tf.train.adam(0.01),
        loss: 'binaryCrossentropy',
        metrics: ['accuracy']
    })

    // batchSize maior + menos épocas: no backend 'cpu' (sem WebGL disponível
    // dentro do Worker) cada passo tem overhead fixo alto, então menos passos
    // por época custa bem mais barato que treinar com lotes pequenos. A curva
    // de loss/accuracy já estabiliza por volta da época 20-30 neste dataset.
    await model.fit(trainData.xs, trainData.ys, {
        epochs: 30,
        batchSize: 256,
        shuffle: true,
        callbacks: {
            onEpochEnd: (epoch, logs) => {
                postMessage({
                    type: workerEvents.trainingLog,
                    epoch: epoch,
                    loss: logs.loss,
                    accuracy: logs.acc
                });
            }
        }
    })

    return model
}
async function trainModel({ users }) {
    // Sem WebGL disponível dentro do Worker, força o backend 'cpu' explicitamente
    // em vez de deixar o tf.js tentar (e falhar) a inicialização do WebGL primeiro.
    await tf.setBackend('cpu')
    await tf.ready()

    console.log('Training model with users:', users.length);
    postMessage({ type: workerEvents.progressUpdate, progress: { progress: 1 } });
    const movies = await (await fetch(MOVIES_API_URL)).json()

    const context = makeContext(movies, users)
    context.movieVectors = movies.map(movie => {
        return {
            name: movie.name,
            meta: { ...movie },
            vector: encodeMovie(movie, context)
        }
    })

    _globalCtx = context

    const trainData = createTrainingData(context)
    _model = await configureNeuralNetAndTrain(trainData)

    postMessage({ type: workerEvents.progressUpdate, progress: { progress: 100 } });
    postMessage({ type: workerEvents.trainingComplete });
}
function recommend({ user }) {
    if (!_model) return;
    const context = _globalCtx

    const userVector = encodeUser(user, context)

    // Em aplicações reais:
    //  Armazene todos os vetores de filmes em um banco de dados vetorial (como Postgres com pgvector, Neo4j ou Pinecone)
    //  Consulta: Encontre os 200 filmes mais próximos do vetor do usuário
    //  Execute _model.predict() apenas nesses filmes

    const inputs = context.movieVectors.map(({ vector }) => {
        return [...userVector, ...vector]
    })

    const inputTensor = tf.tensor2d(inputs)

    const predictions = _model.predict(inputTensor)

    const scores = predictions.dataSync()
    inputTensor.dispose()
    predictions.dispose()
    const recommendations = context.movieVectors.map((item, index) => {
        return {
            ...item.meta,
            name: item.name,
            score: scores[index] // previsão do modelo para este filme
        }
    })

    const sortedItems = recommendations
        .sort((a, b) => b.score - a.score)

    postMessage({
        type: workerEvents.recommend,
        user,
        recommendations: sortedItems
    });

}
const handlers = {
    [workerEvents.trainModel]: trainModel,
    [workerEvents.recommend]: recommend,
};

self.onmessage = e => {
    const { action, ...data } = e.data;
    if (handlers[action]) handlers[action](data);
};
