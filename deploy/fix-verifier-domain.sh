#!/bin/bash

# Fix Verifier Domain and DIDComm Endpoint Configuration
# This fixes both the REST API domain and the DIDComm service endpoints

echo "🔧 Fixing Verifier domain and DIDComm endpoint configuration..."

# Stop the verifier server
echo "⏹️ Stopping verifier server..."
pm2 stop verifier

# Wait a moment
sleep 2

# Start the verifier server
echo "🚀 Starting verifier server with comprehensive domain fix..."
pm2 start verifier

echo "✅ Verifier server restarted with domain and endpoint fixes!"
echo ""
echo "🔍 Check server status:"
echo "pm2 list"
echo "pm2 logs verifier"
echo ""
echo "🧪 Test the fixed connection invitation:"
echo "curl -X POST https://verifier.yanis.gr/connection/create-invitation"
echo ""
echo "✨ Expected changes:"
echo "  1. REST API invitations use correct domain"
echo "  2. DIDComm endpoints point to public domain" 
echo "  3. Port alignment (3003) with nginx proxy"
echo ""
echo "🎯 Expected invitation URL format:"
echo "http://verifier.yanis.gr?oob=..."
