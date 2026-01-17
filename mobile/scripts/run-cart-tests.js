// Pequeno runner de testes para lógica de carrinho
const { updateCartOptimistic, clampQuantity } = require('../src/utils/cartLogic');

function assert(cond, name) {
  if (!cond) {
    console.error(`❌ FAIL: ${name}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ PASS: ${name}`);
  }
}

function makeItem(id, qty, price) {
  return {
    _id: id,
    quantidade: qty,
    precoUnitario: price,
    produto: { _id: `prod-${id}`, preco: price },
    subtotal: price * qty,
  };
}

function run() {
  const price = 10;
  let cart = [makeItem('i1', 1, price)];

  // Incremento com múltiplos cliques
  cart = updateCartOptimistic(cart, 'i1', cart[0].quantidade + 1);
  cart = updateCartOptimistic(cart, 'i1', cart[0].quantidade + 1);
  assert(cart[0].quantidade === 3, 'Incremento múltiplo (+) acumula corretamente');
  assert(cart[0].subtotal === 3 * price, 'Subtotal acompanha quantidade após incrementos');

  // Decremento até zero remove item
  cart = updateCartOptimistic(cart, 'i1', cart[0].quantidade - 1);
  cart = updateCartOptimistic(cart, 'i1', cart[0].quantidade - 1);
  cart = updateCartOptimistic(cart, 'i1', cart[0]?.quantidade - 1 || 0);
  assert(cart.length === 0, 'Decremento até zero remove o produto');

  // Valores extremos
  cart = [makeItem('i2', 1, price)];
  cart = updateCartOptimistic(cart, 'i2', 1000);
  assert(cart[0].quantidade === 1000, 'Quantidade extrema alta é aplicada');
  assert(cart[0].subtotal === 1000 * price, 'Subtotal com quantidade extrema é correto');

  // Negativos e não numéricos
  cart = updateCartOptimistic(cart, 'i2', -5);
  assert(cart.length === 0, 'Quantidade negativa resulta em remoção (clamped to 0)');
  const q = clampQuantity('3.7');
  assert(q === 3, 'Clamp converte string numérica para inteiro e limita corretamente');

  console.log('\nTodos os testes básicos de lógica de carrinho executados.');
}

run();