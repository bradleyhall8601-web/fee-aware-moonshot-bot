#!/bin/bash
# scripts/deploy-docker.sh
# Docker deployment script

set -e

ACTION=${1:-help}
ENV_FILE=${2:-.env}

case $ACTION in
  build)
    echo "🔨 Building Docker image..."
    docker build -t fee-aware-moonshot-bot:latest .
    echo "✅ Build completed"
    ;;
    
  up)
    echo "🚀 Starting bot with Docker Compose..."
    if [ ! -f "$ENV_FILE" ]; then
      echo "❌ Error: $ENV_FILE not found"
      echo "Please create .env file first: cp .env.example .env"
      exit 1
    fi
    docker-compose up -d
    echo "✅ Bot started"
    docker-compose logs -f
    ;;
    
  down)
    echo "⛔ Stopping bot..."
    docker-compose down
    echo "✅ Bot stopped"
    ;;
    
  logs)
    echo "📋 Showing logs..."
    docker-compose logs -f bot
    ;;
    
  restart)
    echo "🔄 Restarting bot..."
    docker-compose restart bot
    echo "✅ Bot restarted"
    docker-compose logs -f bot
    ;;
    
  health)
    echo "🏥 Checking health..."
    docker-compose exec bot npm run health
    ;;
    
  shell)
    echo "🐚 Opening bot container shell..."
    docker-compose exec bot sh
    ;;
    
  push)
    REGISTRY=${REGISTRY:-}
    if [ -z "$REGISTRY" ]; then
      echo "❌ Error: REGISTRY environment variable not set"
      echo "Usage: REGISTRY=your-registry ./scripts/deploy-docker.sh push"
      exit 1
    fi
    
    echo "📤 Pushing to registry: $REGISTRY"
    docker tag fee-aware-moonshot-bot:latest $REGISTRY/fee-aware-moonshot-bot:latest
    docker push $REGISTRY/fee-aware-moonshot-bot:latest
    echo "✅ Push completed"
    ;;
    
  *)
    echo "Fee-Aware Moonshot Bot - Docker Deployment"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  build        - Build Docker image"
    echo "  up           - Start bot with Docker Compose"
    echo "  down         - Stop bot"
    echo "  logs         - View bot logs"
    echo "  restart      - Restart bot"
    echo "  health       - Check bot health"
    echo "  shell        - Open bot container shell"
    echo "  push         - Push image to registry (requires REGISTRY env var)"
    echo ""
    ;;
esac
