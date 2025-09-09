# 🍓 Raspberry Pi Deployment Guide

## 📋 **Prerequisites**

### **Raspberry Pi Setup:**

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+ (required for Credo-TS)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Install Git
sudo apt install git -y
```

### **Network Requirements:**

- ✅ Outbound internet connection (default)
- ❌ No port forwarding needed
- ❌ No static IP required
- ❌ No router configuration needed

## 🚀 **Deployment Steps**

### **Step 1: Clone and Setup**

```bash
# Clone the repository
git clone https://github.com/your-username/credo-ts.git
cd credo-ts/demo

# Install dependencies
npm install

# Build TypeScript
npm run build
```

### **Step 2: Configure Alice**

```bash
# Create Alice configuration
cat > alice-config.json << EOF
{
  "name": "Alice Raspberry Pi",
  "deviceId": "rpi-$(hostname)",
  "pollingInterval": 5000,
  "endpoints": {
    "issuer": "https://issuer.yanis.gr",
    "verifier": "https://verifier.yanis.gr"
  }
}
EOF
```

### **Step 3: Start Alice Service**

```bash
# Start Alice NAT-friendly server with PM2
pm2 start src/AliceNATServer.ts --name "alice-holder" --interpreter="ts-node"

# Save PM2 configuration
pm2 save

# Setup auto-start on boot
pm2 startup
# Follow the command it gives you (usually involving sudo)
```

### **Step 4: Verify Operation**

```bash
# Check Alice status
pm2 status

# View Alice logs
pm2 logs alice-holder

# Test Alice REST API
curl http://localhost:3015/status
```

## 📊 **Expected Output**

### **Successful Startup:**

```
[alice-holder] Alice NAT-Friendly Server Starting...
[alice-holder]
[alice-holder] Agent alice created!
[alice-holder]
[alice-holder] Alice NAT-Friendly REST API server running on http://localhost:3015
[alice-holder] 🔒 This server works behind NAT/firewall (outbound connections only)
[alice-holder]
[alice-holder] 🔄 Starting polling for new connections and messages...
[alice-holder] 🔄 Automatic polling enabled - Alice will automatically:
[alice-holder]    • Connect to Faber when invitation available
[alice-holder]    • Accept proof requests automatically
[alice-holder]    • Extract hashes and submit KPIs to blockchain
```

### **Polling Activity:**

```
[alice-holder] 🔍 Checking for Faber invitation...
[alice-holder] 📨 Found new invitation from Faber!
[alice-holder] 🔗 Alice connection established!
[alice-holder] 📩 Alice received proof request!
[alice-holder] ✅ Alice automatically accepted proof request
[alice-holder] 🔗 Auto-extracted hash: abc123def456
[alice-holder] 🚀 Submitting KPIs to blockchain via Verifier...
[alice-holder] 🎉 KPIs successfully submitted to blockchain!
[alice-holder] Transaction hash: 0x789...
```

## 🔧 **Management Commands**

### **PM2 Process Management:**

```bash
# View status
pm2 status

# View logs (real-time)
pm2 logs alice-holder --lines 50

# Restart Alice
pm2 restart alice-holder

# Stop Alice
pm2 stop alice-holder

# Delete Alice process
pm2 delete alice-holder
```

### **System Monitoring:**

```bash
# Check system resources
pm2 monit

# Check network connectivity
ping issuer.yanis.gr
ping verifier.yanis.gr

# Test Alice API locally
curl http://localhost:3015/status
curl http://localhost:3015/connections
curl http://localhost:3015/credentials
```

## 🔍 **Troubleshooting**

### **Common Issues:**

#### **1. "Cannot connect to issuer.yanis.gr"**

```bash
# Check DNS resolution
nslookup issuer.yanis.gr

# Check internet connectivity
ping 8.8.8.8

# Check if ports are blocked
telnet issuer.yanis.gr 443
```

#### **2. "Node.js version too old"**

```bash
# Check Node.js version (should be 18+)
node --version

# Reinstall Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### **3. "Permission denied errors"**

```bash
# Fix npm permissions
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules
```

#### **4. "PM2 command not found"**

```bash
# Reinstall PM2 globally
sudo npm install -g pm2

# Check PM2 installation
which pm2
pm2 --version
```

### **Debug Mode:**

```bash
# Start Alice in debug mode
NODE_ENV=development pm2 start src/AliceNATServer.ts --name "alice-debug" --interpreter="ts-node"

# View detailed logs
pm2 logs alice-debug --raw
```

## 📡 **Network Testing**

### **Test Outbound Connectivity:**

```bash
# Test HTTPS connectivity to your servers
curl -I https://issuer.yanis.gr/api/status
curl -I https://verifier.yanis.gr/api/status

# Test Alice can reach the servers
curl -X POST https://issuer.yanis.gr/api/connection/create-invitation
curl -X POST https://verifier.yanis.gr/api/connection/create-invitation
```

### **Expected Response:**

```json
{
  "success": true,
  "invitationUrl": "https://issuer.yanis.gr/?oob=...",
  "outOfBandId": "...",
  "message": "Connection invitation created successfully"
}
```

## 🔄 **Auto-Update Setup**

### **Create Update Script:**

```bash
cat > update-alice.sh << 'EOF'
#!/bin/bash
echo "🔄 Updating Alice..."

# Stop Alice
pm2 stop alice-holder

# Pull latest changes
git pull origin main

# Install dependencies
npm install

# Build TypeScript
npm run build

# Start Alice
pm2 start alice-holder

echo "✅ Alice updated successfully!"
EOF

chmod +x update-alice.sh
```

### **Schedule Auto-Updates (Optional):**

```bash
# Add to crontab for weekly updates
crontab -e

# Add this line (updates every Sunday at 3 AM)
0 3 * * 0 /home/pi/credo-ts/demo/update-alice.sh >> /var/log/alice-update.log 2>&1
```

## 🏠 **Home Network Compatibility**

### **✅ Works With:**

- Any home router/modem
- WiFi or Ethernet connection
- Dynamic IP addresses
- NAT/firewall enabled
- No port forwarding
- Regular ISP connections

### **❌ May Not Work With:**

- Corporate firewalls blocking HTTPS
- Captive portals requiring login
- Networks blocking outbound connections
- Very restrictive proxy configurations

## 📞 **Support**

### **If Alice Doesn't Work:**

1. **Check logs:** `pm2 logs alice-holder`
2. **Test connectivity:** `curl https://issuer.yanis.gr/api/status`
3. **Restart Alice:** `pm2 restart alice-holder`
4. **Check system resources:** `pm2 monit`

### **Provide These Details:**

- Raspberry Pi model and OS version
- Network setup (WiFi/Ethernet, ISP)
- PM2 logs: `pm2 logs alice-holder --lines 100`
- Network test results: `curl -v https://issuer.yanis.gr/api/status`

## 🎉 **Success Indicators**

You'll know Alice is working when you see:

1. **✅ Agent startup:** "Agent alice created!"
2. **✅ Polling active:** "Starting polling for new connections..."
3. **✅ Server running:** "REST API server running on http://localhost:3015"
4. **✅ Network connectivity:** Successful curl tests to your servers
5. **✅ DIDComm workflow:** Connection → Credential → Proof → Blockchain submission

Alice will run completely autonomously, handling the entire SSI to blockchain pipeline without any user intervention! 🚀
