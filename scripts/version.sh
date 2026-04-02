#!/bin/bash

# 从git tag获取版本号
# 用法: ./scripts/version.sh [patch|minor|major]
# 如果没有参数，直接使用最新的tag

set -e

# 获取最新的git tag
get_latest_tag() {
    git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0"
}

# 递增版本号
increment_version() {
    local version=$1
    local type=$2
    
    # 移除v前缀
    version=${version#v}
    
    # 分割版本号
    IFS='.' read -ra PARTS <<< "$version"
    local major=${PARTS[0]:-0}
    local minor=${PARTS[1]:-0}
    local patch=${PARTS[2]:-0}
    
    case $type in
        major)
            major=$((major + 1))
            minor=0
            patch=0
            ;;
        minor)
            minor=$((minor + 1))
            patch=0
            ;;
        patch|*)
            patch=$((patch + 1))
            ;;
    esac
    
    echo "${major}.${minor}.${patch}"
}

# 主逻辑
LATEST_TAG=$(get_latest_tag)
INCREMENT_TYPE=${1:-""}

if [ -z "$INCREMENT_TYPE" ]; then
    # 直接使用最新tag的版本
    VERSION=${LATEST_TAG#v}
    echo "Using version from latest tag: $VERSION"
else
    # 递增版本号
    VERSION=$(increment_version "$LATEST_TAG" "$INCREMENT_TYPE")
    echo "Incremented $INCREMENT_TYPE version: $VERSION"
fi

# 更新 package.json
echo "Updating package.json..."
sed -i.bak "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" package.json
rm -f package.json.bak

# 更新 Cargo.toml
echo "Updating Cargo.toml..."
sed -i.bak "s/^version = \".*\"/version = \"$VERSION\"/" src-tauri/Cargo.toml
rm -f src-tauri/Cargo.toml.bak

# 更新 tauri.conf.json
echo "Updating tauri.conf.json..."
sed -i.bak "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" src-tauri/tauri.conf.json
rm -f src-tauri/tauri.conf.json.bak

echo "Version updated to: $VERSION"
echo ""
echo "Updated files:"
echo "  - package.json"
echo "  - src-tauri/Cargo.toml"
echo "  - src-tauri/tauri.conf.json"
