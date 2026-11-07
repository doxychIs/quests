"""Keep four quest CRTs, open the rear door and extend the same editable ward.
Run against last-round-ward.blend; export uses the existing material batching.
"""
import bpy, math, runpy
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
scene=bpy.context.scene
heights={i:1.82-bpy.data.objects["RoomScreen_quest_"+str(i)].get("three_position",[0,1.28])[1] for i in range(4)}
shifts={i:x-bpy.data.objects["RoomScreen_quest_"+str(i)].get("three_position",[[-2.15,-.72,.72,2.15][i]])[0] for i,x in enumerate([-2.7,-1.4,1.4,2.7])}
for obj in list(scene.objects):
    if obj.name.startswith(('gallery ','game ','info ','ambient_','RoomScreen_gallery','RoomScreen_game','RoomScreen_info','RoomScreen_ambient','Ward CRT','Ward_CRT','Broadcast rack','RoomAnnex_','Gallery phosphor','Game phosphor')):
        bpy.data.objects.remove(obj,do_unlink=True)
        continue
    if obj.name.startswith(('Locked steel door','Observation glass','Window frame','Door handle','Ward number')) and obj.location.y>6.5:
        bpy.data.objects.remove(obj,do_unlink=True)
        continue
    for i,x in enumerate([-2.7,-1.4,1.4,2.7]):
        if obj.name.startswith(('quest_'+str(i)+' ','RoomScreen_quest_'+str(i))):
            if 'power lead' in obj.name:
                bpy.data.objects.remove(obj,do_unlink=True);break
            obj.location.x+=shifts[i];obj.location.z+=heights[i]
            if obj.name.startswith('RoomScreen_'):obj['three_position']=[x,1.82,-5.75]
PAINT=bpy.data.materials['Damp_flaking_paint'];TILE=bpy.data.materials['Cracked_wall_tiles'];FLOOR=bpy.data.materials['Dirty_floor_tiles'];STEEL=bpy.data.materials['Oxidised_steel']
def box(name,loc,size,mat):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name='RoomAnnex_'+name;o.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat)
    # Metre-scale UVs preserve the existing material scale.
    if o.data.uv_layers:
        for uv in o.data.uv_layers.active.data:uv.uv*=2
    return o
for side in [-1,1]:
    box('side plaster',(side*1.7,9.4,2.2),(.2,4.8,2.4),PAINT)
    box('side tiles',(side*1.68,9.4,.65),(.2,4.8,1.3),TILE)
box('floor',(0,9.4,-.08),(3.6,4.9,.16),FLOOR)
box('ceiling',(0,9.4,3.38),(3.6,4.9,.16),PAINT)
box('back plaster',(0,11.8,2.2),(3.6,.2,2.4),PAINT)
box('back tiles',(0,11.78,.65),(3.6,.22,1.3),TILE)
box('open rear door',(1.14,7.74,1.25),(.12,1.45,2.5),STEEL)
box('rear door handle',(1.057,7.31,1.08),(.035,.13,.19),STEEL)
for side in [-1,1]:
    cx=side*2.17
    box('quest bench',(cx,6.1,1.245),(2.65,.76,.055),STEEL)
    for dx in [-1.2,1.2]:
        for yy in [5.84,6.4]:box('bench leg',(cx+dx,yy,.63),(.045,.045,1.23),STEEL)
from mathutils import Vector
for x in [-2.7,-1.4,1.4,2.7]:
    points=[(x+.06,6.23,1.64),(x+.16,6.40,1.2),(x+.22,6.45,.025),(x+.5,6.6,.025)]
    for a,b in zip(points,points[1:]):
        delta=Vector(b)-Vector(a);bpy.ops.mesh.primitive_cylinder_add(vertices=6,radius=.008,depth=delta.length,location=(Vector(a)+Vector(b))/2)
        obj=bpy.context.object;obj.name='RoomAnnex_quest power lead';obj.rotation_euler=delta.to_track_quat('Z','Y').to_euler();obj.data.materials.append(bpy.data.materials['Dark_bakelite'])
runpy.run_path(str(Path(__file__).with_name('add_cinema_and_laptop.py')))
# Packed source is saved before the web-only join, keeping every prop editable.
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets-source/horror-ward/last-round-ward.blend'))
stats=runpy.run_path(str(Path(__file__).with_name('export_horror_ward.py')))['export_ward'](ROOT,scene)
import json
(ROOT/'assets-source/horror-ward/screen-layout.json').write_text(json.dumps(stats['screen_nodes'],indent=2),encoding='utf-8')
print('WARD_REFIT_COMPLETE',flush=True)
