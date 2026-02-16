#!/bin/bash

# Agent Context Protocol (ACP) Installation Script
# This script sets up the ACP directory structure and template files in a project

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Repository details
REPO_URL="https://github.com/prmichaelsen/agent-context-protocol.git"
BRANCH="mainline"

echo -e "${GREEN}Agent Context Protocol (ACP) Installer${NC}"
echo "========================================"
echo ""

# Use current directory
TARGET_DIR="$(pwd)"

echo "Installing ACP to: $TARGET_DIR"
echo ""

# Check if agent directory already exists
if [ -d "$TARGET_DIR/agent" ]; then
    echo -e "${YELLOW}Note: agent/ directory already exists${NC}"
    echo "All ACP files will be updated to latest versions."
    echo ""
fi

# Create temporary directory
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

echo "Cloning ACP repository..."
if ! git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$TEMP_DIR" &>/dev/null; then
    echo -e "${RED}Error: Failed to clone repository${NC}"
    echo "Please check your internet connection and try again."
    exit 1
fi

echo -e "${GREEN}✓${NC} Repository cloned"
echo ""

# Create directory structure
echo "Creating directory structure..."
mkdir -p "$TARGET_DIR/agent/design"
mkdir -p "$TARGET_DIR/agent/milestones"
mkdir -p "$TARGET_DIR/agent/patterns"
mkdir -p "$TARGET_DIR/agent/tasks"
mkdir -p "$TARGET_DIR/agent/commands"
mkdir -p "$TARGET_DIR/agent/scripts"

# Create .gitkeep files
touch "$TARGET_DIR/agent/design/.gitkeep"
touch "$TARGET_DIR/agent/milestones/.gitkeep"
touch "$TARGET_DIR/agent/patterns/.gitkeep"
touch "$TARGET_DIR/agent/tasks/.gitkeep"

echo -e "${GREEN}✓${NC} Directory structure created"
echo ""

# Copy files
echo "Installing ACP files..."

# Copy template files (only .template.md files from these directories)
find "$TEMP_DIR/agent/design" -maxdepth 1 -name "*.template.md" -exec cp {} "$TARGET_DIR/agent/design/" \;
find "$TEMP_DIR/agent/milestones" -maxdepth 1 -name "*.template.md" -exec cp {} "$TARGET_DIR/agent/milestones/" \;
find "$TEMP_DIR/agent/patterns" -maxdepth 1 -name "*.template.md" -exec cp {} "$TARGET_DIR/agent/patterns/" \;
find "$TEMP_DIR/agent/tasks" -maxdepth 1 -name "*.template.md" -exec cp {} "$TARGET_DIR/agent/tasks/" \;

# Copy command template
cp "$TEMP_DIR/agent/commands/command.template.md" "$TARGET_DIR/agent/commands/"

# Copy all command files (flat structure with dot notation)
# Copies files like acp.init.md, acp.status.md, deploy.production.md, etc.
if [ -d "$TEMP_DIR/agent/commands" ]; then
    find "$TEMP_DIR/agent/commands" -maxdepth 1 -name "*.*.md" -exec cp {} "$TARGET_DIR/agent/commands/" \;
fi

# Copy progress template
cp "$TEMP_DIR/agent/progress.template.yaml" "$TARGET_DIR/agent/"

# Copy AGENT.md
cp "$TEMP_DIR/AGENT.md" "$TARGET_DIR/"

# Copy scripts
cp "$TEMP_DIR/agent/scripts/update.sh" "$TARGET_DIR/agent/scripts/"
cp "$TEMP_DIR/agent/scripts/check-for-updates.sh" "$TARGET_DIR/agent/scripts/"
cp "$TEMP_DIR/agent/scripts/uninstall.sh" "$TARGET_DIR/agent/scripts/"
cp "$TEMP_DIR/agent/scripts/version.sh" "$TARGET_DIR/agent/scripts/"
cp "$TEMP_DIR/agent/scripts/install.sh" "$TARGET_DIR/agent/scripts/"
chmod +x "$TARGET_DIR/agent/scripts"/*.sh

echo -e "${GREEN}✓${NC} All files installed"
echo ""
echo -e "${GREEN}Installation complete!${NC}"
echo ""
echo -e "${GREEN}Next steps:${NC}"
echo "1. Create your requirements document:"
echo "   cp agent/design/requirements.template.md agent/design/requirements.md"
echo ""
echo "2. Define your first milestone:"
echo "   cp agent/milestones/milestone-1-{title}.template.md agent/milestones/milestone-1-foundation.md"
echo ""
echo "3. Initialize progress tracking:"
echo "   cp agent/progress.template.yaml agent/progress.yaml"
echo ""
echo "4. Read AGENT.md for complete documentation"
echo ""
echo -e "${BLUE}For AI agents:${NC}"
echo "Type 'AGENT.md: Initialize' to get started."
echo ""
