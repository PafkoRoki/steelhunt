# Ritchey P-23, rozmiar 18" (center-to-top) - parametryczny model ramy i widelca.
# Uruchomienie:  blender.exe -b -P build_p23.py
# Wszystkie wymiary w mm; na koncu siatki sa skalowane do metrow.
import bpy, bmesh, math, os, json
from mathutils import Vector, Matrix

OUT = os.path.dirname(os.path.abspath(__file__))
PAINT = os.environ.get("P23_PAINT", "red")      # "red" (katalog 1990) albo "team" (przejscie R-W-B)
SUF = "_" + PAINT
IN = 25.4

# ---------------------------------------------------------------- PARAMETRY
# [KATALOG] = odczytane ze skanow katalogow Ritchey 1990 / 1992
# [ZALOZENIE] = typowa wartosc dla epoki lub ocena ze zdjec
P = dict(
    seat_tube_ct = 18 * IN,     # [KATALOG] rozmiar 18", center-to-top
    head_angle   = 71.0,        # [KATALOG]
    seat_angle   = 74.0,        # [KATALOG]
    top_tube_eff = 22.0 * IN,   # [KATALOG] tylko do kontroli (wynika z reszty)
    chainstay    = 16.8 * IN,   # [KATALOG]
    wheelbase    = 41.3 * IN,   # [KATALOG]
    fork_rake    = 1.8 * IN,    # [KATALOG]
    bb_height    = 11.3 * IN,   # [KATALOG]
    wheel_radius = 331.0,       # [ZALOZENIE] opona 26 x 2.1
    fork_ac      = 390.0,       # [ZALOZENIE] os-korona, sztywny widelec Logic
    head_tube    = 100.0,       # [ZALOZENIE] dlugosc glowki dla 18"
    hs_lower     = 12.0,        # [ZALOZENIE] dolny stos sterow
    d_top = 28.6, d_down = 31.8, d_seat = 28.6, d_head = 31.8,   # [ZALOZENIE]
    d_steerer = 25.4, bb_width = 68.0, d_bb = 39.0,              # [ZALOZENIE]
    rear_oln = 130.0, front_oln = 100.0, dropout_t = 5.0,        # [ZALOZENIE]
    canti_r = 253.0,            # [ZALOZENIE] piwoty hamulcow od osi kola
)

def rad(a): return math.radians(a)
def V(x, y, z): return Vector((x, y, z))

# ---------------------------------------------------------------- GEOMETRIA
drop = P['wheel_radius'] - P['bb_height']                 # obnizenie suportu
rc_h = math.sqrt(P['chainstay']**2 - drop**2)
AX_R = V(-rc_h, 0, drop)                                  # os tylna
AX_F = V(P['wheelbase'] - rc_h, 0, drop)                  # os przednia
BB = V(0, 0, 0)

st_dir = V(-math.cos(rad(P['seat_angle'])), 0, math.sin(rad(P['seat_angle'])))
ST_TOP = st_dir * P['seat_tube_ct']
st_back = V(-st_dir.z, 0, -st_dir.x)                      # prostopadle, do tylu
st_front = -st_back

u = V(-math.cos(rad(P['head_angle'])), 0, math.sin(rad(P['head_angle'])))  # os sterowa w gore
n = V(u.z, 0, -u.x)                                       # prostopadle, do przodu
FOOT = AX_F - n * P['fork_rake']                          # rzut osi kola na os sterowa
def fk(s, nn=0.0, y=0.0): return FOOT + u * s + n * nn + V(0, y, 0)

S_CROWN = P['fork_ac']
S_HB = S_CROWN + P['hs_lower']                            # dol glowki
S_HT = S_HB + P['head_tube']                              # gora glowki
TT_H = fk(S_HT - 20)                                      # styk rury gornej z glowka
DT_H = fk(S_HB + 22)                                      # styk rury dolnej z glowka
ST_TT_S = P['seat_tube_ct'] - 25                          # styk rury gornej z podsiodlowa
TT_S = st_dir * ST_TT_S

tt_eff = (FOOT.x + u.x * (TT_H.z - FOOT.z) / u.z) - (-TT_H.z / math.tan(rad(P['seat_angle'])))
tt_slope = math.degrees(math.atan2(TT_H.z - TT_S.z, TT_H.x - TT_S.x))
report = dict(
    bb_drop_mm=round(drop, 1), rear_center_horiz_mm=round(rc_h, 1),
    front_center_mm=round((AX_F - BB).length, 1),
    top_tube_effective_model_mm=round(tt_eff, 1),
    top_tube_effective_catalog_mm=round(P['top_tube_eff'], 1),
    top_tube_actual_cc_mm=round((TT_H - TT_S).length, 1),
    top_tube_slope_deg=round(tt_slope, 2),
    down_tube_cc_mm=round((DT_H - BB).length, 1),
    stack_mm=round(fk(S_HT).z, 1), reach_mm=round(fk(S_HT).x, 1),
    params={k: round(v, 2) for k, v in P.items()},
)
print("GEOMETRY", json.dumps(report, indent=1))
with open(os.path.join(OUT, "geometry_report.json"), "w") as f:
    json.dump(report, f, indent=1)

# ---------------------------------------------------------------- SCENA
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
col = bpy.data.collections.new("Ritchey_P23"); scene.collection.children.link(col)
PARTS = []

def material(name, color, metallic=0.0, rough=0.3, clearcoat=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Metallic"].default_value = metallic
    b.inputs["Roughness"].default_value = rough
    b.inputs["Clearcoat"].default_value = clearcoat
    b.inputs["Clearcoat Roughness"].default_value = 0.05
    return m

M_RED = material("Lakier", (1, 1, 1), 0.0, 0.22, 1.0)
_vc = M_RED.node_tree.nodes.new("ShaderNodeVertexColor"); _vc.layer_name = "Col"
M_RED.node_tree.links.new(_vc.outputs["Color"], M_RED.node_tree.nodes["Principled BSDF"].inputs["Base Color"])
C_RED, C_WHITE, C_BLUE = (0.40, 0.004, 0.008), (0.85, 0.85, 0.82), (0.003, 0.010, 0.075)
def mix(a, b, t):
    t = max(0.0, min(1.0, t)); t = t * t * (3 - 2 * t)
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))
def paint_color(name, co):               # co w mm; uklad Team wg zdjec P-23 (pedalroom, katalog 1990)
    if PAINT != "team": return C_RED
    def frac(A, B):
        d = B - A; return (co - A).dot(d) / d.length_squared
    if name.startswith(("Rura_gorna", "Prowadnica")):
        t = frac(TT_S, TT_H)
        return mix(C_BLUE, C_WHITE, (t - 0.15) / 0.17) if t < 0.45 else mix(C_WHITE, C_RED, (t - 0.52) / 0.14)
    if name.startswith(("Rura_dolna", "Koszyk_dolna")):
        return mix(C_WHITE, C_RED, (frac(BB, DT_H) - 0.07) / 0.12)
    if name.startswith("Glowka"): return C_RED
    if name.startswith(("Rura_podsiodlowa", "Kolnierz", "Zacisk", "Koszyk_podsiodlowa")):
        return mix(C_WHITE, C_BLUE, (frac(BB, ST_TOP) - 0.46) / 0.14)
    if name.startswith("Suport"): return C_WHITE
    if name.startswith("Widelki_dolne"): return mix(C_BLUE, C_WHITE, (co.x + 150) / 80.0)
    if name.startswith(("Golen", "Korona", "Rura_sterowa", "Hak_przedni", "Piwot_przod")):
        return mix(C_BLUE, C_WHITE, ((co - FOOT).dot(u) - 108) / 45.0)
    return C_BLUE                        # widelki gorne, mostek, haki tylne

# ---- naklejki: tekst renderowany do tekstury PNG z kanalem alfa
FONT = bpy.data.fonts.load(r"C:\Windows\Fonts\BOOKOSBI.TTF")
NAVY = (0.004, 0.012, 0.10)
def text_texture(text, rgb, fname, px=2048, font=None, padx=1.06, pady=1.3, outline=None):
    cu = bpy.data.curves.new("txt", 'FONT'); cu.body = text; cu.font = font or FONT; cu.space_character = 1.06; cu.align_x = 'CENTER'; cu.space_line = 0.9
    ob = bpy.data.objects.new("txt", cu); scene.collection.objects.link(ob)
    m = bpy.data.materials.new("txt_m"); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    e = nt.nodes.new("ShaderNodeEmission"); o = nt.nodes.new("ShaderNodeOutputMaterial")
    e.inputs[0].default_value = (*rgb, 1); nt.links.new(e.outputs[0], o.inputs[0]); cu.materials.append(m)
    ob2 = None
    if outline:                                   # ciemny obrys: pogrubiona kopia napisu pod spodem
        cu2 = cu.copy(); cu2.offset = 0.03; cu2.materials.clear(); m2 = m.copy()
        m2.node_tree.nodes["Emission"].inputs[0].default_value = (*outline, 1); cu2.materials.append(m2)
        ob2 = bpy.data.objects.new("txt_o", cu2); scene.collection.objects.link(ob2); ob2.location = (0, 0, -0.5)
    bpy.context.view_layer.update()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]
    w, h = max(xs) - min(xs), max(ys) - min(ys)
    cam = bpy.data.cameras.new("txt_cam"); cam.type = 'ORTHO'; cam.ortho_scale = max(w * padx, h * pady)
    co = bpy.data.objects.new("txt_cam", cam); scene.collection.objects.link(co)
    co.location = ((max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2, 5)
    scene.camera = co
    scene.render.engine = 'CYCLES'; scene.cycles.samples = 16; scene.cycles.use_denoising = False
    scene.render.film_transparent = True
    k = px / max(w * padx, h * pady)
    scene.render.resolution_x = int(k * w * padx); scene.render.resolution_y = int(k * h * pady)
    scene.view_settings.view_transform = 'Standard'
    scene.render.image_settings.file_format = 'PNG'; scene.render.image_settings.color_mode = 'RGBA'
    path = os.path.join(OUT, fname); scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    aspect = scene.render.resolution_y / scene.render.resolution_x
    bpy.data.objects.remove(ob); bpy.data.objects.remove(co); bpy.data.meshes.remove(me)
    if ob2: bpy.data.objects.remove(ob2)
    scene.render.film_transparent = False
    img = bpy.data.images.load(path); img.pack()
    dm = bpy.data.materials.new("Naklejka_" + fname); dm.use_nodes = True; nt = dm.node_tree
    b = nt.nodes["Principled BSDF"]; t = nt.nodes.new("ShaderNodeTexImage"); t.image = img
    nt.links.new(t.outputs["Color"], b.inputs["Base Color"]); nt.links.new(t.outputs["Alpha"], b.inputs["Alpha"])
    b.inputs["Roughness"].default_value = 0.3; dm.blend_method = 'BLEND'; dm.shadow_method = 'NONE'
    return dm, aspect

SVG_LOGO = os.path.join(OUT, "..", "steelhunt", "public", "logos", "ritchey.svg")
REG_WORDMARK = (0.005, 0.128, 0.034, 0.060)      # bialy napis RITCHEY z podkresleniem (wspolrzedne po imporcie)
REG_BADGE = (0.018, 0.049, -0.096, -0.053)       # znaczek TR (wersja ciemna, przebarwiana)
def svg_texture(region, dark, rgb, fname, px=2048, padx=1.04, pady=1.15, outline=None, min_w=0.006, off=0.012):
    import addon_utils
    addon_utils.enable("io_curve_svg")
    before = set(bpy.data.objects); cols_before = set(bpy.data.collections)
    bpy.ops.import_curve.svg(filepath=SVG_LOGO)
    new = [o for o in bpy.data.objects if o not in before]
    bpy.context.view_layer.update()
    def emis(col):
        m = bpy.data.materials.new("svg_m"); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
        e = nt.nodes.new("ShaderNodeEmission"); o = nt.nodes.new("ShaderNodeOutputMaterial")
        e.inputs[0].default_value = (*col, 1); nt.links.new(e.outputs[0], o.inputs[0]); return m
    m_main = emis(rgb); m_out = emis(outline) if outline else None
    keep, extra, xs, ys = [], [], [], []
    for o in new:
        pts = [o.matrix_world @ Vector(c) for c in o.bound_box]
        x0, x1 = min(q.x for q in pts), max(q.x for q in pts); y0, y1 = min(q.y for q in pts), max(q.y for q in pts)
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        col = o.data.materials[0].diffuse_color if o.data.materials and o.data.materials[0] else (0.5, 0.5, 0.5, 1)
        is_dark = col[0] < 0.1 and col[1] < 0.1 and col[2] < 0.1
        is_white = col[0] > 0.9 and col[1] > 0.9 and col[2] > 0.9
        ok = region[0] < cx < region[1] and region[2] < cy < region[3] and (x1 - x0) > min_w and (is_dark if dark else is_white)
        if ok:
            keep.append(o); xs += [x0, x1]; ys += [y0, y1]
    print("SVG", fname, "obiektow:", len(keep))
    for o in new:
        if o not in keep: bpy.data.objects.remove(o)
    w, h = max(xs) - min(xs), max(ys) - min(ys)
    for o in keep:
        o.data.dimensions = '2D'; o.data.fill_mode = 'BOTH'
        o.data.materials.clear(); o.data.materials.append(m_main)
        if outline:
            d = o.copy(); d.data = o.data.copy(); d.data.offset = off * h / o.matrix_world.to_scale().x
            d.data.materials.clear(); d.data.materials.append(m_out)
            for c in o.users_collection: c.objects.link(d)
            d.location.z -= 0.5; extra.append(d)
    cam = bpy.data.cameras.new("svg_cam"); cam.type = 'ORTHO'; cam.ortho_scale = max(w * padx, h * pady)
    co = bpy.data.objects.new("svg_cam", cam); scene.collection.objects.link(co)
    co.location = ((max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2, 5); scene.camera = co
    scene.render.engine = 'CYCLES'; scene.cycles.samples = 16; scene.cycles.use_denoising = False
    scene.render.film_transparent = True
    k = px / max(w * padx, h * pady)
    scene.render.resolution_x = int(k * w * padx); scene.render.resolution_y = int(k * h * pady)
    scene.view_settings.view_transform = 'Standard'
    scene.render.image_settings.file_format = 'PNG'; scene.render.image_settings.color_mode = 'RGBA'
    path = os.path.join(OUT, fname); scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    aspect = scene.render.resolution_y / scene.render.resolution_x
    for o in keep + extra + [co]: bpy.data.objects.remove(o)
    for c in [c for c in bpy.data.collections if c not in cols_before]: bpy.data.collections.remove(c)
    scene.render.film_transparent = False
    img = bpy.data.images.load(path); img.pack()
    dm = bpy.data.materials.new("Naklejka_" + fname); dm.use_nodes = True; nt = dm.node_tree
    b = nt.nodes["Principled BSDF"]; t = nt.nodes.new("ShaderNodeTexImage"); t.image = img
    nt.links.new(t.outputs["Color"], b.inputs["Base Color"]); nt.links.new(t.outputs["Alpha"], b.inputs["Alpha"])
    b.inputs["Roughness"].default_value = 0.3; dm.blend_method = 'BLEND'; dm.shadow_method = 'NONE'
    return dm, aspect

def wrap_v(name, cfun, s_bot, s_top, mat_aspect, Nv, Tv, nu=12, nv=40):
    # naklejka pionowa: szerokosc tekstury owinieta wokol rury, wysokosc wzdluz osi
    mat, asp = mat_aspect; wd = (s_top - s_bot) / asp
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new("UVMap"); g = []
    for i in range(nu + 1):
        col_v = []
        for j in range(nv + 1):
            c, rb = cfun(lerp(s_bot, s_top, j / nv)); a = (i / nu - .5) * wd / rb
            col_v.append(bm.verts.new(c + (Nv * math.cos(a) + Tv * math.sin(a)) * rb))
        g.append(col_v)
    for i in range(nu):
        for j in range(nv):
            idx = [(i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1)]
            f = bm.faces.new([g[a_][b_] for a_, b_ in idx])
            for l, (a_, b_) in zip(f.loops, idx): l[uvl].uv = (a_ / nu, b_ / nv)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    return finish(name, me, mat)

def decal(name, C, t, N, R, L, mat_aspect, nu=48, nv=16):
    # platek owiniety na rurze: C srodek na osi, t kierunek czytania, N normalna na zewnatrz
    mat, aspect = mat_aspect
    Wd = N.cross(t).normalized(); H = L * aspect
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new("UVMap"); g = []
    for i in range(nu + 1):
        g.append([bm.verts.new(C + t * ((i / nu - .5) * L) +
                  (N * math.cos((j / nv - .5) * H / R) + Wd * math.sin((j / nv - .5) * H / R)) * (R + 0.15))
                  for j in range(nv + 1)])
    for i in range(nu):
        for j in range(nv):
            idx = [(i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1)]
            f = bm.faces.new([g[a][b] for a, b in idx])
            for l, (a, b) in zip(f.loops, idx): l[uvl].uv = (a / nu, b / nv)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    return finish(name, me, mat)
M_STEEL = material("Stal_polerowana", (0.62, 0.63, 0.65), 1.0, 0.25)
M_BLACK = material("Czern", (0.01, 0.01, 0.01), 0.0, 0.6)

def finish(name, me, mat):
    for p in me.polygons: p.use_smooth = True
    me.use_auto_smooth = True; me.auto_smooth_angle = rad(40)
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me); col.objects.link(ob); PARTS.append(ob)
    return ob

def tube(name, p0, p1, r0, r1=None, mat=M_RED, seg=48):
    # pierscienie co ~12 mm - potrzebne do plynnego przejscia koloru
    r1 = r0 if r1 is None else r1
    d = p1 - p0; L = d.length; nr = max(1, int(math.ceil(L / 12.0)))
    bm = bmesh.new(); rings = []
    for k in range(nr + 1):
        f = k / nr; r = r0 + (r1 - r0) * f; z = -L / 2 + L * f
        rings.append([bm.verts.new((r * math.cos(2 * math.pi * i / seg), r * math.sin(2 * math.pi * i / seg), z))
                      for i in range(seg)])
    for k in range(nr):
        for i in range(seg):
            j = (i + 1) % seg
            bm.faces.new([rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]])
    bm.faces.new(list(reversed(rings[0]))); bm.faces.new(rings[-1])
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    me.transform(Matrix.Translation((p0 + p1) / 2) @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4())
    return finish(name, me, mat)

def sweep(name, pts, radii, mat=M_RED):
    cu = bpy.data.curves.new(name + "_c", 'CURVE'); cu.dimensions = '3D'
    cu.bevel_depth = 1.0; cu.bevel_resolution = 8; cu.resolution_u = 24; cu.use_fill_caps = True
    sp = cu.splines.new('BEZIER'); sp.bezier_points.add(len(pts) - 1)
    for bp, p, r in zip(sp.bezier_points, pts, radii):
        bp.co = p; bp.handle_left_type = bp.handle_right_type = 'AUTO'; bp.radius = r
    ob = bpy.data.objects.new(name + "_c", cu); col.objects.link(ob)
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg)); me.name = name
    bpy.data.objects.remove(ob); bpy.data.curves.remove(cu)
    return finish(name, me, mat)

def plate(name, origin, a, b, outline, thick, mat=M_RED):
    nrm = a.cross(b).normalized()
    bm = bmesh.new()
    lo = [bm.verts.new(origin + a * x + b * z - nrm * thick / 2) for x, z in outline]
    hi = [bm.verts.new(origin + a * x + b * z + nrm * thick / 2) for x, z in outline]
    bm.faces.new(lo); bm.faces.new(list(reversed(hi)))
    k = len(outline)
    for i in range(k):
        j = (i + 1) % k
        bm.faces.new([lo[j], lo[i], hi[i], hi[j]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = finish(name, me, mat)
    for p in me.polygons: p.use_smooth = False
    return ob

Y = V(0, 1, 0)

# tekstura napisu musi powstac, zanim w scenie pojawi sie rama
letters = (0.9, 0.9, 0.88)
logo = svg_texture(REG_WORDMARK, False, letters, "decal_ritchey" + SUF + ".png", outline=NAVY)
logo_st = logo
logo_tr = svg_texture(REG_BADGE, True, letters, "decal_tr" + SUF + ".png", px=1024, padx=1.1, pady=1.06, min_w=0.004)
logo_tr_fork = svg_texture(REG_BADGE, True, C_BLUE, "decal_tr_fork" + SUF + ".png", px=1024, padx=1.1, pady=1.06, min_w=0.004) if PAINT == "team" else logo_tr
logo_p23 = text_texture("P-23", letters, "decal_p23" + SUF + ".png", px=1024, outline=NAVY)
FONT_ROMAN = bpy.data.fonts.load(r"C:\Windows\Fonts\BOOKOSB.TTF")
logo_logic = text_texture("L\nO\nG\nI\nC", (0.003, 0.010, 0.075) if PAINT == "team" else letters, "decal_logic" + SUF + ".png", px=1024, font=FONT_ROMAN, padx=1.5, pady=1.05)
def lerp(a, b, t): return a + (b - a) * t

# ---------------------------------------------------------------- RURY GLOWNE
tube("Suport", V(0, -P['bb_width'] / 2, 0), V(0, P['bb_width'] / 2, 0), P['d_bb'] / 2)
tube("Suport_otwor", V(0, -P['bb_width'] / 2 - .3, 0), V(0, P['bb_width'] / 2 + .3, 0), 17.0, mat=M_BLACK)
tube("Rura_podsiodlowa", BB, ST_TOP, P['d_seat'] / 2)
tube("Rura_gorna", TT_S, TT_H, P['d_top'] / 2)
tube("Rura_dolna", BB, DT_H, P['d_down'] / 2)
tube("Glowka", fk(S_HB), fk(S_HT), P['d_head'] / 2)

# kolnierz podsiodlowy ze sruba zaciskowa (1990: "bolt type")
tube("Kolnierz_podsiodlowy", st_dir * (P['seat_tube_ct'] - 30), ST_TOP, P['d_seat'] / 2 + 2.2)
tube("Otwor_sztycy", ST_TOP - st_dir * 2, ST_TOP + st_dir * .3, 13.4, mat=M_BLACK)
bc = ST_TOP - st_dir * 12 + st_back * (P['d_seat'] / 2 + 5.5)
tube("Zacisk_ucho", bc - Y * 11, bc + Y * 11, 5.5, seg=24)
tube("Zacisk_sruba", bc - Y * 14, bc + Y * 14, 3.2, mat=M_STEEL, seg=6)

# ---------------------------------------------------------------- TYL
half_r = P['rear_oln'] / 2 + P['dropout_t'] / 2
cs_end = AX_R + V(28, 0, -3)
ss_dir = (st_dir * (ST_TT_S + 4) - AX_R).normalized()
ss_bot = AX_R + ss_dir * 24
ss_top = st_dir * (ST_TT_S + 4)
ss_perp_back = V(-ss_dir.z, 0, ss_dir.x)

rear_outline = [(5, -15), (13, -15), (19, -8), (32, -9), (32, 3), (20, 6),
                (24.6, 21.2), (15.4, 28.8), (2, 14), (-8, 12), (-13, 4), (-13, -6), (-9, -15),
                (-5, -15), (-5, 0), (-3.5, 3.5), (0, 5), (3.5, 3.5), (5, 0)]
hanger_outline = [(-5, -6), (-9, -15), (-6, -30), (-11, -38), (-19, -37), (-23, -28), (-19, -10), (-13, -3)]

for sgn, side in ((1, "L"), (-1, "P")):
    def cs(x, y):                       # punkt na osi widelek dolnych
        t = x / cs_end.x
        return V(x, sgn * y, cs_end.z * t)
    sweep("Widelki_dolne_" + side,
          [cs(-10, 22), cs(-70, 31), cs(-130, 41), cs(-250, 54), cs(-370, 65), V(cs_end.x, sgn * half_r, cs_end.z)],
          [11.1, 11.1, 10.5, 9.0, 7.5, 6.5])
    def ss(t, y): return lerp(ss_bot, ss_top, t) + V(0, sgn * y, 0)
    sweep("Widelki_gorne_" + side,
          [ss(0, half_r), ss(0.55, 44), ss(0.85, 26), ss(1.0, 11)],
          [6.0, 7.2, 7.8, 8.0])
    o = AX_R + V(0, sgn * half_r, 0)
    plate("Hak_tylny_" + side, o, V(1, 0, 0), V(0, 0, 1), rear_outline, P['dropout_t'])
    if sgn < 0:
        plate("Hak_przerzutki", o, V(1, 0, 0), V(0, 0, 1), hanger_outline, P['dropout_t'] - 0.4)
    # piwot hamulca cantilever
    t_c = (P['canti_r'] - 24) / (ss_top - ss_bot).length
    pc = ss(t_c, lerp(half_r, 44, t_c / 0.55) - 3)
    tube("Piwot_tyl_podstawa_" + side, pc, pc + ss_perp_back * 15, 6.5, seg=24)
    tube("Piwot_tyl_" + side, pc, pc + ss_perp_back * 31, 4.0, mat=M_STEEL, seg=24)

# mostek widelek gornych (nad opona)
t_b = (P['wheel_radius'] + 14 - 24) / (ss_top - ss_bot).length
yb = lerp(44, 26, (t_b - 0.55) / 0.30)
pb = lerp(ss_bot, ss_top, t_b)
tube("Mostek_gorny", pb - Y * yb, pb + Y * yb, 5.5, seg=24)

# ---------------------------------------------------------------- WIDELEC
half_f = P['front_oln'] / 2 + P['dropout_t'] / 2
tube("Rura_sterowa", fk(S_CROWN - 30), fk(S_HT + 24), P['d_steerer'] / 2)
tube("Rura_sterowa_otwor", fk(S_HT + 22), fk(S_HT + 24.3), 11.1, mat=M_BLACK)
tube("Korona", fk(S_CROWN - 30), fk(S_CROWN), 15.6, 13.4)
tube("Korona_otwor", fk(S_CROWN - 16, 10), fk(S_CROWN - 16, 15.8), 4.5, mat=M_STEEL, seg=24)   # otwor montazowy z przodu korony
# ksztalt wg zdjec P-23: ramiona korony po luku R~36, golen rownolegla do osi sterowej,
# giecie do przodu zaczyna sie ok. 210 mm nad osia kola [ZALOZENIE ze zdjec]
S0 = S_CROWN - 16                                 # os ramienia korony na szczycie luku
ARC_W, ARC_H = 44.5, 56.0                         # polszerokosc i wysokosc luku korony
s_b = 210.0                                       # poczatek giecia goleni
s_e, n_e = 22.0, P['fork_rake'] - 2.5             # koniec goleni przy haku
def blade_n(s): return 0.0 if s >= s_b else n_e * ((s_b - s) / (s_b - s_e)) ** 2
def blade_r(s): return lerp(14.3, 7.5, max(0.0, min(1.0, (300 - s) / (300 - s_e))))
def blade_y(s): return lerp(ARC_W, half_f, (S0 - ARC_H - s) / (S0 - ARC_H - s_e))
front_outline = [(5, -13), (11, -10), (13, 0), (8, 12), (3, 27), (-8, 27), (-11, 12), (-13, 0),
                 (-11, -10), (-5, -13), (-5, 0), (-3.5, 3.5), (0, 5), (3.5, 3.5), (5, 0)]
for sgn, side in ((1, "L"), (-1, "P")):
    pts, rr = [fk(S0, 0, 0)], [14.3]
    for ang in (20, 40, 60, 75, 90):              # eliptyczny luk korony
        pts.append(fk(S0 - ARC_H * (1 - math.cos(rad(ang))), 0, sgn * ARC_W * math.sin(rad(ang))))
        rr.append(14.3)
    for sv in (300, 250, s_b, 165, 120, 75, s_e): # golen
        pts.append(fk(sv, blade_n(sv), sgn * blade_y(sv))); rr.append(blade_r(sv))
    sweep("Golen_widelca_" + side, pts, rr)
    plate("Hak_przedni_" + side, AX_F + V(0, sgn * half_f, 0), n, u, front_outline, P['dropout_t'])
    s_c = P['canti_r'] + 2
    pc = fk(s_c, blade_n(s_c), sgn * (blade_y(s_c) - 2))
    # naklejki na przodzie goleni: znaczek TR pod piwotem hamulca, nizej LOGIC
    bf = lambda sv, sgn=sgn: (fk(sv, blade_n(sv), sgn * blade_y(sv)), blade_r(sv) + 0.2)
    wrap_v("Naklejka_TR_widelec_" + side, bf, 216.0, 241.0, logo_tr_fork, n, Y, nv=12)
    wrap_v("Naklejka_LOGIC_" + side, bf, 138.0, 210.0, logo_logic, n, Y)
    tube("Piwot_przod_podstawa_" + side, pc, pc + n * 20, 6.5, seg=24)
    tube("Piwot_przod_" + side, pc, pc + n * 36, 4.0, mat=M_STEEL, seg=24)

# znaczek TR na przodzie glowki
wrap_v("Naklejka_TR_glowka", lambda sv: (fk(sv), P['d_head'] / 2 + 0.15), S_HB + 29, S_HB + 71, logo_tr, n, Y, nv=16)

# stery 1" (uproszczone)
tube("Stery_biezna_korony", fk(S_CROWN), fk(S_CROWN + 3), 16.0, mat=M_STEEL)
tube("Stery_miska_dolna", fk(S_CROWN + 3), fk(S_HB), 18.0, 17.0, mat=M_STEEL)
tube("Stery_miska_gorna", fk(S_HT), fk(S_HT + 9), 17.0, 18.0, mat=M_STEEL)
tube("Stery_konus", fk(S_HT + 9), fk(S_HT + 15), 17.0, 15.5, mat=M_STEEL)
tube("Stery_nakretka", fk(S_HT + 15), fk(S_HT + 22), 17.5, mat=M_STEEL, seg=8)

# ---------------------------------------------------------------- DROBNE DETALE
# mocowania koszykow (2 bidony)
dt_dir = (DT_H - BB).normalized(); dt_up = V(-dt_dir.z, 0, dt_dir.x)
for i, s in enumerate((170, 234)):
    c = BB + dt_dir * s
    tube("Koszyk_dolna_%d" % i, c + dt_up * (P['d_down'] / 2 - 1), c + dt_up * (P['d_down'] / 2 + 2.5), 4.5, seg=24)
for i, s in enumerate((150, 214)):
    c = st_dir * s
    tube("Koszyk_podsiodlowa_%d" % i, c + st_front * (P['d_seat'] / 2 - 1), c + st_front * (P['d_seat'] / 2 + 2.5), 4.5, seg=24)
# prowadnice linek na rurze gornej (3 linki gora)
tt_dir = (TT_H - TT_S).normalized(); tt_up = V(-tt_dir.z, 0, tt_dir.x)
tt_len = (TT_H - TT_S).length
for i, s in enumerate((75, tt_len - 75)):
    for j, ang in enumerate((-38, 0, 38)):
        d = tt_up * math.cos(rad(ang)) + Y * math.sin(rad(ang))
        c = TT_S + tt_dir * s + d * (P['d_top'] / 2 + 2.2)
        tube("Prowadnica_%d_%d" % (i, j), c - tt_dir * 5, c + tt_dir * 5, 3.2, seg=12)

# ---------------------------------------------------------------- NAKLEJKI
dt_c = BB + dt_dir * ((DT_H - BB).length * 0.47)
st_c = st_dir * (338 if PAINT == "team" else 290)
for sgn, side in ((-1, "P"), (1, "L")):
    N = V(0, sgn, 0)
    decal("Naklejka_dolna_" + side, dt_c, dt_dir * (-sgn), N, P['d_down'] / 2, 215, logo)
    decal("Naklejka_podsiodlowa_" + side, st_c, -st_dir, N, P['d_seat'] / 2, 150, logo_st)
    decal("Naklejka_P23_" + side, TT_S + tt_dir * (tt_len * 0.75), tt_dir * (-sgn), N, P['d_top'] / 2, 72, logo_p23)

# ---------------------------------------------------------------- LAKIER (kolory wierzcholkow)
for ob in PARTS:
    me = ob.data
    if me.materials[0] is not None and me.materials[0].name == M_RED.name:
        ca = me.color_attributes.new("Col", 'FLOAT_COLOR', 'POINT')
        for v in me.vertices: ca.data[v.index].color = (*paint_color(ob.name, v.co), 1.0)

# ---------------------------------------------------------------- SKALA mm -> m
S = Matrix.Scale(0.001, 4)
for ob in PARTS: ob.data.transform(S)

# ---------------------------------------------------------------- ZAPIS + EKSPORT
bpy.ops.object.select_all(action='DESELECT')
for ob in PARTS: ob.select_set(True)
bpy.context.view_layer.objects.active = PARTS[0]
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, "ritchey_p23_18in" + SUF + ".glb"),
                          export_format='GLB', use_selection=True)

# ---------------------------------------------------------------- STUDIO + RENDER
ground_z = -P['bb_height'] * 0.001
bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, ground_z))
g = bpy.context.object; g.name = "Podloze"
g.data.materials.append(material("Podloze", (0.42, 0.42, 0.43), 0, 0.7))
w = bpy.data.worlds.new("W"); scene.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.92, 0.93, 0.95, 1)
w.node_tree.nodes["Background"].inputs[1].default_value = 0.30
def light(name, kind, loc, energy, size=1.0):
    l = bpy.data.lights.new(name, kind); l.energy = energy
    if kind == 'AREA': l.size = size
    ob = bpy.data.objects.new(name, l); scene.collection.objects.link(ob)
    ob.location = loc
    ob.rotation_euler = (Vector((0.1, 0, 0.25)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    return ob
light("Klucz", 'AREA', (1.2, -2.2, 2.2), 200, 2.5)
light("Wypelnienie", 'AREA', (-2.0, -1.5, 1.0), 70, 3.0)
light("Kontra", 'AREA', (-0.5, 2.5, 1.8), 160, 2.0)

def camera(name, loc, target, ortho=None, lens=70):
    c = bpy.data.cameras.new(name)
    if ortho: c.type = 'ORTHO'; c.ortho_scale = ortho
    else: c.lens = lens
    ob = bpy.data.objects.new(name, c); scene.collection.objects.link(ob)
    ob.location = loc
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    return ob
cams = {
    "render_bok": camera("Kam_bok", (0.10, -4, 0.24), (0.10, 0, 0.24), ortho=1.30),
    "render_3_4": camera("Kam_3_4", (1.75, -1.55, 0.85), (0.10, 0, 0.20), lens=52),
    "render_przod": camera("Kam_przod", (2.9, -0.25, 0.75), (0.55, 0, 0.22), lens=85),
    "render_tyl": camera("Kam_tyl", (-1.45, -1.25, 0.75), (0.02, 0, 0.20), lens=45),
}
scene.render.engine = 'CYCLES'
scene.cycles.samples = 96
scene.render.film_transparent = False
scene.cycles.use_denoising = True
scene.render.resolution_x = 1600; scene.render.resolution_y = 1000
scene.view_settings.view_transform = 'Standard'
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "ritchey_p23_18in" + SUF + ".blend"))
if os.environ.get("P23_NO_RENDER") != "1":
    for name, cam in cams.items():
        scene.camera = cam
        scene.render.filepath = os.path.join(OUT, name + SUF + ".png")
        bpy.ops.render.render(write_still=True)
print("DONE")
