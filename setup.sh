#!/bin/bash

echo "Setting up Progress OS..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
    print_warning "It's recommended to run this script as a non-root user."
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check Node.js version
print_status "Checking Node.js version..."
NODE_VERSION=$(node -v | cut -d'v' -f2)
MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1)

if [ $MAJOR_VERSION -lt 18 ]; then
    print_error "Node.js 18 or higher is required. Current version: $NODE_VERSION"
    print_status "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

print_success "Node.js $NODE_VERSION detected"

# Check npm version
print_status "Checking npm version..."
NPM_VERSION=$(npm -v)
print_success "npm $NPM_VERSION detected"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the project root."
    exit 1
fi

# Install root dependencies
print_status "Installing root dependencies..."
npm install

if [ $? -ne 0 ]; then
    print_error "Failed to install root dependencies"
    exit 1
fi

print_success "Root dependencies installed"

# Install main process dependencies
print_status "Installing main process dependencies..."
cd main
npm install

if [ $? -ne 0 ]; then
    print_error "Failed to install main process dependencies"
    exit 1
fi

print_success "Main process dependencies installed"

# Install renderer dependencies
print_status "Installing renderer dependencies..."
cd ../renderer
npm install

if [ $? -ne 0 ]; then
    print_error "Failed to install renderer dependencies"
    exit 1
fi

print_success "Renderer dependencies installed"

# Build better-sqlite3
print_status "Building better-sqlite3..."
cd ../main
npm rebuild better-sqlite3

if [ $? -ne 0 ]; then
    print_warning "Failed to rebuild better-sqlite3. Trying with npm rebuild..."
    npm rebuild
fi

print_success "better-sqlite3 built successfully"

# Return to root directory
cd ..

# Create build directories
print_status "Creating build directories..."
mkdir -p build
mkdir -p dist

# Check for icon files
if [ ! -f "build/icon.png" ]; then
    print_warning "Icon files not found in build directory"
    print_status "Creating placeholder icons..."
    
    # Check if ImageMagick is installed
    if command -v convert &> /dev/null; then
        # Create placeholder icon using ImageMagick
        convert -size 256x256 xc:#4F46E5 -fill white -pointsize 100 -draw "text 75,150 'P'" build/icon.png
        convert build/icon.png build/icon.ico
        cp build/icon.png build/icon.icns
        print_success "Placeholder icons created"
    else
        print_warning "ImageMagick not found. Please install it or add your own icons to the build/ directory."
        print_status "You can download icons from:"
        print_status "  - Place a 256x256 PNG icon at build/icon.png"
        print_status "  - Place a Windows ICO icon at build/icon.ico"
        print_status "  - Place a macOS ICNS icon at build/icon.icns"
    fi
else
    print_success "Icon files found"
fi

# Set executable permissions
print_status "Setting executable permissions..."
chmod +x setup.sh

# Create database template
print_status "Creating database template..."
if [ ! -f "database/template.db" ]; then
    cp database/schema.db database/template.db 2>/dev/null || true
fi

print_success "Setup complete!"
echo ""
echo "To start in development mode:"
echo "  ${GREEN}npm run dev${NC}"
echo ""
echo "To build for production:"
echo "  ${GREEN}npm run build${NC}"
echo "  ${GREEN}npm run package${NC}"
echo ""
echo "To run tests:"
echo "  ${GREEN}npm run test${NC}"
echo ""
echo "For more information, see README.md"