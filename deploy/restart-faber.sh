#!/bin/bash
# Quick restart script for Faber server after fixing the connection issue

echo "🔧 Restarting Faber server with connection invitation fix..."

# Stop existing PM2 processes
echo "🛑 Stopping existing processes..."
pm2 delete faber-server 2>/dev/null || true

# Start Faber server
echo "🚀 Starting Faber server..."
cd /var/www/credo-ts/demo

pm2 start ts-node \
    --name faber-server \
    --cwd /var/www/credo-ts/demo \
    --output logs/faber-out.log \
    --error logs/faber-error.log \
    --log logs/faber-combined.log \
    --time \
    --max-restarts 3 \
    --min-uptime "10s" \
    -- src/FaberRestServer.ts

echo ""
echo "⏳ Waiting for Faber server to start..."
sleep 5

echo ""
echo "🧪 Testing Faber server..."
if curl -s http://localhost:3002/health >/dev/null; then
    echo "✅ Faber server is responding on port 3002"
else
    echo "❌ Faber server is not responding"
    echo "📝 Checking logs..."
    pm2 logs faber-server --lines 10 --nostream
fi

echo ""
echo "📊 PM2 Status:"
pm2 status

echo ""
echo "🎯 Test the fixed connection invitation:"
echo "  curl -X POST http://localhost:3002/connection/create-invitation"
echo ""
echo "📝 Check connection status:"
echo "  curl http://localhost:3002/connections"
