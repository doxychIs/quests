"""Extend the existing editable ward with a bedside laptop and a real film room.
Idempotent; run before export_ward, or directly against the saved .blend.
Blender is Z-up: Three (x,y,z) = (Blender.x, Blender.z, -Blender.y).
"""
import bpy, math, runpy, json
from pathlib import Path
from mathutils import Vector, Matrix
ROOT=Path(__file__).resolve().parents[2]
scene=bpy.context.scene
for obj in list(scene.objects):
    if obj.name.startswith(('Cinema_','Laptop_','RoomFilmProjector','RoomFilmReel_','RoomScreen_game')):
        bpy.data.objects.remove(obj,do_unlink=True)
    elif obj.name.startswith(('RoomAnnex_side plaster','RoomAnnex_side tiles')) and obj.location.x<0:
        bpy.data.objects.remove(obj,do_unlink=True)
PAINT=bpy.data.materials['Damp_flaking_paint'];TILE=bpy.data.materials['Cracked_wall_tiles'];FLOOR=bpy.data.materials['Dirty_floor_tiles'];STEEL=bpy.data.materials['Oxidised_steel'];ENAMEL=bpy.data.materials['Chipped_enamel'];DARK=bpy.data.materials['Dark_bakelite'];COTTON=bpy.data.materials['Old_cotton']
def material(name,color,rough=.85,metal=.1):
    m=bpy.data.materials.get(name) or bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
    return m
OLIVE=material('Old_projector_enamel',(.105,.135,.12),.83,.32)
REEL=material('Scratched_reel_aluminium',(.28,.31,.29),.71,.65)
WOOD=material('Dry_tripod_wood',(.14,.115,.085),.96,0)
SCREEN=material('Laptop_phosphor',(.025,.045,.042),.50,.03)
objects=[]
def box(name,loc,size,mat,bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.scale=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat)
    if bevel:
        mod=o.modifiers.new('Worn edge','BEVEL');mod.width=bevel;mod.segments=1;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
    objects.append(o);return o
def rod(name,a,b,radius,mat,verts=10):
    direction=Vector(b)-Vector(a);bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=radius,depth=direction.length,location=(Vector(a)+Vector(b))/2);o=bpy.context.object;o.name=name;o.rotation_euler=direction.to_track_quat('Z','Y').to_euler();o.data.materials.append(mat);objects.append(o);return o
def join(items,name,pivot=None):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in items:obj.select_set(True)
    bpy.context.view_layer.objects.active=items[0];bpy.ops.object.join();obj=bpy.context.object;obj.name=name
    if pivot:
        scene.cursor.location=pivot;bpy.ops.object.origin_set(type='ORIGIN_CURSOR');scene.cursor.location=(0,0,0)
    return obj
# A real side opening connects the old footer annex to the film room.
for start,end in [(7.0,8.5),(10.2,11.8)]:
    yy=(start+end)/2;length=end-start
    box('Cinema_shared upper wall',(-1.7,yy,2.2),(.2,length,2.4),PAINT)
    box('Cinema_shared tiled wall',(-1.68,yy,.65),(.2,length,1.3),TILE)
box('Cinema_door lintel',(-1.7,9.35,3.05),(.2,1.7,.66),PAINT)
for yy in [8.49,10.21]:box('Cinema_door jamb',(-1.59,yy,1.3),(.13,.075,2.6),STEEL)
box('Cinema_open door',(-1.94,11.02,1.25),(.11,1.5,2.5),ENAMEL,.008)
box('Cinema_floor',(-4.4,9.5,-.08),(5.6,5.0,.16),FLOOR)
box('Cinema_ceiling',(-4.4,9.5,3.38),(5.6,5.0,.16),PAINT)
box('Cinema_left wall',(-7.13,9.5,2.2),(.2,5.0,2.4),PAINT)
box('Cinema_left dado',(-7.10,9.5,.65),(.2,5.0,1.3),TILE)
for yy in [7.1,12.0]:
    box('Cinema_end wall',(-4.4,yy,2.2),(5.6,.2,2.4),PAINT)
    box('Cinema_end dado',(-4.4,yy,.65),(5.6,.2,1.3),TILE)
# Rolled cloth, a slightly sagged bottom bar and real steel mounts.
for yy in [8.15,10.85]:rod('Cinema_screen vertical',(-6.92,yy,.86),(-6.92,yy,2.94),.025,STEEL)
for zz in [.92,2.90]:rod('Cinema_screen roller',(-6.92,8.14,zz),(-6.92,10.86,zz),.035,STEEL)
box('Cinema_cloth backing',(-6.96,9.5,1.91),(.028,2.56,1.84),COTTON)
for xx in [-6.8,-5.1,-3.4]:rod('Cinema_aged conduit',(xx,11.86,.2),(xx,11.86,3.12),.012,STEEL,8)
box('Cinema_reel crate',(-6.3,7.65,.28),(.85,.65,.55),WOOD,.01)
for i in range(3):rod('Cinema_spare film can',(-6.3,7.64,.57+i*.055),(-6.3,7.64,.61+i*.055),.25,REEL,32)
# The film projector: metal chassis, lens barrel, switches and a wooden tripod.
projector=[];start=len(objects)
px,py=-3.8,10.65
box('Cinema_projector body',(px,py,1.40),(.67,.37,.48),OLIVE,.018)
box('Cinema_projector film gate',(px-.31,py-.205,1.44),(.19,.045,.32),STEEL,.008)
for i in range(7):box('Cinema_projector cooling slot',(px+.08+i*.038,py-.193,1.35),(.014,.008,.16),DARK)
for radius,a,b in [(.105,-.52,-.31),(.086,-.58,-.50),(.061,-.595,-.578)]:rod('Cinema_lens barrel',(px+a,py,1.46),(px+b,py,1.46),radius,STEEL,24)
rod('Cinema_lens glass',(px-.601,py,1.46),(px-.596,py,1.46),.055,SCREEN,24)
box('Cinema_power plate',(px+.18,py-.2,1.57),(.15,.012,.085),DARK)
rod('Cinema_power toggle',(px+.17,py-.21,1.57),(px+.17,py-.25,1.60),.015,REEL)
rod('Cinema_tripod head',(px,py,1.0),(px,py,1.17),.12,STEEL,16)
for angle in [.2,2.3,4.4]:
    foot=(px+.44*math.cos(angle),py+.44*math.sin(angle),.04);top=(px+.09*math.cos(angle),py+.09*math.sin(angle),1.07)
    delta=Vector(top)-Vector(foot);leg=box('Cinema_wooden tripod leg',(Vector(top)+Vector(foot))/2,(.065,.046,delta.length),WOOD,.002);leg.rotation_euler=delta.to_track_quat('Z','Y').to_euler()
    rod('Cinema_tripod shoe',foot,(foot[0]*.18+top[0]*.82,foot[1]*.18+top[1]*.82,.22),.027,DARK,8)
    rod('Cinema_tripod spreader',(px,py,.61),(foot[0]*.6+top[0]*.4,foot[1]*.6+top[1]*.4,.47),.013,STEEL,8)
for a,b in [((px-.24,py-.218,1.65),(px-.36,py-.218,1.77)),((px-.36,py-.218,1.77),(px-.03,py-.218,1.98)),((px+.17,py-.218,1.64),(px+.33,py-.218,1.79))]:rod('Cinema_exposed film',a,b,.006,DARK,4)
projector=objects[start:];body=join(projector,'RoomFilmProjector',(px,py,1.4));body['dynamic_kind']='film-projector'
body['three_position']=[px,1.4,-py]
# Perforated metal reels are real holes, not black circles painted on a disc.
reels=[]
for index,(cx,cz,radius) in enumerate([(px-.24,1.98,.285),(px+.28,1.82,.24)]):
    cy=py-.03
    plate=rod('Cinema_reel plate',(cx,cy-.018,cz),(cx,cy+.008,cz),radius,REEL,48)
    for hole in range(5):
        angle=hole*math.tau/5;hx=cx+math.cos(angle)*radius*.58;hz=cz+math.sin(angle)*radius*.58
        cutter=rod('Cinema_reel cut',(hx,cy-.08,hz),(hx,cy+.08,hz),radius*.23,DARK,16)
        mod=plate.modifiers.new('Open reel perforation','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter;bpy.context.view_layer.objects.active=plate;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
    hub=rod('Cinema_reel hub',(cx,cy-.04,cz),(cx,cy+.04,cz),radius*.12,STEEL,16)
    reel=join([plate,hub],'RoomFilmReel_'+str(index),(cx,cy,cz));reel['dynamic_kind']='film-reel'
    # Bake the cylinder's construction rotation so the runtime spin remains local Z
    # after the Blender-to-glTF axis conversion, even when the machine is aimed.
    bpy.context.view_layer.objects.active=reel
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    reels.append(reel)
# Aim the complete machine at the projection cloth. Keep each reel's own pivot.
projector_pivot=Vector((px,py,1.4))
projector_yaw=math.atan2(py-9.5,px-(-6.9))
aim=Matrix.Translation(projector_pivot) @ Matrix.Rotation(projector_yaw,4,'Z') @ Matrix.Translation(-projector_pivot)
for part in [body,*reels]:
    part.matrix_world=aim @ part.matrix_world
    location=part.location
    part['three_position']=[location.x,location.z,-location.y]
# Nightstand in the left foreground, with a heavy, older laptop.
x,y=-3.22,-3.45
box('Laptop_nightstand body',(x,y,.45),(1.16,.78,.82),ENAMEL,.012)
box('Laptop_nightstand top',(x,y,.875),(1.21,.83,.065),STEEL,.01)
for zz in [.33,.67]:
    box('Laptop_drawer front',(x,y-.402,zz),(1.05,.032,.27),ENAMEL,.004)
    rod('Laptop_drawer handle',(x-.13,y-.44,zz),(x+.13,y-.44,zz),.014,STEEL)
for dx in [-.48,.48]:
    for dy in [-.30,.30]:box('Laptop_table foot',(x+dx,y+dy,.045),(.065,.065,.09),DARK)
box('Laptop_base',(x,y-.18,.94),(1.08,.64,.073),DARK,.014)
box('Laptop_palm rest',(x,y-.30,.981),(1.00,.33,.012),OLIVE,.005)
box('Laptop_touchpad',(x,y-.37,.990),(.27,.17,.006),STEEL,.003)
for row in range(5):
    for key in range(13):box('Laptop_key',(x-.435+key*.070,y+.045-row*.052,.989),(.056,.039,.012),STEEL,.002)
box('Laptop_screen shell',(x,y+.04,1.29),(1.08,.075,.81),DARK,.012)
for side in [-1,1]:rod('Laptop_screen hinge',(x+side*.40-.04,y,.966),(x+side*.40+.04,y,.966),.037,STEEL,12)
box('Laptop_status led',(x+.45,y-.488,.960),(.012,.007,.007),SCREEN)
verts=[(-.48,0,-.345),(.48,0,-.345),(.48,0,.345),(-.48,0,.345)]
data=bpy.data.meshes.new('Laptop glass');data.from_pydata(verts,[],[(0,1,2,3)]);data.update();data.materials.append(SCREEN)
screen=bpy.data.objects.new('RoomScreen_game',data);scene.collection.objects.link(screen);screen.location=(x,y,1.29)
uv=data.uv_layers.new();coords=[(0,0),(1,0),(1,1),(0,1)]
for loop in data.loops:uv.data[loop.index].uv=coords[loop.vertex_index]
screen['screen_id']='game';screen['three_position']=[x,1.29,-y];screen['width']=.96;screen['height']=.69;screen['front_axis']='+Z';screen['surface_kind']='laptop'
runpy.run_path(str(Path(__file__).with_name('repair_room_surfaces.py')))
if __name__=='__main__':
    bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets-source/horror-ward/last-round-ward.blend'))
    stats=runpy.run_path(str(Path(__file__).with_name('export_horror_ward.py')))['export_ward'](ROOT,scene)
    (ROOT/'assets-source/horror-ward/screen-layout.json').write_text(json.dumps(stats['screen_nodes'],indent=2),encoding='utf-8')
    print('CINEMA_AND_LAPTOP_READY',flush=True)
