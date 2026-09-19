const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const esc=s=>String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const ICON=n=>`assets/icons/${n}.png`;
const SCAN=n=>`assets/scans/${n}`;
const FILM=n=>`assets/film/${n}`;
const AUDIO=n=>`assets/audio/${n}`;
const activeAudio=new Set(); let roomClock=null,roomAmbience=null;
function playAudio(name,vol=.15,{loop=false}={}){try{if(state.audioMuted)return null;const a=new Audio(AUDIO(name));a.volume=vol;a.loop=loop;activeAudio.add(a);a.onended=()=>activeAudio.delete(a);a.play().catch(()=>activeAudio.delete(a));return a}catch{return null}}
function stopAudio(a){if(!a)return;try{a.pause();a.currentTime=0}catch{}activeAudio.delete(a)}
function startRoomAudio(){if(state.audioMuted)return;if(!roomClock)roomClock=playAudio('clock_tick.wav',.055,{loop:true});if(!roomAmbience)roomAmbience=playAudio('room_ambience.wav',.07,{loop:true})}
function syncAudio(){activeAudio.forEach(a=>a.muted=!!state.audioMuted);if(state.audioMuted){stopAudio(roomClock);stopAudio(roomAmbience);roomClock=null;roomAmbience=null}else if(state.booted)startRoomAudio();const b=$('#soundButton');if(b)b.textContent=`声音：${state.audioMuted?'关':'开'}`}


const defaultState={
  booted:false,evidence:[],read:[],trainStep:0,trainDone:false,trainFails:0,trainErrors:0,trainStops:0,trainDelay:0,login1:false,filmDone:false,filmFails:0,filmMarks:[],vhsBookmarks:[],vhs7:false,vhsCompareT:null,vhsMark:null,vhsHeardR:false,tailRule:false,identity:false,identityChecks:[],login2:false,metaSelected:[],restored:false,family:false,truth:false,truthWarpSeen:false,jarFound:false,jarNote:false,finalRead:false,ending:null,hints:0,openWins:[],z:20,lastOpen:[],seenTitle:false,phone1:false,phone2:false,sevenLamp:false,audioMuted:false,winGeom:{},createdAt:Date.now()
};
let state=loadState();
let z=30, winCount=0, sceneModules=null;
const desktop=$('#desktop'), layer=$('#windowLayer'), iconsEl=$('#desktopIcons'), taskButtons=$('#taskButtons');

function filmMarksValid(marks){
  if(!Array.isArray(marks)||marks.length!==7)return false;
  const targets=[[.292,.666],[.329,.647],[.365,.633],[.400,.620],[.435,.607],[.471,.595],[.506,.584]],used=new Set();
  for(const [tx,ty] of targets){let best=-1,score=1e9;marks.forEach((m,i)=>{if(used.has(i))return;const dx=Math.abs(m.x-tx)/.026,dy=Math.abs(m.y-ty)/.085,d=dx*dx+dy*dy;if(d<score){score=d;best=i}});if(best<0||score>1) return false;used.add(best)}
  return true;
}
function vhsMarkValid(mark,bookT=null){if(!mark||!Number.isFinite(+mark.x)||!Number.isFinite(+mark.y))return false;if(bookT!==null){if(!Number.isFinite(+mark.t)||+mark.cam!==3||Math.abs(+mark.t-(+bookT))>.28)return false}const dx=(+mark.x-.267)/.035,dy=(+mark.y-.690)/.10;return dx*dx+dy*dy<=1}
function loadState(){
  try{
    const raw={...defaultState,...JSON.parse(localStorage.getItem('liumingguan.save')||'{}')};
    raw.evidence=Array.isArray(raw.evidence)?[...new Set(raw.evidence.filter(x=>typeof x==='string'))]:[];
    raw.read=Array.isArray(raw.read)?[...new Set(raw.read.filter(x=>typeof x==='string'))]:[];
    raw.vhsBookmarks=Array.isArray(raw.vhsBookmarks)?raw.vhsBookmarks.filter(b=>b&&Number.isFinite(+b.t)&&[1,2,3].includes(+b.cam)).slice(0,3).map(b=>({t:+b.t,cam:+b.cam,ch:['L','R','S'].includes(b.ch)?b.ch:'S'})):[];
    raw.vhsMark=raw.vhsMark&&Number.isFinite(+raw.vhsMark.x)&&Number.isFinite(+raw.vhsMark.y)?{x:clamp(+raw.vhsMark.x,0,1),y:clamp(+raw.vhsMark.y,0,1),t:Number.isFinite(+raw.vhsMark.t)?+raw.vhsMark.t:null,cam:[1,2,3].includes(+raw.vhsMark.cam)?+raw.vhsMark.cam:null}:null; raw.vhsHeardR=!!raw.vhsHeardR;
    raw.filmMarks=Array.isArray(raw.filmMarks)?raw.filmMarks.filter(m=>m&&Number.isFinite(+m.x)&&Number.isFinite(+m.y)).slice(0,9).map(m=>({x:clamp(+m.x,0,1),y:clamp(+m.y,0,1)})):[];
    raw.identityChecks=Array.isArray(raw.identityChecks)?[...new Set(raw.identityChecks.filter(x=>typeof x==='string'))].slice(0,6):[];
    raw.metaSelected=Array.isArray(raw.metaSelected)?[...new Set(raw.metaSelected.filter(x=>typeof x==='string'))].slice(0,8):[];
    raw.winGeom=raw.winGeom&&typeof raw.winGeom==='object'?raw.winGeom:{};
    raw.trainStep=clamp(Number(raw.trainStep)||0,0,4); raw.trainFails=Math.max(0,Number(raw.trainFails)||0); raw.trainErrors=Math.max(0,Number(raw.trainErrors)||0); raw.trainStops=Math.max(0,Number(raw.trainStops)||0); raw.trainDelay=Math.max(0,Number(raw.trainDelay)||0); raw.filmFails=Math.max(0,Number(raw.filmFails)||0);
    // R11 migration: older builds granted film/VHS conclusions too early.
    // Preserve completed playthroughs, but require unfinished saves to redo the new manual observations.
    if(!raw.truth&&!raw.finalRead){
      if(raw.evidence.includes('film7')&&!filmMarksValid(raw.filmMarks))raw.evidence=raw.evidence.filter(x=>!['film7','media_cross'].includes(x));
      if(raw.vhs7&&((raw.vhsCompareT===null||raw.vhsCompareT===''||!Number.isFinite(Number(raw.vhsCompareT)))||!vhsMarkValid(raw.vhsMark,Number(raw.vhsCompareT)))){raw.vhs7=false;raw.evidence=raw.evidence.filter(x=>!['vhs7','voice7','media_cross'].includes(x));}
      if(raw.evidence.includes('timeline')&&!['contact','draft','index','handnote'].every(k=>raw.metaSelected.includes(k)))raw.evidence=raw.evidence.filter(x=>x!=='timeline');
      if(raw.evidence.includes('media_cross')&&!(raw.evidence.includes('film7')&&raw.vhs7&&raw.evidence.includes('vhs7')))raw.evidence=raw.evidence.filter(x=>x!=='media_cross');
    }
    if(raw.trainDone)raw.trainStep=4; if(!['archive','delete',null].includes(raw.ending))raw.ending=null;
    return raw;
  }catch{return {...defaultState}}
}
function save(){localStorage.setItem('liumingguan.save',JSON.stringify(state));}
function resetGame(){localStorage.removeItem('liumingguan.save');location.reload();}
function has(id){return state.evidence.includes(id)}
function addEvidence(id,label,detail=''){
  if(!state.evidence.includes(id)){
    state.evidence.push(id); save(); updateWorld();
  }
}
function markRead(id){if(!state.read.includes(id)){state.read.push(id);save();updateWorld();}}
function checkMediaCross(){if(has('film7')&&has('vhs7')&&!has('media_cross'))addEvidence('media_cross','B卷 T03：两份原始材料对不上正式名单','接触印样与连续母带都留下同一处人数差异');}
function toast(title,text,ms=4200){
  const el=document.createElement('div');el.className='toast';el.innerHTML=`<b>${esc(title)}</b>${esc(text)}`;$('#toastLayer').append(el);setTimeout(()=>el.remove(),ms);
}
function setHint(s){$('#taskHint').textContent=s}
function iconDef(id,label,icon,open,opts={}){return {id,label,icon,open,...opts}}

const docs={
 grandpa_note:{title:'床底木箱内便笺',file:'grandpa_note.webp',cap:'纸张扫描 / 木箱最上层',e:'note',ev:'爷爷留下的纸条：看完自己定，别把人家的名字再弄丢。'},
 work_card:{title:'林守义工作证（复印件）',file:'work_card.webp',cap:'工务段旧资料 / 2004扫描',e:'work',ev:'林守义职工号 0712；1993年参与宣传片外景安全协调。'},
 production_contact:{title:'摄制联系单',file:'production_contact.webp',cap:'B卷附件 / 1993-07-12',e:'contact',ev:'宣传片拍摄日为1993-07-12；正式儿童临演写明6人。'},
 cast_list:{title:'儿童临演名单',file:'cast_list.webp',cap:'摄制组核验表',e:'six',ev:'正式儿童名单只有6人，且没有陈禾穗。'},
 script_note:{title:'场记页 B卷/T03',file:'script_note.webp',cap:'扫描件 / 带手写边注',e:'tail_note',ev:'T03边注写着“队尾空一格”“别让娃站尾位”。'},
 school_activity:{title:'二小活动名单',file:'school_activity.webp',cap:'学校馆藏复印件',e:'school_name',ev:'陈禾穗，7岁，一（4）班，住铁路东巷。'},
 library_card:{title:'陈禾穗借阅卡',file:'library_card.webp',cap:'图书室馆藏复印',e:'library',ev:'陈禾穗连续借过三本火车书，其中一本晚还23天。'},
 sports_record:{title:'春季运动会记录',file:'sports_record.webp',cap:'体育组记录',e:'sports',ev:'陈禾穗50米第四名，预赛抢跑两次。'},
 classmate_note:{title:'同学通讯册散页',file:'classmate_note.webp',cap:'林守义2009复印',e:'bag',ev:'同学散页写他常追货车数车厢；蓝白帆布书包侧边缝着“穗”字。'},
 newspaper_1994:{title:'1994年地方报纸剪报',file:'newspaper_1994.webp',cap:'《樟城晚报》1994-01-19',e:'death',ev:'送孩路附近一名约7岁男童意外死亡，姓名未公布。'},
 wish_note:{title:'一年级练习本散页',file:'wish_note.webp',cap:'东巷二小 / 1993春',e:'wish',ev:'陈禾穗写想坐火车去很远的地方看看；老师批他写字太快，最后一笔常丢。'},
 family_calendar:{title:'林家1993年7月旧挂历',file:'family_calendar.webp',cap:'家庭纸质材料',e:'calendar',ev:'林舟7月12日晚退烧；同日爷爷借路口“再试一次”。'},
 grass_substitute:{title:'旧布草材料清单',file:'grass_substitute.webp',cap:'林守义手写 / 1993',e:'grass',ev:'爷爷原本只做草替，并写明“不找活人顶”“队尾留空”。'},
 final_note:{title:'林守义未寄出的手记',file:'final_note.webp',cap:'最后修改：2019-11-23 02:17',e:'final',ev:'爷爷拍最后一条时在路口另一侧，没看见阿穗站进队尾。'}
};

const desktopIcons=()=>[
 iconDef('docs','我的文档','folder',openDocuments),
 iconDef('recent','最近打开','recent',openRecent),
 iconDef('site','送孩路资料档','site',openOldSite),
 iconDef('train','区间调度训练器','train',openTrain),
 iconDef('archive','宣传影像离线库','archive',openArchiveLogin),
 iconDef('media','影像检查台','media',openMediaHub),
 iconDef('school','学校与地方材料','docs',openSchool),
 iconDef('mail','邮件归档','mail',openMailLogin),
 iconDef('meta','文件属性','search',openMetadata),
 iconDef('family','家庭旧档','calendar',openFamily),
 iconDef('jar','物件扫描','jar',openJar),
 iconDef('recycle','回收站','recycle',openRecycle),
 iconDef('help','系统说明','help',openHelp),
 iconDef('power','关闭计算机','power',openPower)
];

function renderDesktop(){
  iconsEl.innerHTML='';
  desktopIcons().forEach(def=>{
    const b=document.createElement('button');b.className='desktop-icon';b.dataset.id=def.id;
    b.innerHTML=`<img src="${ICON(def.icon)}" alt=""><span>${esc(def.label)}</span>`;
    b.addEventListener('dblclick',def.open);b.addEventListener('click',()=>setHint(`选中：${def.label}`)); iconsEl.append(b);
  });
}

function persistWindow(el){
  if(!el?.dataset?.winId||el.dataset.max==='1')return;
  const r=el.getBoundingClientRect();
  state.winGeom=state.winGeom||{};
  state.winGeom[el.dataset.winId]={left:Math.round(r.left),top:Math.round(r.top),width:Math.round(r.width),height:Math.round(r.height)};
  save();
}
function makeWindow({id,title,icon='folder',body='',w=900,h=620,status='就绪',menu=true,onClose=null}){
  const existing=$(`.win[data-win-id="${CSS.escape(id)}"]`);
  if(existing){existing.classList.remove('hidden');activate(existing);return existing}
  const el=document.createElement('section');el.className='win active';el.dataset.winId=id;
  const geom=state.winGeom?.[id];
  if(geom){el.style.width=`${clamp(+geom.width||w,320,Math.max(320,innerWidth-8))}px`;el.style.height=`${clamp(+geom.height||h,220,Math.max(220,innerHeight-44))}px`;el.style.left=`${clamp(+geom.left||20,-Math.max(0,(+geom.width||w)-110),Math.max(0,innerWidth-110))}px`;el.style.top=`${clamp(+geom.top||20,0,Math.max(0,innerHeight-74))}px`}
  else{el.style.width=`min(${w}px,94vw)`;el.style.height=`min(${h}px,84vh)`;const off=(winCount++%8)*24;el.style.left=`${clamp(85+off,10,innerWidth-360)}px`;el.style.top=`${clamp(52+off,8,innerHeight-260)}px`}
  el.style.zIndex=++z;
  el.innerHTML=`<header class="win-titlebar"><img src="${ICON(icon)}" alt=""><span class="win-title">${esc(title)}</span><span class="win-controls"><button data-act="min" aria-label="最小化">_</button><button data-act="max" aria-label="最大化或还原">□</button><button data-act="close" aria-label="关闭">×</button></span></header>${menu?'<div class="win-menu"><span>文件(F)</span><span>查看(V)</span><span>帮助(H)</span></div>':''}<div class="win-body">${body}</div><footer class="statusbar"><span>${esc(status)}</span><span>本地计算机</span></footer>`;
  layer.append(el);dragWindow(el);activate(el);
  const tb=document.createElement('button');tb.className='task-window-button active';tb.dataset.for=id;tb.textContent=title;
  tb.onclick=()=>{if(el.classList.contains('hidden')){el.classList.remove('hidden');activate(el);return}if(el.classList.contains('active')){el.classList.add('hidden');tb.classList.remove('active');return}activate(el)};
  taskButtons.append(tb);el.addEventListener('mousedown',()=>activate(el));
  const closeBtn=$('.win-controls [data-act="close"]',el),minBtn=$('.win-controls [data-act="min"]',el),maxBtn=$('.win-controls [data-act="max"]',el);
  closeBtn.onclick=()=>{persistWindow(el);disposeWindowScenes(el);el.remove();tb.remove();onClose?.()};
  minBtn.onclick=()=>{persistWindow(el);el.classList.add('hidden');tb.classList.remove('active')};
  maxBtn.onclick=()=>{if(el.dataset.max==='1'){el.style.cssText=el.dataset.prev;el.dataset.max='0';setTimeout(()=>persistWindow(el),0)}else{persistWindow(el);el.dataset.prev=el.style.cssText;el.style.left='0';el.style.top='0';el.style.width='100%';el.style.height='100%';el.dataset.max='1'}};
  $('.win-titlebar',el).ondblclick=e=>{if(!e.target.closest('.win-controls'))maxBtn.click()};
  return el;
}
function activate(el){$$('.win').forEach(w=>{w.classList.toggle('inactive',w!==el);w.classList.toggle('active',w===el)});el.style.zIndex=++z;$$('.task-window-button').forEach(b=>b.classList.toggle('active',b.dataset.for===el.dataset.winId))}
function dragWindow(el){const bar=$('.win-titlebar',el);let sx,sy,sl,st,drag=false,pid=null;bar.addEventListener('pointerdown',e=>{if(el.dataset.max==='1'||e.button!==0||e.target.closest('.win-controls'))return;drag=true;pid=e.pointerId;sx=e.clientX;sy=e.clientY;sl=parseFloat(el.style.left)||0;st=parseFloat(el.style.top)||0;bar.setPointerCapture?.(e.pointerId);e.preventDefault()});bar.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==pid)return;el.style.left=`${clamp(sl+e.clientX-sx,-el.offsetWidth+110,innerWidth-110)}px`;el.style.top=`${clamp(st+e.clientY-sy,0,Math.max(0,innerHeight-74))}px`});const stop=e=>{if(!drag)return;drag=false;try{bar.releasePointerCapture?.(e.pointerId)}catch{}pid=null;persistWindow(el)};bar.addEventListener('pointerup',stop);bar.addEventListener('pointercancel',stop);$$('.win-controls button',bar).forEach(b=>b.addEventListener('pointerdown',e=>e.stopPropagation()))}

window.addEventListener('keydown',e=>{if(e.key==='Escape'){const wins=$$('.win:not(.hidden)');const top=wins.sort((a,b)=>(+a.style.zIndex||0)-(+b.style.zIndex||0)).pop();top?.querySelector('[data-act="close"]')?.click()}});
window.addEventListener('resize',()=>{$$('.win').forEach(w=>{if(w.dataset.max==='1')return;const r=w.getBoundingClientRect();if(r.top>innerHeight-70)w.style.top=Math.max(0,innerHeight-100)+'px';if(r.left>innerWidth-90)w.style.left=Math.max(-w.offsetWidth+110,innerWidth-150)+'px';persistWindow(w)})});

function bindEvidenceDock(el){
  if(!el||el.dataset.dockBound==='1')return;el.dataset.dockBound='1';
  const tools=$('.scan-tools',el);if(!tools)return;
  const left=document.createElement('button'),right=document.createElement('button'),free=document.createElement('button');
  left.className=right.className=free.className='tool-btn evidence-dock-btn';left.textContent='靠左核对';right.textContent='靠右核对';free.textContent='自由窗口';free.hidden=true;
  const apply=side=>{
    if(side==='free'){el.classList.remove('evidence-docked','dock-left','dock-right');if(el.dataset.dockPrev){el.style.cssText=el.dataset.dockPrev;delete el.dataset.dockPrev}free.hidden=true;left.hidden=right.hidden=false;activate(el);return}
    if(!el.classList.contains('evidence-docked'))el.dataset.dockPrev=el.style.cssText;
    el.dataset.max='0';el.classList.add('evidence-docked');el.classList.toggle('dock-left',side==='left');el.classList.toggle('dock-right',side==='right');
    el.style.width='50vw';el.style.height='calc(100vh - 34px)';el.style.top='0';el.style.left=side==='left'?'0':'50vw';free.hidden=false;left.hidden=right.hidden=true;activate(el);
  };
  left.onclick=()=>apply('left');right.onclick=()=>apply('right');free.onclick=()=>apply('free');tools.insertBefore(left,tools.lastElementChild);tools.insertBefore(right,tools.lastElementChild);tools.insertBefore(free,tools.lastElementChild);
}

function openScan(id){const d=docs[id];if(!d)return;markRead(id);addEvidence(d.e,d.title);const el=makeWindow({id:'scan_'+id,title:d.title,icon:'docs',w:830,h:650,menu:false,status:d.cap,body:`<div class="scan-tools"><button class="tool-btn" data-zin>放大</button><button class="tool-btn" data-zout>缩小</button><button class="tool-btn" data-fit>适合窗口</button><span style="margin-left:auto;font-size:11px">${esc(d.cap)}</span></div><div class="scan-view"><figure class="scan-frame"><img src="${SCAN(d.file)}" alt="${esc(d.title)}"><figcaption class="scan-caption"><span>${esc(d.cap)}</span><span>扫描件 / 100% / 双击窗口标题可最大化</span></figcaption></figure></div>`});
  bindEvidenceDock(el);
  const img=$('.scan-frame img',el);let zoom=1;const apply=()=>img.style.width=`${zoom*100}%`; $('[data-zin]',el).onclick=()=>{zoom=Math.min(2.2,zoom+.2);apply()};$('[data-zout]',el).onclick=()=>{zoom=Math.max(.6,zoom-.2);apply()};$('[data-fit]',el).onclick=()=>{zoom=1;apply()};
  if(state.restored)setTimeout(checkTruth,0);
}

const miscDocs={
  wood:{title:'木工尺寸_旧.txt',body:'厨房矮柜\\n高 82\\n宽 74\\n深 33\\n\\n门板别再买薄的。上次那块一到梅雨天就翘。\\n—— 2008.6'},
  medicine:{title:'药费_2019.txt',body:'11月\\n降压药  46.80\\n眼药水  18.50\\n维生素  12.00\\n\\n周二复诊。身份证放旧钱包里。'},
  phonebook:{title:'旧号码.txt',body:'老杨（摄制）  号码停用\\n国良  13*********\\n老曹（线路）  搬去南桥\\n打印店  26****8\\n\\n“别半夜打老杨，他耳背，接起来就骂。”'},
  driver:{title:'扫描仪说明.txt',body:'佳能旧扫描仪\\nTWAIN 驱动装在 D:\\\\DRIVER\\SCAN\\n纸张歪了先别硬拉，掀盖板。\\n2009.5.3 重装过一次。'},
  recipes:{title:'腌萝卜.txt',body:'白萝卜切条，太阳下晾半天。\\n盐少一点。\\n第二天才放辣椒。\\n\\n去年那坛太咸，别照旧量。'}
};
function openMiscDoc(id){const m=miscDocs[id];if(!m)return;makeWindow({id:'misc_'+id,title:'记事本 - '+m.title,icon:'notepad',w:590,h:410,body:`<div class="notepad-page">${esc(m.body).replace(/\\n/g,'<br>')}</div>`,status:'纯文本'});}
function openDocuments(){
  const plot=[['grandpa_note','便笺_床底木箱.webp','2019-11-23 02:17','扫描图像'],['work_card','工务段工作证_复印.webp','2004-03-07 19:42','扫描图像'],...(state.restored?[['family_calendar','旧挂历_1993-07.webp','2004-03-07 20:01','扫描图像'],['grass_substitute','材料清单_旧布草.webp','2004-03-07 20:08','扫描图像']]:[]),...(state.truth?[['final_note','HANDNOTE_2019.scan','2019-11-23 02:17','扫描图像']]:[])];
  const noise=[['wood','木工尺寸_旧.txt','2008-06-03 18:24','文本文档'],['medicine','药费_2019.txt','2019-11-07 09:12','文本文档'],['phonebook','旧号码.txt','2015-04-20 21:06','文本文档'],['driver','扫描仪说明.txt','2009-05-03 20:44','文本文档'],['recipes','腌萝卜.txt','2016-10-02 07:51','文本文档']];
  const rows=[...plot.map(x=>({...Object.fromEntries(['id','n','t','ty'].map((k,i)=>[k,x[i]])),kind:'scan'})),...noise.map(x=>({...Object.fromEntries(['id','n','t','ty'].map((k,i)=>[k,x[i]])),kind:'misc'}))].sort((a,b)=>b.t.localeCompare(a.t));
  const body=`<div class="split"><aside class="sidepane"><h4>文件和文件夹任务</h4><a href="#" data-open="recent">查看最近打开的文件</a><a href="#" data-open="site">打开送孩路资料档</a><h4>其他位置</h4><a>桌面</a><a>我的电脑</a><a>回收站</a></aside><div class="mainpane"><table class="file-list"><thead><tr><th>名称</th><th>修改日期</th><th>类型</th></tr></thead><tbody>${rows.map(o=>`<tr data-${o.kind}="${o.id}"><td><span class="file-chip"><img src="${ICON(o.kind==='scan'?'docs':'notepad')}">${o.n}</span></td><td>${o.t}</td><td>${o.ty}</td></tr>`).join('')}</tbody></table><div class="system-note"><b>文件夹属性</b><span>这个目录从2004年一直用到2019年，东西没怎么分过类。</span></div></div></div>`;
  const el=makeWindow({id:'documents',title:'我的文档',icon:'folder',body,status:`${rows.length} 个对象`});$$('[data-scan]',el).forEach(r=>r.ondblclick=()=>r.dataset.scan==='final_note'?openFinal():openScan(r.dataset.scan));$$('[data-misc]',el).forEach(r=>r.ondblclick=()=>openMiscDoc(r.dataset.misc));$('[data-open="recent"]',el).onclick=e=>{e.preventDefault();openRecent()};$('[data-open="site"]',el).onclick=e=>{e.preventDefault();openOldSite()};
}
function openRecent(){
  addEvidence('recent','最近使用记录：2019年11月');
  const pre=[['production_contact','宣传片_联系单.scan','C:\LMG\cache\摄制组'],['cast_list','儿童临演名单.scan','C:\LMG\cache\摄制组'],['script_note','场记_B卷_T03.scan','C:\LMG\cache\摄制组']];
  const ordinary=[['木工尺寸_旧.txt','2019-11-21','C:\Documents'],['药费_2019.txt','2019-11-19','C:\Documents'],['SCAN_TEMP_07.tmp','2019-11-18','C:\TEMP']];
  let rows=[];
  if(!state.login1) rows=pre.map((x,i)=>({kind:'scan',id:x[0],n:x[1],t:i===0?'刚刚':'2019-11-'+(23-i),loc:x[2]}));
  else rows=(state.login2?[['2019_杨元成.eml','刚刚','C:\MAIL\inbox'],['阿穗_索引.txt','2019-11-23','C:\LMG\1993'],['B03_接触印样.tif','2019-11-22','C:\VIDEO\SCAN']]:[['B03_接触印样.tif','刚刚','C:\VIDEO\SCAN'],['T03_母带.vhs','2019-11-22','C:\VIDEO'],['场记_B03.scan','2019-11-21','C:\LMG\cache']]).map(x=>({kind:'plain',n:x[0],t:x[1],loc:x[2]}));
  rows=[...rows,...ordinary.map(x=>({kind:'plain',n:x[0],t:x[1],loc:x[2]}))];
  if(state.truth)rows.unshift({kind:'final',n:'HANDNOTE_2019.scan',t:'2019-11-23',loc:'C:\LMG\family'});
  const body=`<div class="mainpane"><h3 style="font-size:14px;margin-top:0">最近打开的文档</h3><table class="file-list"><thead><tr><th>名称</th><th>最后访问</th><th>位置</th></tr></thead><tbody>${rows.map(o=>`<tr ${o.kind==='scan'?`data-recent-doc="${o.id}"`:o.kind==='final'?'data-final-recent':''}><td>${o.kind==='scan'?`<span class="file-chip"><img src="${ICON('docs')}">${o.n}</span>`:o.n}</td><td>${o.t}</td><td>${o.loc}</td></tr>`).join('')}</tbody></table><div class="plain-memo" data-case-note><b>1993_最后一条核对.txt</b><br><span>名单：6　场记：6　老杨电话里说最后一条人数不对。<br>先看原片。别拿电话里一句话当数。</span></div><div class="system-note"><b>系统备注</b><span>CMOS电池换过一次，“刚刚”这一项的访问时间不可信；其余记录停在2019年11月。</span></div><p style="font-size:12px">关联位置：<a href="#" data-site>送孩路旧俗资料档</a></p></div>`;
  const el=makeWindow({id:'recent',title:'最近使用的文档',icon:'recent',body,status:`最近记录：${rows.length}`});$('[data-site]',el).onclick=e=>{e.preventDefault();openOldSite()};$$('[data-recent-doc]',el).forEach(r=>r.ondblclick=()=>openScan(r.dataset.recentDoc));$('[data-final-recent]',el)?.addEventListener('dblclick',openFinal);$('[data-case-note]',el).ondblclick=()=>{makeWindow({id:'case_note',title:'记事本 - 1993_最后一条核对.txt',icon:'notepad',w:610,h:360,body:`<div class="notepad-page">1993 / 宣传片最后一条<br><br>正式名单：6<br>场记：6<br>老杨电话：最后一条人数不对<br><br>不能先下结论。<br>看 B 卷接触印样，再看 T03 母带。<br><br>—— 林守义，2019-11</div>`,status:'纯文本 · 2019-11-23'});addEvidence('case_goal','1993_最后一条核对.txt')};
}

const sitePages={
 home:`<h2>送孩路旧俗资料档</h2><p>这是林守义退休后整理的个人资料页。樟城这边同一件旧事，隔两条街就能讲出两个版本。我把听来的和找得到的纸件分开记，免得年纪大了把人话当成规矩。</p><div class="site-note"><b>最近补记（2019-11）</b><br>1993年的宣传片资料又收到一批。杨元成电话里只说了一句：最后一条人数对不上。正式名单还是六个。原片没核完以前，这句话先不挂公开页，材料放本机影像卷。</div><h3>索引</h3><ul><li><a data-page="road">“送孩路”条目</a></li><li><a data-page="tail">牵魂线与队尾空位</a></li><li><a data-page="bbs">留言板缓存</a></li><li><a data-page="about">关于本站 / 联系站长</a></li></ul><p class="visitor">访问计数：003871 · 最后更新 2019-11-23</p>`,
 road:`<h2>送孩路</h2><p>旧支线K7附近那段路，早先没这个正式地名。七八十年代以后事故多，老人不让小孩天黑走，慢慢就叫开了。</p><p>有人把所有事故都往“送孩”上套，我不同意。铁路边本来就危险，旧路照明也差。</p><p>1993年7月，电视台在这里拍过一段铁路宣传片。现场临演是六个孩子。</p><div class="site-note">我把这一条单独标1993，不是因为传说。是因为拍片那天家里也出了事。</div>`,
 tail:`<h2>牵魂线 / 队尾空位（问答）</h2><p><b>问：是不是让人排队过路口？</b><br>老说法里确实有“搭肩、逐个喊小名”的做法，但各家讲得不一样。我母亲说要挨着喊，我二叔就说他小时候根本没听过这一句。</p><p><b>问：为什么队尾要空？</b><br>我家听的是：队尾留一格，活人不能临时补。我问过老人为什么，只得一句“那格不是给娃站的”。再问就不答了。</p><p><b>问：草替是什么？</b><br>旧布草扎的小替身。至少我家留下来的清单写的是草替，不是活人。</p><div class="site-note">1993那一页我一直没写完。别的说法可以错，这一条我不敢混：队尾不要补活人。</div>`,
 bbs:`<h2>留言板缓存 2004—2015</h2><table class="bbs"><tr><th>时间</th><th>昵称</th><th>内容</th></tr><tr><td>2004-05</td><td>站长</td><td>试一下留言功能。要是又乱码就先别留。</td></tr><tr><td>2004-11</td><td>南桥阿荣</td><td>你这个计数器怎么一天多三百访问？八成坏了。</td></tr><tr><td>2005-06</td><td>东巷老张</td><td>送孩路就是旧路口，别传成鬼路。小时候我们照走。</td></tr><tr><td>2006-01</td><td>小朱</td><td>路口那盏灯今年还修不修？下夜班黑得很。</td></tr><tr><td>2007-09</td><td>老工务</td><td>93年电视台确实来拍过。孩子几个我记不牢，只记得有个老抢镜。</td></tr><tr><td>2008-04</td><td>游客17</td><td>网页背景太灰了，林师傅你换个亮点的吧。</td></tr><tr><td>2009-12</td><td>铁小老周</td><td>东巷二小以前春游都是从铁路东巷集合，老师最怕孩子往线路边跑。</td></tr><tr><td>2010-07</td><td>匿名</td><td>我爸说那次宣传片是六个小孩，不知道对不对。</td></tr><tr><td>2011-03</td><td>铁小92届</td><td>蓝白书包那几年满街都是，光凭书包认不了人。</td></tr><tr><td>2011-06</td><td>老工务</td><td>你问的杨元成是不是摄制组那个小杨？他后来去省台了。</td></tr><tr><td>2012-02</td><td>阿霞</td><td>站长，新年好。你上次说的木匠电话我找到了，私信你。</td></tr><tr><td>2013-10</td><td>游客</td><td>“牵魂线”我们家叫“过路线”，喊法不一样。</td></tr><tr><td>2014-08</td><td>匿名</td><td>你是不是在找94年出事那个孩子？报纸没写名，我只记得是冬天。</td></tr><tr><td>2015-02</td><td>站长</td><td>先别往“换命”上说。没有证据。能对日期、卷号、姓名的再发。</td></tr></table>`,
 about:`<h2>关于本站</h2><p>站长：林守义，樟城铁路工务段退休。这里是我个人整理的旧俗和旧支线资料。</p><p>联系：<b>linshouyi</b>（本机离线邮件归档同名账号）。</p><p>有影像、场记或1993年7月12日旧支线拍摄材料，可留邮件头和卷号，别只发转述。</p><p class="visitor">本页生成：2004-04 / 最近修改：2019-11</p>`
};
function openOldSite(page='home'){
  markRead('oldsite');addEvidence('folk','送孩路旧俗资料档','爷爷把1993拍片和家里的事分开记录了很多年');
  const body=`<div class="browser-shell"><div class="browser-bar"><button class="tool-btn" data-home>主页</button><button class="tool-btn" data-back>后退</button><span>地址</span><div class="urlbox">file:///C:/LMG/site/index.htm</div></div><div class="oldsite"><article class="site-sheet"><div class="site-banner">送孩路旧俗资料档</div><nav class="site-nav"><a data-page="home">首页</a><a data-page="road">送孩路</a><a data-page="tail">问答</a><a data-page="bbs">留言</a><a data-page="about">关于</a></nav><div class="site-content">${sitePages[page]}</div></article></div></div>`;
  const el=makeWindow({id:'oldsite',title:'Microsoft Internet Explorer - 送孩路旧俗资料档',icon:'browser',body,status:'脱机工作'});let hist=[page];
  const render=p=>{hist.push(p);$('.site-content',el).innerHTML=sitePages[p];bind();if(p==='tail'){addEvidence('tail_rule','旧俗规则：队尾留一格，活人不能临时补位');state.tailRule=true;save();updateWorld()}if(p==='about')addEvidence('mail_account','站长账号 linshouyi')};
  const bind=()=>$$('[data-page]',el).forEach(a=>a.onclick=e=>{e.preventDefault();render(a.dataset.page)});bind();$('[data-home]',el).onclick=()=>render('home');$('[data-back]',el).onclick=()=>{if(hist.length>1){hist.pop();const p=hist.pop();render(p)}};
}

const runPlans=[
 {id:'0312',name:'货运演练',schedule:'14:31',eta:32,a:'定位',b:'反位',lock:true,msg:'进入货场侧线，保持主区间空闲。',block:'1DG → 货1线'},
 {id:'0712',name:'客车演练',schedule:'14:34',eta:54,a:'反位',b:'定位',lock:true,msg:'由站台侧通过，前车未完全出清时提前准备进路。',block:'2DG → 站台线'},
 {id:'2514',name:'检修演练',schedule:'14:37',eta:76,a:'定位',b:'定位',lock:false,msg:'检修回送；2DG 存在一段临时施工封锁窗口。',block:'检修线',dynamic:true},
 {id:'K712/4312',name:'交会考核',schedule:'14:40',eta:98,a:'反位',b:'定位',lock:true,msg:'客车与货运同时接近咽喉；按运行图决定先行列车并控制咽喉占用。',block:'站台线 ↔ 侧线',meet:true}
];
function openTrain(){
  const liveRows=runPlans.map((r,i)=>`<div class="dispatch-row" data-live="${i}"><span class="dispatch-id">${r.id}</span><span class="dispatch-time">${r.schedule}</span><span class="dispatch-route">${r.block}</span><span class="dispatch-distance" data-livedist>等待</span><span class="dispatch-bar"><i data-livebar></i></span></div>`).join('');
  const body=`<div class="train-app"><section class="train-controls"><div class="interlock"><div class="interlock-title">樟城铁路职工培训系统 · 区间调度训练器 2003</div><div class="lever-grid"><div class="lever"><label>1# 道岔</label><div class="toggle-pair"><button data-lever="a" data-v="定位">定位</button><button data-lever="a" data-v="反位">反位</button></div></div><div class="lever"><label>2# 道岔</label><div class="toggle-pair"><button data-lever="b" data-v="定位">定位</button><button data-lever="b" data-v="反位">反位</button></div></div><div class="lever"><label><input type="checkbox" data-lock> 区间锁闭</label><small>联锁建立后，冲突进路会被系统拒绝。</small></div><div class="lever"><label>信号</label><div>状态：<b data-signal>关闭</b></div><small data-route-note>列车按训练时钟持续接近。</small></div></div><button class="signal-btn" data-run>建立进路并开放信号</button></div><div class="run-sheet"><b>今日训练运行表</b><table><thead><tr><th>时刻</th><th>车次</th><th>任务</th></tr></thead><tbody>${runPlans.map((r,i)=>`<tr data-runrow="${i}" class="${i===state.trainStep?'current':''}"><td>${r.schedule}</td><td>${r.id}</td><td>${r.msg}</td></tr>`).join('')}</tbody></table><div class="run-sheet-foot">训练时钟不会判定失败：来不及建立进路时，列车会在机外停车并记录晚点。</div></div><div class="meet-panel" data-meet-panel hidden><div class="meet-head">交会次序</div><p>两车同时进入接近区段，咽喉一次只能放一列。选择先行车后仍需自己扳道岔、锁闭进路。</p><div class="meet-choice"><button class="tool-btn on" data-priority="passenger">K712 客车先行</button><button class="tool-btn" data-priority="freight">4312 货车先行</button></div><small data-meet-note>客车先行：站台线优先，货车在侧线外等待。</small></div><div class="train-tools"><button class="tool-btn" data-demo>查看操作说明</button><button class="tool-btn ${state.trainFails>=3&&!state.trainDone?'assist-ready':''}" data-assist ${state.trainFails>=3&&!state.trainDone?'':'disabled'}>演示当前一步</button><button class="tool-btn" data-history ${state.trainDone?'':'disabled'}>训练历史</button>${state.trainDone&&state.identity?'<button class="tool-btn" data-replay>1993-07-12 历史回放</button>':''}</div></section><section class="train-screen"><div class="dispatch-live"><div class="dispatch-head"><b>实时运行监视 / 压缩时标</b><span data-simclock>14:30:00</span><span class="closure-state" data-closure>2DG：正常</span></div><div class="dispatch-rows">${liveRows}</div><div class="track-status"><span data-block="1DG">1DG</span><span data-block="2DG">2DG</span><span data-block="SIDE">侧线</span><span data-block="PLAT">站台线</span></div></div><div class="interlock-map" data-map><div class="map-head"><b>联锁表示盘</b><span data-map-route>进路：未建立</span><span data-map-lock>锁闭：否</span></div><svg viewBox="0 0 760 128" role="img" aria-label="区间联锁线路示意"><path class="trk base" d="M26 68 H728"/><path class="trk branch" data-map-path="side" d="M210 68 C285 68 290 28 370 28 H610"/><path class="trk branch" data-map-path="platform" d="M300 68 C372 68 385 106 472 106 H650"/><path class="trk branch" data-map-path="main" d="M210 68 H650"/><circle class="node" cx="210" cy="68" r="7"/><circle class="node" cx="300" cy="68" r="7"/><g class="map-signal" data-map-signal transform="translate(675 43)"><rect x="0" y="0" width="18" height="48" rx="2"/><circle data-lamp="r" cx="9" cy="12" r="5"/><circle data-lamp="g" cx="9" cy="35" r="5"/></g><g class="map-blocks"><text x="58" y="55">1DG</text><text x="344" y="55">2DG</text><text x="425" y="22">货1 / 侧线</text><text x="482" y="121">站台线</text></g></svg></div><div class="three-stage" data-three><div class="fallback-rail"><div class="fallback-rail-status"><b>线路透视模拟窗</b><span>正在加载硬件加速场景…</span><small>旧显卡不支持3D时，只显示联锁表示盘和本地线路快照。</small><i></i></div></div></div><div class="train-log" data-log>系统自检完成。联锁仿真：正常。<br>训练时钟开始；0312 次正在接近。<br>等待第 ${Math.min(state.trainStep+1,runPlans.length)} 项训练。</div></section></div>`;
  const el=makeWindow({id:'train',title:'区间调度训练器 2003',icon:'train',w:1080,h:720,body,menu:false,status:'TRAIN.EXE · build 2003.10 / REALTIME MODE'});
  let cfg={a:'定位',b:'定位'},priority='passenger',busy=false,closed=false,clockTimer=null,lastWarn=-1;
  const stage=$('[data-three]',el),lockBox=$('[data-lock]',el),openedAt=performance.now(),phaseEntered=[0,0,0,0];if(state.trainStep<runPlans.length)phaseEntered[state.trainStep]=openedAt;
  const runtime={stopped:[false,false,false,false],recorded:[false,false,false,false],late:[0,0,0,0],done:[state.trainStep>0,state.trainStep>1,state.trainStep>2,state.trainStep>3]};
  const simStart=14*3600+30*60;
  const nowSec=()=>Math.max(0,(performance.now()-openedAt)/1000);
  const simTime=()=>{let q=simStart+Math.floor(nowSec());return `${String(Math.floor(q/3600)%24).padStart(2,'0')}:${String(Math.floor(q/60)%60).padStart(2,'0')}:${String(q%60).padStart(2,'0')}`};
  const closureLeft=()=>state.trainStep===2?Math.max(0,18-(performance.now()-(phaseEntered[2]||performance.now()))/1000):0;
  const routeVariants=p=>p.meet?(priority==='passenger'?[{a:'反位',b:'定位',lock:true,key:'passenger'}]:[{a:'定位',b:'反位',lock:true,key:'freight'}]):p.dynamic?[{a:'反位',b:'反位',lock:true,key:'side'},{a:p.a,b:p.b,lock:p.lock,key:'direct'}]:[{a:p.a,b:p.b,lock:p.lock,key:'normal'}];
  const routeCheck=(p,lock)=>{const hit=routeVariants(p).find(r=>r.a===cfg.a&&r.b===cfg.b&&r.lock===lock);if(!hit)return {ok:false,reason:'道岔位置或锁闭条件与当前运行图不符。'};if(p.dynamic&&hit.key==='direct'&&closureLeft()>0)return {ok:false,reason:`2DG 施工封锁尚余 ${Math.ceil(closureLeft())} 秒；可改经侧线锁闭通过，或等待封锁解除。`};if(p.meet&&!lock)return {ok:false,reason:'交会考核要求先锁闭一条完整进路，不能同时放两车抢咽喉。'};return {ok:true,key:hit.key}};
  const syncMap=()=>{const lock=lockBox.checked;let route=cfg.a==='反位'&&cfg.b==='定位'?'platform':cfg.a==='反位'&&cfg.b==='反位'?'side':cfg.a==='定位'&&cfg.b==='反位'?'side':'main';$$('[data-map-path]',el).forEach(p=>p.classList.toggle('selected',p.dataset.mapPath===route));$('[data-map-route]',el).textContent=`进路：${route==='platform'?'站台线':route==='side'?'侧线/货线':'正线'}`;$('[data-map-lock]',el).textContent=`锁闭：${lock?'是':'否'}`;$('[data-map]',el).classList.toggle('locked',lock)};
  const syncRailVisual=()=>{stage.dataset.routeA=cfg.a;stage.dataset.routeB=cfg.b;stage.dataset.locked=lockBox.checked?'1':'0';syncMap();loadThree().then(m=>m?.setRailRoute?.(stage,{...cfg,lock:lockBox.checked})).catch(()=>{})};
  const setLever=(name,val)=>{$$(`[data-lever="${name}"]`,el).forEach(x=>x.classList.toggle('on',x.dataset.v===val));cfg[name]=val;syncRailVisual()};
  $$('[data-lever]',el).forEach(b=>b.onclick=()=>{if(busy)return;setLever(b.dataset.lever,b.dataset.v)});lockBox.onchange=()=>{if(!busy)syncRailVisual()};
  const meetPanel=$('[data-meet-panel]',el),meetNote=$('[data-meet-note]',el);
  const syncMeetPanel=()=>{const p=runPlans[state.trainStep];meetPanel.hidden=!(p&&p.meet);if(!meetPanel.hidden){$$('[data-priority]',meetPanel).forEach(b=>b.classList.toggle('on',b.dataset.priority===priority));meetNote.textContent=priority==='passenger'?'客车先行：站台线优先，货车在侧线外等待。':'货车先行：货1线优先，客车在站外短停。'}};
  $$('[data-priority]',meetPanel).forEach(b=>b.onclick=()=>{if(busy)return;priority=b.dataset.priority;syncMeetPanel();log(priority==='passenger'?'调度员记录：K712 客车优先；请建立站台进路。':'调度员记录：4312 货车优先；请建立货线进路。')});
  setLever('a','定位');setLever('b','定位');syncMeetPanel();
  const log=m=>{const l=$('[data-log]',el);l.innerHTML+=`<br><span class="log-time">[${simTime()}]</span> ${esc(m)}`;l.scrollTop=l.scrollHeight};
  const runBtn=$('[data-run]',el),assist=$('[data-assist]',el);
  const unlockAssist=()=>{if(state.trainFails>=3&&!state.trainDone){assist.disabled=false;assist.classList.add('assist-ready')}};
  const updateBlocks=()=>{const active=state.trainStep;$$('[data-block]',el).forEach(x=>x.classList.remove('occupied','locked','closed','approach'));if(active<runPlans.length){const p=runPlans[active];if(p.meet){$('[data-block="PLAT"]',el)?.classList.add('approach');$('[data-block="SIDE"]',el)?.classList.add('approach');const chosen=priority==='passenger'?'PLAT':'SIDE';if(busy)$(`[data-block="${chosen}"]`,el)?.classList.add('occupied');if(lockBox.checked)$(`[data-block="${chosen}"]`,el)?.classList.add('locked')}else{const key=p.dynamic&&cfg.a==='反位'?'SIDE':active===1?'PLAT':'1DG';$(`[data-block="${key}"]`,el)?.classList.add(busy?'occupied':'approach');if(lockBox.checked)$(`[data-block="${key}"]`,el)?.classList.add('locked')}}if(closed)$('[data-block="2DG"]',el)?.classList.add('closed')};
  const refreshLive=()=>{
    if(!el.isConnected){clearInterval(clockTimer);return}
    $('[data-simclock]',el).textContent=simTime();
    const current=state.trainStep;
    const cLeft=closureLeft();closed=current===2&&cLeft>0;
    const cs=$('[data-closure]',el);cs.textContent=closed?`2DG：施工封锁 ${Math.ceil(cLeft)}s`:'2DG：正常';cs.classList.toggle('closed',closed);
    runPlans.forEach((p,i)=>{const row=$(`[data-live="${i}"]`,el),dist=$('[data-livedist]',row),bar=$('[data-livebar]',row);row.classList.remove('active','done','stopped','future');if(i<current||state.trainDone){row.classList.add('done');dist.textContent='已通过';bar.style.width='100%';return}const left=p.eta-nowSec();if(i===current){row.classList.add('active');if(p.meet&&!busy&&left>0){dist.textContent=`两车接近 · ${Math.max(0,Math.ceil(left))}s`;bar.style.width=`${Math.max(8,clamp(1-left/p.eta,0,1)*100)}%`}else if(left<=0&&!busy){runtime.stopped[i]=true;runtime.late[i]=Math.floor(-left);row.classList.add('stopped');dist.textContent=`机外停车 +${runtime.late[i]}s`;bar.style.width='100%';if(!runtime.recorded[i]){runtime.recorded[i]=true;log(`${p.id}：未及时建立进路，列车已在机外停车。联锁系统保持安全，可继续处理。`);beep(265,.12,.018)}}else if(busy){dist.textContent='通过中';bar.style.width='100%'}else{const total=Math.max(8,p.eta-(i?runPlans[i-1].eta:0));const localLeft=Math.max(0,left);const progress=clamp(1-localLeft/Math.max(1,p.eta),0,1);const metres=Math.max(90,Math.round((1-progress)*1500/10)*10);dist.textContent=`距信号约 ${metres} m`;bar.style.width=`${Math.max(4,progress*100)}%`;loadThree().then(m=>m?.setRailApproach?.(stage,progress)).catch(()=>{});if(left<9&&left>0&&lastWarn!==i){lastWarn=i;beep(520,.07,.012);setTimeout(()=>beep(520,.07,.012),110)}}}else{row.classList.add('future');dist.textContent=left>0?`预计 ${Math.ceil(left)}s 后到达`:'等待前车处理';bar.style.width=`${clamp((1-Math.max(0,left)/p.eta)*100,0,96)}%`}});
    updateBlocks();loadThree().then(m=>m?.setRailClosure?.(stage,closed)).catch(()=>{});
  };
  runBtn.onclick=async()=>{
    if(busy)return;if(state.trainDone){log('全部训练已完成。');return}
    const p=runPlans[state.trainStep],lock=$('[data-lock]',el).checked,route=routeCheck(p,lock);
    if(route.ok){busy=true;runBtn.disabled=true;if(runtime.stopped[state.trainStep]){const late=Math.max(1,runtime.late[state.trainStep]);state.trainStops++;state.trainDelay+=late;log(`${p.id}：进路建立，机外停车后恢复运行；本次晚点 ${late} 秒。`)}else log(`${p.id}：进路检查通过。信号开放。`);if(p.dynamic&&route.key==='side')log('调度决策：避开 2DG 施工封锁，经侧线锁闭通过。');if(p.meet){const penalty=route.key==='passenger'?18:31;state.trainDelay+=penalty;log(route.key==='passenger'?`交会决策：K712 先行；4312 侧线外等待 ${penalty} 秒。`:`交会决策：4312 先行；K712 站外短停 ${penalty} 秒。`)}$('[data-signal]',el).textContent='开放';$('[data-map-signal]',el)?.classList.add('open');loadThree().then(m=>m?.setRailSignal?.(stage,true)).catch(()=>{});updateBlocks();try{await runTrainScene(el,state.trainStep);if(p.meet){await new Promise(r=>setTimeout(r,360));log(route.key==='passenger'?'4312 获准随后进入侧线。':'K712 获准随后进站。');await runTrainScene(el,state.trainStep)}runtime.done[state.trainStep]=true;state.trainStep++;state.trainFails=0;if(state.trainStep<runPlans.length)phaseEntered[state.trainStep]=performance.now();syncMeetPanel();if(state.trainStep>=runPlans.length){state.trainDone=true;addEvidence('train_credentials','训练历史：操作员 LSY / 职工号 0712');log('训练完成。成绩记录与操作员档案已解锁。');$('[data-history]',el).disabled=false;assist.disabled=true}else{$$('[data-runrow]',el).forEach((r,i)=>r.classList.toggle('current',i===state.trainStep));log(`下一车次已进入调度窗口：${runPlans[state.trainStep].id}。`)}}finally{$('[data-signal]',el).textContent='关闭';$('[data-map-signal]',el)?.classList.remove('open');loadThree().then(m=>m?.setRailSignal?.(stage,false)).catch(()=>{});busy=false;runBtn.disabled=false;save();updateWorld();refreshLive()}}
    else{state.trainFails++;state.trainErrors++;save();log(`联锁拒绝：${route.reason} 当前 1#${cfg.a} / 2#${cfg.b} / 锁闭${lock?'是':'否'}。`);beep(190,.09,.015);unlockAssist();if(state.trainFails===3)log('培训系统：连续三次未通过，可点击“演示当前一步”。演示只摆好一条当前可用进路，仍需你亲自开放信号。')}
  };
  $('[data-demo]',el).onclick=()=>toast('操作说明','列车会按压缩训练时钟持续接近。先看运行表和区间状态，再设置1#、2#道岔与锁闭并开放信号。来不及不会失败，只会机外停车并记录晚点；第三阶段的施工封锁既可以等待解除，也可以尝试另建不冲突进路。',7600);
  assist.onclick=()=>{if(assist.disabled||state.trainDone)return;const p=runPlans[state.trainStep];if(p.meet)priority='passenger';let r=routeVariants(p)[0];if(p.dynamic&&closureLeft()<=0)r=routeVariants(p)[1];setLever('a',r.a);setLever('b',r.b);lockBox.checked=r.lock;syncRailVisual();syncMeetPanel();log(`演示：第 ${state.trainStep+1} 项已摆好一条当前可用进路。请自己点击“建立进路并开放信号”完成最后一步。`);beep(330,.08,.015)};
  $('[data-history]',el).onclick=()=>openTrainHistory(); if($('[data-replay]',el))$('[data-replay]',el).onclick=()=>openReplay(el);
  loadThree().then(mod=>{if(el.isConnected){mod?.mountRailScene?.(stage);mod?.setRailRoute?.(stage,{...cfg,lock:lockBox.checked});mod?.setRailSignal?.(stage,false);refreshLive()}}).catch(()=>{});
  clockTimer=setInterval(refreshLive,500);refreshLive();
  const oldClose=$('.win-controls [data-act="close"]',el).onclick;$('.win-controls [data-act="close"]',el).onclick=()=>{clearInterval(clockTimer);oldClose?.()};
}
async function runTrainScene(el,idx){playAudio('switch_motor.wav',.12);playAudio('relay.wav',.18);playAudio('train_pass.wav',.19);beep(155,.07,.014);setTimeout(()=>beep(230,.08,.011),120);const fb=$('.fallback-rail',el);fb?.classList.remove('passing');void fb?.offsetWidth;fb?.classList.add('passing');loadThree().then(m=>m?.playRailTrain?.($('[data-three]',el),idx)).catch(()=>{});await new Promise(r=>setTimeout(r,900))}
function openTrainHistory(){
  if(!state.trainDone)return;const delay=Number(state.trainDelay)||0,mm=String(Math.floor(delay/60)).padStart(2,'0'),ss=String(delay%60).padStart(2,'0');const body=`<div class="mainpane"><h3>训练历史 / 操作员资料</h3><div class="training-report"><div>樟城铁路分局 · 区间调度训练系统</div><hr><div class="report-grid"><span>训练任务</span><b>TR-04</b><span>安全违章</span><b>0</b><span>进路冲突/拒绝</span><b>${state.trainErrors||0}</b><span>机外停车</span><b>${state.trainStops||0}</b><span>累计晚点</span><b>${mm}:${ss}</b><span>考核结果</span><b>合格</b></div><hr><div class="report-grid credentials"><span>操作员</span><b>LSY</b><span>职工号</span><b>0712</b></div></div><table class="file-list"><tr><th>姓名</th><td>林守义</td></tr><tr><th>最近成绩</th><td>2003-10-11 · 合格</td></tr><tr><th>历史资料卷</th><td>1993 / 1994 / 2004</td></tr></table><div class="system-note"><b>训练记录</b><span>操作员档案可供同机离线卷验证使用。口令规则请以影像库“帮助”为准。</span></div></div>`;makeWindow({id:'trainhistory',title:'训练历史',icon:'train',w:660,h:560,body,status:'OPERATOR.DAT / PRINT PREVIEW'});addEvidence('operator','操作员代号 LSY，职工号 0712');
}
function openReplay(el){toast('历史回放','1993-07-12：儿童安全演练标记 1/6…6/6。远端指示器未注册。');setTimeout(()=>{if(!el?.isConnected)return;Promise.resolve(sceneModules).then(m=>m?.flashSeventhLamp?.($('[data-three]',el))).catch(()=>{});if(!state.sevenLamp){state.sevenLamp=true;save();toast('历史回放','远处一盏未登记的小灯亮了一下，又灭了。没有任何条目与它对应。',7000)}},20000)}

function login1Body(){return `<div class="login-panel"><div class="login-head">樟城铁路宣传影像离线库 2.1</div><form class="login-main" data-loginform onsubmit="return false"><div>离线卷：<b>1993</b> · 状态：已装载 / 需要操作员验证</div><div class="login-row"><label>用户名</label><input data-user autocomplete="off"></div><div class="login-row"><label>密码</label><input data-pass type="password" autocomplete="current-password"></div><div class="error-text" data-error></div><div class="login-actions"><button class="sys-btn" type="button" data-login>登录</button></div><div class="helpbox"><b>帮助</b><br>离线卷默认口令 = 职工号后四位 + 资料年度后两位。操作员代号与职工号请查看训练记录。<br>示例：职工号 1234 / 1998卷 → 123498。</div></form></div>`}
function openArchiveLogin(){if(state.login1){openArchive();return}const el=makeWindow({id:'login1',title:'宣传影像离线库 - 登录',icon:'archive',w:650,h:480,body:login1Body(),status:'OFFLINE_VOL 1993'});let fail=0;$('[data-login]',el).onclick=()=>{const u=$('[data-user]',el).value.trim().toUpperCase(),p=$('[data-pass]',el).value.trim();if(u==='LSY'&&p==='071293'){state.login1=true;save();addEvidence('login1','第一次登录完成：LSY / 071293');el.remove();$(`.task-window-button[data-for="login1"]`)?.remove();openArchive();updateWorld()}else{fail++;$('[data-error]',el).textContent=fail>=2?'验证失败。请查看训练记录与“离线卷帮助”。':'操作员或口令不正确。'}}}
function openArchive(){
  const files=[['production_contact','E01_摄制联系单.scan','正式六人 / 卷别B'],['cast_list','E02_儿童临演名单.scan','六人姓名'],['script_note','E03_场记_B03.scan','镜号 / 尾位边注']];
  const body=`<div class="split"><aside class="sidepane"><h4>OFFLINE_VOL 1993</h4><a data-media="film">35mm 接触表 A/B/C</a><a data-media="vhs">母带索引 / T01-T03</a><a data-mail-summary>杨元成2019附件摘要</a><h4>卷状态</h4><div>只读 · 校验通过</div><div>操作员：LSY</div></aside><div class="mainpane"><table class="file-list"><thead><tr><th>文件</th><th>说明</th></tr></thead><tbody>${files.map(([id,n,desc])=>`<tr data-doc="${id}"><td><span class="file-chip"><img src="${ICON('docs')}">${n}</span></td><td>${desc}</td></tr>`).join('')}</tbody></table><div class="system-note"><b>卷索引说明</b><span>接触表与母带均为连续原始材料。卷内建议顺序：接触表 → 同镜号母带。</span></div></div></div>`;
  const el=makeWindow({id:'archive1',title:'樟城铁路宣传影像离线库 2.1',icon:'archive',w:900,h:610,body,status:'OFFLINE_VOL 1993 · 只读'});$$('[data-doc]',el).forEach(r=>r.ondblclick=()=>openScan(r.dataset.doc));$('[data-media="film"]',el).onclick=openFilm;$('[data-media="vhs"]',el).onclick=openVHS;$('[data-mail-summary]',el).onclick=openMailSummary;
}
function openMailSummary(){
  addEvidence('yang_summary','杨元成2019附件摘要','他记得一个背蓝白书包、没在名单里的孩子一直站在边上看');setTimeout(checkIdentity,0);
  const body=`<div class="mail-view"><div class="mail-header">From: yangyc_archive<br>To: linshouyi<br>Date: 2019-11-18 09:14<br>Subject: 那盘B卷我翻出来了</div><div class="mail-body"><p>林师傅，先给你一句准话：小孩我有印象，没在名单里。背个蓝白书包，一直站边上看。</p><p>你问我他什么时候进队的，我记不死。最后一条我们都忙着收设备，谁也没再点名。</p><p>接触印样和母带索引我一起寄，你自己对。B卷最后用的是 <b>B-03</b>。</p><p>还有一句，我记得那孩子开拍前问过：“拍完能不能上车里看一下？”</p><span class="attachment">附件摘要：B-03 / Contact_Print / Tape_T03</span></div></div>`;makeWindow({id:'mail_summary',title:'附件摘要 - 杨元成 2019',icon:'mail',w:690,h:500,body,status:'EML 摘要 / 只读'});
}
function openMediaHub(){if(!state.login1){openArchiveLogin();return}const body=`<div class="mainpane"><h3>1993 / B卷检查工具</h3><table class="file-list"><tr data-open-film><td><span class="file-chip"><img src="${ICON('film')}">35mm 接触表光台</span></td><td>${state.filmDone?'B卷扫描已排回原顺序':'3张扫描次序未知'}</td></tr><tr data-open-vhs><td><span class="file-chip"><img src="${ICON('media')}">VHS 母带机</span></td><td>${state.vhsBookmarks.length?`${state.vhsBookmarks.length} 个帧书签`:'T01 / T02 / T03'}</td></tr></table><div class="system-note"><b>卷内工具</b><span>光台保存接触表顺序；母带机只保存时间码、书签和声道状态。</span></div></div>`;const el=makeWindow({id:'mediahub',title:'影像检查台',icon:'media',w:720,h:450,body,status:'B卷 / 两种介质'});$('[data-open-film]',el).ondblclick=openFilm;$('[data-open-vhs]',el).ondblclick=openVHS;}

function openFilm(){
  const unsolved=[
    {id:'c',img:'contact_c.webp',edge:'04843–04848'},
    {id:'a',img:'contact_a.webp',edge:'04831–04836'},
    {id:'b',img:'contact_b.webp',edge:'04837–04842'}
  ];
  const cards=state.filmDone?[unsolved[1],unsolved[2],unsolved[0]]:unsolved;
  const finalButton=state.filmDone?'<button class="tool-btn" data-final-print>查看最终接触印样</button>':'';
  const body=`<div class="film-app"><div class="light-toolbar"><button class="tool-btn" data-check>核对连续性</button><button class="tool-btn" data-mag>放大镜：关</button><button class="tool-btn" data-slant>斜光：关</button>${finalButton}<span style="margin-left:auto;font-size:11px">35mm / ROLL B / T03 · 三张扫描次序已丢失</span></div><div class="light-surface"><div class="film-slot-label">不要按文件名猜顺序。检查每张原件底部的胶片边码，让号码与曝光变化连续。</div><div class="film-strips">${cards.map(x=>`<div class="film-card" draggable="true" data-id="${x.id}"><img src="${FILM(x.img)}" alt="B卷T03接触表扫描"><div class="film-code"><span>ROLL B / T03 · CONTACT SHEET</span><span>边码位于扫描件底边</span></div></div>`).join('')}</div></div><div class="light-footer"><span data-film-status>${state.filmDone?'边码已连续；最终印样已经可以打开。':'三张扫描尚未归位'}</span><span>光台 / 放大镜 / 斜光可用</span></div></div><div class="magnifier"></div>`;
  const el=makeWindow({id:'film',title:'35mm 胶片光台复原',icon:'film',w:1080,h:680,body,menu:false,status:'ROLL B / T03 · CONTACT SHEETS'});
  const strips=$('.film-strips',el);let drag=null,mag=false,slant=false;
  $$('.film-card',el).forEach(c=>{c.ondragstart=()=>{drag=c;c.classList.add('dragging')};c.ondragend=()=>{c.classList.remove('dragging');drag=null};c.ondragover=e=>{e.preventDefault();const box=c.getBoundingClientRect();if(drag&&drag!==c)strips.insertBefore(drag,e.clientX<box.left+box.width/2?c:c.nextSibling)}});
  const openPrint=()=>{
    let markMode=true,z=false;
    const w=makeWindow({id:'final_print',title:'最终接触印样 / T03',icon:'film',w:930,h:680,menu:false,status:'ROLL B / T03 / FINAL CONTACT PRINT',body:`<div class="scan-tools"><button class="tool-btn on" data-mark-mode>人数标记：开</button><button class="tool-btn" data-clear-marks>清除标记</button><button class="tool-btn" data-print-zoom>局部放大</button><button class="tool-btn" data-save-observation>保存人工核对</button><span class="archive-ruler">FRAME 04846 · FINAL CONTACT PRINT</span></div><div class="scan-view final-print-view"><figure class="scan-frame"><div class="film-observation-stage" data-observe><img src="${FILM('final_print.webp')}" alt="最终接触印样"><div class="film-mark-layer" data-marklayer></div></div><figcaption class="scan-caption"><span>B卷 T03 最终接触印样</span><span data-mark-count>铅笔记号 ${state.filmMarks.length} 处</span></figcaption></figure></div><div class="observation-note" data-observe-note>${has('film7')?'这张印样已经留过记号。':'需要时可以在印样上留铅笔记号。名单原件可另开窗口放在旁边。'}</div>`});
    bindEvidenceDock(w);
    const stage=$('[data-observe]',w),layer=$('[data-marklayer]',w),img=$('.film-observation-stage img',w);
    const renderMarks=()=>{layer.innerHTML=state.filmMarks.map((m,i)=>`<span class="film-person-mark" style="left:${m.x*100}%;top:${m.y*100}%">${i+1}</span>`).join('');$('[data-mark-count]',w).textContent=`铅笔记号 ${state.filmMarks.length} 处`;};
    renderMarks();
    $('[data-mark-mode]',w).onclick=()=>{markMode=!markMode;$('[data-mark-mode]',w).classList.toggle('on',markMode);$('[data-mark-mode]',w).textContent=`人数标记：${markMode?'开':'关'}`};
    $('[data-clear-marks]',w).onclick=()=>{state.filmMarks=[];save();renderMarks();$('[data-observe-note]',w).textContent='记号已擦掉。'};
    stage.onclick=e=>{if(!markMode||e.target.closest('.film-person-mark'))return;if(state.filmMarks.length>=9){toast('人工标记','最多保留9个观察点。');return}const r=stage.getBoundingClientRect(),x=clamp((e.clientX-r.left)/r.width,0,1),y=clamp((e.clientY-r.top)/r.height,0,1);if(state.filmMarks.some(m=>Math.hypot((m.x-x)*r.width,(m.y-y)*r.height)<28))return;state.filmMarks.push({x:+x.toFixed(4),y:+y.toFixed(4)});save();renderMarks();playAudio('film_click.wav',.07)};
    $('[data-print-zoom]',w).onclick=()=>{z=!z;img.style.width=z?'165%':'100%';$('[data-print-zoom]',w).textContent=z?'恢复整张':'局部放大'};
    $('[data-save-observation]',w).onclick=()=>{const n=state.filmMarks.length;if(!has('six')){$('[data-observe-note]',w).textContent='名单原件还没打开过。先把那张表找出来。';return}if(n===7&&filmMarksValid(state.filmMarks)){addEvidence('film7','B卷 T03 接触印样：七个铅笔记号','正式名单是六人');$('[data-observe-note]',w).textContent='记号保存。把名单放在旁边看，数量对不上。';checkMediaCross();updateWorld()}else if(n===7){$('[data-observe-note]',w).textContent='有几个记号落在画面空处或没有贴住人物轮廓。擦掉后再标。'}else{$('[data-observe-note]',w).textContent=`现在有 ${n} 个记号。`}};
    return w
  };
  const bindPrint=()=>{const b=$('[data-final-print]',el);if(b)b.onclick=openPrint};bindPrint();
  $('[data-check]',el).onclick=()=>{const order=$$('.film-card',el).map(x=>x.dataset.id).join('');if(order==='abc'){state.filmDone=true;state.filmFails=0;save();addEvidence('film_sequence','B卷接触表：04831—04848 连续');addEvidence('roll_b03','胶片卷标 B-03');$('[data-film-status]',el).textContent='04831 → 04848。三张扫描首尾接上了；最终印样可打开。';if(!$('[data-final-print]',el)){const b=document.createElement('button');b.className='tool-btn';b.dataset.finalPrint='1';b.textContent='查看最终接触印样';b.onclick=openPrint;$('.light-toolbar',el).insertBefore(b,$('.light-toolbar span',el))}playAudio('film_click.wav',.12);updateWorld()}else{state.filmFails++;save();$('[data-film-status]',el).textContent=state.filmFails>=2?'仍有断号。打开斜光与放大镜，从三张扫描底边找 048xx 边码；相邻两张应首尾相接。':'连续性未通过。文件名已经失去次序，应该依据原件边码而不是画面构图。'} };
  $('[data-mag]',el).onclick=()=>{mag=!mag;$('[data-mag]',el).textContent=`放大镜：${mag?'开':'关'}`;$('.magnifier',el).style.display=mag?'block':'none';playAudio('film_click.wav',.11);beep(620,.035,.006)};
  $('.light-surface',el).onmousemove=e=>{if(!mag)return;const m=$('.magnifier',el);m.style.left=`${e.clientX-95}px`;m.style.top=`${e.clientY-95}px`;const img=e.target.closest?.('.film-card img');if(img){const r=img.getBoundingClientRect(),rx=clamp((e.clientX-r.left)/r.width,0,1),ry=clamp((e.clientY-r.top)/r.height,0,1);m.style.backgroundImage=`url('${img.src}')`;m.style.backgroundSize=`${r.width*2.35}px ${r.height*2.35}px`;m.style.backgroundPosition=`${rx*100}% ${ry*100}%`;m.style.backgroundRepeat='no-repeat'}};
  $('[data-slant]',el).onclick=()=>{slant=!slant;$('[data-slant]',el).textContent=`斜光：${slant?'开':'关'}`;$('.light-surface',el).classList.toggle('slant-on',slant);playAudio('lightbox.wav',.085);playAudio('film_click.wav',.06);beep(180,.045,.006)};
  loadThree().then(m=>{if(el.isConnected)m?.enhanceLightTable?.($('.light-surface',el))}).catch(()=>{});
}

function openVHS(){
  const DURATION=66, cuts={t1:20,t2:38,criticalA:46.8,criticalB:50.6,loopA:42,loopB:55};
  let fxRaf=0,syncRaf=0,selectedBook=state.vhsBookmarks.length?state.vhsBookmarks.length-1:-1;
  const body=`<div class="vhs-app"><section class="vhs-main"><div class="vhs-screen"><div class="vhs-timecode" data-time>00:00:00:00</div><video data-video muted playsinline preload="auto" aria-label="1993 B卷连续母带"><source src="${FILM('vhs_master.mp4')}" type="video/mp4"></video><canvas class="vhs-noise" data-vhsfx width="960" height="540" aria-hidden="true"></canvas><div class="vhs-mark-layer" data-vhsmarklayer></div><div class="vhs-head-status"><span data-head>HEAD A</span><span data-chlabel>STEREO</span></div></div><div class="vhs-controls"><button class="vhs-btn" data-play>▶</button><input type="range" data-seek min="0" max="${DURATION}" step="0.04" value="0"><span data-time2>00:00:00</span><button class="vhs-btn" data-prev>← 1帧</button><button class="vhs-btn" data-next>1帧 →</button><button class="vhs-btn" data-book>保存帧书签</button><button class="vhs-btn" data-mark-vhs>画面记号：关</button><button class="vhs-btn" data-loop>循环队尾镜：关</button><span class="vhs-speed">速度 <button class="vhs-btn" data-rate="0.25">0.25×</button><button class="vhs-btn" data-rate="0.5">0.5×</button><button class="vhs-btn on" data-rate="1">1×</button></span><span class="vhs-speed">画面 <button class="vhs-btn on" data-zoom="1">1×</button><button class="vhs-btn" data-zoom="1.5">1.5×</button><button class="vhs-btn" data-zoom="2">2×</button></span></div></section><aside class="vhs-side"><h3>镜头索引</h3><div class="camera-row"><button class="vhs-btn on" data-cam="1">T01 正面</button><button class="vhs-btn" data-cam="2">T02 侧面</button><button class="vhs-btn" data-cam="3">T03 队尾</button></div><h3>监听声道</h3><div class="channel-row"><button class="vhs-btn" data-ch="L">L</button><button class="vhs-btn" data-ch="R">R</button><button class="vhs-btn on" data-ch="S">Stereo</button></div><div class="waveform"><canvas data-wave width="260" height="86"></canvas></div><button class="vhs-btn" data-caption>听写辅助：关</button><div class="transcript" data-trans>母带底噪。远处有列车与工作人员口令；听写辅助不会标异常。</div><h3>参考材料</h3><button class="vhs-reference" data-open-cast><img src="${SCAN('cast_list.webp')}" alt="正式临演名单扫描缩略图"><span>正式临演名单扫描件<br><small>点击打开原件并自行核对</small></span></button><h3>帧书签（最多3个）</h3><div class="bookmark-list" data-bookmarks></div><button class="vhs-btn compare-bookmark" data-compare-book>${state.vhs7?'已写入书签备注':'写入书签备注'}</button><div class="system-note"><b>母带机备注</b><span>书签只记时间码；画面记号只记位置，不会识别人。</span></div></aside></div>`;
  let playing=false,ch='S',caption=false,rate=1,loop=false,zoom=1,markMode=false,vhsThree=null,t=0,tapeAudio=null,audioCtx=null,splitter=null,merger=null,gainL=null,gainR=null,sourceNode=null;
  const el=makeWindow({id:'vhs',title:'VHS 影像分析台 - B卷母带',icon:'media',w:1080,h:710,body,menu:false,status:`Tape_B / ${DURATION}s / 25fps / PCM 2ch`,onClose:()=>{cancelAnimationFrame(fxRaf);cancelAnimationFrame(syncRaf);try{video.pause()}catch{}try{tapeAudio?.pause()}catch{}try{audioCtx?.close()}catch{}if(tapeAudio)activeAudio.delete(tapeAudio)}});
  const fx=$('[data-vhsfx]',el),fxc=fx.getContext('2d',{alpha:true}),video=$('[data-video]',el),seek=$('[data-seek]',el),reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const camFor=x=>x<cuts.t1?1:x<cuts.t2?2:3;
  const tc=x=>{x=Math.max(0,Math.min(DURATION,x));const sec=Math.floor(x),f=Math.min(24,Math.floor((x-sec)*25+1e-6));return `00:00:${String(sec).padStart(2,'0')}:${String(f).padStart(2,'0')}`};
  function initTapeAudio(){
    if(tapeAudio||state.audioMuted)return;
    try{
      tapeAudio=new Audio(AUDIO('vhs_channels.ogg'));tapeAudio.preload='auto';activeAudio.add(tapeAudio);tapeAudio.onended=()=>activeAudio.delete(tapeAudio);
      audioCtx=new (window.AudioContext||window.webkitAudioContext)();sourceNode=audioCtx.createMediaElementSource(tapeAudio);splitter=audioCtx.createChannelSplitter(2);merger=audioCtx.createChannelMerger(2);gainL=audioCtx.createGain();gainR=audioCtx.createGain();sourceNode.connect(splitter);splitter.connect(gainL,0);splitter.connect(gainR,1);gainL.connect(merger,0,0);gainR.connect(merger,0,1);merger.connect(audioCtx.destination);applyChannel();
    }catch(e){console.warn('VHS channel audio unavailable',e);tapeAudio=null}
  }
  function applyChannel(){if(!gainL||!gainR)return;gainL.gain.value=ch==='R'?0:1;gainR.gain.value=ch==='L'?0:1;if(tapeAudio)tapeAudio.muted=!!state.audioMuted;$('[data-chlabel]',el).textContent=ch==='S'?'STEREO':`${ch} CH ONLY`}
  function drawVhsFx(ts=0){const w=fx.width,h=fx.height;fxc.clearRect(0,0,w,h);if(!reducedMotion){fxc.globalAlpha=.13;for(let y=(ts/22)%6;y<h;y+=6){fxc.fillStyle='rgba(235,240,225,.18)';fxc.fillRect(0,y,w,1)}const band=(ts*.045)%h;fxc.fillStyle='rgba(210,220,205,.065)';fxc.fillRect(0,band,w,13);fxc.globalAlpha=.10;for(let i=0;i<18;i++){const x=((i*173+ts*.31)%w)|0,y=((i*97+ts*.17)%h)|0;fxc.fillStyle=i%3?'#d8d8cd':'#748078';fxc.fillRect(x,y,(i%4)+1,1)}if(playing&&Math.floor(ts/800)%7===0){fxc.globalAlpha=.15;fxc.fillStyle='#e8e6d8';fxc.fillRect(0,h*.84,w,2)}}fxc.globalAlpha=1;fxRaf=requestAnimationFrame(drawVhsFx)}
  fxRaf=requestAnimationFrame(drawVhsFx);
  function drawWave(){const c=$('[data-wave]',el),ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle='#080a09';ctx.fillRect(0,0,c.width,c.height);ctx.strokeStyle='#77b476';ctx.beginPath();for(let x=0;x<c.width;x++){const tt=x/c.width*DURATION;let amp=10+7*Math.sin(x*.21)+4*Math.sin(x*.49);if(ch!=='L'&&tt>=46.1&&tt<=49.6)amp+=24*Math.sin((tt-46.1)/3.5*Math.PI);const y=43+Math.sin(x*.72)*amp*.45;x?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.stroke();ctx.strokeStyle='#d6ce8c';const px=t/DURATION*c.width;ctx.beginPath();ctx.moveTo(px,0);ctx.lineTo(px,c.height);ctx.stroke()}
  function update({seekVideo=true}={}){t=clamp(t,0,DURATION);seek.value=t;$('[data-time]',el).textContent=tc(t);$('[data-time2]',el).textContent=tc(t).slice(3,11);if(seekVideo&&Math.abs((video.currentTime||0)-t)>.022){try{video.currentTime=t}catch{}}const cam=camFor(t);$$('[data-cam]',el).forEach(b=>b.classList.toggle('on',+b.dataset.cam===cam));$('[data-head]',el).textContent=cam===3&&t>50?'HEAD B':'HEAD A';const jitter=reducedMotion?0:1;video.style.transform=`translate(${Math.sin(t*2.4)*1.0*jitter}px,${Math.sin(t*3.3)*.55*jitter}px) scale(${zoom*(1.004+Math.sin(t*.7)*.0012*jitter)})`;const tr=$('[data-trans]',el);if(caption){tr.textContent=cam===3&&ch==='R'&&t>=46.1&&t<=49.6?'[右声道听写] 工作人员数到“六”后，约半秒还有一小段童声声部；底噪太重，无法可靠辨词。':'[听写辅助] 只转写能听清的环境声与工作人员口令；没有异常标签。'}else tr.textContent='母带底噪。远处有列车与工作人员口令；听写辅助不会标异常。';drawWave();vhsThree?.setVHSState?.($('.vhs-screen',el),{t,cam,ch,playing,rate})}
  function syncLoop(){if(!el.isConnected)return;if(playing){t=video.currentTime||t;if(loop&&t>=cuts.loopB){t=cuts.loopA;video.currentTime=t;if(tapeAudio)tapeAudio.currentTime=t}if(t>=DURATION-.02){playing=false;video.pause();t=DURATION;if(tapeAudio)tapeAudio.pause();$('[data-play]',el).textContent='▶'}else if(tapeAudio&&!state.audioMuted){if(Math.abs((tapeAudio.currentTime||0)-t)>.16)tapeAudio.currentTime=t;tapeAudio.playbackRate=rate}update({seekVideo:false})}syncRaf=requestAnimationFrame(syncLoop)}
  syncRaf=requestAnimationFrame(syncLoop);
  video.addEventListener('loadedmetadata',()=>{seek.max=Math.min(DURATION,video.duration||DURATION);video.currentTime=t});
  function seekTo(x){t=clamp(x,0,DURATION);video.currentTime=t;if(tapeAudio)tapeAudio.currentTime=t;update({seekVideo:false})}
  function setCam(n){seekTo(n===1?7:n===2?28:39.4)}
  $$('[data-cam]',el).forEach(b=>b.onclick=()=>setCam(+b.dataset.cam));
  $$('[data-ch]',el).forEach(b=>b.onclick=()=>{ch=b.dataset.ch;if(ch==='R'){state.vhsHeardR=true;save();}$$('[data-ch]',el).forEach(x=>x.classList.toggle('on',x===b));initTapeAudio();applyChannel();update({seekVideo:false})});
  $$('[data-rate]',el).forEach(b=>b.onclick=()=>{rate=+b.dataset.rate;video.playbackRate=rate;if(tapeAudio)tapeAudio.playbackRate=rate;$$('[data-rate]',el).forEach(x=>x.classList.toggle('on',x===b))});
  $$('[data-zoom]',el).forEach(b=>b.onclick=()=>{zoom=+b.dataset.zoom;$$('[data-zoom]',el).forEach(x=>x.classList.toggle('on',x===b));update({seekVideo:false})});
  $('[data-loop]',el).onclick=()=>{loop=!loop;$('[data-loop]',el).textContent=`循环队尾镜：${loop?'开':'关'}`;if(loop)seekTo(cuts.loopA)};
  $('[data-open-cast]',el).onclick=()=>openScan('cast_list');
  seek.oninput=()=>seekTo(+seek.value);
  $('[data-prev]',el).onclick=()=>{video.pause();playing=false;if(tapeAudio)tapeAudio.pause();$('[data-play]',el).textContent='▶';seekTo(t-.04)};
  $('[data-next]',el).onclick=()=>{video.pause();playing=false;if(tapeAudio)tapeAudio.pause();$('[data-play]',el).textContent='▶';seekTo(t+.04)};
  $('[data-play]',el).onclick=async()=>{playing=!playing;$('[data-play]',el).textContent=playing?'Ⅱ':'▶';if(playing){initTapeAudio();if(audioCtx?.state==='suspended')await audioCtx.resume().catch(()=>{});video.currentTime=t;video.playbackRate=rate;try{await video.play()}catch{playing=false;$('[data-play]',el).textContent='▶';toast('母带机','浏览器阻止了媒体播放。请再次点击播放。');return}if(tapeAudio&&!state.audioMuted){tapeAudio.currentTime=t;tapeAudio.playbackRate=rate;applyChannel();tapeAudio.play().catch(()=>{})}}else{video.pause();if(tapeAudio)tapeAudio.pause()}};
  $('[data-book]',el).onclick=()=>{if(state.vhsBookmarks.length>=3){toast('帧书签','最多保存3个；可以删除存档后重做，或直接复核已有书签。');return}const cam=camFor(t),b={t:+t.toFixed(2),cam,ch};state.vhsBookmarks.push(b);selectedBook=state.vhsBookmarks.length-1;save();renderBookmarks();$('[data-trans]',el).textContent='书签已保存。现在打开正式名单，把这帧与原始记录并排核对。';update({seekVideo:false})};
  const vhsScreen=$('.vhs-screen',el),vhsMarkLayer=$('[data-vhsmarklayer]',el);
  const renderVhsMark=()=>{vhsMarkLayer.innerHTML=state.vhsMark?`<span class="vhs-point-mark" style="left:${state.vhsMark.x*100}%;top:${state.vhsMark.y*100}%">×</span>`:''};renderVhsMark();
  $('[data-mark-vhs]',el).onclick=()=>{markMode=!markMode;$('[data-mark-vhs]',el).classList.toggle('on',markMode);vhsScreen.classList.toggle('marking',markMode);$('[data-mark-vhs]',el).textContent=`画面记号：${markMode?'开':'关'}`;if(markMode&&playing)$('[data-play]',el).click()};
  vhsScreen.addEventListener('click',e=>{if(!markMode||e.target.closest('button,input'))return;const r=vhsScreen.getBoundingClientRect();state.vhsMark={x:+clamp((e.clientX-r.left)/r.width,0,1).toFixed(4),y:+clamp((e.clientY-r.top)/r.height,0,1).toFixed(4),t:+t.toFixed(2),cam:camFor(t)};save();renderVhsMark();$('[data-trans]',el).textContent='画面位置已经记下。'});
  $('[data-compare-book]',el).onclick=()=>{if(state.vhs7){$('[data-trans]',el).textContent='这个书签已经写过备注。';return}if(selectedBook<0||!state.vhsBookmarks[selectedBook]){toast('帧书签','先留一个帧书签。');return}if(!has('six')){$('[data-trans]',el).textContent='正式临演名单还没打开过。';return}const b=state.vhsBookmarks[selectedBook];state.vhsCompareT=b.t;save();const rightFrame=b.cam===3&&b.t>=cuts.criticalA&&b.t<=cuts.criticalB;if(rightFrame&&vhsMarkValid(state.vhsMark,b.t)){state.vhs7=true;save();addEvidence('vhs7','T03 帧书签：队尾多出一个人','书签时间码和画面记号均已保存');if(state.vhsHeardR&&b.t>=46.1&&b.t<=49.6)addEvidence('voice7','T03 右声道：数到六以后还有一段较轻的童声');$('[data-compare-book]',el).textContent='已写入书签备注';$('[data-trans]',el).textContent='备注保存：这一帧的队尾位置和六人名单对不上。';checkMediaCross();updateWorld()}else if(rightFrame){$('[data-trans]',el).textContent='这张书签的时间码合适，但画面记号不是在这张书签附近留下的，或没有落在队尾多出来的人身上。回到这一帧重新标。'}else{$('[data-trans]',el).textContent='这张书签里还看不清人数差异。T03从头慢放一遍。'}};
  $('[data-caption]',el).onclick=()=>{caption=!caption;$('[data-caption]',el).textContent=`听写辅助：${caption?'开':'关'}`;update({seekVideo:false})};
  function renderBookmarks(){$('[data-bookmarks]',el).innerHTML=state.vhsBookmarks.map((b,i)=>`<button class="bookmark ${i===selectedBook?'selected':''}" data-jump="${i}">#${i+1} T0${b.cam} / ${tc(+b.t)} / ${b.ch||'S'}</button>`).join('')||'<div class="bookmark">尚未保存</div>';$$('[data-jump]',el).forEach(btn=>btn.onclick=()=>{selectedBook=+btn.dataset.jump;seekTo(+state.vhsBookmarks[selectedBook].t);renderBookmarks()})}renderBookmarks();update();
  loadThree().then(m=>{if(!el.isConnected)return;vhsThree=m;m?.enhanceVHS?.($('.vhs-screen',el));m?.setVHSState?.($('.vhs-screen',el),{t,cam:camFor(t),ch,playing,rate})}).catch(()=>{});
}

function openSchool(){
  const items=[['school_activity','S02_活动名册.scan','学校档案复印'],['library_card','S03_借阅卡.scan','图书室旧卡'],['sports_record','S04_运动会记录.scan','体育组表格'],['classmate_note','S05_同学通讯册.scan','散页复印'],['wish_note','S06_练习本散页.scan','一年级手写页'],['newspaper_1994','S01_1994报纸剪报.scan','地方报纸剪页']];
  const facts=[['school','school_name','S02 活动名册'],['bag','bag','S05 同学通讯册'],['field','yang_summary','杨元成 2019 邮件'],['books','library','S03 借阅卡'],['run','sports','S04 运动会记录'],['wish','wish','S06 练习本散页']];
  const factRows=facts.filter(([,ev])=>has(ev)).map(([id,ev,src])=>`<button class="evidence-tab ${state.identityChecks.includes(id)?'pinned':''}" data-idfact="${id}"><span>${src}</span><small>${state.identityChecks.includes(id)?'已夹入':'夹入'}</small></button>`).join('')||'<div class="identity-empty">这页还没有夹任何原件。</div>';
  const body=`<div class="split"><aside class="sidepane"><h4>资料来源</h4><p>爷爷把学校复印件、旧报纸和同学给的散页塞在一个目录里，没有整理说明。</p><a data-summary>杨元成 2019 附件摘要</a><h4>临时对照页</h4><p>可以把你觉得在说同一个人的几份材料先夹到这里。这里不摘录正文。</p></aside><div class="mainpane"><table class="file-list"><thead><tr><th>材料</th><th>来源</th></tr></thead><tbody>${items.map(([id,n,d])=>`<tr data-doc="${id}"><td><span class="file-chip"><img src="${ICON('docs')}">${n}</span></td><td>${d}</td></tr>`).join('')}</tbody></table><div class="identity-board"><div class="identity-title">临时对照页</div><p class="identity-pencil">林守义用铅笔在这页上夹过几份来源；这里只记文件名，不抄正文。</p><div class="evidence-tabs" data-factrows>${factRows}</div><button class="sys-btn" data-idcheck>看看这些是不是同一个人</button><div class="identity-result" data-idresult>${state.identity?'页签上后来写了：陈禾穗（阿穗）。':'页签还是空的。'}</div></div></div></div>`;
  const el=makeWindow({id:'school',title:'学校与地方材料',icon:'docs',w:980,h:650,body,status:'本地复印件 / 剪报'});
  const refresh=()=>{const fresh=facts.filter(([,ev])=>has(ev)).map(([id,ev,src])=>`<button class="evidence-tab ${state.identityChecks.includes(id)?'pinned':''}" data-idfact="${id}"><span>${src}</span><small>${state.identityChecks.includes(id)?'已夹入':'夹入'}</small></button>`).join('')||'<div class="identity-empty">这页还没有夹任何原件。</div>';$('[data-factrows]',el).innerHTML=fresh;bindChecks();};
  const bindChecks=()=>$$('[data-idfact]',el).forEach(c=>c.onclick=()=>{const id=c.dataset.idfact,pinned=state.identityChecks.includes(id);state.identityChecks=pinned?state.identityChecks.filter(x=>x!==id):[...new Set([...state.identityChecks,id])];save();refresh()});
  $$('[data-doc]',el).forEach(r=>r.ondblclick=()=>{openScan(r.dataset.doc);setTimeout(refresh,60)});$('[data-summary]',el).onclick=()=>{openMailSummary();setTimeout(refresh,60)};bindChecks();$('[data-idcheck]',el).onclick=()=>checkIdentity(el);
}
function checkIdentity(el=null){
  const picks=new Set(state.identityChecks),core=picks.has('school')&&picks.has('bag')&&picks.has('field'),human=['books','run','wish'].some(x=>picks.has(x));
  if(has('media_cross')&&state.tailRule&&core&&human&&!state.identity){state.identity=true;save();addEvidence('identity','临时对照页：陈禾穗（阿穗）');if(el?.isConnected)$('[data-idresult]',el).textContent='这几份材料像是在说同一个孩子。页签：陈禾穗（阿穗）。';toast('便笺','陈禾穗。小名阿穗。',3600);updateWorld();return true}
  if(el?.isConnected)$('[data-idresult]',el).textContent='这几份还对不上。先把原件放在一起看，不要只凭一个名字。';return false;
}

function login2Body(){return `<div class="login-panel"><div class="login-head">林守义邮件离线归档 2004–2019</div><div class="login-main"><div>账号：<b>linshouyi</b> · 本地归档损坏后需要安全问题恢复。</div><div class="login-row"><label>账号</label><input data-user value="linshouyi"></div><div class="login-row"><label>2019最终确认的胶片卷标</label><input data-q1 placeholder="例如 A-01"></div><div class="login-row"><label>那个孩子的小名</label><input data-q2></div><div class="error-text" data-error></div><div class="login-actions"><button class="sys-btn" data-login>离线找回并打开</button></div><div class="helpbox">归档恢复题取自这台电脑里已经留存的材料。卷标可在胶片光台查看；小名可从学校与旧邮件里核对。</div></div></div>`}
function openMailLogin(){if(state.login2){openMailArchive();return}const el=makeWindow({id:'login2',title:'林守义邮件归档 - 离线找回密码',icon:'mail',w:700,h:520,body:login2Body(),status:'MAIL_ARCHIVE 2004-2019'});let fail=0;$('[data-login]',el).onclick=()=>{const u=$('[data-user]',el).value.trim().toLowerCase(),a=$('[data-q1]',el).value.trim().toUpperCase().replace('－','-'),b=$('[data-q2]',el).value.trim();if(u==='linshouyi'&&a==='B-03'&&(b==='阿穗'||b==='禾穗')){state.login2=true;save();addEvidence('login2','第二次登录完成：卷标 B-03 + 小名阿穗');el.remove();$(`.task-window-button[data-for="login2"]`)?.remove();openMailArchive();updateWorld()}else{fail++;$('[data-error]',el).textContent=fail>=2?'回答不匹配。请回看胶片卷标与身份材料。':'安全问题未通过。'}}}
function openMailArchive(){
  const mails=[
   {from:'杨元成',date:'2019-11-18',sub:'那盘B卷我翻出来了',kind:'m1',body:'林师傅，孩子我有印象，没在名单里。背蓝白书包，一直站边上看。B卷最后是B-03。你若真要查，先别把“换命”两个字写进站里。'},
   {from:'老曹',date:'2019-10-29',sub:'周六还去不去下棋',body:'老林，桥头茶馆换老板了。周六要来就早点，下午那帮人吵得很。'},
   {from:'林守义（草稿）',date:'2019-11-23 01:44',sub:'未发送：名字查到了',kind:'m2',body:'名字查到了，陈禾穗。小名阿穗。我想把名字写进站里，又怕我写下去就像在替自己找一个解释。事情是不是那样，我没有证据。'},
   {from:'打印店小周',date:'2019-08-05',sub:'扫描那几张好了',body:'林叔，旧纸有两张太脆，我没压平。U盘还在店里，你路过来拿。'},
   {from:'网站留言转发',date:'2018-12-31',sub:'计数器又归零了',body:'自动邮件：访问计数器数据文件损坏，已从备份恢复。'},
   {from:'杨元成',date:'2019-11-23 08:02',sub:'RE: 你问最后一条我再想了想',kind:'m3',body:'你拍最后一条的时候不在摄影机旁。你在路口对面跟人说话。我记得你回来时已经喊收工了。别把你没看见的事硬记成你看见。'},
   {from:'国良',date:'2017-02-04',sub:'冰箱里的菜',body:'爸那边我去过了。冰箱别再塞咸菜，吃不完。你有空给他把灯泡换了。'},
   {from:'杨元成',date:'2016-06-19',sub:'RE: 老片子',body:'你要的不是我手上这批，电视台搬库房以后卷号改过。等我哪天回去再问。'},
   {from:'林守义（草稿）',date:'2012-09-03',sub:'无主题',body:'问了东巷那边两个老师，都说记不住。先放着。'}
  ];
  const body=`<div class="mail-app"><aside class="mail-folders"><b>本地文件夹</b><p>收件箱 (42)</p><p>已发送 (18)</p><p>草稿 (3)</p><p>已删除 (7)</p><hr><small>账号：linshouyi<br>模式：离线</small></aside><div class="mail-list">${mails.map((m,i)=>`<div class="mail-item ${i===0?'active':''}" data-mail="${i}"><b>${m.sub}</b><br>${m.from}<br><span>${m.date}</span></div>`).join('')}</div><article class="mail-view" data-mailview></article></div>`;
  const el=makeWindow({id:'mailarchive',title:'Outlook Express - 林守义（离线归档）',icon:'mail',w:1050,h:650,body,status:'本地邮件归档 · 2004-2019'});
  const show=i=>{const m=mails[i];$('.mail-view',el).innerHTML=`<div class="mail-header">From: ${m.from}<br>Date: ${m.date}<br>Subject: ${m.sub}</div><div class="mail-body"><p>${m.body}</p>${m.kind==='m2'?'<span class="attachment">未发送草稿 / 未同步</span>':''}</div>`;$$('[data-mail]',el).forEach((x,j)=>x.classList.toggle('active',j===i));if(m.kind==='m1')addEvidence('mail2019','2019_杨元成.eml');if(m.kind==='m2')addEvidence('draft','draft_名字查到了.eml');if(m.kind==='m3')addEvidence('grandpa_absent','RE_最后一条.eml')};$$('[data-mail]',el).forEach(x=>x.onclick=()=>show(+x.dataset.mail));show(0);
}

function openMetadata(){
  if(!state.login2){const body=`<div class="meta-app"><div class="meta-table-wrap"><table class="meta-table"><thead><tr><th>时间</th><th>文件</th><th>路径</th><th>动作</th></tr></thead><tbody><tr><td>2019-11-23 02:31</td><td>Thumbs.db</td><td>C:\\LMG\\</td><td>修改</td></tr><tr><td>2019-11-21 18:24</td><td>木工尺寸_旧.txt</td><td>C:\\Documents</td><td>访问</td></tr><tr><td>2019-11-18 09:14</td><td>mail_index.dat</td><td>C:\\MAIL</td><td>写入</td></tr></tbody></table></div><aside class="meta-detail"><h3>文件属性</h3><div class="property-box">普通系统记录可以查看。MAIL_ARCHIVE 的详细索引目前没有挂载。</div><p>邮件归档恢复后，系统会把对应的文件头重新加入这里。</p></aside></div>`;makeWindow({id:'metadata_pre',title:'文件属性',icon:'search',w:870,h:520,body,status:'本机文件系统'});return}
  const rows=[
    {k:'handnote',r:['2019-11-23 02:17','HANDNOTE_2019.scan','C:\\LMG\\family\\','林守义','最后修改']},
    {k:'index',r:['2019-11-23 01:58','阿穗_索引.txt','C:\\LMG\\1993\\','林守义','创建']},
    {k:'draft',r:['2019-11-23 01:44','draft_名字查到了.eml','C:\\MAIL\\draft\\','linshouyi','未发送']},
    {k:'contact',r:['2019-11-22 23:51','B03_contact.tif','C:\\VIDEO\\SCAN\\','杨元成','最后访问']},
    {k:'mail',r:['2019-11-18 09:14','2019_杨元成.eml','C:\\MAIL\\inbox\\','yangyc_archive','接收']},
    {k:'school',r:['2009-05-03 21:07','同学录_陈禾穗.scan','C:\\LMG\\school\\','林守义','扫描']},
    {k:'site',r:['2004-04-19 18:12','送孩路_旧俗站.htm','C:\\LMG\\site\\','林守义','首次创建']},
    {k:'wood',r:['2019-11-21 18:24','木工尺寸_旧.txt','C:\\Documents\\','林守义','访问']},
    {k:'thumbs',r:['2019-11-23 02:31','Thumbs.db','C:\\LMG\\','SYSTEM','修改']},
    {k:'driver',r:['2009-05-03 20:44','SCAN_DRIVER.LOG','C:\\WINDOWS\\','SYSTEM','写入']}
  ];
  let sorted=false;
  const rowHTML=o=>`<tr data-row="${o.k}" class="${state.metaSelected.includes(o.k)?'meta-picked':''}"><td>${o.r[0]}</td><td>${o.r[1]}</td><td>${o.r[2]}</td><td>${o.r[3]}</td><td>${o.r[4]}</td></tr>`;
  const body=`<div class="meta-app"><div class="meta-table-wrap"><table class="meta-table"><thead><tr><th data-sort-time>时间 ↕</th><th>文件</th><th>路径</th><th>作者</th><th>动作</th></tr></thead><tbody data-metabody>${rows.map(rowHTML).join('')}</tbody></table></div><aside class="meta-detail"><h3>文件属性与历史</h3><div class="property-box" data-prop>先按时间排一遍。爷爷最后那晚连续碰过哪些文件，可以先点出来。</div><p><button class="sys-btn" data-meta-check>保存这组时间点</button></p><div class="property-box" data-meta-result>${has('timeline')?'这组时间点已经存过。':'还没保存任何一组。'}</div><h3>浏览/搜索历史</h3><div class="property-box">2004：送孩路 / 牵魂线 / 铁路事故<br>2009：东巷二小 / 1994剪报<br>2019-11：阿穗 / 最后一条 / 尾位</div><p><button class="sys-btn" data-recycle>查看回收站索引</button></p></aside></div>`;
  const el=makeWindow({id:'metadata',title:'系统属性与时间线取证',icon:'search',w:1060,h:650,body,status:'本机元数据 / 手动时间线核对'});
  const currentOrder=()=>[...$('[data-metabody]',el).children].map(tr=>tr.dataset.row);
  const bindRows=()=>$$('[data-row]',el).forEach(tr=>tr.onclick=()=>{const o=rows.find(x=>x.k===tr.dataset.row);$('[data-prop]',el).innerHTML=`<b>${o.r[1]}</b><br>时间：${o.r[0]}<br>路径：${o.r[2]}<br>作者：${o.r[3]}<br>动作：${o.r[4]}<br><small>再次点击可取消/选择该节点。</small>`;const k=o.k;state.metaSelected=state.metaSelected.includes(k)?state.metaSelected.filter(x=>x!==k):[...state.metaSelected,k];tr.classList.toggle('meta-picked',state.metaSelected.includes(k));save()});
  bindRows();
  $('[data-sort-time]',el).onclick=()=>{const tbody=$('[data-metabody]',el);[...tbody.children].sort((a,b)=>a.cells[0].textContent.localeCompare(b.cells[0].textContent)).forEach(x=>tbody.append(x));sorted=true;$('[data-prop]',el).innerHTML='已经按时间从早到晚排好。点几行看看爷爷最后那晚的操作有没有连起来。'};
  $('[data-meta-check]',el).onclick=()=>{const need=['contact','draft','index','handnote'];const chosen=new Set(state.metaSelected);if(!sorted){$('[data-meta-result]',el).textContent='先把时间排顺。';return}if(need.every(k=>chosen.has(k))){addEvidence('timeline','2019-11-22/23：最后一轮文件访问顺序已保存');$('[data-meta-result]',el).textContent='已保存：23:51 接触印样 → 01:44 草稿 → 01:58 索引 → 02:17 手记。';const rw=$('.win[data-win-id="recyclewin"]');if(rw)$('[data-act="close"]',rw)?.click()}else{$('[data-meta-result]',el).textContent='这几行不像同一次连续操作。再看日期和时间。'}};
  $('[data-recycle]',el).onclick=openRecycle;
}
function openRecycle(){
  const locked=!state.login2,ready=has('timeline');const body=`<div class="mainpane"><h3>回收站</h3>${locked?'<p>回收站里只有普通临时文件。更旧的索引缓存需要邮件归档恢复后才能辨认来源。</p>':`<table class="file-list"><tr><th>名称</th><th>原位置</th><th>删除日期</th></tr><tr><td class="deleted">DELETE_INDEX_2019.cache</td><td>C:\\LMG\\1993</td><td>2019-11-23 02:31</td></tr><tr><td class="deleted">draft_名字查到了.eml</td><td>C:\\MAIL\\draft</td><td>2019-11-23 02:35</td></tr></table><p><button class="sys-btn" data-restore ${ready?'':'disabled'}>${ready?'恢复索引与草稿':'先核对系统时间线'}</button></p><div class="system-note"><b>删除记录</b><span>${ready?'2019-11-23：草稿保存后4分钟，索引与草稿被移入回收站；回收站未清空。':'来源路径尚未核对。请先查看系统取证中的文件时间线。'}</span></div>`}</div>`;
  const el=makeWindow({id:'recyclewin',title:'回收站',icon:'recycle',w:720,h:470,body,status:locked?'0 个可辨认对象':ready?'2 个旧索引对象 · 来源已核对':'2 个旧索引对象 · 待核对'});if(!locked&&ready)$('[data-restore]',el).onclick=()=>{state.restored=true;save();addEvidence('delete_intent','回收站恢复','爷爷2019年确认身份后曾想删资料，但最终没有清空回收站');toast('已恢复','索引和未发送草稿已恢复到原位置。');updateWorld();openFamily()};
}
function openFamily(){
  if(!state.restored){const body=`<div class="mainpane"><h3>家庭旧档</h3><table class="file-list"><tr data-misc="medicine"><td><span class="file-chip"><img src="${ICON('notepad')}">药费_2019.txt</span></td><td>普通文本文档</td></tr><tr data-misc="phonebook"><td><span class="file-chip"><img src="${ICON('notepad')}">旧号码.txt</span></td><td>普通文本文档</td></tr><tr><td class="deleted">H01_1993_07.idx</td><td>索引损坏</td></tr><tr><td class="deleted">H02_oldlist.idx</td><td>索引损坏</td></tr></table><div class="system-note"><b>目录状态</b><span>两项旧扫描只剩索引名，原路径记录不在当前目录。</span></div></div>`;const el=makeWindow({id:'family_pre',title:'家庭旧档',icon:'calendar',w:720,h:470,body,status:'2 个文件 / 2 个损坏索引'});$$('[data-misc]',el).forEach(r=>r.ondblclick=()=>openMiscDoc(r.dataset.misc));return}
  const body=`<div class="mainpane"><h3>家庭旧档</h3><table class="file-list"><tr data-doc="family_calendar"><td><span class="file-chip"><img src="${ICON('calendar')}">H01_旧挂历_1993-07.scan</span></td><td>林家厨房挂历 / 1993年7月页</td></tr><tr data-doc="grass_substitute"><td><span class="file-chip"><img src="${ICON('docs')}">H02_草替材料清单.scan</span></td><td>林守义手写清单 / 1993</td></tr><tr data-misc="medicine"><td><span class="file-chip"><img src="${ICON('notepad')}">药费_2019.txt</span></td><td>普通文本文档</td></tr></table><p><button class="sys-btn" data-call>拨舅舅电话</button></p></div>`;
  const el=makeWindow({id:'family',title:'家庭旧档',icon:'calendar',w:760,h:500,body,status:'已恢复旧索引'});$$('[data-doc]',el).forEach(r=>r.ondblclick=()=>{openScan(r.dataset.doc);setTimeout(checkTruth,50)});$$('[data-misc]',el).forEach(r=>r.ondblclick=()=>openMiscDoc(r.dataset.misc));$('[data-call]',el).onclick=()=>startPhone();
}
function startPhone(){
  if(!state.phone1){state.phone1=true;save();showPhone('林国良（舅舅）',`“你先别问是不是那回事。你先说，你翻到哪了。”<br><br>我说翻到1993年7月12日。电话那头停了几秒。<br><br>“那天你烧了快半个月。你爷爷说要借拍片那个队形过路口。家里人都不愿意，他自己认死理。”`,()=>{addEvidence('uncle1','舅舅确认：1993年7月12日家里做过旧法，爷爷借了拍摄队形');setTimeout(()=>{if(!state.phone2){toast('电话', '舅舅刚挂断不久，又打了回来。',2600);setTimeout(startPhone,2800)}},1200);checkTruth()});}
  else if(!state.phone2){state.phone2=true;save();showPhone('林国良（舅舅）',`“你翻到那盘带了？”<br><br>我没说话。<br><br>“他后来最怕的不是你退烧。是他发现拍片那队最后多了个娃。他说那位置本来不能站人。你爷爷没找谁顶你，他就是……把不该借的东西借了。”`,()=>{addEvidence('uncle2','舅舅确认：爷爷没有主动找活人替，真正越界是把真实孩子队伍当成仪式材料');checkTruth()});}
  else showPhone('林国良（舅舅）','“能说的我都说了。你自己把那几样东西放一起看吧。”',checkTruth);
}
function showPhone(name,html,onClose){const p=$('#phoneLayer');p.classList.remove('hidden');p.innerHTML=`<div class="phone-head">来电 / ${name}</div><div class="phone-body"><span class="phone-speaker">${name}</span><p>${html}</p><div class="phone-actions"><button class="sys-btn" data-hang>挂断</button></div></div>`;$('[data-hang]',p).onclick=()=>{p.classList.add('hidden');onClose?.()};playAudio('phone.wav',.13);beep(420,.08,.02);setTimeout(()=>beep(520,.08,.018),170)}
function checkTruth(){const enough=has('calendar')&&has('grass')&&has('death')&&has('uncle1')&&has('uncle2')&&has('media_cross')&&state.identity;if(enough&&!state.truth){state.truth=true;save();addEvidence('core_truth','1993-07-12 / 1994-01：几份材料的日期终于对上了');crtPeak();setTimeout(()=>toast('最近文件','HANDNOTE_2019.scan 出现在最近使用记录里。',5200),2800);updateWorld()}}
function crtPeak(){if(state.truthWarpSeen)return;state.truthWarpSeen=true;save();const clock=$('#clockText');if(matchMedia('(prefers-reduced-motion: reduce)').matches){clock.textContent='1993-07-12';setTimeout(updateClock,1200);return}const c=$('#crtWarp');c.classList.remove('play');void c.offsetWidth;c.classList.add('play');setTimeout(()=>{clock.textContent='1993-07-12';playAudio('hdd_seek.wav',.055);setTimeout(updateClock,1100)},620)}

async function openJar(){
  if(!state.identity){const body=`<div class="mainpane"><h3>物件扫描</h3><div class="object-preview"><img src="assets/jar_front.webp" alt="粗陶器物正面档案照"></div><div class="property-box">OBJ_2019_11　粗陶器物。正面照片可读；底部扫描索引名已损坏，目录里没有说明这件东西属于谁。</div></div>`;makeWindow({id:'jar_pre',title:'物件扫描 - OBJ_2019_11',icon:'jar',w:690,h:560,body,status:'正面照片 / 底部索引损坏'});return}
  state.jarFound=true;save();
  const body=`<div class="jar-app"><div class="jar-stage" data-jarstage><div class="fallback-jar"><img class="jar-front" src="assets/jar_front.webp" alt="粗陶留名罐正面档案照"><img class="jar-bottom" src="assets/jar_bottom.webp" alt="粗陶留名罐底部档案照"></div><div class="jar-scan-badge" data-jarbadge>本地档案照片</div></div><aside class="jar-side"><h3>数字化物件查看器</h3><p>对象：粗陶器物<br>来源：林守义木箱底层<br>数字化：2019-11</p><div class="jar-status" data-jarstatus>正在加载本地物件模型；如显卡不支持则使用档案照片。</div><label>斜光 <input type="range" min="0" max="100" value="35" data-light></label><label>水平旋转 <input type="range" min="0" max="360" value="0" data-rot></label><label>翻底角度 <input type="range" min="0" max="180" value="18" data-tilt></label><div class="jar-readout"><span>ROT <b data-rv>000°</b></span><span>TILT <b data-tv>018°</b></span><span>LIGHT <b data-lv>035%</b></span></div><p class="jar-help">这批物件是2019年重新数字化的。可以转动、翻底、调斜光。</p><div class="museum-label" data-jartext>器表有旧划痕与口沿修补。目录备注称2019年再次数字化；底部细节尚未确认。</div></aside></div>`;
  const el=makeWindow({id:'jar',title:'数字化物件查看器 - 留名罐',icon:'jar',w:940,h:650,body,menu:false,status:'OBJ_2019_11 / 3D SCAN + PHOTO FALLBACK'});
  const stage=$('[data-jarstage]',el),r=$('[data-rot]',el),t=$('[data-tilt]',el),l=$('[data-light]',el),jar=$('.fallback-jar',el),status=$('[data-jarstatus]',el),badge=$('[data-jarbadge]',el);
  let ctrl=null,revealed=!!state.jarNote;
  const reveal=()=>{if(revealed)return;revealed=true;state.jarNote=true;save();$('[data-jartext]',el).innerHTML='<b>底部后刻：禾穗</b><br>刻痕边缘比器表旧划痕新，旁边目录签写“2019补记”。刻痕边缘较新，像是后来补刻的。';addEvidence('jar_note','OBJ_2019_11 底部后刻：禾穗')};
  const apply=()=>{const rot=+r.value,tilt=+t.value,light=+l.value;$('[data-rv]',el).textContent=String(Math.round(rot)).padStart(3,'0')+'°';$('[data-tv]',el).textContent=String(Math.round(tilt)).padStart(3,'0')+'°';$('[data-lv]',el).textContent=String(Math.round(light)).padStart(3,'0')+'%';ctrl?.setView?.({rot,tilt,light});if(!ctrl?.isLoaded?.()){jar.style.transform=`translate(-50%,-50%) rotateY(${rot}deg) rotateX(${Math.min(72,tilt*.46)}deg)`;jar.style.filter=`brightness(${.72+light/150}) contrast(${1+light/420})`;const show=tilt>112&&light>60;jar.classList.toggle('reveal',show);if(show)reveal()}};
  r.oninput=t.oninput=l.oninput=apply;apply();
  const mod=await loadThree();if(!el.isConnected)return;
  if(mod?.mountJar){ctrl=mod.mountJar(stage,reveal,msg=>{if(status)status.textContent=msg||'';if(badge)badge.textContent=(msg||'').includes('已加载')?'3D 数字化物件 / 本机查看':'本地档案照片 / 兼容模式'});apply()}else status.textContent='3D查看器没有启动，已切到2019年的两张本地档案照片。';
}

function openFinal(){if(!state.truth){toast('HANDNOTE_2019.scan','文件头损坏，当前只能读到创建时间。');return}openScan('final_note');state.finalRead=true;save();addEvidence('final','HANDNOTE_2019.scan');setTimeout(()=>openEndAction(),1200)}
function openEndAction(){
  if(!state.finalRead)return;const body=`<div class="end-action"><b>回到桌面以后，爷爷最开始那张纸还压在窗口后面。</b><p>“电脑里的东西，你看完自己定。别留着害人，也别把人家的名字再弄丢。”</p><div class="drag-folder" draggable="true" data-folder><img src="${ICON('folder')}">送孩路资料</div><p style="font-size:12px">鼠标拖过去，或者双击目标位置。</p><div class="end-drops"><div class="drop-target" data-end="archive"><img src="${ICON('archive')}"><b>新建：陈禾穗_归档</b><span>另存这些材料</span></div><div class="drop-target" data-end="delete"><img src="${ICON('recycle')}"><b>回收站</b><span>删除送孩路资料</span></div></div></div>`;const el=makeWindow({id:'endaction',title:'文件操作',icon:'folder',w:700,h:560,body,menu:false,status:'请选择资料去向'});let dragging=false;$('[data-folder]',el).ondragstart=()=>dragging=true;$$('[data-end]',el).forEach(t=>{t.ondragover=e=>e.preventDefault();t.ondrop=e=>{e.preventDefault();if(dragging)finish(t.dataset.end)}});$$('[data-end]',el).forEach(t=>t.ondblclick=()=>finish(t.dataset.end));}
function finish(kind){state.ending=kind;save();stopAudio(roomClock);stopAudio(roomAmbience);roomClock=null;roomAmbience=null;playAudio('crt_off.wav',.12);$$('.win').forEach(w=>{disposeWindowScenes(w);w.remove()});taskButtons.innerHTML='';const e=$('#endingLayer');e.classList.remove('hidden');e.innerHTML=`<div class="ending-card"><h1>留名罐</h1><p>${kind==='archive'?'我把能对得上的材料另存了一份。文件夹的名字没有再写“第七个”，只写了陈禾穗。':'我把“送孩路资料”拖进回收站。真正留下来的，反而是那些已经记住的细节。'}</p><p>后来我去了一趟送孩路。樟树早没了，铁路也换过两回。我问路边卖水的老人，认不认识陈禾穗。</p><p>他想了很久，说：“阿穗啊，认得。小时候跑得快得很。”</p><p>我就没再问了。</p><p class="name">陈禾穗　1986—1994</p>${state.jarNote?'<p style="font-size:13px;color:#aaa">归档附注：2019年，林守义曾在一只粗陶罐底部补刻“禾穗”二字。</p>':''}<button data-reset>重新收拾这台电脑</button></div>`;$('[data-reset]',e).onclick=resetGame;beep(180,.4,.015)}

function openHelp(){const body=`<div class="mainpane"><h3>本机使用说明</h3><p>双击桌面图标打开。窗口可拖动、最小化；扫描件可以放大，也能靠左/靠右并排。</p><p>离线库的账号规则写在软件自己的“帮助”里。影像工具支持逐帧、降速和声道切换。</p><p>下面的“查阅说明”是后来加的便捷说明；不看也能继续使用这台电脑。</p><p><button class="sys-btn" data-hint>查阅说明（第 ${state.hints+1} 层）</button> <button class="sys-btn" data-reset>清除存档</button></p><div class="property-box" data-htext>第一层只提示应该回看哪类材料。</div></div>`;const el=makeWindow({id:'helpwin',title:'系统说明',icon:'help',w:660,h:490,body,status:'HELP.CHM'});$('[data-hint]',el).onclick=()=>{state.hints=Math.min(3,state.hints+1);save();const h=state.hints===1?getNaturalHint():state.hints===2?getActionHint():getDirectHint();$('[data-htext]',el).textContent=h;$('[data-hint]',el).textContent=`查阅说明（第 ${state.hints+1} 层）`};$('[data-reset]',el).onclick=()=>confirm('确定清除本地存档并重新开始？')&&resetGame()}
function getNaturalHint(){if(!state.trainDone)return'最近文件把1993、摄制资料和爷爷的工务身份连在一起；训练器是他留下的职业软件。';if(!state.login1)return'训练历史里有操作员代号与职工号；离线库登录页帮助说明了口令规则。';if(!state.filmDone)return'胶片先解决“连续性”：按边码与相邻曝光恢复三张接触表顺序。';if(!has('film7'))return'连续性只是第一步。把最终接触印样和正式临演名单并排，自己标记画面里的人数。';if(!state.vhs7)return'35mm已经留下一个人数差异；再用另一种原始媒介独立复核，不要把胶片结论直接带进母带。';if(!has('media_cross'))return'胶片和母带都做过记录以后，回到两边各看一次，确认是不是同一个T03位置。';if(!state.tailRule)return'两份材料都在同一个 T03 位置留下了人数差异。再回看旧俗条目和场记尾注，看队尾为什么反复被提到。';if(!state.identity)return'学校复印件、同学散页和杨元成的邮件里有几处能对上；临时对照页只负责夹文件，不摘录正文。';if(!state.login2)return'邮件归档的两道恢复题都能在本机已有材料里找到：一处在胶片卷标，一处在学校和旧邮件里。';if(!has('timeline'))return'邮件开放以后先看文件属性和最近使用时间。2019 年 11 月最后那一段连续操作值得单独排一遍。';if(!state.restored)return'那几份文件的时间已经能接上。再看回收站里删过什么、删在什么之后。';if(!state.truth)return has('death')?'把家庭旧挂历、草替清单和舅舅电话与1993拍摄日放在同一天看。':'身份已经对上，但1994年事故还缺公开记录；回看地方剪报。';return'最终手记现在可以打开。'}
function getActionHint(){if(!state.trainDone)return'按运行表看区间状态，设置1#、2#道岔、锁闭并开放信号；第三阶段要绕开临时封锁。';if(!state.login1)return'用户名来自训练历史；密码组合规则写在离线库“帮助”里。';if(!state.filmDone)return'放大看三张接触表底部边码，让编号连续递增，并检查相邻曝光是否接得上。';if(!has('film7'))return'打开最终接触印样，点“人数标记”，逐个点人；同时把正式六人名单靠左/靠右并排。标记数必须来自你自己。';if(!state.vhs7)return'切到T03队尾镜，在画面人数与正式名单不一致的位置存书签，再用“与名单核对所选书签”保存观察。';if(!state.tailRule)return'回到旧民俗站“队尾空位”问答，同时打开场记B卷/T03，核对两处对尾位的写法。';if(!state.identity)return'打开活动名册、同学通讯册和杨元成附件，再读一份普通生活记录；然后把这几份夹到临时对照页。';if(!state.login2)return'第二次安全问题依次询问最终确认胶片卷标和那个孩子的小名。';if(!has('timeline'))return'系统取证里先按时间排序，再选出B03接触印样、未发送草稿、阿穗索引、家庭手记四个2019节点并核对。';if(!state.restored)return'时间线核对成立后，打开回收站恢复2019缓存索引与未发送草稿。';if(!state.truth)return has('death')?'读旧挂历和草替清单，然后拨舅舅电话。':'先打开1994地方报纸剪报，再回到家庭资料。';return'回到“最近打开”或“我的文档”，HANDNOTE_2019.scan 已经能读。'}

function getDirectHint(){return getActionHint()}
function openPower(){const body=`<div class="mainpane" style="text-align:center;padding-top:55px"><img src="${ICON('power')}" style="width:64px"><h3>关闭计算机</h3><p>Windows 将保存当前打开过的本地状态。</p><button class="sys-btn" data-off>关机</button> <button class="sys-btn" data-cancel>取消</button></div>`;const el=makeWindow({id:'powerwin',title:'关闭 Windows',icon:'power',w:480,h:330,body,menu:false,status:'本地存档已保存'});$('[data-off]',el).onclick=()=>{save();desktop.classList.add('hidden');$('#boot').classList.remove('hidden');$('#bootCopy').innerHTML='<p style="opacity:1">现在可以安全地离开这台电脑。</p><button class="quiet-button" onclick="location.reload()">重新开机</button>'};$('[data-cancel]',el).onclick=()=>{$('[data-act="close"]',el).click()}}

function updateWorld(){
  renderDesktop();checkMediaCross();
  const status=state.truth?'桌面 · 14 个对象':state.booted?'桌面 · 本地磁盘':'就绪';
  setHint(status);
}


function loadThree(){
  if(sceneModules)return sceneModules;
  const localOnly=location.protocol==='file:';
  if(localOnly){sceneModules=Promise.resolve(null);return sceneModules}
  sceneModules=import('./three-scenes.js').then(m=>m.initThree()).catch(e=>{console.warn('Three.js enhancement unavailable, using built-in fallback.',e);return null});return sceneModules;
}
function disposeWindowScenes(el){if(!sceneModules||!el)return;Promise.resolve(sceneModules).then(m=>m?.disposeScene?.(el)).catch(()=>{})}
function beep(freq=440,dur=.08,vol=.02){if(state.audioMuted||(navigator.userActivation&&!navigator.userActivation.hasBeenActive))return;try{const ac=beep.ac||(beep.ac=new (window.AudioContext||window.webkitAudioContext)());const sound=()=>{if(ac.state!=='running')return;const o=ac.createOscillator(),g=ac.createGain();o.frequency.value=freq;o.type='sine';g.gain.value=vol;o.connect(g).connect(ac.destination);o.start();g.gain.exponentialRampToValueAtTime(.0001,ac.currentTime+dur);o.stop(ac.currentTime+dur)};if(ac.state==='suspended')ac.resume().then(sound).catch(()=>{});else sound()}catch{}}
function updateClock(){const d=new Date();$('#clockText').textContent=`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`}
setInterval(updateClock,30000);updateClock();
let progressSnapshot=JSON.stringify([state.trainStep,state.login1,state.filmDone,has('film7'),state.vhs7,has('media_cross'),state.tailRule,state.identity,state.login2,has('timeline'),state.restored,state.truth]),idleMinutes=0;setInterval(()=>{const now=JSON.stringify([state.trainStep,state.login1,state.filmDone,has('film7'),state.vhs7,has('media_cross'),state.tailRule,state.identity,state.login2,has('timeline'),state.restored,state.truth]);if(now!==progressSnapshot){progressSnapshot=now;idleMinutes=0}else if(state.booted&&!state.ending){idleMinutes++;if(idleMinutes===9)setHint('桌面 · 硬盘空闲')}},60000);

// boot flow
$('#bootContinue').onclick=()=>{
  playAudio('keys_door.wav',.11);startRoomAudio();
  const c=$('#bootCopy');c.innerHTML='<p style="opacity:1">爷爷的东西不多，值钱的更没有。</p><p style="opacity:1">床底那个木箱我小时候就见过，他一直不让碰。</p><button id="powerOn" class="quiet-button">把旧电脑搬到桌上</button>';
  $('#powerOn').onclick=()=>{startRoomAudio();playAudio('hdd_seek.wav',.12);c.innerHTML='<p style="opacity:1">风扇转了两下。硬盘响得比我记忆里慢。</p><p style="opacity:1">桌面停在他最后一次关机前的样子。</p>';beep(90,.7,.02);setTimeout(()=>{state.booted=true;save();$('#boot').classList.add('hidden');desktop.classList.remove('hidden');renderDesktop();updateWorld();setTimeout(()=>{if(!state.seenTitle){state.seenTitle=true;save();const t=document.createElement('div');t.style.cssText='position:absolute;inset:0;display:grid;place-items:center;background:rgba(0,0,0,.82);color:#e8e0cc;font:42px "Noto Serif CJK SC",serif;letter-spacing:.35em;z-index:11000;pointer-events:none';t.textContent='留 名 罐';desktop.append(t);setTimeout(()=>t.remove(),2000)}},500)},1500)};
};
if(state.booted){$('#boot').classList.add('hidden');desktop.classList.remove('hidden');renderDesktop();updateWorld();syncAudio();if(state.ending)setTimeout(()=>finish(state.ending),0)}

$('#startButton').onclick=()=>{const menu=$('#contextMenu');menu.classList.toggle('hidden');menu.style.left='3px';menu.style.bottom='38px';menu.style.top='auto';menu.innerHTML=`<button data-start="docs">我的文档</button><button data-start="recent">最近打开</button><button data-start="help">系统说明</button><hr><button data-start="power">关闭计算机…</button>`;menu.onclick=e=>{const id=e.target.dataset.start;if(!id)return;menu.classList.add('hidden');({docs:openDocuments,recent:openRecent,help:openHelp,power:openPower})[id]?.()}}
$('#soundButton').onclick=()=>{state.audioMuted=!state.audioMuted;save();syncAudio()};syncAudio();
$('#clockButton').ondblclick=()=>toast('系统时间','CMOS 时钟已更换电池。文件元数据仍保留原始年份。');
document.addEventListener('click',e=>{if(!e.target.closest('#startButton')&&!e.target.closest('#contextMenu'))$('#contextMenu').classList.add('hidden')});
desktop.addEventListener('contextmenu',e=>{if(e.target.closest('.win'))return;e.preventDefault();const m=$('#contextMenu');m.classList.remove('hidden');m.style.left=`${e.clientX}px`;m.style.top=`${e.clientY}px`;m.style.bottom='auto';m.innerHTML=`<button data-c="refresh">刷新</button><button data-c="sort">排列图标</button><hr><button data-c="help">系统说明</button>`;m.onclick=ev=>{const a=ev.target.dataset.c;if(a==='refresh')renderDesktop();if(a==='sort')renderDesktop();if(a==='help')openHelp();m.classList.add('hidden')}});
window.addEventListener('beforeunload',save);
