"""Author the editable ward in Blender; export a material-merged GLB for the website.
Run: blender --background --factory-startup --python tools/blender/build_horror_ward.py
All geometry and PBR textures are generated locally in Blender, with a fixed seed.
"""
import bpy, math, random, runpy
import numpy as np
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'assets-source' / 'horror-ward'
TEXTURES = SOURCE / 'textures'
MODELS = ROOT / 'public' / 'models'
for folder in (SOURCE, TEXTURES, MODELS): folder.mkdir(parents=True, exist_ok=True)
random.seed(317)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'

def noise(n, frequency, seed):
    rng = np.random.default_rng(seed)
    small = rng.random((frequency + 1, frequency + 1))
    small[-1, :] = small[0, :]; small[:, -1] = small[:, 0]
    a = np.linspace(0, frequency, n, endpoint=False)
    lo = a.astype(int); t = a - lo; t = t*t*(3-2*t)
    rows = small[lo, :] * (1-t[:, None]) + small[lo+1, :] * t[:, None]
    return rows[:, lo]*(1-t[None, :]) + rows[:, lo+1]*t[None, :]

def save_map(name, pixels, color=True):
    n = pixels.shape[0]
    image = bpy.data.images.new(name, width=n, height=n, alpha=False)
    image.colorspace_settings.name = 'sRGB' if color else 'Non-Color'
    rgba = np.ones((n,n,4), dtype=np.float32)
    rgba[:,:,:3] = pixels if pixels.ndim == 3 else pixels[:,:,None]
    image.pixels.foreach_set(rgba.ravel())
    image.filepath_raw = str(TEXTURES / (name+'.png')); image.file_format = 'PNG'; image.save()
    return image

def textured(name, kind, base, metallic=0, size=512):
    n=size; v,u=np.mgrid[0:n,0:n]/n
    broad=noise(n,5,17+len(name)); medium=noise(n,35,61+len(name)); grain=noise(n,170,94)
    color=np.empty((n,n,3)); color[:]=base
    height=(medium-.5)*.013+(grain-.5)*.006
    rough=.82+(broad-.5)*.20
    color *= (.82+broad*.18+grain*.045)[:,:,None]
    if kind in ('floor','tiles'):
        lines=(np.minimum((u*4)%1,1-(u*4)%1)<.013)|(np.minimum((v*4)%1,1-(v*4)%1)<.013)
        seam=np.minimum(np.minimum((u*4)%1,1-(u*4)%1),np.minimum((v*4)%1,1-(v*4)%1))
        edge=np.clip(seam/.045,0,1)
        color*= (.6+.4*edge)[:,:,None];color[lines]=np.array(base)*.22
        height-=np.maximum(0,.025-seam)*1.8
        # Glazed tiles retain broken, uneven reflections, unlike uniformly matte clay.
        worn=noise(n,19,731)
        rough=np.where(lines,.96,.59+(worn-.5)*.26+(grain-.5)*.08)
        tile=np.floor(u*4)+np.floor(v*4)*4
        tile_tone=.94+.06*np.sin(tile*2.17)
        color*=tile_tone[:,:,None]
        scratches=np.abs(np.sin(u*240+medium*5))>.998
        color[scratches]*=.65
        if kind=='floor':
            color*= (.78+.22*noise(n,12,24))[:,:,None]
            damp=noise(n,6,542)*.6+noise(n,14,216)*.4
            wet=np.clip((damp-.57)*3,0,.65)
            rough=rough*(1-wet)+.28*wet
            color*= (1-wet*.18)[:,:,None]
    if kind=='plaster':
        # Quiet lime paint with restrained porous damage, rather than camouflage spots.
        damp=noise(n,3,315)*.68+noise(n,18,286)*.24+medium*.08
        peel=damp>.77
        color*=np.clip(.86+damp*.17,.86,1)[:,:,None]
        color[peel]=np.array(base)*(.72+grain[peel,None]*.10)
        height+=peel*.007
        cracks=(np.abs(np.sin(u*31+noise(n,7,65)*3+v*8))<.010)&(broad>.64)
        color[cracks]*=.55;height[cracks]-=.006
        streak=(noise(n,46,81)*noise(n,4,41))>.62
        color[streak]*=.88
    if kind=='enamel':
        rust=(medium*.55+broad*.45)>.76
        color[rust]=np.array([.2,.105,.071])*(.6+grain[rust,None]*.8)
        height[rust]-=.009;rough[rust]=.95
        scratches=(np.sin(u*611+medium*.55)>.9995)&(noise(n,27,77)>.48)
        color[scratches]*=.47; height[scratches]-=.004
        rough=np.where(rust,.95,.47+(broad-.5)*.25+(grain-.5)*.07)
    if kind=='bakelite':
        rough=.61+(broad-.5)*.28+(grain-.5)*.09
        scratch=(np.abs(np.sin(u*382+v*20+medium*1.1))>.999)&(broad>.55)
        color[scratch]*=1.8;height[scratch]-=.003;rough[scratch]=.77
        color*= (.83+noise(n,11,572)*.28)[:,:,None]
    if kind=='glass':
        film=noise(n,5,482)*.6+noise(n,33,194)*.4
        streak=noise(n,94,77)*noise(n,3,127)
        color*= (.43+film*.44+streak*.15)[:,:,None]
        rough=.56+film*.29
        height=(grain-.5)*.002
    if kind in ('linen','bloody_linen'):
        weave=(np.sin(u*math.pi*n*.72)*np.sin(v*math.pi*n*.72))*.0015
        height+=weave;rough[:]=.94
        if kind=='bloody_linen':
            stain=np.exp(-((u-.63)**2/.035+(v-.54)**2/.04))
            bleed=stain*(.45+broad*.7+medium*.2)
            mask=np.clip((bleed-.16)*2.4,0,.92)
            color=color*(1-mask[:,:,None])+np.array([.18,.016,.024])*mask[:,:,None]
    material=bpy.data.materials.new(name);material.use_nodes=True
    nodes=material.node_tree.nodes;links=material.node_tree.links;bsdf=nodes.get('Principled BSDF')
    bsdf.inputs['Metallic'].default_value=metallic
    for map_name,pixels,socket,col in [('color',np.clip(color,0,1),'Base Color',True),('rough',np.clip(rough,0,1),'Roughness',False)]:
        tex=nodes.new('ShaderNodeTexImage');tex.image=save_map(name+'_'+map_name,pixels,col)
        links.new(tex.outputs['Color'],bsdf.inputs[socket])
    gy,gx=np.gradient(height);normal=np.stack((-gx*n*.24,-gy*n*.24,np.ones_like(gx)),axis=2)
    normal/=np.linalg.norm(normal,axis=2)[:,:,None]
    tex=nodes.new('ShaderNodeTexImage');tex.image=save_map(name+'_normal',normal*.5+.5,False)
    norm=nodes.new('ShaderNodeNormalMap');norm.inputs['Strength'].default_value=.4 if kind in ('linen','bloody_linen') else .65
    links.new(tex.outputs['Color'],norm.inputs['Color']);links.new(norm.outputs['Normal'],bsdf.inputs['Normal'])
    return material

def plain(name,color,rough=.8,metal=0,emission=0):
    m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
    if emission:p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emission
    return m

PAINT=textured('Damp_flaking_paint','plaster',(.29,.34,.32),size=1024)
TILE=textured('Cracked_wall_tiles','tiles',(.39,.44,.42))
FLOOR=textured('Dirty_floor_tiles','floor',(.22,.26,.26),size=1024)
ENAMEL=textured('Chipped_enamel','enamel',(.66,.67,.59),.22)
STEEL=textured('Oxidised_steel','enamel',(.22,.25,.24),.65)
LINEN=textured('Old_cotton','linen',(.45,.46,.4))
BLOODY=textured('Absorbed_blood_cotton','bloody_linen',(.43,.45,.4))
WOOD=textured('Dark_bakelite','bakelite',(.026,.031,.030))
BLOOD=plain('Dried_crimson',(.10,.004,.009),.87)
GROUT=plain('Concrete',(.11,.14,.14),.97)
RED=plain('Alarm_glass',(.48,.018,.025),.32,0,1.5)
WINDOW=textured('Cold_frosted_glass','glass',(.24,.34,.35))
window_shader=WINDOW.node_tree.nodes.get('Principled BSDF')
window_shader.inputs['Emission Color'].default_value=(.15,.22,.23,1)
window_shader.inputs['Emission Strength'].default_value=.13
SCREEN=plain('Ward_CRT_phosphor',(.042,.077,.063),.48,0,.7)
PAPER=plain('Yellowed_case_notes',(.55,.57,.46),.95)
CRT_CASE=textured('Scuffed_CRT_bakelite','bakelite',(.061,.067,.064),.02)
CRT_RUBBER=plain('Recessed_glass_rubber',(.009,.014,.014),.88)
CRT_EDGE=plain('Worn_CRT_edges',(.046,.054,.049),.84,.06)
CRT_GLASS=plain('Curved_CRT_glass',(.025,.039,.036),.27,.06,.22)
FLUORESCENT=plain('Aged_fluorescent_phosphor',(.52,.62,.56),.63,0,1.1)
CORRIDOR_PLASTER=textured('Corridor_scraped_plaster','plaster',(.33,.35,.32),size=1024)
ORGANIC=textured('Corridor_shadowed_skin','plaster',(.047,.052,.049))
RUST=textured('Exposed_concrete_chips','plaster',(.17,.18,.16))

def finish(obj,name,mat,smooth=False):
    obj.name=name
    if mat:obj.data.materials.append(mat)
    if smooth and obj.type=='MESH':
        for p in obj.data.polygons:p.use_smooth=True
    return obj

def box(name,loc,size,mat,bevel=0):
    # Data API avoids a scene-wide dependency-graph/operator update for every
    # little vent, tile lip and door frame in this deliberately detailed model.
    sx,sy,sz=(value/2 for value in size)
    verts=[(-sx,-sy,-sz),(-sx,-sy,sz),(-sx,sy,-sz),(-sx,sy,sz),(sx,-sy,-sz),(sx,-sy,sz),(sx,sy,-sz),(sx,sy,sz)]
    faces=[(0,2,6,4),(1,5,7,3),(0,4,5,1),(2,3,7,6),(0,1,3,2),(4,6,7,5)]
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
    o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=loc
    bpy.context.view_layer.objects.active=o;o.select_set(True)
    if bevel:
        mod=o.modifiers.new('Worn edges','BEVEL');mod.width=bevel;mod.segments=2
        bpy.ops.object.modifier_apply(modifier=mod.name)
        # Broad cabinet faces stay planar; only the edge radius catches a soft
        # highlight. Smooth-only cube normals make old bakelite look like rubber.
        for polygon in o.data.polygons:polygon.use_smooth=True
        weighted=o.modifiers.new('Planar weighted normals','WEIGHTED_NORMAL');weighted.keep_sharp=True;weighted.weight=50
        bpy.ops.object.modifier_apply(modifier=weighted.name)
    uv=o.data.uv_layers.new(name='UVMap')
    for poly in o.data.polygons:
        axis=max(range(3),key=lambda index:abs(poly.normal[index]))
        for li in poly.loop_indices:
            co=o.data.vertices[o.data.loops[li].vertex_index].co
            uv.data[li].uv=(co[1]/2,co[2]/2) if axis==0 else ((co[0]/2,co[2]/2) if axis==1 else (co[0]/2,co[1]/2))
    o.select_set(False)
    return finish(o,name,mat,bevel>0)

def rod(name,a,b,r,mat=STEEL,vertices=12):
    a,b=Vector(a),Vector(b);mid=(a+b)/2
    length=(b-a).length;points=[];faces=[];uv=[]
    for end in [-1,1]:
        for i in range(vertices):
            angle=i/vertices*math.tau;points.append((r*math.cos(angle),r*math.sin(angle),end*length/2));uv.append((i/vertices,(end+1)*length/4))
    for i in range(vertices):faces.append((i,(i+1)%vertices,(i+1)%vertices+vertices,i+vertices))
    faces.extend([tuple(range(vertices-1,-1,-1)),tuple(range(vertices,2*vertices))])
    o=mesh(name,points,faces,mat,uv,True);o.location=mid;o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
    return o

def mesh(name,verts,faces,mat,uv=None,smooth=False):
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
    o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);finish(o,name,mat,smooth)
    if uv:
        layer=data.uv_layers.new(name='UVMap')
        for poly in data.polygons:
            for li in poly.loop_indices:layer.data[li].uv=uv[data.loops[li].vertex_index]
    return o

def stain(name,center,radius,axis='floor'):
    cx,cy,cz=center;verts=[center]
    # Dried liquid has rounded lobes and a few weak edges, not a cartoon star.
    radii=[random.uniform(.78,1.08) for _ in range(28)]
    radii=[(radii[(i-1)%28]+radii[i]*2+radii[(i+1)%28])/4 for i in range(28)]
    for i in range(28):
        angle=i/28*math.tau;r=radius*radii[i]
        if axis=='floor':verts.append((cx+math.cos(angle)*r,cy+math.sin(angle)*r*.7,cz))
        else:verts.append((cx,cy+math.cos(angle)*r,cz+math.sin(angle)*r*.7))
    return mesh(name,verts,[(0,i+1,(i+1)%28+1) for i in range(28)],BLOOD)

def text(name,body,loc,size,rotation,mat=ENAMEL):
    data=bpy.data.curves.new(name,'FONT');data.body=body;data.size=size;data.extrude=.0006;data.align_x='CENTER'
    obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=loc;obj.rotation_euler=rotation;obj.data.materials.append(mat)
    bpy.context.view_layer.objects.active=obj;obj.select_set(True);bpy.ops.object.convert(target='MESH');obj.select_set(False)
    return obj

# Architecture: metre-scale room, real wall openings and a walkable central aisle.
print('WARD_AUTHOR architecture',flush=True)
box('Ward floor slab',(0,0,-.14),(9.2,14.3,.28),GROUT,.015)
# Subdivided floor with metre-scaled UVs. Vertex AO grounds equipment without a
# second transparent decal plane or a runtime screen-space effect.
floor_vertices=[];floor_faces=[];floor_uv=[];floor_colors=[];nx,ny=47,73
for j in range(ny):
    yy=-7.15+j/(ny-1)*14.3
    for i in range(nx):
        xx=-4.6+i/(nx-1)*9.2;floor_vertices.append((xx,yy,.001));floor_uv.append((xx/2,yy/2))
        edge=min(4.45-abs(xx),7-abs(yy));shade=1-.34*math.exp(-max(0,edge)/.20)
        for bx,by in [(-3.45,4.1),(3.45,3.6),(3.45,-4.1)]:
            dx=max(0,abs(xx-bx)-.77);dy=max(0,abs(yy-by)-1.35)
            shade*=1-.43*math.exp(-(dx*dx+dy*dy)/.075)
        for bx,by in [(-2.45,-2),(2.45,1.3),(-2.4,1.2)]:
            dx=max(0,abs(xx-bx)-.75);dy=max(0,abs(yy-by)-.25)
            shade*=1-.24*math.exp(-(dx*dx+dy*dy)/.045)
        shade*=1-.31*math.exp(-((yy-6.15)/.5)**2)*(1 if abs(xx)<3 else .2)
        floor_colors.append((shade,shade,shade,1))
        if i and j:
            k=j*nx+i;floor_faces.append((k-nx-1,k-nx,k,k-1))
floor_obj=mesh('Ward floor tile surface',floor_vertices,floor_faces,FLOOR,floor_uv)
colors=floor_obj.data.color_attributes.new(name='AmbientContact',type='FLOAT_COLOR',domain='POINT')
for item,value in zip(colors.data,floor_colors):item.color=value
box('Ward ceiling',(0,0,3.55),(9.2,14.3,.18),PAINT)
for side in [-1,1]:
    x=side*4.5
    box('Upper side plaster',(x,0,2.35),(.2,14.2,2.4),PAINT)
    box('Side tile dado',(x-side*.025,0,.65),(.21,14.2,1.3),TILE)
    rod('Exposed water pipe',(x-side*.18,-6.8,3.2),(x-side*.18,6.8,3.2),.037)
for y in [-7,7]:
    for x in [-2.65,2.65]:
        box('Rear plaster',(x,y,2.3),(3.7,.2,2.5),PAINT)
        box('Rear tiles',(x,y-.03,.62),(3.7,.22,1.25),TILE)
    box('Door lintel',(0,y,3.05),(1.6,.23,.9),PAINT)
    # The entrance is a real opening into the connected corridor, never a camera
    # clipped through a closed door. The rear door remains locked.
    if y==7:box('Locked steel door',(0,y,1.25),(1.5,.12,2.5),STEEL,.007)
    for x in [-.81,.81]:box('Door frame',(x,y-.11,1.28),(.09,.15,2.58),STEEL)
    box('Door frame header',(0,y-.11,2.6),(1.7,.15,.08),STEEL)
    if y==7:
        box('Observation glass',(0,y-.073,1.83),(.54,.018,.43),WOOD,.007)
        for x in [-.31,.31]:box('Window frame',(x,y-.095,1.83),(.055,.035,.53),STEEL)
        rod('Door handle',(.5,y-.16,1.12),(.5,y-.16,.94),.026)
    else:
        # A door leaf folded against the corridor wall, with a narrow real gap.
        box('Open ward door leaf',(1.43,-7.66,1.25),(.10,1.47,2.5),STEEL,.007)
        box('Open ward door observation',(1.367,-7.66,1.83),(.014,.53,.43),WOOD,.004)
        rod('Open ward door handle',(1.344,-8.15,1.12),(1.344,-8.15,.94),.024)
text('Ward number','06',(0,6.918,1.37),.17,(math.pi/2,0,0))

# Recessed windows along the left wall; emitters and light sources are separate.
for yy in [-3.5,.1,3.7]:
    box('Window recess',(-4.372,yy,2.15),(.03,2.3,1.72),WOOD)
    box('Frosted window',(-4.345,yy,2.15),(.025,2.12,1.52),WINDOW)
    for yedge in [yy-1.12,yy+1.12,yy]:rod('Window mullion',(-4.30,yedge,1.31),(-4.30,yedge,3.01),.033,ENAMEL)
    rod('Window crossbar',(-4.30,yy-1.12,2.16),(-4.30,yy+1.12,2.16),.03,ENAMEL)

def bed(name,x,y,bloody=False):
    box(name+' mattress',(x,y,.79),(1.45,2.6,.22),LINEN,.035)
    # A compressed, uneven pillow, not an inflated rounded rectangular block.
    pillow=box(name+' pillow',(x+.025,y+.84,.97),(1.06,.49,.13),LINEN,.040)
    pillow.rotation_euler[2]=.035
    for xx in [x-.74,x+.74]:
        rod(name+' long frame',(xx,y-1.34,.6),(xx,y+1.34,.6),.04,ENAMEL)
        for yy in [y-1.34,y+1.34]:
            rod(name+' upright',(xx,yy,.15),(xx,yy,1.30),.042,ENAMEL)
            rod(name+' castor axle',(xx-.045,yy,.12),(xx+.045,yy,.12),.09,WOOD)
    for yy in [y-1.34,y+1.34]:
        rod(name+' upper rail',(x-.74,yy,1.30),(x+.74,yy,1.30),.042,ENAMEL)
        rod(name+' lower rail',(x-.74,yy,.62),(x+.74,yy,.62),.032,ENAMEL)
        for offset in [-.52,-.26,0,.26,.52]:rod(name+' rail bar',(x+offset,yy,.63),(x+offset,yy,1.29),.021,ENAMEL)
    verts=[];uv=[];faces=[];nu,nv=37,55
    for j in range(nv):
        v=j/(nv-1)
        for i in range(nu):
            u=i/(nu-1);xx=(u-.5)*2.02;zz=.922-.43*max(0,(abs(xx)-.66)/.35)
            # Broad gravity folds with small uneven creases, no corrugated ridges.
            zz+=.012*math.sin(v*18+u*7)+.006*math.cos(u*28+v*4)
            zz+=.012*math.sin(u*68+v*9)*max(0,(abs(xx)-.55)/.45)
            verts.append((x+xx,y-1.33+v*1.94,zz));uv.append((u,v))
            if i and j:
                k=j*nu+i;faces.append((k-nu-1,k-nu,k,k-1))
    mesh(name+' draped cotton',verts,faces,BLOODY if bloody else LINEN,uv,True)

bed('Bed 06',3.45,-4.1,True)
bed('Bed 05',3.45,3.6)
bed('Bed 04',-3.45,4.1)
print('WARD_AUTHOR beds complete',flush=True)

# Curtain folds are geometry: their perspective changes as the camera passes.
rod('Privacy rail',(4.07,-.06,2.95),(3.22,-.06,2.95),.025)
verts=[];faces=[];uv=[]
for j in range(16):
    v=j/15
    for i in range(53):
        u=i/52;verts.append((3.38+u*.55,-.06+math.sin(u*math.tau*7)*.075,.22+v*2.62+.018*math.sin(u*32)));uv.append((u*1.3,v))
        if i and j:k=j*53+i;faces.append((k-54,k-53,k,k-1))
curtain_pivot=Vector((3.655,-.06,2.84))
curtain=mesh('RoomCurtain_privacy',[tuple(Vector(v)-curtain_pivot) for v in verts],faces,LINEN,uv,True)
curtain.location=curtain_pivot
curtain['dynamic_kind']='curtain';curtain['three_position']=[3.655,2.84,.06]

# Nurses' post, IV stand, tray and an old curved CRT, modelled as separate objects.
for x in [-3.5,-2.15]:
    for y in [3.75,4.5]:rod('Trolley post',(x,y,.15),(x,y,1.12),.025)
for z in [.24,.65,1.08]:box('Trolley shelf',(-2.825,4.12,z),(1.49,.86,.035),STEEL,.015)
box('Case folder',(-2.7,3.95,1.116),(.52,.38,.018),PAPER,.012)
box('Bakelite telephone base',(-3.08,4.02,1.22),(.43,.34,.16),WOOD,.045)
for xx in [-3.22,-2.94]:rod('Telephone handset end',(xx,3.98,1.37),(xx,4.09,1.41),.065,WOOD)
rod('Telephone handset',(-3.22,4.04,1.42),(-2.94,4.04,1.42),.044,WOOD)
for i in range(28):
    a=i/28*math.tau*8;b=(i+1)/28*math.tau*8
    rod('Coiled phone cable',(-3.3+.025*math.cos(a),3.96+.025*math.sin(a),1.22-i*.012),(-3.3+.025*math.cos(b),3.96+.025*math.sin(b),1.22-(i+1)*.012),.006,WOOD,6)
box('Ward CRT cabinet',(-2.52,4.10,1.48),(.62,.40,.49),WOOD,.045)
box('Ward CRT bezel',(-2.52,3.88,1.50),(.52,.035,.38),STEEL,.025)
verts=[];faces=[];uv=[]
for j in range(15):
    v=j/14
    for i in range(21):
        u=i/20;bulge=.024*(1-(2*u-1)**2)*(1-(2*v-1)**2)
        verts.append((-2.52+(u-.5)*.45,3.85-bulge,1.5+(v-.5)*.31));uv.append((u,v))
        if i and j:k=j*21+i;faces.append((k-22,k-21,k,k-1))
mesh('Ward_CRT_Screen',verts,faces,SCREEN,uv,True)

SCREEN_LAYOUT=[]
def crt(name,center,width,height,variant=0,stand=True):
    """A recessed phosphor surface, four solid bezel members and a full cabinet.
    center is Three.js x/y/z; only this function converts to Blender Z-up.
    Screen geometry stays separately addressable in the exported GLB.
    """
    x,z,depth=center;y=-depth
    control=width*.12;outer_w=width+control+.14;outer_h=height+.19
    cabinet_depth=width*.41
    body_x=x+control/2
    body=box(name+' CRT cabinet',(body_x,y+cabinet_depth*.53,z),(outer_w,cabinet_depth,outer_h),CRT_CASE,.022)
    # Rubbery inset, not a flat image pasted over a complete front-facing cube.
    for side in [-1,1]:
        box(name+' inner side',(x+side*(width/2+.026),y+.005,z),(.062,.075,height+.10),CRT_RUBBER,.009)
        box(name+' outer side',(x+side*(width/2+.065)+(control/2 if side==1 else 0),y+.055,z),(.080+(control if side==1 else 0),.11,outer_h-.01),CRT_CASE,.009)
    for side in [-1,1]:
        box(name+' inner top bottom',(x,y+.006,z+side*(height/2+.025)),(width+.06,.075,.066),CRT_RUBBER,.009)
        box(name+' outer top bottom',(body_x,y+.055,z+side*(height/2+.066)),(outer_w-.08,.11,.080),CRT_CASE,.009)
    verts=[];faces=[];uv=[];nu,nv=25,19
    for j in range(nv):
        v=j/(nv-1)
        for i in range(nu):
            u=i/(nu-1);bulge=.014*(1-(2*u-1)**2)*(1-(2*v-1)**2)
            verts.append(((u-.5)*width,-bulge,(v-.5)*height));uv.append((u,v))
            if i and j:
                k=j*nu+i;faces.append((k-nu-1,k-nu,k,k-1))
    screen=mesh('RoomScreen_'+name,verts,faces,CRT_GLASS,uv,True)
    screen.location=(x,y,z)
    screen['screen_id']=name;screen['width']=width;screen['height']=height
    screen['three_position']=list(center);screen['front_axis']='+Z'
    # Knurled analogue tuning dials on the right face and engraved speaker slots.
    knob_x=x+width/2+control*.61+.055
    for zz in [z+height*.22,z-height*.08]:
        rod(name+' tuning dial',(knob_x,y-.025,zz),(knob_x,y+.034,zz),width*.035,CRT_EDGE,16)
        for tick in range(8):
            angle=tick/8*math.tau;r=width*.027
            rod(name+' dial groove',(knob_x+r*math.cos(angle),y-.027,zz+r*math.sin(angle)),(knob_x+r*.82*math.cos(angle),y-.027,zz+r*.82*math.sin(angle)),.0025,CRT_RUBBER,4)
    for line in range(8):
        zz=z-height*.26-line*.016
        box(name+' speaker slot',(knob_x,y-.004,zz),(control*.65,.008,.005),CRT_RUBBER,.002)
    box(name+' power indicator',(knob_x-.018,y-.014,z-height*.41),(.009,.009,.009),RED,.003)
    # Subtle physical abrasions catch the room light at different angles.
    rng=random.Random(300+variant)
    for scratch in range(5):
        sx=x+rng.uniform(-width*.43,width*.43);sz=z+(height*.5+.067)*(1 if scratch%2 else -1)
        rod(name+' bezel nick',(sx,y-.004,sz),(sx+rng.uniform(.018,.065),y-.004,sz+.001),.0018,CRT_EDGE,4)
    # Ventilation fins on the top and sides and short rear leads disappearing to the floor.
    for vent in range(12):
        sx=body_x-outer_w*.32+vent*outer_w*.058
        box(name+' cooling vent',(sx,y+cabinet_depth*.68,z+outer_h/2+.001),(.014,cabinet_depth*.30,.003),CRT_RUBBER)
    for foot in [-1,1]:
        box(name+' rubber foot',(body_x+foot*outer_w*.31,y+cabinet_depth*.42,z-outer_h/2-.025),(.11,cabinet_depth*.42,.050),CRT_RUBBER,.012)
    if stand:
        surface=z-outer_h/2-.052
        box(name+' equipment shelf',(body_x,y+cabinet_depth*.48,surface-.028),(outer_w+.13,cabinet_depth+.16,.055),STEEL,.020)
        for sx in [body_x-outer_w*.42,body_x+outer_w*.42]:
            for sy in [y+.05,y+cabinet_depth*.85]:rod(name+' stand leg',(sx,sy,.07),(sx,sy,surface-.035),.025,STEEL)
        for sx in [body_x-outer_w*.42,body_x+outer_w*.42]:
            rod(name+' stand brace',(sx,y+.05,.23),(sx,y+cabinet_depth*.85,.23),.015,STEEL)
    # Real looping power leads have a ground contact and route behind equipment.
    points=[(body_x,y+cabinet_depth,z-.05),(body_x+.12,y+cabinet_depth+.07,z-.34),(body_x+.18,y+cabinet_depth+.14,.06),(body_x+.42,y+cabinet_depth+.24,.022),(body_x+.53,y+cabinet_depth+.48,.022)]
    for a,b in zip(points,points[1:]):rod(name+' power lead',a,b,.009,WOOD,6)
    SCREEN_LAYOUT.append({'name':'RoomScreen_'+name,'center':list(center),'width':width,'height':height,'normal':[0,0,1]})

crt('gallery',(-2.45,1.60,2.0),1.50,1.08,0)
crt('game',(2.45,1.55,-1.30),1.50,1.08,1)
crt('info',(-2.40,1.60,-1.20),1.50,1.08,2)
for index,x in enumerate([-2.15,-.72,.72,2.15]):crt('quest_'+str(index),(x,1.28,-5.75),1.10,.80,3+index,False)
for index,x in enumerate([-1.45,0,1.45]):crt('ambient_'+str(index),(x,2.48,-5.75),1.0,.72,7+index,False)
print('WARD_AUTHOR televisions complete',flush=True)
# Steel rack: visible structural supports under the seven separate cabinets.
for xx in [-3.01,3.01]:
    rod('Broadcast rack upright',(xx,5.99,.05),(xx,5.99,3.13),.039,STEEL)
    rod('Broadcast rack rear foot',(xx,5.86,.065),(xx,6.67,.065),.050,STEEL)
for zz in [.72,1.93,3.10]:
    rod('Broadcast rack horizontal',(-3.02,6.00,zz),(3.02,6.00,zz),.039,STEEL)
for zz in [.705,1.915]:box('Broadcast rack shelf',(0,6.1,zz),(6.05,.74,.045),STEEL,.014)
# Cable bundles in the back of the room, grounded and routed alongside the wall.
for cable in range(5):
    pts=[]
    for k in range(25):
        t=k/24;pts.append((-3.3+t*6.5,6.55+.075*math.sin(t*12+cable),.018+cable*.009))
    for a,b in zip(pts,pts[1:]):rod('Rack floor cable',a,b,.008,WOOD,6)

rod('IV stand',(2.6,-3.3,.06),(2.6,-3.3,2.25),.022,ENAMEL)
for a in [0,2.094,4.189]:rod('IV feet',(2.6,-3.3,.12),(2.6+.34*math.cos(a),-3.3+.34*math.sin(a),.04),.018)
rod('IV hook',(2.3,-3.3,2.24),(2.84,-3.3,2.24),.018)
box('Clouded infusion bag',(2.42,-3.3,1.99),(.2,.06,.31),PAPER,.035)
for i in range(13):rod('Infusion tube',(2.42+.04*math.sin(i*.6),-3.3,1.81-i*.07),(2.42+.04*math.sin((i+1)*.6),-3.3,1.81-(i+1)*.07),.005,ENAMEL,6)

# A dragged partial handprint on the tile wall, and irregular dried marks on the floor.
stain('Palm print',(4.385,-2.13,1.65),.125,'wall')
for k in range(5):
    yy=-2.24+k*.051;length=[.15,.21,.24,.20,.13][k]
    for step in range(7):stain('Finger trace',(4.384,yy+step*.003,1.74+step*length/7),.022-step*.0014,'wall')
for k in range(8):stain('Dragged hand',(4.383,-2.08+math.sin(k*.4)*.018,1.56-k*.055),.039-k*.003,'wall')
stain('Bedside blood',(3.0,-4.3,.002),.23)
for i in range(37):stain('Small spatter',(random.uniform(2.8,3.9),random.uniform(-5.2,-3.3),.0015),random.uniform(.005,.026))
for step in range(9):
    cx=.5+(.16 if step%2 else -.16);cy=-3.6+step*.87;angle=(-.1 if step%2 else .11)
    def foot_point(px,py):return(cx+px*math.cos(angle)-py*math.sin(angle),cy+px*math.sin(angle)+py*math.cos(angle),.0015)
    stain('Dirty shoe heel',foot_point(0,-.105),.048)
    for tread in range(6):
        half=.056*math.sin((tread+1)/7*math.pi)**.35
        for side in [-1,1]:
            verts=[foot_point(side*.009,-.024+tread*.032),foot_point(side*half,-.024+tread*.032),foot_point(side*half*.92,-.015+tread*.032),foot_point(side*.009,-.014+tread*.032)]
            mesh('Broken sole print',verts,[(0,1,2,3)],BLOOD)

# A few fallen case notes and a bent tray support the abandoned ward narrative.
# They are ordinary 3D room props, never navigation or floating UI cards.
for index,(px,py,angle) in enumerate([(-3.55,-5.4,.31),(-3.29,-5.22,-.24),(-3.69,.4,.65),(3.64,5.1,-.18),(-3.56,4.87,.37),(-2.92,5.22,.45)]):
    points=[]
    for a,b,c in [(-.12,-.17,.005),(.12,-.17,.008),(.12,.17,.012),(-.12,.17,.037)]:
        points.append((px+a*math.cos(angle)-b*math.sin(angle),py+a*math.sin(angle)+b*math.cos(angle),c))
    mesh('Fallen case note '+str(index),points,[(0,1,2,3)],PAPER,[(0,0),(1,0),(1,1),(0,1)])
box('Fallen steel tray',(3.8,-1.0,.055),(.36,.49,.038),STEEL,.04).rotation_euler[2]=.22

def tapered_tube(name,points,radii,mat,segments=10,flatten=.85,origin=None):
    """Connected ring mesh with restrained taper, useful for cables and limbs.
    Unlike overlapping capsule primitives this preserves a continuous silhouette.
    """
    verts=[];faces=[];uv=[]
    for i,p in enumerate(points):
        p=Vector(p); tangent=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])
        tangent.normalize();reference=Vector((0,0,1))
        if abs(tangent.dot(reference))>.93:reference=Vector((0,1,0))
        across=tangent.cross(reference).normalized();up=tangent.cross(across).normalized()
        for ring in range(segments):
            a=ring/segments*math.tau
            irregular=1+.025*math.sin(ring*2.4+i*1.7)
            q=p+(across*math.cos(a)+up*math.sin(a)*flatten)*radii[i]*irregular
            verts.append(tuple(q));uv.append((ring/segments,i/(len(points)-1)))
            if i:
                k=i*segments+ring;prev=i*segments+(ring+1)%segments
                faces.append((k-segments,prev-segments,prev,k))
    faces.extend([tuple(range(segments-1,-1,-1)),tuple(range((len(points)-1)*segments,len(points)*segments))])
    pivot=Vector(origin) if origin else Vector((0,0,0))
    obj=mesh(name,[tuple(Vector(v)-pivot) for v in verts],faces,mat,uv,True);obj.location=pivot
    return obj

# A physically connected thirteen-metre passage precedes the same ward. Its
print('WARD_AUTHOR corridor',flush=True)
# centre is clear for the camera, and the open door at y=-7 is a real opening.
box('Corridor foundation',(0,-13.55,-.13),(3.3,13.1,.26),GROUT,.006)
cverts=[];cfaces=[];cuv=[];ccolors=[];cnx,cny=21,81
for j in range(cny):
    yy=-20.1+j/(cny-1)*12.95
    for i in range(cnx):
        xx=-1.65+i/(cnx-1)*3.3
        cverts.append((xx,yy,.001));cuv.append((xx/2,yy/2))
        shade=1-.43*math.exp(-max(0,1.51-abs(xx))/.17)
        ccolors.append((shade,shade,shade,1))
        if i and j:
            k=j*cnx+i;cfaces.append((k-cnx-1,k-cnx,k,k-1))
corridor_floor=mesh('Corridor old tile floor',cverts,cfaces,FLOOR,cuv)
ao=corridor_floor.data.color_attributes.new(name='AmbientContact',type='FLOAT_COLOR',domain='POINT')
for item,value in zip(ao.data,ccolors):item.color=value
box('Corridor suspended ceiling',(0,-13.55,3.46),(3.3,13.1,.16),CORRIDOR_PLASTER)
for side in [-1,1]:
    xx=side*1.6
    box('Corridor plaster wall',(xx,-13.55,2.3),(.20,13.1,2.3),CORRIDOR_PLASTER)
    box('Corridor ceramic dado',(xx-side*.018,-13.55,.65),(.20,13.1,1.3),TILE)
    box('Corridor dado lip',(side*1.475,-13.55,1.318),(.045,13.1,.038),ENAMEL,.004)
    box('Corridor battered skirting',(side*1.472,-13.55,.065),(.04,13.1,.12),STEEL,.004)
    for zz in [2.98,3.12]:rod('Corridor overhead pipe',(side*1.39,-20.0,zz),(side*1.39,-7.13,zz),.026 if zz>3 else .019,STEEL,10)
    for yy in [-9.1,-13.2,-17.4]:
        # Dark inset steel service doors have frames, hinges and a raised plate.
        box('Corridor recessed side door',(side*1.475,yy,1.17),(.022,.88,2.30),WOOD,.003)
        for edge in [-.47,.47]:box('Corridor side door upright',(side*1.448,yy+edge,1.18),(.065,.055,2.38),STEEL,.004)
        box('Corridor side door lintel',(side*1.448,yy,2.38),(.065,.99,.065),STEEL,.004)
        rod('Corridor side door handle',(side*1.414,yy-.29,1.12),(side*1.414,yy-.29,.96),.015,STEEL,10)
        for zz in [.36,1.98]:rod('Corridor exposed door hinge',(side*1.425,yy+.44,zz),(side*1.425,yy+.44,zz+.11),.014,STEEL,8)
    # Metre-scale labels, sparse lime flakes and subtle residue are supplied by
    # the shared refinement helper below, keeping full and targeted exports equal.
    rod('Corridor electrical conduit',(side*1.424,-19.95,2.66),(side*1.424,-7.17,2.66),.012,STEEL,8)
    for yy in [-18.1,-14.2,-10.2]:box('Corridor conduit box',(side*1.413,yy,2.66),(.08,.16,.19),STEEL,.005)

def reaching_hand(side,yy,zz,index):
    """Asymmetric tapered forearm, metacarpals and flexed phalanges in penumbra.
    No palm/finger reaches inside the clear |x|<0.55 metre camera lane.
    """
    rng=random.Random(710+index);bend=rng.uniform(-.09,.09)
    def p(x,y,z):return(side*x,yy+y,zz+z)
    tapered_tube('Shadow forearm', [p(1.59,0,0),p(1.43,.015,.014),p(1.22,.045,bend),p(1.06,.025,bend-.013),p(.94,.012,bend-.008)], [.080,.074,.064,.045,.036],ORGANIC,12,.76)
    tapered_tube('Shadow hand palm',[p(.97,.012,bend),p(.90,.01,bend),p(.81,0,bend+.007),p(.76,0,bend+.002)],[.037,.055,.070,.061],ORGANIC,12,.49)
    for finger,(offset,length) in enumerate([(-.060,.14),(-.020,.195),(.023,.185),(.061,.132)]):
        base=.775+abs(offset)*.13;tip=max(.565,base-length)
        droop=rng.uniform(.018,.063)
        pts=[p(base,offset,bend+.005),p(base-.055,offset*1.12,bend+.016),p(tip+.042,offset*1.30,bend-droop*.25),p(tip,offset*1.42,bend-droop),p(tip+.006,offset*1.45,bend-droop-.012)]
        radius=[.017 if finger<3 else .014,.015 if finger<3 else .012,.012,.008,.003]
        tapered_tube('Shadow articulated finger',pts,radius,ORGANIC,8,.78)
        # A tiny ridge defines a knuckle without polished nail highlights.
        for crease in [-.005,.004]:
            rod('Finger joint crease',p(base-.057,offset*.99,bend+.023+crease),p(base-.059,offset*1.23,bend+.023+crease),.0014,WOOD,4)
    tapered_tube('Shadow opposing thumb',[p(.91,-.045,bend-.005),p(.86,-.085,bend-.015),p(.79,-.13,bend-.039),p(.73,-.145,bend-.075),p(.725,-.146,bend-.088)],[.025,.023,.018,.011,.003],ORGANIC,9,.78)

for index,(side,yy,zz) in enumerate([(-1,-8.0,2.19),(1,-8.7,1.46),(-1,-10.6,1.32),(1,-11.3,2.38),(-1,-13.8,2.09),(1,-15.3,1.15),(-1,-17.0,1.49),(1,-18.7,2.29)]):
    reaching_hand(side,yy,zz,index)
print('WARD_AUTHOR hands complete',flush=True)

# Uneven ceiling channels and a loose lead make the passage feel maintained once,
# then abandoned. The hanging lead is retained as one independently movable mesh.
for yy in [-8.4,-12.5,-16.7,-19.8]:
    box('Corridor ceiling service seam',(0,yy,3.368),(3.1,.022,.018),STEEL,.001)
for index,zz in enumerate([10.0,14.0,18.0]):
    yy=-zz
    box('Corridor fluorescent mounting',(0,yy,3.28),(1.04,.24,.12),STEEL,.006)
    fixture=box('RoomFluorescent_corridor_'+str(index),(0,yy,3.205),(.91,.14,.026),FLUORESCENT,.004)
    fixture['dynamic_kind']='fluorescent';fixture['three_position']=[0,3.205,zz]
    for xx in [-.49,.49]:box('Corridor lamp bracket',(xx,yy,3.23),(.035,.25,.065),STEEL,.003)
    for xx in [-.35,-.12,.12,.35]:rod('Corridor fluorescent guard',(xx,yy-.11,3.185),(xx,yy+.11,3.185),.004,STEEL,6)
cable_origin=(-.92,-12.0,3.32)
cable_pts=[(-.92,-12,3.32),(-.92,-12.01,3.16),(-.95,-12.03,2.96),(-.96,-12.05,2.72),(-.91,-12.08,2.51),(-.87,-12.12,2.35)]
cable=tapered_tube('RoomHangingCable_0',cable_pts,[.008]*6,WOOD,8,1,cable_origin)
cable['dynamic_kind']='cable';cable['three_position']=[-.92,3.32,12]

# Fixtures and a restrained red warning light.
for xx in [-.55,.55]:
    rod('Ceiling chain',(xx,.9,3.44),(xx,.9,2.97),.008)
box('Ceiling fluorescent housing',(0,.9,2.96),(1.6,.22,.10),STEEL,.006)
fixture=box('RoomFluorescent_ward',(0,.9,2.90),(1.4,.14,.025),FLUORESCENT,.004)
fixture['dynamic_kind']='fluorescent';fixture['three_position']=[0,2.90,-.9]
box('Alarm mounting plate',(0,6.82,2.92),(.28,.055,.43),STEEL,.025)
box('Caged red alarm',(0,6.75,2.92),(.16,.12,.29),RED,.07)
for x in [-.1,0,.1]:rod('Alarm cage',(x,6.67,2.76),(x,6.67,3.08),.008)
# Architectural junctions catch small highlights and make the plaster/tile dado
# meet like built surfaces, rather than adjacent coloured rectangles.
for side in [-1,1]:
    box('Tile dado cap',(side*4.352,0,1.313),(.055,14.05,.045),ENAMEL,.007)
    box('Dark skirting',(side*4.346,0,.060),(.044,14.02,.115),STEEL,.008)
    for yy in [-5.8,5.4]:
        box('Wall junction box',(side*4.31,yy,2.82),(.09,.24,.26),STEEL,.015)
        rod('Surface wiring conduit',(side*4.30,yy,.12),(side*4.30,yy,3.19),.013,STEEL,8)
for a,b in [((-3.98,-6.4,3.38),(-1.8,-3.7,3.38)),((-1.8,-3.7,3.38),(1.4,1.1,3.38)),((1.4,1.1,3.38),(3.8,5.4,3.38))]:
    rod('Loose overhead wiring',a,b,.012,WOOD,8)

def light(name,kind,location,energy,color,target=None,size=1):
    data=bpy.data.lights.new(name,kind);data.energy=energy;data.color=color
    o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=location
    if kind=='AREA':data.shape='DISK';data.size=size
    if target:o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
    return o
light('Cold window key','AREA',(-4.1,-.6,2.55),650,(.56,.72,1),(.9,.4,.6),4)
light('Ceiling bounce','AREA',(.5,1,3.25),180,(.7,.79,.72),(0,1,.2),2.3)
light('Alarm spill','POINT',(0,6.4,2.9),55,(1,.055,.07))
for name,location,target in [('Gallery phosphor',(-2.45,-2.08,1.6),(-1.8,-3.9,1.3)),('Game phosphor',(2.45,1.22,1.55),(1.6,-.5,1.15)),('Quest wall phosphor',(0,5.66,1.7),(0,3.5,1.2))]:
    light(name,'AREA',location,14,(.53,.67,.66),target,1.1)
for yy,energy in [(-10,42),(-14,32),(-18,38)]:
    light('Corridor failing fluorescent '+str(yy),'AREA',(0,yy,3.15),energy,(.63,.73,.67),(0,yy,.15),.85)
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.10,.15,.20,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.18

camera_data=bpy.data.cameras.new('Investigation camera');camera=bpy.data.objects.new('Investigation camera',camera_data);scene.collection.objects.link(camera)
camera.location=(.1,-6.45,1.82);target=Vector((0,2.0,1.45));camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();camera_data.lens=20;scene.camera=camera
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.resolution_x=1280;scene.render.resolution_y=720;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(SOURCE/'ward-preview.png')

# Keep individual objects, lights and packed material images in the editable source.
export_tools=runpy.run_path(str(Path(__file__).with_name('export_horror_ward.py')))
export_tools['refine_corridor_details'](scene)
for image in bpy.data.images:
    if image.source=='FILE':image.pack()
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'last-round-ward.blend'))
print('WARD_AUTHOR source saved',flush=True)
(SOURCE/'screen-layout.json').write_text(__import__('json').dumps(SCREEN_LAYOUT,indent=2),encoding='utf-8')

# Merge only the web copy. The saved .blend above keeps individual objects.
runpy.run_path(str(Path(__file__).with_name('refit_horror_ward.py')))
export_tools['render_previews'](ROOT,scene)
print('WARD_FINISHED',flush=True)
