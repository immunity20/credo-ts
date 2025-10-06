#!/bin/bash
# ts-node installation and verification script

echo "🔧 Fixing ts-node installation..."

echo ""
echo "📋 Current Node.js environment:"
echo "Node.js: $(node --version)"
echo "npm: $(npm --version)"
echo "Global modules path: $(npm root -g)"

echo ""
echo "🧹 Cleaning previous installations..."
# Remove existing ts-node installations
sudo npm uninstall -g ts-node typescript 2>/dev/null || true

# Clear npm cache
npm cache clean --force

echo ""
echo "📦 Installing ts-node and typescript globally..."
sudo npm install -g ts-node@latest typescript@latest

echo ""
echo "🔍 Verifying global installation..."
echo "ts-node location: $(which ts-node)"
echo "ts-node version: $(ts-node --version)"
echo "TypeScript version: $(tsc --version)"

echo ""
echo "📁 Installing locally in project..."
cd /var/www/credo-ts
npm install ts-node typescript --save-dev

cd /var/www/credo-ts/demo
npm install ts-node typescript --save-dev

echo ""
echo "🔍 Verifying local installations..."
echo "Project ts-node: $(ls /var/www/credo-ts/node_modules/.bin/ts-node 2>/dev/null || echo 'Not found')"
echo "Demo ts-node: $(ls /var/www/credo-ts/demo/node_modules/.bin/ts-node 2>/dev/null || echo 'Not found')"

echo ""
echo "🧪 Testing ts-node functionality..."
cd /var/www/credo-ts/demo

# Test if ts-node can compile a simple TypeScript
echo "console.log('ts-node test successful');" > test-ts-node.ts

if ts-node test-ts-node.ts 2>/dev/null; then
    echo "✅ Global ts-node works"
else
    echo "❌ Global ts-node failed"
fi

if ./node_modules/.bin/ts-node test-ts-node.ts 2>/dev/null; then
    echo "✅ Local ts-node works"
else
    echo "❌ Local ts-node failed"
fi

rm -f test-ts-node.ts

echo ""
echo "🔧 PM2 TypeScript setup..."
# Ensure PM2 can find ts-node
pm2 install typescript

echo ""
echo "📊 Final verification:"
echo "Global ts-node: $(which ts-node)"
echo "PM2 can access ts-node: $(pm2 prettylist | grep -i typescript || echo 'Not installed')"

echo ""
echo "✅ ts-node setup completed!"
echo ""
echo "💡 To use with PM2:"
echo "  Option 1: pm2 start script.ts --interpreter $(which ts-node)"
echo "  Option 2: Use ecosystem config with 'interpreter': '$(which ts-node)'"
echo "  Option 3: pm2 start ts-node -- script.ts"
