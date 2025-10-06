#!/bin/bash
# Ubuntu Server Setup Script for Credo-TS REST Servers

echo "🚀 Setting up Ubuntu server for Credo-TS deployment..."

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Python and build tools for node-gyp
sudo apt install -y python3 python3-pip build-essential

# Install pnpm
npm install -g pnpm

# Install PM2
npm install -g pm2

# Install ts-node globally for PM2
npm install -g ts-node typescript

# Install nginx
sudo apt install nginx -y

# Install git (if not already installed)
sudo apt install git -y

# Start and enable services
sudo systemctl start nginx
sudo systemctl enable nginx

# Setup PM2 to start on boot
pm2 startup
# Note: Follow the instructions printed by pm2 startup command

echo "✅ Dependencies installed successfully!"
echo "📋 Installed versions:"
echo "Node.js: $(node --version)"
echo "npm: $(npm --version)"
echo "pnpm: $(pnpm --version)"
echo "PM2: $(pm2 --version)"
echo "nginx: $(nginx -v)"
