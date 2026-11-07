import bpy,json
from pathlib import Path
items=[]
for o in bpy.context.scene.objects:
 if any(k.lower() in o.name.lower() for k in ['window','wall','shelf','picture','blood']):items.append({'name':o.name,'location':list(o.location),'size':list(o.dimensions),'material':[m.name for m in o.data.materials] if o.type=='MESH' else []})
Path('docs/room-source-inventory.json').write_text(json.dumps(items,ensure_ascii=False,indent=2),encoding='utf-8')
