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
// ===== Tài liệu P2 (nội dung lấy từ file .docx của nhóm) =====
const tb=(h,r)=>`<div class="scroll"><table><tr>${h.map(x=>`<th>${x}</th>`).join('')}</tr>${r.map(x=>`<tr>${x.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</table></div>`;
const ul=a=>`<ul>${a.map(x=>`<li>${x}</li>`).join('')}</ul>`;
const refDoc=[
['1. Chuẩn đầu ra',ul(['<b>Rừng:</b> đước sống ≥ 85%, che phủ ~60%, phòng hộ tốt','<b>Tôm:</b> giống sạch bệnh, cỡ 25–40 con/kg, không tồn dư kháng sinh','<b>Kinh tế:</b> có lãi ổn định từ tôm + lâm sản','<b>Môi trường:</b> nước đạt chuẩn, chu trình dinh dưỡng khép kín','<b>Chứng nhận:</b> hướng tới VietGAP (TCVN 11892-1), nâng lên ASC / Naturland'])],
['2. Điều kiện áp dụng',ul(['Vùng ven biển, ngập triều; đất bùn/sét pha','Nước lợ, độ mặn 10–25‰, không ô nhiễm','Đất/rừng hợp pháp; rừng ~60–70%, mặt nước ~30–40%'])],
['3. Chọn giống',tb(['Đối tượng','Lựa chọn'],[['Đước','Đước đôi; trụ mầm chín, 30–45 cm, cây mẹ khỏe, nguồn gốc rõ'],['Tôm sú','PL12–PL15, PCR âm tính, cơ sở giống có phép; thả 2–5 con/m²']])],
['4. Quy trình 6 giai đoạn',tb(['Giai đoạn','Thời gian','Việc chính'],[['1. Thiết kế & làm công trình','T1–5','Khảo sát, đào mương bao + mương xẻ lòng rừng, lắp cống cấp/xả'],['2. Trồng đước','Đầu mùa mưa','Cắm trụ mầm ~1×1 m, trồng dặm, chăm sóc năm 1–3'],['3. Xử lí mương & nước','2–4 tuần trước thả','Nạo vét, bón vôi, lọc nước, gây màu nước'],['4. Thả & nuôi tôm','4–5 tháng/vụ','Thả giống, lấy nước theo triều, thức ăn tự nhiên là chính, ghi nhật kí'],['5. Thu hoạch','Cuối vụ','Thu tỉa/thu toàn bộ, bảo quản lạnh, ghi sản lượng'],['6. Tỉa thưa & khai thác rừng','Năm 6–12 tỉa thưa; 15–25 năm khai thác','Giữ che phủ ~60%, thu cọc/củi, trồng lại']])+'<p><b>Chu trình sinh thái:</b> lá đước → mùn bã → vi sinh vật → phiêu sinh/giáp xác → tôm → phân tôm → dinh dưỡng cho đước.</p>'],
['5. Nghiệm thu','<p><b>Cách làm:</b> nghiệm thu theo giai đoạn, đo bằng ô tiêu chuẩn/mẫu đại diện, có biên bản và hồ sơ truy xuất.</p>'+tb(['Nhóm','Tiêu chí','Ngưỡng đạt'],[['Rừng','Tỉ lệ sống, sinh trưởng, che phủ','≥ 85%; đạt theo tuổi; ~60%'],['Nước','pH, độ mặn, DO','7,5–8,5; 10–25‰; ≥ 4 mg/L'],['Tôm','Tỉ lệ sống, sản lượng, cỡ','~50–70%; 200–500 kg/ha/vụ; 25–40 con/kg'],['An toàn','Tồn dư kháng sinh','Không phát hiện'],['Kinh tế','Lợi nhuận, ROI','Dương, đạt mục tiêu nhóm'],['Môi trường','Xả thải, đa dạng sinh học','Không xả nước bẩn; có sinh vật quay lại']])],
['6. Tiêu chuẩn đối chiếu',ul(['<b>Lâm nghiệp:</b> Luật Lâm nghiệp 2017; TT 29/2018/TT-BNNPTNT (biện pháp lâm sinh); FSC','<b>Thủy sản:</b> QCVN 02-19:2014/BNNPTNT; VietGAP TCVN 11892-1:2017','<b>Quốc tế:</b> ASC, GlobalG.A.P., Naturland'])],
['7. Rủi ro chính',ul(['Bệnh tôm → giống PCR sạch, giữ nước tốt','Độ mặn/phèn biến động → điều tiết cống, bón vôi','Xói lở bờ → giữ băng rừng, gia cố bờ','Giá tôm biến động → đa dạng hóa, chứng nhận, hợp đồng bao tiêu'])],
['8. Gợi ý lời trình bày (~2–3 phút)',ul(['Nêu chuẩn đầu ra trước, rồi nói quy trình được thiết kế ngược từ chuẩn đó.','Đi qua 6 giai đoạn, nhấn mạnh giống sạch và chu trình sinh thái.','Kết thúc bằng nghiệm thu: đo được, có chuẩn, có hồ sơ.'])]];
let zoom=+(localStorage.getItem('ce_zoom')||100);
function buildDocs(){
  $('#docs-body').innerHTML=`<div class="card"><h3>Tiến độ dự án (mẫu)</h3><table>${timeline.map(([n,d],i)=>`<tr><td>${i+1}</td><td>${n}</td><td>${fmt(d)}</td><td>${i?'Phụ thuộc bước '+i:'—'}</td></tr>`).join('')}</table></div>
  <h3>Quy trình kỹ thuật (mẫu, cần chuyên gia xác nhận)</h3>${procs.map(([t,b])=>`<details><summary>${t}</summary><p>${b}</p></details>`).join('')}
  <div class="card"><h3>Thư viện tài liệu</h3><table><tr><th>Tài liệu</th><th>Nguồn</th><th>Mô tả</th><th></th></tr>
  <tr><td>P2 – Quy trình kĩ thuật &amp; nghiệm thu (bản thuyết trình)</td><td>Tài liệu nội bộ của nhóm (chưa phải nghiên cứu đã công bố)</td><td>Bản rút gọn: chuẩn đầu ra, 6 giai đoạn, nghiệm thu, rủi ro.</td><td><button id="readP2">Đọc tài liệu</button></td></tr></table>
  <p><small>Các nguồn khác chưa được xác minh nên chưa đưa vào. Thêm vào <code>referenceDocuments</code> khi đã kiểm chứng.</small></p></div>
  <div class="card" id="reader" hidden><h3>P2 – Quy trình kĩ thuật &amp; nghiệm thu</h3>
  <p class="note">Rút gọn từ bản chi tiết. Số liệu là khoảng tham khảo, cần đối chiếu nguồn trước khi trình bày.</p>
  <div class="bar"><button id="zm">A−</button><span id="zv"></span><button id="zp">A+</button><button id="allo">Mở tất cả</button><button id="allc">Thu gọn tất cả</button><a href="P2-quy-trinh-nghiem-thu.docx" download>Tải file Word</a></div>
  <div class="toc">${refDoc.map((d,i)=>`<a href="#p2-${i}" data-i="${i}">${d[0]}</a>`).join('')}</div>
  <div id="rbody">${refDoc.map((d,i)=>`<details id="p2-${i}" open><summary>${d[0]}</summary>${d[1]}</details>`).join('')}</div></div>`;
  const setZ=v=>{zoom=clamp(v,70,160);localStorage.setItem('ce_zoom',zoom);$('#rbody').style.fontSize=zoom+'%';$('#zv').textContent=zoom+'%'};
  const all=o=>document.querySelectorAll('#rbody details').forEach(d=>d.open=o);
  $('#readP2').onclick=()=>{$('#reader').hidden=false;$('#reader').scrollIntoView({behavior:'smooth'})};
  $('#zm').onclick=()=>setZ(zoom-10);$('#zp').onclick=()=>setZ(zoom+10);$('#allo').onclick=()=>all(true);$('#allc').onclick=()=>all(false);
  document.querySelectorAll('.toc a').forEach(a=>a.onclick=e=>{e.preventDefault();const d=$('#p2-'+a.dataset.i);d.open=true;d.scrollIntoView({behavior:'smooth'})});
  setZ(zoom);}
// ===== Controls =====
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{document.querySelectorAll('nav button,.tab').forEach(e=>e.classList.remove('on'));b.classList.add('on');$('#'+b.dataset.tab).classList.add('on');draw()});
$('#pause').onclick=e=>{paused=!paused;e.target.textContent=paused?'Tiếp tục':'Tạm dừng';render()};
$('#back').onclick=()=>{sel=null;render()};
$('#reset').onclick=()=>{localStorage.removeItem(KEY);initData();render()};
document.addEventListener('change',e=>{const id=e.target.dataset.t;if(id){tasks.find(t=>t.id===id).done=e.target.checked;saveTasks();render()}});
function loop(){if(!paused)tick();timer=setTimeout(loop,2000+Math.random()*3000)}
initData();buildMap();buildDocs();for(let i=0;i<10;i++)tick();loop();
