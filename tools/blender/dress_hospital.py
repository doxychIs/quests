"""Authored hospital props and figures; safe to rerun on the editable source.

All dimensions are metres in Blender Z-up. No props obstruct the centre aisle.
"""
import bpy, math, random
from mathutils import Vector
scene=bpy.context.scene
for obj in list(scene.objects):
    if obj.name.startswith(('Hospital_','RoomDutyOfficer','RoomGhost_')):bpy.data.objects.remove(obj,do_unlink=True)
M=bpy.data.materials
STEEL=M['Oxidised_steel'];CLOTH=M['Old_cotton'];DARK=M['Dark_bakelite'];WOOD=M['Dry_tripod_wood'];PAINT=M['Chipped_enamel']
def material(name,color,rough=.9,metal=0):
    mat=M.get(name) or M.new(name);mat.use_nodes=True
    p=mat.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
    return mat
SKIN=material('Duty_officer_ashen_skin',(.13,.145,.115),.97)
AMBER=material('Hospital_old_amber_glass',(.17,.105,.035),.36,.12)
MIST=material('Hospital_apparition',(.28,.38,.35),1)
made=[]
def box(name,loc,size,mat):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name='Hospital_'+name;o.scale=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat);made.append(o);return o
def rod(name,a,b,radius,mat,verts=10):
    v=Vector(b)-Vector(a);bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=radius,depth=v.length,location=(Vector(a)+Vector(b))/2);o=bpy.context.object;o.name='Hospital_'+name;o.rotation_euler=v.to_track_quat('Z','Y').to_euler();o.data.materials.append(mat);made.append(o);return o
def oval(name,loc,size,mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,radius=1,location=loc);o=bpy.context.object;o.name='Hospital_'+name;o.scale=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat);made.append(o);return o
def join(parts,name,origin):
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:o.select_set(True)
    bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();o=bpy.context.object;o.name=name;scene.cursor.location=origin;bpy.ops.object.origin_set(type='ORIGIN_CURSOR');o.select_set(False);return o
def bottle(x,y,z,index=0):
    r=.031 if index%3 else .044;h=.115+(index%4)*.018
    rod('medicine bottle',(x,y,z),(x,y,z+h),r,AMBER,12)
    rod('medicine cap',(x,y,z+h),(x,y,z+h+.018),r*.82,DARK,10)
    box('medicine paper label',(x,y-r-.001,z+h*.51),(r*1.2,.002,h*.42),CLOTH)
def shelf(x,y,z,width=1.35):
    box('wall medicine shelf',(x,y,z),(.43,width,.052),STEEL)
    for dy in [-width*.38,width*.38]:
        rod('shelf bracket',(x-.18,y+dy,z-.26),(x+.16,y+dy,z-.028),.013,STEEL)
    for i in range(8):bottle(x+.025,y-width*.40+i*width*.107,z+.029,i)
    box('gauze packet',(x+.02,y+.38,z+.11),(.20,.19,.15),CLOTH)
# A pharmacy alcove replaces the whole former window frontage.
for z in [1.42,1.91,2.42]:shelf(-4.13,.25,z)
box('medicine cabinet back',(-4.31,3.38,1.78),(.12,1.35,1.22),PAINT)
for yy in [2.73,4.03]:box('cabinet side',(-4.10,yy,1.79),(.45,.045,1.26),STEEL)
for zz in [1.17,1.57,1.97,2.4]:box('cabinet shelf',(-4.10,3.38,zz),(.46,1.35,.035),STEEL)
for row in range(3):
    for i in range(6):bottle(-3.98,2.87+i*.19,1.20+row*.4,i+row)
# Instrument trolley; the polished edge is small, with a dark oxidised underside.
for zz in [.30,.86]:box('instrument trolley tray',(-3.17,-.8,zz),(.73,.48,.035),STEEL)
for dx in [-.31,.31]:
    for dy in [-.19,.19]:
        rod('trolley leg',(-3.17+dx,-.8+dy,.09),(-3.17+dx,-.8+dy,.9),.014,STEEL)
        oval('rubber caster',(-3.17+dx,-.8+dy,.075),(.045,.028,.05),DARK)
for i in range(3):
    x=-3.40+i*.16
    rod('scalpel handle',(x,-.91,.886),(x,-.76,.886),.008,STEEL,6)
    o=box('scalpel blade',(x,-.728,.886),(.014,.065,.003),STEEL);o.rotation_euler.z=.08*i
rod('surgical forceps',(-3.14,-.86,.887),(-3.09,-.65,.887),.004,STEEL,6)
rod('surgical forceps',(-3.11,-.86,.888),(-3.10,-.65,.888),.004,STEEL,6)
bottle(-2.97,-.88,.88,2)
for i in range(3):box('rolled dressing',(-3.36+i*.10,-.66,.90),(.08,.11,.04),CLOTH)
# An overturned operating table by the right wall, outside the camera route.
parts=[];start=len(made)
box('overturned operating top',(3.43,1.3,.86),(.69,1.88,.105),STEEL)
for yy in [.64,1.9]:box('operating pad',(3.43,yy,.93),(.60,.61,.065),DARK)
rod('table pedestal',(3.43,1.3,.22),(3.43,1.3,.8),.095,STEEL)
for xx in [3.13,3.73]:rod('table base',(3.43,1.3,.25),(xx,1.3,.06),.037,STEEL)
parts=made[start:];pivot=Vector((3.43,1.3,.5))
from mathutils import Matrix
tilt=Matrix.Translation(pivot)@Matrix.Rotation(math.radians(72),4,'Y')@Matrix.Translation(-pivot)
for o in parts:o.matrix_world=tilt@o.matrix_world
# Framed anatomical charts; runtime supplies aged, original line drawings.
for name,loc,size in [('anatomy',(-4.34,-2.0,2.12),(.035,1.15,1.35)),('ward', (4.34,1.0,2.13),(.035,.91,1.15)),('cinema',(-5.65,11.84,2.08),(1.0,.035,1.18))]:
    box('chart backing '+name,loc,size,WOOD)
# Archive shelves in the cinema, and loose clinical files throughout the ward.
for z in [.64,1.18,1.67]:
    box('cinema archive shelf',(-6.55,11.68,z),(.66,.41,.045),WOOD)
    for xx in [-6.78,-6.32]:rod('archive shelf bracket',(xx,11.89,z-.20),(xx,11.49,z-.025),.012,STEEL)
    for i in range(4):box('archive medical file',(-6.78+i*.15,11.68,z+.11),(.13,.30,.19),CLOTH)
for i in range(7):
    o=box('discarded patient file',(-2.35+i*.10,-2.7+(i%3)*.15,.017+i*.002),(.27,.19,.004),CLOTH);o.rotation_euler.z=i*.31
rod('dropped syringe',(-1.9,-1.52,.028),(-1.73,-1.43,.028),.009,CLOTH,8)
rod('syringe needle',(-1.73,-1.43,.028),(-1.66,-1.39,.028),.002,STEEL,6)
# A slumped attendant. The head, jaw, hands and weighted coat remain separate in source.
sx,sy=.95,11.24
box('officer chair seat',(sx,sy,.48),(.52,.49,.075),WOOD)
box('officer chair back',(sx,sy+.23,.89),(.52,.06,.75),WOOD)
for dx in [-.21,.21]:
    for dy in [-.18,.18]:rod('officer chair leg',(sx+dx,sy+dy,.02),(sx+dx,sy+dy,.46),.022,STEEL)
start=len(made)
oval('officer coat hips',(sx,sy,.67),(.26,.19,.21),CLOTH)
o=oval('officer hunched coat',(sx,sy-.045,1.03),(.27,.185,.37),CLOTH);o.rotation_euler.x=-.23
for side in [-1,1]:
    x=sx+side*.15
    rod('officer trouser thigh',(x,sy-.02,.65),(x,sy-.39,.51),.095,DARK)
    rod('officer trouser shin',(x,sy-.39,.51),(x,sy-.43,.12),.065,DARK)
    oval('officer old shoe',(x,sy-.51,.10),(.084,.16,.065),DARK)
    a=(sx+side*.24,sy-.05,1.19);b=(sx+side*.34,sy-.33,1.015);c=(sx+side*.23,10.53,1.005)
    rod('officer sleeve upper',a,b,.085,CLOTH);rod('officer sleeve cuff',b,c,.065,CLOTH)
    oval('officer limp hand',(c[0],c[1]-.045,c[2]-.005),(.058,.095,.025),SKIN)
    for f in range(4):rod('officer relaxed finger',(c[0]+(f-1.5)*.018,c[1]-.085,c[2]),(c[0]+(f-1.5)*.020,c[1]-.14,c[2]-.018),.009,SKIN,6)
rod('officer neck',(sx,sy-.07,1.23),(sx,sy-.13,1.35),.063,SKIN)
head_start=len(made)
o=oval('officer bowed head',(sx,sy-.17,1.44),(.105,.105,.145),SKIN);o.rotation_euler.x=math.radians(32)
oval('officer jaw',(sx,sy-.225,1.375),(.078,.075,.073),SKIN)
oval('officer hair',(sx,sy-.15,1.527),(.107,.101,.075),DARK)
oval('officer nose',(sx,sy-.275,1.414),(.021,.035,.035),SKIN)
for side in [-1,1]:oval('officer closed eye',(sx+side*.039,sy-.262,1.449),(.026,.008,.006),DARK)
head_pivot=Vector((sx,sy-.10,1.31))
head_slump=Matrix.Translation(head_pivot)@Matrix.Rotation(math.radians(38),4,'X')@Matrix.Rotation(math.radians(-12),4,'Y')@Matrix.Translation(-head_pivot)
for part in made[head_start:]:part.matrix_world=head_slump@part.matrix_world
o=join(made[start:],'RoomDutyOfficer',(sx,sy,0));o['role']='motionless-attendant'
# Human apparitions are volumes, not flat pictures; no glowing cartoon eyes.
for index,(x,y) in enumerate([(-2.20,1.95),(2.16,4.70)]):
    start=len(made)
    oval('ghost torso',(x,y,1.14),(.235,.13,.38),MIST)
    oval('ghost pelvis',(x,y,.78),(.20,.125,.22),MIST)
    oval('ghost head',(x,y-.02,1.65),(.105,.105,.14),MIST)
    rod('ghost neck',(x,y,1.45),(x,y,1.55),.06,MIST)
    for side in [-1,1]:
        rod('ghost upper arm',(x+side*.22,y,1.35),(x+side*.28,y-.01,1.0),.064,MIST)
        rod('ghost hanging forearm',(x+side*.28,y-.01,1.0),(x+side*.26,y-.04,.73),.046,MIST)
        oval('ghost hand',(x+side*.26,y-.04,.68),(.041,.03,.075),MIST)
        rod('ghost leg',(x+side*.105,y,.77),(x+side*.12,y,.13),.073,MIST)
        oval('ghost foot',(x+side*.12,y-.04,.08),(.07,.13,.05),MIST)
    o=join(made[start:],'RoomGhost_'+str(index),(x,y,0));o['role']='apparition'
print('HOSPITAL_DRESSING_READY',flush=True)
