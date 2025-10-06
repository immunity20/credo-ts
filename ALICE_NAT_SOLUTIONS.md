# 🏠 Alice Behind NAT: Architecture Solutions

## 🚨 **Current Problem**

Your current architecture assumes Alice (Holder) has a publicly accessible endpoint, but in reality:

- **Raspberry Pi behind home router** → Can't receive inbound connections
- **Dynamic residential IP** → No stable public address
- **NAT/Firewall blocking** → Inbound DIDComm connections fail
- **No port forwarding** → End-users won't configure routers
- **SSL certificate issues** → Can't get certs for dynamic IPs

## 💡 **Solution Options Ranked by Feasibility**

### **🥇 Option 1: Outbound-Only Polling Architecture (RECOMMENDED)**

**How it works:**

- Alice makes outbound HTTP calls only (no NAT issues)
- Alice polls Faber/Verifier for new invitations/requests
- All communication initiated by Alice (outbound)
- No need for Alice to have public endpoint

**Pros:**

- ✅ Works behind any NAT/firewall
- ✅ No network configuration required
- ✅ Simple to implement
- ✅ No additional infrastructure costs

**Cons:**

- ⚠️ Slight delay due to polling interval
- ⚠️ Uses more bandwidth (periodic polling)

### **🥈 Option 2: Cloud Mediator Service**

**How it works:**

- Deploy mediator service on public cloud
- Alice connects outbound to mediator
- Faber/Verifier send messages to mediator
- Mediator forwards messages to Alice

**Pros:**

- ✅ Real-time message delivery
- ✅ Follows DIDComm mediator pattern
- ✅ Standards-compliant

**Cons:**

- ⚠️ Additional cloud service to maintain
- ⚠️ More complex architecture
- ⚠️ Additional costs

### **🥉 Option 3: VPN Tunnel**

**How it works:**

- Set up VPN server on your cloud
- Raspberry Pi connects via VPN
- Alice appears to have public IP through tunnel

**Pros:**

- ✅ Alice gets "public" IP address
- ✅ Transparent to DIDComm

**Cons:**

- ⚠️ VPN configuration complexity
- ⚠️ Network management overhead
- ⚠️ Potential connection instability

### **🥉 Option 4: WebSocket Persistent Connection**

**How it works:**

- Alice maintains persistent WebSocket to cloud
- Messages sent over WebSocket instead of HTTP
- WebSocket connection initiated outbound by Alice

**Pros:**

- ✅ Real-time bidirectional communication
- ✅ Works behind NAT

**Cons:**

- ⚠️ Custom WebSocket implementation needed
- ⚠️ Connection management complexity
- ⚠️ Not standard DIDComm transport

## 🎯 **Recommended Implementation: Outbound-Only Polling**

### **Modified Architecture:**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Faber (3002)  │    │ Verifier (3003) │    │ Blockchain      │
│   issuer.yanis  │    │ verifier.yanis  │    │ (Sepolia)       │
│   ✅ Public     │    │ ✅ Public       │    │ ✅ Public       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         ▲                       ▲                       ▲
         │ Alice polls           │ Alice polls           │ KPI submission
         │ for invitations       │ for proof requests    │
         │                       │                       │
┌─────────────────────────────────────────────────────────────────┐
│                        Home Network (NAT)                      │
│  ┌─────────────────┐                                           │
│  │ Alice (RPi)     │ ← 🔒 Behind firewall                      │
│  │ localhost:3001  │ ← 🚫 No inbound connections               │
│  │ ✅ Outbound OK  │ ← ✅ Can make HTTP calls                 │
│  └─────────────────┘                                           │
└─────────────────────────────────────────────────────────────────┘
```

### **Alice Polling Flow:**

1. **🔄 Every 5 seconds:**

   - Poll Faber: `GET https://issuer.yanis.gr/api/invitation-available`
   - Poll Verifier: `GET https://verifier.yanis.gr/api/proof-requests`

2. **📨 When invitation found:**

   - Alice calls: `POST https://issuer.yanis.gr/api/connection/create-invitation`
   - Alice processes invitation locally (outbound connection)

3. **📋 When proof request found:**
   - Alice auto-accepts proof request
   - Alice extracts hash from credentials
   - Alice calls: `POST https://verifier.yanis.gr/api/blockchain/set-kpis`

### **Required Changes:**

#### **1. Faber Server Modifications:**

Add invitation availability check:

```typescript
// New endpoint in FaberRestServer.ts
app.get("/api/invitation-available", (req, res) => {
  const { aliceId } = req.query;

  // Check if Alice needs invitation
  const needsInvitation = !connectedAliceDevices.has(aliceId);

  res.json({
    available: needsInvitation,
    message: needsInvitation ? "Invitation needed" : "Already connected",
  });
});
```

#### **2. Alice Polling Implementation:**

Replace current Alice with polling version:

```typescript
// Alice polls instead of listening
setInterval(async () => {
  await checkForFaberInvitation();
  await checkForProofRequests();
}, 5000);
```

#### **3. Network Configuration:**

- **Faber/Verifier:** Keep current nginx config (public HTTPS)
- **Alice:** Remove nginx config (local only)
- **Raspberry Pi:** Only needs outbound internet (default)

## 🔧 **Implementation Steps**

### **Step 1: Update Faber for Polling Support**

```bash
# Add polling endpoints to FaberRestServer.ts
```

### **Step 2: Create Alice Polling Version**

```bash
# Replace AliceRestServer.ts with polling implementation
```

### **Step 3: Test Local Network**

```bash
# Test Alice can reach public servers
curl https://issuer.yanis.gr/api/status
curl https://verifier.yanis.gr/api/status
```

### **Step 4: Deploy to Raspberry Pi**

```bash
# Install Node.js on Raspberry Pi
sudo apt update
sudo apt install nodejs npm

# Clone and setup
git clone <your-repo>
cd credo-ts/demo
npm install
npm run build

# Run Alice polling service
pm2 start src/AliceNATServer.ts --interpreter="ts-node"
```

## 🔄 **End-to-End Flow with Polling**

1. **🏠 Alice starts up behind NAT**

   - Runs locally on Raspberry Pi
   - Starts polling timer (every 5 seconds)

2. **🔄 Alice polls for connections**

   - `GET https://issuer.yanis.gr/api/invitation-available?aliceId=rpi-001`
   - If invitation needed, calls `POST /api/connection/create-invitation`

3. **📋 Alice polls for proof requests**

   - Checks local proof records for `RequestReceived` state
   - Auto-accepts any pending proof requests

4. **🔗 Alice extracts hash and submits KPIs**

   - Extracts hash from completed credentials
   - Calls `POST https://verifier.yanis.gr/api/blockchain/set-kpis`

5. **🎉 KPIs mined to blockchain**
   - Verifier validates proof and submits to Sepolia
   - Transaction confirmed on blockchain

## 📊 **Comparison Table**

| Solution      | NAT Compatible | Real-time     | Complexity | Cost           | Standards   |
| ------------- | -------------- | ------------- | ---------- | -------------- | ----------- |
| **Polling**   | ✅             | ⚠️ (5s delay) | 🟢 Low     | 🟢 Free        | 🟡 Custom   |
| **Mediator**  | ✅             | ✅            | 🟡 Medium  | 🟡 Cloud costs | 🟢 DIDComm  |
| **VPN**       | ✅             | ✅            | 🔴 High    | 🟡 VPN costs   | 🟢 Standard |
| **WebSocket** | ✅             | ✅            | 🔴 High    | 🟢 Free        | 🔴 Custom   |

## 🚀 **Recommendation**

**Start with Polling Architecture** because:

1. **✅ Immediate solution** - Works with current setup
2. **✅ Zero infrastructure changes** - Uses existing servers
3. **✅ Simple to implement** - Just polling logic
4. **✅ Easy to test** - Can test from any network
5. **✅ Future upgrade path** - Can add mediator later if needed

The 5-second polling delay is acceptable for IoT scenarios where real-time response isn't critical.

## 🔧 **Ready to Implement?**

Would you like me to:

1. Create the complete polling-based Alice implementation?
2. Update Faber/Verifier servers with polling support endpoints?
3. Provide step-by-step deployment instructions for Raspberry Pi?

This solution will allow your end-users to simply plug in the Raspberry Pi behind their home router without any network configuration! 🏠🔌
