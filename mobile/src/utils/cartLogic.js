// Utilidades de carrinho para testes unitários simples

function clampQuantity(q) {
  const n = Math.floor(Number(q) || 0);
  return Math.max(0, n);
}

function updateCartOptimistic(cart, itemId, newQty) {
  const qty = clampQuantity(newQty);
  const next = Array.isArray(cart) ? [...cart] : [];
  const idx = next.findIndex((it) => it._id === itemId);
  if (idx < 0) return next;
  if (qty <= 0) {
    next.splice(idx, 1);
    return next;
  }
  const it = next[idx];
  const unitPrice = (it.precoUnitario ?? (it.produto?.preco ?? 0)) || 0;
  next[idx] = {
    ...it,
    quantidade: qty,
    subtotal: unitPrice * qty,
  };
  return next;
}

module.exports = { clampQuantity, updateCartOptimistic };