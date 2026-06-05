# Crypto Gateway

Gateway de pagamentos cripto com checkout, dashboard, carteiras por usuário, validação on-chain e fila simples de saques. A aplicação foi pensada para uso descentralizado e experimental: cada vendedor usa uma API key, cria cobranças e acompanha pagamentos, carteiras, saldos, saques e notificações pelo painel.

## Stack

- Frontend: Next.js, React, Tailwind CSS e Recharts.
- Backend: Express rodando em `app.js`.
- Banco: PostgreSQL (conexão via `DATABASE_URL` no `.env`).
- Blockchain: `ethers` com RPCs EVM configurados no `.env`.
- Workers:
  - `workers/paymentValidator.js` valida pagamentos pendentes.
  - `workers/withdrawalWorker.js` processa saques.

## Como Rodar

Instale as dependências:

```bash
npm install
```

Rode o frontend:

```bash
npm run dev
```

Rode a API e os workers em outro terminal:

```bash
npm run backend
```

Por padrão:

- Frontend: `http://localhost:3000`
- API: `http://localhost:8021`

## Variáveis de Ambiente

Crie um arquivo `.env` na raiz. Exemplo:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/crypto_gateway
PAYMENT_ENCRYPTION_KEY=uma_chave_hexadecimal_de_32_bytes

RONIN_RPC_URL=https://api.roninchain.com/rpc
ETHEREUM_RPC_URL=https://cloudflare-eth.com
POLYGON_RPC_URL=https://polygon-rpc.com
BSC_RPC_URL=https://bsc-dataseed.binance.org
AVALANCHE_RPC_URL=https://api.avax.network/ext/bc/C/rpc
BASE_RPC_URL=https://base.drpc.org

CHECKOUT_BASE_URL=http://localhost:3000
APP_BASE_URL=http://localhost:3000
NEXT_PUBLIC_API_BASE_URL=http://localhost:8021

SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=usuario@example.com
SMTP_PASS=senha_ou_app_password
SMTP_FROM="CryptoGateway <no-reply@example.com>"
```

`DATABASE_URL` define a conexão com o PostgreSQL. O banco e as tabelas são criados automaticamente na primeira execução.

`PAYMENT_ENCRYPTION_KEY` é usada para criptografar private keys salvas no banco. Não commite o `.env`.

`NEXT_PUBLIC_API_BASE_URL` é opcional. Se não existir, o frontend tenta usar o mesmo host aberto no navegador com a porta `8021`, o que ajuda quando o painel é acessado pelo celular na rede local.

`APP_BASE_URL` é usado pela recuperação de senha para montar o link enviado por e-mail, como `http://localhost:3000/reset-password?token=...`.

As variáveis `SMTP_*` configuram o envio dos e-mails de recuperação de senha. Sem elas, a API retorna erro controlado ao solicitar recuperação.

## Redes e Tokens Suportados

Os tokens aceitos ficam em:

```txt
config/supported-tokens.json
```

Formato:

```json
{
  "ronin": {
    "usdc": "0x..."
  },
  "base": {
    "usdc": "0x...",
    "usdt": "0x..."
  }
}
```

A rota pública:

```http
GET /supported-chains
```

retorna esse JSON para o checkout e para o dashboard. Para adicionar uma nova moeda, inclua o contrato no JSON e garanta que a rede tenha RPC configurado no `.env`.

## Ícones

O frontend tenta carregar ícones locais da pasta:

```txt
public/icons
```

Ele busca imagens por símbolo ou endereço, por exemplo:

```txt
public/icons/usdc.png
public/icons/base.svg
public/icons/0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.png
```

Se o ícone não existir, a interface mostra um fallback textual.

## Fluxo de Autenticação

O usuário cria uma conta pelo dashboard e depois gera API keys na tela de configurações.

Endpoints principais:

```http
POST /auth/register
POST /auth/login
POST /auth/api-keys
GET  /auth/api-keys/list
```

As rotas privadas usam:

```http
Authorization: Bearer <token>
```

As cobranças externas usam a `api_key` do vendedor.

## Criação de Pagamento

Existem dois modos.

### Pagamento Direto

O vendedor já informa rede e token:

```http
POST /create_payment
```

```json
{
  "amount": 10,
  "webhook_url": "https://exemplo.com/webhook",
  "api_key": "sua_api_key",
  "chain": "base",
  "token": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
}
```

A API retorna um checkout já apontando para a tela de pagamento.

### Checkout com Seleção de Rede e Moeda

O vendedor não informa rede nem token:

```json
{
  "amount": 10,
  "webhook_url": "https://exemplo.com/webhook",
  "api_key": "sua_api_key"
}
```

Nesse caso, a API cria uma sessão de checkout. O pagador escolhe a rede e a moeda pela interface. Depois disso, a aplicação cria o pagamento real e redireciona para o checkout padrão.

Se o pagador voltar e trocar a rede/moeda antes de pagar, o pagamento anterior é marcado como `superseded` e a nova escolha passa a ser validada.

## Reuso de Carteiras de Depósito

O gateway reutiliza carteiras de depósito por usuário, rede e token.

Ao criar um pagamento:

1. A API procura uma carteira livre do usuário para aquela rede/token.
2. Se existir e não houver pagamento ativo usando ela, a carteira é reutilizada.
3. A API salva o saldo atual da carteira em `balance_before`.
4. O validador só considera como pago o valor recebido acima desse saldo inicial.

Isso evita criar uma carteira nova para cada cobrança e reduz a quantidade de carteiras que precisam ser administradas.

## Validação de Pagamentos

O worker:

```bash
node workers/paymentValidator.js
```

verifica pagamentos com status `waiting-payment`.

Ele consulta o saldo do token na carteira de depósito e calcula:

```txt
saldo_atual - balance_before
```

Se o valor recebido for maior ou igual ao valor cobrado:

- o pagamento vira `paid`;
- o saldo do usuário é creditado;
- uma notificação de pagamento concluído é criada;
- o webhook é enviado, se existir.

Pagamentos vencidos viram `expired`.

## Carteiras

Cada usuário possui:

- uma `main wallet` EVM;
- várias carteiras de depósito.

A `main wallet` é usada para armazenar gas token e financiar carteiras de depósito quando um saque precisar de gas.

A tela `/wallet` mostra:

- endereço da main wallet;
- saldo nativo da main wallet por rede;
- carteiras de depósito;
- saldo do token em cada carteira;
- saldo de gas de cada carteira;
- paginação de 10 carteiras por página;
- lista de saques recentes.

Endpoint:

```http
GET /wallets
```

## Saques

Ao clicar em sacar, a API cria uma task:

```http
POST /withdrawals
```

```json
{
  "source_wallet_id": 1,
  "amount": 10,
  "destination_address": "0x..."
}
```

O worker:

```bash
node workers/withdrawalWorker.js
```

processa a task:

1. Verifica se a carteira de depósito tem saldo suficiente do token.
2. Estima o gas necessário.
3. Se a carteira de depósito não tiver gas, a main wallet envia gas para ela.
4. Depois envia o token para o endereço de destino.
5. Atualiza o status conforme o resultado.

Status internos de saque:

- `pending`
- `checking`
- `funding_gas`
- `gas_sent`
- `withdrawing`
- `withdraw_tx_sent`
- `completed`
- `failed`

Na interface, esses status são traduzidos para português. Saques concluídos exibem o hash da transação e botão de copiar.

## Notificações

O sino no dashboard mostra notificações persistidas no banco.

Eventos gerados:

- pagamento concluído;
- saque concluído;
- saque falhou.

Endpoints:

```http
GET  /notifications
POST /notifications/read
```

Ao abrir o sino, as notificações não lidas são marcadas como lidas.

## Dashboard

Rotas do painel:

- `/home`: dashboard principal;
- `/wallet`: carteiras e saques;
- `/transactions`: histórico de pagamentos;
- `/settings`: configurações e API keys.

As abas usam rotas reais, então atualizar a página mantém o usuário na tela atual.

O dashboard mostra:

- saldo recebido total;
- saldos por token/rede;
- gráfico de recebimentos;
- filtros de período;
- últimos pagamentos confirmados;
- notificações.

## Endpoints Principais

Autenticação:

```http
POST /auth/register
POST /auth/login
POST /auth/api-keys
GET  /auth/api-keys/list
```

Pagamentos e checkout:

```http
POST /create_payment
GET  /checkout/:paymentId
POST /checkout/:paymentId/select
GET  /payments
GET  /balance
GET  /analytics
```

Carteiras e saques:

```http
GET  /wallets
POST /withdrawals
GET  /withdrawals
```

Configuração pública:

```http
GET /supported-chains
```

Notificações:

```http
GET  /notifications
POST /notifications/read
```

## Pré-requisitos

Antes de rodar o backend, crie o banco no PostgreSQL:

```bash
createdb crypto_gateway
```

## Banco de Dados

O projeto usa PostgreSQL. A conexão é configurada via `DATABASE_URL` no `.env`.

Tabelas principais:

- `users`
- `auth_tokens`
- `api_keys`
- `checkout_sessions`
- `payments`
- `balances`
- `deposit_wallets`
- `main_wallets`
- `withdrawal_tasks`
- `notifications`

As migrações simples são feitas automaticamente ao importar as rotas da API ou iniciar os workers.

## Observações de Segurança

Este projeto armazena private keys criptografadas no PostgreSQL. Para uso real em produção, seria recomendado evoluir para:

- armazenamento de chaves em KMS/HSM ou vault;
- segregação entre API, workers e banco;
- autenticação mais robusta;
- rate limit;
- logs auditáveis;
- monitoramento de filas;
- política clara de rotação de chaves;
- validações extras contra RPC inconsistente.

O projeto atual é adequado para estudo, protótipo e uso controlado, mas não deve ser tratado como infraestrutura pronta para custodiar valores altos.

## Validação

Comandos úteis:

```bash
npm run lint
node --check api/routes/payment.js
node --check workers/paymentValidator.js
node --check workers/withdrawalWorker.js
```

O `typecheck` pode acusar pendências em componentes UI não relacionados ao fluxo principal, dependendo do estado atual das dependências do projeto.
