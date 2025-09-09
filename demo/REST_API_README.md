# Alice REST API Server

This is a REST API version of the Alice agent that replaces the command-line interface with HTTP endpoints.

## Getting Started

### Prerequisites

1. Install dependencies:

```bash
cd demo
npm install
```

### Running the Server

Start the Alice REST API server:

```bash
npm run alice-server
```

The server will start on `http://localhost:3001`

## API Endpoints

### Health Check

- **GET** `/health`
- Check server and connection status
- Response:

```json
{
  "status": "ok",
  "connected": false,
  "connectionId": null
}
```

### Connection Management

#### Receive Connection Invitation

- **POST** `/connection/receive-invitation`
- Accept a connection invitation from another agent
- Request body:

```json
{
  "invitationUrl": "http://example.com/invitation?_oob=..."
}
```

- Response:

```json
{
  "success": true,
  "connected": true,
  "connectionId": "connection-id",
  "message": "Connection invitation processed successfully"
}
```

### Messaging

#### Send Message

- **POST** `/message/send`
- Send a basic message to the connected agent
- Request body:

```json
{
  "message": "Hello from Alice!"
}
```

- Response:

```json
{
  "success": true,
  "message": "Message sent successfully"
}
```

### Credentials

#### Accept Credential Offer

- **POST** `/credentials/accept-offer`
- Accept a credential offer (you'll get the ID from console logs when an offer is received)
- Request body:

```json
{
  "credentialRecordId": "credential-record-id"
}
```

- Response:

```json
{
  "success": true,
  "message": "Credential offer accepted successfully"
}
```

#### Decline Credential Offer

- **POST** `/credentials/decline-offer`
- Decline a credential offer
- Request body:

```json
{
  "credentialRecordId": "credential-record-id"
}
```

- Response:

```json
{
  "success": true,
  "message": "Credential offer declined successfully"
}
```

#### Connect and Request Credential (Automated)

- **POST** `/credentials/connect-and-request`
- Automatically connect to Faber server and request a credential with device information
- Request body:

```json
{
  "mac": "AA:BB:CC:DD:EE:FF",
  "deviceId": "device-12345"
}
```

- Response:

```json
{
  "success": true,
  "connected": true,
  "connectionId": "connection-id",
  "mac": "AA:BB:CC:DD:EE:FF",
  "deviceId": "device-12345",
  "hash": "sha256-hash-of-device-id",
  "message": "Connected to Faber and credential offer requested...",
  "credentialDefinitionId": "credential-definition-id"
}
```

**Notes:**

- This endpoint automatically generates a SHA-256 hash of the `deviceId`
- It connects to Faber server at `localhost:3002`
- The credential will be auto-accepted when received
- The credential contains three attributes: `mac`, `deviceId`, and `hash`

#### Get All Credentials

- **GET** `/credentials`
- Retrieve all credentials
- Response:

```json
{
  "success": true,
  "credentials": [
    {
      "id": "credential-id",
      "state": "CredentialReceived",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### Proofs

#### Accept Proof Request

- **POST** `/proofs/accept-request`
- Accept a proof request (you'll get the ID from console logs when a request is received)
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
  "message": "Proof request accepted successfully"
}
```

#### Decline Proof Request

- **POST** `/proofs/decline-request`
- Decline a proof request
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
  "message": "Proof request declined successfully"
}
```

#### Get All Proofs

- **GET** `/proofs`
- Retrieve all proofs
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

## Usage Flow

### Automated Device Credential Request

The fastest way to get a device credential:

1. **Start both servers:**

   ```bash
   # Terminal 1
   npm run faber-server

   # Terminal 2
   npm run alice-server
   ```

2. **Request credential automatically:**
   ```bash
   curl -X POST http://localhost:3001/credentials/connect-and-request \
     -H "Content-Type: application/json" \
     -d '{
       "mac": "AA:BB:CC:DD:EE:FF",
       "deviceId": "device-12345"
     }'
   ```

This single endpoint call will:

- Connect Alice to Faber server
- Request Faber to import a DID for credential issuance
- Request a credential with the provided MAC address and device ID
- Auto-generate and include a SHA-256 hash of the device ID
- Auto-accept the credential when it arrives

The resulting credential will contain three attributes:

- **mac**: `AA:BB:CC:DD:EE:FF`
- **deviceId**: `device-12345`
- **hash**: `59994ab0b1b46f8d11c2b6b3574778644dd51634c4d6ea82cf7b97b5` (SHA-256 of the deviceId)

### Manual Flow (Alternative)

1. Start the Alice REST API server: `npm run alice-server`
2. Use the health endpoint to check the status: `GET /health`
3. When you receive a connection invitation URL from another agent, use: `POST /connection/receive-invitation`
4. Once connected, you can send messages: `POST /message/send`
5. When credential offers or proof requests are received, you'll see the IDs in the console logs
6. Use the appropriate accept/decline endpoints with the IDs from the logs

## Example with curl

```bash
# Automated device credential request (single call does everything)
curl -X POST http://localhost:3001/credentials/connect-and-request \
  -H "Content-Type: application/json" \
  -d '{
    "mac": "AA:BB:CC:DD:EE:FF",
    "deviceId": "device-12345"
  }'

# Manual flow examples:

# Check health
curl http://localhost:3001/health

# Accept connection invitation
curl -X POST http://localhost:3001/connection/receive-invitation \
  -H "Content-Type: application/json" \
  -d '{"invitationUrl": "your-invitation-url-here"}'

# Send a message
curl -X POST http://localhost:3001/message/send \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello from Alice!"}'

# Accept credential offer (replace with actual ID from logs)
curl -X POST http://localhost:3001/credentials/accept-offer \
  -H "Content-Type: application/json" \
  -d '{"credentialRecordId": "credential-id-from-logs"}'
```

## Event Handling

The server automatically listens for incoming events:

- **Messages**: Logged to console when received
- **Credential Offers**: ID logged to console - use the accept/decline endpoints
- **Proof Requests**: ID logged to console - use the accept/decline endpoints

This REST API approach allows you to integrate the Alice agent functionality into web applications, mobile apps, or any system that can make HTTP requests.
