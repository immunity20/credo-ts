# Credo-TS Demo REST API Servers

This directory contains REST API versions of the Alice, Faber, and Verifier agents, providing a complete verifiable credentials to blockchain workflow.

## Overview

- **Alice** (Port 3001): Credential holder and prover
- **Faber** (Port 3002): Credential issuer
- **Verifier** (Port 3003): Proof verifier and blockchain gateway

## Architecture

```
Alice (3001) ←→ Faber (3002) ←→ Verifier (3003) ←→ Blockchain
     ↓              ↓               ↓              ↓
Credential      Credential      Proof         KPI Storage
 Holder          Issuer       Verifier       Smart Contract
```

## Quick Start

### 1. Install Dependencies

```bash
cd demo
npm install
```

### 2. Start All Servers

In separate terminals:

**Terminal 1 - Start Alice (Holder/Prover):**

```bash
npm run alice-server
```

Server runs on: `http://localhost:3001`

**Terminal 2 - Start Faber (Issuer):**

```bash
npm run faber-server
```

Server runs on: `http://localhost:3002`

**Terminal 3 - Start Verifier (Proof Verifier + Blockchain Gateway):**

```bash
npm run verifier-server
```

Server runs on: `http://localhost:3003`

### 3. Complete Credential Exchange Flow

#### Step 1: Create Connection

```bash
# Faber creates invitation
curl -X POST http://localhost:3002/connection/create-invitation

# Copy the invitationUrl from response, then Alice accepts it
curl -X POST http://localhost:3001/connection/receive-invitation \
  -H "Content-Type: application/json" \
  -d '{"invitationUrl": "PASTE_INVITATION_URL_HERE"}'
```

#### Step 2: Setup Faber for Credential Issuance

```bash
# Import DID for credential issuance
curl -X POST http://localhost:3002/did/import \
  -H "Content-Type: application/json" \
  -d '{"registry": "did:indy"}'
```

#### Step 3: Issue Credential

```bash
# Faber issues credential
curl -X POST http://localhost:3002/credentials/issue

# Alice accepts credential (check Alice console for credential ID)
curl -X POST http://localhost:3001/credentials/accept-offer \
  -H "Content-Type: application/json" \
  -d '{"credentialRecordId": "CREDENTIAL_ID_FROM_CONSOLE"}'
```

#### Step 4: Proof Exchange

```bash
# Faber requests proof
curl -X POST http://localhost:3002/proofs/request

# Alice provides proof (check Alice console for proof ID)
curl -X POST http://localhost:3001/proofs/accept-request \
  -H "Content-Type: application/json" \
  -d '{"proofRecordId": "PROOF_ID_FROM_CONSOLE"}'
```

## Server Details

### Alice Server (Port 3001)

- **Purpose**: Credential holder and proof provider
- **Key Functions**: Accept connections, receive credentials, provide proofs, send messages
- **Documentation**: See [REST_API_README.md](./REST_API_README.md)

### Faber Server (Port 3002)

- **Purpose**: Credential issuer and proof verifier
- **Key Functions**: Create invitations, import DIDs, issue credentials, request proofs
- **Documentation**: See [FABER_REST_API_README.md](./FABER_REST_API_README.md)

## New: Complete Verifiable Credentials to Blockchain Workflow

### 🚀 Automated Device Credential to Blockchain Flow

The system now supports a complete workflow from credential issuance to blockchain KPI submission:

#### Quick Automated Flow

```bash
# 1. Get device credential from Faber and submit KPIs to blockchain
curl -X POST http://localhost:3001/workflow/complete-flow \
  -H "Content-Type: application/json" \
  -d '{
    "mac": "AA:BB:CC:DD:EE:FF",
    "deviceId": "device-12345",
    "contractAddress": "0xYourContractAddress",
    "baseLine": 1000,
    "savings": 250
  }'

# 2. Complete proof exchange (manual steps)
curl -X POST http://localhost:3003/proofs/request
curl -X POST http://localhost:3001/proofs/accept-request \
  -d '{"proofRecordId": "PROOF_ID_FROM_LOGS"}'
```

#### What This Enables

- **Credential Issuance**: Alice gets verified device credentials from Faber
- **Proof Verification**: Alice proves credential ownership to Verifier
- **Blockchain Authorization**: Only verified users can submit KPIs to smart contract
- **Audit Trail**: Complete verifiable trail from credential to blockchain

### New API Endpoints

#### Alice Server (3001)

- `POST /verifier/connect-and-prove` - Connect to Verifier for proof exchange
- `POST /verifier/submit-kpis` - Submit KPIs to blockchain (requires verified proof)
- `POST /workflow/complete-flow` - End-to-end automated workflow

#### Verifier Server (3003)

- `POST /blockchain/set-kpis` - Submit KPIs to smart contract (with proof verification)
- All standard proof verification endpoints

### Security Model

1. **Credential Verification**: Faber issues cryptographically signed credentials
2. **Proof Authorization**: Only holders with verified proofs can submit KPIs
3. **Blockchain Immutability**: KPIs stored permanently on Sepolia testnet
4. **Event Logging**: All transactions logged with indexed events

For detailed workflow documentation, see [WORKFLOW_README.md](./WORKFLOW_README.md).

## API Endpoints Summary

### Alice Endpoints

| Method | Endpoint                           | Description                  |
| ------ | ---------------------------------- | ---------------------------- |
| GET    | `/health`                          | Check status                 |
| POST   | `/connection/receive-invitation`   | Accept connection invitation |
| POST   | `/message/send`                    | Send message                 |
| POST   | `/credentials/accept-offer`        | Accept credential offer      |
| POST   | `/credentials/decline-offer`       | Decline credential offer     |
| POST   | `/credentials/connect-and-request` | Get credential from Faber    |
| POST   | `/verifier/connect-and-prove`      | Connect to Verifier          |
| POST   | `/verifier/submit-kpis`            | Submit KPIs to blockchain    |
| POST   | `/workflow/complete-flow`          | Complete automated workflow  |
| POST   | `/proofs/accept-request`           | Accept proof request         |
| POST   | `/proofs/decline-request`          | Decline proof request        |
| GET    | `/credentials`                     | List all credentials         |
| GET    | `/proofs`                          | List all proofs              |
| POST   | `/shutdown`                        | Shutdown agent               |

### Faber Endpoints

| Method | Endpoint                        | Description                    |
| ------ | ------------------------------- | ------------------------------ |
| GET    | `/health`                       | Check status                   |
| POST   | `/connection/create-invitation` | Create connection invitation   |
| POST   | `/did/import`                   | Import DID for issuance        |
| POST   | `/credentials/issue`            | Issue credential               |
| POST   | `/proofs/request`               | Request proof                  |
| POST   | `/proofs/accept-presentation`   | Manually accept presentation   |
| GET    | `/proofs/{id}/verification`     | Get proof verification details |
| POST   | `/message/send`                 | Send message                   |
| GET    | `/connections`                  | List all connections           |
| GET    | `/credentials`                  | List all credentials           |
| GET    | `/proofs`                       | List all proofs                |
| GET    | `/credential-definition`        | Get credential definition      |
| POST   | `/shutdown`                     | Shutdown agent                 |

### Verifier Server (Port 3003)

**Server:** `VerifierRestServer.ts`
**Purpose:** Proof verification and blockchain gateway
**Start Command:** `pnpm verifier-server`

| Method | Endpoint                        | Description                    |
| ------ | ------------------------------- | ------------------------------ |
| GET    | `/health`                       | Check status                   |
| POST   | `/connection/create-invitation` | Create connection invitation   |
| POST   | `/proofs/request`               | Request proof                  |
| POST   | `/proofs/accept-presentation`   | Manually accept presentation   |
| GET    | `/proofs/{id}/verification`     | Get proof verification details |
| POST   | `/blockchain/set-kpis`          | Submit KPIs to blockchain      |
| GET    | `/blockchain/get-kpis`          | Get KPIs from blockchain       |
| POST   | `/message/send`                 | Send message                   |
| GET    | `/connections`                  | List all connections           |
| GET    | `/proofs`                       | List all proofs                |
| POST   | `/shutdown`                     | Shutdown agent                 |

**Note:** The `/blockchain/set-kpis` endpoint requires proof verification authorization. Clients must have successfully completed proof exchange before submitting KPIs.

## Event Handling

All three servers automatically handle incoming events and log them to the console:

- **Messages**: Displayed when received
- **Credential Offers** (Alice): ID logged for manual acceptance/decline
- **Proof Requests** (Alice): ID logged for manual acceptance/decline
- **Connection State Changes**: State updates logged
- **Blockchain Events** (Verifier): Smart contract interactions logged

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Error description",
  "details": "Detailed error message"
}
```

## Use Cases

### Web Applications

Integrate these REST APIs into web frontends for SSI wallet applications.

### Mobile Applications

Use the APIs from mobile apps for credential management.

### Integration Testing

Automate testing of credential exchange flows.

### Development & Debugging

Use tools like Postman or curl to manually test SSI interactions.

## Original CLI Versions

The original command-line versions are still available:

- `npm run alice` - Original Alice CLI
- `npm run faber` - Original Faber CLI

## Architecture

```
┌─────────────────┐    HTTP/REST    ┌─────────────────┐
│   Alice Server  │◄───────────────►│  Faber Server   │
│   (Port 3001)   │                 │   (Port 3002)   │
└─────────────────┘                 └─────────────────┘
         │                                   │
         │            DIDComm Protocol       │
         │◄─────────────────────────────────►│
         │                                   │
    ┌─────────┐                         ┌─────────┐
    │  Alice  │                         │  Faber  │
    │  Agent  │                         │  Agent  │
    └─────────┘                         └─────────┘
```

The REST servers act as wrappers around the underlying Credo-TS agents, exposing their functionality through HTTP endpoints while maintaining the DIDComm protocol communication between agents.

## Troubleshooting

1. **Port Conflicts**: If ports 3001 or 3002 are in use, modify the `port` property in the respective server files.

2. **Connection Issues**: Ensure both servers are running and check the console logs for connection status.

3. **Missing Dependencies**: Run `npm install` in the demo directory.

4. **DID Import Errors**: Make sure to import a DID before attempting credential issuance.

5. **Network Issues**: The servers use `localhost` by default. For external access, modify the host configuration.
