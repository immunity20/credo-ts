#!/bin/bash

# Clean shutdown and restart verifier script
# This handles port conflicts and ensures clean startup

echo "🧹 Cleaning up verifier processes..."

# Stop PM2 verifier process
echo "⏹️ Stopping PM2 verifier process..."
pm2 stop verifier 2>/dev/null || echo "No PM2 verifier process found"
pm2 delete verifier 2>/dev/null || echo "No PM2 verifier process to delete"

# Find and kill any processes using ports 3003, 3004, and 9001
echo "🔍 Checking for processes using ports 3003, 3004, and 9001..."

for port in 3003 3004 9001; do
    PID=$(lsof -ti:$port 2>/dev/null || netstat -tlnp 2>/dev/null | grep ":$port " | awk '{print $7}' | cut -d'/' -f1)
    if [ ! -z "$PID" ]; then
        echo "📍 Found process $PID using port $port"
        kill -9 $PID 2>/dev/null && echo "✅ Killed process $PID on port $port" || echo "❌ Failed to kill process $PID"
    else
        echo "✅ Port $port is free"
    fi
done

# Wait a moment for processes to fully terminate
echo "⏳ Waiting for processes to terminate..."
sleep 3

# Check ports are actually free
echo "🔍 Final port check..."
for port in 3003 3004 9001; do
    if lsof -ti:$port >/dev/null 2>&1 || netstat -tln 2>/dev/null | grep -q ":$port "; then
        echo "⚠️ Warning: Port $port still in use"
    else
        echo "✅ Port $port is free"
    fi
done

echo ""
echo "🚀 Starting verifier with clean state..."

# Start the verifier server
pm2 start verifier

echo "✅ Verifier restart completed!"
echo ""
echo "🔍 Check status:"
echo "pm2 list"
echo "pm2 logs verifier --lines 20"
echo ""
echo "🧪 Test verifier:"
echo "curl -X POST https://verifier.yanis.gr/connection/create-invitation"
