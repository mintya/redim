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

echo "Done!"
