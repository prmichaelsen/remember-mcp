#!/bin/bash

# ACP Version Check Script
# Extracts and displays the current ACP version from AGENT.md

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if AGENT.md exists
if [ ! -f "AGENT.md" ]; then
    echo "Error: AGENT.md not found in current directory"
    echo "This script should be run from your project root where AGENT.md is located."
    exit 1
fi

# Extract version from AGENT.md
VERSION=$(grep -m 1 "^\*\*Version\*\*:" AGENT.md | sed 's/.*: //')
CREATED=$(grep -m 1 "^\*\*Created\*\*:" AGENT.md | sed 's/.*: //')
STATUS=$(grep -m 1 "^\*\*Status\*\*:" AGENT.md | sed 's/.*: //')

# Display version information
echo -e "${BLUE}📦 ACP Version Information${NC}"
echo ""
echo "Version: $VERSION"
echo "Created: $CREATED"
echo "Status: $STATUS"
echo ""
echo -e "${GREEN}✓${NC} ACP is installed"
echo ""
echo "To check for updates: ./agent/scripts/check-for-updates.sh"
echo "To update ACP: ./agent/scripts/update.sh"
