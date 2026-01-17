import express from 'express';
import prisma from '../lib/prisma.js';

const router = express.Router();

// Helper para compatibilidade Mongo -> MySQL (alias de _id e normalização de relacionamentos)
function mapMesaResponse(m) {
  if (!m) return null;
  const funcionario = m.funcionarioResponsavel
    ? { _id: String(m.funcionarioResponsavel.id), id: m.funcionarioResponsavel.id, nome: m.funcionarioResponsavel.nome }
    : undefined;
  const vendaAtual = m.vendaAtual
    ? { ...m.vendaAtual, _id: String(m.vendaAtual.id), id: m.vendaAtual.id }
    : undefined;
  return { ...m, _id: String(m.id), id: m.id, funcionarioResponsavel: funcionario, vendaAtual };
}

// Listar todas as mesas
router.get('/list', async (req, res) => {
  try {
    const mesas = await prisma.mesa.findMany({
      where: { ativo: true },
      include: {
        vendaAtual: true,
        funcionarioResponsavel: { select: { id: true, nome: true } },
      },
      orderBy: { numero: 'asc' },
    });

    res.json(mesas.map(mapMesaResponse));
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar mesas', error: error.message });
  }
});

// Buscar mesa por ID
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID inválido' });
    }

    const mesa = await prisma.mesa.findUnique({
      where: { id },
      include: {
        vendaAtual: true,
        funcionarioResponsavel: { select: { id: true, nome: true } },
      },
    });

    if (!mesa) {
      return res.status(404).json({ message: 'Mesa não encontrada' });
    }

    res.json(mapMesaResponse(mesa));
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar mesa', error: error.message });
  }
});

// Criar nova mesa
router.post('/create', async (req, res) => {
  try {
    const { numero, nome, capacidade, observacoes, tipo } = req.body;

    const numeroInt = Number(numero);
    if (Number.isNaN(numeroInt)) {
      return res.status(400).json({ message: 'Número da mesa deve ser numérico' });
    }

    const capacidadeInt = capacidade !== undefined ? Number(capacidade) : undefined;
    if (capacidadeInt !== undefined && Number.isNaN(capacidadeInt)) {
      return res.status(400).json({ message: 'Capacidade deve ser numérica' });
    }

    const mesaExistente = await prisma.mesa.findUnique({ where: { numero: numeroInt } });
    if (mesaExistente) {
      return res.status(400).json({ message: 'Já existe uma mesa com este número' });
    }

    const mesa = await prisma.mesa.create({
      data: {
        numero: numeroInt,
        nome,
        capacidade: capacidadeInt ?? 1,
        observacoes,
        tipo: tipo || 'interna',
      },
      include: {
        vendaAtual: true,
        funcionarioResponsavel: { select: { id: true, nome: true } },
      },
    });

    res.status(201).json({ message: 'Mesa criada com sucesso', mesa: mapMesaResponse(mesa) });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao criar mesa', error: error.message });
  }
});

// Abrir mesa
router.post('/:id/abrir', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID inválido' });
    }

    const { funcionarioId, nomeResponsavel, observacoes, numeroClientes = 1 } = req.body;

    const mesa = await prisma.mesa.findUnique({ where: { id } });
    if (!mesa) {
      return res.status(404).json({ message: 'Mesa não encontrada' });
    }

    if (mesa.status === 'ocupada') {
      return res.status(400).json({ message: 'Mesa já está ocupada' });
    }

    // Validar funcionário responsável
    if (!funcionarioId) {
      return res.status(400).json({ message: 'Funcionário responsável é obrigatório' });
    }

    const funcionarioIdInt = Number(funcionarioId);
    if (Number.isNaN(funcionarioIdInt)) {
      return res.status(400).json({ message: 'Funcionário responsável inválido' });
    }

    const funcionario = await prisma.employee.findUnique({ where: { id: funcionarioIdInt } });
    if (!funcionario) {
      return res.status(400).json({ message: 'Funcionário responsável não encontrado' });
    }

    const clientes = Number(numeroClientes);
    if (Number.isNaN(clientes) || clientes < 1) {
      return res.status(400).json({ message: 'Número de clientes inválido' });
    }

    const mesaAtualizada = await prisma.mesa.update({
      where: { id },
      data: {
        status: 'ocupada',
        clientesAtuais: clientes,
        horaAbertura: new Date(),
        observacoes: observacoes || '',
        funcionarioResponsavelId: funcionarioIdInt,
        nomeResponsavel: nomeResponsavel || '',
      },
      include: {
        vendaAtual: true,
        funcionarioResponsavel: { select: { id: true, nome: true } },
      },
    });

    res.json({ message: 'Mesa aberta com sucesso', mesa: mapMesaResponse(mesaAtualizada) });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao abrir mesa', error: error.message });
  }
});

// Fechar mesa
router.post('/:id/fechar', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID inválido' });
    }

    const mesa = await prisma.mesa.findUnique({ where: { id } });
    if (!mesa) {
      return res.status(404).json({ message: 'Mesa não encontrada' });
    }

    // Verificar se há venda em aberto
    if (mesa.vendaAtualId) {
      const venda = await prisma.sale.findUnique({ where: { id: mesa.vendaAtualId } });
      if (venda && venda.status === 'aberta') {
        return res.status(400).json({
          message: 'Não é possível fechar mesa com venda em aberto. Finalize ou cancele a venda primeiro.',
        });
      }
    }

    const mesaFechada = await prisma.mesa.update({
      where: { id },
      data: {
        status: 'livre',
        vendaAtualId: null,
        funcionarioResponsavelId: null,
        nomeResponsavel: '',
        clientesAtuais: 0,
        horaAbertura: null,
        observacoes: '',
      },
      include: {
        vendaAtual: true,
        funcionarioResponsavel: { select: { id: true, nome: true } },
      },
    });

    res.json({ message: 'Mesa fechada com sucesso', mesa: mapMesaResponse(mesaFechada) });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao fechar mesa', error: error.message });
  }
});

// Atualizar mesa
router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID inválido' });
    }

    const { numero, nome, capacidade, status, vendaAtualId, funcionarioResponsavelId, nomeResponsavel, clientesAtuais, horaAbertura, observacoes, tipo, ativo } = req.body;

    const data = {
      nome,
      status,
      nomeResponsavel,
      horaAbertura: horaAbertura ? new Date(horaAbertura) : undefined,
      observacoes,
      tipo,
      ativo,
    };

    if (numero !== undefined) {
      const numeroInt = Number(numero);
      if (Number.isNaN(numeroInt)) {
        return res.status(400).json({ message: 'Número da mesa deve ser numérico' });
      }
      data.numero = numeroInt;
    }

    if (capacidade !== undefined) {
      const capacidadeInt = Number(capacidade);
      if (Number.isNaN(capacidadeInt)) {
        return res.status(400).json({ message: 'Capacidade deve ser numérica' });
      }
      data.capacidade = capacidadeInt;
    }

    if (clientesAtuais !== undefined) {
      const clientesInt = Number(clientesAtuais);
      if (Number.isNaN(clientesInt) || clientesInt < 0) {
        return res.status(400).json({ message: 'Clientes atuais deve ser numérico' });
      }
      data.clientesAtuais = clientesInt;
    }

    if (vendaAtualId !== undefined) {
      const vendaId = vendaAtualId === null ? null : Number(vendaAtualId);
      if (vendaId !== null && Number.isNaN(vendaId)) {
        return res.status(400).json({ message: 'vendaAtualId deve ser numérico' });
      }
      data.vendaAtualId = vendaId;
    }

    if (funcionarioResponsavelId !== undefined) {
      const funcId = funcionarioResponsavelId === null ? null : Number(funcionarioResponsavelId);
      if (funcId !== null && Number.isNaN(funcId)) {
        return res.status(400).json({ message: 'funcionarioResponsavelId deve ser numérico' });
      }
      data.funcionarioResponsavelId = funcId;
    }

    const mesa = await prisma.mesa.update({
      where: { id },
      data,
      include: {
        vendaAtual: true,
        funcionarioResponsavel: { select: { id: true, nome: true } },
      },
    });

    res.json({ message: 'Mesa atualizada com sucesso', mesa: mapMesaResponse(mesa) });
  } catch (error) {
    console.error('❌ Erro ao atualizar mesa:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Mesa não encontrada' });
    }
    res.status(500).json({ message: 'Erro ao atualizar mesa', error: error.message });
  }
});

// Deletar mesa (desativar)
router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID inválido' });
    }

    const mesa = await prisma.mesa.findUnique({ where: { id } });
    if (!mesa) {
      return res.status(404).json({ message: 'Mesa não encontrada' });
    }

    if (mesa.status === 'ocupada') {
      return res.status(400).json({ message: 'Não é possível deletar mesa ocupada' });
    }

    await prisma.mesa.update({ where: { id }, data: { ativo: false } });

    res.json({ message: 'Mesa removida com sucesso' });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao remover mesa', error: error.message });
  }
});

// Obter status de todas as mesas (para dashboard)
router.get('/status', async (req, res) => {
  try {
    const mesas = await prisma.mesa.findMany({ where: { ativo: true } });

    const status = {
      total: mesas.length,
      livres: mesas.filter((m) => m.status === 'livre').length,
      ocupadas: mesas.filter((m) => m.status === 'ocupada').length,
      reservadas: mesas.filter((m) => m.status === 'reservada').length,
      manutencao: mesas.filter((m) => m.status === 'manutencao').length,
    };

    res.json(status);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar status das mesas', error: error.message });
  }
});

export default router;