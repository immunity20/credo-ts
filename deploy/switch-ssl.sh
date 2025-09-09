#!/bin/bash
# Switch between HTTP and HTTPS nginx configurations

# Variables
NGINX_SITES="/etc/nginx/sites-available"
NGINX_ENABLED="/etc/nginx/sites-enabled"
PROJECT_DIR="/var/www/credo-ts"

case "$1" in
    http)
        echo "🔄 Switching to HTTP configurations..."
        
        # Copy HTTP configs
        sudo cp $PROJECT_DIR/deploy/nginx-holder.conf $NGINX_SITES/holder.yanis.gr
        sudo cp $PROJECT_DIR/deploy/nginx-issuer.conf $NGINX_SITES/issuer.yanis.gr
        sudo cp $PROJECT_DIR/deploy/nginx-verifier.conf $NGINX_SITES/verifier.yanis.gr
        
        # Test and reload
        sudo nginx -t
        if [ $? -eq 0 ]; then
            sudo systemctl reload nginx
            echo "✅ Switched to HTTP configurations"
            echo "🌐 Servers available at:"
            echo "   - http://holder.yanis.gr"
            echo "   - http://issuer.yanis.gr"
            echo "   - http://verifier.yanis.gr"
        else
            echo "❌ Nginx configuration error"
            exit 1
        fi
        ;;
    https)
        echo "🔄 Switching to HTTPS configurations..."
        
        # Check if SSL certificates exist
        if [ ! -f "/etc/letsencrypt/live/holder.yanis.gr/fullchain.pem" ]; then
            echo "❌ SSL certificates not found!"
            echo "Run './setup-ssl.sh' first to obtain SSL certificates"
            exit 1
        fi
        
        # Copy HTTPS configs
        sudo cp $PROJECT_DIR/deploy/nginx-holder-https.conf $NGINX_SITES/holder.yanis.gr
        sudo cp $PROJECT_DIR/deploy/nginx-issuer-https.conf $NGINX_SITES/issuer.yanis.gr
        sudo cp $PROJECT_DIR/deploy/nginx-verifier-https.conf $NGINX_SITES/verifier.yanis.gr
        
        # Test and reload
        sudo nginx -t
        if [ $? -eq 0 ]; then
            sudo systemctl reload nginx
            echo "✅ Switched to HTTPS configurations"
            echo "🌐 Servers available at:"
            echo "   - https://holder.yanis.gr"
            echo "   - https://issuer.yanis.gr"
            echo "   - https://verifier.yanis.gr"
        else
            echo "❌ Nginx configuration error"
            exit 1
        fi
        ;;
    status)
        echo "📊 Current SSL certificate status:"
        sudo certbot certificates 2>/dev/null || echo "❌ No SSL certificates found"
        
        echo ""
        echo "📊 Current nginx configurations:"
        for site in holder.yanis.gr issuer.yanis.gr verifier.yanis.gr; do
            if [ -f "$NGINX_SITES/$site" ]; then
                if grep -q "listen 443 ssl" "$NGINX_SITES/$site"; then
                    echo "   $site: HTTPS ✅"
                else
                    echo "   $site: HTTP"
                fi
            else
                echo "   $site: Not configured ❌"
            fi
        done
        ;;
    test)
        echo "🧪 Testing all endpoints..."
        
        for subdomain in holder issuer verifier; do
            echo "Testing $subdomain.yanis.gr..."
            
            # Test HTTP
            if curl -s -o /dev/null -w "%{http_code}" "http://$subdomain.yanis.gr/health" | grep -q "200\|301\|302"; then
                echo "   HTTP: ✅"
            else
                echo "   HTTP: ❌"
            fi
            
            # Test HTTPS
            if curl -s -o /dev/null -w "%{http_code}" "https://$subdomain.yanis.gr/health" | grep -q "200"; then
                echo "   HTTPS: ✅"
            else
                echo "   HTTPS: ❌"
            fi
            echo ""
        done
        ;;
    *)
        echo "Usage: $0 {http|https|status|test}"
        echo ""
        echo "Commands:"
        echo "  http    - Switch to HTTP configurations"
        echo "  https   - Switch to HTTPS configurations"
        echo "  status  - Show current SSL and config status"
        echo "  test    - Test all endpoints"
        echo ""
        echo "Examples:"
        echo "  $0 http     # Use HTTP (for development)"
        echo "  $0 https    # Use HTTPS (for production)"
        echo "  $0 status   # Check current setup"
        echo "  $0 test     # Test all endpoints"
        exit 1
        ;;
esac
