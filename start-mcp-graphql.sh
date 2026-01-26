#!/usr/bin/env bash

# Django GraphQL MCP Server Startup Script
# This script loads environment variables and starts the MCP server

set -a  # Auto-export variables

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load environment from .env file if it exists
if [ -f "$SCRIPT_DIR/.env" ]; then
    echo "Loading configuration from .env file..." >&2
    source "$SCRIPT_DIR/.env"
fi

set +a

# Set defaults if not provided
export ENDPOINT="${ENDPOINT:-http://localhost:8000/graphql}"
export HEADERS="${HEADERS:-{}}"
export ALLOW_MUTATIONS="${ALLOW_MUTATIONS:-false}"
export NAME="${NAME:-django-graphql-mcp-server}"

# Validate configuration
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed or not in PATH" >&2
    exit 1
fi

# Check if we're in development or production mode
if [ -f "$SCRIPT_DIR/package.json" ]; then
    # Development mode - use tsx for TypeScript execution
    if [ -f "$SCRIPT_DIR/src/index.ts" ]; then
        echo "Starting Django GraphQL MCP Server (development mode)..." >&2
        exec npx tsx "$SCRIPT_DIR/src/index.ts"
    # Production mode - use compiled JavaScript
    elif [ -f "$SCRIPT_DIR/dist/index.js" ]; then
        echo "Starting Django GraphQL MCP Server (production mode)..." >&2
        exec node "$SCRIPT_DIR/dist/index.js"
    else
        echo "Error: Neither src/index.ts nor dist/index.js found" >&2
        exit 1
    fi
else
    echo "Error: package.json not found. Please run this script from the project directory." >&2
    exit 1
fi