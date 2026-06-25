// checker.js - Validador de Links via terminal (CLI)
// Le uma lista de URLs de um arquivo .txt, testa cada uma
// com o metodo HTTP HEAD e salva o resultado em JSON

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import fs from 'node:fs'
import https from 'node:https'
import http from 'node:http'

// ============================================================
// BLOCO 1: Argumentos de linha de comando com yargs
// ============================================================

// yargs le os argumentos digitados no terminal
// Ex: node checker.js --arquivo meus-links.txt
const argv = yargs(hideBin(process.argv))
  // --arquivo ou -a: caminho do arquivo de URLs (padrao: 'links.txt')
  .option('arquivo', {
    alias: 'a',
    description: 'Arquivo com lista de URLs',
    default: 'links.txt'
  })
  // .help() adiciona automaticamente o flag --help
  .help()
  .argv

// ============================================================
// BLOCO 2: Leitura e processamento do arquivo de URLs
// ============================================================

// Le o arquivo inteiro como texto (utf8), de forma sincrona
const conteudo = fs.readFileSync(argv.arquivo, 'utf8')

// Processa o texto linha a linha:
// .split('\n')     -> divide em array pela quebra de linha
// .map(trim)       -> remove espacos e \r no inicio/fim
// .filter(Boolean) -> remove linhas vazias
const urls = conteudo
  .split('\n')
  .map(linha => linha.trim())
  .filter(Boolean)

console.log('\n URLs encontradas em "' + argv.arquivo + '": ' + urls.length)

// ============================================================
// BLOCO 3: Funcao que verifica um unico link
// ============================================================

// Retorna uma Promise para podermos usar Promise.all() depois
function verificarLink(url) {
  return new Promise((resolve) => {

    // Escolhe o modulo correto pelo protocolo da URL
    const mod = url.startsWith('https') ? https : http

    // mod.request() faz a requisicao HTTP
    // method: 'HEAD' -> busca so os cabecalhos, sem baixar o corpo
    //   Muito mais rapido para checar se um link existe!
    // timeout: 5000  -> desiste se o servidor nao responder em 5 segundos
    const req = mod.request(url, { method: 'HEAD', timeout: 5000 }, (res) => {

      // res.statusCode -> codigo HTTP: 200=ok, 404=nao encontrado, 500=erro
      // Codigos abaixo de 400 sao considerados validos
      const info = { status: res.statusCode, ok: res.statusCode < 400 }

      // Spread operator: espalha as props de info no objeto final
      // Resultado: { url: 'https://...', status: 200, ok: true }
      resolve({ url, ...info })
    })

    // 'timeout' dispara quando o servidor nao responde no prazo definido
    // req.destroy() cancela a requisicao -> vai disparar o evento 'error'
    req.on('timeout', () => req.destroy())

    // 'error' cobre: timeout, DNS nao encontrado, conexao recusada, etc.
    req.on('error', () => resolve({ url, status: 0, ok: false }))

    // req.end() dispara a requisicao de fato
    req.end()
  })
}

// ============================================================
// BLOCO 4: Funcao principal
// ============================================================

async function main() {
  console.log('Verificando links...\n')

  // Promise.all() espera TODAS as verificacoes terminarem em paralelo
  // urls.map(verificarLink) cria uma Promise para cada URL
  const resultados = await Promise.all(urls.map(verificarLink))

  // Exibe cada resultado no terminal
  resultados.forEach(r => {
    const icone = r.ok ? '[OK]' : '[FALHA]'
    console.log(icone + ' ' + r.status + '  ' + r.url)
  })

  // Monta o relatorio final com spread operator
  const relatorio = {
    data: new Date().toISOString(),
    total: resultados.length,
    ...{ ok: resultados.filter(r => r.ok).length },
    links: resultados
  }

  // Salva o JSON no disco para o servidor servir ao frontend
  fs.writeFileSync('resultados.json', JSON.stringify(relatorio, null, 2))

  console.log('\nConcluido! ' + relatorio.ok + '/' + relatorio.total + ' links validos')
  console.log('Salvo em resultados.json')
}

main()
