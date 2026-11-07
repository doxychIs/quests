"""Export an edited .blend without overwriting its individually editable objects.
blender --background assets-source/horror-ward/last-round-ward.blend --python tools/blender/export_horror_ward.py
"""
import bpy, json, math, random, sys
from pathlib import Path
from mathutils import Vector


def refine_corridor_details(scene):
    """Restrained, metre-scale surface details; safe to rerun on the source file.
    The foreground should read as aged architecture rather than graphic decals.
    """
    prefixes=('Corridor door notice','Lifted corridor paint','Corridor smeared palm','Corridor finger residue','Corridor aged plaque','Corridor engraved number','Corridor label strokes','Corridor fine lime flake','Corridor dark residue')
    for obj in list(scene.objects):
        if obj.name.startswith(prefixes):bpy.data.objects.remove(obj,do_unlink=True)
    def material(name,color,rough=.95,metal=0):
        mat=bpy.data.materials.get(name) or bpy.data.materials.new(name);mat.use_nodes=True
        p=mat.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
        return mat
    plate=material('Corroded_corridor_labels',(.085,.10,.092),.86,.22)
    engraving=material('Faded_corridor_engraving',(.27,.29,.25),.98)
    lime=material('Corridor_exposed_lime',(.245,.26,.235),.97)
    residue=material('Corridor_oxidised_residue',(.049,.035,.033),.99)
    def mesh(name,verts,faces,mat):
        data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
        obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);data.materials.append(mat)
        return obj
    for side in [-1,1]:
        for index,yy in enumerate([-9.1,-13.2,-17.4]):
            xx=side*1.407;zz=1.75;w,h=.10,.0675
            # A 20cm metal plaque, held by four small dark screw indentations.
            mesh('Corridor aged plaque',[(xx,yy-w,zz-h),(xx,yy+w,zz-h),(xx,yy+w,zz+h),(xx,yy-w,zz+h)],[(0,1,2,3)],plate)
            curve=bpy.data.curves.new('Corridor engraved number','FONT');curve.body=str(6+index).zfill(2);curve.size=.047;curve.extrude=.0001;curve.align_x='CENTER'
            obj=bpy.data.objects.new('Corridor engraved number',curve);scene.collection.objects.link(obj);obj.location=(xx-side*.001,yy,zz+.005);obj.rotation_euler=(math.pi/2,0,-side*math.pi/2);curve.materials.append(engraving)
            bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj;bpy.ops.object.convert(target='MESH');obj.select_set(False)
            rng=random.Random(271+index+side)
            for row in range(3):
                for stroke in range(8):
                    if rng.random()<.22:continue
                    cy=yy-.060+stroke*.015;cz=zz-.025-row*.010;length=rng.uniform(.004,.011)
                    mesh('Corridor label strokes',[(xx-side*.0013,cy,cz),(xx-side*.0013,cy+length,cz),(xx-side*.0013,cy+length,cz+.0017),(xx-side*.0013,cy,cz+.0017)],[(0,1,2,3)],engraving)
        rng=random.Random(1323+side)
        for chip in range(12):
            yy=rng.uniform(-19.7,-7.4);zz=rng.uniform(1.45,3.25)
            if any(abs(yy-door)<.58 and zz<2.45 for door in [-9.1,-13.2,-17.4]):continue
            count=rng.randint(8,11);radius=rng.uniform(.015,.042);surface=side*1.489
            verts=[(surface,yy,zz)];curl=rng.randrange(count)
            for i in range(count):
                angle=i/count*math.tau;r=radius*rng.uniform(.70,1.15)
                verts.append((surface-side*(.0035 if i==curl else .0003),yy+math.cos(angle)*r,zz+math.sin(angle)*r*.72))
            mesh('Corridor fine lime flake',verts,[(0,i+1,(i+1)%count+1) for i in range(count)],lime)
        for index,yy in enumerate([-8.64,-12.16,-16.63]):
            zz=[1.60,1.85,1.42][index]+side*.09;height=[.24,.34,.17][index]
            width=.006+index*.002;xx=side*1.487
            # Irregular, nearly black dried drag marks, never dotted hand icons.
            points=[(xx,yy-width*.6,zz+.015),(xx,yy+width*.8,zz),(xx,yy+width*.45,zz-height*.28),(xx,yy+width*.9,zz-height*.56),(xx,yy-width*.1,zz-height),(xx,yy-width*.35,zz-height*.72),(xx,yy-width*.8,zz-height*.36)]
            mesh('Corridor dark residue',points,[tuple(range(len(points)))],residue)
    print('WARD_REFINED restrained corridor details',flush=True)


def render_previews(root,scene):
    camera=scene.camera;data=camera.data
    camera.location=(.1,-6.45,1.82);target=Vector((0,2.0,1.45));camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();data.sensor_fit='AUTO';data.lens=20
    scene.render.filepath=str(root/'assets-source'/'horror-ward'/'ward-preview.png');bpy.ops.render.render(write_still=True)
    camera.location=(.06,-19.3,1.66);target=Vector((-.02,-11.1,1.58));camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
    data.sensor_fit='VERTICAL';data.sensor_height=24;data.lens=24/(2*math.tan(math.radians(61)/2))
    scene.render.filepath=str(root/'assets-source'/'horror-ward'/'corridor-preview.png');bpy.ops.render.render(write_still=True)


def export_ward(root, scene):
    models=root/'public'/'models';models.mkdir(parents=True,exist_ok=True)
    groups={}
    for obj in list(scene.objects):
        if obj.type=='MESH' and obj.data.materials and not obj.name.startswith(('RoomScreen_','RoomCurtain_','RoomHangingCable_','RoomFluorescent_','RoomFilmProjector','RoomFilmReel_','RoomDutyOfficer','RoomGhost_')):
            groups.setdefault(obj.data.materials[0].name,[]).append(obj)
    for name,objects in groups.items():
        if len(objects)<2:continue
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects:obj.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        bpy.ops.object.join();bpy.context.object.name='Ward_'+name
    bpy.ops.export_scene.gltf(filepath=str(models/'last-round-ward-v1.glb'),export_format='GLB',export_cameras=False,export_lights=False,export_extras=True,export_vertex_color='ACTIVE',export_all_vertex_colors=False,export_image_format='JPEG',export_jpeg_quality=88)
    stats={'objects':sum(o.type=='MESH' for o in scene.objects),'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in scene.objects if o.type=='MESH'),'bytes':(models/'last-round-ward-v1.glb').stat().st_size,'source':'assets-source/horror-ward/last-round-ward.blend','model':'public/models/last-round-ward-v1.glb','screen_nodes':[{'name':o.name,'center':list(o.get('three_position',[])),'width':o.get('width'),'height':o.get('height')} for o in scene.objects if o.name.startswith('RoomScreen_')],'dynamic_nodes':[{'name':o.name,'kind':o.get('dynamic_kind'),'center':list(o.get('three_position',[])),'material':o.data.materials[0].name} for o in scene.objects if o.get('dynamic_kind')],'corridor':{'bounds_three':{'x':[-1.5,1.5],'y':[0,3.38],'z':[7,20.1]},'ward_opening':{'center':[0,1.3,7],'width':1.6,'height':2.6},'clear_camera_lane_x':[-.55,.55]}}
    (root/'assets-source'/'horror-ward'/'manifest.json').write_text(json.dumps(stats,indent=2),encoding='utf-8')
    print('WARD_EXPORT',stats,flush=True)
    return stats


if __name__=='__main__':
    root=Path(__file__).resolve().parents[2];scene=bpy.context.scene
    if '--refine-corridor' in sys.argv:
        refine_corridor_details(scene);bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(root/'assets-source'/'horror-ward'/'last-round-ward.blend'))
    export_ward(root,scene)
    if '--render-previews' in sys.argv:render_previews(root,scene)
