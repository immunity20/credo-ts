#!/bin/bash
# Management script for Credo-TS deployment

# Variables
ECOSYSTEM_NPM="/var/www/credo-ts/deploy/ecosystem-npm.config.json"
ECOSYSTEM_TSNODE="/var/www/credo-ts/deploy/ecosystem.config.json"
ECOSYSTEM_FIXED="/var/www/credo-ts/deploy/ecosystem-fixed.config.json"

case "$1" in
    start)
        echo "🚀 Starting all servers..."
        
        # Stop any existing processes first
        pm2 delete all 2>/dev/null || true
        
        # Try the fixed configuration first
        echo "Trying fixed configuration..."
        if pm2 start $ECOSYSTEM_FIXED; then
            echo "✅ Started with fixed configuration"
        elif pm2 start $ECOSYSTEM_NPM; then
            echo "✅ Started with npm scripts"
        else
            echo "⚠️  Both methods failed, trying ts-node directly..."
            pm2 start $ECOSYSTEM_TSNODE
        fi
        
        # Wait a moment for services to start
        sleep 3
        
        # Check if services are actually running
        echo "🔍 Checking service health..."
        pm2 status
        
        for port in 3001 3002 3003; do
            if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$port/health" | grep -q "200"; then
                echo "✅ Port $port: Service responding"
            else
                echo "❌ Port $port: Service not responding"
            fi
        done
        ;;
    manual-start)
        echo "🚀 Starting servers manually (bypassing config files)..."
        /var/www/credo-ts/deploy/manual-start.sh
        ;;
    emergency-fix)
        echo "🚨 Running emergency fix for PM2 issues..."
        /var/www/credo-ts/deploy/emergency-fix.sh
        ;;
    fix-tsnode)
        echo "🔧 Fixing ts-node installation..."
        /var/www/credo-ts/deploy/fix-tsnode.sh
        ;;
    stop)
        echo "🛑 Stopping all servers..."
        pm2 delete all
        ;;
    restart)
        echo "🔄 Restarting all servers..."
        pm2 restart all
        ;;
    status)
        echo "📊 Server status:"
        pm2 status
        ;;
    logs)
        echo "📝 Showing logs (press Ctrl+C to exit):"
        pm2 logs
        ;;
    logs-alice)
        echo "📝 Showing Alice logs:"
        pm2 logs alice-server
        ;;
    logs-faber)
        echo "📝 Showing Faber logs:"
        pm2 logs faber-server
        ;;
    logs-verifier)
        echo "📝 Showing Verifier logs:"
        pm2 logs verifier-server
        ;;
    troubleshoot)
        echo "🔍 Running troubleshooting..."
        /var/www/credo-ts/deploy/troubleshoot-tsnode.sh
        ;;
    diagnose)
        echo "🔍 Running full diagnosis..."
        /var/www/credo-ts/deploy/diagnose.sh
        ;;
    update)
        echo "📦 Updating deployment..."
        cd /var/www/credo-ts
        git pull origin main
        pnpm install
        pnpm build
        pm2 restart all
        echo "✅ Update completed!"
        ;;
    nginx-reload)
        echo "⚙️ Reloading nginx..."
        sudo nginx -t && sudo systemctl reload nginx
        ;;
    nginx-status)
        echo "📊 Nginx status:"
        sudo systemctl status nginx
        ;;
    *)
        echo "Usage: $0 {start|manual-start|emergency-fix|fix-tsnode|stop|restart|status|logs|logs-alice|logs-faber|logs-verifier|troubleshoot|diagnose|update|nginx-reload|nginx-status}"
        echo ""
        echo "Commands:"
        echo "  start          - Start all servers (tries multiple methods)"
        echo "  manual-start   - Start servers manually (bypassing config files)"
        echo "  emergency-fix  - Emergency fix for PM2 crashes and ts-node issues"
        echo "  fix-tsnode     - Fix ts-node installation specifically"
        echo "  stop           - Stop all servers"
        echo "  restart        - Restart all servers"
        echo "  status         - Show PM2 status"
        echo "  logs           - Show all logs"
        echo "  logs-alice     - Show Alice server logs"
        echo "  logs-faber     - Show Faber server logs"
        echo "  logs-verifier  - Show Verifier server logs"
        echo "  troubleshoot   - Run ts-node troubleshooting"
        echo "  diagnose       - Run full system diagnosis"
        echo "  update         - Update code and restart"
        echo "  nginx-reload   - Reload nginx configuration"
        echo "  nginx-status   - Show nginx status"
        exit 1
        ;;
esac
