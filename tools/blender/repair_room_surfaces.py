"""Repair intersections in the existing ward; keep its composition and materials."""
import bpy, math, runpy
from pathlib import Path
from mathutils import Vector
scene=bpy.context.scene
ROOT=Path(__file__).resolve().parents[2]
PAINT=bpy.data.materials['Damp_flaking_paint'];TILE=bpy.data.materials['Cracked_wall_tiles'];STEEL=bpy.data.materials['Oxidised_steel'];DARK=bpy.data.materials['Dark_bakelite'];WOOD=bpy.data.materials['Dry_tripod_wood'];COTTON=bpy.data.materials['Old_cotton']
for obj in list(scene.objects):
    if obj.name.startswith(('RoomRepair_','RoomExterior_','RoomReception_','Corridor dado lip')):
        bpy.data.objects.remove(obj,do_unlink=True)
def box(name,loc,size,mat):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);obj=bpy.context.object;obj.name=name;obj.scale=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);obj.data.materials.append(mat);return obj
def rod(name,a,b,radius,mat):
    v=Vector(b)-Vector(a);bpy.ops.mesh.primitive_cylinder_add(vertices=8,radius=radius,depth=v.length,location=(Vector(a)+Vector(b))/2);obj=bpy.context.object;obj.name=name;obj.rotation_euler=v.to_track_quat('Z','Y').to_euler();obj.data.materials.append(mat);return obj
def set_bounds(obj,low,high):
    obj.location.z=(low+high)/2;obj.dimensions.z=high-low
# Plaster begins exactly where tiles end. Coplanar overlapping boxes caused
# the staircase/z-fighting band behind the projector.
for obj in list(scene.objects):
    if obj.name.startswith(('Cinema_shared upper wall','Cinema_left wall','Cinema_end wall','RoomAnnex_side plaster','RoomAnnex_back plaster')):
        set_bounds(obj,1.3,3.38)
    if obj.name.startswith('Cinema_left dado'):obj.location.x=-7.13
    if obj.name.startswith('Cinema_shared tiled wall'):obj.location.x=-1.7
# The window stop has been retired. Close the complete side wall and remove its frames.
for obj in list(scene.objects):
    if obj.name.startswith(('Upper side plaster','Window recess','Frosted window','Window mullion','Window crossbar')) and obj.location.x<0:
        bpy.data.objects.remove(obj,do_unlink=True)
box('RoomRepair_closed side wall',(-4.5,0,2.34),(.2,14.2,2.08),PAINT)
# Footer: a reception desk with a framed paper register, not writing on plaster.
box('RoomReception_desk body',(0,10.65,.46),(3.12,.78,.90),WOOD)
box('RoomReception_desk top',(0,10.58,.945),(3.24,.92,.075),STEEL)
for x in [-1.30,1.30]:box('RoomReception_pedestal',(x,10.63,.49),(.34,.62,.82),DARK)
for z in [.29,.54,.79]:
    box('RoomReception_drawer',(-.87,10.245,z),(.30,.025,.20),WOOD)
    rod('RoomReception_drawer pull',(-.96,10.215,z),(-.78,10.215,z),.009,STEEL)
box('RoomReception_register backing',(0,10.78,1.70),(1.89,.055,1.39),WOOD)
for x in [-.94,.94]:box('RoomReception_frame upright',(x,10.735,1.70),(.055,.045,1.41),STEEL)
for z in [1.01,2.39]:box('RoomReception_frame rail',(0,10.735,z),(1.92,.045,.05),STEEL)
for x in [-.70,.70]:rod('RoomReception_register stay',(x,10.85,.97),(x,10.80,1.25),.018,STEEL)
box('RoomReception_paper backing',(0,10.744,1.70),(1.78,.008,1.28),COTTON)
# A desk lamp and stacked files make this read as the old staff station.
rod('RoomReception_lamp stem',(.86,10.39,.99),(.86,10.40,1.34),.016,STEEL)
box('RoomReception_lamp shade',(.86,10.40,1.36),(.30,.18,.07),STEEL)
for i in range(4):box('RoomReception_closed files',(-.42,10.35,1.0+i*.025),(.54,.27,.022),COTTON)
for obj in scene.objects:
    if obj.name.startswith(('RoomReception_register','RoomReception_frame','RoomReception_paper backing')):
        obj.location.x-=.55;obj.location.y+=.23
runpy.run_path(str(Path(__file__).with_name('dress_hospital.py')))
if __name__=='__main__':
    bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets-source/horror-ward/last-round-ward.blend'))
    runpy.run_path(str(Path(__file__).with_name('export_horror_ward.py')))['export_ward'](ROOT,scene)
    print('ROOM_SURFACES_REPAIRED',flush=True)
