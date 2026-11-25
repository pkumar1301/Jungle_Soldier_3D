import esbuild from '/opt/npm-tools/node_modules/esbuild/lib/main.js';
import fs from 'node:fs';
const root='/home/claude/vendor-src/pc-engine';
const STRIP=/\b(Debug|DebugHelper|DebugGraphics|WebgpuDebug|WorldClustersDebug)\.(assert|assertDeprecated|assertDestroyed|call|deprecated|warn|warnOnce|error|errorOnce|log|logOnce|removed|trace|setName|setLabel|setDestroyed|toString|clearGpuMarkers|pushGpuMarker|popGpuMarker|validate|memory|internal|end|endShader|render)\(/g;
function stripCalls(src){
  let res='',last=0,m; STRIP.lastIndex=0;
  while((m=STRIP.exec(src))){
    const prev=src[m.index-1]; if(prev==='.'||/[\w$]/.test(prev||'')) continue;
    let i=m.index+m[0].length, depth=1;
    while(i<src.length&&depth>0){
      const c=src[i];
      if(c==="'"||c==='"'||c==='`'){const q=c;i++;while(i<src.length&&src[i]!==q){if(src[i]==='\\')i++; else if(q==='`'&&src[i]==='$'&&src[i+1]==='{'){let d=1;i+=2;while(i<src.length&&d>0){if(src[i]==='{')d++;else if(src[i]==='}')d--;i++;}continue;} i++;} i++; continue;}
      if(c==='/'&&src[i+1]==='/'){while(i<src.length&&src[i]!=='\n')i++;continue;}
      if(c==='('||c==='['||c==='{')depth++; else if(c===')'||c===']'||c==='}')depth--;
      i++;
    }
    res+=src.slice(last,m.index)+'void 0'; last=i; STRIP.lastIndex=i;
  }
  return res+src.slice(last);
}
// minimal jscc: strip `// #if _DEBUG|_PROFILER` ... `// #else` ... `// #endif` (values undefined)
function jscc(src){
  const lines=src.split('\n'); const out=[]; const stack=[];
  for(const l of lines){
    const t=l.trim();
    let m;
    if((m=t.match(/^\/\/ #if (_DEBUG|_PROFILER)\s*$/))){stack.push({keep:false,dir:true});continue;}
    if(stack.length&&t==='// #else'){const s=stack[stack.length-1];s.keep=!s.keep;continue;}
    if(stack.length&&t==='// #endif'){stack.pop();continue;}
    if(stack.every(s=>s.keep)) out.push(l);
  }
  return stripCalls(out.join('\n')).replaceAll('$_CURRENT_SDK_VERSION','2.24.3').replaceAll('$_CURRENT_SDK_REVISION','v2.24.3');
}
const plugin={name:'jscc',setup(b){b.onLoad({filter:/pc-engine\/src\/.*\.js$/},a=>({contents:jscc(fs.readFileSync(a.path,'utf8')),loader:'js'}));}};
await esbuild.build({
  entryPoints:[root+'/src/index.js'], bundle:true, format:'esm', minify:true, target:'es2020',
  outfile:'/home/claude/vendor-src/playcanvas.min.mjs', plugins:[plugin],
  alias:{fflate:root+'/stubs/fflate.js', meshoptimizer:root+'/stubs/meshopt.js'},
  legalComments:'none',  logLevel:'warning',
  banner:{js:'/* PlayCanvas Engine v2.24.3 (MIT License) https://github.com/playcanvas/engine */'}
});
