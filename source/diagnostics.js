function diagnosticReport(){
 const missing=course.filter(t=>!objects.some(o=>matchObject(o,t))&&t.view!=='schematic').map(t=>t.id);
 const noLeft=course.filter(t=>t.view!=='schematic'&&!objects.some(o=>matchObject(o,t)&&['left','median'].includes(o.r.side))).map(t=>t.id);
 const noRight=course.filter(t=>t.view!=='schematic'&&!objects.some(o=>matchObject(o,t)&&['right','median'].includes(o.r.side))).map(t=>t.id);
 const invalidBounds=objects.filter(o=>o.box.isEmpty()||[...o.box.min.toArray(),...o.box.max.toArray()].some(x=>!Number.isFinite(x))).map(o=>o.r.id);
 const missingRelations=course.flatMap(t=>t.rel.filter(([id])=>!byId.has(id)).map(([id])=>[t.id,id]));
 return {ready:state.ready,course:course.length,sourceObjects:sourceObjects.length,sourceNames:baseNames.length,sceneObjects:objects.length,missing,noLeft,noRight,invalidBounds,missingRelations,untranslated:baseNames.filter(n=>!ZH[n]),current:{id:state.id,selected:state.selected.size,related:state.related.size,open:state.open,reveal:state.reveal,side:state.side,cut:state.cutAxis,cameraTarget:cameraState.target.toArray(),cameraQuaternion:cameraState.q.toArray(),cameraDistance:cameraState.distance},finiteCamera:[...cameraState.target.toArray(),...cameraState.q.toArray(),cameraState.distance].every(Number.isFinite),recentFPS:state.fps,errors:state.errors.slice(),resources:performance.getEntriesByType('resource').filter(r=>/^https?:/.test(r.name)).map(r=>r.name)};
}
function showDiagnostics(){
 const report=diagnosticReport(),success=report.ready&&!report.missing.length&&!report.invalidBounds.length&&!report.missingRelations.length&&!report.errors.length&&report.finiteCamera;
 modal(`<h2>运行诊断</h2><p>${success?'✓ 当前结构索引、几何边界、关系引用和镜头数值检查通过。':'有检查项需要查看下方报告。'} 这些是软件检查，不构成解剖准确度验收。</p><p>逐条切换后可重新打开此面板，检查错误与选择状态。参考帧率为当前设备近期的实际值。</p><pre id="diagnosticJSON" style="font:11px/1.8 Consolas,monospace;background:#eef3e6;border:1px solid #d7e0cb;border-radius:6px;padding:16px;overflow:auto">${esc(JSON.stringify(report,null,2))}</pre><button id="diagnosticDownload" class="download">下载运行报告 JSON</button>`);
 $('diagnosticDownload').onclick=()=>download('NeuroAtlas-runtime.json',JSON.stringify(report,null,2),'application/json');
}
