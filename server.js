const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './uploads');
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

const DB_FILE = './chamados.json';

function loadChamados() {
  if (!fs.existsSync(DB_FILE)) return [];
  return JSON.parse(fs.readFileSync(DB_FILE));
}

function saveChamados(chamados) {
  fs.writeFileSync(DB_FILE, JSON.stringify(chamados, null, 2));
}

app.get('/chamados.json', (req, res) => {
  res.json(loadChamados());
});

app.post('/chamado-retroativo', (req, res) => {
  chamados.push(req.body);
  salvarChamados();
  res.json({ success: true });
});




app.post('/chamado', upload.fields([
  { name: 'nota_fiscal' },
  { name: 'cte' },
  { name: 'boleto' }
]), (req, res) => {
  const id = uuidv4();
  const data = req.body;
  const arquivos = {};

  if (req.files) {
    for (const key in req.files) {
      arquivos[key] = '/uploads/' + req.files[key][0].filename;
    }
  }

  const chamado = {
    id,
    data_solicitacao: new Date().toISOString(),
    ultima_atualizacao: new Date().toISOString(),
    status: "Fiscal",
    ...data,
    arquivos,
    historico: [
      {
        data: new Date().toISOString(),
        de: null,
        para: "Fiscal",
        mensagem: "Chamado criado"
      }
    ]
  };

  const chamados = loadChamados();
  chamados.push(chamado);
  saveChamados(chamados);

  res.json({ success: true, id });
});

app.patch('/chamado/:id/status', (req, res) => {
  const { status, mensagem } = req.body;
  const chamados = loadChamados();
  const chamado = chamados.find(c => c.id === req.params.id);
  if (!chamado) return res.status(404).json({ success: false, message: 'Chamado não encontrado' });

  chamado.historico = chamado.historico || [];
  chamado.historico.push({
    data: new Date().toISOString(),
    de: chamado.status,
    para: status,
    mensagem: mensagem || ""
  });

  
  if (chamado.status === "Encerrado") {
    return res.status(403).json({ success: false, message: "Chamado já encerrado." });
  }
  if (status === "Encerrado" && !mensagem) {
    return res.status(400).json({ success: false, message: "Mensagem obrigatória para encerramento." });
  }
  chamado.status = status;

  chamado.ultima_atualizacao = new Date().toISOString();

  saveChamados(chamados);
  res.json({ success: true });
});

app.delete('/reset', (req, res) => {
  try {
    if (fs.existsSync(DB_FILE)) fs.unlinkSync(DB_FILE);
    fs.rmSync('./uploads', { recursive: true, force: true });
    fs.mkdirSync('./uploads');
    res.json({ success: true, message: 'Chamados e uploads apagados.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.listen(PORT, () => console.log(`Servidor iniciado na porta ${PORT}`));