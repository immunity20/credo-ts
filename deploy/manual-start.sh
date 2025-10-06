#!/bin/bash
# Manual start script for Credo-TS servers (bypasses PM2 config files)

echo "🚀 Starting Credo-TS servers manually..."

# Variables
PROJECT_DIR="/var/www/credo-ts"
DEMO_DIR="$PROJECT_DIR/demo"

# Check if demo directory exists
if [ ! -d "$DEMO_DIR" ]; then
    echo "❌ Demo directory not found: $DEMO_DIR"
    exit 1
fi

cd $DEMO_DIR

# Create logs directory
mkdir -p logs

# Stop any existing PM2 processes
echo "🛑 Stopping existing processes..."
pm2 delete all 2>/dev/null || true

# Check if ts-node is available
if ! command -v ts-node &> /dev/null && [ ! -f "node_modules/.bin/ts-node" ]; then
    echo "❌ ts-node not found. Installing..."
    sudo npm install -g ts-node typescript
fi

echo "🚀 Starting servers individually..."

# Start Alice server
echo "Starting Alice server on port 3001..."
pm2 start ts-node \
    --name alice-server \
    --cwd "$DEMO_DIR" \
    --output logs/alice-out.log \
    --error logs/alice-error.log \
    --log logs/alice-combined.log \
    --time \
    -- src/AliceRestServer.ts

sleep 2

# Start Faber server
echo "Starting Faber server on port 3002..."
pm2 start ts-node \
    --name faber-server \
    --cwd "$DEMO_DIR" \
    --output logs/faber-out.log \
    --error logs/faber-error.log \
    --log logs/faber-combined.log \
    --time \
    -- src/FaberRestServer.ts

sleep 2

# Start Verifier server (with environment variables)
echo "Starting Verifier server on port 3003..."
NODE_ENV=production \
PORT=3003 \
INFURA_API_KEY=your_infura_api_key_here \
PRIVATE_KEY=your_private_key_here \
pm2 start ts-node \
    --name verifier-server \
    --cwd "$DEMO_DIR" \
    --output logs/verifier-out.log \
    --error logs/verifier-error.log \
    --log logs/verifier-combined.log \
    --time \
    -- src/VerifierRestServer.ts

echo ""
echo "⏳ Waiting for services to start..."
sleep 5

echo ""
echo "📊 Checking PM2 status..."
pm2 status

echo ""
echo "🧪 Testing service health..."
for port in 3001 3002 3003; do
    echo -n "Port $port: "
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$port/health" | grep -q "200"; then
        echo "✅ Responding"
    else
        echo "❌ Not responding"
    fi
done

echo ""
echo "💾 Saving PM2 configuration..."
pm2 save

echo ""
echo "✅ Manual start completed!"
echo ""
echo "📝 Useful commands:"
echo "  pm2 status           # Check status"
echo "  pm2 logs             # View all logs"
echo "  pm2 restart all      # Restart all services"
echo "  pm2 delete all       # Stop all services"
echo ""
echo "🌐 Test endpoints:"
echo "  curl http://localhost:3001/health    # Alice"
echo "  curl http://localhost:3002/health    # Faber"
echo "  curl http://localhost:3003/health    # Verifier"
