<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

# 🏦 OTSEM Bank API

API REST completa para gestão de Banking as a Service (BaaS) integrada com BRX Bank.

## 📋 Índice

- [Tecnologias](#-tecnologias)
- [Funcionalidades](#-funcionalidades)
- [Instalação](#-instalação)
- [Configuração](#%EF%B8%8F-configuração)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Autenticação](#-autenticação)
- [Endpoints](#-endpoints)
  - [Auth](#auth)
  - [Users](#users)
  - [Customers](#customers)
  - [Accreditation](#accreditation)
  - [Pix](#pix)
  - [Pix Transactions](#pix-transactions)
  - [Statements](#statements)
- [Webhooks BRX](#-webhooks-brx)
- [Testes](#-testes)
- [Deploy](#-deploy)

---

## 🚀 Tecnologias

- **NestJS** - Framework Node.js progressivo
- **TypeScript** - Superset JavaScript com tipagem estática
- **Prisma** - ORM moderno para Node.js
- **PostgreSQL** - Banco de dados relacional
- **JWT** - Autenticação via tokens
- **BRX Bank API** - Integração com Banking as a Service
- **class-validator** - Validação de DTOs
- **Axios** - Cliente HTTP para integração com BRX

---

## ✨ Funcionalidades

### 🔐 Autenticação e Usuários

- ✅ Registro de usuários (CUSTOMER/ADMIN)
- ✅ Login com JWT
- ✅ Recuperação de senha via e-mail
- ✅ Guards de autenticação e autorização por roles

### 👥 Gestão de Clientes

- ✅ Cadastro de Pessoa Física (PF) e Jurídica (PJ)
- ✅ Cadastro self-service (customer)
- ✅ Aprovação/rejeição de KYC (admin)
- ✅ Listagem com auto-scope (customer vê só o dele)
- ✅ Estatísticas de clientes (admin)

### 🎫 Credenciamento BRX

- ✅ Credenciar PF/PJ na BRX
- ✅ Consultar credenciamento por ID/CPF/CNPJ
- ✅ Sincronizar status com BRX
- ✅ Integração automática ao aprovar customer

### 💳 Pix

- ✅ Criar/listar chaves Pix
- ✅ Precheck de chaves externas
- ✅ Gestão de limites Pix
- ✅ Histórico de transações

### 💸 Transações Pix

- ✅ Transferências Pix entre contas
- ✅ Consultar status de transações
- ✅ Extrato de movimentações

### 💰 Saldo e Extrato

- ✅ Consultar saldo disponível/bloqueado
- ✅ Extrato com paginação e filtros de data
- ✅ Validação de ownership (customer só vê o próprio)

### 🔔 Webhooks

- ✅ Receber notificações BRX (credenciamento, Pix, etc.)
- ✅ Atualização automática de status

---

## 📦 Instalação

```bash
# Clonar repositório
git clone https://github.com/seu-usuario/otsem-api.git
cd otsem-api

# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env

# Configurar banco de dados
npx prisma migrate dev
npx prisma generate

# Seed inicial (opcional)
npx prisma db seed
```

---

## ⚙️ Configuração

### Variáveis de Ambiente

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/otsem_db"

# JWT
JWT_SECRET="seu-secret-super-seguro-aqui"
JWT_EXPIRES_IN="7d"

# BRX Bank API
BRX_API_URL="https://apisbank.brxbank.com.br"
BRX_CLIENT_ID="seu-client-id-brx"
BRX_CLIENT_SECRET="seu-client-secret-brx"

# Email (SMTP)
MAIL_HOST="smtp.gmail.com"
MAIL_PORT=587
MAIL_USER="seu-email@gmail.com"
MAIL_PASSWORD="sua-senha-app"
MAIL_FROM="noreply@otsembank.com"

# Frontend URL (para CORS e redirecionamentos)
FRONTEND_URL="https://www.otsempay.com"

# Porta da aplicação
PORT=3333
```

---

## 📁 Estrutura do Projeto

```
src/
├── @types/                    # Definições TypeScript customizadas
├── accreditation/             # Credenciamento BRX (PF/PJ)
│   ├── accreditation.controller.ts
│   ├── accreditation.service.ts
│   ├── accreditation.module.ts
│   ├── dto/
│   └── types/
├── admin-dashboard/           # Métricas e agregações (admin)
│   ├── admin-dashboard.controller.ts
│   ├── admin-dashboard.service.ts
│   └── admin-dashboard.module.ts
├── auth/                      # Autenticação JWT
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   ├── roles.guard.ts
│   │   └── owner-or-admin.guard.ts
│   ├── dto/
│   └── strategies/
├── brx/                       # Serviços BRX (auth, Pix)
│   ├── brx-auth.service.ts
│   ├── brx-auth.module.ts
│   └── brx-pix.module.ts
├── brx-webhooks/              # Webhooks BRX
│   ├── brx-webhooks.controller.ts
│   ├── brx-webhooks.service.ts
│   └── brx-webhooks.module.ts
├── customers/                 # Gestão de clientes (PF/PJ)
│   ├── customers.controller.ts
│   ├── customers.service.ts
│   ├── customers.module.ts
│   └── dto/
├── mail/                      # Envio de e-mails
│   ├── mail.service.ts
│   ├── mail.module.ts
│   └── templates/
├── pix/                       # Chaves e limites Pix
│   ├── pix.controller.ts
│   ├── pix.service.ts
│   ├── pix.module.ts
│   ├── limits/
│   └── dtos/
├── pix-transactions/          # Transferências Pix
│   ├── pix-transactions.controller.ts
│   ├── pix-transactions.service.ts
│   ├── pix-transactions.module.ts
│   └── dto/
├── prisma/                    # ORM Prisma
│   ├── prisma.service.ts
│   └── prisma.module.ts
├── statements/                # Saldo e extrato
│   ├── statements.controller.ts
│   ├── statements.service.ts
│   └── statements.module.ts
├── users/                     # Gestão de usuários
│   ├── users.controller.ts
│   ├── users.service.ts
│   ├── users.module.ts
│   └── dto/
├── app.module.ts              # Módulo raiz
└── main.ts                    # Bootstrap da aplicação
```

---

## 🔐 Autenticação

### Sistema de Roles

```typescript
enum Role {
  CUSTOMER  // Cliente comum
  ADMIN     // Administrador
}
```

### Como usar

```typescript
// Proteger rota com JWT
@UseGuards(JwtAuthGuard)

// Proteger rota com role específica
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)

// Múltiplas roles
@Roles(Role.ADMIN, Role.CUSTOMER)
```

### Headers de Autenticação

```bash
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 📡 Endpoints

### Auth

#### **POST** `/auth/register`

Registrar novo usuário.

```bash
curl -X POST https://api.otsembank.com/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "joao@exemplo.com",
    "password": "Senha@123",
    "role": "CUSTOMER"
  }'
```

**Response:**

```json
{
  "user": {
    "id": "uuid",
    "email": "joao@exemplo.com",
    "role": "CUSTOMER"
  },
  "access_token": "eyJhbGc..."
}
```

---

#### **POST** `/auth/login`

Login de usuário.

```bash
curl -X POST https://api.otsembank.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "joao@exemplo.com",
    "password": "Senha@123"
  }'
```

**Response:**

```json
{
  "access_token": "eyJhbGc...",
  "user": {
    "id": "uuid",
    "email": "joao@exemplo.com",
    "role": "CUSTOMER"
  }
}
```

---

#### **POST** `/auth/forgot-password`

Solicitar redefinição de senha.

```bash
curl -X POST https://api.otsembank.com/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "joao@exemplo.com"
  }'
```

---

#### **POST** `/auth/reset-password`

Redefinir senha com token.

```bash
curl -X POST https://api.otsembank.com/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "token": "token-recebido-por-email",
    "password": "NovaSenha@123"
  }'
```

---

### Users

#### **GET** `/users/me`

Retorna dados do usuário autenticado.

```bash
curl https://api.otsembank.com/users/me \
  -H "Authorization: Bearer TOKEN"
```

**Response:**

```json
{
  "id": "uuid",
  "email": "joao@exemplo.com",
  "role": "CUSTOMER",
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

---

### Customers

#### **GET** `/customers`

Listar customers (auto-scope por role).

```bash
# CUSTOMER: vê apenas o próprio
# ADMIN: vê todos

curl https://api.otsembank.com/customers?page=1&limit=50 \
  -H "Authorization: Bearer TOKEN"
```

**Query params:**

- `page` (int, default: 1)
- `limit` (int, max: 100, default: 50)
- `accountStatus` (enum: `not_requested`, `requested`, `in_review`, `approved`, `rejected`)
- `type` (enum: `PF`, `PJ`)
- `hasAccreditation` (boolean)

**Response:**

```json
{
  "data": [
    {
      "id": "uuid",
      "type": "PF",
      "accountStatus": "approved",
      "name": "João Silva",
      "cpf": "12345678901",
      "email": "joao@exemplo.com",
      "phone": "11999999999",
      "externalAccredId": "abc123",
      "externalClientId": "xyz789",
      "address": { ... },
      "pixLimits": { ... }
    }
  ],
  "total": 10,
  "page": 1,
  "limit": 50
}
```

---

#### **GET** `/customers/me`

Retorna customer do usuário logado.

```bash
curl https://api.otsembank.com/customers/me \
  -H "Authorization: Bearer TOKEN"
```

---

#### **GET** `/customers/:id`

Buscar customer por ID (valida ownership).

```bash
curl https://api.otsembank.com/customers/572aac8c-949e-40d5-8b87-66cc164e9000 \
  -H "Authorization: Bearer TOKEN"
```

---

#### **GET** `/customers/:id/balance`

Consultar saldo do customer.

```bash
curl https://api.otsembank.com/customers/572aac8c-949e-40d5-8b87-66cc164e9000/balance \
  -H "Authorization: Bearer TOKEN"
```

**Response:**

```json
{
  "accountHolderId": "xyz789",
  "availableBalance": 1500.5,
  "blockedBalance": 200.0,
  "totalBalance": 1700.5,
  "currency": "BRL",
  "updatedAt": "2025-11-10T20:00:00Z"
}
```

---

#### **GET** `/customers/:id/statement`

Consultar extrato do customer.

```bash
curl "https://api.otsembank.com/customers/572aac8c-949e-40d5-8b87-66cc164e9000/statement?page=1&limit=20&startDate=2025-01-01&endDate=2025-11-10" \
  -H "Authorization: Bearer TOKEN"
```

**Response:**

```json
{
  "statements": [
    {
      "transactionId": "tx123",
      "type": "PIX_IN",
      "amount": 150.0,
      "description": "Recebimento Pix",
      "createdAt": "2025-11-10T15:30:00Z",
      "status": "COMPLETED"
    }
  ],
  "total": 25,
  "page": 1,
  "limit": 20
}
```

---

#### **GET** `/customers/stats` 🔒 ADMIN

Estatísticas de customers.

```bash
curl https://api.otsembank.com/customers/stats \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

**Response:**

```json
{
  "total": 150,
  "byStatus": {
    "approved": 100,
    "requested": 30,
    "in_review": 10,
    "rejected": 5,
    "not_requested": 5
  },
  "byType": {
    "PF": 120,
    "PJ": 30
  }
}
```

---

#### **GET** `/customers/by-tax/:tax` 🔒 ADMIN

Buscar customer por CPF/CNPJ.

```bash
curl https://api.otsembank.com/customers/by-tax/12345678901 \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

---

#### **POST** `/customers/pf/self` 🔒 CUSTOMER

Cadastro self-service PF.

```bash
curl -X POST https://api.otsembank.com/customers/pf/self \
  -H "Authorization: Bearer CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "CLT001",
    "productId": 1,
    "person": {
      "name": "João Silva",
      "cpf": "123.456.789-01",
      "birthday": "1990-05-15",
      "phone": "11999999999",
      "email": "joao@exemplo.com",
      "address": {
        "zipCode": "01001000",
        "street": "Rua Exemplo",
        "number": "100",
        "complement": "Apto 5",
        "neighborhood": "Centro",
        "cityIbgeCode": 3550308
      }
    },
    "pixLimits": {
      "singleTransfer": 1000,
      "daytime": 5000,
      "nighttime": 1000,
      "monthly": 20000,
      "serviceId": 1
    }
  }'
```

---

#### **POST** `/customers/submit-kyc` 🔒 CUSTOMER

Submeter documentos para KYC.

```bash
curl -X POST https://api.otsembank.com/customers/submit-kyc \
  -H "Authorization: Bearer CUSTOMER_TOKEN"
```

---

#### **POST** `/customers/pf` 🔒 ADMIN

Criar customer PF (admin).

```bash
curl -X POST https://api.otsembank.com/customers/pf \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ ... }' # Mesmo body do /pf/self
```

---

#### **POST** `/customers/pj` 🔒 ADMIN

Criar customer PJ (admin).

```bash
curl -X POST https://api.otsembank.com/customers/pj \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "EMP001",
    "productId": 1,
    "company": {
      "legalName": "Empresa Ltda",
      "tradeName": "Empresa",
      "cnpj": "12.345.678/0001-90",
      "phone": "1133334444",
      "email": "contato@empresa.com",
      "address": { ... }
    },
    "pixLimits": { ... },
    "ownerships": [
      {
        "name": "Sócio 1",
        "cpf": "12345678901",
        "percentage": 50.0
      }
    ]
  }'
```

---

#### **PATCH** `/customers/:id` 🔒 ADMIN ou OWNER

Atualizar customer.

```bash
curl -X PATCH https://api.otsembank.com/customers/572aac8c-949e-40d5-8b87-66cc164e9000 \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "11988887777",
    "address": {
      "zipCode": "01002000",
      "street": "Nova Rua",
      "number": "200",
      "neighborhood": "Bairro Novo",
      "cityIbgeCode": 3550308
    }
  }'
```

---

#### **PATCH** `/customers/:id/approve` 🔒 ADMIN

Aprovar KYC.

```bash
curl -X PATCH https://api.otsembank.com/customers/572aac8c-949e-40d5-8b87-66cc164e9000/approve \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

---

#### **PATCH** `/customers/:id/reject` 🔒 ADMIN

Rejeitar KYC.

```bash
curl -X PATCH https://api.otsembank.com/customers/572aac8c-949e-40d5-8b87-66cc164e9000/reject \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

---

#### **PATCH** `/customers/:id/review` 🔒 ADMIN

Colocar em revisão.

```bash
curl -X PATCH https://api.otsembank.com/customers/572aac8c-949e-40d5-8b87-66cc164e9000/review \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

---

#### **DELETE** `/customers/:id` 🔒 ADMIN

Deletar customer.

```bash
curl -X DELETE https://api.otsembank.com/customers/572aac8c-949e-40d5-8b87-66cc164e9000 \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

---

### Accreditation

#### **POST** `/accreditation/person` 🔒 ADMIN

Credenciar Pessoa Física na BRX.

```bash
curl -X POST https://api.otsembank.com/accreditation/person \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "CLT001",
    "productId": 1,
    "name": "João Silva",
    "cpf": "12345678901",
    "birthday": "1990-05-15",
    "phone": "11999999999",
    "email": "joao@exemplo.com",
    "address": { ... },
    "pixLimits": { ... }
  }'
```

**Response:**

```json
{
  "accreditationId": "abc123",
  "clientId": "xyz789",
  "accreditationStatus": "Aprovado",
  "accreditationStatusId": 2,
  "product": "Conta Digital",
  "productId": 1,
  "person": { ... },
  "pixLimits": { ... }
}
```

---

#### **POST** `/accreditation/company` 🔒 ADMIN

Credenciar Pessoa Jurídica na BRX.

```bash
curl -X POST https://api.otsembank.com/accreditation/company \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "EMP001",
    "productId": 1,
    "company": { ... },
    "pixLimits": { ... },
    "ownerships": [ ... ]
  }'
```

---

#### **GET** `/accreditation/id/:accreditationId` 🔒 ADMIN

Consultar credenciamento por ID.

```bash
curl https://api.otsembank.com/accreditation/id/abc123 \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

---

#### **GET** `/accreditation/brx/cpf/:cpf` 🔒 ADMIN

Consultar credenciamento direto na BRX por CPF (só funciona se credenciado por você).

```bash
curl https://api.otsembank.com/accreditation/brx/cpf/12345678901 \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

---

#### **GET** `/accreditation/customer/cpf/:cpf` 🔒 ADMIN

Consultar customer local + dados BRX por CPF.

```bash
curl https://api.otsembank.com/accreditation/customer/cpf/12345678901 \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

---

#### **POST** `/accreditation/sync/:customerId` 🔒 ADMIN

Sincronizar status do customer com a BRX.

```bash
curl -X POST https://api.otsembank.com/accreditation/sync/572aac8c-949e-40d5-8b87-66cc164e9000 \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

**Response:**

```json
{
  "customerId": "572aac8c-949e-40d5-8b87-66cc164e9000",
  "previousStatus": "in_review",
  "currentStatus": "approved",
  "brxStatus": "Aprovado",
  "brxStatusId": 2
}
```

---

### Pix

#### **GET** `/pix/keys`

Listar chaves Pix do customer.

```bash
curl https://api.otsembank.com/pix/keys \
  -H "Authorization: Bearer TOKEN"
```

---

#### **POST** `/pix/keys`

Criar nova chave Pix.

```bash
curl -X POST https://api.otsembank.com/pix/keys \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "keyType": "EMAIL",
    "keyValue": "joao@exemplo.com"
  }'
```

---

#### **POST** `/pix/precheck`

Validar chave Pix externa.

```bash
curl -X POST https://api.otsembank.com/pix/precheck \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "keyType": "CPF",
    "keyValue": "12345678901"
  }'
```

---

### Pix Transactions

#### **GET** `/pix-transactions`

Listar transações Pix.

```bash
curl https://api.otsembank.com/pix-transactions?page=1&limit=50 \
  -H "Authorization: Bearer TOKEN"
```

---

#### **POST** `/pix-transactions`

Realizar transferência Pix.

```bash
curl -X POST https://api.otsembank.com/pix-transactions \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100.50,
    "description": "Pagamento teste",
    "recipientKeyType": "CPF",
    "recipientKeyValue": "98765432100"
  }'
```

---

### Statements

#### **GET** `/statements/account-holders/:accountHolderId/balance`

Consultar saldo.

```bash
curl https://api.otsembank.com/statements/account-holders/xyz789/balance \
  -H "Authorization: Bearer TOKEN"
```

---

#### **GET** `/statements/account-holders/:accountHolderId`

Consultar extrato.

```bash
curl "https://api.otsembank.com/statements/account-holders/xyz789?page=1&limit=50&startDate=2025-01-01" \
  -H "Authorization: Bearer TOKEN"
```

---

## 🔔 Webhooks BRX

Endpoint para receber notificações da BRX.

#### **POST** `/brx-webhooks`

```bash
# BRX envia automaticamente para este endpoint
# Você deve configurar a URL no painel BRX:
# https://api.otsembank.com/brx-webhooks
```

**Eventos suportados:**

- `accreditation.approved` - Credenciamento aprovado
- `accreditation.rejected` - Credenciamento rejeitado
- `pix.received` - Pix recebido
- `pix.sent` - Pix enviado.
- `pix.failed` - Pix falhou.

---

## 🧪 Testes

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Coverage
npm run test:cov
```

---

## 🚀 Deploy

### Desenvolvimento

```bash
npm run start:dev
```

### Produção

```bash
# Build
npm run build

# Start
npm run start:prod
```

### Docker

```bash
# Build imagem
docker build -t otsem-api .

# Run container
docker run -p 3333:3333 --env-file .env otsem-api
```

### Deploy em VPS (Ubuntu)

```bash
# Conectar ao servidor
ssh deploy@seu-servidor.com

# Clonar repositório
git clone https://github.com/seu-usuario/otsem-api.git
cd otsem-api

# Instalar dependências
npm install

# Build
npm run build

# Configurar PM2
pm2 start dist/main.js --name otsem-api
pm2 save
pm2 startup
```

---

## 📝 Licença

MIT.

---

## 👥 Contato

- **Email**: suporte@otsembank.com
- **Documentação BRX**: https://integrator-docs.brxbank.com.br

---

## 🎯 Status das Integrações

| Módulo           | Status      | Observações        |
| ---------------- | ----------- | ------------------ |
| Auth             | ✅ Completo | JWT + Reset senha  |
| Customers        | ✅ Completo | PF/PJ + Auto-scope |
| Accreditation    | ✅ Completo | Integração BRX     |
| Pix Keys         | ✅ Completo | CRUD completo      |
| Pix Transactions | ✅ Completo | Transferências     |
| Statements       | ✅ Completo | Saldo + Extrato    |
| Webhooks         | ✅ Completo | Notificações BRX   |

---

**Desenvolvido com ❤️ usando NestJS + BRX Bank API**
