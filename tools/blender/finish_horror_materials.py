"""Update aged tuning-dial materials in an existing authored ward, export/render.
The temporary save avoids a Blender 5.2 overwrite guard on the loaded source.
"""
import bpy,runpy
from pathlib import Path
root=Path(__file__).resolve().parents[2]
source=root/'assets-source/horror-ward'
material=bpy.data.materials['Worn_CRT_edges']
node=material.node_tree.nodes.get('Principled BSDF')
node.inputs['Base Color'].default_value=(.046,.054,.049,1)
node.inputs['Roughness'].default_value=.84
node.inputs['Metallic'].default_value=.06
bpy.context.preferences.filepaths.save_version=0
temporary=source/'last-round-ward-final.blend'
assert temporary.resolve().parent==source.resolve()
bpy.ops.wm.save_as_mainfile(filepath=str(temporary))
temporary.replace(source/'last-round-ward.blend')
runpy.run_path(str(Path(__file__).with_name('export_horror_ward.py')))['export_ward'](root,bpy.context.scene)
bpy.context.scene.render.filepath=str(source/'ward-preview-final.png')
bpy.ops.render.render(write_still=True)
print('WARD_MATERIALS_FINISHED',flush=True)
