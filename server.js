// server.js - Servidor HTTP do zero com Node.js puro (sem frameworks)

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// spawn executa um processo filho (outro programa) a partir do Node
// Usamos para rodar checker.js sem precisar de um terminal separado
import { spawn } from 'node:child_process'

// Mapa extensao -> Content-Type (MIME type)
// O navegador usa esse cabecalho para saber como interpretar o arquivo
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
}

// Em ES Modules nao existe __dirname - precisamos reconstrui-lo
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Porta: lida do argumento de linha de comando ou usa 3000 como padrao
const PORTA = process.argv[2] || 3000

// http.createServer() cria o servidor e define o callback de cada requisicao
// req = dados que chegam DO navegador | res = o que enviamos DE VOLTA
const server = http.createServer((req, res) => {

  // =================================================================
  // ROTA 1: POST /verificar
  // Dispara o checker.js como processo filho e aguarda terminar.
  // O frontend chama essa rota ao clicar em "Verificar Agora".
  // =================================================================
  if (req.method === 'POST' && req.url === '/verificar') {

    // spawn('node', ['checker.js']) cria um subprocesso que roda checker.js
    // O servidor continua respondendo outras requisicoes enquanto ele executa
    const proc = spawn('node', ['checker.js'], {
      cwd: __dirname // define a pasta de trabalho do subprocesso
    })

    // Acumula a saida do terminal do checker para enviar ao navegador
    let saida = ''
    proc.stdout.on('data', chunk => { saida += chunk.toString() })
    proc.stderr.on('data', chunk => { saida += chunk.toString() })

    // Evento 'close' dispara quando o processo filho termina
    // 'code' e o codigo de saida: 0 = sucesso, qualquer outro = erro
    proc.on('close', code => {
      if (code === 0) {
        // Sucesso: avisa o frontend que pode buscar /resultados
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true, log: saida }))
      } else {
        // Falha: envia o log de erro para o frontend exibir
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false, log: saida }))
      }
    })

    return // encerra aqui, sem cair nas proximas rotas
  }

  // =================================================================
  // ROTA 2: GET /resultados
  // Serve o arquivo resultados.json gerado pelo checker.js
  // =================================================================
  if (req.url === '/resultados') {
    try {
      const dados = fs.readFileSync('resultados.json', 'utf8')
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      })
      res.end(dados)
    } catch {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ erro: 'Nenhuma verificacao realizada ainda.' }))
    }
    return
  }

  // =================================================================
  // ROTA 3: arquivos estaticos da pasta public/
  // Qualquer outra URL e mapeada para um arquivo em public/
  // =================================================================
  const urlPath = req.url === '/' ? '/index.html' : req.url
  const arquivo = path.join(__dirname, 'public', urlPath)
  const ext  = path.extname(arquivo)
  const mime = MIME[ext] || 'text/plain'

  try {
    const conteudo = fs.readFileSync(arquivo)
    res.writeHead(200, { 'Content-Type': mime })
    res.end(conteudo)
  } catch {
    res.writeHead(404)
    res.end('Nao encontrado: ' + urlPath)
  }
})

// server.listen inicia o servidor na porta definida
server.listen(PORTA, () => {
  console.log('Servidor rodando em http://localhost:' + PORTA)
  console.log('Dados JSON em  http://localhost:' + PORTA + '/resultados')
})
