#!/usr/bin/env bash
set -e

# Monorepo Sparse Checkout Helper
MODE="${1:-status}"

case "$MODE" in
  gateway)
    echo "Configuring sparse checkout for Node.js Gateway..."
    git sparse-checkout set proto gateway scripts README.md .gitignore
    echo "Sparse checkout set to: proto, gateway"
    ls -la
    ;;
  data-service|python)
    echo "Configuring sparse checkout for Python Data Service..."
    git sparse-checkout set proto data-service scripts README.md .gitignore
    echo "Sparse checkout set to: proto, data-service"
    ls -la
    ;;
  all|full|disable)
    echo "Disabling sparse checkout (full monorepo)..."
    git sparse-checkout disable
    echo "Full monorepo checked out."
    ls -la
    ;;
  status)
    echo "Current sparse checkout status:"
    git sparse-checkout list 2>/dev/null || echo "Sparse checkout not enabled."
    ;;
  *)
    echo "Usage: $0 {gateway | data-service | all | status}"
    exit 1
    ;;
esac
