#!/bin/bash
# Make all deployment scripts executable

echo "🔧 Setting up deployment scripts..."

# Make all scripts executable
chmod +x install-dependencies.sh
chmod +x deploy.sh
chmod +x setup-ssl.sh
chmod +x switch-ssl.sh
chmod +x manage.sh
chmod +x troubleshoot-tsnode.sh
chmod +x diagnose.sh
chmod +x quick-fix.sh
chmod +x manual-start.sh
chmod +x emergency-fix.sh
chmod +x fix-tsnode.sh
chmod +x restart-faber.sh

echo "✅ All scripts are now executable!"
echo ""
echo "📋 Available scripts:"
echo "  ./install-dependencies.sh  - Install required software"
echo "  ./deploy.sh                - Deploy the application"
echo "  ./setup-ssl.sh             - Setup SSL certificates"
echo "  ./switch-ssl.sh            - Switch between HTTP/HTTPS"
echo "  ./manage.sh                - Manage running services"
echo "  ./troubleshoot-tsnode.sh   - Troubleshoot ts-node issues"
echo "  ./diagnose.sh              - Full system diagnosis"
echo "  ./quick-fix.sh             - Quick fix for common issues"
echo "  ./manual-start.sh          - Manual server start (bypasses config files)"
echo "  ./emergency-fix.sh         - Emergency fix for PM2 crashes"
echo "  ./fix-tsnode.sh            - Fix ts-node installation specifically"
echo ""
echo "🚀 Quick start:"
echo "  1. ./install-dependencies.sh"
echo "  2. ./deploy.sh"
echo "  3. ./setup-ssl.sh (for HTTPS - recommended)"
echo ""
echo "🆘 Emergency troubleshooting (for your current issue):"
echo "  ./manage.sh emergency-fix  - Fix PM2 crashes and ts-node issues"
echo "  ./manage.sh fix-tsnode     - Fix ts-node installation only"
echo ""
echo "🔧 If you have connection issues:"
echo "  ./diagnose.sh              - Diagnose the problem"
echo "  ./quick-fix.sh             - Try to fix common issues automatically"
echo "  ./manage.sh manual-start   - Manual start if config files fail"
echo ""
echo "🔧 Management commands:"
echo "  ./switch-ssl.sh https      - Enable HTTPS"
echo "  ./switch-ssl.sh http       - Disable HTTPS"
echo "  ./switch-ssl.sh status     - Check SSL status"
echo "  ./switch-ssl.sh test       - Test endpoints"
