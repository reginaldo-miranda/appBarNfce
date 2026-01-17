import express from "express";
import prisma from "../lib/prisma.js";

const router = express.Router();

// Rota para criar cliente
router.post("/create", async (req, res) => {
  try {
    const { nome, endereco, cidade, estado, fone, cep, cpf, rg, dataNascimento, ativo } = req.body;

    // Verificar se CPF já existe (se informado)
    if (cpf) {
        const customerExistente = await prisma.customer.findUnique({ where: { cpf } });
        if (customerExistente) {
          return res.status(400).json({ error: "CPF já cadastrado" });
        }
    }

    const novoCustomer = await prisma.customer.create({
      data: {
        nome,
        endereco,
        cidade,
        estado,
        fone,
        cep,
        cpf: cpf || null,
        rg,
        dataNascimento,
        ativo: ativo !== undefined ? ativo : true,
      },
    });

    res.status(201).json({ message: "Cliente cadastrado com sucesso", customer: novoCustomer });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao cadastrar cliente" });
  }
});

// Rota para listar todos os clientes
router.get("/list", async (req, res) => {
  try {
    const { nome } = req.query;
    const where = {};
    if (nome) {
      where.nome = { contains: String(nome) }; // Removed mode: 'insensitive' for MySQL compatibility if needed, or check if supported. Prisma default for MySQL is case insensitive usually depending on collation.
    }
    const customers = await prisma.customer.findMany({
      where,
      orderBy: { dataInclusao: "desc" },
      take: 20
    });
    res.json(customers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao listar clientes" });
  }
});

// Rota para buscar cliente por ID
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) {
      return res.status(404).json({ error: "Cliente não encontrado" });
    }
    res.json(customer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao buscar cliente" });
  }
});

// Rota para atualizar cliente
router.put("/update/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { nome, endereco, cidade, estado, fone, cep, cpf, rg, dataNascimento, ativo } = req.body;

    // Verificar se CPF já existe em outro cliente
    if (cpf) {
        const customerExistente = await prisma.customer.findFirst({ where: { cpf, id: { not: id } } });
        if (customerExistente) {
            return res.status(400).json({ error: "CPF já cadastrado para outro cliente" });
        }
    }

    const customerAtualizado = await prisma.customer.update({
      where: { id },
      data: { nome, endereco, cidade, estado, fone, cep, cpf: cpf || null, rg, dataNascimento, ativo },
    });

    res.json({ message: "Cliente atualizado com sucesso", customer: customerAtualizado });
  } catch (error) {
    console.error(error);
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Cliente não encontrado" });
    }
    res.status(500).json({ error: "Erro ao atualizar cliente" });
  }
});

// Rota para deletar cliente
router.delete("/delete/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.customer.delete({ where: { id } });
    res.json({ message: "Cliente deletado com sucesso" });
  } catch (error) {
    console.error(error);
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Cliente não encontrado" });
    }
    res.status(500).json({ error: "Erro ao deletar cliente" });
  }
});

export default router;