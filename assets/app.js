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
  booted:false,evidence:[],read:[],trainStep:0,trainDone:false,trainFails:0,trainErrors:0,trainStops:0,trainDelay:0,login1:false,filmDone:false,filmFails:0,vhsBookmarks:[],vhs7:false,tailRule:false,identity:false,identityChecks:[],login2:false,restored:false,family:false,truth:false,truthWarpSeen:false,jarFound:false,jarNote:false,finalRead:false,ending:null,hints:0,openWins:[],z:20,lastOpen:[],seenTitle:false,phone1:false,phone2:false,sevenLamp:false,audioMuted:false,createdAt:Date.now()
};
let state=loadState();
let z=30, winCount=0, sceneModules=null;
const desktop=$('#desktop'), layer=$('#windowLayer'), iconsEl=$('#desktopIcons'), taskButtons=$('#taskButtons');

function loadState(){
  try{
    const raw={...defaultState,...JSON.parse(localStorage.getItem('liumingguan.save')||'{}')};
    raw.evidence=Array.isArray(raw.evidence)?[...new Set(raw.evidence.filter(x=>typeof x==='string'))]:[];
    raw.read=Array.isArray(raw.read)?[...new Set(raw.read.filter(x=>typeof x==='string'))]:[];
    raw.vhsBookmarks=Array.isArray(raw.vhsBookmarks)?raw.vhsBookmarks.filter(b=>b&&Number.isFinite(+b.t)&&[1,2,3].includes(+b.cam)).slice(0,3):[];
    raw.identityChecks=Array.isArray(raw.identityChecks)?[...new Set(raw.identityChecks.filter(x=>typeof x==='string'))].slice(0,6):[];
    raw.trainStep=clamp(Number(raw.trainStep)||0,0,3); raw.trainFails=Math.max(0,Number(raw.trainFails)||0); raw.trainErrors=Math.max(0,Number(raw.trainErrors)||0); raw.trainStops=Math.max(0,Number(raw.trainStops)||0); raw.trainDelay=Math.max(0,Number(raw.trainDelay)||0); raw.filmFails=Math.max(0,Number(raw.filmFails)||0);
    if(raw.trainDone)raw.trainStep=3; if(!['archive','delete',null].includes(raw.ending))raw.ending=null;
    return raw;
  }catch{return {...defaultState}}
}
function save(){localStorage.setItem('liumingguan.save',JSON.stringify(state));}
function resetGame(){localStorage.removeItem('liumingguan.save');location.reload();}
function has(id){return state.evidence.includes(id)}
function addEvidence(id,label,detail=''){
  if(!state.evidence.includes(id)){
    state.evidence.push(id); save(); toast('本地索引',label+(detail?` · ${detail}`:''),3200); updateWorld();
  }
}
function markRead(id){if(!state.read.includes(id)){state.read.push(id);save();updateWorld();}}
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
 classmate_note:{title:'同学通讯册散页',file:'classmate_note.webp',cap:'林守义2009复印',e:'bag',ev:'阿穗背蓝白书包，侧边缝“穗”字；常追着货车数车厢。'},
 newspaper_1994:{title:'1994年地方报纸剪报',file:'newspaper_1994.webp',cap:'《樟城晚报》1994-01-19',e:'death',ev:'送孩路附近一名约7岁男童意外死亡，姓名未公布。'},
 wish_note:{title:'一年级练习本散页',file:'wish_note.webp',cap:'东巷二小 / 1993春',e:'wish',ev:'陈禾穗写“我想坐火车去很远的地方看看”；老师又圈了他漏掉的最后一笔。'},
 family_calendar:{title:'林家1993年7月旧挂历',file:'family_calendar.webp',cap:'家庭纸质材料',e:'calendar',ev:'林舟7月12日晚退烧；同日爷爷借路口“再试一次”。'},
 grass_substitute:{title:'旧布草材料清单',file:'grass_substitute.webp',cap:'林守义手写 / 1993',e:'grass',ev:'爷爷原本只做草替，并写明“不找活人顶”“队尾留空”。'},
 final_note:{title:'林守义未寄出的手记',file:'final_note.webp',cap:'最后修改：2019-11-23 02:17',e:'final',ev:'爷爷拍最后一条时在路口另一侧，没看见阿穗站进队尾。'}
};

const desktopIcons=()=>[
 iconDef('docs','我的文档','folder',openDocuments,{unread:!has('note')||!has('work')}),
 iconDef('recent','最近打开','recent',openRecent,{unread:state.evidence.length<2}),
 iconDef('site','送孩路资料档','site',openOldSite,{unread:!has('folk')}),
 iconDef('train','区间调度训练器','train',openTrain,{unread:!state.trainDone}),
 iconDef('archive','宣传影像离线库','archive',openArchiveLogin,{unread:state.trainDone&&!state.login1}),
 iconDef('media','影像检查台','media',openMediaHub,{unread:state.login1&&(!state.filmDone||!state.vhs7)}),
 ...((state.vhs7&&state.tailRule)||state.identity||state.login2?[iconDef('school','资料汇编_学校','docs',openSchool,{unread:!state.identity})]:[]),
 ...(state.identity?[iconDef('mail','林守义邮件归档','mail',openMailLogin,{unread:!state.login2})]:[]),
 ...(state.login2?[iconDef('meta','系统取证','search',openMetadata,{unread:!state.restored})]:[]),
 ...(state.restored?[iconDef('family','家庭资料','calendar',openFamily,{unread:!state.truth})]:[]),
 ...(state.identity?[iconDef('jar','数字化物件','jar',openJar,{unread:!state.jarFound})]:[]),
 iconDef('recycle','回收站','recycle',openRecycle,{unread:state.login2&&!state.restored}),
 iconDef('help','系统说明','help',openHelp),
 iconDef('power','关闭计算机','power',openPower)
];

function renderDesktop(){
  iconsEl.innerHTML='';
  desktopIcons().forEach(def=>{
    const b=document.createElement('button');b.className='desktop-icon'+(def.unread?' unread':'');b.dataset.id=def.id;
    b.innerHTML=`<img src="${ICON(def.icon)}" alt=""><span>${esc(def.label)}</span>`;
    b.addEventListener('dblclick',def.open);b.addEventListener('click',()=>setHint(`选中：${def.label}`)); iconsEl.append(b);
  });
}

function makeWindow({id,title,icon='folder',body='',w=900,h=620,status='就绪',menu=true,onClose=null}){
  const existing=$(`.win[data-win-id="${CSS.escape(id)}"]`);
  if(existing){activate(existing);return existing}
  const el=document.createElement('section');el.className='win active';el.dataset.winId=id;el.style.width=`min(${w}px,94vw)`;el.style.height=`min(${h}px,84vh)`;
  const off=(winCount++%8)*24;el.style.left=`${clamp(85+off,10,innerWidth-360)}px`;el.style.top=`${clamp(52+off,8,innerHeight-260)}px`;el.style.zIndex=++z;
  el.innerHTML=`<header class="win-titlebar"><img src="${ICON(icon)}" alt=""><span class="win-title">${esc(title)}</span><span class="win-controls"><button data-act="min">_</button><button data-act="max">□</button><button data-act="close">×</button></span></header>${menu?'<div class="win-menu"><span>文件(F)</span><span>查看(V)</span><span>帮助(H)</span></div>':''}<div class="win-body">${body}</div><footer class="statusbar"><span>${esc(status)}</span><span>本地计算机</span></footer>`;
  layer.append(el);dragWindow(el);activate(el);
  const tb=document.createElement('button');tb.className='task-window-button active';tb.dataset.for=id;tb.textContent=title;tb.onclick=()=>{if(el.classList.contains('hidden'))el.classList.remove('hidden');activate(el)};taskButtons.append(tb);
  el.addEventListener('mousedown',()=>activate(el));
  $('.win-controls [data-act="close"]',el).onclick=()=>{disposeWindowScenes(el);el.remove();tb.remove();onClose?.()};
  $('.win-controls [data-act="min"]',el).onclick=()=>{el.classList.add('hidden');tb.classList.remove('active')};
  $('.win-controls [data-act="max"]',el).onclick=()=>{if(el.dataset.max==='1'){el.style.cssText=el.dataset.prev;el.dataset.max='0'}else{el.dataset.prev=el.style.cssText;el.style.left='0';el.style.top='0';el.style.width='100%';el.style.height='100%';el.dataset.max='1'}};
  return el;
}
function activate(el){$$('.win').forEach(w=>w.classList.toggle('inactive',w!==el));el.classList.add('active');el.style.zIndex=++z;$$('.task-window-button').forEach(b=>b.classList.toggle('active',b.dataset.for===el.dataset.winId))}
function dragWindow(el){const bar=$('.win-titlebar',el);let sx,sy,sl,st,drag=false;bar.addEventListener('pointerdown',e=>{if(el.dataset.max==='1')return;drag=true;sx=e.clientX;sy=e.clientY;sl=parseFloat(el.style.left)||0;st=parseFloat(el.style.top)||0;bar.setPointerCapture(e.pointerId)});bar.addEventListener('pointermove',e=>{if(!drag)return;el.style.left=`${clamp(sl+e.clientX-sx,-el.offsetWidth+90,innerWidth-90)}px`;el.style.top=`${clamp(st+e.clientY-sy,0,innerHeight-70)}px`});bar.addEventListener('pointerup',()=>drag=false)}

function openScan(id){const d=docs[id];if(!d)return;markRead(id);addEvidence(d.e,d.title);const el=makeWindow({id:'scan_'+id,title:d.title,icon:'docs',w:830,h:650,menu:false,status:d.cap,body:`<div class="scan-tools"><button class="tool-btn" data-zin>放大</button><button class="tool-btn" data-zout>缩小</button><button class="tool-btn" data-fit>适合窗口</button><span style="margin-left:auto;font-size:11px">${esc(d.cap)}</span></div><div class="scan-view"><figure class="scan-frame"><img src="${SCAN(d.file)}" alt="${esc(d.title)}"><figcaption class="scan-caption"><span>${esc(d.ev)}</span><span>扫描件</span></figcaption></figure></div>`});
  const img=$('.scan-frame img',el);let zoom=1;const apply=()=>img.style.width=`${zoom*100}%`; $('[data-zin]',el).onclick=()=>{zoom=Math.min(2.2,zoom+.2);apply()};$('[data-zout]',el).onclick=()=>{zoom=Math.max(.6,zoom-.2);apply()};$('[data-fit]',el).onclick=()=>{zoom=1;apply()};
  if(state.restored)setTimeout(checkTruth,0);
}

function openDocuments(){
  const rows=[['grandpa_note','便笺_床底木箱.webp','2019-11-23 02:17','扫描图像'],['work_card','工务段工作证_复印.webp','2004-03-07 19:42','扫描图像'],...(state.restored?[['family_calendar','旧挂历_1993-07.webp','2004-03-07 20:01','扫描图像'],['grass_substitute','材料清单_旧布草.webp','2004-03-07 20:08','扫描图像']]:[])];
  const body=`<div class="split"><aside class="sidepane"><h4>文件和文件夹任务</h4><a href="#" data-open="recent">查看最近打开的文件</a><a href="#" data-open="site">打开送孩路资料档</a><h4>其他位置</h4><a>桌面</a><a>我的电脑</a><a>回收站</a></aside><div class="mainpane"><table class="file-list"><thead><tr><th>名称</th><th>修改日期</th><th>类型</th></tr></thead><tbody>${rows.map(([id,n,t,ty])=>`<tr data-doc="${id}" class="${state.read.includes(id)?'':'new'}"><td><span class="file-chip"><img src="${ICON('docs')}">${n}</span></td><td>${t}</td><td>${ty}</td></tr>`).join('')}</tbody></table><div class="system-note"><b>文件夹属性</b><span>多数扫描件写入于2004、2009、2019三段时间；原始纸件日期另见各文件页眉。</span></div></div></div>`;
  const el=makeWindow({id:'documents',title:'我的文档',icon:'folder',body,status:`${rows.length} 个对象`});$$('[data-doc]',el).forEach(r=>r.ondblclick=()=>openScan(r.dataset.doc)); $('[data-open="recent"]',el).onclick=e=>{e.preventDefault();openRecent()};$('[data-open="site"]',el).onclick=e=>{e.preventDefault();openOldSite()};
}
function openRecent(){
  addEvidence('recent','最近文件集中指向1993','2019年最后访问的材料也都与那一年有关');
  const pre=[['production_contact','宣传片_联系单.scan','摄制组缓存'],['cast_list','儿童临演名单.scan','摄制组缓存'],['script_note','场记_B卷_T03.scan','摄制组缓存']];
  const later=state.login2?['2019_杨元成.eml','阿穗_索引.txt','删除清单.cache']:state.login1?['B03_接触印样.tif','T03_母带.vhs','场记_B03.scan']:pre.map(x=>x[1]);
  const clickable=!state.login1?pre.map(([id,n,loc],i)=>`<tr data-recent-doc="${id}"><td><span class="file-chip"><img src="${ICON('docs')}">${n}</span></td><td>${i===0?'刚刚':'2019-11-'+(23-i)}</td><td>C:\\LMG\\cache\\${loc}</td></tr>`).join(''):later.map((n,i)=>`<tr><td>${n}</td><td>${i===0?'刚刚':'2019-11-'+(23-i)}</td><td>C:\\LMG\\1993\\</td></tr>`).join('');
  const body=`<div class="mainpane"><h3 style="font-size:14px;margin-top:0">最近打开的文档</h3><table class="file-list"><thead><tr><th>名称</th><th>最后访问</th><th>位置</th></tr></thead><tbody>${clickable}</tbody></table><div class="plain-memo" data-case-note><b>1993_最后一条核对.txt</b><br><span>名单：6　场记：6　杨元成电话：最后一条人数对不上。<br>待核：B卷接触印样 / T03原始母带。</span></div><div class="system-note"><b>最近记录异常</b><span>本机多年未开机，第一项却显示“刚刚”；其余访问记录停在2019年11月。${!state.login1?' 摄制组缓存中仍有联系单、临演名单和一页场记。':''}</span></div><p style="font-size:12px">关联位置：<a href="#" data-site>送孩路旧俗资料档</a></p></div>`;
  const el=makeWindow({id:'recent',title:'最近使用的文档',icon:'recent',body,status:'最近记录：3'});$('[data-site]',el).onclick=e=>{e.preventDefault();openOldSite()};$$('[data-recent-doc]',el).forEach(r=>r.ondblclick=()=>openScan(r.dataset.recentDoc));$('[data-case-note]',el).ondblclick=()=>{makeWindow({id:'case_note',title:'记事本 - 1993_最后一条核对.txt',icon:'notepad',w:610,h:360,body:`<div class="notepad-page">1993 / 宣传片最后一条<br><br>正式临演名单：6人<br>场记登记：6人<br>杨元成电话：最后一条人数对不上<br><br>不能先下结论。<br>待核：B卷接触印样、T03原始母带。<br><br>—— 林守义，2019-11</div>`,status:'纯文本 · 2019-11-23'});addEvidence('case_goal','爷爷最后的核对目标','先证明最后一条到底有几个人，不把电话转述当答案')};
}

const sitePages={
 home:`<h2>送孩路旧俗资料档</h2><p>这是林守义退休后整理的个人资料页。樟城这边同一件旧事，隔两条街就能讲出两个版本。我把听来的和找得到的纸件分开记，免得年纪大了把人话当成规矩。</p><div class="site-note"><b>最近补记（2019-11）</b><br>1993年的宣传片资料又收到一批。杨元成电话里只说了一句：最后一条人数对不上。正式名单还是六个。原片没核完以前，这句话先不挂公开页，材料放本机影像卷。</div><h3>索引</h3><ul><li><a data-page="road">“送孩路”条目</a></li><li><a data-page="tail">牵魂线与队尾空位</a></li><li><a data-page="bbs">留言板缓存</a></li><li><a data-page="about">关于本站 / 联系站长</a></li></ul><p class="visitor">访问计数：003871 · 最后更新 2019-11-23</p>`,
 road:`<h2>送孩路</h2><p>旧支线K7附近那段路，早先没这个正式地名。七八十年代以后事故多，老人不让小孩天黑走，慢慢就叫开了。</p><p>有人把所有事故都往“送孩”上套，我不同意。铁路边本来就危险，旧路照明也差。</p><p>1993年7月，电视台在这里拍过一段铁路宣传片。现场临演是六个孩子。</p><div class="site-note">我把这一条单独标1993，不是因为传说。是因为拍片那天家里也出了事。</div>`,
 tail:`<h2>牵魂线 / 队尾空位（问答）</h2><p><b>问：是不是让人排队过路口？</b><br>老说法里确实有“搭肩、逐个喊小名”的做法，但各家讲得不一样。我母亲说要挨着喊，我二叔就说他小时候根本没听过这一句。</p><p><b>问：为什么队尾要空？</b><br>我家听的是：队尾留一格，活人不能临时补。我问过老人为什么，只得一句“那格不是给娃站的”。再问就不答了。</p><p><b>问：草替是什么？</b><br>旧布草扎的小替身。至少我家留下来的清单写的是草替，不是活人。</p><div class="site-note">1993那一页我一直没写完。别的说法可以错，这一条我不敢混：队尾不要补活人。</div>`,
 bbs:`<h2>留言板缓存 2004—2015</h2><table class="bbs"><tr><th>时间</th><th>昵称</th><th>内容</th></tr><tr><td>2005-06</td><td>东巷老张</td><td>送孩路就是旧路口，别传成鬼路。小时候我们照走。</td></tr><tr><td>2007-09</td><td>老工务</td><td>93年电视台确实来拍过。孩子六个，我记得有个老抢镜。</td></tr><tr><td>2011-03</td><td>铁小92届</td><td>你说的蓝白书包我有点印象，东巷二小那边学生很多都背。</td></tr><tr><td>2014-08</td><td>匿名</td><td>你是不是在找94年出事那个孩子？报纸没写名。</td></tr><tr><td>2015-02</td><td>站长</td><td>先别往“换命”上说。没有证据。</td></tr></table>`,
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
 {id:'2514',name:'检修演练',schedule:'14:37',eta:76,a:'定位',b:'定位',lock:false,msg:'检修回送；2DG 存在一段临时施工封锁窗口。',block:'检修线',dynamic:true}
];
function openTrain(){
  const liveRows=runPlans.map((r,i)=>`<div class="dispatch-row" data-live="${i}"><span class="dispatch-id">${r.id}</span><span class="dispatch-time">${r.schedule}</span><span class="dispatch-route">${r.block}</span><span class="dispatch-distance" data-livedist>等待</span><span class="dispatch-bar"><i data-livebar></i></span></div>`).join('');
  const body=`<div class="train-app"><section class="train-controls"><div class="interlock"><div class="interlock-title">樟城铁路职工培训系统 · 区间调度训练器 2003</div><div class="lever-grid"><div class="lever"><label>1# 道岔</label><div class="toggle-pair"><button data-lever="a" data-v="定位">定位</button><button data-lever="a" data-v="反位">反位</button></div></div><div class="lever"><label>2# 道岔</label><div class="toggle-pair"><button data-lever="b" data-v="定位">定位</button><button data-lever="b" data-v="反位">反位</button></div></div><div class="lever"><label><input type="checkbox" data-lock> 区间锁闭</label><small>联锁建立后，冲突进路会被系统拒绝。</small></div><div class="lever"><label>信号</label><div>状态：<b data-signal>关闭</b></div><small data-route-note>列车按训练时钟持续接近。</small></div></div><button class="signal-btn" data-run>建立进路并开放信号</button></div><div class="run-sheet"><b>今日训练运行表</b><table><thead><tr><th>时刻</th><th>车次</th><th>任务</th></tr></thead><tbody>${runPlans.map((r,i)=>`<tr data-runrow="${i}" class="${i===state.trainStep?'current':''}"><td>${r.schedule}</td><td>${r.id}</td><td>${r.msg}</td></tr>`).join('')}</tbody></table><div class="run-sheet-foot">训练时钟不会判定失败：来不及建立进路时，列车会在机外停车并记录晚点。</div></div><div class="train-tools"><button class="tool-btn" data-demo>查看操作说明</button><button class="tool-btn ${state.trainFails>=3&&!state.trainDone?'assist-ready':''}" data-assist ${state.trainFails>=3&&!state.trainDone?'':'disabled'}>演示当前一步</button><button class="tool-btn" data-history ${state.trainDone?'':'disabled'}>训练历史</button>${state.trainDone&&state.identity?'<button class="tool-btn" data-replay>1993-07-12 历史回放</button>':''}</div></section><section class="train-screen"><div class="dispatch-live"><div class="dispatch-head"><b>实时运行监视 / 压缩时标</b><span data-simclock>14:30:00</span><span class="closure-state" data-closure>2DG：正常</span></div><div class="dispatch-rows">${liveRows}</div><div class="track-status"><span data-block="1DG">1DG</span><span data-block="2DG">2DG</span><span data-block="SIDE">侧线</span><span data-block="PLAT">站台线</span></div></div><div class="three-stage" data-three><div class="fallback-rail"><img class="fallback-rail-bg" src="assets/rail_fallback.webp" alt="铁路线路模拟预览"><div class="fallback-motion" aria-hidden="true"></div></div></div><div class="train-log" data-log>系统自检完成。联锁仿真：正常。<br>训练时钟开始；0312 次正在接近。<br>等待第 ${Math.min(state.trainStep+1,3)} 项训练。</div></section></div>`;
  const el=makeWindow({id:'train',title:'区间调度训练器 2003',icon:'train',w:1080,h:720,body,menu:false,status:'TRAIN.EXE · build 2003.10 / REALTIME MODE'});
  let cfg={a:'定位',b:'定位'},busy=false,closed=false,clockTimer=null,lastWarn=-1;
  const stage=$('[data-three]',el),lockBox=$('[data-lock]',el),openedAt=performance.now(),phaseEntered=[0,0,0];if(state.trainStep<3)phaseEntered[state.trainStep]=openedAt;
  const runtime={stopped:[false,false,false],recorded:[false,false,false],late:[0,0,0],done:[state.trainStep>0,state.trainStep>1,state.trainStep>2]};
  const simStart=14*3600+30*60;
  const nowSec=()=>Math.max(0,(performance.now()-openedAt)/1000);
  const simTime=()=>{let q=simStart+Math.floor(nowSec());return `${String(Math.floor(q/3600)%24).padStart(2,'0')}:${String(Math.floor(q/60)%60).padStart(2,'0')}:${String(q%60).padStart(2,'0')}`};
  const closureLeft=()=>state.trainStep===2?Math.max(0,18-(performance.now()-(phaseEntered[2]||performance.now()))/1000):0;
  const routeVariants=p=>p.dynamic?[{a:'反位',b:'反位',lock:true,key:'side'},{a:p.a,b:p.b,lock:p.lock,key:'direct'}]:[{a:p.a,b:p.b,lock:p.lock,key:'normal'}];
  const routeCheck=(p,lock)=>{const hit=routeVariants(p).find(r=>r.a===cfg.a&&r.b===cfg.b&&r.lock===lock);if(!hit)return {ok:false,reason:'道岔位置或锁闭条件与当前运行图不符。'};if(p.dynamic&&hit.key==='direct'&&closureLeft()>0)return {ok:false,reason:`2DG 施工封锁尚余 ${Math.ceil(closureLeft())} 秒；可改经侧线锁闭通过，或等待封锁解除。`};return {ok:true,key:hit.key}};
  const syncRailVisual=()=>{stage.dataset.routeA=cfg.a;stage.dataset.routeB=cfg.b;stage.dataset.locked=lockBox.checked?'1':'0';loadThree().then(m=>m?.setRailRoute?.(stage,{...cfg,lock:lockBox.checked})).catch(()=>{})};
  const setLever=(name,val)=>{$$(`[data-lever="${name}"]`,el).forEach(x=>x.classList.toggle('on',x.dataset.v===val));cfg[name]=val;syncRailVisual()};
  $$('[data-lever]',el).forEach(b=>b.onclick=()=>{if(busy)return;setLever(b.dataset.lever,b.dataset.v)});lockBox.onchange=()=>{if(!busy)syncRailVisual()};setLever('a','定位');setLever('b','定位');
  const log=m=>{const l=$('[data-log]',el);l.innerHTML+=`<br>${esc(m)}`;l.scrollTop=l.scrollHeight};
  const runBtn=$('[data-run]',el),assist=$('[data-assist]',el);
  const unlockAssist=()=>{if(state.trainFails>=3&&!state.trainDone){assist.disabled=false;assist.classList.add('assist-ready')}};
  const updateBlocks=()=>{const active=state.trainStep;$$('[data-block]',el).forEach(x=>x.classList.remove('occupied','locked','closed','approach'));if(active<3){const p=runPlans[active];const key=p.dynamic&&cfg.a==='反位'?'SIDE':active===1?'PLAT':'1DG';$(`[data-block="${key}"]`,el)?.classList.add(busy?'occupied':'approach');if(lockBox.checked)$(`[data-block="${key}"]`,el)?.classList.add('locked')}if(closed)$('[data-block="2DG"]',el)?.classList.add('closed')};
  const refreshLive=()=>{
    if(!el.isConnected){clearInterval(clockTimer);return}
    $('[data-simclock]',el).textContent=simTime();
    const current=state.trainStep;
    const cLeft=closureLeft();closed=current===2&&cLeft>0;
    const cs=$('[data-closure]',el);cs.textContent=closed?`2DG：施工封锁 ${Math.ceil(cLeft)}s`:'2DG：正常';cs.classList.toggle('closed',closed);
    runPlans.forEach((p,i)=>{const row=$(`[data-live="${i}"]`,el),dist=$('[data-livedist]',row),bar=$('[data-livebar]',row);row.classList.remove('active','done','stopped','future');if(i<current||state.trainDone){row.classList.add('done');dist.textContent='已通过';bar.style.width='100%';return}const left=p.eta-nowSec();if(i===current){row.classList.add('active');if(left<=0&&!busy){runtime.stopped[i]=true;runtime.late[i]=Math.floor(-left);row.classList.add('stopped');dist.textContent=`机外停车 +${runtime.late[i]}s`;bar.style.width='100%';if(!runtime.recorded[i]){runtime.recorded[i]=true;log(`${p.id}：未及时建立进路，列车已在机外停车。联锁系统保持安全，可继续处理。`);beep(265,.12,.018)}}else if(busy){dist.textContent='通过中';bar.style.width='100%'}else{const total=Math.max(8,p.eta-(i?runPlans[i-1].eta:0));const localLeft=Math.max(0,left);const progress=clamp(1-localLeft/Math.max(1,p.eta),0,1);const metres=Math.max(90,Math.round((1-progress)*1500/10)*10);dist.textContent=`距信号约 ${metres} m`;bar.style.width=`${Math.max(4,progress*100)}%`;loadThree().then(m=>m?.setRailApproach?.(stage,progress)).catch(()=>{});if(left<9&&left>0&&lastWarn!==i){lastWarn=i;beep(520,.07,.012);setTimeout(()=>beep(520,.07,.012),110)}}}else{row.classList.add('future');dist.textContent=left>0?`预计 ${Math.ceil(left)}s 后到达`:'等待前车处理';bar.style.width=`${clamp((1-Math.max(0,left)/p.eta)*100,0,96)}%`}});
    updateBlocks();loadThree().then(m=>m?.setRailClosure?.(stage,closed)).catch(()=>{});
  };
  runBtn.onclick=async()=>{
    if(busy)return;if(state.trainDone){log('全部训练已完成。');return}
    const p=runPlans[state.trainStep],lock=$('[data-lock]',el).checked,route=routeCheck(p,lock);
    if(route.ok){busy=true;runBtn.disabled=true;if(runtime.stopped[state.trainStep]){const late=Math.max(1,runtime.late[state.trainStep]);state.trainStops++;state.trainDelay+=late;log(`${p.id}：进路建立，机外停车后恢复运行；本次晚点 ${late} 秒。`)}else log(`${p.id}：进路检查通过。信号开放。`);if(p.dynamic&&route.key==='side')log('调度决策：避开 2DG 施工封锁，经侧线锁闭通过。');$('[data-signal]',el).textContent='开放';loadThree().then(m=>m?.setRailSignal?.(stage,true)).catch(()=>{});updateBlocks();try{await runTrainScene(el,state.trainStep);runtime.done[state.trainStep]=true;state.trainStep++;state.trainFails=0;if(state.trainStep<3)phaseEntered[state.trainStep]=performance.now();if(state.trainStep>=3){state.trainDone=true;addEvidence('train_credentials','训练历史：操作员 LSY / 职工号 0712');log('训练完成。成绩记录与操作员档案已解锁。');$('[data-history]',el).disabled=false;assist.disabled=true}else{$$('[data-runrow]',el).forEach((r,i)=>r.classList.toggle('current',i===state.trainStep));log(`下一车次已进入调度窗口：${runPlans[state.trainStep].id}。`)}}finally{$('[data-signal]',el).textContent='关闭';loadThree().then(m=>m?.setRailSignal?.(stage,false)).catch(()=>{});busy=false;runBtn.disabled=false;save();updateWorld();refreshLive()}}
    else{state.trainFails++;state.trainErrors++;save();log(`联锁拒绝：${route.reason} 当前 1#${cfg.a} / 2#${cfg.b} / 锁闭${lock?'是':'否'}。`);beep(190,.09,.015);unlockAssist();if(state.trainFails===3)log('培训系统：连续三次未通过，可点击“演示当前一步”。演示只摆好一条当前可用进路，仍需你亲自开放信号。')}
  };
  $('[data-demo]',el).onclick=()=>toast('操作说明','列车会按压缩训练时钟持续接近。先看运行表和区间状态，再设置1#、2#道岔与锁闭并开放信号。来不及不会失败，只会机外停车并记录晚点；第三阶段的施工封锁既可以等待解除，也可以尝试另建不冲突进路。',7600);
  assist.onclick=()=>{if(assist.disabled||state.trainDone)return;const p=runPlans[state.trainStep];let r=routeVariants(p)[0];if(p.dynamic&&closureLeft()<=0)r=routeVariants(p)[1];setLever('a',r.a);setLever('b',r.b);lockBox.checked=r.lock;syncRailVisual();log(`演示：第 ${state.trainStep+1} 项已摆好一条当前可用进路。请自己点击“建立进路并开放信号”完成最后一步。`);beep(330,.08,.015)};
  $('[data-history]',el).onclick=()=>openTrainHistory(); if($('[data-replay]',el))$('[data-replay]',el).onclick=()=>openReplay(el);
  loadThree().then(mod=>{if(el.isConnected){mod?.mountRailScene?.(stage);mod?.setRailRoute?.(stage,{...cfg,lock:lockBox.checked});mod?.setRailSignal?.(stage,false);refreshLive()}}).catch(()=>{});
  clockTimer=setInterval(refreshLive,500);refreshLive();
  const oldClose=$('.win-controls [data-act="close"]',el).onclick;$('.win-controls [data-act="close"]',el).onclick=()=>{clearInterval(clockTimer);oldClose?.()};
}
async function runTrainScene(el,idx){playAudio('switch_motor.wav',.12);playAudio('relay.wav',.18);playAudio('train_pass.wav',.19);beep(155,.07,.014);setTimeout(()=>beep(230,.08,.011),120);const fb=$('.fallback-rail',el);fb?.classList.remove('passing');void fb?.offsetWidth;fb?.classList.add('passing');loadThree().then(m=>m?.playRailTrain?.($('[data-three]',el),idx)).catch(()=>{});await new Promise(r=>setTimeout(r,900))}
function openTrainHistory(){
  if(!state.trainDone)return;const delay=Number(state.trainDelay)||0,mm=String(Math.floor(delay/60)).padStart(2,'0'),ss=String(delay%60).padStart(2,'0');const body=`<div class="mainpane"><h3>训练历史 / 操作员资料</h3><div class="training-report"><div>樟城铁路分局 · 区间调度训练系统</div><hr><div class="report-grid"><span>训练任务</span><b>TR-03</b><span>安全违章</span><b>0</b><span>进路冲突/拒绝</span><b>${state.trainErrors||0}</b><span>机外停车</span><b>${state.trainStops||0}</b><span>累计晚点</span><b>${mm}:${ss}</b><span>考核结果</span><b>合格</b></div><hr><div class="report-grid credentials"><span>操作员</span><b>LSY</b><span>职工号</span><b>0712</b></div></div><table class="file-list"><tr><th>姓名</th><td>林守义</td></tr><tr><th>最近成绩</th><td>2003-10-11 · 合格</td></tr><tr><th>历史资料卷</th><td>1993 / 1994 / 2004</td></tr></table><div class="system-note"><b>训练记录</b><span>操作员档案可供同机离线卷验证使用。口令规则请以影像库“帮助”为准。</span></div></div>`;makeWindow({id:'trainhistory',title:'训练历史',icon:'train',w:660,h:560,body,status:'OPERATOR.DAT / PRINT PREVIEW'});addEvidence('operator','操作员代号 LSY，职工号 0712');
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
function openMediaHub(){if(!state.login1){openArchiveLogin();return}const body=`<div class="mainpane"><h3>1993影像检查工具</h3><table class="file-list"><tr data-open-film><td><span class="file-chip"><img src="${ICON('film')}">35mm胶片光台</span></td><td>${state.filmDone?'顺序已恢复':'3张接触表待排序'}</td></tr><tr data-open-vhs><td><span class="file-chip"><img src="${ICON('media')}">VHS母带分析台</span></td><td>${state.vhs7?'已保存关键帧书签':'T01 / T02 / T03'}</td></tr></table><div class="system-note"><b>工具说明</b><span>接触表用于核对边码与拍摄连续性；母带用于逐帧、声道和时间码复核。软件不提供人数识别。</span></div></div>`;const el=makeWindow({id:'mediahub',title:'影像检查台',icon:'media',w:720,h:450,body,status:'2 个工具'});$('[data-open-film]',el).ondblclick=openFilm;$('[data-open-vhs]',el).ondblclick=openVHS;}

function openFilm(){
  const unsolved=[{id:'c',img:'contact_c.webp',code:'93-0712-B03',take:'T03 / 正式'},{id:'a',img:'contact_a.webp',code:'93-0712-B01',take:'T03 / 试拍A'},{id:'b',img:'contact_b.webp',code:'93-0712-B02',take:'T03 / 试拍B'}];
  const cards=state.filmDone?[unsolved[1],unsolved[2],unsolved[0]]:unsolved;
  const finalButton=state.filmDone?'<button class="tool-btn" data-final-print>查看最终接触印样</button>':'';
  const body=`<div class="film-app"><div class="light-toolbar"><button class="tool-btn" data-check>核对顺序</button><button class="tool-btn" data-mag>放大镜：关</button><button class="tool-btn" data-slant>斜光：关</button>${finalButton}<span style="margin-left:auto;font-size:11px">35mm B卷 · T03</span></div><div class="light-surface"><div class="film-slot-label">按边码与曝光连续性，把三张整张接触表排回拍摄顺序</div><div class="film-strips">${cards.map(x=>`<div class="film-card" draggable="true" data-id="${x.id}"><img src="${FILM(x.img)}" alt="胶片接触表"><div class="film-code"><span>${x.code}</span><span>${x.take}</span></div></div>`).join('')}</div></div><div class="light-footer"><span data-film-status>${state.filmDone?'已恢复顺序：B01 → B02 → B03':'接触表未排序'}</span><span>灰尘/卷曲模拟：ON</span></div></div><div class="magnifier"></div>`;
  const el=makeWindow({id:'film',title:'35mm 胶片光台复原',icon:'film',w:1080,h:680,body,menu:false,status:'ROLL B / T03'});
  const strips=$('.film-strips',el);let drag=null,mag=false,slant=false;
  $$('.film-card',el).forEach(c=>{c.ondragstart=()=>{drag=c;c.classList.add('dragging')};c.ondragend=()=>{c.classList.remove('dragging');drag=null};c.ondragover=e=>{e.preventDefault();const box=c.getBoundingClientRect();if(drag&&drag!==c)strips.insertBefore(drag,e.clientX<box.left+box.width/2?c:c.nextSibling)}});
  const openPrint=()=>makeWindow({id:'final_print',title:'最终接触印样 B-03 / T03',icon:'film',w:900,h:650,menu:false,status:'B-03 / T03 / FINAL CONTACT PRINT',body:`<div class="scan-view"><figure class="scan-frame"><img src="${FILM('final_print.webp')}" alt="最终接触印样"><figcaption class="scan-caption"><span>连续原始材料：最后一条为七人</span><span>B-03</span></figcaption></figure></div>`});
  const bindPrint=()=>{const b=$('[data-final-print]',el);if(b)b.onclick=openPrint};bindPrint();
  $('[data-check]',el).onclick=()=>{const order=$$('.film-card',el).map(x=>x.dataset.id).join('');if(order==='abc'){state.filmDone=true;state.filmFails=0;save();addEvidence('film7','胶片连续性恢复','B03最后一条出现未登记的第七个孩子，试拍边缘已经能看到蓝白书包');addEvidence('roll_b03','胶片卷标 B-03');$('[data-film-status]',el).textContent='顺序正确：B01 → B02 → B03。最后一条人数与正式名单不一致。';if(!$('[data-final-print]',el)){const b=document.createElement('button');b.className='tool-btn';b.dataset.finalPrint='1';b.textContent='查看最终接触印样';b.onclick=openPrint;$('.light-toolbar',el).insertBefore(b,$('.light-toolbar span',el))}updateWorld()}else{state.filmFails++;save();$('[data-film-status]',el).textContent=state.filmFails>=2?'仍不连续。只看每张底部边码：B01 → B02 → B03；系统不会替你排好。':'顺序不连续。先比较三张底部边码与相邻曝光。'}};
  $('[data-mag]',el).onclick=()=>{mag=!mag;$('[data-mag]',el).textContent=`放大镜：${mag?'开':'关'}`;$('.magnifier',el).style.display=mag?'block':'none';playAudio('film_click.wav',.11);beep(620,.035,.006)};
  $('.light-surface',el).onmousemove=e=>{if(!mag)return;const m=$('.magnifier',el);m.style.left=`${e.clientX-95}px`;m.style.top=`${e.clientY-95}px`;const img=e.target.closest?.('.film-card img');if(img){const r=img.getBoundingClientRect(),rx=clamp((e.clientX-r.left)/r.width,0,1),ry=clamp((e.clientY-r.top)/r.height,0,1);m.style.backgroundImage=`url('${img.src}')`;m.style.backgroundSize=`${r.width*2.15}px ${r.height*2.15}px`;m.style.backgroundPosition=`${rx*100}% ${ry*100}%`;m.style.backgroundRepeat='no-repeat'}};
  $('[data-slant]',el).onclick=()=>{slant=!slant;$('[data-slant]',el).textContent=`斜光：${slant?'开':'关'}`;$('.light-surface',el).classList.toggle('slant-on',slant);playAudio('lightbox.wav',.085);playAudio('film_click.wav',.06);beep(180,.045,.006)};
  loadThree().then(m=>{if(el.isConnected)m?.enhanceLightTable?.($('.light-surface',el))}).catch(()=>{});
}

function openVHS(){
  let timer=null,fxRaf=0;
  const body=`<div class="vhs-app"><section class="vhs-main"><div class="vhs-screen"><div class="vhs-timecode" data-time>00:00:00:00</div><img data-frame src="${FILM('vhs_t01.webp')}" alt="1993母带画面"><canvas class="vhs-noise" data-vhsfx width="960" height="540" aria-hidden="true"></canvas></div><div class="vhs-controls"><button class="vhs-btn" data-play>▶</button><input type="range" data-seek min="0" max="69" step="0.04" value="0"><span data-time2>00:00:00</span><button class="vhs-btn" data-prev>← 1帧</button><button class="vhs-btn" data-next>1帧 →</button><button class="vhs-btn" data-book>保存帧书签</button><button class="vhs-btn" data-loop>循环T03：关</button><span class="vhs-speed">速度 <button class="vhs-btn" data-rate="0.25">0.25×</button><button class="vhs-btn" data-rate="0.5">0.5×</button><button class="vhs-btn on" data-rate="1">1×</button></span><span class="vhs-speed">画面 <button class="vhs-btn" data-zoom="1">1×</button><button class="vhs-btn" data-zoom="1.5">1.5×</button><button class="vhs-btn" data-zoom="2">2×</button></span></div></section><aside class="vhs-side"><h3>镜头</h3><div class="camera-row"><button class="vhs-btn on" data-cam="1">T01 正面</button><button class="vhs-btn" data-cam="2">T02 侧面</button><button class="vhs-btn" data-cam="3">T03 队尾</button></div><h3>声道</h3><div class="channel-row"><button class="vhs-btn" data-ch="L">L</button><button class="vhs-btn" data-ch="R">R</button><button class="vhs-btn on" data-ch="S">Stereo</button></div><div class="waveform"><canvas data-wave width="260" height="86"></canvas></div><button class="vhs-btn" data-caption>声谱字幕：关</button><div class="transcript" data-trans>母带底噪。远处有列车制动与工作人员说话。</div><h3>帧书签（最多3个）</h3><div class="bookmark-list" data-bookmarks></div><div class="system-note"><b>参考钉窗</b><span>正式临演：6人。人数识别：关闭。</span></div></aside></div>`;
  const el=makeWindow({id:'vhs',title:'VHS 影像分析台 - B卷母带',icon:'media',w:1050,h:690,body,menu:false,status:'Tape_B / 69s / 25fps',onClose:()=>{clearInterval(timer);cancelAnimationFrame(fxRaf);stopAudio(hiss)}});
  let t=0,cam=1,playing=false,ch='S',caption=false,rate=1,loop=false,zoom=1,hiss=null,vhsThree=null;
  const fx=$('[data-vhsfx]',el),fxc=fx.getContext('2d',{alpha:true}),reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function drawVhsFx(ts=0){
    const w=fx.width,h=fx.height;fxc.clearRect(0,0,w,h);
    if(!reducedMotion){
      fxc.globalAlpha=.16;for(let y=(ts/22)%6;y<h;y+=6){fxc.fillStyle='rgba(235,240,225,.18)';fxc.fillRect(0,y,w,1)}
      const band=(ts*.045)%h;fxc.fillStyle='rgba(210,220,205,.075)';fxc.fillRect(0,band,w,13);
      fxc.globalAlpha=.12;for(let i=0;i<24;i++){const x=((i*173+ts*.31)%w)|0,y=((i*97+ts*.17)%h)|0;fxc.fillStyle=i%3?'#d8d8cd':'#748078';fxc.fillRect(x,y,(i%4)+1,1)}
      if(playing&&Math.floor(ts/800)%7===0){fxc.globalAlpha=.17;fxc.fillStyle='#e8e6d8';fxc.fillRect(0,h*.84,w,2)}
    }
    fxc.globalAlpha=1;fxRaf=requestAnimationFrame(drawVhsFx)
  }
  fxRaf=requestAnimationFrame(drawVhsFx);const seek=$('[data-seek]',el),frame=$('[data-frame]',el);
  const tc=x=>{const s=Math.floor(x),f=Math.floor((x-s)*25);return `00:00:${String(s).padStart(2,'0')}:${String(f).padStart(2,'0')}`};
  function drawWave(){const c=$('[data-wave]',el),ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle='#080a09';ctx.fillRect(0,0,c.width,c.height);ctx.strokeStyle='#77b476';ctx.beginPath();for(let x=0;x<c.width;x++){let amp=10+7*Math.sin(x*.21)+4*Math.sin(x*.49);if(ch==='R'&&cam===3&&x>170&&x<205)amp+=24*Math.sin((x-170)/35*Math.PI);const y=43+Math.sin(x*.72)*amp*.45;x?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.stroke()}
  function frameSrc(){if(cam!==3)return FILM(`vhs_t0${cam}.webp`);if(t<40.5)return FILM('vhs_t03_pre.webp');if(t<=52)return FILM('vhs_t03_seven.webp');return FILM('vhs_t03_post.webp')}
  function update(){seek.value=t;$('[data-time]',el).textContent=tc(t);$('[data-time2]',el).textContent=tc(t).slice(3,11);frame.src=frameSrc();const jitter=matchMedia('(prefers-reduced-motion: reduce)').matches?0:1;frame.style.transform=`translate(${Math.sin(t*2.4)*1.2*jitter}px,${Math.sin(t*3.3)*.7*jitter}px) scale(${zoom*(1.01+Math.sin(t*.7)*.002*jitter)})`;const tr=$('[data-trans]',el);if(caption){tr.textContent=cam===3&&ch==='R'&&t>=40.5&&t<=52?'[右声道] 工作人员数到“六”后，约0.4秒又有一个较轻的童声说：“我也站好了。”':'[等价字幕] 环境声、脚步、工作人员口令；未检测到可用于直接判断人数的高亮提示。'}drawWave();vhsThree?.setVHSState?.($('.vhs-screen',el),{t,cam,ch,playing,rate})}
  function setCam(n){cam=n;$$('[data-cam]',el).forEach(b=>b.classList.toggle('on',+b.dataset.cam===n));t=n===1?8:n===2?26:42;update()}
  $$('[data-cam]',el).forEach(b=>b.onclick=()=>setCam(+b.dataset.cam));$$('[data-ch]',el).forEach(b=>b.onclick=()=>{ch=b.dataset.ch;$$('[data-ch]',el).forEach(x=>x.classList.toggle('on',x===b));update()});
  $$('[data-rate]',el).forEach(b=>b.onclick=()=>{rate=+b.dataset.rate;$$('[data-rate]',el).forEach(x=>x.classList.toggle('on',x===b))});
  $$('[data-zoom]',el).forEach(b=>b.onclick=()=>{zoom=+b.dataset.zoom;$$('[data-zoom]',el).forEach(x=>x.classList.toggle('on',x===b));update()});
  $('[data-loop]',el).onclick=()=>{loop=!loop;$('[data-loop]',el).textContent=`循环T03：${loop?'开':'关'}`;if(loop){cam=3;t=38;update()}};
  seek.oninput=()=>{t=+seek.value;cam=t<22?1:t<38?2:3;$$('[data-cam]',el).forEach(b=>b.classList.toggle('on',+b.dataset.cam===cam));update()};
  $('[data-prev]',el).onclick=()=>{t=clamp(t-.04,0,69);update()};$('[data-next]',el).onclick=()=>{t=clamp(t+.04,0,69);update()};
  $('[data-play]',el).onclick=()=>{playing=!playing;$('[data-play]',el).textContent=playing?'Ⅱ':'▶';clearInterval(timer);if(playing){if(!hiss)hiss=playAudio('vhs_hiss.wav',.075,{loop:true});timer=setInterval(()=>{t+=.2*rate;if(loop&&t>54)t=38;if(t>=69){t=69;playing=false;clearInterval(timer);stopAudio(hiss);hiss=null;$('[data-play]',el).textContent='▶'}cam=t<22?1:t<38?2:3;$$('[data-cam]',el).forEach(b=>b.classList.toggle('on',+b.dataset.cam===cam));update()},200)}else{stopAudio(hiss);hiss=null}};
  $('[data-book]',el).onclick=()=>{if(state.vhsBookmarks.length>=3){toast('帧书签','最多保存3个。');return}const b={t:+t.toFixed(2),cam};state.vhsBookmarks.push(b);if(cam===3&&t>=40.5&&t<=52){state.vhs7=true;addEvidence('vhs7','VHS T03关键帧','连续母带中队尾镜出现7个孩子，不是后期成片拼接');if(ch==='R')addEvidence('voice7','T03右声道多出一条晚半拍童声')}save();renderBookmarks();updateWorld()};
  $('[data-caption]',el).onclick=()=>{caption=!caption;$('[data-caption]',el).textContent=`声谱字幕：${caption?'开':'关'}`;update()};
  function renderBookmarks(){$('[data-bookmarks]',el).innerHTML=state.vhsBookmarks.map((b,i)=>`<button class="bookmark" data-jump="${i}">#${i+1} T0${b.cam} / ${tc(b.t)}</button>`).join('')||'<div class="bookmark">尚未保存</div>';$$('[data-jump]',el).forEach(btn=>btn.onclick=()=>{const b=state.vhsBookmarks[+btn.dataset.jump];cam=+b.cam;t=+b.t;$$('[data-cam]',el).forEach(x=>x.classList.toggle('on',+x.dataset.cam===cam));update()})}renderBookmarks();update();
  loadThree().then(m=>{if(!el.isConnected)return;vhsThree=m;m?.enhanceVHS?.($('.vhs-screen',el));m?.setVHSState?.($('.vhs-screen',el),{t,cam,ch,playing,rate})}).catch(()=>{});
}

function openSchool(){
  const items=[['school_activity','S02_活动名单.scan','姓名、年龄、班级'],['library_card','S03_借阅卡.scan','火车书 / 逾期记录'],['sports_record','S04_运动会记录.scan','50米 / 抢跑'],['classmate_note','S05_同学通讯册.scan','蓝白书包 / 数车厢'],['wish_note','S06_练习本散页.scan','“我的愿望” / 漏最后一笔'],['newspaper_1994','S01_1994报纸剪报.scan','未公布姓名男童事故']];
  const facts=[
    ['school','school_name','学校名单','姓名陈禾穗 / 7岁 / 一（4）班'],
    ['bag','bag','同学通讯册','蓝白帆布书包，侧边缝“穗”字'],
    ['field','yang_summary','场务邮件','未登记孩子一直在片场边上看'],
    ['books','library','借阅卡','连续借火车书，其中一本晚还23天'],
    ['run','sports','运动会','50米第四名，预赛抢跑两次'],
    ['wish','wish','练习本','想坐火车去很远的地方看看']
  ];
  const factRows=facts.map(([id,ev,src,txt])=>`<label class="identity-row ${has(ev)?'ready':'locked'}"><input type="checkbox" data-idfact="${id}" ${state.identityChecks.includes(id)?'checked':''} ${has(ev)?'':'disabled'}><span><b>${src}</b><small>${has(ev)?txt:'尚未读到可核对内容'}</small></span></label>`).join('');
  const body=`<div class="split"><aside class="sidepane"><h4>来源说明</h4><p>这些是爷爷保存的扫描件、剪报与复印材料，不是学校网站。</p><a data-summary>杨师傅2019附件摘要</a><h4>身份核对</h4><p>至少要有学校记录、物件细节、现场回忆三种独立来源；再选一条与死亡无关的生活细节。</p></aside><div class="mainpane"><table class="file-list"><thead><tr><th>材料</th><th>先看什么</th></tr></thead><tbody>${items.map(([id,n,d])=>`<tr data-doc="${id}" class="${state.read.includes(id)?'':'new'}"><td><span class="file-chip"><img src="${ICON('docs')}">${n}</span></td><td>${d}</td></tr>`).join('')}</tbody></table><div class="identity-board"><div class="identity-title">材料核对表 · 手动勾选你认为能互相指向同一个孩子的事实</div><div data-factrows>${factRows}</div><button class="sys-btn" data-idcheck>核对所选材料</button><div class="identity-result" data-idresult>${state.identity?'陈禾穗（阿穗）——蓝白书包，爱看火车，也会抢跑。':'还没有完成身份互证。'}</div></div></div></div>`;
  const el=makeWindow({id:'school',title:'资料汇编_学校与地方材料',icon:'docs',w:980,h:650,body,status:'6 个本地材料'});
  const refresh=()=>{const fresh=facts.map(([id,ev,src,txt])=>`<label class="identity-row ${has(ev)?'ready':'locked'}"><input type="checkbox" data-idfact="${id}" ${state.identityChecks.includes(id)?'checked':''} ${has(ev)?'':'disabled'}><span><b>${src}</b><small>${has(ev)?txt:'尚未读到可核对内容'}</small></span></label>`).join('');$('[data-factrows]',el).innerHTML=fresh;bindChecks();};
  const bindChecks=()=>$$('[data-idfact]',el).forEach(c=>c.onchange=()=>{const id=c.dataset.idfact;state.identityChecks=c.checked?[...new Set([...state.identityChecks,id])]:state.identityChecks.filter(x=>x!==id);save()});
  $$('[data-doc]',el).forEach(r=>r.ondblclick=()=>{openScan(r.dataset.doc);setTimeout(refresh,60)});$('[data-summary]',el).onclick=()=>{openMailSummary();setTimeout(refresh,60)};bindChecks();
  $('[data-idcheck]',el).onclick=()=>checkIdentity(el);
}
function checkIdentity(el=null){
  const picks=new Set(state.identityChecks);const core=picks.has('school')&&picks.has('bag')&&picks.has('field');const human=['books','run','wish'].some(x=>picks.has(x));
  if(state.vhs7&&state.tailRule&&core&&human&&!state.identity){state.identity=true;save();addEvidence('identity','身份互证完成：陈禾穗（小名阿穗）','学校记录、蓝白书包、现场回忆与至少一条普通生活细节互相对应');toast('索引匹配完成','陈禾穗，小名阿穗。蓝白书包、学校记录与场务回忆指向同一个孩子。',5600);if(el?.isConnected)$('[data-idresult]',el).textContent='陈禾穗（阿穗）——蓝白书包，爱看火车，也会抢跑。';updateWorld();return true}
  if(el?.isConnected){let miss=[];if(!state.vhs7)miss.push('还没用连续母带确认第七人');if(!state.tailRule)miss.push('还没确认队尾规则');if(!core)miss.push('学校记录 / 书包 / 场务回忆三类来源没有同时勾上');if(!human)miss.push('还缺一条与死亡无关的生活细节');$('[data-idresult]',el).textContent=miss.join('；')+'。'}
  return false;
}

function login2Body(){return `<div class="login-panel"><div class="login-head">林守义邮件离线归档 2004–2019</div><div class="login-main"><div>账号：<b>linshouyi</b> · 本地归档损坏后需要安全问题恢复。</div><div class="login-row"><label>账号</label><input data-user value="linshouyi"></div><div class="login-row"><label>2019最终确认的胶片卷标</label><input data-q1 placeholder="例如 A-01"></div><div class="login-row"><label>那个孩子的小名</label><input data-q2></div><div class="error-text" data-error></div><div class="login-actions"><button class="sys-btn" data-login>离线找回并打开</button></div><div class="helpbox">安全问题来自已经完成的调查，不需要再推公式。卷标可在胶片光台查看；小名来自身份材料。</div></div></div>`}
function openMailLogin(){if(state.login2){openMailArchive();return}const el=makeWindow({id:'login2',title:'林守义邮件归档 - 离线找回密码',icon:'mail',w:700,h:520,body:login2Body(),status:'MAIL_ARCHIVE 2004-2019'});let fail=0;$('[data-login]',el).onclick=()=>{const u=$('[data-user]',el).value.trim().toLowerCase(),a=$('[data-q1]',el).value.trim().toUpperCase().replace('－','-'),b=$('[data-q2]',el).value.trim();if(u==='linshouyi'&&a==='B-03'&&(b==='阿穗'||b==='禾穗')){state.login2=true;save();addEvidence('login2','第二次登录完成：卷标 B-03 + 小名阿穗');el.remove();$(`.task-window-button[data-for="login2"]`)?.remove();openMailArchive();updateWorld()}else{fail++;$('[data-error]',el).textContent=fail>=2?'回答不匹配。请回看胶片卷标与身份材料。':'安全问题未通过。'}}}
function openMailArchive(){
  const mails=[
   {id:'m1',from:'杨元成',date:'2019-11-18',sub:'那盘B卷我翻出来了',body:'林师傅，孩子我有印象，没在名单里。背蓝白书包，一直站边上看。B卷最后是B-03。你若真要查，先别把“换命”两个字写进站里。'},
   {id:'m2',from:'林守义（草稿）',date:'2019-11-23 01:44',sub:'未发送：名字查到了',body:'名字查到了，陈禾穗。小名阿穗。我想把名字写进站里，又怕我写下去就像在替自己找一个解释。事情是不是那样，我没有证据。'},
   {id:'m3',from:'杨元成',date:'2019-11-23 08:02',sub:'RE: 你问最后一条我再想了想',body:'你拍最后一条的时候不在摄影机旁。你在路口对面跟人说话。我记得你回来时已经喊收工了。别把你没看见的事硬记成你看见。'}
  ];
  const body=`<div class="mail-app"><aside class="mail-folders"><b>本地文件夹</b><p>收件箱 (42)</p><p>已发送 (18)</p><p>草稿 (3)</p><p>已删除 (7)</p><hr><small>账号：linshouyi<br>模式：离线</small></aside><div class="mail-list">${mails.map((m,i)=>`<div class="mail-item ${i===0?'active':''}" data-mail="${i}"><b>${m.sub}</b><br>${m.from}<br><span>${m.date}</span></div>`).join('')}</div><article class="mail-view" data-mailview></article></div>`;
  const el=makeWindow({id:'mailarchive',title:'Outlook Express - 林守义（离线归档）',icon:'mail',w:1050,h:650,body,status:'本地邮件归档 · 2004-2019'});
  const show=i=>{const m=mails[i];$('.mail-view',el).innerHTML=`<div class="mail-header">From: ${m.from}<br>Date: ${m.date}<br>Subject: ${m.sub}</div><div class="mail-body"><p>${m.body}</p>${i===1?'<span class="attachment">未发送草稿 / 未同步</span>':''}</div>`;$$('[data-mail]',el).forEach((x,j)=>x.classList.toggle('active',j===i));if(i===0)addEvidence('mail2019','2019完整邮件：杨元成确认未登记孩子在现场');if(i===1)addEvidence('draft','爷爷未发送草稿：名字查到后仍不敢把超自然因果当事实');if(i===2)addEvidence('grandpa_absent','最后一条拍摄时爷爷在路口另一侧，没有看到阿穗站进去')};$$('[data-mail]',el).forEach(x=>x.onclick=()=>show(+x.dataset.mail));show(0);
}

function openMetadata(){
  if(!state.login2){openMailLogin();return}
  const rows=[
    ['2019-11-23 02:17','HANDNOTE_2019.scan','C:\\LMG\\family\\','林守义','最后修改'],
    ['2019-11-23 01:58','阿穗_索引.txt','C:\\LMG\\1993\\','林守义','创建'],
    ['2019-11-23 01:44','draft_名字查到了.eml','C:\\MAIL\\draft\\','linshouyi','未发送'],
    ['2019-11-22 23:51','B03_contact.tif','C:\\VIDEO\\SCAN\\','杨元成','最后访问'],
    ['2019-11-18 09:14','2019_杨元成.eml','C:\\MAIL\\inbox\\','yangyc_archive','接收'],
    ['2009-05-03 21:07','同学录_陈禾穗.scan','C:\\LMG\\school\\','林守义','扫描'],
    ['2004-04-19 18:12','送孩路_旧俗站.htm','C:\\LMG\\site\\','林守义','首次创建']
  ];
  const body=`<div class="meta-app"><div class="meta-table-wrap"><table class="meta-table"><thead><tr><th data-sort="0">时间</th><th data-sort="1">文件</th><th>路径</th><th>作者</th><th>动作</th></tr></thead><tbody data-metabody>${rows.map(r=>`<tr data-row><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td>${r[4]}</td></tr>`).join('')}</tbody></table></div><aside class="meta-detail"><h3>系统取证</h3><div class="property-box" data-prop>单击文件查看属性。按“时间”排序，可以看到爷爷多年调查的高峰。</div><h3>浏览/搜索历史</h3><div class="property-box">2004：送孩路 / 牵魂线 / 铁路事故<br>2009：东巷二小 / 1994剪报<br>2019-11：<b>阿穗</b> / <b>最后一条</b> / <b>尾位</b></div><p><button class="sys-btn" data-recycle>查看回收站索引</button></p></aside></div>`;
  const el=makeWindow({id:'metadata',title:'系统属性与时间线取证',icon:'search',w:1040,h:630,body,status:'本机元数据 / 无外部网络'});
  $$('[data-row]',el).forEach((tr,i)=>tr.onclick=()=>{$('[data-prop]',el).innerHTML=`<b>${rows[i][1]}</b><br>创建/修改：${rows[i][0]}<br>路径：${rows[i][2]}<br>作者：${rows[i][3]}<br>动作：${rows[i][4]}`});
  $('[data-sort="0"]',el).onclick=()=>{const body=$('[data-metabody]',el);[...body.children].sort((a,b)=>b.cells[0].textContent.localeCompare(a.cells[0].textContent)).forEach(x=>body.append(x));addEvidence('timeline','元数据时间线','爷爷从泛泛查旧俗逐渐查到“阿穗/最后一条/尾位”，2019年集中确认');const rw=$('.win[data-win-id="recyclewin"]');if(rw)$('[data-act="close"]',rw)?.click()};$('[data-recycle]',el).onclick=openRecycle;
}
function openRecycle(){
  const locked=!state.login2,ready=has('timeline');const body=`<div class="mainpane"><h3>回收站</h3>${locked?'<p>回收站里只有普通临时文件。更旧的索引缓存需要邮件归档恢复后才能辨认来源。</p>':`<table class="file-list"><tr><th>名称</th><th>原位置</th><th>删除日期</th></tr><tr><td class="deleted">DELETE_INDEX_2019.cache</td><td>C:\\LMG\\1993</td><td>2019-11-23 02:31</td></tr><tr><td class="deleted">draft_名字查到了.eml</td><td>C:\\MAIL\\draft</td><td>2019-11-23 02:35</td></tr></table><p><button class="sys-btn" data-restore ${ready?'':'disabled'}>${ready?'恢复索引与草稿':'先核对系统时间线'}</button></p><div class="system-note"><b>删除记录</b><span>${ready?'2019-11-23：草稿保存后4分钟，索引与草稿被移入回收站；回收站未清空。':'来源路径尚未核对。请先查看系统取证中的文件时间线。'}</span></div>`}</div>`;
  const el=makeWindow({id:'recyclewin',title:'回收站',icon:'recycle',w:720,h:470,body,status:locked?'0 个可辨认对象':ready?'2 个旧索引对象 · 来源已核对':'2 个旧索引对象 · 待核对'});if(!locked&&ready)$('[data-restore]',el).onclick=()=>{state.restored=true;save();addEvidence('delete_intent','回收站恢复','爷爷2019年确认身份后曾想删资料，但最终没有清空回收站');toast('已恢复','索引和未发送草稿已恢复到原位置。');updateWorld();openFamily()};
}
function openFamily(){
  const body=`<div class="mainpane"><h3>家庭纸质材料</h3><table class="file-list"><tr data-doc="family_calendar"><td><span class="file-chip"><img src="${ICON('calendar')}">H01_旧挂历_1993-07.scan</span></td><td>7月12日晚退烧</td></tr><tr data-doc="grass_substitute"><td><span class="file-chip"><img src="${ICON('docs')}">H02_草替材料清单.scan</span></td><td>只做草替 / 队尾留空</td></tr></table><p><button class="sys-btn" data-call>拨舅舅电话</button></p><div class="system-note"><b>家庭资料索引</b><span>H01、H02均标注1993-07-12。可与B卷拍摄日期并排核对。</span></div></div>`;
  const el=makeWindow({id:'family',title:'家庭资料',icon:'calendar',w:760,h:500,body,status:'H01 / H02'});$$('[data-doc]',el).forEach(r=>r.ondblclick=()=>{openScan(r.dataset.doc);setTimeout(checkTruth,50)});$('[data-call]',el).onclick=()=>startPhone();
}
function startPhone(){
  if(!state.phone1){state.phone1=true;save();showPhone('林国良（舅舅）',`“你先别问是不是那回事。你先说，你翻到哪了。”<br><br>我说翻到1993年7月12日。电话那头停了几秒。<br><br>“那天你烧了快半个月。你爷爷说要借拍片那个队形过路口。家里人都不愿意，他自己认死理。”`,()=>{addEvidence('uncle1','舅舅确认：1993年7月12日家里做过旧法，爷爷借了拍摄队形');setTimeout(()=>{if(!state.phone2){toast('电话', '舅舅刚挂断不久，又打了回来。',2600);setTimeout(startPhone,2800)}},1200);checkTruth()});}
  else if(!state.phone2){state.phone2=true;save();showPhone('林国良（舅舅）',`“你翻到那盘带了？”<br><br>我没说话。<br><br>“他后来最怕的不是你退烧。是他发现拍片那队最后多了个娃。他说那位置本来不能站人。你爷爷没找谁顶你，他就是……把不该借的东西借了。”`,()=>{addEvidence('uncle2','舅舅确认：爷爷没有主动找活人替，真正越界是把真实孩子队伍当成仪式材料');checkTruth()});}
  else showPhone('林国良（舅舅）','“能说的我都说了。你自己把那几样东西放一起看吧。”',checkTruth);
}
function showPhone(name,html,onClose){const p=$('#phoneLayer');p.classList.remove('hidden');p.innerHTML=`<div class="phone-head">来电 / ${name}</div><div class="phone-body"><span class="phone-speaker">${name}</span><p>${html}</p><div class="phone-actions"><button class="sys-btn" data-hang>挂断</button></div></div>`;$('[data-hang]',p).onclick=()=>{p.classList.add('hidden');onClose?.()};playAudio('phone_ring.wav',.13);beep(420,.08,.02);setTimeout(()=>beep(520,.08,.018),170)}
function checkTruth(){const enough=has('calendar')&&has('grass')&&has('death')&&has('uncle1')&&has('uncle2')&&(has('vhs7')||has('film7'))&&state.identity;if(enough&&!state.truth){state.truth=true;save();addEvidence('core_truth','核心因果链已闭合','阿穗误站队尾；同日爷爷借拍摄队形给7岁的林舟做旧法；林舟当晚好转；半年后阿穗死亡');crtPeak();setTimeout(()=>toast('最后一个文件可以读了','这时手记只会确认爷爷没看见阿穗站进去，以及他为何一直查。',8000),2800);updateWorld()}}
function crtPeak(){if(state.truthWarpSeen)return;state.truthWarpSeen=true;save();const clock=$('#clockText');if(matchMedia('(prefers-reduced-motion: reduce)').matches){clock.textContent='1993-07-12';setTimeout(updateClock,1200);return}const c=$('#crtWarp');c.classList.remove('play');void c.offsetWidth;c.classList.add('play');setTimeout(()=>{clock.textContent='1993-07-12';playAudio('hdd_seek.wav',.055);setTimeout(updateClock,1100)},620)}

async function openJar(){
  if(!state.identity){toast('数字化物件','索引还没完整，不知道这件东西为什么被扫描。');return}
  state.jarFound=true;save();const body=`<div class="jar-app"><div class="jar-stage" data-jarstage><div class="fallback-jar"><img class="jar-front" src="assets/jar_front.webp" alt="粗陶留名罐正面扫描"><img class="jar-bottom" src="assets/jar_bottom.webp" alt="粗陶留名罐底部扫描，带后刻字迹"></div></div><aside class="jar-side"><h3>数字化物件查看器</h3><p>对象：粗陶罐<br>来源：林守义木箱底层<br>扫描：2019-11</p><label>斜光角度 <input type="range" min="0" max="100" value="35" data-light></label><label>旋转 <input type="range" min="0" max="360" value="0" data-rot></label><p>提示：这是档案物件，不是主线钥匙。观察底部刻痕即可。</p><div class="museum-label" data-jartext>表面有旧划痕，口沿有后期修补。底部字迹需要斜光才能辨认。</div></aside></div>`;
  const el=makeWindow({id:'jar',title:'数字化物件查看器 - 留名罐',icon:'jar',w:900,h:620,body,menu:false,status:'OBJ_2019_11 / PBR_VIEW'});const r=$('[data-rot]',el),l=$('[data-light]',el),jar=$('.fallback-jar',el);const check=()=>{const rot=+r.value,light=+l.value;jar.style.transform=`translate(-50%,-50%) rotateY(${rot}deg) rotateX(${(rot>130&&rot<240)?42:0}deg)`;jar.style.filter=`brightness(${.75+light/160})`;if(rot>150&&rot<235&&light>62){jar.classList.add('reveal');$('[data-jartext]',el).innerHTML='<b>底部后刻：禾穗</b><br>刻痕比罐体旧划痕新，旁边贴有“2019补记”目录签。';if(!state.jarNote){state.jarNote=true;save();addEvidence('jar_note','留名罐底部后刻“禾穗”','不是超自然显现，是爷爷2019年后来亲手留下的')}}};r.oninput=l.oninput=check;check();
  try{const m=await loadThree();m?.mountJar?.($('[data-jarstage]',el),v=>{if(v&&!state.jarNote){state.jarNote=true;save();addEvidence('jar_note','留名罐底部后刻“禾穗”')}})}catch{}
}

function openFinal(){if(!state.truth){toast('未发送手记','现在打开只会把答案提前说出来。先把家庭材料和1993影像对上。');return}openScan('final_note');state.finalRead=true;save();addEvidence('final','最终手记只确认爷爷的动机与缺席','核心真相在读它以前已经能推出');setTimeout(()=>openEndAction(),1200)}
function openEndAction(){
  if(!state.finalRead)return;const body=`<div class="end-action"><b>回到桌面以后，爷爷最开始那张纸还压在窗口后面。</b><p>“电脑里的东西，你看完自己定。别留着害人，也别把人家的名字再弄丢。”</p><div class="drag-folder" draggable="true" data-folder><img src="${ICON('folder')}">送孩路资料</div><p style="font-size:12px">把文件夹拖到其中一个位置。两种做法都不会被评价。</p><div class="end-drops"><div class="drop-target" data-end="archive"><img src="${ICON('archive')}"><b>新建：陈禾穗_归档</b><span>保存核心材料与姓名</span></div><div class="drop-target" data-end="delete"><img src="${ICON('recycle')}"><b>回收站</b><span>删除送孩路资料</span></div></div></div>`;const el=makeWindow({id:'endaction',title:'文件操作',icon:'folder',w:700,h:560,body,menu:false,status:'请选择资料去向'});let dragging=false;$('[data-folder]',el).ondragstart=()=>dragging=true;$$('[data-end]',el).forEach(t=>{t.ondragover=e=>e.preventDefault();t.ondrop=e=>{e.preventDefault();if(dragging)finish(t.dataset.end)}});$$('[data-end]',el).forEach(t=>t.ondblclick=()=>finish(t.dataset.end));}
function finish(kind){state.ending=kind;save();stopAudio(roomClock);stopAudio(roomAmbience);roomClock=null;roomAmbience=null;playAudio('crt_off.wav',.12);$$('.win').forEach(w=>{disposeWindowScenes(w);w.remove()});taskButtons.innerHTML='';const e=$('#endingLayer');e.classList.remove('hidden');e.innerHTML=`<div class="ending-card"><h1>留名罐</h1><p>${kind==='archive'?'我把能对得上的材料另存了一份。文件夹的名字没有再写“第七个”，只写了陈禾穗。':'我把“送孩路资料”拖进回收站。真正留下来的，反而是那些已经记住的细节。'}</p><p>后来我去了一趟送孩路。樟树早没了，铁路也换过两回。我问路边卖水的老人，认不认识陈禾穗。</p><p>他想了很久，说：“阿穗啊，认得。小时候跑得快得很。”</p><p>我就没再问了。</p><p class="name">陈禾穗　1986—1994</p>${state.jarNote?'<p style="font-size:13px;color:#aaa">归档附注：2019年，林守义曾在一只粗陶罐底部补刻“禾穗”二字。</p>':''}<button data-reset>重新收拾这台电脑</button></div>`;$('[data-reset]',e).onclick=resetGame;beep(180,.4,.015)}

function openHelp(){const body=`<div class="mainpane"><h3>本机使用说明</h3><p>双击桌面图标打开。窗口可以拖动、最小化、并排。扫描件可放大。</p><p>主线不会要求外部搜索、开发者工具或猜隐藏网址。登录规则均写在软件帮助里。</p><p>影像工具不自动框出人数；VHS支持逐帧、降速、声道切换和等价字幕。</p><p>若卡住，可以先看“最近打开”或当前系统中未读的黄色小点。</p><p><button class="sys-btn" data-hint>查阅说明（第 ${state.hints+1} 层）</button> <button class="sys-btn" data-reset>清除存档</button></p><div class="property-box" data-htext>一级提示只说明“眼前哪种材料有用”，不会给答案。</div></div>`;const el=makeWindow({id:'helpwin',title:'系统说明',icon:'help',w:660,h:490,body,status:'HELP.CHM'});$('[data-hint]',el).onclick=()=>{state.hints=Math.min(3,state.hints+1);save();const h=state.hints===1?getNaturalHint():state.hints===2?getActionHint():getDirectHint();$('[data-htext]',el).textContent=h;$('[data-hint]',el).textContent=`查阅说明（第 ${state.hints+1} 层）`};$('[data-reset]',el).onclick=()=>confirm('确定清除本地存档并重新开始？')&&resetGame()}
function getNaturalHint(){if(!state.trainDone)return'最近文件把1993、摄制资料和爷爷的工务身份连在一起；训练器是他留下的职业软件。';if(!state.login1)return'训练历史里有操作员代号与职工号；离线库登录页帮助说明了口令规则。';if(!state.filmDone)return'胶片按B01、B02、B03连续边码排序，不需要摄影专业知识。';if(!state.vhs7)return'母带有三个镜头。队尾镜值得用逐帧和帧书签自己数一次。';if(!state.identity)return'身份材料要手动核对：学校记录、蓝白书包、场务回忆三类来源缺一不可，再选一条普通生活细节。';if(!state.login2)return'第二次登录不用公式；两个安全问题的答案都已经在胶片和身份调查中出现。';if(!state.restored)return'系统取证里看时间线与回收站，重点是2019年最后一次整理。';if(!state.truth)return has('death')?'把家庭旧挂历、草替清单和舅舅电话与1993拍摄日放在同一天看。':'身份已经对上，但1994年事故还缺公开记录；回看地方剪报。';return'最终手记现在可以打开。'}
function getActionHint(){if(!state.trainDone)return'训练器里的列车会按时钟持续接近；先看运行表与区间状态，再设置1#、2#道岔、锁闭并开放信号。第三阶段可绕开临时封锁。';if(!state.login1)return'用户名来自训练历史；密码是职工号后四位 + “1993”的后两位。';if(!state.filmDone)return'把接触表排成 B01 → B02 → B03。';if(!state.vhs7)return'切到T03队尾镜，拖到约38秒以后，保存一个帧书签。';if(!state.identity)return'打开学校名单、同学通讯册、杨元成附件，再读一条阿穗的普通生活材料，然后在“材料核对表”手动勾选并核对。';if(!state.login2)return'安全问题依次是 B-03 和 阿穗。';if(!state.restored)return'打开回收站，恢复2019缓存索引与未发送草稿。';if(!state.truth)return has('death')?'读旧挂历和草替清单，然后拨舅舅电话。':'先打开学校与地方材料里的1994年报纸剪报，再回到家庭资料。';return'打开桌面的“未发送手记”。'}
function getDirectHint(){return getActionHint()}
function openPower(){const body=`<div class="mainpane" style="text-align:center;padding-top:55px"><img src="${ICON('power')}" style="width:64px"><h3>关闭计算机</h3><p>关闭前会保存当前调查状态。</p><button class="sys-btn" data-off>关机</button> <button class="sys-btn" data-cancel>取消</button></div>`;const el=makeWindow({id:'powerwin',title:'关闭 Windows',icon:'power',w:480,h:330,body,menu:false,status:'本地存档已保存'});$('[data-off]',el).onclick=()=>{save();desktop.classList.add('hidden');$('#boot').classList.remove('hidden');$('#bootCopy').innerHTML='<p style="opacity:1">现在可以安全地离开这台电脑。</p><button class="quiet-button" onclick="location.reload()">重新开机</button>'};$('[data-cancel]',el).onclick=()=>{$('[data-act="close"]',el).click()}}

function updateWorld(){renderDesktop();if(state.truth&&!$('#desktopIcons [data-id="final"]')){const b=document.createElement('button');b.className='desktop-icon unread';b.dataset.id='final';b.innerHTML=`<img src="${ICON('notepad')}" alt=""><span>未发送手记</span>`;b.ondblclick=openFinal;iconsEl.append(b)};if(has('six')&&has('contact')&&!state.trainDone)setHint('索引：正式记录 6 人 / 调度训练未完成');else if(state.trainDone&&!state.login1)setHint('索引：训练历史已开放 / 影像卷等待验证');else if(state.login1&&!state.filmDone)setHint('索引：OFFLINE_VOL 1993 / 35mm 接触表未核对');else if(state.filmDone&&!state.vhs7)setHint('索引：B01→B03 连续 / T03 母带未建立书签');else if(state.vhs7&&!state.tailRule)setHint('索引：T03 人数与名单不符 / “队尾”规则未核对');else if(state.vhs7&&!state.identity)setHint('索引：影像证据成立 / 身份材料未闭合');else if(state.identity&&!state.login2)setHint('索引：陈禾穗（阿穗） / 邮件归档等待恢复');else if(state.login2&&!state.restored)setHint('索引：2019 邮件已开放 / 删除记录待核');else if(state.restored&&!state.truth)setHint('索引：2019 调查链已恢复 / 1993 家庭线未闭合');else if(state.truth&&!state.finalRead)setHint('索引：核心时间线已闭合 / 未发送手记可读')}

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
let progressSnapshot=JSON.stringify([state.trainStep,state.login1,state.filmDone,state.vhs7,state.identity,state.login2,state.restored,state.truth]),idleMinutes=0;setInterval(()=>{const now=JSON.stringify([state.trainStep,state.login1,state.filmDone,state.vhs7,state.identity,state.login2,state.restored,state.truth]);if(now!==progressSnapshot){progressSnapshot=now;idleMinutes=0}else if(state.booted&&!state.ending){idleMinutes++;if(idleMinutes===9)setHint('停了一会儿：'+getNaturalHint())}},60000);

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
