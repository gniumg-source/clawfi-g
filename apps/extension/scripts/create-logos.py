#!/usr/bin/env python3
"""
Create ClawFi branded icons and logos
Uses PIL to create proper PNG icons with blue gradient and crab design
"""

from PIL import Image, ImageDraw, ImageFont
import os

# iOS-style blue colors
BLUE_LIGHT = (10, 132, 255)  # #0A84FF
BLUE_DARK = (0, 90, 200)     # #005AC8
WHITE = (255, 255, 255)

def create_gradient(size, color1, color2):
    """Create a vertical gradient image"""
    img = Image.new('RGBA', (size, size))
    draw = ImageDraw.Draw(img)
    
    for y in range(size):
        # Linear interpolation between colors
        ratio = y / size
        r = int(color1[0] * (1 - ratio) + color2[0] * ratio)
        g = int(color1[1] * (1 - ratio) + color2[1] * ratio)
        b = int(color1[2] * (1 - ratio) + color2[2] * ratio)
        draw.line([(0, y), (size, y)], fill=(r, g, b, 255))
    
    return img

def draw_crab(draw, size, color):
    """Draw a simple crab icon"""
    cx, cy = size // 2, size // 2
    
    # Scale factor based on size
    s = size / 128
    
    # Body (ellipse)
    body_w = int(40 * s)
    body_h = int(28 * s)
    draw.ellipse([cx - body_w, cy - body_h + int(5*s), 
                  cx + body_w, cy + body_h + int(5*s)], 
                 fill=color)
    
    # Eyes (two small circles on stalks)
    eye_y = cy - int(15 * s)
    eye_spacing = int(18 * s)
    eye_r = int(6 * s)
    stalk_w = int(3 * s)
    
    # Left eye stalk and eye
    draw.rectangle([cx - eye_spacing - stalk_w//2, eye_y,
                    cx - eye_spacing + stalk_w//2, cy - int(5*s)], fill=color)
    draw.ellipse([cx - eye_spacing - eye_r, eye_y - eye_r,
                  cx - eye_spacing + eye_r, eye_y + eye_r], fill=color)
    
    # Right eye stalk and eye  
    draw.rectangle([cx + eye_spacing - stalk_w//2, eye_y,
                    cx + eye_spacing + stalk_w//2, cy - int(5*s)], fill=color)
    draw.ellipse([cx + eye_spacing - eye_r, eye_y - eye_r,
                  cx + eye_spacing + eye_r, eye_y + eye_r], fill=color)
    
    # Claws (left and right)
    claw_y = cy - int(5 * s)
    claw_w = int(20 * s)
    claw_h = int(15 * s)
    claw_offset = int(45 * s)
    
    # Left claw
    draw.ellipse([cx - claw_offset - claw_w, claw_y - claw_h//2,
                  cx - claw_offset + claw_w//2, claw_y + claw_h//2], fill=color)
    # Claw pincer
    draw.polygon([
        (cx - claw_offset - claw_w, claw_y - int(5*s)),
        (cx - claw_offset - claw_w - int(10*s), claw_y - int(10*s)),
        (cx - claw_offset - claw_w, claw_y),
    ], fill=color)
    draw.polygon([
        (cx - claw_offset - claw_w, claw_y + int(5*s)),
        (cx - claw_offset - claw_w - int(10*s), claw_y + int(10*s)),
        (cx - claw_offset - claw_w, claw_y),
    ], fill=color)
    
    # Right claw
    draw.ellipse([cx + claw_offset - claw_w//2, claw_y - claw_h//2,
                  cx + claw_offset + claw_w, claw_y + claw_h//2], fill=color)
    # Claw pincer
    draw.polygon([
        (cx + claw_offset + claw_w, claw_y - int(5*s)),
        (cx + claw_offset + claw_w + int(10*s), claw_y - int(10*s)),
        (cx + claw_offset + claw_w, claw_y),
    ], fill=color)
    draw.polygon([
        (cx + claw_offset + claw_w, claw_y + int(5*s)),
        (cx + claw_offset + claw_w + int(10*s), claw_y + int(10*s)),
        (cx + claw_offset + claw_w, claw_y),
    ], fill=color)
    
    # Legs (3 on each side)
    leg_start_y = cy + int(10 * s)
    leg_spacing = int(10 * s)
    leg_len = int(20 * s)
    leg_w = int(4 * s)
    
    for i in range(3):
        y = leg_start_y + i * leg_spacing
        # Left legs
        draw.line([(cx - int(35*s), y), (cx - int(35*s) - leg_len, y + leg_len//2)], 
                  fill=color, width=max(1, leg_w))
        # Right legs
        draw.line([(cx + int(35*s), y), (cx + int(35*s) + leg_len, y + leg_len//2)], 
                  fill=color, width=max(1, leg_w))

def create_icon(size):
    """Create a single icon at the given size"""
    # Create gradient background
    img = create_gradient(size, BLUE_LIGHT, BLUE_DARK)
    draw = ImageDraw.Draw(img)
    
    # Add rounded corner effect by masking
    mask = Image.new('L', (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    radius = size // 5  # Rounded corner radius
    mask_draw.rounded_rectangle([0, 0, size-1, size-1], radius=radius, fill=255)
    
    # Apply mask
    img.putalpha(mask)
    
    # Draw crab
    draw_crab(draw, size, WHITE)
    
    # Add subtle highlight at top
    highlight = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    highlight_draw = ImageDraw.Draw(highlight)
    for y in range(size // 3):
        alpha = int(80 * (1 - y / (size // 3)))
        highlight_draw.line([(0, y), (size, y)], fill=(255, 255, 255, alpha))
    
    # Composite highlight
    img = Image.alpha_composite(img, highlight)
    
    return img

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    ext_dir = os.path.dirname(script_dir)
    
    public_icons = os.path.join(ext_dir, 'public', 'icons')
    dist_icons = os.path.join(ext_dir, 'dist', 'icons')
    
    os.makedirs(public_icons, exist_ok=True)
    os.makedirs(dist_icons, exist_ok=True)
    
    sizes = [16, 48, 128]
    
    for size in sizes:
        icon = create_icon(size)
        filename = f'icon{size}.png'
        
        # Save to both locations
        icon.save(os.path.join(public_icons, filename))
        icon.save(os.path.join(dist_icons, filename))
        print(f'Created {filename} ({size}x{size})')
    
    # Also create a 256x256 logo for general use
    logo = create_icon(256)
    logo.save(os.path.join(ext_dir, 'public', 'logo-square.png'))
    logo.save(os.path.join(ext_dir, 'dist', 'logo-square.png'))
    print('Created logo-square.png (256x256)')
    
    print('All icons created successfully!')

if __name__ == '__main__':
    main()
