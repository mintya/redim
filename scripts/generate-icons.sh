#!/bin/bash
# 从 icon.png 生成 Redim 应用的所有图标

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ICON_DIR="$SCRIPT_DIR/../src-tauri/icons"
SOURCE_ICON="$ICON_DIR/icon.png"

# 检查源图标是否存在
if [ ! -f "$SOURCE_ICON" ]; then
    echo "Error: Source icon not found at $SOURCE_ICON"
    exit 1
fi

echo "Generating icons from $SOURCE_ICON..."

# 生成图标的函数
generate_icon() {
    local size=$1
    local output=$2
    
    magick "$SOURCE_ICON" -resize "${size}x${size}" -alpha on -depth 8 -define png:color-type=6 "$output"
    echo "Generated $output (${size}x${size})"
}

# 生成所有尺寸
generate_icon 32 "$ICON_DIR/32x32.png"
generate_icon 128 "$ICON_DIR/128x128.png"
generate_icon 256 "$ICON_DIR/128x128@2x.png"

# Windows Store logos
generate_icon 30 "$ICON_DIR/Square30x30Logo.png"
generate_icon 44 "$ICON_DIR/Square44x44Logo.png"
generate_icon 71 "$ICON_DIR/Square71x71Logo.png"
generate_icon 89 "$ICON_DIR/Square89x89Logo.png"
generate_icon 107 "$ICON_DIR/Square107x107Logo.png"
generate_icon 142 "$ICON_DIR/Square142x142Logo.png"
generate_icon 150 "$ICON_DIR/Square150x150Logo.png"
generate_icon 284 "$ICON_DIR/Square284x284Logo.png"
generate_icon 310 "$ICON_DIR/Square310x310Logo.png"
generate_icon 50 "$ICON_DIR/StoreLogo.png"

# ICO 文件 (Windows) - 包含多个尺寸
magick "$SOURCE_ICON" -alpha on -depth 8 -define png:color-type=6 \
    \( -clone 0 -resize 16x16 \) \
    \( -clone 0 -resize 32x32 \) \
    \( -clone 0 -resize 48x48 \) \
    \( -clone 0 -resize 64x64 \) \
    \( -clone 0 -resize 128x128 \) \
    \( -clone 0 -resize 256x256 \) \
    -delete 0 "$ICON_DIR/icon.ico"
echo "Generated $ICON_DIR/icon.ico (multi-size ICO)"

# ICNS 文件 (macOS)
echo "Generating icon.icns for macOS..."

# 创建临时iconset目录
ICONSET_DIR="$ICON_DIR/icon.iconset"
mkdir -p "$ICONSET_DIR"

# 生成iconset需要的所有尺寸
magick "$SOURCE_ICON" -resize 16x16 "$ICONSET_DIR/icon_16x16.png"
magick "$SOURCE_ICON" -resize 32x32 "$ICONSET_DIR/icon_16x16@2x.png"
magick "$SOURCE_ICON" -resize 32x32 "$ICONSET_DIR/icon_32x32.png"
magick "$SOURCE_ICON" -resize 64x64 "$ICONSET_DIR/icon_32x32@2x.png"
magick "$SOURCE_ICON" -resize 128x128 "$ICONSET_DIR/icon_128x128.png"
magick "$SOURCE_ICON" -resize 256x256 "$ICONSET_DIR/icon_128x128@2x.png"
magick "$SOURCE_ICON" -resize 256x256 "$ICONSET_DIR/icon_256x256.png"
magick "$SOURCE_ICON" -resize 512x512 "$ICONSET_DIR/icon_256x256@2x.png"
magick "$SOURCE_ICON" -resize 512x512 "$ICONSET_DIR/icon_512x512.png"
magick "$SOURCE_ICON" -resize 1024x1024 "$ICONSET_DIR/icon_512x512@2x.png"

# 使用iconutil生成icns（macOS专用）
if command -v iconutil &> /dev/null; then
    iconutil -c icns "$ICONSET_DIR" -o "$ICON_DIR/icon.icns"
    echo "Generated $ICON_DIR/icon.icns"
    rm -rf "$ICONSET_DIR"
else
    echo "Warning: iconutil not found. icon.icns not generated."
    echo "On macOS, run: iconutil -c icns $ICONSET_DIR -o $ICON_DIR/icon.icns"
fi

echo "Done!"
