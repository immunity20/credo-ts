#!/bin/bash
# Emergency fix script for PM2 ts-node issues

echo "🚨 Emergency Fix for PM2 ts-node issues..."

# Stop ALL PM2 processes immediately
echo "🛑 Stopping all PM2 processes..."
pm2 kill
pm2 flush

# Remove PM2 logs and reset
echo "🧹 Cleaning PM2 cache..."
rm -rf ~/.pm2/logs/*
pm2 unstartup
pm2 kill

echo ""
echo "📦 Installing ts-node dependencies..."

# Install ts-node and typescript globally with specific versions
sudo npm uninstall -g ts-node typescript
sudo npm install -g ts-node@latest typescript@latest

# Also install locally in the project
cd /var/www/credo-ts
npm install ts-node typescript --save-dev

# Install in demo directory
cd /var/www/credo-ts/demo
npm install ts-node typescript --save-dev

echo ""
echo "🔍 Verifying ts-node installation..."
echo "Global ts-node: $(which ts-node)"
echo "Global ts-node version: $(ts-node --version)"
echo "Local ts-node: $(ls node_modules/.bin/ts-node 2>/dev/null || echo 'Not found')"

echo ""
echo "🚀 Starting servers with absolute paths..."

cd /var/www/credo-ts/demo

# Create logs directory
mkdir -p logs

# Start each server manually with absolute paths and error handling
echo "Starting Alice server..."
pm2 start \
    --name alice-server \
    --interpreter $(which ts-node) \
    --cwd /var/www/credo-ts/demo \
    --output logs/alice-out.log \
    --error logs/alice-error.log \
    --log logs/alice-combined.log \
    --time \
    --max-restarts 3 \
    --min-uptime "10s" \
    src/AliceRestServer.ts

sleep 3

echo "Starting Faber server..."
pm2 start \
    --name faber-server \
    --interpreter $(which ts-node) \
    --cwd /var/www/credo-ts/demo \
    --output logs/faber-out.log \
    --error logs/faber-error.log \
    --log logs/faber-combined.log \
    --time \
    --max-restarts 3 \
    --min-uptime "10s" \
    src/FaberRestServer.ts

sleep 3

echo "Starting Verifier server..."
NODE_ENV=production \
PORT=3003 \
pm2 start \
    --name verifier-server \
    --interpreter $(which ts-node) \
    --cwd /var/www/credo-ts/demo \
    --output logs/verifier-out.log \
    --error logs/verifier-error.log \
    --log logs/verifier-combined.log \
    --time \
    --max-restarts 3 \
    --min-uptime "10s" \
    src/VerifierRestServer.ts

echo ""
echo "⏳ Waiting for services to stabilize..."
sleep 10

echo ""
echo "📊 Checking PM2 status..."
pm2 status

echo ""
echo "🧪 Testing services..."
for port in 3001 3002 3003; do
    echo -n "Testing port $port: "
    if timeout 5 curl -s http://localhost:$port/health >/dev/null; then
        echo "✅ Responding"
    else
        echo "❌ Not responding"
        echo "  Checking logs for port $port..."
        case $port in
            3001) pm2 logs alice-server --lines 3 --nostream;;
            3002) pm2 logs faber-server --lines 3 --nostream;;
            3003) pm2 logs verifier-server --lines 3 --nostream;;
        esac
    fi
done

echo ""
echo "💾 Saving PM2 configuration..."
pm2 save

echo ""
echo "✅ Emergency fix completed!"
echo ""
echo "📝 If issues persist, check individual logs:"
echo "  pm2 logs alice-server"
echo "  pm2 logs faber-server"
echo "  pm2 logs verifier-server"
echo ""
echo "🔧 Manual commands to restart if needed:"
echo "  pm2 restart alice-server"
echo "  pm2 restart faber-server"
echo "  pm2 restart verifier-server"
