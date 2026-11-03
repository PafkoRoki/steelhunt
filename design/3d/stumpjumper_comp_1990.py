"""
Specialized Stumpjumper Comp 1990 — frame only, parametric Blender model.

Run:  blender --background --factory-startup --python design/3d/stumpjumper_comp_1990.py -- [--render]
Output: public/models/stumpjumper-comp-1990.glb  (+ design/3d/preview-*.png with --render)

Sources of the numbers (mm, degrees):
  * Specialized catalogue 1990 (DE), https://bikalog.org/c/specialized/1990-spec-bikes90 :
    DirectDrive / Tange Prestige butted Cr-Mo, top tube Ø31.8, oval DD chainstays, double-tapered seat
    stays, forged dropouts, STR seat-tube reinforcement, investment-cast seat clamp, all braze-ons except
    rack mounts, BB shell 73 mm; geometry: chainstay 429, seat angle 73, BB height 294, head angle 71,
    fork rake 42. Colour: white.
  * Measured on the catalogue side photo (scale from the 26x1.95 tyre, ~1.44 mm/px), size 18":
    seat tube 457 (c-t, to top of clamp), head tube 100, front centre 620, top tube rising ~6° forward.
  * ESTIMATED (standard sizes, not stated in the catalogue): down tube Ø31.8, seat tube Ø28.6,
    head tube Ø35, BB shell Ø38, rear spacing 130, stay sizes, braze-on positions.
Coordinates: X forward, Y left, Z up, origin = BB centre. Built in mm, scaled to metres at export.
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

# ----------------------------------------------------------------------------- parameters
P = dict(
    chainstay=429.0, seat_angle=73.0, head_angle=71.0, bb_height=294.0, rake=42.0,
    wheel_radius=330.0,            # 26 x 1.95 tyre
    seat_tube_ct=457.0,            # 18"
    head_tube_len=100.0,
    front_center=620.0,
    fork_a2c=395.0, lower_stack=12.0,
    tt_d=31.8, dt_d=31.8, st_d=28.6, ht_d=35.0,
    bb_d=38.0, bb_w=73.0,
    rear_spacing=130.0, dropout_t=6.0,
    tt_rear_on_st=438.0,           # where the top-tube axis meets the seat-tube axis (from BB)
    tt_front_below_ht_top=30.0,
    dt_front_above_ht_bottom=26.0,
    ss_top_on_st=414.0,
)
SEG = 40          # tube segments around
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'public', 'models', 'stumpjumper-comp-1990.glb')
DECAL = os.path.join(ROOT, 'design', '3d', 'decal-specialized.png')
RENDER = '--render' in sys.argv

# ----------------------------------------------------------------------------- scene
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
coll = scene.collection


def mat(name, color, rough=0.28, metal=0.0, coat=0.0, alpha_tex=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    b.inputs['Clearcoat'].default_value = coat
    if alpha_tex:
        tex = nt.nodes.new('ShaderNodeTexImage')
        tex.image = bpy.data.images.load(alpha_tex)
        nt.links.new(tex.outputs['Alpha'], b.inputs['Alpha'])
        m.blend_method = 'CLIP'
        m.alpha_threshold = 0.5
        m.shadow_method = 'CLIP'
    return m


PAINT = mat('paint_white', (0.74, 0.745, 0.73), rough=0.2, coat=1.0)
BARE = mat('steel_bare', (0.55, 0.56, 0.57), rough=0.35, metal=1.0)       # threads, bolt
DARK = mat('hole_dark', (0.02, 0.02, 0.02), rough=0.6)
DECAL_M = mat('decal_specialized', (0.30, 0.02, 0.05), rough=0.3, coat=1.0, alpha_tex=DECAL)


def obj_from_bm(bm, name, material, smooth=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if smooth:
        me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
        me.use_auto_smooth = True
        me.auto_smooth_angle = math.radians(40)
    me.materials.append(material)
    o = bpy.data.objects.new(name, me)
    coll.objects.link(o)
    return o


def frame_at(t, up):
    t = t.normalized()
    x = (up - t * up.dot(t))
    if x.length < 1e-6:
        x = Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0))
        x = (x - t * x.dot(t))
    x.normalize()
    return x, t.cross(x)


def loft(name, pts, ra, rb=None, up=Vector((0, 0, 1)), material=PAINT, cap=(True, True), seg=SEG):
    """Tube along polyline pts with elliptical section (ra along `up`, rb sideways). ra/rb: list or float."""
    n = len(pts)
    ra = ra if isinstance(ra, (list, tuple)) else [ra] * n
    rb = (rb if isinstance(rb, (list, tuple)) else [rb] * n) if rb is not None else ra
    bm = bmesh.new()
    rings = []
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)])
        x, y = frame_at(t, up)
        ring = [bm.verts.new(p + x * (ra[i] * math.cos(a)) + y * (rb[i] * math.sin(a))) for a in (2 * math.pi * k / seg for k in range(seg))]
        rings.append(ring)
    for i in range(n - 1):
        for k in range(seg):
            a, b = rings[i][k], rings[i][(k + 1) % seg]
            c, d = rings[i + 1][(k + 1) % seg], rings[i + 1][k]
            bm.faces.new((a, b, c, d))
    if cap[0]:
        bm.faces.new(list(reversed(rings[0])))
    if cap[1]:
        bm.faces.new(rings[-1])
    bm.normal_update()
    return obj_from_bm(bm, name, material)


def cyl(name, p0, p1, r, material=PAINT, seg=SEG):
    return loft(name, [p0, p1], r, material=material, seg=seg)


def catmull(ctrl, samples=28):
    """Smooth path through control points (Catmull-Rom)."""
    out = []
    pts = [ctrl[0]] + ctrl + [ctrl[-1]]
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[i + 1], pts[i + 2]
        for s in range(samples):
            t = s / samples
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(ctrl[-1])
    return out


def dist_to_axis(p, a0, d):
    v = p - a0
    return (v - d * v.dot(d)).length


def weld(name, a0, a_dir, ra, rb_a, up, b0, b_dir, rb, t_from, t_to, n=110, bead=1.7):
    """TIG bead where tube A (axis a0 + t*a_dir, elliptical ra/rb_a) meets cylinder B (axis b0,b_dir, radius rb).
    Searches t in [t_from, t_to] for the first contact on each generatrix. Ripple = varying bead radius."""
    a_dir = a_dir.normalized()
    b_dir = b_dir.normalized()
    x, y = frame_at(a_dir, up)
    loop = []
    for k in range(n):
        ang = 2 * math.pi * k / n
        off = x * (ra * math.cos(ang)) + y * (rb_a * math.sin(ang))
        f = lambda t: dist_to_axis(a0 + a_dir * t + off, b0, b_dir) - rb
        lo, hi = t_from, t_to
        steps = 200
        prev_t, prev_v = lo, f(lo)
        found = None
        for s in range(1, steps + 1):
            tt = lo + (hi - lo) * s / steps
            v = f(tt)
            if (prev_v > 0) != (v > 0):
                found = (prev_t, tt)
                break
            prev_t, prev_v = tt, v
        if not found:
            loop.append(None)
            continue
        l, h = found
        for _ in range(30):
            m = (l + h) / 2
            if (f(l) > 0) == (f(m) > 0):
                l = m
            else:
                h = m
        p = a0 + a_dir * ((l + h) / 2) + off
        # push the bead slightly into the corner: outward from A's axis
        loop.append(p + off.normalized() * (bead * 0.35))
    hits = [p for p in loop if p is not None]
    if len(hits) < 8:
        print('weld skipped', name)
        return None
    # Runs of consecutive hits: a full ring when every generatrix touched B, else open segments
    # (no straight jumps across gaps).
    if len(hits) == len(loop):
        runs, cyclic = [loop], True
    else:
        start = next(i for i, p in enumerate(loop) if p is None)
        rot = loop[start:] + loop[:start]
        runs, cur = [], []
        for p in rot:
            if p is None:
                if len(cur) >= 5:
                    runs.append(cur)
                cur = []
            else:
                cur.append(p)
        if len(cur) >= 5:
            runs.append(cur)
        cyclic = False
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = bead
    cu.bevel_resolution = 2
    cu.use_fill_caps = True
    for run in runs:
        sp = cu.splines.new('POLY')
        sp.points.add(len(run) - 1)
        for i, p in enumerate(run):
            sp.points[i].co = (*p, 1)
            sp.points[i].radius = 0.86 + 0.22 * (0.5 + 0.5 * math.sin(i * 2 * math.pi / 3.0))   # stacked-dimes ripple
        sp.use_cyclic_u = cyclic
    o = bpy.data.objects.new(name, cu)
    coll.objects.link(o)
    o.data.materials.append(PAINT)
    return o


# ----------------------------------------------------------------------------- geometry
sa, ha = math.radians(P['seat_angle']), math.radians(P['head_angle'])
drop = P['wheel_radius'] - P['bb_height']
BB = Vector((0, 0, 0))
RA = Vector((-math.sqrt(P['chainstay'] ** 2 - drop ** 2), 0, drop))
FA = Vector((P['front_center'] if P['front_center'] < 1000 else 620, 0, drop))
FA.x = math.sqrt(P['front_center'] ** 2 - drop ** 2)
st_dir = Vector((-math.cos(sa), 0, math.sin(sa)))
ht_up = Vector((-math.cos(ha), 0, math.sin(ha)))
ht_fwd = Vector((math.sin(ha), 0, math.cos(ha)))
Q = FA - ht_fwd * P['rake']
HT_B = Q + ht_up * (P['fork_a2c'] + P['lower_stack'])
HT_T = HT_B + ht_up * P['head_tube_len']
ST_T = BB + st_dir * P['seat_tube_ct']
TT_R = BB + st_dir * P['tt_rear_on_st']
TT_F = HT_T - ht_up * P['tt_front_below_ht_top']
DT_F = HT_B + ht_up * P['dt_front_above_ht_bottom']
print('RA', RA, 'HT_B', HT_B, 'HT_T', HT_T, 'ST_T', ST_T)

rt, rd, rs, rh = P['tt_d'] / 2, P['dt_d'] / 2, P['st_d'] / 2, P['ht_d'] / 2
clamp_h = 24.0
Y = Vector((0, 1, 0))

# main tubes
cyl('head_tube', HT_B, HT_T, rh)
for z, nm in ((0.8, 'ht_ring_bottom'), (P['head_tube_len'] - 0.8, 'ht_ring_top')):   # small turned bands at the ends
    c = HT_B + ht_up * z
    cyl(nm, c - ht_up * 0.8, c + ht_up * 0.8, rh + 0.35)
# open ends: headset bore (dark) inset into both faces
cyl('ht_bore_top', HT_T - ht_up * 5, HT_T + ht_up * 0.05, rh - 1.6, material=DARK)
cyl('ht_bore_bottom', HT_B - ht_up * 0.05, HT_B + ht_up * 5, rh - 1.6, material=DARK)
cyl('top_tube', TT_R, TT_F + (TT_F - TT_R).normalized() * 2, rt)
cyl('down_tube', BB, DT_F, rd)
cyl('seat_tube', BB, ST_T - st_dir * clamp_h, rs)
# BB shell (axis Y)
cyl('bb_shell', Vector((0, -P['bb_w'] / 2, 0)), Vector((0, P['bb_w'] / 2, 0)), P['bb_d'] / 2)
for s in (-1, 1):   # exposed threads inside shell faces
    cyl(f'bb_thread_{s}', Vector((0, s * (P['bb_w'] / 2 - 0.2), 0)), Vector((0, s * (P['bb_w'] / 2 + 0.05), 0)), P['bb_d'] / 2 - 2.6, material=BARE)
    cyl(f'bb_bore_{s}', Vector((0, s * (P['bb_w'] / 2 - 4), 0)), Vector((0, s * (P['bb_w'] / 2 + 0.1), 0)), P['bb_d'] / 2 - 3.2, material=DARK)

# STR reinforcement sleeve + investment-cast seat clamp
sleeve_bot = ST_T - st_dir * (clamp_h + 62)
cyl('st_str_sleeve', sleeve_bot, ST_T - st_dir * clamp_h, rs + 1.1)
cyl('seat_clamp', ST_T - st_dir * clamp_h, ST_T, rs + 2.6)
cyl('seat_clamp_lip', ST_T - st_dir * 1.6, ST_T, rs + 3.1)
cyl('seatpost_bore', ST_T - st_dir * 6, ST_T + st_dir * 0.2, rs - 1.2, material=DARK)
back = Vector((-math.sin(sa), 0, -math.cos(sa)))
if back.x > 0:
    back = -back
ear_c = ST_T - st_dir * (clamp_h / 2) + back * (rs + 5.5)
for s in (-1, 1):   # two ears with a slot between them
    e = ear_c + Y * (s * 4.2)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * 11, v.co.y * 6.4, v.co.z * clamp_h * 0.92))
    basis = Matrix((back, -Y, st_dir)).transposed().to_4x4()   # right-handed: X rearwards, Y lateral, Z along seat tube
    bm.transform(Matrix.Translation(e) @ basis)
    obj_from_bm(bm, f'clamp_ear_{s}', PAINT, smooth=False)
cyl('clamp_bolt', ear_c + Y * -9.5, ear_c + Y * 9.5, 3.0, material=BARE, seg=16)
cyl('clamp_bolt_head', ear_c + Y * 9.5, ear_c + Y * 13.0, 4.6, material=BARE, seg=6)

# chainstays — DirectDrive oval, tapered, crimped for tyre clearance
do_y = P['rear_spacing'] / 2 + P['dropout_t'] / 2
cs_end = RA + Vector((36, 0, -3))
ss_end = RA + Vector((20, 0, 30))
cs_paths = {}
for s in (-1, 1):
    ctrl = [Vector((-14, s * 24, 1)), Vector((-62, s * 33, 7)), Vector((-170, s * 52, 17)), Vector((cs_end.x, s * do_y, cs_end.z))]
    path = catmull(ctrl, 22)
    n = len(path)
    ra = [11.0 - 4.6 * (i / (n - 1)) for i in range(n)]       # vertical semi-axis
    rb = [8.0 - 2.8 * (i / (n - 1)) for i in range(n)]        # horizontal semi-axis
    loft(f'chainstay_{s}', path, ra, rb, up=Vector((0, 0, 1)))
    cs_paths[s] = path
# seat stays — round, double tapered
ss_top = BB + st_dir * P['ss_top_on_st']
for s in (-1, 1):
    a = ss_top + Vector((-3, s * (rs + 4.5), 0))
    ctrl = [a, a.lerp(Vector((ss_end.x, s * do_y, ss_end.z)), 0.5) + Vector((0, s * 4, 0)), Vector((ss_end.x, s * do_y, ss_end.z))]
    path = catmull(ctrl, 22)
    n = len(path)
    r = [7.0 - 1.2 * math.sin(math.pi * i / (n - 1)) * 0 - 1.6 * (i / (n - 1)) for i in range(n)]
    o = loft(f'seatstay_{s}', path, r)
    # domed top cap
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=12, radius=r[0])
    bm.transform(Matrix.Translation(path[0]))
    obj_from_bm(bm, f'seatstay_cap_{s}', PAINT)

# bridges
def stay_point(path, frac):
    return path[int(frac * (len(path) - 1))]

ssl = [catmull([ss_top + Vector((-3, s * (rs + 4.5), 0)), (ss_top + Vector((-3, s * (rs + 4.5), 0))).lerp(Vector((ss_end.x, s * do_y, ss_end.z)), 0.5) + Vector((0, s * 4, 0)), Vector((ss_end.x, s * do_y, ss_end.z))], 22) for s in (-1, 1)]
pL, pR = stay_point(ssl[0], 0.30), stay_point(ssl[1], 0.30)
cyl('seatstay_bridge', pL, pR, 6.0)
mid = (pL + pR) / 2
cyl('brake_hanger_stop', mid + Vector((0, 0, 5)), mid + Vector((3, 0, 13)), 3.0, seg=16)
cyl('brake_hanger_stop_hole', mid + Vector((2.4, 0, 11.2)), mid + Vector((3.3, 0, 13.6)), 1.4, material=DARK, seg=12)
cL, cR = stay_point(cs_paths[-1], 0.13), stay_point(cs_paths[1], 0.13)
cyl('chainstay_bridge', cL, cR, 6.5)

# cantilever bosses on the seat stays, at rim brake-track radius from the rear axle
for s, path in zip((-1, 1), ssl):
    best = min(path, key=lambda p: abs((p - RA).length - 268))
    base = best + Vector((0, s * 6.0, 0))
    cyl(f'canti_base_{s}', best, base + Vector((0, s * 4, 0)), 7.2, seg=24)
    cyl(f'canti_boss_{s}', base, base + Vector((0, s * 24, 0)), 4.9, material=PAINT, seg=24)
    cyl(f'canti_thread_{s}', base + Vector((0, s * 24, 0)), base + Vector((0, s * 24.4, 0)), 2.6, material=DARK, seg=16)
    sp = base + Vector((0, s * 6, 0)) + Vector((-6.5, 0, 0))
    cyl(f'canti_spring_hole_{s}', sp, sp + Vector((-0.6, 0, 0)), 1.2, material=DARK, seg=12)

# dropouts (forged look): 2D outline, extruded, rounded edges; right one with derailleur hanger
OUT_L = [(5, -22), (5, -2), (4.3, 2.5), (2.5, 4.3), (0, 5), (-2.5, 4.3), (-4.3, 2.5), (-5, -2), (-5, -22), (-10, -24), (-16, -14), (-19, 0),
         (-16, 14), (-8, 24), (6, 34), (20, 42), (31, 44), (40, 37), (39, 25), (46, 10), (46, -6), (36, -12), (20, -16), (12, -20)]
OUT_R = [(5, -22), (5, -2), (4.3, 2.5), (2.5, 4.3), (0, 5), (-2.5, 4.3), (-4.3, 2.5), (-5, -2), (-5, -24), (-8, -33), (-14, -40), (-22, -41),
         (-28, -35), (-28, -26), (-22, -14), (-19, 0), (-16, 14), (-8, 24), (6, 34), (20, 42), (31, 44), (40, 37), (39, 25), (46, 10), (46, -6),
         (36, -12), (20, -16), (12, -20)]
for s, outline in ((1, OUT_L), (-1, OUT_R)):   # +Y = left side
    cu = bpy.data.curves.new(f'dropout_{s}', 'CURVE')
    cu.dimensions = '2D'
    cu.fill_mode = 'BOTH'
    cu.extrude = P['dropout_t'] / 2 - 0.7
    cu.bevel_depth = 0.7
    cu.bevel_resolution = 2
    spl = cu.splines.new('POLY')
    spl.points.add(len(outline) - 1)
    for i, (x, z) in enumerate(outline):
        spl.points[i].co = (x, z, 0, 1)
    spl.use_cyclic_u = True
    if s == -1:   # derailleur hanger thread hole
        h = cu.splines.new('POLY')
        pts = [(-18 + 5 * math.cos(a), -31 + 5 * math.sin(a)) for a in (2 * math.pi * k / 20 for k in range(20))]
        h.points.add(len(pts) - 1)
        for i, (x, z) in enumerate(pts):
            h.points[i].co = (x, z, 0, 1)
        h.use_cyclic_u = True
    o = bpy.data.objects.new(f'dropout_{s}', cu)
    coll.objects.link(o)
    o.data.materials.append(PAINT)
    o.rotation_euler = (math.radians(90), 0, 0)
    o.location = (RA.x, s * do_y, RA.z)

# braze-ons -------------------------------------------------------------------
def along(a, b, d):
    return a + (b - a).normalized() * d


def boss(name, p, normal, r=4.6, h=2.6):
    normal = normal.normalized()
    cyl(name, p, p + normal * h, r, seg=24)
    cyl(name + '_hole', p + normal * (h - 0.4), p + normal * (h + 0.05), 2.4, material=DARK, seg=16)


dt_dir = (DT_F - BB).normalized()
dt_up = Vector((0, 0, 1)) - dt_dir * dt_dir.z
dt_up.normalize()
if dt_up.dot(Vector((-1, 0, 1))) < 0:
    dt_up = -dt_up
for i, d in enumerate((250, 314)):              # bottle bosses on top of the down tube
    boss(f'dt_bottle_boss_{i}', along(BB, DT_F, d) + dt_up * (rd - 0.3), dt_up)
st_fwd = Vector((math.sin(sa), 0, math.cos(sa)))
for i, d in enumerate((200, 264)):              # bottle bosses on the front of the seat tube
    boss(f'st_bottle_boss_{i}', along(BB, ST_T, d) + st_fwd * (rs - 0.3), st_fwd)

tt_dir = (TT_F - TT_R).normalized()
tt_up = Vector((0, 0, 1)) - tt_dir * tt_dir.z
tt_up.normalize()
for i, f in enumerate((0.18, 0.5, 0.82)):       # three cable guides on top of the top tube
    c = TT_R.lerp(TT_F, f) + tt_up * (rt + 2.2)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * 14, v.co.y * 7, v.co.z * 4))
    bm.transform(Matrix.Translation(c - tt_up * 1.2) @ tt_dir.to_track_quat('X', 'Z').to_matrix().to_4x4())
    obj_from_bm(bm, f'tt_guide_base_{i}', PAINT, smooth=False)
    cyl(f'tt_guide_tube_{i}', c - tt_dir * 7 + tt_up * 1.2, c + tt_dir * 7 + tt_up * 1.2, 3.1, seg=20)
    cyl(f'tt_guide_bore_{i}', c - tt_dir * 7.05 + tt_up * 1.2, c - tt_dir * 6.6 + tt_up * 1.2, 1.5, material=DARK, seg=12)

for s in (-1, 1):                                # shifter cable stops on the down tube sides
    c = along(DT_F, BB, 70) + Vector((0, s * (rd + 3.2), 0))
    cyl(f'dt_cable_stop_{s}', c - Vector((0, s * 3.4, 0)), c, 4.0, seg=20)
    cyl(f'dt_cable_stop_barrel_{s}', c, c - dt_dir * 9, 3.4, seg=20)
    cyl(f'dt_cable_stop_hole_{s}', c - dt_dir * 9, c - dt_dir * 9.4, 1.6, material=DARK, seg=12)

bm = bmesh.new()                                 # cable guide under the BB shell
bmesh.ops.create_cube(bm, size=1.0)
for v in bm.verts:
    v.co = Vector((v.co.x * 22, v.co.y * 26, v.co.z * 3.0))
bm.transform(Matrix.Translation(Vector((0, 0, -P['bb_d'] / 2 - 1.0))))
obj_from_bm(bm, 'bb_cable_guide', PAINT, smooth=False)
for s in (-1, 1):
    cyl(f'bb_guide_groove_{s}', Vector((-11.2, s * 6, -P['bb_d'] / 2 - 2.6)), Vector((11.2, s * 6, -P['bb_d'] / 2 - 2.6)), 1.3, material=DARK, seg=12)

# welds (TIG beads) -----------------------------------------------------------
UPZ = Vector((0, 0, 1))
weld('weld_tt_ht', TT_R, tt_dir, rt, rt, UPZ, HT_B, ht_up, rh, (TT_F - TT_R).length - 60, (TT_F - TT_R).length + 2)
weld('weld_dt_ht', BB, dt_dir, rd, rd, UPZ, HT_B, ht_up, rh, (DT_F - BB).length - 70, (DT_F - BB).length + 2)
weld('weld_tt_st', TT_F, -tt_dir, rt, rt, UPZ, BB, st_dir, rs + 1.1, (TT_F - TT_R).length - 60, (TT_F - TT_R).length + 2)
weld('weld_st_bb', ST_T, -st_dir, rs, rs, Vector((1, 0, 0)), Vector((0, -50, 0)), Y, P['bb_d'] / 2, P['seat_tube_ct'] - 80, P['seat_tube_ct'] + 2)
weld('weld_dt_bb', DT_F, -dt_dir, rd, rd, UPZ, Vector((0, -50, 0)), Y, P['bb_d'] / 2, (DT_F - BB).length - 80, (DT_F - BB).length + 2)
weld('weld_dt_st', DT_F, -dt_dir, rd, rd, UPZ, BB, st_dir, rs, (DT_F - BB).length - 90, (DT_F - BB).length - 12)
for s in (-1, 1):
    p = cs_paths[s]
    d0 = (p[3] - p[0]).normalized()
    weld(f'weld_cs_bb_{s}', p[8], -(p[8] - p[0]).normalized(), 11.0, 8.0, UPZ, Vector((0, -50, 0)), Y, P['bb_d'] / 2, 0, 60)
    a = ssl[0 if s == -1 else 1][0]
    sd = (ssl[0 if s == -1 else 1][6] - a).normalized()
    weld(f'weld_ss_st_{s}', a + sd * 40, -sd, 7.0, 7.0, UPZ, BB, st_dir, rs + 1.1, 0, 60)

# decals: SPECIALIZED wordmark on both sides of the top tube (owner-supplied logo file, recoloured)
img = bpy.data.images.load(DECAL)
aspect = img.size[0] / img.size[1]
L = 150.0
H = L / aspect
arc = H / rt
for s in (-1, 1):
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    nu, nv = 24, 10
    start = TT_R.lerp(TT_F, 0.5) - tt_dir * (L / 2)
    side = Y * s
    up2 = tt_up
    grid = []
    for i in range(nu + 1):
        row = []
        for j in range(nv + 1):
            a = -arc / 2 + arc * j / nv
            n_vec = side * math.cos(a) + up2 * math.sin(a)
            row.append(bm.verts.new(start + tt_dir * (L * i / nu) + n_vec * (rt + 0.08)))
        grid.append(row)
    for i in range(nu):
        for j in range(nv):
            f = bm.faces.new((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]) if s == 1 else (grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]))
            for loop in f.loops:
                vi = next((ii, jj) for ii in range(nu + 1) for jj in range(nv + 1) if grid[ii][jj] == loop.vert)
                u = vi[0] / nu
                v = vi[1] / nv
                loop[uv].uv = (1 - u if s == 1 else u, v)
    obj_from_bm(bm, f'decal_tt_{s}', DECAL_M)

# ----------------------------------------------------------------------------- finish: join, scale, export
bpy.ops.object.select_all(action='DESELECT')
for o in list(coll.objects):
    if o.type == 'CURVE':
        bpy.context.view_layer.objects.active = o
        o.select_set(True)
bpy.ops.object.convert(target='MESH')
bpy.ops.object.select_all(action='DESELECT')
frame_objs = [o for o in coll.objects if o.type == 'MESH']
for o in frame_objs:
    o.select_set(True)
bpy.context.view_layer.objects.active = frame_objs[0]
bpy.ops.object.join()
frame = bpy.context.view_layer.objects.active
frame.name = 'Stumpjumper_Comp_1990_frame'
frame.data.use_auto_smooth = True
frame.data.auto_smooth_angle = math.radians(40)
frame.scale = (0.001, 0.001, 0.001)
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
# glTF is Y-up: exporter converts; centre the frame on the origin for the viewer
bbox = [frame.matrix_world @ Vector(c) for c in frame.bound_box]
centre = sum(bbox, Vector()) / 8
frame.location -= centre
bpy.ops.object.transform_apply(location=True)
print('triangles', sum(len(p.vertices) - 2 for p in frame.data.polygons))

os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=False, export_apply=True, export_yup=True, export_image_format='AUTO')
print('exported', OUT, os.path.getsize(OUT))

if RENDER:
    scene.render.engine = 'BLENDER_EEVEE'
    scene.render.resolution_x, scene.render.resolution_y = 1600, 1000
    scene.eevee.use_soft_shadows = True
    scene.eevee.use_gtao = True
    w = bpy.data.worlds.new('w')
    w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (0.08, 0.085, 0.09, 1)
    w.node_tree.nodes['Background'].inputs[1].default_value = 0.35
    scene.world = w
    scene.view_settings.view_transform = 'Filmic'
    scene.view_settings.look = 'Medium High Contrast'
    for loc, energy in (((1.2, 1.5, 1.6), 140), ((-1.5, -1.2, 1.2), 70), ((0, 2, -0.6), 25)):
        ld = bpy.data.lights.new('l', 'AREA')
        ld.energy = energy
        ld.size = 1.2
        lo = bpy.data.objects.new('l', ld)
        lo.location = loc
        lo.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        coll.objects.link(lo)
    cam_d = bpy.data.cameras.new('c')
    cam_d.lens = 70
    cam = bpy.data.objects.new('c', cam_d)
    coll.objects.link(cam)
    scene.camera = cam
    def mpt(v):   # model point (mm, before centring) -> scene metres
        return v * 0.001 - centre

    seat = mpt(ST_T)
    head = mpt((HT_T + HT_B) / 2)
    views = {
        'side': ((0, 2.6, 0.05), Vector((0, 0, 0)), 55),
        'three_quarter': ((1.5, 1.9, 0.8), Vector((0, 0, 0)), 55),
        'rear_detail': ((-1.1, 0.75, 0.25), Vector((-0.25, 0, -0.1)), 85),
        'seat_cluster': (tuple(seat + Vector((-0.28, 0.42, 0.12))), seat - Vector((0, 0, 0.04)), 100),
        'head_tube': (tuple(head + Vector((0.32, 0.38, 0.1))), head, 100),
    }
    for name, (loc, target, lens) in views.items():
        cam.location = loc
        cam.rotation_euler = (target - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        cam_d.lens = lens
        scene.render.filepath = os.path.join(ROOT, 'design', '3d', f'preview-{name}.png')
        bpy.ops.render.render(write_still=True)
        print('rendered', name)
    # lightweight poster shown by the web viewer while the model loads
    cam.location = (1.5, 1.9, 0.8)
    cam.rotation_euler = (Vector((0, 0, 0)) - Vector((1.5, 1.9, 0.8))).to_track_quat('-Z', 'Y').to_euler()
    cam_d.lens = 55
    scene.render.resolution_x, scene.render.resolution_y = 1200, 750
    scene.render.image_settings.file_format = 'JPEG'
    scene.render.image_settings.quality = 80
    scene.render.filepath = os.path.join(ROOT, 'public', 'models', 'stumpjumper-comp-1990-poster.jpg')
    bpy.ops.render.render(write_still=True)
    print('rendered poster')
