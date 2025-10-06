# Complete Verifiable Credentials to Blockchain Workflow

This guide explains the complete workflow from credential issuance to blockchain KPI submission with proof verification.

## Architecture Overview

```
Alice (3001) ←→ Faber (3002) ←→ Verifier (3003) ←→ Blockchain
     ↓              ↓               ↓              ↓
Credential      Credential      Proof         KPI Storage
 Holder          Issuer       Verifier       Smart Contract
```

## Components

- **Alice (Port 3001)**: Credential holder and prover
- **Faber (Port 3002)**: Credential issuer
- **Verifier (Port 3003)**: Proof verifier and blockchain gateway
- **Smart Contract**: KPI storage on Sepolia testnet

## Complete Workflow

### Step 1: Start All Servers

```bash
# Terminal 1 - Alice Server
npm run alice-server

# Terminal 2 - Faber Server
npm run faber-server

# Terminal 3 - Verifier Server
npm run verifier-server
```

### Step 2: Get Credential from Faber

Alice requests a credential with device information:

```bash
curl -X POST http://localhost:3001/credentials/connect-and-request \
  -H "Content-Type: application/json" \
  -d '{
    "mac": "AA:BB:CC:DD:EE:FF",
    "deviceId": "device-12345"
  }'
```

**What happens:**

- Alice connects to Faber
- Faber imports DID for credential issuance
- Credential is issued with MAC, deviceId, and SHA-256 hash
- Alice auto-accepts the credential

### Step 3: Connect to Verifier

Alice establishes connection with the Verifier:

```bash
curl -X POST http://localhost:3001/verifier/connect-and-prove \
  -H "Content-Type: application/json" \
  -d '{}'
```

**What happens:**

- Alice connects to Verifier (port 3003)
- Connection established for proof exchange
- Alice is ready to receive proof requests

### Step 4: Request Proof (Verifier Side)

The Verifier requests proof from Alice:

```bash
curl -X POST http://localhost:3003/proofs/request \
  -H "Content-Type: application/json" \
  -d '{}'
```

**What happens:**

- Verifier sends proof request to Alice
- Alice receives proof request notification
- Alice needs to accept the proof request

### Step 5: Accept Proof Request (Alice Side)

Alice accepts and presents the proof:

```bash
# Get the proof ID from Alice console logs, then:
curl -X POST http://localhost:3001/proofs/accept-request \
  -H "Content-Type: application/json" \
  -d '{
    "proofRecordId": "PROOF_ID_FROM_LOGS"
  }'
```

**What happens:**

- Alice presents proof containing the credential
- Verifier receives and automatically verifies the proof
- Proof is marked as verified if valid

### Step 6: Submit KPIs to Blockchain

Alice submits KPIs using the verified hash:

```bash
curl -X POST http://localhost:3001/verifier/submit-kpis \
  -H "Content-Type: application/json" \
  -d '{
    "hash": "59994ab0b1b46f8d11c2b6b3574778644dd51293dee51634c4d6ea82cf7b97b5",
    "baseLine": 1000,
    "savings": 250,
    "contractAddress": "0xYourContractAddress"
  }'
```

**What happens:**

- Verifier checks for verified proof containing the hash
- If proof exists and is valid: KPIs are submitted to blockchain
- If no proof exists: Returns 401 Unauthorized
- Blockchain transaction is executed and confirmed

## Automated Complete Flow

For convenience, Alice has an endpoint that combines steps 1-2 and 6:

```bash
curl -X POST http://localhost:3001/workflow/complete-flow \
  -H "Content-Type: application/json" \
  -d '{
    "mac": "AA:BB:CC:DD:EE:FF",
    "deviceId": "device-12345",
    "contractAddress": "0xYourContractAddress",
    "baseLine": 1000,
    "savings": 250
  }'
```

**What this does:**

1. Gets credential from Faber
2. Connects to Verifier
3. Waits for proof exchange (manual step)
4. Attempts KPI submission

**Note:** Steps 4-5 (proof request and acceptance) still need to be done manually.

## API Endpoints Summary

### Alice Server (3001)

- `POST /credentials/connect-and-request` - Get credential from Faber
- `POST /verifier/connect-and-prove` - Connect to Verifier
- `POST /verifier/submit-kpis` - Submit KPIs (requires verified proof)
- `POST /workflow/complete-flow` - Automated workflow
- `POST /proofs/accept-request` - Accept proof request

### Faber Server (3002)

- `POST /connection/create-invitation` - Create connection
- `POST /did/import` - Import DID
- `POST /credentials/issue` - Issue credential

### Verifier Server (3003)

- `POST /connection/create-invitation` - Create connection
- `POST /proofs/request` - Request proof
- `POST /blockchain/set-kpis` - Submit KPIs to blockchain (auth required)
- `GET /proofs/:id/verification` - Get proof verification details

## Security Flow

1. **Credential Issuance**: Faber issues verifiable credentials
2. **Proof Presentation**: Alice proves credential ownership
3. **Verification**: Verifier cryptographically verifies proof
4. **Authorization**: Only verified hashes can submit KPIs
5. **Blockchain**: Immutable KPI storage with event logging

## Error Scenarios

### 401 Unauthorized (No Proof)

```json
{
  "error": "Unauthorized: No verified proof found for this hash",
  "message": "You need to present a valid proof containing this hash before submitting KPIs"
}
```

**Solution:** Complete the proof exchange (steps 3-5) before submitting KPIs.

### Connection Issues

- Ensure all three servers are running
- Check network connectivity between services
- Verify port availability (3001, 3002, 3003)

### Blockchain Issues

- Ensure contract is deployed on Sepolia
- Verify wallet has sufficient ETH for gas
- Check Infura API key configuration

## Monitoring and Verification

### Check Proof Status

```bash
curl http://localhost:3003/proofs/PROOF_ID/verification
```

### View Blockchain Transaction

- Check transaction hash on [Sepolia Etherscan](https://sepolia.etherscan.io)
- Verify KPI events are emitted correctly

### Server Logs

Monitor console outputs for:

- Connection establishment
- Credential issuance
- Proof exchange
- Blockchain transactions

## Smart Contract Integration

The workflow integrates with the KPI smart contract:

```solidity
function setKPIs(string hash, uint256 baseline, uint256 savings)
```

**Events Emitted:**

```solidity
event KPIsSet(
    string indexed hash,
    uint256 indexed baseline,
    uint256 indexed savings,
    uint256 newTotalBaseline,
    uint256 newTotalSavings,
    address sender,
    uint256 timestamp
);
```

## Best Practices

1. **Always verify proofs** before accepting KPI submissions
2. **Monitor blockchain events** for audit trails
3. **Use unique device IDs** for credential requests
4. **Keep private keys secure** for blockchain transactions
5. **Test on Sepolia** before mainnet deployment

## Troubleshooting

### Common Issues:

1. **Servers not starting**: Check port availability
2. **Connection failed**: Verify all servers are running
3. **401 errors**: Complete proof exchange first
4. **Blockchain errors**: Check wallet balance and contract address

### Debug Commands:

```bash
# Check server status
curl http://localhost:3001/status
curl http://localhost:3002/health
curl http://localhost:3003/status

# Check credentials and proofs
curl http://localhost:3001/credentials
curl http://localhost:3001/proofs
curl http://localhost:3003/proofs
```

This workflow ensures that only verified credential holders can submit KPIs to the blockchain, providing a complete trust chain from credential issuance to data storage.
