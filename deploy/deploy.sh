#!/bin/bash
# Deployment script for Credo-TS REST servers

echo "🚀 Deploying Credo-TS REST servers..."

# Variables
PROJECT_DIR="/var/www/credo-ts"
NGINX_SITES="/etc/nginx/sites-available"
NGINX_ENABLED="/etc/nginx/sites-enabled"

# Clone or update repository
if [ -d "$PROJECT_DIR" ]; then
    echo "📁 Updating existing repository..."
    cd $PROJECT_DIR
    git pull origin main
else
    echo "📁 Cloning repository..."
    sudo mkdir -p /var/www
    sudo git clone https://github.com/openwallet-foundation/credo-ts.git $PROJECT_DIR
    sudo chown -R $USER:$USER $PROJECT_DIR
    cd $PROJECT_DIR
fi

# Install dependencies
echo "📦 Installing dependencies..."
cd $PROJECT_DIR
pnpm install

# Build the project
echo "🔨 Building project..."
pnpm build

# Create logs directory
mkdir -p $PROJECT_DIR/demo/logs

# Setup nginx configurations
echo "⚙️ Setting up nginx configurations..."

# Copy nginx configs
sudo cp $PROJECT_DIR/deploy/nginx-holder.conf $NGINX_SITES/holder.yanis.gr
sudo cp $PROJECT_DIR/deploy/nginx-issuer.conf $NGINX_SITES/issuer.yanis.gr
sudo cp $PROJECT_DIR/deploy/nginx-verifier.conf $NGINX_SITES/verifier.yanis.gr

# Enable sites
sudo ln -sf $NGINX_SITES/holder.yanis.gr $NGINX_ENABLED/
sudo ln -sf $NGINX_SITES/issuer.yanis.gr $NGINX_ENABLED/
sudo ln -sf $NGINX_SITES/verifier.yanis.gr $NGINX_ENABLED/

# Remove default nginx site
sudo rm -f $NGINX_ENABLED/default

# Test nginx configuration
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Nginx configuration is valid"
    sudo systemctl reload nginx
else
    echo "❌ Nginx configuration has errors"
    exit 1
fi

# Update PM2 ecosystem config with correct path
sed -i "s|/path/to/your/credo-ts/demo|$PROJECT_DIR/demo|g" $PROJECT_DIR/deploy/ecosystem.config.json
sed -i "s|/path/to/your/credo-ts/demo|$PROJECT_DIR/demo|g" $PROJECT_DIR/deploy/ecosystem-npm.config.json
sed -i "s|/path/to/your/credo-ts/demo|$PROJECT_DIR/demo|g" $PROJECT_DIR/deploy/ecosystem-fixed.config.json

# Start applications with PM2
echo "🚀 Starting applications with PM2..."
cd $PROJECT_DIR/demo

# Stop existing processes (if any)
pm2 delete all 2>/dev/null || true

# Try the fixed configuration first (most reliable)
echo "Trying fixed configuration..."
if pm2 start $PROJECT_DIR/deploy/ecosystem-fixed.config.json; then
    echo "✅ Started with fixed configuration"
elif pm2 start $PROJECT_DIR/deploy/ecosystem-npm.config.json; then
    echo "✅ Started with npm scripts"
else
    echo "⚠️  Trying ts-node configuration..."
    pm2 start $PROJECT_DIR/deploy/ecosystem.config.json
fi

# Save PM2 configuration
pm2 save

echo "✅ Deployment completed!"
echo ""
echo "🌐 Your servers are now available at:"
echo "   - Alice (Holder): http://holder.yanis.gr"
echo "   - Faber (Issuer): http://issuer.yanis.gr"
echo "   - Verifier: http://verifier.yanis.gr"
echo ""
echo "� To enable HTTPS (recommended for production):"
echo "   ./setup-ssl.sh"
echo ""
echo "�📊 Check status with: pm2 status"
echo "📝 View logs with: pm2 logs"
echo "🔄 Restart apps with: pm2 restart all"
echo "🔧 Switch to HTTPS: ./switch-ssl.sh https"
