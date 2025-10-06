#!/bin/bash

# 🧪 Alice NAT Compatibility Test
# This script tests if Alice can work behind NAT by checking outbound connectivity

echo "🔍 Testing Alice NAT Compatibility..."
echo "=================================="

# Test 1: Check Node.js version
echo "📋 Test 1: Node.js Version"
node_version=$(node --version 2>/dev/null | sed 's/v//')
if [ -z "$node_version" ]; then
    echo "❌ Node.js not installed"
    exit 1
else
    major_version=$(echo $node_version | cut -d. -f1)
    if [ "$major_version" -ge 18 ]; then
        echo "✅ Node.js $node_version (Compatible)"
    else
        echo "⚠️  Node.js $node_version (Upgrade to 18+ recommended)"
    fi
fi

# Test 2: Check internet connectivity
echo -e "\n📡 Test 2: Internet Connectivity"
if ping -c 1 8.8.8.8 > /dev/null 2>&1; then
    echo "✅ Internet connection available"
else
    echo "❌ No internet connection"
    exit 1
fi

# Test 3: Check DNS resolution
echo -e "\n🌐 Test 3: DNS Resolution"
if nslookup issuer.yanis.gr > /dev/null 2>&1; then
    echo "✅ issuer.yanis.gr resolves"
else
    echo "❌ Cannot resolve issuer.yanis.gr"
fi

if nslookup verifier.yanis.gr > /dev/null 2>&1; then
    echo "✅ verifier.yanis.gr resolves"
else
    echo "❌ Cannot resolve verifier.yanis.gr"
fi

# Test 4: Check HTTPS connectivity to servers
echo -e "\n🔐 Test 4: HTTPS Connectivity"

# Test Issuer
echo "Testing issuer.yanis.gr..."
issuer_response=$(curl -s -o /dev/null -w "%{http_code}" https://issuer.yanis.gr/api/status --connect-timeout 10)
if [ "$issuer_response" = "200" ]; then
    echo "✅ issuer.yanis.gr:443 accessible (HTTP $issuer_response)"
else
    echo "⚠️  issuer.yanis.gr:443 returned HTTP $issuer_response"
fi

# Test Verifier
echo "Testing verifier.yanis.gr..."
verifier_response=$(curl -s -o /dev/null -w "%{http_code}" https://verifier.yanis.gr/api/status --connect-timeout 10)
if [ "$verifier_response" = "200" ]; then
    echo "✅ verifier.yanis.gr:443 accessible (HTTP $verifier_response)"
else
    echo "⚠️  verifier.yanis.gr:443 returned HTTP $verifier_response"
fi

# Test 5: Check if running behind NAT
echo -e "\n🔒 Test 5: NAT Detection"
public_ip=$(curl -s ifconfig.me --connect-timeout 5)
local_ip=$(ip route get 8.8.8.8 | awk '{print $7}' | head -1)

if [ -n "$public_ip" ] && [ -n "$local_ip" ]; then
    if [ "$public_ip" != "$local_ip" ]; then
        echo "🏠 Behind NAT: Public IP ($public_ip) != Local IP ($local_ip)"
        echo "✅ Alice NAT-friendly architecture required and will work!"
    else
        echo "🌐 Direct internet connection: Public IP = Local IP ($public_ip)"
        echo "✅ Both NAT and direct connection architectures will work"
    fi
else
    echo "⚠️  Could not determine NAT status"
fi

# Test 6: Check available ports
echo -e "\n🔌 Test 6: Local Port Availability"
if command -v netstat > /dev/null 2>&1; then
    if netstat -tuln | grep -q ":3015 "; then
        echo "⚠️  Port 3015 already in use"
    else
        echo "✅ Port 3015 available for Alice"
    fi
else
    echo "ℹ️  netstat not available, skipping port check"
fi

# Test 7: Test npm and TypeScript
echo -e "\n📦 Test 7: Development Dependencies"
if command -v npm > /dev/null 2>&1; then
    echo "✅ npm available"
else
    echo "❌ npm not installed"
fi

if npm list -g typescript > /dev/null 2>&1; then
    echo "✅ TypeScript installed globally"
elif npm list typescript > /dev/null 2>&1; then
    echo "✅ TypeScript available locally"
else
    echo "ℹ️  TypeScript not installed (will be installed with project dependencies)"
fi

# Summary
echo -e "\n🎯 Compatibility Summary"
echo "========================"

if [ "$issuer_response" = "200" ] && [ "$verifier_response" = "200" ]; then
    echo "🎉 SUCCESS: Alice can run behind NAT!"
    echo ""
    echo "✅ All connectivity tests passed"
    echo "✅ Can reach both issuer and verifier servers"
    echo "✅ Outbound HTTPS connections work"
    echo "✅ Alice polling architecture will work perfectly"
    echo ""
    echo "🚀 Ready to deploy Alice on this network!"
    echo ""
    echo "Next steps:"
    echo "1. git clone your repository"
    echo "2. cd credo-ts/demo && npm install"
    echo "3. pm2 start src/AliceNATServer.ts --name alice-holder --interpreter=ts-node"
    echo "4. curl http://localhost:3015/status"
else
    echo "⚠️  PARTIAL SUCCESS: Some issues detected"
    echo ""
    echo "Issues found:"
    [ "$issuer_response" != "200" ] && echo "❌ Cannot reach issuer.yanis.gr"
    [ "$verifier_response" != "200" ] && echo "❌ Cannot reach verifier.yanis.gr"
    echo ""
    echo "🔧 Troubleshooting needed before deployment"
fi

echo -e "\n📊 Network Information"
echo "======================"
echo "Local IP: $local_ip"
echo "Public IP: $public_ip"
echo "Issuer status: HTTP $issuer_response"
echo "Verifier status: HTTP $verifier_response"
echo "Node.js: $node_version"
