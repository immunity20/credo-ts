# Faber REST API Server

This is a REST API version of the Faber agent that replaces the command-line interface with HTTP endpoints. Faber acts as an issuer and verifier in the credential ecosystem.

## Getting Started

### Prerequisites

1. Install dependencies (if not already done):

```bash
cd demo
npm install
```

### Running the Server

Start the Faber REST API server:

```bash
npm run faber-server
```

The server will start on `http://localhost:3002`

## API Endpoints

### Health Check

- **GET** `/health`
- Check server status and current state
- Response:

```json
{
  "status": "ok",
  "outOfBandId": "oob-id-or-null",
  "hasCredentialDefinition": false,
  "anonCredsIssuerId": "did-or-null"
}
```

### Connection Management

#### Create Connection Invitation

- **POST** `/connection/create-invitation`
- Create an out-of-band invitation for other agents to connect
- Request body: `{}` (empty)
- Response:

```json
{
  "success": true,
  "invitationUrl": "http://localhost:3002?_oob=...",
  "outOfBandId": "oob-id",
  "message": "Connection invitation created successfully"
}
```

### DID Management

#### Import DID

- **POST** `/did/import`
- Import a pre-registered DID for credential issuance
- Request body:

```json
{
  "registry": "did:indy"
}
```

- Valid registry options: `"did:indy"` or `"did:cheqd"`
- Response:

```json
{
  "success": true,
  "registry": "did:indy",
  "anonCredsIssuerId": "did:indy:bcovrin:test:2jEvRuKmfBJTRa7QowDpNN",
  "message": "DID imported successfully"
}
```

### Credential Management

#### Issue Credential

- **POST** `/credentials/issue`
- Issue a credential to the connected agent (requires DID import and connection)
- Request body: `{}` (empty)
- Response:

```json
{
  "success": true,
  "credentialDefinitionId": "did:indy:bcovrin:test:2jEvRuKmfBJTRa7QowDpNN/anoncreds/v0/CLAIM_DEF/123/latest",
  "message": "Credential offer sent successfully"
}
```

### Proof Management

#### Request Proof

- **POST** `/proofs/request`
- Send a proof request to the connected agent (requires credential to be issued first)
- Request body: `{}` (empty)
- Response:

```json
{
  "success": true,
  "message": "Proof request sent successfully"
}
```

### Messaging

#### Send Message

- **POST** `/message/send`
- Send a basic message to the connected agent
- Request body:

```json
{
  "message": "Hello from Faber!"
}
```

- Response:

```json
{
  "success": true,
  "message": "Message sent successfully"
}
```

### Data Retrieval

#### Get All Connections

- **GET** `/connections`
- Retrieve all connection records
- Response:

```json
{
  "success": true,
  "connections": [
    {
      "id": "connection-id",
      "state": "Completed",
      "outOfBandId": "oob-id",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### Get All Credentials

- **GET** `/credentials`
- Retrieve all credential exchange records
- Response:

```json
{
  "success": true,
  "credentials": [
    {
      "id": "credential-id",
      "state": "CredentialIssued",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### Get All Proofs

- **GET** `/proofs`
- Retrieve all proof exchange records
- Response:

```json
{
  "success": true,
  "proofs": [
    {
      "id": "proof-id",
      "state": "ProofReceived",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### Get Credential Definition

- **GET** `/credential-definition`
- Get information about the current credential definition
- Response:

```json
{
  "success": true,
  "credentialDefinition": {
    "id": "did:indy:bcovrin:test:2jEvRuKmfBJTRa7QowDpNN/anoncreds/v0/CLAIM_DEF/123/latest",
    "state": "finished"
  }
}
```

#### Accept Presentation (Manual)

- **POST** `/proofs/accept-presentation`
- Manually accept a received presentation (normally happens automatically)
- Request body:

```json
{
  "proofRecordId": "proof-record-id"
}
```

- Response:

```json
{
  "success": true,
  "isVerified": true,
  "message": "Presentation accepted successfully"
}
```

#### Get Proof Verification Details

- **GET** `/proofs/{proofRecordId}/verification`
- Get detailed verification information for a specific proof
- Response:

```json
{
  "success": true,
  "proofRecord": {
    "id": "proof-id",
    "state": "done",
    "isVerified": true,
    "errorMessage": null,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "formatData": {
    "request": {
      /* proof request data */
    },
    "presentation": {
      /* presentation data */
    }
  },
  "verificationResult": {
    "isValid": true,
    "status": "VALID",
    "message": "Proof verification successful"
  }
}
```

### Agent Management

#### Shutdown Agent

- **POST** `/shutdown`
- Gracefully shutdown the agent
- Response:

```json
{
  "success": true,
  "message": "Agent shutdown successfully"
}
```

## Proof Verification

When Alice accepts a proof request and sends a presentation, Faber automatically:

1. **Receives the presentation** - State changes to `PresentationReceived`
2. **Verifies the proof automatically** - The verification happens in the background
3. **Logs the result** - Console shows whether the proof is VALID ✅ or INVALID ❌
4. **Auto-accepts valid proofs** - Valid presentations are automatically accepted
5. **Completes the flow** - State changes to `Done`

### Verification Console Output

When a proof is received, you'll see output like:

```
🔍 Proof state changed: presentation-received
Proof ID: abc123...
✅ Proof received from Alice!
🎉 Proof is VALID! ✅
Proof verification successful - Alice has provided valid credentials.
✅ Presentation accepted automatically
✅ Proof exchange completed successfully!
```

### Manual Verification Check

You can get detailed verification information:

```bash
# Get verification details for a specific proof
curl http://localhost:3002/proofs/PROOF_ID/verification

# Manually accept a presentation (if auto-accept is disabled)
curl -X POST http://localhost:3002/proofs/accept-presentation \
  -H "Content-Type: application/json" \
  -d '{"proofRecordId": "PROOF_ID_FROM_LOGS"}'
```

### Understanding Verification Results

- **`isVerified: true`** - The proof is cryptographically valid and the credentials are legitimate
- **`isVerified: false`** - The proof failed verification (tampered or invalid credentials)
- **`isVerified: null`** - Verification status unknown (shouldn't normally happen)

The verification checks:

- Cryptographic signatures on the credentials
- That the credentials haven't been tampered with
- That the proof correctly proves the requested attributes
- That the credentials are from the expected issuers
- Cryptographic signatures on the credentials
- That the credentials haven't been tampered with
- That the proof correctly proves the requested attributes
- That the credentials are from the expected issuers

1. **Start the Faber server**: `npm run faber-server`

2. **Check health**: `GET /health`

3. **Create connection invitation**: `POST /connection/create-invitation`

   - Copy the `invitationUrl` from the response
   - Share this URL with Alice or use it in Alice's `/connection/receive-invitation` endpoint

4. **Import DID for issuance**: `POST /did/import` with `{"registry": "did:indy"}`

5. **Issue credential**: `POST /credentials/issue`

   - This will send a credential offer to the connected Alice agent

6. **Request proof**: `POST /proofs/request`

   - This will send a proof request to Alice asking for proof of the issued credential

7. **Monitor states**: Use the GET endpoints to check the status of connections, credentials, and proofs

## Example with curl

```bash
# Check health
curl http://localhost:3002/health

# Create connection invitation
curl -X POST http://localhost:3002/connection/create-invitation \
  -H "Content-Type: application/json" \
  -d '{}'

# Import DID
curl -X POST http://localhost:3002/did/import \
  -H "Content-Type: application/json" \
  -d '{"registry": "did:indy"}'

# Issue credential
curl -X POST http://localhost:3002/credentials/issue \
  -H "Content-Type: application/json" \
  -d '{}'

# Request proof
curl -X POST http://localhost:3002/proofs/request \
  -H "Content-Type: application/json" \
  -d '{}'

# Send message
curl -X POST http://localhost:3002/message/send \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello from Faber!"}'
```

## Integration with Alice

To test the full flow between Faber and Alice:

1. Start both servers:

   - `npm run faber-server` (runs on port 3002)
   - `npm run alice-server` (runs on port 3001)

2. Create connection invitation on Faber:

   ```bash
   curl -X POST http://localhost:3002/connection/create-invitation
   ```

3. Use the returned invitation URL with Alice:

   ```bash
   curl -X POST http://localhost:3001/connection/receive-invitation \
     -H "Content-Type: application/json" \
     -d '{"invitationUrl": "INVITATION_URL_FROM_STEP_2"}'
   ```

4. Import DID on Faber and issue credential:

   ```bash
   curl -X POST http://localhost:3002/did/import \
     -H "Content-Type: application/json" \
     -d '{"registry": "did:indy"}'

   curl -X POST http://localhost:3002/credentials/issue
   ```

5. Accept the credential on Alice (check Alice console for credential ID):

   ```bash
   curl -X POST http://localhost:3001/credentials/accept-offer \
     -H "Content-Type: application/json" \
     -d '{"credentialRecordId": "CREDENTIAL_ID_FROM_CONSOLE"}'
   ```

6. Request proof on Faber:

   ```bash
   curl -X POST http://localhost:3002/proofs/request
   ```

7. Accept proof request on Alice (check Alice console for proof ID):
   ```bash
   curl -X POST http://localhost:3001/proofs/accept-request \
     -H "Content-Type: application/json" \
     -d '{"proofRecordId": "PROOF_ID_FROM_CONSOLE"}'
   ```

This REST API approach enables easy integration of the Faber issuer/verifier functionality into web applications, mobile apps, or any system that can make HTTP requests.
