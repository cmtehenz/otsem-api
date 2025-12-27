# OTSEM API

## Overview

The OTSEM API is a NestJS backend designed for financial services, specializing in PIX payments, comprehensive customer management with KYC, and multi-bank as well as crypto exchange integrations. Its core purpose is to provide a robust and secure platform for managing financial transactions, user identities, and digital assets.

**Key Capabilities:**
- User Authentication (JWT)
- Customer Management & KYC (Didit integration)
- PIX Payment Processing (via Banco Inter)
- Multi-bank Integration (Banco Inter, FDBank)
- Cryptocurrency Exchange Integration (OKX for BRL to USDT conversions)
- Multi-network Wallet Management (Solana, Ethereum, Polygon, BSC, Tron, etc.)
- Affiliate System for commission-based earnings
- Admin dashboard for monitoring and analytics

The project aims to streamline financial operations, enhance user experience through automated processes like PIX key validation and micro-transfers, and provide a secure environment for digital asset management.

## User Preferences

I prefer iterative development and clear, concise explanations. Please ask before making major architectural changes or introducing new external dependencies. I value well-structured code and comprehensive testing.

## System Architecture

The system is built on **NestJS 11**, leveraging a modular architecture to separate concerns. **PostgreSQL** is used as the primary database, managed by **Prisma ORM**. Authentication is handled via **JWT tokens** using Passport.js. API documentation is generated with **Swagger**.

**Key Architectural Decisions & Features:**

-   **Unified Transaction Model**: A single `Transaction` model handles all financial movements (PIX_IN, PIX_OUT, CONVERSION) with detailed status tracking (`PENDING`, `COMPLETED`, `FAILED`), balance logging (`balanceBefore`, `balanceAfter`), and comprehensive metadata (payer/receiver info, bank payloads).
-   **Customer Management with KYC**: Integration with the **Didit API** for identity verification, allowing for secure customer onboarding and compliance.
-   **Multi-network Wallet System**: Supports various blockchain networks (Solana, Ethereum, Polygon, BSC, Tron) with capabilities for wallet creation, import, and management. Includes tracking for OKX whitelist status for withdrawals.
-   **PIX Integration**:
    -   **Automatic Reconciliation**: Polling of bank APIs for paid PIX charges and intelligent customer identification for automatic account crediting.
    -   **PIX Key Management**: Endpoints for listing, creating, and deleting PIX keys with an automated micro-transfer validation mechanism.
    -   **PIX Send Validation**: Strict checks for KYC status, valid PIX keys, sufficient balance, and adherence to transaction limits before processing outbound PIX payments.
-   **BRL to USDT Conversion Flow (BUY)**: Facilitates conversion from BRL to USDT using OKX exchange, with direct withdrawal to customer's specified wallet (Solana or Tron).
-   **USDT to BRL Conversion Flow (SELL)**: Customer sends USDT directly to OKX deposit address → System monitors deposits → Sells USDT for BRL → Credits BRL to customer's OTSEM account balance.
-   **Affiliate System**:
    -   Manages affiliate profiles, commission rates, and payouts.
    -   Automated commission calculation on BRL to USDT conversions.
    -   Admin and public endpoints for managing and tracking affiliate activities and earnings.
-   **Admin Endpoints**: Dedicated administration routes for managing affiliates, viewing conversion statistics, and monitoring system health.
-   **Design Patterns**: Emphasis on services, controllers, and DTOs as per NestJS best practices.

## External Dependencies

-   **Database**: PostgreSQL
-   **ORM**: Prisma
-   **Authentication**: Passport JWT
-   **Email Service**: Resend (for password resets)
-   **Banking APIs**:
    -   Banco Inter (for PIX payments and related services)
    -   FDBank
-   **KYC Verification**: Didit API
-   **Cryptocurrency Exchange**: OKX (for BRL to USDT conversions and withdrawals)

## Database Schema - Conversions Table

A tabela `conversions` armazena dados estruturados de todas as conversões BRL→USDT:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | String | ID único (cuid) |
| customerId | String | FK para Customer |
| accountId | String | FK para Account |
| brlCharged | Decimal(18,2) | BRL cobrado do cliente |
| brlExchanged | Decimal(18,2) | BRL enviado para OKX |
| spreadPercent | Decimal(6,4) | % do spread aplicado |
| spreadBrl | Decimal(18,2) | Lucro bruto (BRL) |
| usdtPurchased | Decimal(18,6) | USDT comprado na OKX |
| usdtWithdrawn | Decimal(18,6) | USDT enviado ao cliente |
| exchangeRate | Decimal(10,4) | Taxa de câmbio BRL/USDT |
| network | String | SOLANA ou TRON |
| walletAddress | String | Endereço de destino |
| okxOrderId | String | ID da ordem na OKX |
| okxWithdrawId | String | ID do saque na OKX |
| affiliateCommission | Decimal(18,2) | Comissão do afiliado |
| okxWithdrawFee | Decimal(18,6) | Taxa de saque OKX (USDT) |
| okxTradingFee | Decimal(18,2) | Taxa de trading OKX (BRL) |
| totalOkxFees | Decimal(18,2) | Total de taxas OKX (BRL) |
| grossProfit | Decimal(18,2) | Lucro bruto |
| netProfit | Decimal(18,2) | Lucro líquido |
| status | Enum | PENDING, PIX_SENT, USDT_BOUGHT, USDT_WITHDRAWN, COMPLETED, FAILED |

### Admin Spread Management
- `PATCH /admin/users/:id/spread` - Ajustar spread do cliente
- Body: `{ "spreadPercent": 0.95 }` (spread em %)
- O sistema converte automaticamente para spreadValue (0.95% → 0.9905)

## SELL Flow (USDT → BRL) - Depósito Direto OKX

O cliente envia USDT diretamente para endereço OKX e recebe BRL creditado no saldo OTSEM.

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/wallet/deposit-address?network=SOLANA\|TRON` | GET | Obtém endereço OKX para depósito USDT |
| `/wallet/quote-sell-usdt?usdtAmount=X&network=SOLANA\|TRON` | GET | Cotação: quanto BRL o cliente recebe por X USDT |
| `/wallet/sell-usdt-to-brl` | POST | Inicia venda USDT → BRL (body: { usdtAmount, network }) |
| `/wallet/process-sell/:conversionId` | POST | Processa venda após USDT recebido na OKX (admin) |
| `/wallet/pending-sell-deposits` | GET | Verifica depósitos pendentes na OKX (admin) |

### SELL Flow Status Progression
1. `PENDING` - Registro criado, aguardando depósito USDT na OKX
2. `USDT_RECEIVED` - USDT confirmado na OKX (opcional, pode processar direto)
3. `USDT_SOLD` - USDT vendido por BRL na OKX
4. `COMPLETED` - BRL creditado no saldo OTSEM do cliente

### Fee Model
- **Cliente paga apenas spread**: 0.95% (padrão, configurável por usuário)
- **netProfit = spreadBrl - totalOkxFees - affiliateCommission**