#!/bin/bash

# Restart Verifier (VerifierRestServer) script
# This applies the connection invitation timeout fix

echo "🔄 Restarting Verifier server..."

# Stop the verifier server
echo "⏹️ Stopping verifier server..."
pm2 stop verifier

# Wait a moment
sleep 2

# Start the verifier server
echo "🚀 Starting verifier server..."
pm2 start verifier

echo "✅ Verifier server restarted!"
echo ""
echo "🔍 Check server status:"
echo "pm2 list"
echo "pm2 logs verifier"
echo ""
echo "🧪 Test the fixed connection invitation:"
echo "curl -X POST http://verifier.yanis.gr/connection/create-invitation"
echo ""
echo "✨ Verifier connection invitations should now return immediately without blocking!"
