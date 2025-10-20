#!/bin/bash
#
# Install git hooks for DazzleTreeLib project
# Provides options for basic or standard hook installation
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}ComfyUI Smart Resolution Calculator Git Hook Installer${NC}"
echo "======================================================="
echo ""

# Find git directory (handle both regular repos and worktrees)
GIT_DIR=$(git rev-parse --git-dir 2>/dev/null || echo "")
if [ -z "$GIT_DIR" ]; then
    echo -e "${RED}Error:${NC} Git repository not found"
    echo "Please run from the project root directory or a git worktree"
    exit 1
fi

HOOKS_DIR="$GIT_DIR/hooks"
SCRIPT_DIR="$(dirname "$0")"

echo -e "${GREEN}Found git repository at:${NC} $GIT_DIR"
echo ""

# Check available hooks
echo -e "${BLUE}Available hooks:${NC}"
echo ""
echo -e "${RED}⚠️  IMPORTANT SECURITY NOTICE ⚠️${NC}"
echo "The standard hooks include CRITICAL branch protection features:"
echo "  • Prevents committing private files to public branches"
echo "  • Blocks secrets, credentials, and sensitive data"
echo "  • Enforces file size limits"
echo "  • Updates version.py automatically with correct format"
echo ""
echo "1. Basic hooks (version update only - NOT RECOMMENDED)"
echo "   - pre-commit-basic: Only updates version.py"
echo "   - NO SECURITY PROTECTION"
echo "   - NO BRANCH PROTECTION"
echo ""
echo "2. Standard hooks with security (DEFAULT - RECOMMENDED)"
echo "   - pre-commit: Full security + branch protection + version updates"
echo "   - post-commit: Automatic version hash correction"
echo "   - pre-push: Quality validation and test checks"
echo "   - Protects against accidental data exposure"
echo ""
echo "Version format: VERSION_BRANCH_BUILD-YYYYMMDD-COMMITHASH"
echo "Example: 0.8.0_private_21-20250922-a1b2c3d4"
echo ""

# Ask which to install
echo -e "${YELLOW}Which hooks would you like to install?${NC}"
echo "1) Basic (version only - NO SECURITY)"
echo -e "${GREEN}2) Standard with security (RECOMMENDED - DEFAULT)${NC}"
echo "3) Cancel"
echo ""
echo -e "${GREEN}Press Enter for default (Standard with security)${NC}"
read -p "Choice [1-3, Enter=2]: " -r
echo ""

# Default to standard if just Enter pressed
if [ -z "$REPLY" ]; then
    REPLY="2"
fi

case $REPLY in
    1)
        echo -e "${YELLOW}⚠️  WARNING: Installing basic hooks without security protection${NC}"
        echo -e "${RED}This configuration does NOT protect against:${NC}"
        echo "  • Committing private files to public branches"
        echo "  • Exposing secrets or credentials"
        echo "  • Large file commits"
        echo ""
        read -p "Are you sure you want basic hooks only? (y/N): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${GREEN}Good choice! Installing standard hooks instead...${NC}"
            INSTALL_STANDARD=true
        else
            echo -e "${YELLOW}Installing basic hooks (NO SECURITY)...${NC}"

            # Install basic pre-commit
            if [ -f "$SCRIPT_DIR/hooks/pre-commit-basic" ]; then
                cp "$SCRIPT_DIR/hooks/pre-commit-basic" "$HOOKS_DIR/pre-commit"
                chmod +x "$HOOKS_DIR/pre-commit"
                echo -e "${GREEN}✓${NC} Installed pre-commit hook (version only)"
                echo -e "${RED}⚠️  No security protection enabled!${NC}"
            else
                echo -e "${RED}Error:${NC} $SCRIPT_DIR/hooks/pre-commit-basic not found"
                echo "Falling back to standard hooks..."
                INSTALL_STANDARD=true
            fi
            INSTALL_STANDARD=false
        fi
        ;;

    2)
        INSTALL_STANDARD=true
        ;;

    3)
        echo -e "${YELLOW}Installation cancelled${NC}"
        exit 0
        ;;

    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

# Install standard hooks if selected or user changed mind
if [ "$INSTALL_STANDARD" = true ]; then
    echo -e "${GREEN}Installing standard hooks with security...${NC}"

    # Backup existing hooks if they exist
    for hook in pre-commit post-commit pre-push; do
        if [ -f "$HOOKS_DIR/$hook" ]; then
            BACKUP_NAME="$HOOKS_DIR/$hook.backup-$(date +%Y%m%d-%H%M%S)"
            mv "$HOOKS_DIR/$hook" "$BACKUP_NAME"
            echo -e "${YELLOW}Note:${NC} Backed up existing $hook hook"
        fi
    done

    # Install pre-commit (with security + version update)
    if [ -f "$SCRIPT_DIR/hooks/pre-commit" ]; then
        cp "$SCRIPT_DIR/hooks/pre-commit" "$HOOKS_DIR/pre-commit"
        chmod +x "$HOOKS_DIR/pre-commit"
        echo -e "${GREEN}✓${NC} Installed pre-commit hook with security + version update"
    else
        echo -e "${RED}Error:${NC} $SCRIPT_DIR/hooks/pre-commit not found"
        exit 1
    fi

    # Install post-commit
    if [ -f "$SCRIPT_DIR/hooks/post-commit" ]; then
        cp "$SCRIPT_DIR/hooks/post-commit" "$HOOKS_DIR/post-commit"
        chmod +x "$HOOKS_DIR/post-commit"
        echo -e "${GREEN}✓${NC} Installed post-commit hook"
    else
        echo -e "${YELLOW}Warning:${NC} $SCRIPT_DIR/hooks/post-commit not found"
    fi

    # Install pre-push
    if [ -f "$SCRIPT_DIR/hooks/pre-push" ]; then
        cp "$SCRIPT_DIR/hooks/pre-push" "$HOOKS_DIR/pre-push"
        chmod +x "$HOOKS_DIR/pre-push"
        echo -e "${GREEN}✓${NC} Installed pre-push hook"
    else
        echo -e "${YELLOW}Warning:${NC} $SCRIPT_DIR/hooks/pre-push not found"
    fi
fi

# Make update-version.sh executable
if [ -f "$SCRIPT_DIR/update-version.sh" ]; then
    chmod +x "$SCRIPT_DIR/update-version.sh"
    echo -e "${GREEN}✓${NC} Made update-version.sh executable"
fi

echo ""
echo -e "${GREEN}Hook installation complete!${NC}"
echo ""
echo -e "${BLUE}Installed hooks:${NC}"
ls -la "$HOOKS_DIR" | grep -E "(pre-commit|post-commit|pre-push)" | grep -v backup || true

echo ""
echo -e "${BLUE}Manual version update:${NC}"
echo "  • Run: ./scripts/update-version.sh"
echo "  • Options: --build, --commit, --date YYYYMMDD"

echo ""
echo -e "${YELLOW}Tips:${NC}"
echo "  • pre-commit hook updates version.py BEFORE each commit"
echo "  • post-commit hook updates with actual commit hash"
echo "  • To bypass hooks temporarily: git commit --no-verify"
echo "  • Version format: VERSION_BRANCH_BUILD-DATE-HASH"
echo "  • View version: python -c \"from dazzletreelib.version import __version__; print(__version__)\""

if [ "$INSTALL_STANDARD" = true ]; then
    echo ""
    echo -e "${GREEN}✅ Security Features Enabled:${NC}"
    echo "  • Branch protection (no private files on public branches)"
    echo "  • Large file blocking (>10MB)"
    echo "  • Version tracking"
fi

echo ""
echo -e "${GREEN}Ready to track versions securely!${NC}"