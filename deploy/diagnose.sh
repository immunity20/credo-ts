#!/bin/bash
# Comprehensive diagnostic script for Credo-TS deployment issues

echo "🔍 Diagnosing Credo-TS deployment issues..."
echo "=================================================="

# Check if we're in the right directory
if [ ! -d "/var/www/credo-ts" ]; then
    echo "❌ Project directory /var/www/credo-ts not found!"
    echo "Please run the deployment script first: ./deploy.sh"
    exit 1
fi

cd /var/www/credo-ts

echo ""
echo "📊 SYSTEM STATUS"
echo "----------------"
echo "Date: $(date)"
echo "User: $(whoami)"
echo "Working directory: $(pwd)"

echo ""
echo "🔧 SERVICE STATUS"
echo "-----------------"
echo "Nginx status:"
sudo systemctl status nginx --no-pager -l | head -5

echo ""
echo "PM2 status:"
pm2 status

echo ""
echo "🌐 PORT AVAILABILITY"
echo "--------------------"
for port in 3001 3002 3003; do
    echo "Port $port:"
    if sudo lsof -i :$port; then
        echo "  ✅ Port $port is in use"
    else
        echo "  ❌ Port $port is not in use"
    fi
    echo ""
done

echo ""
echo "🔍 PROCESS CHECK"
echo "----------------"
echo "Node.js processes:"
ps aux | grep -E "(node|ts-node)" | grep -v grep

echo ""
echo "🗂️ PROJECT STRUCTURE"
echo "--------------------"
echo "Demo directory contents:"
if [ -d "demo" ]; then
    ls -la demo/
    echo ""
    echo "Demo src directory:"
    if [ -d "demo/src" ]; then
        ls -la demo/src/ | grep -E "(Alice|Faber|Verifier)"
    else
        echo "❌ demo/src directory not found"
    fi
else
    echo "❌ demo directory not found"
fi

echo ""
echo "📦 DEPENDENCIES"
echo "---------------"
echo "Node.js: $(node --version 2>/dev/null || echo 'Not installed')"
echo "npm: $(npm --version 2>/dev/null || echo 'Not installed')"
echo "pnpm: $(pnpm --version 2>/dev/null || echo 'Not installed')"
echo "PM2: $(pm2 --version 2>/dev/null || echo 'Not installed')"
echo "ts-node global: $(which ts-node 2>/dev/null || echo 'Not installed globally')"

if [ -d "demo" ]; then
    cd demo
    echo "ts-node local: $(ls node_modules/.bin/ts-node 2>/dev/null || echo 'Not installed locally')"
    cd ..
fi

echo ""
echo "📄 PACKAGE.JSON SCRIPTS"
echo "------------------------"
if [ -f "demo/package.json" ]; then
    echo "Available scripts in demo/package.json:"
    cat demo/package.json | grep -A 10 '"scripts"' | head -15
else
    echo "❌ demo/package.json not found"
fi

echo ""
echo "📝 PM2 LOGS (Last 10 lines)"
echo "----------------------------"
if pm2 list | grep -q "alice-server\|faber-server\|verifier-server"; then
    echo "Alice server logs:"
    pm2 logs alice-server --lines 5 --nostream 2>/dev/null || echo "No Alice logs"
    echo ""
    echo "Faber server logs:"
    pm2 logs faber-server --lines 5 --nostream 2>/dev/null || echo "No Faber logs"
    echo ""
    echo "Verifier server logs:"
    pm2 logs verifier-server --lines 5 --nostream 2>/dev/null || echo "No Verifier logs"
else
    echo "❌ No PM2 processes found for the servers"
fi

echo ""
echo "🔧 NGINX CONFIGURATION"
echo "----------------------"
echo "Enabled sites:"
ls -la /etc/nginx/sites-enabled/ | grep yanis || echo "No yanis.gr sites enabled"

echo ""
echo "Nginx configuration test:"
sudo nginx -t

echo ""
echo "🧪 MANUAL TESTS"
echo "---------------"
echo "Testing if we can start applications manually..."

if [ -d "demo" ]; then
    cd demo
    
    echo "1. Testing ts-node availability:"
    if [ -f "node_modules/.bin/ts-node" ]; then
        echo "  ✅ Local ts-node found"
    elif command -v ts-node &> /dev/null; then
        echo "  ✅ Global ts-node found"
    else
        echo "  ❌ ts-node not available"
        echo "  💡 Run: npm install -g ts-node typescript"
    fi
    
    echo ""
    echo "2. Testing npm scripts:"
    for script in alice-server faber-server verifier-server; do
        if npm run $script --dry-run &>/dev/null; then
            echo "  ✅ npm run $script is available"
        else
            echo "  ❌ npm run $script is not available"
        fi
    done
    
    cd ..
fi

echo ""
echo "🚀 SUGGESTED ACTIONS"
echo "======================"

# Check what's missing and suggest fixes
NEEDS_INSTALL=false
NEEDS_START=false

if ! command -v ts-node &> /dev/null && [ ! -f "demo/node_modules/.bin/ts-node" ]; then
    echo "1. Install ts-node:"
    echo "   sudo npm install -g ts-node typescript"
    echo "   OR cd demo && pnpm install"
    NEEDS_INSTALL=true
fi

if ! pm2 list | grep -q "alice-server\|faber-server\|verifier-server"; then
    echo "2. Start the applications:"
    echo "   ./manage.sh start"
    echo "   OR manually: cd demo && pm2 start ../deploy/ecosystem-npm.config.json"
    NEEDS_START=true
fi

if ! sudo systemctl is-active nginx &>/dev/null; then
    echo "3. Start nginx:"
    echo "   sudo systemctl start nginx"
fi

echo ""
echo "📋 QUICK FIX COMMANDS"
echo "====================="
echo "# Install missing dependencies:"
echo "sudo npm install -g ts-node typescript"
echo ""
echo "# Install project dependencies:"
echo "cd /var/www/credo-ts && pnpm install"
echo ""
echo "# Start services:"
echo "cd /var/www/credo-ts/deploy && ./manage.sh start"
echo ""
echo "# Check status:"
echo "pm2 status"
echo "curl http://localhost:3001/health"
echo "curl http://localhost:3002/health"
echo "curl http://localhost:3003/health"

echo ""
echo "🔍 For more specific troubleshooting, run:"
echo "./troubleshoot-tsnode.sh"
