from pathlib import Path
P=Path(__file__).resolve().parent
changes={
 'prepare_native.py':{
  '官方原始双侧岛叶、完整内囊及同源邻近核团和脑回。保留原始比例、顶点和面；只统一显示轴与平移。':'官方双侧岛叶与内囊整体源网格，以及同源邻近核团和脑回。保留源拓扑与比例；统一刚性坐标转换并作 16 位坐标量化，量化误差见记录，非解剖误差。',
  'P41-16 标本的组织学手工标签经作者配准到本标本 MRI；逐块保留原生物理坐标。':'P41-16 的人工描绘、AI 插值并按需人工校正的组织学标签，经作者配准至本标本 MRI；逐块保留原生物理坐标。',
  '与官方 OBJ 保持相同顶点与三角面。界面只做共同刚性坐标转换，不把其他标本变形到这里。':'保留官方 OBJ 的顶点连接与三角面。界面做共同刚性坐标转换及 16 位坐标量化；误差见核验报告，非解剖精度。未把其他标本变形到这里。',
  "'pairedUnseparated':True,'sides':['both']":"'sides':['left','right','both']",
  '已补入官方完整内囊源网格':'已补入官方内囊整体源网格',
  "view='stem',open=0,refs=['p41','nuclei'])":"view='stem',open=0,refs=['p41','nuclei']+(['ew'] if lid==447 else []),aliases={649:['内侧上橄榄核','MSO'],660:['外侧上橄榄核','LSO'],671:['内侧副橄榄核'],685:['背侧副橄榄核']}.get(lid,[]))",
  "Object.assign(SOURCES,{bp3d:":"Object.assign(SOURCES,{ew:['Horn et al. · 人类 EW 核群与副交感分区','https://pubmed.ncbi.nlm.nih.gov/18186030/'],bp3d:",
 },
 'upgrades.js':{
  '原有完整脑、脑神经与颅骨。':'原有大体脑结构、部分脑神经和颅骨参考网格。',
  '新版将可追溯几何保留在各自原生空间。不同标本／模板未做猜测配准，不在同一场景叠加。':'本次新增 BP3D、UW CT、P41 分别保留原生空间，彼此及与原有参考脑不叠加。原有参考脑仍包含上游配准组件，另标为图谱配准。',
  "if(parts.every(o=>o.r.space==='bp3d'))return'mesh';":"if(parts.every(o=>o.r.space==='bp3d'))return t.quality==='functional'?'functional':'mesh';",
  "document.querySelectorAll('[data-side]').forEach(b=>{if(single||space.pairedUnseparated)b.disabled=true;});":"document.querySelectorAll('[data-side]').forEach(b=>{b.disabled=!state.ready||single||space.pairedUnseparated;});",
 },
 'app.js':{
  "byId.get(id).refs=[key];if(id==='superior_olive')byId.get('inferior_olive').refs=[key];":"byId.get(id).refs=[...new Set([...(byId.get(id).refs||[]),key])];if(id==='superior_olive')byId.get('inferior_olive').refs=[...new Set([...(byId.get('inferior_olive').refs||[]),key])];",
  '课程岛叶词条改用岛环状沟定位':'课程岛叶词条使用 BodyParts3D 的独立岛叶源网格',
  '孔道的环是可选择的注释；浦肯野细胞、髓树是单独尺度的教学示意。':'缺少可核验边界的孔道保留缺项；CT 孔腔边界与真实骨缘分割明确区分。浦肯野细胞、髓树仅在单独开启时作为独立尺度教学示意。',
 }
}
for name,reps in changes.items():
 p=P/name;s=p.read_text(encoding='utf-8')
 for a,b in reps.items():
  assert a in s,(name,a)
  s=s.replace(a,b)
 p.write_text(s,encoding='utf-8')
