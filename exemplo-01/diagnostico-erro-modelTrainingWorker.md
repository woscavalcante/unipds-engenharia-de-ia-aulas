# Diagnóstico: `src/workers/modelTrainingWorker.js`

## Erro que trava o parser

```
src/workers/modelTrainingWorker.js:89
SyntaxError: Unexpected token '.'
```

(reproduzido com `node --check src/workers/modelTrainingWorker.js`)

Em `encodeProduct` (linhas 87-99), a sintaxe usada mistura chamada de
função com atribuição dentro de `tf.tensorId({...})`:

```js
const price = tf.tensorId({
    normalize(
        product.price,
        context.minPrice,
        context.maxPrice
    ) = WEIGHTS.price          // ❌ não dá pra atribuir a uma chamada de função
})
```

Isso não é JS válido: `funcao(...) = algo` não existe, e passar isso dentro
de `{ }` sem uma chave (`key:`) também não forma um objeto válido.

## Outros problemas encontrados

1. **`tf.tensorId` não existe** no TensorFlow.js — provavelmente a intenção
   era `tf.scalar(...)` (ou multiplicar o valor normalizado pelo peso e
   usar o número puro, sem tensor).

2. **Linha 97**: `context.productAvgAgeNorm{product.name}` — colchetes
   errados, deveria ser `context.productAvgAgeNorm[product.name]`.

3. **Linhas 109-112 (`color`)**: usa `context.colorsIndex` (com "s"), mas
   `makeContext` só define `context.colorIndex` (sem "s") — vai dar
   `undefined`. Também indexa com `product.category` em vez de
   `product.color`, e usa `WEIGHTS.category`/`numCategories` em vez de
   `WEIGHTS.color`/`numColors`.

4. **Linha 130**: `meta: ...product},` — spread (`...product`) não pode
   ser valor de uma propriedade assim; e sobra uma chave `}` solta ali no
   meio.

5. **Bug de lógica em `makeContext` (linhas 30-38)**: `colorIndex` e
   `categoriesIndex` são criados com `Object.entries(colors.map(...))`,
   mas `colors.map(...)` já devolve um array de pares `[cor, índice]`.
   Envolver isso em `Object.entries` reindexa pela posição do array, e não
   pelo nome da cor/categoria — então `context.categoriesIndex[product.category]`
   nunca vai funcionar como lookup. O certo seria:

   ```js
   Object.fromEntries(colors.map((color, index) => [color, index]))
   ```

## Como reproduzir a verificação

```bash
cd exemplo-01
node --check src/workers/modelTrainingWorker.js
```
