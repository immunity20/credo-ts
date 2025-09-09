# Credo-TS Production Deployment Guide

This guide helps you deploy the three Credo-TS REST servers on Ubuntu with nginx and PM2.

## 🏗️ Architecture

```
Internet → Nginx (Port 80/443) → PM2 → Node.js Apps
├── holder.yanis.gr → localhost:3001 (Alice Server)
├── issuer.yanis.gr → localhost:3002 (Faber Server)
└── verifier.yanis.gr → localhost:3003 (Verifier Server)
```

## 📋 Prerequisites

- Ubuntu 20.04+ server
- Domain name with DNS pointing to your server IP:
  - `holder.yanis.gr` → Your Server IP
  - `issuer.yanis.gr` → Your Server IP
  - `verifier.yanis.gr` → Your Server IP
- Root or sudo access

## 🚀 Quick Deployment

### Step 1: Install Dependencies

```bash
# Download and run the installation script
wget https://raw.githubusercontent.com/your-repo/credo-ts/main/deploy/install-dependencies.sh
chmod +x install-dependencies.sh
./install-dependencies.sh

# Follow the PM2 startup instructions that will be displayed
```

### Step 2: Deploy Application

```bash
# Download and run the deployment script
wget https://raw.githubusercontent.com/your-repo/credo-ts/main/deploy/deploy.sh
chmod +x deploy.sh
./deploy.sh
```

### Step 3: Setup SSL (Recommended)

```bash
# Download and run the SSL setup script
wget https://raw.githubusercontent.com/your-repo/credo-ts/main/deploy/setup-ssl.sh
chmod +x setup-ssl.sh
./setup-ssl.sh
```

## 🛠️ Manual Setup

### 1. Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install pnpm and PM2
npm install -g pnpm pm2

# Install nginx
sudo apt install nginx -y

# Start services
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 2. Clone Repository

```bash
sudo git clone https://github.com/openwallet-foundation/credo-ts.git /var/www/credo-ts
sudo chown -R $USER:$USER /var/www/credo-ts
cd /var/www/credo-ts
pnpm install
```

### 3. Configure Nginx

```bash
# Copy configuration files
sudo cp deploy/nginx-*.conf /etc/nginx/sites-available/

# Enable sites
sudo ln -s /etc/nginx/sites-available/holder.yanis.gr /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/issuer.yanis.gr /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/verifier.yanis.gr /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

### 4. Configure Environment Variables

Edit the ecosystem.config.json file and update:

- `/path/to/your/credo-ts/demo` → `/var/www/credo-ts/demo`
- Add your Infura API key for the verifier server
- Add your private key for blockchain transactions

### 5. Start Applications

```bash
cd /var/www/credo-ts/demo
pm2 start ../deploy/ecosystem.config.json
pm2 save

# Setup PM2 startup
pm2 startup
# Follow the instructions provided by the command above
```

## 📊 Management

### Using the Management Script

```bash
# Make the script executable
chmod +x /var/www/credo-ts/deploy/manage.sh

# Create a symlink for easy access
sudo ln -s /var/www/credo-ts/deploy/manage.sh /usr/local/bin/credo-manage

# Usage
credo-manage start      # Start all servers
credo-manage stop       # Stop all servers
credo-manage restart    # Restart all servers
credo-manage status     # Show status
credo-manage logs       # Show all logs
credo-manage update     # Update and restart
```

### Direct PM2 Commands

```bash
pm2 status              # Show status
pm2 logs                # Show all logs
pm2 logs alice-server   # Show specific server logs
pm2 restart all         # Restart all
pm2 delete all          # Stop and delete all
```

### Nginx Commands

```bash
sudo nginx -t                    # Test configuration
sudo systemctl reload nginx     # Reload configuration
sudo systemctl status nginx     # Check status
sudo systemctl restart nginx    # Restart nginx
```

## 🔍 Troubleshooting

### Check Server Status

```bash
# Check if servers are running
curl http://holder.yanis.gr/health
curl http://issuer.yanis.gr/health
curl http://verifier.yanis.gr/health
```

### View Logs

```bash
# PM2 logs
pm2 logs

# Nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# Application-specific logs
tail -f /var/www/credo-ts/demo/logs/alice-combined.log
tail -f /var/www/credo-ts/demo/logs/faber-combined.log
tail -f /var/www/credo-ts/demo/logs/verifier-combined.log
```

### Common Issues

1. **Port already in use**: Check what's using the port with `sudo lsof -i :3001`
2. **Permission denied**: Ensure proper ownership with `sudo chown -R $USER:$USER /var/www/credo-ts`
3. **Nginx configuration error**: Test with `sudo nginx -t`
4. **PM2 not starting on boot**: Run `pm2 startup` and follow instructions

## 🔐 Security Considerations

1. **Firewall**: Configure UFW to only allow necessary ports

   ```bash
   sudo ufw allow ssh
   sudo ufw allow 'Nginx Full'
   sudo ufw enable
   ```

2. **SSL**: Always use HTTPS in production (use the SSL setup script)

3. **Environment Variables**: Store sensitive data (private keys, API keys) securely

4. **Updates**: Regularly update the system and dependencies

## 🌐 Testing the Deployment

After deployment, test the complete workflow:

1. **Health Checks**:

   ```bash
   curl https://holder.yanis.gr/health
   curl https://issuer.yanis.gr/health
   curl https://verifier.yanis.gr/health
   ```

2. **Create Connection** (Alice → Faber):

   ```bash
   curl -X POST https://issuer.yanis.gr/connection/create-invitation
   # Use the invitation with Alice
   ```

3. **Issue Credential** (Faber → Alice):

   ```bash
   curl -X POST https://issuer.yanis.gr/credentials/issue \
     -H "Content-Type: application/json" \
     -d '{"connectionId": "connection-id", "attributes": {...}}'
   ```

4. **Submit KPIs** (Alice → Verifier):
   ```bash
   curl -X POST https://holder.yanis.gr/workflow/complete-flow \
     -H "Content-Type: application/json" \
     -d '{"faberUrl": "https://issuer.yanis.gr", "verifierUrl": "https://verifier.yanis.gr", "kpis": {...}}'
   ```

## 📝 Monitoring

Consider setting up monitoring with:

- **PM2 Plus**: For application monitoring
- **Nginx Amplify**: For web server monitoring
- **Prometheus + Grafana**: For comprehensive monitoring
- **Log aggregation**: ELK stack or similar

---

For more information, refer to the [REST Servers README](../REST_SERVERS_README.md) and [Workflow README](../WORKFLOW_README.md).
