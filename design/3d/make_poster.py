# Card/poster render in the Ritchey P-23 studio (grey floor, bright world, 3 area lights, Cycles), for any frame GLB.
# blender -b --factory-startup -P design/3d/make_poster.py -- public/models/<frame>.glb public/models/<frame>-poster.jpg [mirror]
import bpy, sys
from mathutils import Vector
args = sys.argv[sys.argv.index("--") + 1:]
src, out = args[0], args[1]
flip = len(args) > 2 and args[2] == "mirror"
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=src)
obs = [o for o in scene.objects if o.type == 'MESH']
pts = [o.matrix_world @ Vector(c) for o in obs for c in o.bound_box]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
C = (lo + hi) / 2
print("BBOX", lo, hi)
sx = -1 if flip else 1            # which side is the front (+x in the Ritchey scene)

def mat(name, col, rough):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*col, 1); b.inputs["Roughness"].default_value = rough
    return m
bpy.ops.mesh.primitive_plane_add(size=40, location=(C.x, C.y, C.z - 0.49))
bpy.context.object.data.materials.append(mat("Podloze", (0.42, 0.42, 0.43), 0.7))
w = bpy.data.worlds.new("W"); scene.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.92, 0.93, 0.95, 1)
w.node_tree.nodes["Background"].inputs[1].default_value = 0.30

def aim(ob, target):
    ob.rotation_euler = (Vector(target) - ob.location).to_track_quat('-Z', 'Y').to_euler()
def light(name, off, energy, size):
    l = bpy.data.lights.new(name, 'AREA'); l.energy = energy; l.size = size
    ob = bpy.data.objects.new(name, l); scene.collection.objects.link(ob)
    ob.location = C + Vector((off[0] * sx, off[1], off[2])); aim(ob, C + Vector((0, 0, 0.05)))
light("Klucz", (1.1, -2.2, 2.0), 200, 2.5)
light("Wypelnienie", (-2.1, -1.5, 0.8), 70, 3.0)
light("Kontra", (-0.6, 2.5, 1.6), 160, 2.0)
cd = bpy.data.cameras.new("cam"); cd.lens = 52
cam = bpy.data.objects.new("cam", cd); scene.collection.objects.link(cam)
cam.location = C + Vector((1.65 * sx, -1.55, 0.65)); aim(cam, C)
scene.camera = cam
scene.render.engine = 'CYCLES'; scene.cycles.samples = 96; scene.cycles.use_denoising = True
scene.view_settings.view_transform = 'Standard'
scene.render.resolution_x, scene.render.resolution_y = 1200, 750
scene.render.image_settings.file_format = 'JPEG'; scene.render.image_settings.quality = 82
scene.render.filepath = out
bpy.ops.render.render(write_still=True)
print("POSTER DONE")
