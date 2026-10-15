'use strict';
// ===== Config: reference thresholds (DEMO values, not verified technical limits) =====
const TH={pH:[7.0,8.5],DO:[3.5,8],temp:[26,32],sal:[8,28],tr:[20,40],poll:[0,60]};
const HIST=40, KEY='ce_tasks_v1';
const $=s=>document.querySelector(s), fmt=d=>new Date(d).toLocaleDateString('vi-VN');
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const walk=(v,a,b,s)=>clamp(v+(Math.random()-.5)*2*s,a,b); // bounded gradual change
let forestZones,shrimpPonds,sensorHistory,tasks,alerts=[],paused=false,sel=null,timer;

// ===== Data =====
function initData(){
  forestZones=[1,2,3,4].map(i=>({id:'R0'+i,pair:'M0'+i,sal:12+i*2,temp:29+i*.3,hum:75+i*2,poll:15+i*5,trees:1200+i*150,healthy:88-i*2}));
  shrimpPonds=[1,2,3,4].map(i=>({id:'M0'+i,pair:'R0'+i,species:'Tôm sú (Penaeus monodon)',day:10+i*12,stocked:30000+i*5000,
    temp:28,pH:7.8,sal:15+i*2,DO:5.5,tr:30,wt:1+i*3,surv:90-i*2,feedCum:0,w0:0.01}));
  shrimpPonds.forEach(p=>{p.biomass=p.stocked*p.surv/100*p.wt/1000;p.b0=p.stocked*p.w0/1000;p.feedDay=0});
  sensorHistory={};[...forestZones,...shrimpPonds].forEach(z=>sensorHistory[z.id]=[]);
  // Tasks initialised once from Oct 2026 and saved
  const saved=localStorage.getItem(KEY);
  if(saved){tasks=JSON.parse(saved)}else{
    tasks=[];const base=new Date('2026-10-05');
    forestZones.forEach((z,i)=>{[['Kiểm tra sức khỏe cây',14],['Tỉa cành',45]].forEach(([n,d],k)=>
      tasks.push({id:z.id+k,zone:z.id,name:n,date:new Date(+base+(d+i*3)*864e5).toISOString().slice(0,10),done:false,note:'Lịch mẫu'}))});
    shrimpPonds.forEach((p,i)=>{[['Kiểm tra sức khỏe tôm',7],['Đo tăng trưởng',14],['Thu hoạch dự kiến',Math.max(10,130-p.day)]].forEach(([n,d],k)=>
      tasks.push({id:p.id+k,zone:p.id,name:n,date:new Date(+base+(d+i)*864e5).toISOString().slice(0,10),done:false,note:'Lịch mẫu'}))});
    saveTasks();}
}
const saveTasks=()=>localStorage.setItem(KEY,JSON.stringify(tasks));

// ===== Simulation =====
function stageOf(d){return d<20?['Giai đoạn đầu',.06]:d<60?['Giai đoạn giữa',.04]:['Giai đoạn cuối',.025]}
function tick(){
  const now=Date.now();
  forestZones.forEach(z=>{z.sal=walk(z.sal,0,35,.4);z.temp=walk(z.temp,20,40,.2);z.hum=walk(z.hum,40,100,1);z.poll=walk(z.poll,0,100,1.5);
    z.healthy=walk(z.healthy,50,98,.15);push(z.id,{t:now,a:z.temp,b:z.hum,c:z.healthy})});
  shrimpPonds.forEach(p=>{p.temp=walk(p.temp,24,34,.15);p.pH=walk(p.pH,6.5,9,.04);p.sal=walk(p.sal,5,30,.2);p.DO=walk(p.DO,2,8,.15);p.tr=walk(p.tr,15,45,.8);
    p.day+=.05;p.wt+=.012*(p.day<60?1.5:.7);p.surv=Math.max(60,p.surv-.002);
    p.biomass=p.stocked*p.surv/100*p.wt/1000;const f=p.biomass*stageOf(p.day)[1]/ 20; // per tick (~1/20 day)
    p.feedCum+=f;p.feedDay=f*20;push(p.id,{t:now,a:p.DO,b:p.pH,c:p.biomass})});
  evalAlerts();render();
}
function push(id,r){const h=sensorHistory[id];h.push(r);if(h.length>HIST)h.shift()}
function evalAlerts(){alerts=[];const chk=(id,n,v,[lo,hi],u)=>{if(v<lo||v>hi)alerts.push(`${id}: ${n} ${v.toFixed(1)} ${u} ngoài ngưỡng tham chiếu (${lo}–${hi})`)};
  shrimpPonds.forEach(p=>{chk(p.id,'pH',p.pH,TH.pH,'');chk(p.id,'DO',p.DO,TH.DO,'mg/L');chk(p.id,'Nhiệt độ nước',p.temp,TH.temp,'°C');chk(p.id,'Độ mặn',p.sal,TH.sal,'ppt');chk(p.id,'Độ trong',p.tr,TH.tr,'cm')});
  forestZones.forEach(z=>chk(z.id,'Chỉ số ô nhiễm',z.poll,TH.poll,''))}
const status=z=>alerts.some(a=>a.startsWith(z.id))?['Cảnh báo','warn']:['Bình thường','ok'];
const fcr=p=>{const g=p.biomass-p.b0;return g>5&&p.feedCum>5?(p.feedCum/g).toFixed(2):null};

// ===== Charts (small canvas line chart) =====
function chart(cv,series,min,max){const c=cv.getContext('2d'),w=cv.width=cv.clientWidth*2,h=cv.height=220;c.clearRect(0,0,w,h);
  series.forEach(([d,col])=>{if(d.length<2)return;c.strokeStyle=col;c.lineWidth=3;c.beginPath();
    d.forEach((v,i)=>{const x=i/(HIST-1)*w,y=h-(v-min)/(max-min)*h;i?c.lineTo(x,y):c.moveTo(x,y)});c.stroke()})}
const H=(id,k)=>sensorHistory[id].map(r=>r[k]);
function draw(){document.querySelectorAll('canvas[data-id]').forEach(cv=>{const id=cv.dataset.id,f=id[0]==='R';
  f?chart(cv,[[H(id,'a'),'#e07a1f'],[H(id,'c'),'#477653']],20,100):chart(cv,[[H(id,'a'),'#2a8fc4'],[H(id,'b'),'#c0392b']],2,10)})}

// ===== Renderers =====
const row=(l,v)=>`<span>${l}</span><b>${v}</b>`;
const T=(k,t)=>`<abbr title="${t}">${k}</abbr>`;
function zoneCard(z){const[s,c]=status(z);return `<div class="card"><h3>${z.id} <small class="${c}">● ${s}</small></h3><div class="m">
${row(T('Độ mặn','ppt = phần nghìn'),z.sal.toFixed(1)+' ppt')}${row('Nhiệt độ',z.temp.toFixed(1)+' °C')}${row('Độ ẩm',z.hum.toFixed(0)+' %')}${row('Chỉ số ô nhiễm (mô phỏng)',z.poll.toFixed(0))}
${row('Số cây ước tính',z.trees)}${row('Cây khỏe',z.healthy.toFixed(1)+' %')}</div>
<canvas data-id="${z.id}"></canvas><small>Cam: nhiệt độ · Xanh: % cây khỏe</small>${taskTable(z.id)}</div>`}
function pondCard(p){const[s,c]=status(p),f=fcr(p);return `<div class="card"><h3>${p.id} <small class="${c}">● ${s}</small></h3><p style="font-size:12px;margin:0">${p.species} · ${stageOf(p.day)[0]} (ngày ${p.day.toFixed(0)})</p><div class="m">
${row('Nhiệt độ nước',p.temp.toFixed(1)+' °C')}${row(T('pH','Độ axit/kiềm của nước'),p.pH.toFixed(2))}${row(T('Độ mặn','ppt = phần nghìn'),p.sal.toFixed(1)+' ppt')}
${row(T('DO','Oxy hòa tan (mg/L)'),p.DO.toFixed(1)+' mg/L')}${row('Độ trong',p.tr.toFixed(0)+' cm')}${row('Thả giống',p.stocked.toLocaleString('vi-VN'))}
${row('Tỉ lệ sống (ước tính)',p.surv.toFixed(1)+' %')}${row('Trọng lượng TB',p.wt.toFixed(1)+' g')}${row('Sinh khối (ước tính)',p.biomass.toFixed(0)+' kg')}
${row('Thức ăn/ngày',p.feedDay.toFixed(1)+' kg')}${row('Thức ăn tích lũy',p.feedCum.toFixed(1)+' kg')}${row(T('FCR','Hệ số chuyển đổi thức ăn'),f||'Chưa đủ dữ liệu')}</div>
<canvas data-id="${p.id}"></canvas><small>Xanh dương: DO · Đỏ: pH</small>${taskTable(p.id)}</div>`}
function taskTable(id){const t=tasks.filter(x=>x.zone===id).sort((a,b)=>a.date.localeCompare(b.date));
  return `<table>${t.map(x=>`<tr><td><input type="checkbox" data-t="${x.id}" ${x.done?'checked':''}></td><td>${x.name}</td><td>${fmt(x.date)}</td><td>${x.done?'Hoàn thành':'Chưa làm'}</td></tr>`).join('')}</table>`}
const kpi=(l,v)=>`<div class="kpi"><b>${v}</b><span>${l}</span></div>`;
const up=()=>tasks.filter(t=>!t.done).sort((a,b)=>a.date.localeCompare(b.date))[0];
function render(){
  $('#clock').textContent=new Date().toLocaleString('vi-VN')+(paused?' · Đang tạm dừng':'');
  const bio=shrimpPonds.reduce((s,p)=>s+p.biomass,0),feed=shrimpPonds.reduce((s,p)=>s+p.feedCum,0),u=up();
  const kf=kpi('Số dải rừng',forestZones.length)+kpi('Cây khỏe TB',(forestZones.reduce((s,z)=>s+z.healthy,0)/4).toFixed(1)+' %')+kpi('Cảnh báo rừng',forestZones.filter(z=>status(z)[1]=='warn').length)+kpi('Việc sắp tới',u?`${fmt(u.date)}`:'Không có');
  const ks=kpi('Số kênh nuôi',shrimpPonds.length)+kpi('Sinh khối ước tính',bio.toFixed(0)+' kg')+kpi('Thức ăn tích lũy',feed.toFixed(0)+' kg')+kpi('Cảnh báo tôm',shrimpPonds.filter(p=>status(p)[1]=='warn').length);
  $('#kpi-forest').innerHTML=kf;$('#kpi-shrimp').innerHTML=ks;$('#kpi-map').innerHTML=kf;
  $('#forest-list').innerHTML=forestZones.map(zoneCard).join('');$('#shrimp-list').innerHTML=shrimpPonds.map(pondCard).join('');
  $('#alerts').innerHTML='<b>Cảnh báo</b>'+(alerts.length?alerts.map(a=>`<div class="al">${a}</div>`).join(''):'<p>Chưa có cảnh báo: mọi chỉ số trong ngưỡng tham chiếu.</p>');
  $('#detail').innerHTML=sel?zoneCard(forestZones.find(z=>z.id==='R0'+sel))+pondCard(shrimpPonds.find(p=>p.id==='M0'+sel)):'Chọn một dải rừng hoặc kênh trên sơ đồ để xem chi tiết.';
  document.querySelectorAll('.area').forEach(a=>a.classList.toggle('sel',!!sel&&a.dataset.n==sel));
  draw();
}
// ===== Map =====
function buildMap(){let x=20,h='';const W=[110,50];
  for(let i=1;i<=4;i++){h+=`<rect class="area" data-n="${i}" x="${x}" y="30" width="${W[0]}" height="250" fill="#477653" rx="6"/><text x="${x+55}" y="160" text-anchor="middle" fill="#fff" font-weight="700" pointer-events="none">R0${i}</text>`;x+=W[0]+10;
    h+=`<rect class="area" data-n="${i}" x="${x}" y="30" width="${W[1]+40}" height="250" fill="#8ec9e8" rx="6"/><text x="${x+45}" y="160" text-anchor="middle" fill="#244C35" font-weight="700" pointer-events="none">M0${i}</text>`;
    h+=`<text x="${x+45}" y="80" text-anchor="middle" fill="#244C35" pointer-events="none">↓</text>`;x+=W[1]+40+10}
  h+=`<rect x="20" y="290" width="${x-30}" height="26" fill="#c9b27a" rx="4"/><text x="30" y="308" font-size="12">Lối đi chính</text>`;
  $('#svg').innerHTML=h;$('#svg').onclick=e=>{const n=e.target.dataset?.n;if(n){sel=n;render()}}}
// ===== Tab 3 (basic) =====
const timeline=[['Khảo sát hiện trạng','2026-10-05'],['Lập kế hoạch & xin phép','2026-10-20'],['Chuẩn bị','2026-11-15'],['Thả giống','2026-12-10'],['Theo dõi & đánh giá tăng trưởng','2027-01-10'],['Thu hoạch','2027-04-10'],['Đánh giá kinh tế & sinh thái','2027-05-10']];
const procs=[['Đánh giá rừng','Mục đích: ghi nhận hiện trạng. Dụng cụ: thước dây, GPS, phiếu ghi. Bước: lập ô mẫu, đếm cây, đánh giá sức khỏe. An toàn: mang ủng, tránh thủy triều lên.'],['Chất lượng nước','Mục đích: kiểm soát môi trường ao. Dụng cụ: máy đo pH, DO, độ mặn. Bước: đo cùng giờ mỗi ngày, ghi sổ, so với ngưỡng. An toàn: rửa tay sau khi lấy mẫu.'],['Cho ăn & sức khỏe tôm','Mục đích: tránh dư thừa thức ăn. Bước: cho ăn theo giai đoạn, kiểm tra nhá (sàng ăn), quan sát hoạt động tôm.'],['Xử lý nước bất thường','Khi DO hoặc pH ngoài ngưỡng: kiểm tra lại, ngừng cho ăn nếu cần, hỏi cán bộ kỹ thuật địa phương.']];
function buildDocs(){$('#docs-body').innerHTML=`<div class="card"><h3>Tiến độ dự án (mẫu)</h3><table>${timeline.map(([n,d],i)=>`<tr><td>${i+1}</td><td>${n}</td><td>${fmt(d)}</td><td>${i?'Phụ thuộc bước '+i:'—'}</td></tr>`).join('')}</table></div><h3>Quy trình kỹ thuật (mẫu, cần chuyên gia xác nhận)</h3>${procs.map(([t,b])=>`<details><summary>${t}</summary><p>${b}</p></details>`).join('')}<div class="card"><h3>Thư viện tài liệu</h3><p>Chưa có tài liệu nào được xác minh. Hãy thêm nguồn thật vào <code>referenceDocuments</code> trong script.js.</p></div>`}
// ===== Controls =====
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{document.querySelectorAll('nav button,.tab').forEach(e=>e.classList.remove('on'));b.classList.add('on');$('#'+b.dataset.tab).classList.add('on');draw()});
$('#pause').onclick=e=>{paused=!paused;e.target.textContent=paused?'Tiếp tục':'Tạm dừng';render()};
$('#back').onclick=()=>{sel=null;render()};
$('#reset').onclick=()=>{localStorage.removeItem(KEY);initData();render()};
document.addEventListener('change',e=>{const id=e.target.dataset.t;if(id){tasks.find(t=>t.id===id).done=e.target.checked;saveTasks();render()}});
function loop(){if(!paused)tick();timer=setTimeout(loop,2000+Math.random()*3000)}
initData();buildMap();buildDocs();for(let i=0;i<10;i++)tick();loop();
