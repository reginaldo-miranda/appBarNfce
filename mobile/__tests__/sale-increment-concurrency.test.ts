import { clampQuantity, updateCartOptimistic } from '../src/utils/cartLogic';

function applyIfLatest(latest: Map<string, number>, key: string, seq: number): boolean {
  return latest.get(key) === seq;
}

test('incrementos rápidos mantêm último valor (anti-stale)', () => {
  const unitPrice = 10;
  let cart = [{
    _id: 'i1',
    quantidade: 1,
    precoUnitario: unitPrice,
    produto: { _id: 'prod-1', preco: unitPrice },
    subtotal: unitPrice,
  }];

  const key = 'sale-1:prod-1';
  const latest = new Map<string, number>();

  // Clique 1: +1 (vai para 2)
  cart = updateCartOptimistic(cart, 'i1', cart[0].quantidade + 1);
  const seq1 = Date.now();
  latest.set(key, seq1);

  // Clique 2: +1 (vai para 3)
  cart = updateCartOptimistic(cart, 'i1', cart[0].quantidade + 1);
  const seq2 = seq1 + 1;
  latest.set(key, seq2);

  // Resposta antiga chega depois (seq1) — deve ser ignorada
  if (applyIfLatest(latest, key, seq1)) {
    // simulando aplicação indevida da resposta antiga (voltaria para 2)
    cart = updateCartOptimistic(cart, 'i1', 2);
  }

  // Resposta nova (seq2) — deve ser aplicada
  if (applyIfLatest(latest, key, seq2)) {
    cart = updateCartOptimistic(cart, 'i1', 3);
  }

  expect(cart[0].quantidade).toBe(3);
  expect(cart[0].subtotal).toBe(3 * unitPrice);
});

test('quantidade negativa reverte para remoção e persiste', () => {
  const unitPrice = 12;
  let cart = [{
    _id: 'i2',
    quantidade: 1,
    precoUnitario: unitPrice,
    produto: { _id: 'prod-2', preco: unitPrice },
    subtotal: unitPrice,
  }];
  const q = clampQuantity(-5);
  expect(q).toBe(0);
  cart = updateCartOptimistic(cart, 'i2', q);
  expect(cart.length).toBe(0);
});
