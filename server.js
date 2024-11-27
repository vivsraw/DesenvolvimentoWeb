const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const app = express();
dotenv.config();

app.use(cors());

// Middleware para parse de JSON
app.use(express.json());

// Conexão com MongoDB
mongoose.connect(process.env.MONGODB_URI, {
}).then(() => {
  console.log("Conectado ao MongoDB");
}).catch(err => {
  console.log("Erro ao conectar ao MongoDB", err);
});

// Defina as rotas
app.get('/', (req, res) => {
  res.send('API funcionando!');
});

// Definindo a porta
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

//Acessando os models.
const Usuario = require('./models/Usuario');
const Carta = require('./models/Carta');

// Rota para registrar um usuário
app.post('/api/usuarios', async (req, res) => {
  const { nome, senha, nascimento, idade } = req.body; // Incluindo os campos nascimento e idade
  try {
    const usuario = new Usuario({ nome, senha, dataNascimento: nascimento, idade }); // Passando todos os dados corretamente
    await usuario.save();
    res.status(201).json(usuario);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// CRUD completo para usuários

// 1. Listar todos os usuários
app.get('/api/usuarios', async (req, res) => {
  try {
    const usuarios = await Usuario.find(); // Busca todos os usuários no banco
    res.status(200).json(usuarios);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Obter um usuário específico
app.get('/api/usuarios/:id', async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.params.id); // Busca usuário pelo ID
    if (!usuario) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    res.status(200).json(usuario);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Atualizar um usuário
app.put('/api/usuarios/:id', async (req, res) => {
  const { nome, senha, nascimento, idade } = req.body; // Dados que podem ser atualizados
  try {
    const usuario = await Usuario.findByIdAndUpdate(
      req.params.id,
      { nome, senha, dataNascimento: nascimento, idade },
      { new: true } // Retorna o documento atualizado
    );
    if (!usuario) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    res.status(200).json(usuario);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 4. Excluir um usuário
app.delete('/api/usuarios/:id', async (req, res) => {
  try {
    const usuario = await Usuario.findByIdAndDelete(req.params.id); // Deleta usuário pelo ID
    if (!usuario) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    res.status(200).json({ message: 'Usuário excluído com sucesso' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login do usuário
app.post('/api/login', async (req, res) => {
  const { nome, senha } = req.body;
  try {
    const usuario = await Usuario.findOne({ nome }); // Busca usuário pelo nome
    if (!usuario) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    if (usuario.senha !== senha) {
      return res.status(401).json({ error: 'Senha incorreta' });
    }
    res.status(200).json(usuario); // Login bem-sucedido
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//Rota para buscar cartas enviadas por um usuário
app.get('/api/cartas', async (req, res) => {
    const { escritor } = req.query;
    try {
        const cartas = await Carta.find({ escritor });
        res.status(200).json(cartas);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

//Rota para buscar cartas recebidas por um usuário
app.get('/api/cartas-recebidas/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const cartasRecebidas = await Carta.find({ 'respostas': userId });
        res.status(200).json(cartasRecebidas);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Rota para buscar uma carta não respondida aleatória
app.get('/api/cartas-nao-respondidas', async (req, res) => {
  const { escritorId } = req.query; // ID do escritor (passado como parâmetro)
  
  try {
    // Buscar cartas não respondidas
    const cartasNaoRespondidas = await Carta.aggregate([
      { $match: { respondida: false, escritor: { $ne: escritorId } } }, 
      { $sample: { size: 1 } } // Selecionar uma carta aleatória
    ]);

    if (cartasNaoRespondidas.length === 0) {
      return res.status(404).json({ error: 'Não há cartas não respondidas disponíveis.' });
    }

    res.status(200).json(cartasNaoRespondidas); // Retorna a carta aleatória
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Rota para resposta da carta
app.post('/api/cartas/:id/respostas', async (req, res) => {
  const { id } = req.params; // ID da carta original
  const { escritor, conteudo } = req.body; // Dados da resposta

  if (!conteudo || conteudo.trim() === '') {
    return res.status(400).json({ error: 'Conteúdo da resposta não pode ser vazio.' });
  }

  try {
    // Encontrar a carta original
    const cartaOriginal = await Carta.findById(id);

    if (!cartaOriginal) {
      return res.status(404).json({ error: 'Carta original não encontrada' });
    }

    // Criar a resposta com o destinatário sendo o escritor da carta original
    const resposta = new Carta({
      escritor, // Quem está respondendo
      destinatario: cartaOriginal.escritor, // Destinatário é o escritor da carta original
      conteudo,
      tipo: 'resposta',
      respondida: true, // A resposta já está associada a uma carta respondida
      respostas: [] // Inicialmente sem respostas
    });

    // Salvar a resposta
    await resposta.save();

    // Atualizar a carta original para 'respondida: true' e associar a resposta
    cartaOriginal.respondida = true;
    cartaOriginal.respostas.push(resposta._id);
    await cartaOriginal.save();

    // Atualizar o campo "cartasRecebidas" do usuário destinatário
    const destinatarioUsuario = await Usuario.findById(cartaOriginal.escritor);
    destinatarioUsuario.cartasRecebidas.push(resposta._id);
    await destinatarioUsuario.save();

    res.status(201).json({ resposta, cartaOriginal });
  } catch (err) {
    console.error('Erro ao adicionar resposta:', err);
    res.status(400).json({ error: err.message });
  }
});

// Rota para enviar uma carta
app.post('/api/cartas', async (req, res) => {
  const { escritor, conteudo } = req.body; // Dados da carta a ser enviada

  try {
    // Criação da nova carta
    const novaCarta = new Carta({
      escritor,
      conteudo,
      tipo: 'carta',
      respondida: false,
      respostas: []
    });

    // Salvar a carta no banco de dados
    await novaCarta.save();

    // Atualizar o campo "cartasEnviadas" do usuário
    const usuario = await Usuario.findById(escritor);
    usuario.cartasEnviadas.push(novaCarta._id);
    await usuario.save();

    res.status(201).json(novaCarta); // Retorna a carta criada no banco
  } catch (err) {
    console.error('Erro ao enviar carta:', err);
    res.status(400).json({ error: err.message }); // Em caso de erro
  }
});

//Excluir cartas
app.delete('/api/cartas', async (req, res) => {
  const { ids } = req.body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'IDs inválidos ou não fornecidos.' });
  }

  try {
      await Carta.deleteMany({ _id: { $in: ids } });
      res.status(200).json({ message: 'Cartas excluídas com sucesso.' });
  } catch (error) {
      console.error('Erro ao excluir cartas:', error);
      res.status(500).json({ error: 'Erro interno ao excluir cartas.' });
  }
});

//Pegar cartas enviadas
app.get('/api/caixa-entrada/:userId', async (req, res) => {
  const { userId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'ID de usuário inválido.' });
  }

  try {
      const cartas = await Carta.find({ destinatario: userId, tipo: 'resposta' }).populate('escritor', 'nome');
      res.status(200).json(cartas);
  } catch (error) {
      console.error('Erro ao buscar cartas na caixa de entrada:', error);
      res.status(500).json({ error: 'Erro interno ao buscar cartas.' });
  }
});


