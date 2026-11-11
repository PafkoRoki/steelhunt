"""
Builds the 1990 Stumpjumper Comp decal textures from the owner-supplied SPECIALIZED logo file.

Run:  blender --background --factory-startup --python design/3d/make_decals_stumpjumper.py
In:   design/3d/decal-specialized.png   (black wordmark + red S mark, transparent background)
Out:  design/3d/decal-specialized-1990.png  US flag + wordmark as a red outline (as on owners' photos of 1990 frames)
      design/3d/decal-s-mark.png            the S mark alone, solid red (head tube badge)
      design/3d/decal-comp.png              "COMP" for the seat stays (set in Times Bold Italic: an APPROXIMATION,
                                            the original lettering is not available as artwork)
The flag is drawn here (13 stripes, plain blue canton); the wordmark and S shapes come from the logo file.
"""
import os

import bpy
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
RED = (205 / 255, 25 / 255, 40 / 255)


def load(name):
    im = bpy.data.images.load(os.path.join(HERE, name))
    w, h = im.size
    return np.array(im.pixels[:], dtype=np.float32).reshape(h, w, 4)[::-1].copy()   # rows top-down


def save(arr, name):
    h, w, _ = arr.shape
    im = bpy.data.images.new(name, w, h, alpha=True)
    im.alpha_mode = 'STRAIGHT'
    im.pixels.foreach_set(np.ascontiguousarray(arr[::-1]).reshape(-1).astype(np.float32))
    im.filepath_raw = os.path.join(HERE, name)
    im.file_format = 'PNG'
    im.save()
    print('saved', name, w, h)


def erode(a, r):
    out = a.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dx * dx + dy * dy <= r * r:
                out = np.minimum(out, np.roll(np.roll(a, dy, 0), dx, 1))
    return out


src = load('decal-specialized.png')
alpha = src[..., 3]
H = alpha.shape[0]

# --- wordmark as an outline, without the (R) and the S mark
word = alpha[:, :1770].copy()
word[335:405, 1675:1770] = 0
pad = 24
word = np.pad(word, pad)
outline = np.clip(word - erode(word, 13), 0, 1)
fw, fh, gap = 250, 150, 70
W = fw + gap + outline.shape[1]
out = np.zeros((outline.shape[0], W, 4), dtype=np.float32)
out[:, fw + gap:, 0], out[:, fw + gap:, 1], out[:, fw + gap:, 2] = RED
out[:, fw + gap:, 3] = outline
fy = out.shape[0] // 2 - fh // 2 + 8
for y in range(fh):
    stripe = y * 13 // fh
    out[fy + y, :fw, :3] = RED if stripe % 2 == 0 else (0.93, 0.93, 0.92)
    out[fy + y, :fw, 3] = 1
    if stripe < 7:
        out[fy + y, :int(fw * 0.42), :3] = (0.10, 0.16, 0.42)
save(out, 'decal-specialized-1990.png')

# --- S mark alone, solid red
s = src[:, 1790:, :].copy()
s[..., 0], s[..., 1], s[..., 2] = RED
save(s, 'decal-s-mark.png')

# --- COMP lettering rendered from a system font
scene = bpy.context.scene
cu = bpy.data.curves.new('t', 'FONT')
cu.body = 'COMP'
cu.font = bpy.data.fonts.load(r'C:\Windows\Fonts\timesbi.ttf')
ob = bpy.data.objects.new('t', cu)
scene.collection.objects.link(ob)
m = bpy.data.materials.new('m')
m.use_nodes = True
nt = m.node_tree
nt.nodes.clear()
e = nt.nodes.new('ShaderNodeEmission')
o = nt.nodes.new('ShaderNodeOutputMaterial')
e.inputs[0].default_value = (RED[0] ** 2.2, RED[1] ** 2.2, RED[2] ** 2.2, 1)
nt.links.new(e.outputs[0], o.inputs[0])
cu.materials.append(m)
bpy.context.view_layer.update()
me = bpy.data.meshes.new_from_object(ob.evaluated_get(bpy.context.evaluated_depsgraph_get()))
xs = [v.co.x for v in me.vertices]
ys = [v.co.y for v in me.vertices]
w, h = max(xs) - min(xs), max(ys) - min(ys)
cam = bpy.data.cameras.new('c')
cam.type = 'ORTHO'
cam.ortho_scale = w * 1.06
co = bpy.data.objects.new('c', cam)
scene.collection.objects.link(co)
co.location = ((max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2, 5)
scene.camera = co
scene.render.engine = 'CYCLES'
scene.cycles.samples = 16
scene.cycles.use_denoising = False
scene.render.film_transparent = True
scene.render.resolution_x = 768
scene.render.resolution_y = int(768 * (h * 1.3) / (w * 1.06))
scene.view_settings.view_transform = 'Standard'
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.filepath = os.path.join(HERE, 'decal-comp.png')
bpy.ops.render.render(write_still=True)
print('saved decal-comp.png')
