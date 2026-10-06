#!/bin/bash
# ============================================
# KBOA App Icon Generator
# Generates all required icon sizes from one 1024x1024 source
# ============================================

# PREREQUISITE: Create assets/icons/icon-1024.png (1024x1024 PNG)
# Then run this script, or manually resize using any tool:

SOURCE="assets/icons/icon-1024.png"
OUT="android/app/src/main/res"

# Standard Android icon sizes
SIZES=(
  "mipmap-mdpi:48"
  "mipmap-hdpi:72"
  "mipmap-xhdpi:96"
  "mipmap-xxhdpi:144"
  "mipmap-xxxhdpi:192"
)

if command -v convert &> /dev/null; then
    # Using ImageMagick
    for entry in "${SIZES[@]}"; do
        FOLDER="${entry%%:*}"
        SIZE="${entry##*:}"
        mkdir -p "$OUT/$FOLDER"
        convert "$SOURCE" -resize ${SIZE}x${SIZE} "$OUT/$FOLDER/ic_launcher.png"
        echo "✅ Generated $FOLDER/ic_launcher.png (${SIZE}px)"
    done

    # Round icons
    for entry in "${SIZES[@]}"; do
        FOLDER="${entry%%:*}"
        SIZE="${entry##*:}"
        convert "$SOURCE" -resize ${SIZE}x${SIZE} "$OUT/$FOLDER/ic_launcher_round.png"
        echo "✅ Generated $FOLDER/ic_launcher_round.png"
    done
else
    echo "⚠️ ImageMagick not found. Manual sizes needed:"
    echo ""
    for entry in "${SIZES[@]}"; do
        FOLDER="${entry%%:*}"
        SIZE="${entry##*:}"
        echo "  $FOLDER/ic_launcher.png → ${SIZE}x${SIZE}px"
    done
    echo ""
    echo "Use any tool: GIMP, Photoshop, or online: https://romannurik.github.io/AndroidAssetStudio/"
fi

# Play Store feature graphic (1024x500)
echo ""
echo "📱 Play Store assets needed:"
echo "  - App icon: 512x512 PNG (from your 1024 source)"
echo "  - Feature graphic: 1024x500 PNG"
echo "  - Screenshots: min 2 (phone, 16:9 recommended)"
