#!/bin/bash
# 生成 Redim 应用图标（使用 magick draw，不依赖 SVG 渲染器）

ICON_DIR="/home/mintya/workspace/redim/src-tauri/icons"

echo "Generating icons..."

# 基础颜色
BG="#F8F8F8"
RED="#DC382D"
BLACK="#1A1A1A"

# 生成图标的函数
generate_icon() {
    local size=$1
    local output=$2
    
    # 计算缩放比例
    local scale=$(echo "scale=10; $size / 512" | bc)
    
    # 计算各元素位置（基于512x512的比例）
    local poly_x1=$(printf "%.0f" $(echo "140 * $scale" | bc))
    local poly_y1=$(printf "%.0f" $(echo "170 * $scale" | bc))
    local poly_x2=$(printf "%.0f" $(echo "260 * $scale" | bc))
    local poly_y2=$(printf "%.0f" $(echo "250 * $scale" | bc))
    local poly_x3=$(printf "%.0f" $(echo "140 * $scale" | bc))
    local poly_y3=$(printf "%.0f" $(echo "320 * $scale" | bc))
    
    local rect_x1=$(printf "%.0f" $(echo "290 * $scale" | bc))
    local rect_y1=$(printf "%.0f" $(echo "296 * $scale" | bc))
    local rect_x2=$(printf "%.0f" $(echo "390 * $scale" | bc))
    local rect_y2=$(printf "%.0f" $(echo "344 * $scale" | bc))
    local corner=$(printf "%.0f" $(echo "10 * $scale" | bc))
    [ "$corner" -lt 1 ] && corner=1
    
    magick -size ${size}x${size} xc:"$BG" \
        -fill "$RED" -draw "polygon $poly_x1,$poly_y1 $poly_x2,$poly_y2 $poly_x3,$poly_y3" \
        -fill "$BLACK" -draw "roundrectangle $rect_x1,$rect_y1 $rect_x2,$rect_y2 $corner,$corner" \
        "$output"
    
    echo "Generated $output (${size}x${size})"
}

# 生成所有尺寸
generate_icon 32 "$ICON_DIR/32x32.png"
generate_icon 128 "$ICON_DIR/128x128.png"
generate_icon 256 "$ICON_DIR/128x128@2x.png"
generate_icon 512 "$ICON_DIR/icon.png"

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

# ICO 文件 (Windows)
magick -size 256x256 xc:"$BG" \
    -fill "$RED" -draw "polygon 70,85 130,125 70,160" \
    -fill "$BLACK" -draw "roundrectangle 145,148 195,172 5,5" \
    "$ICON_DIR/icon.ico"

echo "Done!"
