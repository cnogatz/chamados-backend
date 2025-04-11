const express = require("express");
const fs = require("fs");
const cors = require("cors");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

const chamadosFile = "chamados.json";
let chamados = fs.existsSync(chamadosFile)
  ? JSON.parse(fs.readFileSync(chamadosFile))
  : [];

function salvarChamados() {
  fs.writeFileSync(chamadosFile, JSON.stringify(chamados, null, 2));
}

// Rota padrão de leitura
app.get("/chamados.json", (req, res) => res.json(chamados));

// Rota para resetar
app.delete("/reset", (req, res) => {
  fs.readdirSync("uploads").forEach(f => fs.unlinkSync("uploads/" + f));
  chamados = [];
  salvarChamados();
  res.json({ success: true, message: "Chamados e arquivos apagados." });
});

// Rota para alterar status com histórico
app.patch("/chamado/:id/status", (req, res) => {
  const chamado = chamados.find(c => c.id === req.params.id);
  if (!chamado) return res.status(404).json({ success: false, message: "Chamado não encontrado" });
  if (chamado.status === "Encerrado") return res.status(403).json({ success: false, message: "Chamado encerrado" });

  const { status, mensagem } = req.body;
  if (!status || !mensagem) return res.status(400).json({ success: false, message: "Status e mensagem obrigatórios" });

  chamado.historico = chamado.historico || [];
  chamado.historico.push({
    data: new Date().toISOString(),
    de: chamado.status,
    para: status,
    mensagem
  });
  chamado.status = status;
  chamado.ultima_atualizacao = new Date().toISOString();
  salvarChamados();
  res.json({ success: true });
});

// Rota para injetar chamado retroativo
app.post("/chamado-retroativo", (req, res) => {
  if (!req.body || !req.body.id) return res.status(400).json({ success: false, message: "Dados inválidos" });
  chamados.push(req.body);
  salvarChamados();
  res.json({ success: true, message: "Chamado de teste injetado com sucesso" });
});

app.listen(10000, () => console.log("Servidor iniciado na porta 10000"));


// Rota para criar novo chamado com arquivos
app.post("/chamado", upload.fields([
  { name: "nota_fiscal" },
  { name: "cte" },
  { name: "boleto" }
]), (req, res) => {
  const { area, responsavel, nota, pedido, data_pagamento, frete, comentarios } = req.body;
  const id = Date.now().toString();
  const chamado = {
    id,
    area,
    responsavel,
    nota,
    pedido,
    data_pagamento,
    frete,
    comentarios,
    status: "Fiscal",
    data_solicitacao: new Date().toISOString(),
    ultima_atualizacao: new Date().toISOString(),
    historico: [
      {
        data: new Date().toISOString(),
        de: null,
        para: "Fiscal",
        mensagem: "Chamado criado"
      }
    ],
    arquivos: {}
  };

  const arquivos = req.files;
  if (arquivos?.nota_fiscal) chamado.arquivos.nota_fiscal = "/" + arquivos.nota_fiscal[0].path;
  if (arquivos?.cte) chamado.arquivos.cte = "/" + arquivos.cte[0].path;
  if (arquivos?.boleto) chamado.arquivos.boleto = "/" + arquivos.boleto[0].path;

  chamados.push(chamado);
  salvarChamados();
  res.json({ success: true, id });
});