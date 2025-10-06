#!/bin/bash
# Troubleshooting script for ts-node issues

echo "🔍 Troubleshooting ts-node installation..."

echo "📋 Checking Node.js and npm versions:"
echo "Node.js: $(node --version)"
echo "npm: $(npm --version)"
echo "pnpm: $(pnpm --version)"

echo ""
echo "🔍 Checking ts-node installation:"

# Check global ts-node
if command -v ts-node &> /dev/null; then
    echo "✅ ts-node is installed globally: $(which ts-node)"
    echo "Version: $(ts-node --version)"
else
    echo "❌ ts-node not found globally"
fi

# Check local ts-node in demo directory
DEMO_DIR="/var/www/credo-ts/demo"
if [ -f "$DEMO_DIR/node_modules/.bin/ts-node" ]; then
    echo "✅ ts-node found locally in demo: $DEMO_DIR/node_modules/.bin/ts-node"
else
    echo "❌ ts-node not found locally in demo"
fi

# Check root ts-node
ROOT_DIR="/var/www/credo-ts"
if [ -f "$ROOT_DIR/node_modules/.bin/ts-node" ]; then
    echo "✅ ts-node found locally in root: $ROOT_DIR/node_modules/.bin/ts-node"
else
    echo "❌ ts-node not found locally in root"
fi

echo ""
echo "🔧 Possible solutions:"

if ! command -v ts-node &> /dev/null; then
    echo "1. Install ts-node globally:"
    echo "   npm install -g ts-node typescript"
fi

if [ ! -f "$DEMO_DIR/node_modules/.bin/ts-node" ]; then
    echo "2. Install ts-node locally in demo:"
    echo "   cd $DEMO_DIR && pnpm add -D ts-node typescript"
fi

echo "3. Alternative: Use npm scripts instead of direct ts-node"
echo "   Use ecosystem-npm.config.json instead of ecosystem.config.json"

echo ""
echo "🧪 Testing ts-node execution:"
cd $DEMO_DIR 2>/dev/null || cd /var/www/credo-ts/demo 2>/dev/null || {
    echo "❌ Cannot find demo directory"
    exit 1
}

if [ -f "src/AliceRestServer.ts" ]; then
    echo "✅ Found AliceRestServer.ts"
    
    # Test different ways to run ts-node
    echo "Testing execution methods:"
    
    if command -v ts-node &> /dev/null; then
        echo "1. Global ts-node: Available"
    fi
    
    if [ -f "./node_modules/.bin/ts-node" ]; then
        echo "2. Local ts-node: Available"
    fi
    
    if npm run alice-server --dry-run &> /dev/null; then
        echo "3. npm script: Available"
    else
        echo "3. npm script: Not available (check package.json)"
    fi
else
    echo "❌ AliceRestServer.ts not found in src/"
fi

echo ""
echo "📄 Current package.json scripts:"
if [ -f "package.json" ]; then
    echo "$(cat package.json | grep -A 10 '"scripts"')"
else
    echo "❌ package.json not found"
fi
