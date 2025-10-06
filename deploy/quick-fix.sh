#!/bin/bash
# Quick fix script for common Credo-TS deployment issues

echo "🚀 Quick Fix for Credo-TS deployment issues..."

# Variables
PROJECT_DIR="/var/www/credo-ts"
DEMO_DIR="$PROJECT_DIR/demo"

# Check if project directory exists
if [ ! -d "$PROJECT_DIR" ]; then
    echo "❌ Project directory not found. Please run ./deploy.sh first"
    exit 1
fi

cd $PROJECT_DIR

echo ""
echo "1. 🔧 Installing missing dependencies..."

# Install global dependencies
echo "Installing global ts-node and typescript..."
sudo npm install -g ts-node typescript

# Install project dependencies
echo "Installing project dependencies..."
pnpm install

# Install demo dependencies
if [ -d "$DEMO_DIR" ]; then
    echo "Installing demo dependencies..."
    cd $DEMO_DIR
    pnpm install
    cd $PROJECT_DIR
fi

echo ""
echo "2. 🛑 Stopping any existing PM2 processes..."
pm2 delete all 2>/dev/null || echo "No existing processes to stop"

echo ""
echo "3. 🚀 Starting services with PM2..."

# Try different approaches to start the services
cd $DEMO_DIR

echo "Trying fixed ecosystem configuration..."
if pm2 start $PROJECT_DIR/deploy/ecosystem-fixed.config.json; then
    echo "✅ Started with fixed configuration"
elif pm2 start $PROJECT_DIR/deploy/ecosystem-npm.config.json; then
    echo "✅ Started with npm scripts"
elif pm2 start $PROJECT_DIR/deploy/ecosystem.config.json; then
    echo "✅ Started with ts-node"
else
    echo "❌ All PM2 configs failed. Trying manual start..."
    
    # Manual start as fallback
    echo "Starting Alice server manually..."
    pm2 start ts-node --name alice-server --cwd $DEMO_DIR -- src/AliceRestServer.ts
    sleep 2
    
    echo "Starting Faber server manually..."
    pm2 start ts-node --name faber-server --cwd $DEMO_DIR -- src/FaberRestServer.ts
    sleep 2
    
    echo "Starting Verifier server manually..."
    NODE_ENV=production PORT=3003 pm2 start ts-node --name verifier-server --cwd $DEMO_DIR -- src/VerifierRestServer.ts
    sleep 2
fi

echo ""
echo "4. 💾 Saving PM2 configuration..."
pm2 save

echo ""
echo "5. 🌐 Checking nginx..."
if ! sudo systemctl is-active nginx &>/dev/null; then
    echo "Starting nginx..."
    sudo systemctl start nginx
fi

sudo nginx -t && sudo systemctl reload nginx

echo ""
echo "6. 🧪 Testing connections..."
sleep 5  # Give services time to start

for port in 3001 3002 3003; do
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$port/health" | grep -q "200"; then
        echo "✅ Port $port is responding"
    else
        echo "❌ Port $port is not responding"
    fi
done

echo ""
echo "7. 📊 Final status check..."
pm2 status

echo ""
echo "🎉 Quick fix completed!"
echo ""
echo "🌐 Test your endpoints:"
echo "  curl http://holder.yanis.gr/health"
echo "  curl http://issuer.yanis.gr/health"
echo "  curl http://verifier.yanis.gr/health"
echo ""
echo "📝 View logs if issues persist:"
echo "  pm2 logs"
echo "  ./manage.sh diagnose"
