import os
from PIL import Image, ImageDraw

OUTPUT_DIR = 'public/assets/map'
os.makedirs(OUTPUT_DIR, exist_ok=True)

tileset = Image.open('robotwar/Tileset/tileset_arranged.png').convert('RGBA')
obstacles = Image.open('robotwar/Obstacles and Objects/obstacles-and-objects.png').convert('RGBA')

# 1. SLICE 32x32 MAP PIECES (2x2 tiles)
# Coordinates are (col * 32, row * 32)
def crop_block(c, r, name):
    box = (c * 32, r * 32, (c + 1) * 32, (r + 1) * 32)
    piece = tileset.crop(box)
    piece.save(os.path.join(OUTPUT_DIR, f'{name}.png'))
    return piece

# Floor / Ground Pieces
crop_block(0, 0, 'courtyard_clean')        # Green courtyard tiled floor
crop_block(4, 0, 'courtyard_variation')    # Green courtyard with slight variation
crop_block(0, 6, 'courtyard_detailed')     # Detailed green tiles
crop_block(5, 4, 'terrain_dark')           # Dark dirt/rocky terrain
crop_block(6, 4, 'terrain_rubble')         # Dark terrain with rubble

# Wall Pieces (Cyan sci-fi defense walls)
crop_block(2, 0, 'wall_straight_h')        # Horizontal cyan wall
crop_block(3, 0, 'wall_straight_v')        # Vertical cyan wall
crop_block(1, 0, 'wall_corner_ne')         # Wall corner
crop_block(1, 1, 'wall_corner_nw')         # Wall corner
crop_block(2, 1, 'wall_corner_se')         # Wall corner
crop_block(3, 1, 'wall_corner_sw')         # Wall corner

# Road & Sidewalk Pieces (32x32 blocks as in sample image)
crop_block(2, 3, 'curb_straight_v_left')   # Left sidewalk curb for vertical road
crop_block(3, 3, 'curb_straight_v_right')  # Right sidewalk curb for vertical road
crop_block(1, 2, 'curb_straight_h_top')    # Top sidewalk curb for horizontal road
crop_block(4, 2, 'curb_straight_h_bottom') # Bottom sidewalk curb for horizontal road

crop_block(0, 3, 'road_asphalt_plain')     # Pure asphalt road surface
crop_block(4, 3, 'road_asphalt_dark')      # Dark asphalt surface

# Road Curves & Turns
crop_block(2, 2, 'road_curve_top_right')   # Curve from vertical to horizontal (top-right)
crop_block(3, 2, 'road_curve_top_left')    # Curve from vertical to horizontal (top-left)
crop_block(2, 4, 'road_curve_bottom_left') # Curve from horizontal to vertical (bottom-left)
crop_block(3, 4, 'road_curve_bottom_right')# Curve from horizontal to vertical (bottom-right)

# Road Dashed Line Pieces
crop_block(4, 1, 'road_dashed_h')          # Horizontal dashed center line
crop_block(7, 4, 'road_dashed_h_alt')      # Horizontal dashed line variation
crop_block(3, 5, 'road_dashed_v')          # Vertical dashed center line
crop_block(7, 5, 'road_dashed_v_alt')      # Vertical dashed line variation

# Now let's assemble complete 32x32 ready-to-use Road Units with Curbs and Center Lines!
# A. Vertical Road 32x32 (Left curb + Road + Center Dashed Line + Right curb)
road_v_full = Image.new('RGBA', (32, 32), (14, 32, 77, 255))
# draw dashed center line
v_draw = ImageDraw.Draw(road_v_full)
v_draw.line([(0, 0), (0, 31)], fill=(30, 96, 100, 255), width=2) # left curb
v_draw.line([(31, 0), (31, 31)], fill=(30, 96, 100, 255), width=2) # right curb
# dashed line down the center (x=15..16)
for y in range(2, 32, 8):
    v_draw.rectangle([(15, y), (16, y + 4)], fill=(220, 235, 255, 240))
road_v_full.save(os.path.join(OUTPUT_DIR, 'road_vertical_complete.png'))

# B. Horizontal Road 32x32 (Top curb + Road + Center Dashed Line + Bottom curb)
road_h_full = Image.new('RGBA', (32, 32), (14, 32, 77, 255))
h_draw = ImageDraw.Draw(road_h_full)
h_draw.line([(0, 0), (31, 0)], fill=(30, 96, 100, 255), width=2) # top curb
h_draw.line([(0, 31), (31, 31)], fill=(30, 96, 100, 255), width=2) # bottom curb
# dashed line along the center (y=15..16)
for x in range(2, 32, 8):
    h_draw.rectangle([(x, 15), (x + 4, 16)], fill=(220, 235, 255, 240))
road_h_full.save(os.path.join(OUTPUT_DIR, 'road_horizontal_complete.png'))

# C. Turn Corner 1: Vertical to Left (Top-Right Turn)
turn_tr = Image.new('RGBA', (32, 32), (14, 32, 77, 255))
tr_draw = ImageDraw.Draw(turn_tr)
# Outer curb arc (top-right)
tr_draw.arc([(0, -32), (63, 31)], start=90, end=180, fill=(30, 96, 100, 255), width=3)
# Inner curb corner (bottom-left)
tr_draw.arc([(-16, 16), (16, 48)], start=270, end=360, fill=(30, 96, 100, 255), width=3)
# Curved dashed line
tr_draw.arc([(-8, -8), (40, 40)], start=90, end=180, fill=(220, 235, 255, 240), width=2)
turn_tr.save(os.path.join(OUTPUT_DIR, 'road_turn_top_right_complete.png'))

# D. Turn Corner 2: Horizontal to Down (Left-Down Turn)
turn_ld = Image.new('RGBA', (32, 32), (14, 32, 77, 255))
ld_draw = ImageDraw.Draw(turn_ld)
# Outer curb arc (top-left)
ld_draw.arc([(-32, -32), (31, 31)], start=0, end=90, fill=(30, 96, 100, 255), width=3)
# Inner curb corner (bottom-right)
ld_draw.arc([(16, 16), (48, 48)], start=180, end=270, fill=(30, 96, 100, 255), width=3)
# Curved dashed line
ld_draw.arc([(-8, -8), (40, 40)], start=0, end=90, fill=(220, 235, 255, 240), width=2)
turn_ld.save(os.path.join(OUTPUT_DIR, 'road_turn_left_down_complete.png'))

# E. Road Intersection / Crossroad (32x32)
road_cross = Image.new('RGBA', (32, 32), (14, 32, 77, 255))
c_draw = ImageDraw.Draw(road_cross)
# corner curbs
c_draw.point([(0, 0), (31, 0), (0, 31), (31, 31)], fill=(30, 96, 100, 255))
road_cross.save(os.path.join(OUTPUT_DIR, 'road_intersection_complete.png'))

# 2. EXTRACT OBSTACLES & OBJECTS (Streetlights, Vehicles, Boulders, Barricades)
# Streetlight (Obj 0): x=0..32, y=6..46
streetlight = obstacles.crop((0, 6, 32, 46))
streetlight.save(os.path.join(OUTPUT_DIR, 'streetlight.png'))

# Streetlight Light Cone Glow (Warm yellow light circle)
light_glow = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
g_draw = ImageDraw.Draw(light_glow)
for radius in range(30, 0, -2):
    alpha = int(45 * (1 - (radius / 30)))
    g_draw.ellipse([(32 - radius, 32 - radius), (32 + radius, 32 + radius)], fill=(255, 215, 80, alpha))
light_glow.save(os.path.join(OUTPUT_DIR, 'streetlight_glow.png'))

# Red Car (Obj 34): x=3..29, y=165..185 (26x20 px)
car_red = obstacles.crop((3, 165, 29, 185))
car_red.save(os.path.join(OUTPUT_DIR, 'car_red.png'))

# Blue Truck / Rover (Obj 26): x=3..29, y=135..153
car_blue = obstacles.crop((3, 135, 29, 153))
car_blue.save(os.path.join(OUTPUT_DIR, 'car_blue.png'))

# Boulders / Rocks (Obj 2): x=1..15, y=50..62
boulders = obstacles.crop((1, 50, 15, 62))
boulders.save(os.path.join(OUTPUT_DIR, 'boulders.png'))

# Metal Gateway / Bulkhead Door (Obj 5): x=16..80, y=64..96 (64x32 px)
wall_gate = obstacles.crop((16, 64, 80, 96))
wall_gate.save(os.path.join(OUTPUT_DIR, 'wall_gate.png'))

# Barrier / Barricade (Obj 4): x=0..16, y=64..80
barrier = obstacles.crop((0, 64, 16, 80))
barrier.save(os.path.join(OUTPUT_DIR, 'barrier.png'))

print('All 32x32 map tiles & obstacles successfully sliced and assembled into public/assets/map/!')
