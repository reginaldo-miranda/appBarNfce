import express from 'express';

import { getActivePrisma } from '../lib/prisma.js';
import { enqueuePrintJob, buildPrintContent } from '../lib/print.js';
import { queueWhatsAppMessage, formatWhatsappMessage } from '../lib/whatsapp.js';
import { recordSaleUpdate } from '../lib/events.js';

const router = express.Router();

// Criar nova venda
router.post('/create', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const { funcionario, cliente, entregador, mesa, tipoVenda, nomeComanda, valorTotal, observacoes } = req.body;

    // Verificar se funcionário foi informado
    if (funcionario === undefined || funcionario === null || String(funcionario).trim() === '') {
      return res.status(400).json({ error: 'Funcionário é obrigatório' });
    }

    // Resolver funcionarioId (suporta 'admin-fixo' ou ID numérico)
    let funcionarioId = null;
    if (typeof funcionario === 'string' && funcionario === 'admin-fixo') {
      let admin = await prisma.employee.findFirst({ where: { nome: 'Administrador' } });
      if (!admin) {
        admin = await prisma.employee.create({
          data: {
            nome: 'Administrador',
            telefone: '(00) 00000-0000',
            cargo: 'Gerente',
            salario: 0,
            ativo: true,
            dataAdmissao: new Date(),
          },
        });
      }
      funcionarioId = admin.id;
    } else {
      const funcionarioNum = Number(funcionario);
      if (!Number.isFinite(funcionarioNum) || !Number.isInteger(funcionarioNum) || funcionarioNum <= 0) {
        return res.status(400).json({ error: 'Funcionário inválido' });
      }
      const func = await prisma.employee.findUnique({ where: { id: funcionarioNum } });
      if (!func) {
        return res.status(400).json({ error: 'Funcionário não encontrado' });
      }
      funcionarioId = func.id;
    }

    // Validar cliente (opcional)
    let clienteId = null;
    if (cliente !== undefined && cliente !== null && !(typeof cliente === 'string' && cliente.trim() === '')) {
      const clienteNum = Number(cliente);
      if (!Number.isFinite(clienteNum) || !Number.isInteger(clienteNum) || clienteNum <= 0) {
        return res.status(400).json({ error: 'Cliente inválido' });
      }
      const cli = await prisma.customer.findUnique({ where: { id: clienteNum } });
      if (!cli) {
        return res.status(400).json({ error: 'Cliente não encontrado' });
      }
      clienteId = cli.id;
    }

    // Validar entregador
    let entregadorId = null;
    if (entregador !== undefined && entregador !== null && !(typeof entregador === 'string' && entregador.trim() === '')) {
      const entNum = Number(entregador);
      if (Number.isFinite(entNum) && entNum > 0) {
         entregadorId = entNum;
      }
    }

    // Validar mesa se tipo for mesa
    let mesaId = null;
    const tipoFinal = tipoVenda ? String(tipoVenda) : 'balcao';
    if (tipoFinal === 'mesa' && mesa !== undefined && mesa !== null) {
      const mesaNum = Number(mesa);
      if (!Number.isFinite(mesaNum) || !Number.isInteger(mesaNum) || mesaNum <= 0) {
        return res.status(400).json({ error: 'Mesa inválida' });
      }
      const mesaReg = await prisma.mesa.findUnique({
        where: { id: mesaNum },
        include: { vendaAtual: true },
      });
      if (!mesaReg) {
        return res.status(400).json({ error: 'Mesa não encontrada' });
      }
      // Verificar se a mesa já tem uma venda ativa
      if (mesaReg.status === 'ocupada' && mesaReg.vendaAtualId) {
        const vendaAtual = await prisma.sale.findUnique({ where: { id: mesaReg.vendaAtualId } });
        if (vendaAtual && vendaAtual.status === 'aberta') {
          return res.status(400).json({ error: 'Mesa já possui uma venda em aberto' });
        }
      }
      mesaId = mesaReg.id;
    }

    // Montar dados e criar venda com Prisma
    const venda = await prisma.sale.create({
      data: {
        status: 'aberta',
        tipoVenda: tipoFinal,
        funcionarioId: funcionarioId ?? null,
        clienteId: clienteId ?? null,
        entregadorId: entregadorId ?? null,
        mesaId: mesaId ?? null,
        nomeComanda: typeof nomeComanda === 'string' && nomeComanda.trim() !== '' ? nomeComanda.trim() : null,
        subtotal: 0,
        desconto: 0,
        total: Number(valorTotal || 0),
        formaPagamento: 'dinheiro',
        observacoes: typeof observacoes === 'string' && observacoes.trim() !== '' ? observacoes.trim() : null,
        dataVenda: new Date(),
      },
      include: {
        funcionario: { select: { nome: true } },
        entregador: { select: { nome: true } },
        cliente: { select: { nome: true } },
        mesa: { include: { funcionarioResponsavel: { select: { nome: true } } } },
        itens: { include: { product: { select: { nome: true, precoVenda: true } } } },
      },
    });

    // Se for venda de mesa, atualizar status e vendaAtual
    if (tipoFinal === 'mesa' && venda.mesaId) {
      await prisma.mesa.update({
        where: { id: venda.mesaId },
        data: {
          status: 'ocupada',
          vendaAtualId: venda.id,
          horaAbertura: new Date(),
        },
      });
    }

    res.status(201).json(mapSaleResponse(normalizeSale(venda)));
    try { recordSaleUpdate(venda.id); } catch {}
  } catch (error) {
    console.error('Erro ao criar venda:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Helper para normalizar tipos numéricos em vendas e itens
const toNum = (v) => Number(v);
const normalizeSale = (venda) => {
  if (!venda) return venda;
  const itensNorm = Array.isArray(venda.itens)
    ? venda.itens.map((item) => ({
        ...item,
        precoUnitario: toNum(item.precoUnitario),
        subtotal: toNum(item.subtotal),
        product: item.product
          ? { ...item.product, precoVenda: toNum(item.product.precoVenda) }
          : item.product,
      }))
    : venda.itens;
  return {
    ...venda,
    subtotal: toNum(venda.subtotal),
    desconto: toNum(venda.desconto),
    total: toNum(venda.total),
    itens: itensNorm,
    caixaVendas: Array.isArray(venda.caixaVendas)
      ? venda.caixaVendas.map(cv => ({ ...cv, valor: toNum(cv.valor) }))
      : venda.caixaVendas,
  };
};
const normalizeSales = (arr) => (Array.isArray(arr) ? arr.map(normalizeSale) : arr);

// Compatibilidade: alias _id e renomear product -> produto nas respostas
const mapSaleResponse = (venda) => {
  if (!venda) return venda;
  const base = { ...venda, _id: String(venda.id), id: venda.id };
  // Mapear itens e produto
    const itens = Array.isArray(venda.itens)
    ? venda.itens.map((item) => {
        const { product, ...restItem } = item;
        const produto = product
          ? {
              _id: String(product.id),
              id: product.id,
              nome: product.nome,
              preco: Number(product.precoVenda),
            }
          : undefined;
        return {
          ...restItem,
          _id: String(item.id),
          id: item.id,
          produto,
          nomeProduto: restItem.nomeProduto || (produto ? produto.nome : restItem.nomeProduto),
          precoUnitario: Number(restItem.precoUnitario),
          subtotal: Number(restItem.subtotal),
          origem: String(restItem.origem || 'default'),
          variacao: restItem.variacaoTipo
            ? {
                tipo: restItem.variacaoTipo,
                regraPreco: restItem.variacaoRegraPreco,
                opcoes: Array.isArray(restItem.variacaoOpcoes) ? restItem.variacaoOpcoes : []
              }
            : undefined,
        };
      })
    : venda.itens;
  base.itens = itens;
  // Mapear mesa
  if (venda.mesa) {
    const fr = venda.mesa.funcionarioResponsavel
      ? {
          _id: String(venda.mesa.funcionarioResponsavel.id),
          id: venda.mesa.funcionarioResponsavel.id,
          nome: venda.mesa.funcionarioResponsavel.nome,
        }
      : undefined;
    base.mesa = { ...venda.mesa, _id: String(venda.mesa.id), id: venda.mesa.id, funcionarioResponsavel: fr };
  }
  // Mapear funcionario e cliente
  if (venda.funcionario) {
    base.funcionario = { _id: String(venda.funcionario.id), id: venda.funcionario.id, nome: venda.funcionario.nome };
  }
  if (venda.entregador) {
    base.entregador = { _id: String(venda.entregador.id), id: venda.entregador.id, nome: venda.entregador.nome };
  }
  if (venda.cliente) {
    base.cliente = { _id: String(venda.cliente.id), id: venda.cliente.id, nome: venda.cliente.nome };
  }
  if (venda.caixaVendas) {
    base.caixaVendas = venda.caixaVendas.map(cv => ({
      ...cv,
      valor: Number(cv.valor)
    }));
    base.totalPago = base.caixaVendas.reduce((acc, cv) => acc + cv.valor, 0);
  }
  return base;
};
const mapSales = (arr) => (Array.isArray(arr) ? arr.map(mapSaleResponse) : arr);

// Atualizar dados gerais da venda (cliente, entregador, delivery, etc)
router.put('/:id/update', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const { id } = req.params;
    const { clienteId, entregadorId, funcionarioId, isDelivery, deliveryAddress, deliveryDistance, deliveryFee, status } = req.body;
    
    // Validar ID
    const saleId = Number(id);
    if (!saleId) return res.status(400).json({ error: 'ID inválido' });

    // BUSCAR VENDA ATUAL PARA RECALCULAR TOTAL
    const currentSale = await prisma.sale.findUnique({ where: { id: saleId } });
    if (!currentSale) return res.status(404).json({ error: 'Venda não encontrada' });

    // Preparar dados para update
    const data = {};
    if (clienteId !== undefined) data.clienteId = clienteId ? Number(clienteId) : null;
    if (entregadorId !== undefined) data.entregadorId = entregadorId ? Number(entregadorId) : null;
    if (funcionarioId !== undefined) data.funcionarioId = funcionarioId ? Number(funcionarioId) : null;
    
    if (isDelivery !== undefined) data.isDelivery = Boolean(isDelivery);
    if (deliveryAddress !== undefined) data.deliveryAddress = String(deliveryAddress);
    if (deliveryDistance !== undefined) data.deliveryDistance = Number(deliveryDistance);
    
    let newDeliveryFee = currentSale.deliveryFee;
    if (deliveryFee !== undefined) {
        newDeliveryFee = Number(deliveryFee);
        data.deliveryFee = newDeliveryFee;
    }
    
    if (status) data.status = status;

    // Recalcular Total: Subtotal + Taxa Entrega - Desconto
    const subtotal = Number(currentSale.subtotal || 0);
    const desconto = Number(currentSale.desconto || 0);
    const taxa = Number(newDeliveryFee || 0);
    data.total = subtotal + taxa - desconto;

    const updated = await prisma.sale.update({
      where: { id: saleId },
      data,
      include: {
        funcionario: { select: { nome: true } },
        entregador: { select: { nome: true } },
        cliente: { select: { nome: true } },
        mesa: { include: { funcionarioResponsavel: { select: { nome: true } } } },
        itens: { include: { product: { select: { nome: true, precoVenda: true } } } },
      }
    });

    res.json(mapSaleResponse(normalizeSale(updated)));
  } catch (error) {
    console.error('Erro ao atualizar venda:', error);
    res.status(500).json({ error: 'Erro ao atualizar venda' });
  }
});

// Listar vendas abertas (Prisma)
router.get('/open', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const vendasAbertas = await prisma.sale.findMany({
      where: { status: 'aberta' },
      include: {
        funcionario: { select: { nome: true } },
        entregador: { select: { nome: true } },
        cliente: { select: { nome: true } },
        mesa: { include: { funcionarioResponsavel: { select: { nome: true } } } },
        itens: { include: { product: { select: { nome: true, precoVenda: true } } } },
      },
      orderBy: { dataVenda: 'desc' },
    });
    res.json(mapSales(normalizeSales(vendasAbertas)));
  } catch (error) {
    console.error('Erro ao buscar vendas abertas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Versão mínima e rápida das vendas abertas com totais agregados
router.get('/open-min', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const vendas = await prisma.sale.findMany({
      where: { status: 'aberta' },
      select: {
        id: true,
        status: true,
        tipoVenda: true,
        nomeComanda: true,
        funcionario: { select: { nome: true } },
        entregador: { select: { nome: true } },
        cliente: { select: { nome: true } },
        desconto: true,
        itens: { select: { quantidade: true, precoUnitario: true, subtotal: true } },
      },
      orderBy: { dataVenda: 'desc' },
      take: 100,
    });
    // agregar total e itensCount
    const results = vendas.map(v => {
      const itens = Array.isArray(v.itens) ? v.itens : [];
      const subtotal = itens.reduce((acc, it) => acc + Number(it.subtotal ?? (Number(it.quantidade) * Number(it.precoUnitario))), 0);
      const descontoNum = Number(v.desconto || 0);
      const total = Math.max(0, subtotal - descontoNum);
      return {
        _id: String(v.id),
        id: v.id,
        status: v.status,
        tipoVenda: v.tipoVenda,
        nomeComanda: v.nomeComanda,
        funcionario: v.funcionario ? { nome: v.funcionario.nome } : null,
        cliente: v.cliente ? { nome: v.cliente.nome } : null,
        itensCount: itens.length,
        total,
      };
    });
    res.json(results);
  } catch (error) {
    console.error('Erro ao buscar vendas abertas (min):', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Listar todas as vendas (com filtros opcionais) - Prisma
router.get('/list', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const { status, funcionario, cliente, dataInicio, dataFim, isDelivery } = req.query;
    const where = {};

    if (status) where.status = String(status);
    if (funcionario) where.funcionarioId = Number(funcionario);
    if (cliente) where.clienteId = Number(cliente);
    if (isDelivery !== undefined) where.isDelivery = isDelivery === 'true';

    if (dataInicio || dataFim) {
      where.dataVenda = {};
      if (dataInicio) where.dataVenda.gte = new Date(String(dataInicio));
      if (dataFim) where.dataVenda.lte = new Date(String(dataFim));
    }

    const vendas = await prisma.sale.findMany({
      where,
      include: {
        funcionario: { select: { nome: true } },
        entregador: { select: { nome: true } },
        cliente: { select: { nome: true } },
        mesa: { include: { funcionarioResponsavel: { select: { nome: true } } } },
        itens: { include: { product: { select: { nome: true, precoVenda: true } } } },
        caixaVendas: true,
      },
      orderBy: { dataVenda: 'desc' },
      take: 100,
    });

    res.json(mapSales(normalizeSales(vendas)));
  } catch (error) {
    console.error('Erro ao buscar vendas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Buscar vendas finalizadas por período (Prisma)
router.get('/finalizadas', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const { dataInicio, dataFim } = req.query;

    const where = { status: 'finalizada' };
    if (dataInicio || dataFim) {
      where.dataVenda = {};
      if (dataInicio) where.dataVenda.gte = new Date(String(dataInicio) + 'T00:00:00-03:00');
      if (dataFim) where.dataVenda.lte = new Date(String(dataFim) + 'T23:59:59-03:00');
    }

    const vendas = await prisma.sale.findMany({
      where,
      include: {
        funcionario: { select: { nome: true } },
        entregador: { select: { nome: true } },
        cliente: { select: { nome: true } },
        mesa: { select: { numero: true, nome: true } },
      },
      orderBy: { dataVenda: 'desc' },
    });

    res.json(mapSales(normalizeSales(vendas)));
  } catch (error) {
    console.error('Erro ao buscar vendas finalizadas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Buscar vendas por mesa (Prisma)
router.get('/mesa/:mesaId', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const mesaId = Number(req.params.mesaId);
    if (!Number.isInteger(mesaId) || mesaId <= 0) {
      return res.status(400).json({ error: 'Mesa inválida' });
    }

    const vendas = await prisma.sale.findMany({
      where: { mesaId },
      include: {
        funcionario: { select: { nome: true } },
        entregador: { select: { nome: true } },
        cliente: { select: { nome: true } },
        mesa: { select: { numero: true, nome: true } },
        itens: { include: { product: { select: { nome: true, precoVenda: true } } } },
        caixaVendas: true,
      },
      orderBy: { dataVenda: 'desc' },
    });

    res.json(mapSales(normalizeSales(vendas)));
  } catch (error) {
    console.error('Erro ao buscar vendas da mesa:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Buscar venda por ID (Prisma)
router.get('/:id', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const venda = await prisma.sale.findUnique({
      where: { id },
      include: {
        funcionario: { select: { nome: true } },
        entregador: { select: { nome: true } },
        cliente: { select: { nome: true } },
        mesa: { select: { numero: true, nome: true } },
        itens: { include: { product: { select: { nome: true, precoVenda: true } } } },
        caixaVendas: true,
      },
    });

    if (!venda) {
      return res.status(404).json({ error: 'Venda não encontrada' });
    }

    res.json(mapSaleResponse(normalizeSale(venda)));
  } catch (error) {
    console.error('Erro ao buscar venda:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Adicionar item à venda (Prisma)
  router.post('/:id/item', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const id = Number(req.params.id);
    const { produtoId, quantidade } = req.body;
    const variacao = req.body?.variacao || null;
    const origemRaw = (req.body?.origem || req.headers['x-client-mode'] || '').toString().toLowerCase();
    const origem = origemRaw === 'tablet' ? 'tablet' : 'default';
    console.log('[SALE] POST /:id/item', { id, produtoId, quantidade });

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Venda inválida' });
    }
    const venda = await prisma.sale.findUnique({ where: { id }, include: { itens: true } });
    if (!venda) {
      return res.status(404).json({ error: 'Venda não encontrada' });
    }
    if (venda.status !== 'aberta') {
      console.warn('[SALE] addItem rejeitado: venda não está aberta', { id, status: venda.status });
      return res.status(400).json({ error: 'Não é possível adicionar itens a uma venda finalizada' });
    }

    const prodId = Number(produtoId);
    if (!Number.isInteger(prodId) || prodId <= 0) {
      return res.status(400).json({ error: 'Produto inválido' });
    }
    const produto = await prisma.product.findUnique({ 
      where: { id: prodId },
      include: { tamanhos: true } 
    });
    if (!produto) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    // Lógica para tamanho (Size)
    const tamanhoName = req.body?.tamanho || null;
    let precoBase = Number(produto.precoVenda);
    let nomeFinal = produto.nome;

    if (tamanhoName) {
      const sizeObj = Array.isArray(produto.tamanhos) ? produto.tamanhos.find(t => t.nome === tamanhoName) : null;
      if (sizeObj) {
        precoBase = Number(sizeObj.preco);
        nomeFinal = `${produto.nome} (${tamanhoName})`;
      } else {
        // Se enviou tamanho mas não achou, pode ser erro ou fallback. Vamos logar e seguir fallback?
        // Melhor retornar erro se o tamanho for inválido explícito
        return res.status(400).json({ error: `Tamanho '${tamanhoName}' inválido para este produto` });
      }
    }
    if (!produto.ativo) {
      return res.status(400).json({ error: 'Produto inativo' });
    }

    // Busca item pendente idêntico (mesmo produto e SEM variação)
    const itemExistente = Array.isArray(venda.itens)
      ? venda.itens.find((i) => {
          const sameProduct = Number(i.productId) === prodId;
          const isPendente = i.status === 'pendente';
          // Garante que o item existente não tenha variação (nem tipo, nem opções)
          // Isso evita mesclar um produto simples com um que já tem variação
          const hasNoVariation = !i.variacaoTipo && (!i.variacaoOpcoes || (Array.isArray(i.variacaoOpcoes) && i.variacaoOpcoes.length === 0));
          
          return sameProduct && isPendente && hasNoVariation;
      })
      : null;
      
    // Só faz merge se o payload atual TAMBÉM não tiver variação e encontrarmos um item compatível
    const shouldMerge = !variacao && itemExistente;
    if (shouldMerge) {
      const novaQtd = Number(itemExistente.quantidade || 0) + Number(quantidade || 1);
      await prisma.saleItem.update({
        where: { id: itemExistente.id },
        data: {
          quantidade: novaQtd,
          subtotal: String((Number(novaQtd) * Number(itemExistente.precoUnitario ?? produto.precoVenda)).toFixed(2))
        }
      });
    } else {
      // ... create new item code
      let precoUnit = precoBase;
      let variacaoTipo = null;
      let variacaoRegra = null;
      let variacaoOpcoes = null;
      if (variacao) {
        try {
          const tipoId = Number(variacao?.tipoId);
          const tipoNome = String(variacao?.tipoNome || '').trim();
          let vt = null;
          if (Number.isInteger(tipoId) && tipoId > 0) {
            vt = await prisma.variationType.findUnique({ where: { id: tipoId } });
          } else if (tipoNome) {
            vt = await prisma.variationType.findFirst({ where: { nome: tipoNome } });
          }
          if (vt && vt.ativo === false) vt = null;
          const opcoesArr = Array.isArray(variacao?.opcoes) ? variacao.opcoes : [];
          const opcoesIds = opcoesArr.map((o) => Number(o?.productId ?? o)).filter((n) => Number.isInteger(n) && n > 0);
          const maxAllowed = Number(vt?.maxOpcoes || variacao?.maxOpcoes || 1);
          if (opcoesIds.length === 0 || opcoesIds.length > maxAllowed) {
            return res.status(400).json({ error: 'Quantidade de opções inválida para a variação' });
          }
          const prods = await prisma.product.findMany({ 
            where: { id: { in: opcoesIds }, ativo: true },
            include: { tamanhos: true }
          });
          if (prods.length !== opcoesIds.length) {
            return res.status(400).json({ error: 'Opções de variação inválidas' });
          }
          if (vt && Array.isArray(vt.categoriasIds) && vt.categoriasIds.length > 0) {
            const invalid = prods.some((p) => {
              const cid = Number(p.categoriaId || 0);
              return !vt.categoriasIds.includes(cid);
            });
            if (invalid) {
              return res.status(400).json({ error: 'Opção fora das categorias aplicáveis' });
            }
          }
          
          const precos = prods.map((p) => {
             if (tamanhoName && Array.isArray(p.tamanhos)) {
               const s = p.tamanhos.find(t => t.nome === tamanhoName);
               if (s) return Number(s.preco);
             }
             return Number(p.precoVenda);
          });
          const fractions = opcoesArr.map((o) => Number(o?.fracao || 0)).filter((f) => Number.isFinite(f) && f > 0);
          const regra = String(vt?.regraPreco || variacao?.regraPreco || 'mais_caro');
          if (regra === 'mais_caro') {
            precoUnit = Math.max(...precos);
          } else if (regra === 'media') {
            if (fractions.length === precos.length && fractions.length > 0) {
              const wsum = precos.reduce((acc, n, i) => acc + n * fractions[i], 0);
              const fsum = fractions.reduce((acc, f) => acc + f, 0);
              precoUnit = fsum > 0 ? (wsum / fsum) : precoBase;
            } else {
              const sum = precos.reduce((acc, n) => acc + n, 0);
              precoUnit = precos.length > 0 ? (sum / precos.length) : precoBase;
            }
          } else if (regra === 'fixo') {
            const pf = vt?.precoFixo !== null && vt?.precoFixo !== undefined ? Number(vt.precoFixo) : Number(variacao?.precoFixo || 0);
            precoUnit = pf > 0 ? pf : precoBase;
          }
          variacaoTipo = vt ? vt.nome : (tipoNome || null);
          variacaoRegra = vt ? vt.regraPreco : regra;
          variacaoOpcoes = prods.map((p, idx) => ({ productId: p.id, nome: p.nome, preco: precos[idx], fracao: fractions[idx] || undefined }));
          
          // Construir nome do produto concatenado (Ex: Meio Calabresa / Meio Frango)
          if (variacaoOpcoes.length > 1) {
            const nomesConcatenados = variacaoOpcoes.map(o => `meio ${o.nome}`).join(' / ');
            nomeFinal = nomesConcatenados + (tamanhoName ? ` (${tamanhoName})` : '');
          }
        } catch (e) {
          console.error('Erro ao processar variação no backend:', e);
          return res.status(400).json({ error: 'Erro ao processar variação' });
        }
      }
      const qty = Number(quantidade || 1);
      await prisma.saleItem.create({
        data: {
          saleId: venda.id,
          productId: prodId,
          nomeProduto: nomeFinal,
          quantidade: qty,
          precoUnitario: String(Number(precoUnit).toFixed(2)),
          subtotal: String(Number(qty * precoUnit).toFixed(2)),
          status: 'pendente',
          createdAt: new Date(),
          origem,
          variacaoTipo: variacaoTipo || undefined,
          variacaoRegraPreco: variacaoRegra || undefined,
          variacaoOpcoes: variacaoOpcoes || undefined
        },
      });
    }

    const vendaAtualizada = await prisma.sale.findUnique({
      where: { id },
      include: {
        funcionario: { select: { nome: true } },
        cliente: { select: { nome: true } },
        itens: { include: { product: { select: { nome: true, precoVenda: true } } } },
      },
    });

    try {
      const setores = await prisma.$queryRawUnsafe(`SELECT s.id AS id, s.nome AS nome, s.modoEnvio AS modo, s.whatsappDestino AS whatsappDestino, s.printerId AS printerId FROM \`SetorImpressao\` s INNER JOIN \`ProductSetorImpressao\` psi ON psi.setorId = s.id WHERE psi.productId = ${prodId} AND s.ativo = 1`);
      let cozinha = false;
      let bar = false;
      const saleRef = { mesa: vendaAtualizada?.mesa || null, comanda: vendaAtualizada?.nomeComanda || null };
      const it = Array.isArray(vendaAtualizada?.itens) ? vendaAtualizada.itens.find((i) => Number(i.productId) === prodId && Number(i.quantidade) === Number(quantidade || 1)) : null;
      const qty = Number(quantidade || 1);
      for (const s of Array.isArray(setores) ? setores : []) {
        const nome = String(s.nome || '').toLowerCase();
        const modo = String(s.modo || '').toLowerCase();
        if (nome === 'comandas' || nome === 'mesas' || nome === 'cozinha') cozinha = true;
        if (nome === 'balcão' || nome === 'balcao' || nome === 'bar') bar = true;
        if (modo === 'impressora' && s.printerId) {
          const content = buildPrintContent({ setorNome: s.nome, saleRef, productNome: it?.product?.nome || produto?.nome || '', quantidade: qty, observacao: it?.observacao || '' });
          enqueuePrintJob({ saleId: id, productId: prodId, setorId: Number(s.id), printerId: Number(s.printerId), content }).catch(() => {});
        }
        if (modo === 'whatsapp' && s.whatsappDestino) {
          const text = formatWhatsappMessage({ sale: vendaAtualizada, itens: vendaAtualizada?.itens || [] });
          queueWhatsAppMessage({ saleId: id, to: String(s.whatsappDestino), text }).catch(() => {});
        }
      }
      if (cozinha || bar) {
        await prisma.sale.update({ where: { id }, data: { impressaoCozinha: cozinha ? true : undefined, impressaoBar: bar ? true : undefined } });
      }
    } catch {}

    const payload = mapSaleResponse(normalizeSale(vendaAtualizada));
    try {
      const hasSetorVinculo = Array.isArray(setores) ? setores.length > 0 : false;
      payload.validacaoSetor = {
        productId: Number(prodId),
        vinculado: !!hasSetorVinculo,
        setores: (Array.isArray(setores) ? setores.map((s) => s?.nome).filter(Boolean) : [])
      };
      if (!hasSetorVinculo) {
        payload.warnings = [...(Array.isArray(payload.warnings) ? payload.warnings : []), 'Produto sem vínculo com setor de impressão'];
      }
    } catch {}
    res.json(payload);
    try { recordSaleUpdate(vendaAtualizada.id); } catch {}
  } catch (error) {
    console.error('Erro ao adicionar item:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Remover item da venda (Prisma)
router.delete('/:id/item/:produtoId', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const id = Number(req.params.id);
    const prodId = Number(req.params.produtoId);
    const origemRaw = (req.body?.origem || req.headers['x-client-mode'] || '').toString().toLowerCase();
    const origem = origemRaw === 'tablet' ? 'tablet' : 'default';
    console.log('[SALE] DELETE /:id/item/:produtoId', { id, produtoId: prodId, origem });
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Venda inválida' });
    }
    if (!Number.isInteger(prodId) || prodId <= 0) {
      return res.status(400).json({ error: 'Produto inválido' });
    }

    const venda = await prisma.sale.findUnique({ where: { id }, include: { itens: true } });
    if (!venda) {
      return res.status(404).json({ error: 'Venda não encontrada' });
    }
    if (venda.status !== 'aberta') {
      console.warn('[SALE] removeItem rejeitado: venda não está aberta', { id, status: venda.status });
      return res.status(400).json({ error: 'Não é possível remover itens de uma venda finalizada' });
    }

    let item = venda.itens.find(i => i.productId === prodId);
    if (origem === 'tablet') {
      const tabletItens = venda.itens.filter(i => i.productId === prodId && String(i.origem || '') === 'tablet');
      if (tabletItens.length > 0) {
        item = tabletItens.sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).pop();
      }
    }
    if (!item) {
      return res.status(404).json({ error: 'Item não encontrado na venda' });
    }

    await prisma.saleItem.delete({ where: { id: item.id } });

    const vendaAtualizada = await prisma.sale.findUnique({
      where: { id },
      include: {
        funcionario: { select: { nome: true } },
        cliente: { select: { nome: true } },
        itens: { include: { product: { select: { nome: true, precoVenda: true } } } },
      },
    });

    res.json(mapSaleResponse(normalizeSale(vendaAtualizada)));
    try { recordSaleUpdate(vendaAtualizada.id); } catch {}
  } catch (error) {
    console.error('Erro ao remover item:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Atualizar quantidade de item (Prisma)
  router.put('/:id/item/:produtoId', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const id = Number(req.params.id);
    const prodId = Number(req.params.produtoId);
    const { quantidade, itemId } = req.body;
    const origemRaw = (req.body?.origem || req.headers['x-client-mode'] || '').toString().toLowerCase();
    const origem = origemRaw === 'tablet' ? 'tablet' : 'default';
    console.log('[SALE] PUT /:id/item/:produtoId', { id, produtoId: prodId, quantidade, origem, itemId });

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Venda inválida' });
    }
    if (!Number.isInteger(prodId) || prodId <= 0) {
      return res.status(400).json({ error: 'Produto inválido' });
    }
    const qnt = Number(quantidade);
    if (!Number.isInteger(qnt) || qnt <= 0) {
      return res.status(400).json({ error: 'Quantidade deve ser maior que zero' });
    }

    const venda = await prisma.sale.findUnique({ where: { id }, include: { itens: true } });
    if (!venda) {
      return res.status(404).json({ error: 'Venda não encontrada' });
    }
    if (venda.status !== 'aberta') {
      console.warn('[SALE] updateItemQuantity rejeitado: venda não está aberta', { id, status: venda.status });
      return res.status(400).json({ error: 'Não é possível alterar itens de uma venda finalizada' });
    }

    let item = venda.itens.find(i => i.productId === prodId);
    // Prioritize lookup by unique Item ID if provided
    if (itemId) {
      const byId = venda.itens.find(i => i.id === Number(itemId));
      if (byId && byId.productId === prodId) {
        item = byId;
      }
    } 
    // Fallback for tablet mode logic (if no ID provided or strictly obeying old logic)
    else if (origem === 'tablet') {
      const tabletItens = venda.itens.filter(i => i.productId === prodId && String(i.origem || '') === 'tablet');
      if (tabletItens.length > 0) {
        item = tabletItens.sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).pop();
      }
    }
    if (!item) {
      return res.status(404).json({ error: 'Item não encontrado na venda' });
    }

    const prevQty = Number(item.quantidade || 0);

    const delta = qnt - prevQty;
    if (delta <= 0) {
      await prisma.saleItem.update({
        where: { id: item.id },
        data: { quantidade: qnt, subtotal: qnt * item.precoUnitario },
      });
    } else {
      // Se o item já foi processado (não está pendente), não podemos misturar o status.
      // Devemos criar um NOVO item para o incremento (delta).
      if (item.status && item.status !== 'pendente') {
          console.log('[SALE] Incremento em item processado. Criando novo item com qty:', delta);
          // Clonar os dados do item original
          await prisma.saleItem.create({
            data: {
              saleId: venda.id,
              productId: item.productId,
              nomeProduto: item.nomeProduto,
              quantidade: delta,
              precoUnitario: item.precoUnitario, // Mantém preço da época ou original
              subtotal: String((Number(delta) * Number(item.precoUnitario)).toFixed(2)),
              status: 'pendente', // Novo item nasce pendente
              createdAt: new Date(),
              origem: origem === 'tablet' ? 'tablet' : 'default',
              variacaoTipo: item.variacaoTipo,
              variacaoRegraPreco: item.variacaoRegraPreco,
              variacaoOpcoes: item.variacaoOpcoes
            },
          });
          // O item original permanece inalterado (ou talvez precisasse ser atualizado se o delta fosse parcial, mas aqui assumimos incremento total do contador visual)
          // Na verdade, o frontend mandou quantidade TOTAL (ex: era 2 virou 3).
          // Se eu crio um novo item de 1, o item original deve permanecer com 2.
          // O frontend vai receber a lista atualizada com 2 itens: um de 2 e um de 1.
          
          // Nenhuma alteração no item original necessária.
      } else {
        // Item ainda está pendente, podemos apenas somar
        await prisma.saleItem.update({
          where: { id: item.id },
          data: { quantidade: qnt, subtotal: qnt * item.precoUnitario, status: 'pendente' },
        });
      }
    }

    const vendaAtualizada = await prisma.sale.findUnique({
      where: { id },
      include: {
        funcionario: { select: { nome: true } },
        cliente: { select: { nome: true } },
        itens: { include: { product: { select: { nome: true, precoVenda: true } } } },
      },
    });
    try {
      const setores = await prisma.$queryRawUnsafe(`SELECT s.id AS id, s.nome AS nome, s.modoEnvio AS modo, s.whatsappDestino AS whatsappDestino, s.printerId AS printerId FROM \`SetorImpressao\` s INNER JOIN \`ProductSetorImpressao\` psi ON psi.setorId = s.id WHERE psi.productId = ${prodId} AND s.ativo = 1`);
      const saleRef = { mesa: vendaAtualizada?.mesa || null, comanda: vendaAtualizada?.nomeComanda || null };
      const it = Array.isArray(vendaAtualizada?.itens) ? vendaAtualizada.itens.find((i) => Number(i.productId) === prodId) : null;
      const deltaNow = qnt - prevQty;
      if (deltaNow > 0) {
        for (const s of Array.isArray(setores) ? setores : []) {
          const modo = String(s.modo || '').toLowerCase();
          if (modo === 'impressora' && s.printerId) {
            const content = buildPrintContent({ setorNome: s.nome, saleRef, productNome: it?.product?.nome || '', quantidade: deltaNow, observacao: it?.observacao || '' });
            enqueuePrintJob({ saleId: id, productId: prodId, setorId: Number(s.id), printerId: Number(s.printerId), content }).catch(() => {});
          }
          if (modo === 'whatsapp' && s.whatsappDestino) {
            const text = formatWhatsappMessage({ sale: vendaAtualizada, itens: vendaAtualizada?.itens || [] });
            queueWhatsAppMessage({ saleId: id, to: String(s.whatsappDestino), text }).catch(() => {});
          }
        }
      }
    } catch {}

    res.json(mapSaleResponse(normalizeSale(vendaAtualizada)));
    try { recordSaleUpdate(vendaAtualizada.id); } catch {}
  } catch (error) {
    console.error('Erro ao atualizar item:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Aplicar desconto (Prisma)
router.put('/:id/discount', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const id = Number(req.params.id);
    const { desconto } = req.body;

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const descontoNum = Number(desconto);
    if (!Number.isFinite(descontoNum) || descontoNum < 0) {
      return res.status(400).json({ error: 'Desconto não pode ser negativo' });
    }

    const venda = await prisma.sale.findUnique({ where: { id } });
    if (!venda) {
      return res.status(404).json({ error: 'Venda não encontrada' });
    }
    if (venda.status !== 'aberta') {
      return res.status(400).json({ error: 'Não é possível alterar desconto de uma venda finalizada' });
    }

    await prisma.sale.update({ where: { id }, data: { desconto: descontoNum } });

    const vendaAtualizada = await prisma.sale.findUnique({
      where: { id },
      include: {
        funcionario: { select: { nome: true } },
        cliente: { select: { nome: true } },
        itens: { include: { product: { select: { nome: true, precoVenda: true } } } },
      },
    });

    res.json(mapSaleResponse(normalizeSale(vendaAtualizada)));
    try { recordSaleUpdate(vendaAtualizada.id); } catch {}
  } catch (error) {
    console.error('Erro ao aplicar desconto:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Finalizar venda
router.put('/:id/finalize', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const { formaPagamento } = req.body;

    const venda = await prisma.sale.findUnique({
      where: { id },
      include: {
        itens: true,
        caixaVendas: true,
        funcionario: { select: { nome: true } },
        cliente: { select: { nome: true } },
        mesa: { include: { funcionarioResponsavel: { select: { id: true, nome: true } } } },
      },
    });

    if (!venda) {
      return res.status(404).json({ error: 'Venda não encontrada' });
    }
    if (venda.status !== 'aberta') {
      return res.status(400).json({ error: 'Venda já foi finalizada ou cancelada' });
    }
    if (!venda.itens || venda.itens.length === 0) {
      return res.status(400).json({ error: 'Não é possível finalizar uma venda sem itens' });
    }

    const formaPagamentoNormalizada = String(formaPagamento || venda.formaPagamento || 'dinheiro')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const formaFinal = ['dinheiro', 'cartao', 'pix'].includes(formaPagamentoNormalizada)
      ? formaPagamentoNormalizada
      : 'dinheiro';

    const subtotal = Number(
      venda.itens.reduce(
        (acc, item) => acc + Number(item.subtotal ?? (Number(item.quantidade) * Number(item.precoUnitario))),
        0
      )
    );
    const descontoNum = Number(venda.desconto || 0);
    const total = Math.max(0, subtotal - descontoNum);

    let responsavelNome = venda.responsavelNome || null;
    let funcionarioNome = venda.funcionarioNome || null;
    let funcionarioAberturaNome = venda.funcionarioAberturaNome || null;
    let funcionarioAberturaId = venda.funcionarioAberturaId || null;
    let funcionarioId = venda.funcionarioId || null;

    if (venda.mesaId && venda.mesa) {
      const nomeRespMesa = (venda.mesa.nomeResponsavel || '').trim();
      responsavelNome = (nomeRespMesa && nomeRespMesa) || (venda.nomeComanda || '') || responsavelNome || null;
      const atendente = venda.mesa.funcionarioResponsavel || null;
      if (atendente) {
        funcionarioNome = atendente.nome;
        funcionarioId = atendente.id;
        funcionarioAberturaNome = funcionarioAberturaNome || atendente.nome;
        funcionarioAberturaId = funcionarioAberturaId || atendente.id;
      } else if (venda.funcionario) {
        funcionarioNome = venda.funcionario.nome;
        funcionarioId = venda.funcionarioId || funcionarioId;
      }
    } else {
      responsavelNome = (venda.nomeComanda || '') || responsavelNome || null;
      if (venda.funcionario) {
        funcionarioNome = venda.funcionario.nome;
        funcionarioId = venda.funcionarioId || funcionarioId;
      }
    }

    if (!funcionarioNome && !funcionarioAberturaNome) {
      funcionarioAberturaNome = 'Administrador';
    }

    const vendaFinalizada = await prisma.sale.update({
      where: { id },
      data: {
        formaPagamento: formaFinal,
        subtotal,
        total,
        status: 'finalizada',
        dataFinalizacao: new Date(),
        responsavelNome,
        funcionarioNome,
        funcionarioAberturaNome,
        funcionarioAberturaId,
        funcionarioId,
      },
      include: {
        funcionario: { select: { nome: true } },
        cliente: { select: { nome: true } },
        mesa: { include: { funcionarioResponsavel: { select: { nome: true } } } },
        itens: { include: { product: { select: { nome: true, precoVenda: true } } } },
      },
    });

    let caixaAberto = await prisma.caixa.findFirst({ where: { status: 'aberto' } });
    if (!caixaAberto) {
      let funcIdToUse = vendaFinalizada.funcionarioId || vendaFinalizada.funcionarioAberturaId || null;
      if (!funcIdToUse) {
        const func = await prisma.employee.findFirst({ where: { ativo: true } });
        if (func) {
          funcIdToUse = func.id;
        } else {
          const admin = await prisma.employee.create({
            data: {
              nome: 'Administrador',
              telefone: '(00) 00000-0000',
              cargo: 'Gerente',
              salario: 0,
              ativo: true,
              dataAdmissao: new Date(),
            },
          });
          funcIdToUse = admin.id;
        }
      }
      caixaAberto = await prisma.caixa.create({
        data: {
          funcionarioAberturaId: funcIdToUse,
          valorAbertura: 0,
          observacoes: 'Caixa aberto automaticamente pelo sistema',
        },
      });
    }

    const totalVenda = Number(vendaFinalizada.total);
    const totalPago = Array.isArray(venda.caixaVendas)
      ? venda.caixaVendas.reduce((acc, cv) => acc + Number(cv.valor), 0)
      : 0;
    
    // Valor restante a ser registrado no caixa agora
    const valorPendente = Math.max(0, totalVenda - totalPago);
    const forma = formaFinal;

    if (valorPendente > 0.01) {
      await prisma.caixaVenda.create({
        data: {
          caixaId: caixaAberto.id,
          vendaId: vendaFinalizada.id,
          valor: valorPendente,
          formaPagamento: forma,
          dataVenda: new Date(),
        },
      });

      const novoTotalVendas = Number(caixaAberto.totalVendas || 0) + valorPendente;
      const novoDinheiro = Number(caixaAberto.totalDinheiro || 0) + (forma === 'dinheiro' ? valorPendente : 0);
      const novoCartao = Number(caixaAberto.totalCartao || 0) + (forma === 'cartao' ? valorPendente : 0);
      const novoPix = Number(caixaAberto.totalPix || 0) + (forma === 'pix' ? valorPendente : 0);

      await prisma.caixa.update({
        where: { id: caixaAberto.id },
        data: {
          totalVendas: novoTotalVendas,
          totalDinheiro: novoDinheiro,
          totalCartao: novoCartao,
          totalPix: novoPix,
        },
      });
    }

    if (vendaFinalizada.mesaId) {
      const mesa = await prisma.mesa.findUnique({ where: { id: vendaFinalizada.mesaId } });
      if (mesa) {
        await prisma.mesa.update({
          where: { id: mesa.id },
          data: {
            status: 'livre',
            vendaAtualId: null,
            clientesAtuais: 0,
            horaAbertura: null,
            observacoes: '',
            funcionarioResponsavelId: null,
            nomeResponsavel: '',
          },
        });
      }
    }

    res.json(mapSaleResponse(vendaFinalizada));
    try { recordSaleUpdate(vendaFinalizada.id); } catch {}
  } catch (error) {
    console.error('Erro ao finalizar venda:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});
// Cancelar venda (Prisma)
router.put('/:id/cancel', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const venda = await prisma.sale.findUnique({ where: { id } });
    if (!venda) {
      return res.status(404).json({ error: 'Venda não encontrada' });
    }

    if (venda.status === 'finalizada') {
      return res.status(400).json({ error: 'Não é possível cancelar uma venda finalizada' });
    }

    const vendaCancelada = await prisma.sale.update({
      where: { id },
      data: { status: 'cancelada', dataFinalizacao: new Date() },
      include: {
        funcionario: { select: { nome: true } },
        cliente: { select: { nome: true } },
        itens: { include: { product: { select: { nome: true, precoVenda: true } } } },
      },
    });

    // Se mesa vinculada estiver apontando para esta venda, limpar vínculo/estado
    if (venda.mesaId) {
      const mesa = await prisma.mesa.findUnique({ where: { id: venda.mesaId } });
      if (mesa && mesa.vendaAtualId === id) {
        await prisma.mesa.update({
          where: { id: venda.mesaId },
          data: {
            vendaAtualId: null,
            clientesAtuais: 0,
            horaAbertura: null,
            observacoes: '',
            funcionarioResponsavelId: null,
            nomeResponsavel: '',
          },
        });
      }
    }

    res.json(mapSaleResponse(normalizeSale(vendaCancelada)));
    try { recordSaleUpdate(vendaCancelada.id); } catch {}
  } catch (error) {
    console.error('Erro ao cancelar venda:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Listar todas as vendas (rota alternativa) com Prisma
router.get('/', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const { status, funcionario, cliente, dataInicio, dataFim, isDelivery } = req.query;
    const where = {};

    if (status) where.status = String(status);
    if (funcionario) where.funcionarioId = Number(funcionario);
    if (cliente) where.clienteId = Number(cliente);
    if (isDelivery === 'true') where.isDelivery = true;

    if (dataInicio || dataFim) {
      where.dataVenda = {};
      if (dataInicio) where.dataVenda.gte = new Date(String(dataInicio));
      if (dataFim) where.dataVenda.lte = new Date(String(dataFim));
    }

    const vendas = await prisma.sale.findMany({
      where,
      include: {
        funcionario: { select: { nome: true } },
        cliente: { select: { nome: true } },
        caixaVendas: true,
      },
      orderBy: { dataVenda: 'desc' },
      take: 100,
    });

    res.json(mapSales(normalizeSales(vendas)));
  } catch (error) {
    console.error('Erro ao buscar vendas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Registrar pagamento parcial de itens (Atualiza status/observações sem finalizar)
router.put('/:id/pay-items', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const id = Number(req.params.id);
    const { items, paymentInfo } = req.body; // items: [{ id, paidAmount, fullyPaid }], paymentInfo: { method, totalAmount }

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const venda = await prisma.sale.findUnique({
      where: { id },
      include: { itens: true }
    });

    if (!venda) {
      return res.status(404).json({ error: 'Venda não encontrada' });
    }

    // 1. Criar registro no Caixa com os detalhes dos itens
    let caixaAberto = await prisma.caixa.findFirst({ where: { status: 'aberto' } });
    
    // Se não tiver caixa aberto, abrimos um automaticamente (fallback de segurança)
    if (!caixaAberto) {
      const admin = await prisma.employee.findFirst({ where: { ativo: true } });
      caixaAberto = await prisma.caixa.create({
        data: {
          funcionarioAberturaId: admin?.id || 1, // Fallback ID
          valorAbertura: 0,
          observacoes: 'Abertura automática por Pagamento Parcial',
          totalVendas: 0,
          totalDinheiro: 0,
          totalCartao: 0,
          totalPix: 0
        }
      });
    }

    const { method, totalAmount } = paymentInfo || {};
    const formaPagamento = String(method || 'dinheiro').toLowerCase();
    const valorPagamento = Number(totalAmount || 0);

    // Salvar metadados dos itens pagos na tabela CaixaVenda
    await prisma.caixaVenda.create({
      data: {
        caixaId: caixaAberto.id,
        vendaId: venda.id,
        valor: valorPagamento,
        formaPagamento: ['dinheiro', 'cartao', 'pix'].includes(formaPagamento) ? formaPagamento : 'dinheiro',
        dataVenda: new Date(),
        itensPagos: items || [], // Grava o JSON na tabela
        observacoes: 'Pagamento Parcial / Dividido'
      }
    });
    console.log('[API] Pagamento Parcial registrado. Acionando sync para id:', venda.id);

    // Atualizar totais do Caixa
    const novoTotalVendas = Number(caixaAberto.totalVendas || 0) + valorPagamento;
    const updateData = { totalVendas: novoTotalVendas };
    if (formaPagamento === 'dinheiro') updateData.totalDinheiro = Number(caixaAberto.totalDinheiro || 0) + valorPagamento;
    else if (formaPagamento === 'cartao') updateData.totalCartao = Number(caixaAberto.totalCartao || 0) + valorPagamento;
    else if (formaPagamento === 'pix') updateData.totalPix = Number(caixaAberto.totalPix || 0) + valorPagamento;

    await prisma.caixa.update({ where: { id: caixaAberto.id }, data: updateData });


    // Atualizar status dos itens se estivem totalmente pagos
    if (Array.isArray(items)) {
      for (const itemPay of items) {
        if (itemPay.fullyPaid) {
          const exists = venda.itens.find(i => i.id === Number(itemPay.id));
          if (exists) {
            await prisma.saleItem.update({
              where: { id: exists.id },
              data: { status: 'pago' }
            });
          }
        }
      }
    }

    // Retornar venda atualizada
    const vendaAtualizada = await prisma.sale.findUnique({
      where: { id },
      include: {
        itens: { include: { product: { select: { nome: true, precoVenda: true } } } },
        caixaVendas: true,
        funcionario: { select: { nome: true } },
        cliente: { select: { nome: true } },
        mesa: { select: { numero: true, nome: true } },
      }
    });

    res.json(mapSaleResponse(vendaAtualizada));
    try { recordSaleUpdate(vendaAtualizada.id); } catch {}
  } catch (error) {
    console.error('Erro ao registrar pagamento de itens:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});



// Atualizar dados de delivery (Prisma)
router.put('/:id/delivery', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const id = Number(req.params.id);
    const { isDelivery, deliveryAddress, deliveryDistance, deliveryFee, deliveryStatus } = req.body;

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const venda = await prisma.sale.findUnique({ where: { id } });
    if (!venda) {
      return res.status(404).json({ error: 'Venda não encontrada' });
    }

    // Se estiver finalizada, permitir apenas atualizar status de entrega (ex: entregue) 
    // ou se o requisito permitir. Mas a regra diz que só finaliza DEPOIS.
    // Então aqui permitimos editar dados enquanto aberta.
    
    const updateData = {};
    if (typeof isDelivery === 'boolean') updateData.isDelivery = isDelivery;
    if (deliveryAddress !== undefined) updateData.deliveryAddress = deliveryAddress;
    if (deliveryDistance !== undefined) updateData.deliveryDistance = Number(deliveryDistance);
    if (deliveryFee !== undefined) updateData.deliveryFee = Number(deliveryFee);
    if (deliveryStatus !== undefined) updateData.deliveryStatus = deliveryStatus;

    // Se ativar delivery, mudar tipoVenda para delivery também?
    if (isDelivery) {
        updateData.tipoVenda = 'delivery';
    }

    const vendaAtualizada = await prisma.sale.update({
      where: { id },
      data: updateData,
      include: {
        funcionario: { select: { nome: true } },
        cliente: { select: { nome: true } },
        itens: { include: { product: { select: { nome: true, precoVenda: true } } } },
      },
    });

    res.json(mapSaleResponse(normalizeSale(vendaAtualizada)));
    try { recordSaleUpdate(vendaAtualizada.id); } catch {}
  } catch (error) {
    console.error('Erro ao atualizar delivery:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Confirmar entrega (Finalizar venda delivery)
router.post('/:id/confirm-delivery', async (req, res) => {
    // Redireciona para finalize ou implementa lógica específica
    // Pela regra: "O entregador confirmar a entrega no sistema -> A venda é finalizada normalmente"
    // Então podemos chamar a lógica de finalize, mas garantindo que deliveryStatus = delivered
    
    // Vamos chamar o endpoint de finalize via redirecionamento interno ou duplicar lógica simples?
    // Melhor: Criar lógica aqui que atualiza status delivery e chama finalize.
    // Mas finalize é complexo (caixa, estoque, etc).
    // O ideal seria o frontend chamar /finalize passando campos extras se suportado, 
    // ou este endpoint chamar a função de finalização. 
    // Como finalize está no mesmo arquivo, mas dentro de uma rota, não é uma função isolada exportada.
    // Vou instruir o frontend a chamar /finalize, mas antes atualizar o status de entrega.
    
    try {
        const prisma = getActivePrisma();
        const id = Number(req.params.id);
        
        await prisma.sale.update({
            where: { id },
            data: { 
                deliveryStatus: 'delivered',
                status: 'finalizada',
                dataFinalizacao: new Date()
            }
        });
        
        res.json({ message: "Entrega confirmada e venda finalizada.", success: true });
    } catch (error) {
        res.status(500).json({ error: "Erro ao confirmar entrega" });
    }
});


// Imprimir comprovante de entrega (Cupom)
router.post('/:id/delivery-print', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const venda = await prisma.sale.findUnique({
      where: { id },
      include: {
        funcionario: { select: { nome: true } },
        cliente: { select: { nome: true, endereco: true, fone: true } },
        itens: true,
      }
    });

    if (!venda) return res.status(404).json({ error: 'Venda não encontrada' });

    // 2. Montar Conteúdo (Moved up)
    const pad = (str, len) => (str + ' '.repeat(len)).slice(0, len);
    const line = '-'.repeat(32);
    const dateStr = new Date().toLocaleString('pt-BR');
    
    let content = '';
    content += '       PEDIDO DELIVERY\n';
    content += `${line}\n`;
    content += `Comanda: ${venda.nomeComanda || venda.id}\n`;
    content += `Data: ${dateStr}\n`;
    content += `${line}\n`;
    
    if (venda.cliente) {
        content += `CLIENTE: ${venda.cliente.nome}\n`;
        if (venda.cliente.fone) content += `Tel: ${venda.cliente.fone}\n`;
    } else {
        content += `CLIENTE: Nao Identificado\n`;
    }
    
    if (venda.deliveryAddress) {
        // Quebra de linha simples para endereço
        const addr = venda.deliveryAddress;
        content += `ENDERECO:\n${addr.slice(0, 32)}\n`;
        if (addr.length > 32) content += `${addr.slice(32, 64)}\n`;
    } else if (venda.cliente?.endereco) {
         content += `ENDERECO:\n${venda.cliente.endereco.slice(0, 32)}\n`;
    }
    
    content += `${line}\n`;
    content += `ITEM             QTD   VALOR\n`;
    
    let subtotalItens = 0;
    for (const item of venda.itens) {
        const nome = item.nomeProduto.slice(0, 16);
        const qtd = String(item.quantidade).padStart(3);
        const totalItem = Number(item.subtotal); // ou qtd * unitario
        subtotalItens += totalItem;
        const val = totalItem.toFixed(2).padStart(7);
        content += `${pad(nome, 16)} ${qtd} ${val}\n`;
        
        if (item.observacoes) {
            content += `  Obs: ${item.observacoes.slice(0, 28)}\n`;
        }
    }
    
    content += `${line}\n`;
    content += `Subtotal:        R$ ${subtotalItens.toFixed(2).padStart(8)}\n`;
    const taxa = Number(venda.deliveryFee || 0);
    if (taxa > 0) {
        content += `Taxa Entrega:    R$ ${taxa.toFixed(2).padStart(8)}\n`;
    }
    const desc = Number(venda.desconto || 0);
    if (desc > 0) {
        content += `Desconto:       -R$ ${desc.toFixed(2).padStart(8)}\n`;
    }
    
    const totalFinal = subtotalItens + taxa - desc;
    content += `TOTAL:           R$ ${totalFinal.toFixed(2).padStart(8)}\n`;
    content += `${line}\n\n\n`; // Feed

    // 1. Verificar Impressora (Moved down)
    let printer = await prisma.printer.findFirst({
      where: { 
        OR: [
          { nome: { contains: 'Caixa' } },
          { nome: { contains: 'Delivery' } },
          { nome: { contains: 'Balcão' } }
        ],
        ativo: true 
      }
    });
    
    if (!printer) {
      printer = await prisma.printer.findFirst({ where: { ativo: true } });
    }

    if (!printer) {
      // Fallback: Retorna sucesso mas com flag para gerar PDF local
      return res.json({ success: true, pdfMode: true, content });
    }

    // 3. Enviar job (se tiver impressora)
    await enqueuePrintJob({
        saleId: venda.id,
        productId: 0, // Placeholder
        setorId: 0,   // Placeholder
        printerId: printer.id,
        content
    });

    res.json({ success: true, message: 'Impresso com sucesso' });

  } catch (error) {
    console.error('Erro ao imprimir delivery:', error);
    res.status(500).json({ message: 'Erro ao processar impressão: ' + (error.message || error) });
  }
});

export default router;