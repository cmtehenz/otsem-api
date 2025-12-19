# OTSEM API

A NestJS backend API for financial services including PIX payments, customer management, and multi-bank integration.

## Overview

This is a backend-only NestJS API that provides:
- User authentication (JWT-based)
- Customer management with KYC
- PIX payment processing
- Multi-bank integration (Inter, FDBank)
- OKX crypto exchange integration
- Wallet management

## Tech Stack

- **Framework**: NestJS 11
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Passport JWT
- **API Docs**: Swagger (available at `/api/docs`)

## Environment Variables

### Required
- `DATABASE_URL` - PostgreSQL connection string (auto-configured by Replit)
- `JWT_SECRET` - Secret for JWT token signing

### Optional (External Services)
- `RESEND_API_KEY` - For email sending (password reset)
- `INTER_CLIENT_ID`, `INTER_CLIENT_SECRET` - Banco Inter API credentials
- `INTER_CERT_PATH`, `INTER_KEY_PATH` - Banco Inter certificate paths
- `FDBANK_API_KEY`, `FDBANK_API_SECRET` - FDBank API credentials
- `OKX_API_KEY`, `OKX_API_SECRET`, `OKX_API_PASSPHRASE` - OKX exchange credentials
- `DIDIT_API_KEY`, `DIDIT_WORKFLOW_ID` - Didit KYC verification API

## Running Locally

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run start:dev
```

## API Documentation

Available at `http://localhost:5000/api/docs` when running.

## Project Structure

- `src/` - Application source code
  - `auth/` - Authentication module
  - `users/` - User management
  - `customers/` - Customer management with KYC
  - `didit/` - Didit KYC verification integration
  - `inter/` - Banco Inter integration
  - `fdbank/` - FDBank integration
  - `okx/` - OKX exchange integration
  - `payments/` - Payment processing
  - `transactions/` - Unified transaction management (PIX_IN, PIX_OUT)
  - `wallet/` - Multi-network wallet management (Solana, Ethereum, Polygon, BSC, Tron, etc.)
  - `statements/` - Account statements
  - `admin-dashboard/` - Admin dashboard with stats and reports
  - `prisma/` - Prisma service
- `prisma/` - Database schema and migrations

## Data Model Architecture

### Unified Transaction Model (Dec 16, 2025)
The system uses a **unified Transaction model** for all PIX operations:
- **TransactionType**: PIX_IN (deposits), PIX_OUT (withdrawals), CONVERSION (BRL→USDT), TRANSFER, ADJUSTMENT, FEE, REVERSAL
- **TransactionStatus**: PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED, REVERSED

Transaction fields:
- `type` - Transaction type (PIX_IN, PIX_OUT, etc.)
- `status` - Current status
- `amount` - Transaction amount in BRL
- `txid` - Unique transaction ID for PIX (embedded in QR Code)
- `endToEnd` - End-to-end ID from bank
- `payerName`, `payerTaxNumber` - Payer information (for PIX_IN)
- `receiverName`, `receiverPixKey` - Receiver information (for PIX_OUT)
- `balanceBefore`, `balanceAfter` - Balance tracking
- `bankPayload` - Original bank webhook payload (JSON)

Legacy models (Deposit, Payment) are kept for backward compatibility.

## Recent Changes (Dec 2025)

### CONVERSION Transaction Type (Dec 19)
- Added `CONVERSION` to TransactionType enum for BRL→USDT conversions
- `POST /wallet/buy-usdt-with-brl` now records transactions as `CONVERSION` type
- This differentiates conversions from regular `PIX_OUT` payments
- SendPixDto now accepts optional `transactionType` parameter

### PIX Polling & Automatic Reconciliation (Dec 19)
- **Automatic polling every 1 minute**: Checks Inter API for paid PIX charges
- **Smart customer identification**: 3 methods to find the customer:
  1. Extract shortId from txid (format: OTSEM + customerId + timestamp)
  2. Find existing PENDING transaction by txid
  3. If only 1 customer exists, assign automatically
- **Reconciliation endpoints** (Admin only):
  - `GET /inter/pix/cobrancas?dias=7` - List PIX charges from last N days
  - `POST /inter/pix/reconciliar?dias=7` - Process unpaid charges and credit accounts
- Updates existing PENDING transactions instead of creating duplicates

### Transactions API Endpoint (Dec 19)
- `GET /transactions?limit=6` - List customer transactions with optional limit
- Returns type (PIX_IN/PIX_OUT), amount, description, payerName, createdAt

### PIX Key Validation via Micro-Transfer (Dec 19)
New endpoint to validate PIX keys by sending R$ 0,01:
- `POST /inter/pix/validar-chave/:pixKeyId` - Validates a PIX key by micro-transfer

Validation flow:
1. Sends R$ 0,01 to the PIX key via Banco Inter
2. If successful, checks if destination CPF/CNPJ matches customer's registration
3. If matches, marks the key as `validated = true`
4. This operation can only be done **ONCE per key**

PixKey model now includes additional validation fields:
- `validationAttempted` (boolean) - true if micro-transfer was attempted
- `validationAttemptedAt` (DateTime) - when validation was attempted
- `validationTxId` (string) - endToEnd ID of the validation transfer
- `validationError` (string) - error message if validation failed

### PIX Key Management with Auto-Validation (Dec 19)
New endpoints for managing PIX keys with automatic validation:
- `GET /pix-keys` - List customer's PIX keys with validation status
- `POST /pix-keys` - Create new PIX key with automatic validation
- `DELETE /pix-keys/:id` - Delete PIX key

PixKey model now includes:
- `validated` (boolean) - true if key belongs to customer's CPF/CNPJ
- `validatedAt` (DateTime) - when validation occurred

Auto-validation rules:
- CPF key: validated if matches customer's CPF
- CNPJ key: validated if matches customer's CNPJ
- EMAIL key: validated if matches customer's email
- PHONE key: validated if matches customer's phone
- RANDOM key: requires manual validation

### PIX Send Validation (Dec 19)
- **KYC Required**: `accountStatus` must be `approved` to send PIX
- **Same CPF/CNPJ**: PIX can only be sent to validated keys (or directly to CPF/CNPJ)
- **Balance Check**: Validates sufficient balance before sending
- **Limits Check**: Daily and monthly limits validated
- Uses PixKey.validated field for faster validation
- Fallback to direct CPF/CNPJ comparison if key not registered
- Clear error messages for each validation failure

### Unified Transaction Model Refactoring (Dec 16)
- Migrated from separate Deposit/Payment models to unified Transaction model
- New fields: payerName, payerTaxNumber, receiverName, receiverPixKey, endToEnd, txid
- InterWebhookService now creates and updates Transaction records directly
- InterPixService creates Transaction with status PENDING when generating QR Code
- AdminDashboardService updated to query Transaction model for statistics
- Better tracking with balanceBefore/balanceAfter on every transaction

### Automatic PIX Deposit with Customer Identification (Dec 15)
- **QR Code generation with customer tracking**: `POST /inter/pix/cobrancas`
  - Generates unique `txid` with customer ID embedded (format: otsem + shortId + timestamp)
  - Creates Transaction record with status PENDING and `externalId = txid`
  - When PIX is paid, webhook identifies customer by txid and credits automatically
- **Automatic deposit crediting via webhook**: `POST /inter/webhooks/receive/pix`
  - Finds pending Transaction by txid
  - Verifies payment amount matches requested amount (rejects mismatches)
  - Credits customer account automatically
  - Updates Transaction to COMPLETED with balance tracking
  - PIX without linked customer saved as PENDING for manual review

### Previous Changes
- **Didit KYC Integration**: Integrated Didit API for identity verification
  - New `didit/` module with service, controller, DTOs
  - Customer model extended with `diditSessionId` and `diditVerificationUrl`
  - KYC request creates Didit session and returns verification URL
  - Webhook endpoint at `POST /didit/webhooks/verification` receives verification results
  - KYC status endpoint at `GET /customers/:id/kyc/status` fetches Didit decision
- Wallet system now supports multiple wallets per customer across different blockchain networks
- Added WalletNetwork enum: SOLANA, ETHEREUM, POLYGON, BSC, TRON, BITCOIN, AVALANCHE, ARBITRUM, OPTIMISM, BASE
- New wallet endpoints: import, set-main, update label, delete
- Unique constraint: [customerId, network, externalAddress]
