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
  - `wallet/` - Multi-network wallet management (Solana, Ethereum, Polygon, BSC, Tron, etc.)
  - `statements/` - Account statements
  - `prisma/` - Prisma service
- `prisma/` - Database schema and migrations

## Recent Changes (Dec 2025)

### Automatic PIX Deposit with Customer Identification (Dec 15)
- **QR Code generation with customer tracking**: `POST /inter/pix/cobrancas`
  - Generates unique `txid` with customer ID embedded (format: otsem + shortId + timestamp)
  - Creates `Deposit` record with status PENDING and `externalId = txid`
  - When PIX is paid, webhook identifies customer by txid and credits automatically
- **Automatic deposit crediting via webhook**: `POST /inter/webhooks/receive/pix`
  - Finds pending deposit by txid
  - Verifies payment amount matches requested amount (rejects mismatches)
  - Credits customer account automatically
  - Creates Transaction (PIX_IN) with balance tracking
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
