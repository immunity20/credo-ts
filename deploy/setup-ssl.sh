#!/bin/bash
# SSL Setup with Let's Encrypt for Credo-TS subdomains

echo "🔒 Setting up SSL certificates with Let's Encrypt..."

# Variables
NGINX_SITES="/etc/nginx/sites-available"
NGINX_ENABLED="/etc/nginx/sites-enabled"
PROJECT_DIR="/var/www/credo-ts"

# Install certbot
echo "📦 Installing certbot..."
sudo apt update
sudo apt install certbot python3-certbot-nginx -y

# Verify nginx is running
echo "🔍 Checking nginx status..."
sudo systemctl status nginx --no-pager

# Test nginx configuration before proceeding
echo "🧪 Testing nginx configuration..."
sudo nginx -t

if [ $? -ne 0 ]; then
    echo "❌ Nginx configuration has errors. Please fix them before setting up SSL."
    exit 1
fi

echo "✅ Nginx configuration is valid"

# Get SSL certificates for all subdomains
echo "🔐 Obtaining SSL certificates..."
echo "Note: Make sure your DNS records are pointing to this server before proceeding!"
read -p "Press Enter to continue or Ctrl+C to cancel..."

# First, try to get certificates using nginx plugin (automatic)
if sudo certbot --nginx -d holder.yanis.gr -d issuer.yanis.gr -d verifier.yanis.gr --agree-tos --no-eff-email --non-interactive; then
    echo "✅ SSL certificates obtained successfully with nginx plugin!"
else
    echo "⚠️  Nginx plugin failed, trying webroot method..."
    
    # Fallback to webroot method
    # Create webroot directory
    sudo mkdir -p /var/www/html/.well-known/acme-challenge
    
    # Get certificates using webroot
    sudo certbot certonly --webroot -w /var/www/html -d holder.yanis.gr -d issuer.yanis.gr -d verifier.yanis.gr --agree-tos --no-eff-email --non-interactive
    
    if [ $? -eq 0 ]; then
        echo "✅ SSL certificates obtained successfully with webroot method!"
        
        # Replace HTTP configs with HTTPS configs
        echo "🔄 Updating nginx configurations for HTTPS..."
        
        sudo cp $PROJECT_DIR/deploy/nginx-holder-https.conf $NGINX_SITES/holder.yanis.gr
        sudo cp $PROJECT_DIR/deploy/nginx-issuer-https.conf $NGINX_SITES/issuer.yanis.gr
        sudo cp $PROJECT_DIR/deploy/nginx-verifier-https.conf $NGINX_SITES/verifier.yanis.gr
        
        # Test configuration
        sudo nginx -t
        
        if [ $? -eq 0 ]; then
            sudo systemctl reload nginx
            echo "✅ Nginx reloaded with HTTPS configurations!"
        else
            echo "❌ Nginx configuration error after SSL setup"
            exit 1
        fi
    else
        echo "❌ Failed to obtain SSL certificates"
        exit 1
    fi
fi

# Setup auto-renewal
echo "🔄 Setting up auto-renewal..."
(sudo crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | sudo crontab -

# Test renewal
echo "🧪 Testing certificate renewal..."
sudo certbot renew --dry-run

if [ $? -eq 0 ]; then
    echo "✅ SSL certificate auto-renewal test passed!"
else
    echo "⚠️  SSL certificate auto-renewal test failed"
fi

echo ""
echo "🎉 SSL setup completed!"
echo "🌐 Your servers are now available with HTTPS:"
echo "   - Alice (Holder): https://holder.yanis.gr"
echo "   - Faber (Issuer): https://issuer.yanis.gr"
echo "   - Verifier: https://verifier.yanis.gr"
echo ""
echo "📋 Certificate information:"
sudo certbot certificates

echo ""
echo "🔧 Useful commands:"
echo "   sudo certbot certificates        # List certificates"
echo "   sudo certbot renew              # Manually renew certificates"
echo "   sudo certbot delete              # Delete certificates"
echo "   sudo systemctl reload nginx     # Reload nginx after changes"
