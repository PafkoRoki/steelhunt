"""
Specialized Stumpjumper Comp 1990 — frame, DirectDrive fork and headset, parametric Blender model.

Run:  blender --background --factory-startup --python design/3d/stumpjumper_comp_1990.py -- [--render]
Output: public/models/stumpjumper-comp-1990.glb  (+ design/3d/preview-*.png with --render; web poster: make_poster.py)

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
DECAL = os.path.join(ROOT, 'design', '3d', 'decal-specialized-1990.png')   # flag + outlined wordmark, see make_decals_stumpjumper.py
RENDER = '--render' in sys.argv

# ----------------------------------------------------------------------------- scene
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
coll = scene.collection


def mat(name, color, rough=0.28, metal=0.0, coat=0.0, alpha_tex=None, color_from_tex=False):
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
        if color_from_tex:   # multi-colour decal: colours come from the texture itself
            nt.links.new(tex.outputs['Color'], b.inputs['Base Color'])
        m.blend_method = 'CLIP'
        m.alpha_threshold = 0.5
        m.shadow_method = 'CLIP'
    return m


PAINT = mat('paint_white', (0.74, 0.745, 0.73), rough=0.2, coat=1.0)
BARE = mat('steel_bare', (0.55, 0.56, 0.57), rough=0.35, metal=1.0)       # threads, bolt
INNER = mat('steel_inner', (0.32, 0.32, 0.33), rough=0.55, metal=1.0)   # inside walls of bores and holes: unpainted steel
DECAL_M = mat('decal_specialized', (1, 1, 1), rough=0.3, coat=1.0, alpha_tex=DECAL, color_from_tex=True)
DECAL_SJ = os.path.join(ROOT, 'design', '3d', 'decal-stumpjumper.png')   # from the owner-supplied script artwork
DECAL_SJ_M = mat('decal_stumpjumper', (1, 1, 1), rough=0.3, coat=1.0, alpha_tex=DECAL_SJ, color_from_tex=True)
DECAL_S = os.path.join(ROOT, 'design', '3d', 'decal-s-mark.png')          # head tube badge
DECAL_S_M = mat('decal_s_mark', (1, 1, 1), rough=0.3, coat=1.0, alpha_tex=DECAL_S, color_from_tex=True)
DECAL_COMP = os.path.join(ROOT, 'design', '3d', 'decal-comp.png')         # seat stays; lettering approximated
DECAL_COMP_M = mat('decal_comp', (1, 1, 1), rough=0.3, coat=1.0, alpha_tex=DECAL_COMP, color_from_tex=True)


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


def _cross(g, cope):
    """Polyline parameter where generatrix g first leaves the cylinder cope = (axis point, axis dir, radius)."""
    a0, d, r = cope
    d = d.normalized()
    f = lambda p: dist_to_axis(p, a0, d) - r
    if f(g[0]) >= 0:
        return 0.0
    for i in range(len(g) - 1):
        if f(g[i + 1]) >= 0:
            lo, hi = 0.0, 1.0
            for _ in range(32):
                m = (lo + hi) / 2
                if f(g[i].lerp(g[i + 1], m)) >= 0:
                    hi = m
                else:
                    lo = m
            return i + hi
    return float(len(g) - 1)


def _at(g, u):
    i = min(int(u), len(g) - 2)
    return g[i].lerp(g[i + 1], u - i)


def tube_rings(pts, ra, rb=None, up=Vector((0, 0, 1)), seg=SEG, cope=(None, None)):
    """Rings of points along polyline pts (elliptical section: ra along `up`, rb sideways; float or list).
    cope = (start, end): each may be (axis point, axis dir, radius); that end is trimmed (mitred) where every
    generatrix leaves that cylinder, so the tube meets another tube's wall instead of running into its bore."""
    n = len(pts)
    ra = ra if isinstance(ra, (list, tuple)) else [ra] * n
    rb = (rb if isinstance(rb, (list, tuple)) else [rb] * n) if rb is not None else ra
    rings = []
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)])
        x, y = frame_at(t, up)
        rings.append([p + x * (ra[i] * math.cos(a)) + y * (rb[i] * math.sin(a)) for a in (2 * math.pi * k / seg for k in range(seg))])
    if not (cope[0] or cope[1]):
        return rings
    cols = []
    for k in range(seg):
        g = [rings[i][k] for i in range(n)]
        u0 = _cross(g, cope[0]) if cope[0] else 0.0
        u1 = (n - 1) - _cross(g[::-1], cope[1]) if cope[1] else float(n - 1)
        cols.append([_at(g, u0 + (u1 - u0) * j / (n - 1)) for j in range(n)])
    return [[cols[k][j] for k in range(seg)] for j in range(n)]


def _quads(bm, rings, flip=False):
    seg = len(rings[0])
    for i in range(len(rings) - 1):
        for k in range(seg):
            q = (rings[i][k], rings[i][(k + 1) % seg], rings[i + 1][(k + 1) % seg], rings[i + 1][k])
            bm.faces.new(q[::-1] if flip else q)


def loft(name, pts, ra, rb=None, up=Vector((0, 0, 1)), material=PAINT, cap=(True, True), seg=SEG, cope=(None, None)):
    """Solid-looking tube along polyline pts (see tube_rings). Coped ends get no end cap (hidden in the other wall)."""
    bm = bmesh.new()
    rv = [[bm.verts.new(p) for p in r] for r in tube_rings(pts, ra, rb, up, seg, cope)]
    _quads(bm, rv)
    if cap[0] and not cope[0]:
        bm.faces.new(list(reversed(rv[0])))
    if cap[1] and not cope[1]:
        bm.faces.new(rv[-1])
    bm.normal_update()
    return obj_from_bm(bm, name, material)


def cyl(name, p0, p1, r, material=PAINT, seg=SEG, cope=(None, None)):
    return loft(name, [p0, p1], r, material=material, seg=seg, cope=cope)


def pipe(name, pts, r_out, r_in, material=PAINT, inner_material=INNER, seg=SEG, caps=(True, True), cope=(None, None),
         up=Vector((0, 0, 1))):
    """Hollow tube: outer wall, bore wall (inner_material) and annular end faces. Open ends are real holes."""
    outer = tube_rings(pts, r_out, None, up, seg, cope)
    inner = tube_rings(pts, r_in, None, up, seg, cope)
    bm = bmesh.new()
    ov = [[bm.verts.new(p) for p in r] for r in outer]
    _quads(bm, ov)
    for end, idx in ((0, 0), (1, -1)):
        if caps[end] and not cope[end]:
            o, i = ov[idx], [bm.verts.new(p) for p in inner[idx]]
            for k in range(seg):
                k1 = (k + 1) % seg
                bm.faces.new((o[k1], o[k], i[k], i[k1]) if end == 0 else (o[k], o[k1], i[k1], i[k]))
    obj_from_bm(bm, name, material)
    bm = bmesh.new()
    _quads(bm, [[bm.verts.new(p) for p in r] for r in inner], flip=True)
    return obj_from_bm(bm, name + '_bore', inner_material)


def blind_pipe(name, p0, p1, r_out, r_in, depth, material=PAINT, inner_material=INNER, seg=SEG):
    """Solid stub p0->p1 with a blind hole (radius r_in, `depth` deep) drilled into its p1 end."""
    d = (p1 - p0).normalized()
    x, y = frame_at(d, Vector((0, 0, 1)))
    ring = lambda c, r: [c + x * (r * math.cos(a)) + y * (r * math.sin(a)) for a in (2 * math.pi * k / seg for k in range(seg))]
    bm = bmesh.new()
    o0 = [bm.verts.new(p) for p in ring(p0, r_out)]
    o1 = [bm.verts.new(p) for p in ring(p1, r_out)]
    i1 = [bm.verts.new(p) for p in ring(p1, r_in)]
    _quads(bm, [o0, o1])
    bm.faces.new(list(reversed(o0)))
    for k in range(seg):
        bm.faces.new((o1[k], o1[(k + 1) % seg], i1[(k + 1) % seg], i1[k]))
    obj_from_bm(bm, name, material)
    bm = bmesh.new()
    bot = [bm.verts.new(p) for p in ring(p1 - d * depth, r_in)]
    top = [bm.verts.new(p) for p in ring(p1, r_in)]
    _quads(bm, [bot, top], flip=True)
    bm.faces.new(bot)                                  # floor of the hole
    return obj_from_bm(bm, name + '_hole', inner_material)


def disc(name, c, normal, r, material=INNER, seg=SEG):
    x, y = frame_at(normal, Vector((0, 0, 1)))
    bm = bmesh.new()
    bm.faces.new([bm.verts.new(c + x * (r * math.cos(a)) + y * (r * math.sin(a))) for a in (2 * math.pi * k / seg for k in range(seg))])
    return obj_from_bm(bm, name, material)


def flat_part(name, outlines, centre, xdir, ydir, half_t, material=PAINT):
    """Flat part from 2D outlines (first = outside, the rest = through holes), extruded +-half_t along xdir x ydir."""
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '2D'
    cu.fill_mode = 'BOTH'
    cu.extrude = half_t
    for outline in outlines:
        sp = cu.splines.new('POLY')
        sp.points.add(len(outline) - 1)
        for i, (u, v) in enumerate(outline):
            sp.points[i].co = (u, v, 0, 1)
        sp.use_cyclic_u = True
    o = bpy.data.objects.new(name, cu)
    coll.objects.link(o)
    o.data.materials.append(material)
    x, y = xdir.normalized(), ydir.normalized()
    o.matrix_world = Matrix.Translation(centre) @ Matrix((x, y, x.cross(y))).transposed().to_4x4()
    return o


def circle2d(cx, cy, r, n=24):
    return [(cx + r * math.cos(2 * math.pi * k / n), cy + r * math.sin(2 * math.pi * k / n)) for k in range(n)]


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

# main tubes. Bores are real holes; tubes that meet another tube are mitred into its wall (cope), so nothing
# runs into the bore of the BB shell, head tube or seat tube.
HT_BORE = rh - 1.6                                       # ESTIMATED wall thicknesses / bores
BB_BORE = 17.4                                           # BSA shell, 1.37" thread
ST_BORE = 13.4                                           # 26.8 mm seatpost
HT_COPE = (HT_B, ht_up, (rh + HT_BORE) / 2)              # mid-wall: tube ends stay hidden inside the wall
BB_COPE = (BB, Y, (P['bb_d'] / 2 + BB_BORE) / 2)
ST_COPE = (BB, st_dir, (rs + ST_BORE) / 2)
pipe('head_tube', [HT_B, HT_T], rh, HT_BORE, caps=(False, False))   # both ends sit in the headset cups
for z, nm in ((0.8, 'ht_ring_bottom'), (P['head_tube_len'] - 0.8, 'ht_ring_top')):   # small turned bands at the ends
    c = HT_B + ht_up * z
    pipe(nm, [c - ht_up * 0.8, c + ht_up * 0.8], rh + 0.35, rh - 0.3)
cyl('top_tube', TT_R, TT_F + (TT_F - TT_R).normalized() * 2, rt, cope=(ST_COPE, HT_COPE))
cyl('down_tube', BB, DT_F, rd, cope=(BB_COPE, HT_COPE))
pipe('seat_tube', [BB, ST_T - st_dir * clamp_h], rs, ST_BORE, caps=(False, False), cope=(BB_COPE, None))
# BB shell (axis Y): open bore with threaded ends
pipe('bb_shell', [Vector((0, -P['bb_w'] / 2, 0)), Vector((0, P['bb_w'] / 2, 0))], P['bb_d'] / 2, BB_BORE)
for s in (-1, 1):
    pipe(f'bb_thread_{s}', [Vector((0, s * P['bb_w'] / 2, 0)), Vector((0, s * (P['bb_w'] / 2 - 15), 0))], BB_BORE, BB_BORE - 0.4,
         material=BARE, inner_material=BARE)

# STR reinforcement sleeve + investment-cast seat clamp (open seatpost bore)
sleeve_bot = ST_T - st_dir * (clamp_h + 62)
pipe('st_str_sleeve', [sleeve_bot, ST_T - st_dir * clamp_h], rs + 1.1, rs - 0.45, caps=(True, False))
pipe('seat_clamp', [ST_T - st_dir * clamp_h, ST_T - st_dir * 1.6], rs + 2.6, ST_BORE, caps=(True, False))
pipe('seat_clamp_lip', [ST_T - st_dir * 1.6, ST_T], rs + 3.1, ST_BORE)
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
cs_end = RA + Vector((34, 0, -3))
ss_end = RA + Vector((20, 0, 29))
CANTI_R = 255.0   # ESTIMATED: usual cantilever boss distance from the axle for a 26" (ISO 559) rim
cs_paths = {}
for s in (-1, 1):
    ctrl = [Vector((-4, s * 22, 0)), Vector((-62, s * 33, 7)), Vector((-170, s * 52, 17)), Vector((cs_end.x, s * do_y, cs_end.z))]
    path = catmull(ctrl, 22)
    n = len(path)
    ra = [11.0 - 4.6 * (i / (n - 1)) for i in range(n)]       # vertical semi-axis
    rb = [8.0 - 2.8 * (i / (n - 1)) for i in range(n)]        # horizontal semi-axis
    loft(f'chainstay_{s}', path, ra, rb, up=Vector((0, 0, 1)), cope=(BB_COPE, None))
    cs_paths[s] = path
# seat stays — round, double tapered
ss_top = BB + st_dir * P['ss_top_on_st']
for s in (-1, 1):
    a = ss_top + Vector((-3, s * (rs + 5.8), 0))
    ctrl = [a, a.lerp(Vector((ss_end.x, s * do_y, ss_end.z)), 0.5) + Vector((0, s * 4, 0)), Vector((ss_end.x, s * do_y, ss_end.z))]
    path = catmull(ctrl, 22)
    n = len(path)
    # double tapered (catalogue): thickest in the middle, thinner towards both ends
    r = [6.4 - 1.0 * (i / (n - 1)) + 1.1 * math.sin(math.pi * i / (n - 1)) for i in range(n)]
    o = loft(f'seatstay_{s}', path, r)
    # domed top cap
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=12, radius=r[0])
    bm.transform(Matrix.Translation(path[0]))
    obj_from_bm(bm, f'seatstay_cap_{s}', PAINT)

# bridges
def stay_point(path, frac):
    return path[int(frac * (len(path) - 1))]

ssl = [catmull([ss_top + Vector((-3, s * (rs + 5.8), 0)), (ss_top + Vector((-3, s * (rs + 5.8), 0))).lerp(Vector((ss_end.x, s * do_y, ss_end.z)), 0.5) + Vector((0, s * 4, 0)), Vector((ss_end.x, s * do_y, ss_end.z))], 22) for s in (-1, 1)]
pL, pR = stay_point(ssl[0], 0.30), stay_point(ssl[1], 0.30)
cyl('seatstay_bridge', pL, pR, 6.0)
mid = (pL + pR) / 2
blind_pipe('brake_hanger_stop', mid + Vector((0, 0, 5)), mid + Vector((3, 0, 13)), 3.0, 2.0, 5.0, seg=16)   # housing socket
# chainstay bridge sits just ahead of the tyre, well behind the BB shell
cL, cR = (min(cs_paths[s], key=lambda p: abs(p.x + 88)) for s in (-1, 1))
cyl('chainstay_bridge', cL, cR, 6.0)

# cantilever bosses on the back of the seat stays, pointing rearwards (perpendicular to the stay)
for s, path in zip((-1, 1), ssl):
    i_best = min(range(1, len(path) - 1), key=lambda i: abs((path[i] - RA).length - CANTI_R))
    best = path[i_best]
    d = (path[i_best + 1] - path[i_best - 1]).normalized()
    back = Vector((d.z, 0, -d.x)).normalized()
    if back.x > 0:
        back = -back
    # base with a real spring hole, boss with a real threaded hole in its end
    flat_part(f'canti_base_{s}', [circle2d(0, 0, 7.2, 32), circle2d(-6.1, 0, 0.9, 12)], best + back * 6, d, back.cross(d), 4.0)
    blind_pipe(f'canti_boss_{s}', best + back * 10, best + back * 34, 4.9, 2.9, 12.0, seg=24)


# dropouts (forged look): 2D outline, extruded, rounded edges; right one with derailleur hanger.
# Shape ESTIMATED (typical forged vertical dropout of the period): separate tabs for the two stays.
def chaikin(pts, it=2):
    """Corner-cutting smoothing of an open polyline; the end points stay put."""
    for _ in range(it):
        out = [pts[0]]
        for a, b in zip(pts, pts[1:]):
            out += [(a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25), (a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75)]
        out.append(pts[-1])
        pts = out
    return pts


SLOT = [(5, -17), (5, -2), (4.3, 2.5), (2.5, 4.3), (0, 5), (-2.5, 4.3), (-4.3, 2.5), (-5, -2), (-5, -17)]
BODY = [(-9, -18), (-13, -11), (-14.5, 0), (-12, 10), (-5, 18), (4, 25), (13, 31), (22, 34), (28, 30), (27, 22), (21, 15), (22, 8),
        (30, 4), (40, 2), (42, -5), (36, -9), (22, -11), (13, -13), (10, -18)]
HANGER = [(-9, -33), (-15, -40), (-23, -40), (-28, -33), (-27, -23), (-20, -13), (-15.5, -2)]
OUT_L = SLOT + chaikin([SLOT[-1]] + BODY + [SLOT[0]])[1:-1]
OUT_R = SLOT[:-1] + [(-5, -21)] + chaikin([(-5, -21)] + HANGER + BODY[3:] + [SLOT[0]])[1:-1]
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
        pts = [(-18.5 + 5 * math.cos(a), -31.5 + 5 * math.sin(a)) for a in (2 * math.pi * k / 20 for k in range(20))]
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
    """Brazed-on threaded boss; p sits 0.3 mm inside the tube, so the hole floor is level with the tube surface."""
    normal = normal.normalized()
    blind_pipe(name, p, p + normal * h, r, 2.4, h - 0.35, seg=24)


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
for i, f in enumerate((0.13, 0.87)):            # two cable guides on top of the top tube (owners' photos)
    c = TT_R.lerp(TT_F, f) + tt_up * (rt + 2.2)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * 14, v.co.y * 7, v.co.z * 4))
    bm.transform(Matrix.Translation(c - tt_up * 1.2) @ tt_dir.to_track_quat('X', 'Z').to_matrix().to_4x4())
    obj_from_bm(bm, f'tt_guide_base_{i}', PAINT, smooth=False)
    gc = c + tt_up * 2.6                         # guide tube with a through bore, clear of the base plate
    pipe(f'tt_guide_tube_{i}', [gc - tt_dir * 7, gc + tt_dir * 7], 3.1, 1.6, seg=20)

for s in (-1, 1):                                # shifter cable stops on the down tube sides
    c = along(DT_F, BB, 70) + Vector((0, s * (rd + 3.2), 0))
    cyl(f'dt_cable_stop_{s}', c - Vector((0, s * 3.4, 0)), c, 4.0, seg=20)
    # housing socket faces the head tube, where the housing comes from
    blind_pipe(f'dt_cable_stop_barrel_{s}', c - dt_dir * 2, c + dt_dir * 9, 3.4, 2.6, 7.0, seg=20)

# cable guide under the BB shell: block with two real grooves (profile in the Y-Z plane, 22 mm long in X)
GUIDE = [(-13, 1.5), (-13, -1.5)]
for gy in (-6, 6):
    GUIDE += [(gy - 1.3 * math.cos(math.radians(a)), -1.5 + 1.3 * math.sin(math.radians(a))) for a in range(0, 181, 20)]
GUIDE += [(13, -1.5), (13, 1.5)]
flat_part('bb_cable_guide', [GUIDE], Vector((0, 0, -P['bb_d'] / 2 - 1.0)), Y, Vector((0, 0, 1)), 11.0)

# fork + headset ---------------------------------------------------------------
# DirectDrive unicrown fork. Catalogue 1990 (p. 8): Cr-Mo steerer and blades, blades bent with a large
# radius, oval blade section, large diameter at the ends, plug-in ("gestecktes") dropouts; rake 42 mm.
# ESTIMATED from the catalogue photos: crown arch size, blade section sizes, where the bend starts,
# steerer Ø28.6, headset stack heights, front spacing 100, cantilever boss position.
HS = mat('headset_black', (0.03, 0.03, 0.035), rough=0.22, metal=1.0)     # Specialized SV-2, black chrome
F = dict(steerer_d=28.6, arch_w=45.0, arch_h=60.0, bend_from=310.0, blade_top=(15.0, 14.0), blade_end=(10.0, 9.0),
         front_spacing=100.0, canti_r=255.0)


def fk(s, fwd=0.0, y=0.0):
    """Point in fork coordinates: s along the steering axis from the axle foot Q, fwd = forward offset, y = lateral."""
    return Q + ht_up * s + ht_fwd * fwd + Y * y


A2C = P['fork_a2c']
S0 = A2C - 17.0                                   # centreline of the crown arch at its top
ARCH_BOT = S0 - F['arch_h']
s_end, n_end = 20.0, P['rake'] - 1.5              # blade end at the dropout socket
fdo_y = F['front_spacing'] / 2 + P['dropout_t'] / 2


def blade_fwd(s):
    return 0.0 if s >= F['bend_from'] else n_end * ((F['bend_from'] - s) / (F['bend_from'] - s_end)) ** 2


def blade_k(s):
    return min(1.0, max(0.0, (ARCH_BOT - s) / (ARCH_BOT - s_end)))


def blade_y(s):
    return F['arch_w'] + (fdo_y - F['arch_w']) * blade_k(s)


def blade_sec(s):   # (fore-aft, lateral) semi-axes of the oval blade
    k = blade_k(s)
    return (F['blade_top'][0] + (F['blade_end'][0] - F['blade_top'][0]) * k,
            F['blade_top'][1] + (F['blade_end'][1] - F['blade_top'][1]) * k)


STEERER_BORE = F['steerer_d'] / 2 - 1.8               # ESTIMATED wall
pipe('fork_steerer', [fk(A2C + 0.5), HT_T + ht_up * 23], F['steerer_d'] / 2, STEERER_BORE, caps=(True, False))
pipe('fork_steerer_thread', [HT_T + ht_up * 23, HT_T + ht_up * 27], F['steerer_d'] / 2, STEERER_BORE, material=BARE, caps=(False, True))
disc('fork_steerer_floor', fk(A2C + 0.5), ht_up, STEERER_BORE)   # the bore ends where the steerer meets the crown
cyl('fork_crown_sleeve', fk(A2C - 33), fk(A2C), 17.0)
blind_pipe('fork_crown_boss', fk(A2C - 24, 12), fk(A2C - 24, 20.0), 5.0, 2.6, 2.8, seg=20)   # threaded boss at the front of the crown
FRONT_DO = [(5, -16), (5, -2), (4.3, 2.5), (2.5, 4.3), (0, 5), (-2.5, 4.3), (-4.3, 2.5), (-5, -2), (-5, -16), (-10, -17), (-14, -8),
            (-14, 4), (-12, 14), (-11, 24), (-2, 27), (6, 22), (11, 12), (14, 2), (13, -10), (10, -17)]
for s in (-1, 1):
    pts, ra, rb = [], [], []
    for k in range(13):                           # crown arch: quarter ellipse from the steerer outwards
        a = math.radians(90 * k / 12)
        pts.append(fk(S0 - F['arch_h'] * (1 - math.cos(a)), 0, s * F['arch_w'] * math.sin(a)))
        ra.append(F['blade_top'][0])
        rb.append(F['blade_top'][1])
    for k in range(1, 25):                        # blade: straight, then a large-radius forward bend
        sv = ARCH_BOT + (s_end - ARCH_BOT) * k / 24
        pts.append(fk(sv, blade_fwd(sv), s * blade_y(sv)))
        a_, b_ = blade_sec(sv)
        ra.append(a_)
        rb.append(b_)
    loft(f'fork_blade_{s}', pts, ra, rb, up=ht_fwd)
    end = fk(s_end, n_end, s * fdo_y)
    cyl(f'fork_dropout_plug_{s}', end - ht_up * 7, end + ht_up * 3, 8.2, seg=24)   # plug-in dropout shoulder
    ey = Vector((FA.x - 15, s * fdo_y, FA.z + 13))                                 # eyelet behind the dropout
    pipe(f'fork_eyelet_{s}', [ey - Y * 3, ey + Y * 3], 5.2, 2.6, seg=20)
    cu = bpy.data.curves.new(f'fork_dropout_{s}', 'CURVE')
    cu.dimensions = '2D'
    cu.fill_mode = 'BOTH'
    cu.extrude = P['dropout_t'] / 2 - 0.7
    cu.bevel_depth = 0.7
    cu.bevel_resolution = 2
    spl = cu.splines.new('POLY')
    spl.points.add(len(FRONT_DO) - 1)
    for i, (x, z) in enumerate(FRONT_DO):
        spl.points[i].co = (x, z, 0, 1)
    spl.use_cyclic_u = True
    o = bpy.data.objects.new(f'fork_dropout_{s}', cu)
    coll.objects.link(o)
    o.data.materials.append(PAINT)
    o.rotation_euler = (math.radians(90), 0, 0)
    o.location = (FA.x, s * fdo_y, FA.z)
    sc = F['canti_r']                             # cantilever boss on the front of the blade
    base = fk(sc, blade_fwd(sc) + blade_sec(sc)[0] - 1.0, s * blade_y(sc))
    bm = bmesh.new()                              # rectangular brazed-on plate under the boss
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * 24, v.co.y * 17, v.co.z * 5))
    bm.transform(Matrix.Translation(base + ht_fwd * 1.0) @ Matrix((ht_up, -Y, ht_fwd)).transposed().to_4x4())
    obj_from_bm(bm, f'fork_canti_plate_{s}', PAINT, smooth=False)
    cyl(f'fork_canti_base_{s}', base + ht_fwd * 3, base + ht_fwd * 6, 7.2, seg=24)
    blind_pipe(f'fork_canti_boss_{s}', base + ht_fwd * 5, base + ht_fwd * 29, 4.9, 2.9, 12.0, seg=24)

# headset: rings around the steerer (no solid discs across the steerer bore)
HS_BORE = F['steerer_d'] / 2 + 0.2
pipe('hs_crown_race', [fk(A2C), fk(A2C + 3.5)], rh - 0.5, HS_BORE, material=HS, inner_material=HS)
pipe('hs_lower_cup', [fk(A2C + 3.5), HT_B], rh + 2.0, HS_BORE, material=HS, inner_material=HS)
pipe('hs_upper_cup', [HT_T, HT_T + ht_up * 9], rh + 2.0, HS_BORE, material=HS, inner_material=HS)
pipe('hs_cone', [HT_T + ht_up * 9, HT_T + ht_up * 15], rh - 1.0, HS_BORE, material=HS, inner_material=HS)
pipe('hs_locknut', [HT_T + ht_up * 15, HT_T + ht_up * 23], rh + 0.5, HS_BORE / math.cos(math.pi / 8), material=HS, inner_material=HS, seg=8)

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

# decals ----------------------------------------------------------------------
def decal(name, p0, p1, r, up, centre, length, image_path, material, nu=36, nv=28, sides=(-1, 1)):
    """Wrap an image around tube p0->p1 (radius r) on both sides. The image is never mirrored: on each side
    u runs to the viewer's right and v towards `up` (so lettering stands upright, read like on a real frame)."""
    img = bpy.data.images.load(image_path, check_existing=True)
    height = length * img.size[1] / img.size[0]
    arc = height / r
    d = (p1 - p0).normalized()
    up = (up - d * up.dot(d)).normalized()
    start = p0.lerp(p1, centre) - d * (length / 2)
    for s in sides:
        side = Y * s
        screen_right = Vector((-s, 0, 0))            # camera on side s looking at the frame
        forward_u = d.dot(screen_right) > 0
        bm = bmesh.new()
        uv = bm.loops.layers.uv.new('UVMap')
        grid = [[None] * (nv + 1) for _ in range(nu + 1)]
        for i in range(nu + 1):
            for j in range(nv + 1):
                ang = -arc / 2 + arc * j / nv
                n_vec = side * math.cos(ang) + up * math.sin(ang)
                grid[i][j] = bm.verts.new(start + d * (length * i / nu) + n_vec * (r + 0.3))
        for i in range(nu):
            for j in range(nv):
                quad = [(i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1)]
                f = bm.faces.new([grid[a][b] for a, b in quad])
                f.normal_update()
                centre_pt = sum((grid[a][b].co for a, b in quad), Vector()) / 4
                axis_pt = start + d * d.dot(centre_pt - start)
                if f.normal.dot(centre_pt - axis_pt) < 0:
                    f.normal_flip()
                for loop in f.loops:
                    ii, jj = next(q for q in quad if grid[q[0]][q[1]] == loop.vert)
                    u = ii / nu
                    loop[uv].uv = (u if forward_u else 1 - u, jj / nv)
        obj_from_bm(bm, f'{name}_{s}', material)


# SPECIALIZED on the top tube (owner-supplied logo file, recoloured maroon)
# Position and length measured on the catalogue side photo (p. 8): centre ~0.66 of the top tube, ~205 mm long.
decal('decal_tt', TT_R, TT_F, rt, tt_up, 0.72, 200.0, DECAL, DECAL_M)
# Stumpjumper script on the down tube (owner-supplied artwork: maroon letters, dark shadow).
# Catalogue photo: centre ~0.62 of the down tube from the BB, ~235 mm long.
decal('decal_dt', BB, DT_F, rd, dt_up, 0.60, 255.0, DECAL_SJ, DECAL_SJ_M)
# COMP on the upper seat stays, outer face only (owners' photos)
for s, path in zip((-1, 1), ssl):
    decal(f'decal_comp_{s}', path[5], path[19], 7.1, Vector((0, 0, 1)), 0.5, 56.0, DECAL_COMP, DECAL_COMP_M, nu=20, nv=14, sides=(s,))


def decal_front(name, c, axis, normal, r, height, image_path, material, nu=16, nv=30):
    """Single upright decal wrapped around a tube, facing `normal`; image height runs along `axis`."""
    img = bpy.data.images.load(image_path, check_existing=True)
    width = height * img.size[0] / img.size[1]
    t = axis.cross(normal).normalized()
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    g = [[bm.verts.new(c + axis * (height * (j / nv - 0.5))
                       + (normal * math.cos((i / nu - 0.5) * width / r) + t * math.sin((i / nu - 0.5) * width / r)) * (r + 0.3))
          for j in range(nv + 1)] for i in range(nu + 1)]
    for i in range(nu):
        for j in range(nv):
            quad = [(i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1)]
            f = bm.faces.new([g[a][b] for a, b in quad])
            for loop, (a, b) in zip(f.loops, quad):
                loop[uv].uv = (a / nu, b / nv)
    obj_from_bm(bm, name, material)


# S mark on the front of the head tube (owners' photos)
decal_front('decal_head_s', HT_B.lerp(HT_T, 0.52), ht_up, ht_fwd, rh, 62.0, DECAL_S, DECAL_S_M)

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
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=False, export_apply=True, export_yup=True, export_image_format='AUTO',
                          export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6)   # Draco: ~1/4 of the size; <model-viewer> decodes it
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
        'rear_detail': ((-1.25, 0.7, 0.3), Vector((-0.38, 0, -0.08)), 85),
        'seat_cluster': (tuple(seat + Vector((-0.28, 0.42, 0.12))), seat - Vector((0, 0, 0.04)), 100),
        'head_tube': (tuple(head + Vector((0.5, 0.3, 0.08))), head, 100),
        'down_tube': (tuple(mpt(BB.lerp(DT_F, 0.62)) + Vector((0.0, 0.55, 0.02))), mpt(BB.lerp(DT_F, 0.62)), 100),
        'fork': (tuple(mpt(fk(210)) + Vector((1.25, 0.4, 0.22))), mpt(fk(210)), 60),
        'bb_shell': (tuple(mpt(BB) + Vector((0.05, 0.32, -0.04))), mpt(BB), 100),
        'steerer_top': (tuple(mpt(HT_T) + Vector((0.07, 0.1, 0.3))), mpt(HT_T + ht_up * 20), 100),
    }
    for name, (loc, target, lens) in views.items():
        cam.location = loc
        cam.rotation_euler = (target - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        cam_d.lens = lens
        scene.render.filepath = os.path.join(ROOT, 'design', '3d', f'preview-{name}.png')
        bpy.ops.render.render(write_still=True)
        print('rendered', name)
    # The web poster (public/models/stumpjumper-comp-1990-poster.jpg) is rendered separately, in the light studio shared
    # with the other frames:  blender -b --factory-startup -P design/3d/make_poster.py -- public/models/stumpjumper-comp-1990.glb public/models/stumpjumper-comp-1990-poster.jpg
