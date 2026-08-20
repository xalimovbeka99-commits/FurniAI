/**
 * WARNING: ORPHANED STALE SOURCE FILE.
 * This standalone app.js is NOT executed by Vercel or index.html (which embeds browser script inline).
 * Do NOT use app.js as runtime authority.
 */
/* ======================= ROUTER ======================= */
let landingActive=true, builderActive=false;
function go(hash){ if(location.hash===hash){route();} else location.hash=hash; }
function route(){
  const h=location.hash;
  const m=h.match(/^#\/build(?:\/(\d+))?/);
  if(m){
    showBuilder(m[1]!==undefined?parseInt(m[1]):0);
  }else{
    showLanding();
    // allow in-page anchors on landing
    if(h && h!=='#/' && h.startsWith('#') && !h.startsWith('#/')){
      const el=document.querySelector(h); if(el) setTimeout(()=>el.scrollIntoView({behavior:'smooth'}),30);
    }
  }
}
addEventListener('hashchange',route);

function showLanding(){
  document.getElementById('view-builder').hidden=true;
  document.getElementById('view-landing').hidden=false;
  landingActive=true; builderActive=false;
  document.body.style.overflow='';
}
function showBuilder(id){
  document.getElementById('view-landing').hidden=true;
  document.getElementById('view-builder').hidden=false;
  landingActive=false; builderActive=true;
  document.body.style.overflow='hidden';
  if(!Builder.ready) Builder.init();
  Builder.load(id);
  // size the renderer now that the stage has dimensions
  requestAnimationFrame(()=>Builder.resize());
}

/* header scroll */
const hd=document.getElementById('hd');
addEventListener('scroll',()=>{hd&&hd.classList.toggle('scrolled',scrollY>20)});

/* reveal */
const io=new IntersectionObserver((es)=>{es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.12});
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));

/* ===== shared design data ===== */
const DESIGNS=[
  {name:'Glass Wardrobe',type:'wardrobe',sections:4,drows:2,drawers:3,shelves:4,doorType:'glass',mat:'oak',handle:'gold',led:'warm',w:240,h:240,d:60,basePrice:18500},
  {name:'Brown Kitchen',type:'kitchen',sections:5,drows:2,drawers:4,shelves:3,doorType:'solid',mat:'walnut',handle:'push',led:'warm',w:300,h:240,d:60,basePrice:32000},
  {name:'Kitchen + Island',type:'kitchen_island',sections:4,drows:2,drawers:3,shelves:2,doorType:'solid',mat:'taupe',handle:'black',led:'cool',w:280,h:230,d:60,basePrice:48000},
  {name:'Classic Kitchen',type:'kitchen',sections:5,drows:2,drawers:3,shelves:3,doorType:'solid',mat:'taupe',handle:'gold',led:'warm',w:320,h:240,d:60,basePrice:38000},
  {name:'L Wardrobe',type:'walkin_l',sections:4,drows:1,drawers:3,shelves:5,doorType:'glass',mat:'oak',handle:'black',led:'warm',w:260,h:240,d:55,basePrice:42000},
  {name:'U Wardrobe',type:'walkin_u',sections:5,drows:1,drawers:3,shelves:4,doorType:'open',mat:'cream',handle:'black',led:'warm',w:300,h:250,d:55,basePrice:58000},
  {name:'Grey Wardrobe',type:'wardrobe',sections:6,drows:2,drawers:3,shelves:3,doorType:'solid',mat:'grey',handle:'black',led:'warm',w:280,h:240,d:62,basePrice:16500},
  {name:'White Kitchen',type:'kitchen_l',sections:5,drows:2,drawers:3,shelves:2,doorType:'solid',mat:'white',handle:'push',led:'warm',w:300,h:240,d:60,basePrice:36000},
  {name:'U Kitchen',type:'kitchen_u',sections:5,drows:1,drawers:3,shelves:2,doorType:'solid',mat:'grey',handle:'black',led:'warm',w:340,h:240,d:60,basePrice:54000},
  {name:'L Corner Cupboard',type:'walkin_l',sections:4,drows:1,drawers:0,shelves:5,doorType:'solid',mat:'walnut',handle:'gold',led:'off',w:220,h:210,d:50,basePrice:21000},
  {name:'Oak Double Vanity',type:'vanity_freestanding',sections:4,drows:1,drawers:4,shelves:1,doorType:'solid',mat:'oak',handle:'black',led:'warm',w:180,h:85,d:55,basePrice:8500},
  {name:'Floating Walnut Vanity',type:'vanity_floating',sections:2,drows:1,drawers:2,shelves:0,doorType:'solid',mat:'walnut',handle:'push',led:'warm',w:120,h:60,d:50,basePrice:6200},
  {name:'Cream Single Vanity',type:'vanity_freestanding',sections:2,drows:1,drawers:2,shelves:1,doorType:'solid',mat:'cream',handle:'gold',led:'cool',w:90,h:85,d:50,basePrice:4800},
  {name:'Taupe Triple Vanity',type:'vanity_freestanding',sections:6,drows:1,drawers:6,shelves:2,doorType:'solid',mat:'taupe',handle:'black',led:'warm',w:220,h:85,d:55,basePrice:12500},
  {name:'Mini Floating Vanity',type:'vanity_floating',sections:1,drows:1,drawers:1,shelves:0,doorType:'solid',mat:'white',handle:'push',led:'off',w:60,h:55,d:45,basePrice:3400},
];
const MAT={
  oak:{color:0xc8a87a,rough:0.75,metal:0,label:'Oak',code:'OAK-NAT',css:'linear-gradient(135deg,#d8bd92,#c19c68)'},
  walnut:{color:0x6e5236,rough:0.7,metal:0,label:'Walnut',code:'WAL-DK',css:'linear-gradient(135deg,#7d5e3c,#5d4329)'},
  white:{color:0xf2f1ec,rough:0.45,metal:0,label:'White MDF',code:'MDF-WHT',css:'linear-gradient(135deg,#f6f4ee,#e3ddd0)'},
  grey:{color:0x4e4f52,rough:0.5,metal:0,label:'Graphite',code:'GRPH-MT',css:'linear-gradient(135deg,#56575a,#3a3b3e)'},
  taupe:{color:0xb0a294,rough:0.55,metal:0,label:'Taupe',code:'TAU-MT',css:'linear-gradient(135deg,#bcae9e,#a08f7b)'},
  cream:{color:0xe6ddcd,rough:0.5,metal:0,label:'Cream',code:'CRM-ST',css:'linear-gradient(135deg,#efe7d8,#ded2bd)'},
};
const HANDLE={gold:0xc9a248,black:0x161616,chrome:0xd8d8dc,push:null,none:null};
const MATKEYS=['oak','walnut','white','grey','taupe','cream'];

/* ===== landing: cut list ===== */
const CL=[['Side panel L','Oak 18mm','2382 × 582','2'],['Top / bottom','Oak 18mm','2364 × 582','2'],['Back panel','MDF 6mm','2364 × 2346','1'],['Shelf','Oak 18mm','582 × 564','4'],['Door — glass','Alu + glass','1180 × 596','4'],['Drawer front','Oak 18mm','582 × 178','3'],['Drawer box side','Birch 12mm','540 × 150','6'],['Plinth','Oak 18mm','2364 × 80','1']];
const clb=document.getElementById('clBody');
CL.forEach(r=>{const tr=document.createElement('tr');tr.innerHTML=`<td><b>${r[0]}</b></td><td>${r[1]}</td><td class="mm">${r[2]}</td><td>${r[3]}</td>`;clb.appendChild(tr)});

/* ===== landing: materials row ===== */
const mr=document.getElementById('matsRow');
MATKEYS.forEach(k=>{const m=MAT[k];const d=document.createElement('div');d.className='mat';d.innerHTML=`<div class="sw" style="background:${m.css}"></div><div class="nm">${m.label}</div><div class="cd">${m.code}</div>`;mr.appendChild(d)});

/* ===== landing: dimension signature ===== */
(function buildDims(){
  const s=document.getElementById('dimsvg');const N='http://www.w3.org/2000/svg';
  const mk=(t,a)=>{const e=document.createElementNS(N,t);for(const k in a)e.setAttribute(k,a[k]);return e};
  const defs=mk('defs',{});const m=mk('marker',{id:'ah',markerWidth:'8',markerHeight:'8',refX:'4',refY:'4',orient:'auto'});
  m.appendChild(mk('path',{d:'M0,1 L7,4 L0,7',stroke:'#211E19','stroke-width':'1',fill:'none',opacity:'.6'}));defs.appendChild(m);s.appendChild(defs);
  const line=(x1,y1,x2,y2,cls,delay,arr)=>{const L=Math.hypot(x2-x1,y2-y1);const ln=mk('line',{x1,y1,x2,y2,class:'draw '+(cls||'')});ln.style.setProperty('--len',L);ln.style.animationDelay=delay+'s';if(arr){ln.setAttribute('marker-start','url(#ah)');ln.setAttribute('marker-end','url(#ah)')}s.appendChild(ln)};
  const txt=(x,y,t,delay,rot)=>{const e=mk('text',{x,y,class:'fade','text-anchor':'middle'});e.style.animationDelay=delay+'s';if(rot)e.setAttribute('transform','rotate(90 '+x+' '+y+')');e.textContent=t;s.appendChild(e)};
  line(452,70,452,452,'',1.0,true);line(430,70,460,70,'ext',1.0);line(430,452,460,452,'ext',1.1);txt(470,261,'2400',1.7,true);
  line(60,486,440,486,'',1.2,true);line(60,464,60,496,'ext',1.2);line(440,464,440,496,'ext',1.3);txt(250,505,'2400 mm',1.9);
  line(60,52,150,52,'',1.35,true);txt(105,42,'600',2.0);
})();

/* ===== HERO 3D ===== */
let hScene,hCam,hRen;const HG=new THREE.Group();
function dk(c,f){const r=(c>>16&255)*f,g=(c>>8&255)*f,b=(c&255)*f;return(r<<16)|(g<<8)|(b|0)}
function heroInit(){
  const cv=document.getElementById('hero3d');const wrap=cv.parentElement;const W=wrap.clientWidth,H=wrap.clientHeight;
  hScene=new THREE.Scene();hCam=new THREE.PerspectiveCamera(38,W/H,.01,100);
  hRen=new THREE.WebGLRenderer({canvas:cv,antialias:true,alpha:true});hRen.setPixelRatio(Math.min(devicePixelRatio,2));hRen.setSize(W,H);
  hRen.shadowMap.enabled=true;hRen.shadowMap.type=THREE.PCFSoftShadowMap;hRen.outputEncoding=THREE.sRGBEncoding;hRen.toneMapping=THREE.ACESFilmicToneMapping;hRen.toneMappingExposure=1.08;
  hScene.add(new THREE.HemisphereLight(0xffffff,0xcfc6b6,.7));
  const key=new THREE.DirectionalLight(0xfff1da,1.05);key.position.set(3,5,4);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.near=.5;key.shadow.camera.far=20;key.shadow.camera.left=-3;key.shadow.camera.right=3;key.shadow.camera.top=3;key.shadow.camera.bottom=-3;key.shadow.bias=-.0004;hScene.add(key);
  const fill=new THREE.DirectionalLight(0xdfe8ff,.3);fill.position.set(-4,2,-2);hScene.add(fill);
  heroWardrobe();
  const fl=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.MeshStandardMaterial({color:0xe3d9c7,roughness:.92}));fl.rotation.x=-Math.PI/2;fl.position.y=-1.22;fl.receiveShadow=true;hScene.add(fl);
  hLoop();
}
function hp(w,h,d,c,x,y,z,ro,me){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color:c,roughness:ro!==undefined?ro:.72,metalness:me||0}));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;HG.add(m);return m}
function heroWardrobe(){
  const W=1.7,H=2.0,D=.46,N=4,P=.018,mc=0xc8a87a;const plH=.07,bb=-H/2+plH,ih=H-plH,sw=(W-P*(N+1))/N;const nd=3,dh=.12,dzb=bb+nd*dh,dzh=(H/2-P)-dzb;
  hp(W*.97,plH,D*.9,0x1a1a1a,0,-H/2+plH/2,-D*.02,.85);hp(W,P,D,dk(mc,.85),0,bb-P/2,0,.6);hp(W,P,D,mc,0,H/2-P/2,0);hp(P,ih,D,mc,-W/2+P/2,bb+ih/2,0);hp(P,ih,D,mc,W/2-P/2,bb+ih/2,0);hp(W-P*2,ih-P,P,dk(mc,.7),0,bb+ih/2,-D/2+P/2,.85);
  for(let i=0;i<N;i++){const x=-W/2+P+sw/2+i*(sw+P);if(i<N-1)hp(P,ih,D,mc,x+sw/2+P/2,bb+ih/2,0);
    for(let s=0;s<4;s++)hp(sw,P*.7,D-.04,dk(mc,.9),x,dzb+dzh*(s+1)/5,.005);
    const rod=new THREE.Mesh(new THREE.CylinderGeometry(.01,.01,sw*.9,10),new THREE.MeshStandardMaterial({color:0xbfc2c7,roughness:.3,metalness:.8}));rod.rotation.z=Math.PI/2;rod.position.set(x,dzb+dzh*.92,.03);HG.add(rod);
    const led=hp(sw*.76,P*.25,.008,0xffd9a0,x,H/2-P-.01,D/2-.03,.4,0);led.material.emissive=new THREE.Color(0xffd9a0);led.material.emissiveIntensity=.9;
    for(let dr=0;dr<2;dr++){const ddh=dzh/2,dy=dzb+dzh-ddh/2-dr*ddh;
      const g=new THREE.Mesh(new THREE.BoxGeometry(sw-.006,ddh-.006,.01),new THREE.MeshStandardMaterial({color:0xaaccd6,roughness:.05,metalness:.1,transparent:true,opacity:.2}));g.position.set(x,dy,D/2);g.castShadow=true;HG.add(g);
      const fr=new THREE.MeshStandardMaterial({color:0x161616,roughness:.4,metalness:.3});
      [ddh/2-.003,-ddh/2+.003].forEach(yy=>{const f=new THREE.Mesh(new THREE.BoxGeometry(sw-.006,.018,.018),fr);f.position.set(x,dy+yy,D/2);HG.add(f)});
      [-sw/2+.006,sw/2-.006].forEach(xx=>{const f=new THREE.Mesh(new THREE.BoxGeometry(.018,ddh-.006,.018),fr);f.position.set(x+xx,dy,D/2);HG.add(f)});
      const bar=new THREE.Mesh(new THREE.CylinderGeometry(.006,.006,ddh*.32,10),new THREE.MeshStandardMaterial({color:0xc9a248,roughness:.25,metalness:.85}));bar.position.set((i%2===0?x+sw/2-.04:x-sw/2+.04),dy,D/2+.012);HG.add(bar);}
    for(let dd=0;dd<nd;dd++){const dy=bb+dh/2+dd*dh;hp(sw-.008,dh-.008,.018,dk(mc,.96),x,dy,D/2);const bar=new THREE.Mesh(new THREE.CylinderGeometry(.006,.006,sw*.3,10),new THREE.MeshStandardMaterial({color:0xc9a248,roughness:.25,metalness:.85}));bar.rotation.z=Math.PI/2;bar.position.set(x,dy,D/2+.014);HG.add(bar);}}
  hScene.add(HG);
}
let ht0=Date.now();
function hLoop(){requestAnimationFrame(hLoop);if(!landingActive||!hRen)return;const t=(Date.now()-ht0)/1000;HG.rotation.y=Math.sin(t*.18)*.5+.35;hCam.position.set(0,.55,3.0);hCam.lookAt(0,0,0);hRen.render(hScene,hCam)}
addEventListener('resize',()=>{if(!hRen)return;const wrap=document.getElementById('hero3d').parentElement;const W=wrap.clientWidth,H=wrap.clientHeight;hRen.setSize(W,H);hCam.aspect=W/H;hCam.updateProjectionMatrix()});

/* ===== GALLERY cards + thumbnails ===== */
const grid=document.getElementById('galleryGrid');const thumbs=[];
DESIGNS.forEach((g,i)=>{
  const card=document.createElement('div');card.className='card reveal';
  const typeLabel=g.type.replace('_',' ');
  card.innerHTML=`<div class="canvas-box"><div class="price">AED ${g.basePrice.toLocaleString()}</div><div class="open-pill">Customise →</div><canvas></canvas></div>
    <div class="meta"><div class="type">${typeLabel}</div><h3>${g.name}</h3>
    <div class="dims"><span>W <b>${g.w}</b></span><span>H <b>${g.h}</b></span><span>D <b>${g.d}</b> cm</span></div></div>`;
  card.addEventListener('click',()=>go('#/build/'+i));
  grid.appendChild(card);io.observe(card);
  thumbs.push({cv:card.querySelector('canvas'),g});
});
function initThumb(th){
  const {cv,g}=th;const box=cv.parentElement;const W=box.clientWidth||320,H=box.clientHeight||256;
  const sc=new THREE.Scene();const cam=new THREE.PerspectiveCamera(40,W/H,.01,100);
  sc.add(new THREE.HemisphereLight(0xffffff,0xcfc6b6,.75));const k=new THREE.DirectionalLight(0xfff1da,1.0);k.position.set(2,4,3);sc.add(k);
  const grp=new THREE.Group();const mc=MAT[g.mat].color;
  const isK=g.type.indexOf('kitchen')===0;
  const W3=g.w/170,H3=g.h/170,D3=g.d/170,P=.016,N=isK?5:4;const sw=(W3-P*(N+1))/N;
  const mk=(w,h,d,c,x,y,z,ro,me)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color:c,roughness:ro!==undefined?ro:.7,metalness:me||0}));m.position.set(x,y,z);grp.add(m);return m};
  const dkk=(c,f)=>{const r=(c>>16&255)*f,gg=(c>>8&255)*f,b=(c&255)*f;return(r<<16)|(gg<<8)|(b|0)};
  mk(W3,P,D3,mc,0,H3/2-P/2,0);mk(W3,P,D3,dkk(mc,.85),0,-H3/2+P/2,0);mk(P,H3,D3,mc,-W3/2+P/2,0,0);mk(P,H3,D3,mc,W3/2-P/2,0,0);mk(W3-P*2,H3-P*2,P,dkk(mc,.72),0,0,-D3/2+P/2,.85);
  for(let i=0;i<N;i++){const x=-W3/2+P+sw/2+i*(sw+P);if(i<N-1)mk(P,H3,D3,mc,x+sw/2+P/2,0,0);
    if(g.doorType==='glass'){const gm=new THREE.Mesh(new THREE.BoxGeometry(sw-.005,H3-P*2,.008),new THREE.MeshStandardMaterial({color:0xaaccd6,roughness:.05,metalness:.1,transparent:true,opacity:.22}));gm.position.set(x,0,D3/2);grp.add(gm);for(let s=0;s<4;s++)mk(sw,P*.6,D3-.03,dkk(mc,.9),x,-H3/2+P+(H3-P*2)*(s+.5)/4,0);}
    else if(g.doorType==='open'){for(let s=0;s<4;s++)mk(sw,P*.6,D3-.03,dkk(mc,.9),x,-H3/2+P+(H3-P*2)*(s+.5)/4,0);}
    else{if(isK){mk(sw-.006,H3*.42,.014,dkk(mc,.96),x,-H3/2+H3*.21+P,D3/2);mk(sw-.006,H3*.34,.014,mc,x,H3/2-H3*.20,D3*.3);}
      else{mk(sw-.006,H3-P*2-.006,.016,mc,x,0,D3/2);}}}
  if(isK)mk(W3,.03,D3+.03,0x141414,0,-H3/2+H3*.42+P,.01,.25,.1);
  sc.add(grp);

  let ren = null;
  th.visible = false;

  const vio=new IntersectionObserver(es=>{
    es.forEach(e=>{
      th.visible=e.isIntersecting;
      if(th.visible){
        if(!ren){
          ren=new THREE.WebGLRenderer({canvas:cv,antialias:true,alpha:true});
          ren.setPixelRatio(Math.min(devicePixelRatio,2));ren.setSize(W,H);
          ren.outputEncoding=THREE.sRGBEncoding;ren.toneMapping=THREE.ACESFilmicToneMapping;ren.toneMappingExposure=1.05;
        }
      } else {
        if(ren){
          ren.dispose();
          ren=null;
        }
      }
    })
  },{threshold:.02});
  vio.observe(box);

  let tt=Math.random()*6;
  (function loop(){requestAnimationFrame(loop);if(!landingActive||!th.visible||!ren)return;tt+=.005;grp.rotation.y=Math.sin(tt*.5)*.45+.3;cam.position.set(0,.35,3.0);cam.lookAt(0,0,0);ren.render(sc,cam)})();
}

/* ============================================================
   BUILDER — full parametric configurator (corner shapes, drawer boxes)
   ============================================================ */
const Builder={
  ready:false, scene:null,cam:null,ren:null, parts:[],doorObjs:[],drawerObjs:[],
  doorsOpen:false,drawersOpen:false,animDoors:false,animDrawers:false,
  doorAngle:0,drawerOffset:0,targetDoor:0,targetDrawer:0,
  cfg:null,currentParent:null,
  rotY:.5,rotX:.06,camDist:4.6,lookAtZ:0,
  isDragging:false,lastMx:0,lastMy:0,
  P:0.018,

  init(){
    const cv=document.getElementById('bld3d');const wrap=cv.parentElement;const W=wrap.clientWidth||800,H=wrap.clientHeight||600;
    this.scene=new THREE.Scene();this.scene.fog=new THREE.Fog(0xe8e0d2,9,22);
    this.cam=new THREE.PerspectiveCamera(40,W/H,.01,100);
    this.ren=new THREE.WebGLRenderer({canvas:cv,antialias:true,alpha:true});this.ren.setPixelRatio(Math.min(devicePixelRatio,2));this.ren.setSize(W,H);
    this.ren.shadowMap.enabled=true;this.ren.shadowMap.type=THREE.PCFSoftShadowMap;this.ren.outputEncoding=THREE.sRGBEncoding;this.ren.toneMapping=THREE.ACESFilmicToneMapping;this.ren.toneMappingExposure=1.05;
    this.scene.add(new THREE.HemisphereLight(0xffffff,0xc7bdaa,.65));
    const key=new THREE.DirectionalLight(0xfff2e0,1.0);key.position.set(3,5,4);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.near=.5;key.shadow.camera.far=24;key.shadow.camera.left=-5;key.shadow.camera.right=5;key.shadow.camera.top=5;key.shadow.camera.bottom=-5;key.shadow.bias=-.0004;this.scene.add(key);
    const fill=new THREE.DirectionalLight(0xdfe8ff,.35);fill.position.set(-4,2,-2);this.scene.add(fill);
    const fl=new THREE.Mesh(new THREE.PlaneGeometry(50,50),new THREE.MeshStandardMaterial({color:0xddd2be,roughness:.9}));fl.rotation.x=-Math.PI/2;fl.receiveShadow=true;fl.position.y=-1.3;fl.name='floor';this.scene.add(fl);
    this.bindUI();this.setupOrbit();this.ready=true;this.loop();
  },
  setupOrbit(){
    const cv=document.getElementById('bld3d');const self=this;
    cv.addEventListener('mousedown',e=>{self.isDragging=true;self.lastMx=e.clientX;self.lastMy=e.clientY});
    addEventListener('mouseup',()=>self.isDragging=false);
    addEventListener('mousemove',e=>{if(!self.isDragging)return;self.rotY+=(e.clientX-self.lastMx)*.008;self.rotX+=(e.clientY-self.lastMy)*.005;self.rotX=Math.max(-.35,Math.min(.55,self.rotX));self.lastMx=e.clientX;self.lastMy=e.clientY});
    cv.addEventListener('wheel',e=>{self.camDist+=e.deltaY*.005;self.camDist=Math.max(1.8,Math.min(12,self.camDist));e.preventDefault()},{passive:false});
    // touch
    cv.addEventListener('touchstart',e=>{self.isDragging=true;self.lastMx=e.touches[0].clientX;self.lastMy=e.touches[0].clientY},{passive:true});
    cv.addEventListener('touchmove',e=>{if(!self.isDragging)return;self.rotY+=(e.touches[0].clientX-self.lastMx)*.01;self.rotX+=(e.touches[0].clientY-self.lastMy)*.006;self.rotX=Math.max(-.35,Math.min(.55,self.rotX));self.lastMx=e.touches[0].clientX;self.lastMy=e.touches[0].clientY},{passive:true});
    cv.addEventListener('touchend',()=>self.isDragging=false);
  },
  resize(){if(!this.ren)return;const wrap=document.getElementById('bld3d').parentElement;const W=wrap.clientWidth,H=wrap.clientHeight;if(W&&H){this.ren.setSize(W,H);this.cam.aspect=W/H;this.cam.updateProjectionMatrix()}},

  attach(o){(this.currentParent||this.scene).add(o);this.parts.push(o);return o},
  box(w,h,d,color,x,y,z,rough,metal){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color,roughness:rough!==undefined?rough:.7,metalness:metal||0}));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;this.attach(m);return m},
  roundedShape(w,h,r){const s=new THREE.Shape();const x=-w/2,y=-h/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s},
  frontPanel(w,h,depth,color,rough,metal){const shape=this.roundedShape(w,h,Math.min(w,h)*.04);const geo=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelThickness:.004,bevelSize:.004,bevelSegments:2});geo.center();return new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal}))},

  clear(){this.parts.forEach(p=>{if(p.parent)p.parent.remove(p);p.traverse&&p.traverse(c=>{if(c.geometry)c.geometry.dispose()});if(p.geometry)p.geometry.dispose()});this.parts=[];this.doorObjs=[];this.drawerObjs=[];this.doorAngle=0;this.drawerOffset=0;this.targetDoor=0;this.targetDrawer=0;this.doorsOpen=false;this.drawersOpen=false;this.animDoors=false;this.animDrawers=false;this.currentParent=null;document.getElementById('toggle-doors').classList.remove('on');document.getElementById('toggle-drawers').classList.remove('on')},

  build(){this.clear();const T=this.cfg.type;
    if(T==='kitchen'||T==='kitchen_l'||T==='kitchen_island')this.buildKitchen();
    else if(T==='walkin_l')this.buildWalkinL();
    else if(T==='walkin_u')this.buildWalkinU();
    else if(T.startsWith('vanity'))this.buildVanity();
    else this.buildWardrobe();
    const fl=this.scene.getObjectByName('floor');
    if(fl){
      if(T==='vanity_floating') fl.position.y=-this.cfg.h/100/2-0.25;
      else fl.position.y=-this.cfg.h/100/2-.001;
    }
    this.updatePrice();},

  wall(opts){const P=this.P;const W=opts.length,H=opts.H,D=opts.D,N=opts.sections;const m=MAT[this.cfg.mat],mc=m.color;
    const plH=.08,bb=-H/2+plH,ih=H-plH,sw=(W-P*(N+1))/N;const dh=.13,skip=opts.cornerSkip;
    this.box(W*.97,plH,D*.9,0x1a1a1a,0,-H/2+plH/2,-D*.02,.85);this.box(W,P,D,dk(mc,.85),0,bb-P/2,0,.6);this.box(W,P,D,mc,0,H/2-P/2,0,m.rough);
    this.box(P,ih,D,mc,-W/2+P/2,bb+ih/2,0,m.rough);this.box(P,ih,D,mc,W/2-P/2,bb+ih/2,0,m.rough);this.box(W-P*2,ih-P,P,dk(mc,.7),0,bb+ih/2,-D/2+P/2,.85);
    for(let i=0;i<N;i++){const x=-W/2+P+sw/2+i*(sw+P);if(i<N-1)this.box(P,ih,D,mc,x+sw/2+P/2,bb+ih/2,0,m.rough);
      const isCorner=(skip==='left'&&i===0)||(skip==='right'&&i===N-1)||(skip==='both'&&(i===0||i===N-1));
      const sectionLayout=opts.sectionLayouts&&opts.sectionLayouts[i];
      const nd=isCorner?0:(sectionLayout?sectionLayout.drawers:(opts.drawers||0)); // no drawers in a blind corner cell
      const dzb=bb+nd*dh,dzh=(H/2-P)-dzb;                    // door zone above any drawers (full height in corner)
      const sh=sectionLayout?sectionLayout.shelves:(opts.shelves||0);for(let s=0;s<sh;s++)this.box(sw,P*.7,D-.05,dk(mc,.92),x,dzb+dzh*(s+1)/(sh+1),.005,m.rough);
      if(opts.hasRod&&!isCorner){const rod=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,sw*.9,12),new THREE.MeshStandardMaterial({color:0xbfc2c7,roughness:.3,metalness:.8}));rod.rotation.z=Math.PI/2;rod.position.set(x,dzb+dzh*.92,.04);rod.castShadow=true;this.attach(rod)}
      if(opts.hasLed&&this.cfg.led!=='off'){const ledC=this.cfg.led==='warm'?0xffd9a0:0xcfe6ff;const led=this.box(sw*.78,P*.25,.008,ledC,x,H/2-P-.01,D/2-.03,.4,0);led.material.emissive=new THREE.Color(ledC);led.material.emissiveIntensity=.9}
      this.makeDoor(sw-.006,dzh-.006,x,dzb+dzh/2,D/2,isCorner?'open':opts.doorType,null,(i%2===0)?'left':'right'); // single door per cell (corner cell has no door)
      for(let dd=0;dd<nd;dd++){const dy=bb+dh/2+dd*dh;this.makeDrawer(sw-.008,dh-.008,D-.03,x,dy,D/2)}}},

  buildWardrobe(){const W=this.cfg.w/100,H=this.cfg.h/100,D=this.cfg.d/100;
    this.wall({length:W,H,D,sections:this.cfg.sections,drawers:this.cfg.drawers,shelves:this.cfg.shelves,sectionLayouts:this.cfg.sectionLayouts,doorType:this.cfg.doorType,hasLed:true,hasRod:true})},

  buildWalkinL(){const H=this.cfg.h/100,D=this.cfg.d/100,backLen=this.cfg.w/100,sideLen=Math.min(backLen*.65,2.6);
    let g=new THREE.Group();g.position.set(0,0,-sideLen/2);this.attach(g);this.currentParent=g;
    this.wall({length:backLen,H,D,sections:this.cfg.sections,drawers:this.cfg.drawers,shelves:this.cfg.shelves,doorType:this.cfg.doorType,hasLed:true,hasRod:true,cornerSkip:'left'});this.currentParent=null;
    g=new THREE.Group();g.position.set(-backLen/2+D/2,0,D/2);g.rotation.y=Math.PI/2;this.attach(g);this.currentParent=g;
    const sN=Math.max(2,Math.round(this.cfg.sections*sideLen/backLen));
    this.wall({length:sideLen,H,D,sections:sN,drawers:this.cfg.drawers,shelves:this.cfg.shelves,doorType:this.cfg.doorType,hasLed:true,hasRod:true,cornerSkip:'left'});this.currentParent=null},

  buildWalkinU(){const H=this.cfg.h/100,D=this.cfg.d/100,backLen=this.cfg.w/100,sideLen=Math.min(backLen*.6,2.6);
    let g=new THREE.Group();g.position.set(0,0,-sideLen/2);this.attach(g);this.currentParent=g;
    this.wall({length:backLen,H,D,sections:this.cfg.sections,drawers:this.cfg.drawers,shelves:this.cfg.shelves,doorType:this.cfg.doorType,hasLed:true,hasRod:true,cornerSkip:'both'});this.currentParent=null;
    const sN=Math.max(2,Math.round(this.cfg.sections*sideLen/backLen));
    g=new THREE.Group();g.position.set(-backLen/2+D/2,0,D/2);g.rotation.y=Math.PI/2;this.attach(g);this.currentParent=g;
    this.wall({length:sideLen,H,D,sections:sN,drawers:this.cfg.drawers,shelves:this.cfg.shelves,doorType:this.cfg.doorType,hasLed:true,hasRod:true,cornerSkip:'left'});this.currentParent=null;
    g=new THREE.Group();g.position.set(backLen/2-D/2,0,D/2);g.rotation.y=-Math.PI/2;this.attach(g);this.currentParent=g;
    this.wall({length:sideLen,H,D,sections:sN,drawers:this.cfg.drawers,shelves:this.cfg.shelves,doorType:this.cfg.doorType,hasLed:true,hasRod:true,cornerSkip:'right'});this.currentParent=null},

  // one straight kitchen run (base with mixed doors/drawers + thin counter + single-door uppers), centred at local origin
  kitchenRun(W,opts){const P=this.P;const H=this.cfg.h/100,D=opts.D;const m=MAT[this.cfg.mat],mc=m.color;
    const plH=.08,ctrH=H*.42,upH=H*.36,bb=-H/2+plH,ctrTop=bb+ctrH,ctT=.02,ctOF=.025,ctOS=.012,ctY=ctrTop+ctT/2;
    const upBot=ctY+ctT/2+H*.16,upTop=upBot+upH,upD=D*.58,upZ=-D/2+upD/2;const ctop=0x141414,splash=0x7d7a72;
    const upColor=this.cfg.mat==='walnut'?0xd6d4ca:(this.cfg.mat==='taupe'?0xccc6bd:mc);
    const N=opts.sections,sw=(W-P*(N+1))/N,skip=opts.cornerSkip,nd=Math.max(2,this.cfg.drawers);
    this.box(W*.97,plH,D*.9,0x1a1a1a,0,bb-plH/2,-D*.02,.85);this.box(W,P,D,dk(mc,.85),0,bb+P/2,0,.6);
    this.box(P,ctrH,D,mc,-W/2+P/2,bb+ctrH/2,0,m.rough);this.box(P,ctrH,D,mc,W/2-P/2,bb+ctrH/2,0,m.rough);
    this.box(W-P*2,ctrH-P,P,dk(mc,.72),0,bb+ctrH/2+P/2,-D/2+P/2,m.rough);
    this.box(W+ctOS*2,ctT,D+ctOF,ctop,0,ctY,ctOF/2,.2,.15);
    this.box(W,upBot-ctY-ctT/2,.01,splash,0,(ctY+ctT/2+upBot)/2,-D/2+.005,.6);
    this.box(W,P,upD,upColor,0,upTop,upZ,.5);this.box(W,P,upD,upColor,0,upBot,upZ,.5);this.box(P,upH,upD,upColor,-W/2+P/2,upBot+upH/2,upZ,.5);this.box(P,upH,upD,upColor,W/2-P/2,upBot+upH/2,upZ,.5);
    this.box(W-P*2,upH-P,P,dk(upColor,.72),0,upBot+upH/2,upZ-upD/2+P/2,.5);
    for(let i=0;i<N;i++){const x=-W/2+P+sw/2+i*(sw+P);
      if(i<N-1){this.box(P,ctrH,D,mc,x+sw/2+P/2,bb+ctrH/2,0,m.rough);this.box(P,upH,upD,upColor,x+sw/2+P/2,upBot+upH/2,upZ,.5)}
      const isCorner=(skip==='left'&&i===0)||(skip==='right'&&i===N-1)||(skip==='both'&&(i===0||i===N-1));
      const hinge=(i%2===0)?'left':'right';
      if(isCorner||i%2===0){ this.makeDoor(sw-.006,ctrH-.01,x,bb+ctrH/2,D/2,'solid',null,hinge); }   // base door
      else { const dwH=ctrH/nd;for(let dd=0;dd<nd;dd++)this.makeDrawer(sw-.008,dwH-.008,D-.03,x,bb+dwH/2+dd*dwH,D/2); } // drawer stack
      this.makeDoor(sw-.006,upH-.01,x,upBot+upH/2,upZ+upD/2,'solid',upColor,hinge); // single-door upper
    }
    if(this.cfg.led!=='off'){const ledC=this.cfg.led==='warm'?0xffd9a0:0xcfe6ff;const led=this.box(W*.92,P*.25,.008,ledC,0,upBot-.015,upZ+upD/2-.02,.4,0);led.material.emissive=new THREE.Color(ledC);led.material.emissiveIntensity=.9}},

  buildKitchen(){const P=this.P;const W=this.cfg.w/100,H=this.cfg.h/100,D=this.cfg.d/100;const m=MAT[this.cfg.mat],mc=m.color;
    if(this.cfg.type==='kitchen_l'){
      const backLen=W,sideLen=Math.min(backLen*.7,2.8);
      let g=new THREE.Group();g.position.set(0,0,-sideLen/2);this.attach(g);this.currentParent=g;
      this.kitchenRun(backLen,{D,sections:this.cfg.sections,cornerSkip:'left'});this.currentParent=null;
      const sN=Math.max(2,Math.round(this.cfg.sections*sideLen/backLen));
      g=new THREE.Group();g.position.set(-backLen/2+D/2,0,D/2);g.rotation.y=Math.PI/2;this.attach(g);this.currentParent=g;
      this.kitchenRun(sideLen,{D,sections:sN,cornerSkip:'left'});this.currentParent=null;
      this.lookAtZ=sideLen*0.12;
    } else if(this.cfg.type==='kitchen_island'){
      this.kitchenRun(W,{D,sections:this.cfg.sections});
      const plH=.08,bb=-H/2+plH,ctT=.02,ctop=0x141414,iW=1.5,iH=.9,iD=.85,iz=D/2+1.1+iD/2;
      this.box(iW*.97,plH,iD*.9,0x1a1a1a,0,bb-plH/2,iz,.85);this.box(iW,iH-plH,iD,mc,0,bb+(iH-plH)/2,iz,m.rough);this.box(iW+.05,ctT,iD+.05,ctop,0,bb+iH-plH+ctT/2,iz,.2,.15);
      const isw=iW/3;for(let ii=0;ii<3;ii++)this.makeDoor(isw-.01,(iH-plH)*.7-.01,-iW/2+isw/2+ii*isw,bb+(iH-plH)*.5,iz+iD/2,'solid',null,(ii%2===0)?'left':'right');
      this.lookAtZ=0.75;
    } else {
      this.kitchenRun(W,{D,sections:this.cfg.sections});this.lookAtZ=0;
    }},

  buildVanity(){const P=this.P;const W=this.cfg.w/100,H=this.cfg.h/100,D=this.cfg.d/100;const N=this.cfg.sections;const m=MAT[this.cfg.mat],mc=m.color;
    const T=this.cfg.type;const plH=(T==='vanity_freestanding')?0.08:0;const bb=-H/2+plH;const cabH=H-plH;
    if(T==='vanity_freestanding'){
      this.box(W*0.97,plH,D*0.9,0x1a1a1a,0,-H/2+plH/2,-D*0.02,0.85);
    }
    this.box(W,P,D,dk(mc,0.85),0,bb+P/2,0,.6);
    this.box(W,P,D,mc,0,bb+cabH-P/2,0,m.rough);
    this.box(P,cabH-P*2,D,mc,-W/2+P/2,bb+cabH/2,0,m.rough);
    this.box(P,cabH-P*2,D,mc,W/2-P/2,bb+cabH/2,0,m.rough);
    this.box(W-P*2,cabH-P*2,P,dk(mc,0.7),0,bb+cabH/2,-D/2+P/2,0.85);
    const sw=(W-P*(N+1))/N;
    for(let i=0;i<N;i++){
      const x=-W/2+P+sw/2+i*(sw+P);
      if(i<N-1)this.box(P,cabH-P*2,D-0.02,mc,x+sw/2+P/2,bb+cabH/2,0,m.rough);
      const hasDrawers=(this.cfg.drawers>0)&&(N===1||(N===2&&i===0)||(N===3&&i!==1)||(N>=4&&(i===0||i===N-1)));
      if(hasDrawers){
        const numDrawers=Math.max(1,Math.min(3,this.cfg.drawers));
        const drwH=(cabH-P*2)/numDrawers;
        for(let dd=0;dd<numDrawers;dd++){
          const dy=bb+P+drwH/2+dd*drwH;
          this.makeDrawer(sw-0.008,drwH-0.008,D-0.03,x,dy,D/2);
        }
      } else {
        const doubleDoors=sw>0.6;
        const doorH=cabH-P*2-0.01;
        const doorY=bb+cabH/2;
        const doorZ=D/2;
        const sh=this.cfg.shelves||0;
        for(let s=0;s<sh;s++){
          this.box(sw,P*0.7,D-0.05,dk(mc,0.92),x,bb+P+(cabH-P*2)*(s+1)/(sh+1),0.005,m.rough);
        }
        if(doubleDoors){
          const dw=sw/2-0.004;
          this.makeDoor(dw,doorH,x-sw/4,doorY,doorZ,this.cfg.doorType,null,'left');
          this.makeDoor(dw,doorH,x+sw/4,doorY,doorZ,this.cfg.doorType,null,'right');
        } else {
          const hinge=(i%2===0)?'left':'right';
          this.makeDoor(sw-0.006,doorH,x,doorY,doorZ,this.cfg.doorType,null,hinge);
        }
      }
    }
    const ctT=0.03;const ctY=bb+cabH+ctT/2;
    this.box(W+0.02,ctT,D+0.02,0xf5f5f5,0,ctY,0.01,0.15,0.1);
    const fCol=(this.cfg.handle==='gold')?0xc9a248:((this.cfg.handle==='black')?0x161616:0xd8d8dc);
    const faucetMat=new THREE.MeshStandardMaterial({color:fCol,roughness:0.2,metalness:0.9});
    const numSinks=(W>=1.4)?2:1;
    const sinkPositions=(numSinks===2)?[-W/4,W/4]:[0];
    const sinkH=0.10;const sinkR=0.18;const sinkY=ctY+ctT/2+sinkH/2;
    sinkPositions.forEach(sx=>{
      const basinGeo=new THREE.CylinderGeometry(sinkR,sinkR-0.02,sinkH,24);
      const basinMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.08,metalness:0});
      const basin=new THREE.Mesh(basinGeo,basinMat);basin.position.set(sx,sinkY,0.02);
      basin.castShadow=true;basin.receiveShadow=true;this.attach(basin);
      const drainGeo=new THREE.CylinderGeometry(0.03,0.03,0.01,16);
      const drain=new THREE.Mesh(drainGeo,faucetMat);drain.position.set(sx,ctY+ctT/2+0.005,0.02);
      drain.castShadow=true;this.attach(drain);
      const fG=new THREE.Group();fG.position.set(sx,ctY+ctT/2,-0.15);
      const fColGeo=new THREE.CylinderGeometry(0.012,0.012,0.24,12);
      const fColM=new THREE.Mesh(fColGeo,faucetMat);fColM.position.y=0.12;fColM.castShadow=true;fG.add(fColM);
      const fSpoutGeo=new THREE.CylinderGeometry(0.01,0.01,0.12,12);
      const fSpout=new THREE.Mesh(fSpoutGeo,faucetMat);fSpout.rotation.x=Math.PI/2;fSpout.position.set(0,0.23,0.05);fSpout.castShadow=true;fG.add(fSpout);
      const leverGeo=new THREE.BoxGeometry(0.01,0.015,0.05);
      const lever=new THREE.Mesh(leverGeo,faucetMat);lever.position.set(0,0.20,-0.01);lever.castShadow=true;fG.add(lever);
      this.attach(fG);
    });
    const mW=Math.max(0.5,W*0.85);const mH=0.70;const mirY=(ctY+ctT/2+0.15)+mH/2;const mirZ=-D/2+0.01;
    if(this.cfg.led!=='off'){
      const glowC=(this.cfg.led==='warm')?0xffd9a0:0xcfe6ff;
      const glowMat=new THREE.MeshStandardMaterial({color:glowC,roughness:0.9,metalness:0});
      glowMat.emissive=new THREE.Color(glowC);glowMat.emissiveIntensity=1.2;
      this.box(mW+0.03,mH+0.03,0.005,glowC,0,mirY,mirZ-0.002,0.9).material=glowMat;
    }
    const frameCol=(this.cfg.handle==='gold')?0xc9a248:((this.cfg.handle==='black')?0x161616:0xd8d8dc);
    this.box(mW,mH,0.015,frameCol,0,mirY,mirZ,0.3,0.8);
    const glassGeo=new THREE.PlaneGeometry(mW-0.02,mH-0.02);
    const glassMat=new THREE.MeshStandardMaterial({color:0xddeef5,roughness:0.02,metalness:0.95});
    const glass=new THREE.Mesh(glassGeo,glassMat);glass.position.set(0,mirY,mirZ+0.008);this.attach(glass);
  },

  makeDoor(w,h,x,y,z,type,matOverride,hinge){const m=MAT[this.cfg.mat];const baseColor=matOverride||m.color;if(type==='open')return;
    hinge=hinge||'left';const left=hinge==='left';
    const pivotX=left?(x-w/2):(x+w/2);      // hinge edge
    const cx=left?(w/2):(-w/2);             // door centre relative to pivot
    const openY=left?(-Math.PI*.55):(Math.PI*.55);
    const freeX=left?(cx+w/2-.025):(cx-w/2+.025); // handle on the free (meeting) edge
    const pivot=new THREE.Group();pivot.position.set(pivotX,y,z);pivot.userData.openY=openY;this.attach(pivot);let mesh;
    if(type==='glass'){mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,.012),new THREE.MeshStandardMaterial({color:0xaaccd6,roughness:.05,metalness:.1,transparent:true,opacity:.22}));mesh.position.set(cx,0,0);pivot.add(mesh);
      const fr=new THREE.MeshStandardMaterial({color:0x111111,roughness:.4,metalness:.3});[h/2,-h/2].forEach(yy=>{const f=new THREE.Mesh(new THREE.BoxGeometry(w,.022,.022),fr);f.position.set(cx,yy,0);pivot.add(f)});[cx-w/2,cx+w/2].forEach(xx=>{const f=new THREE.Mesh(new THREE.BoxGeometry(.022,h,.022),fr);f.position.set(xx,0,0);pivot.add(f)})}
    else if(type==='mirror'){mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,.014),new THREE.MeshStandardMaterial({color:0xc2ccd4,roughness:.04,metalness:.95}));mesh.position.set(cx,0,0);pivot.add(mesh)}
    else{mesh=this.frontPanel(w,h,.018,baseColor,m.rough,m.metal);mesh.position.set(cx,0,0);pivot.add(mesh)}
    if(mesh){mesh.castShadow=true;mesh.receiveShadow=true}
    if(this.cfg.handle!=='none'&&this.cfg.handle!=='push'){const hc=HANDLE[this.cfg.handle];const len=Math.min(h*.4,.28);
      const bar=new THREE.Mesh(new THREE.CylinderGeometry(.007,.007,len,12),new THREE.MeshStandardMaterial({color:hc,roughness:.25,metalness:.85}));bar.position.set(freeX,0,.02);bar.castShadow=true;pivot.add(bar);
      [len/2,-len/2].forEach(o=>{const kk=new THREE.Mesh(new THREE.CylinderGeometry(.006,.006,.02,10),new THREE.MeshStandardMaterial({color:hc,roughness:.25,metalness:.85}));kk.rotation.x=Math.PI/2;kk.position.set(freeX,o,.01);pivot.add(kk)})}
    this.doorObjs.push(pivot)},

  makeDrawer(w,h,d,x,y,z){const m=MAT[this.cfg.mat];const pivot=new THREE.Group();pivot.position.set(x,y,z);this.attach(pivot);pivot.userData.baseZ=z;
    const boxW=w-.012,boxH=h-.01,boxD=Math.max(.15,d-.05),t=.012,cc=dk(m.color,.78);const cmat=new THREE.MeshStandardMaterial({color:cc,roughness:.7,metalness:0});
    const fZ=-.012,bZ=fZ-boxD,cZ=(fZ+bZ)/2;
    const bottom=new THREE.Mesh(new THREE.BoxGeometry(boxW,t,boxD),cmat);bottom.position.set(0,-boxH/2+t/2,cZ);bottom.castShadow=true;bottom.receiveShadow=true;pivot.add(bottom);
    const left=new THREE.Mesh(new THREE.BoxGeometry(t,boxH,boxD),cmat);left.position.set(-boxW/2+t/2,0,cZ);left.castShadow=true;pivot.add(left);
    const right=new THREE.Mesh(new THREE.BoxGeometry(t,boxH,boxD),cmat);right.position.set(boxW/2-t/2,0,cZ);right.castShadow=true;pivot.add(right);
    const back=new THREE.Mesh(new THREE.BoxGeometry(boxW,boxH,t),cmat);back.position.set(0,0,bZ);back.castShadow=true;pivot.add(back);
    const front=this.frontPanel(w,h,.018,dk(m.color,.96),m.rough,m.metal);front.castShadow=true;front.receiveShadow=true;pivot.add(front);
    if(this.cfg.handle!=='none'&&this.cfg.handle!=='push'){const hc=HANDLE[this.cfg.handle];const len=Math.min(w*.35,.26);
      const bar=new THREE.Mesh(new THREE.CylinderGeometry(.007,.007,len,12),new THREE.MeshStandardMaterial({color:hc,roughness:.25,metalness:.85}));bar.rotation.z=Math.PI/2;bar.position.set(0,0,.02);bar.castShadow=true;pivot.add(bar);
      [len/2,-len/2].forEach(o=>{const kk=new THREE.Mesh(new THREE.CylinderGeometry(.006,.006,.02,10),new THREE.MeshStandardMaterial({color:hc,roughness:.25,metalness:.85}));kk.rotation.x=Math.PI/2;kk.position.set(o,0,.01);pivot.add(kk)})}
    this.drawerObjs.push(pivot)},

  loop(){const self=this;requestAnimationFrame(()=>self.loop());if(!builderActive||!this.ren)return;
    if(this.animDoors){this.doorAngle+=(this.targetDoor-this.doorAngle)*.08;this.doorObjs.forEach(p=>p.rotation.y=p.userData.openY*this.doorAngle);if(Math.abs(this.doorAngle-this.targetDoor)<.001)this.animDoors=false}
    if(this.animDrawers){this.drawerOffset+=(this.targetDrawer-this.drawerOffset)*.08;this.drawerObjs.forEach(p=>p.position.z=p.userData.baseZ+this.drawerOffset);if(Math.abs(this.drawerOffset-this.targetDrawer)<.001)this.animDrawers=false}
    const r=this.camDist;this.cam.position.set(Math.sin(this.rotY)*r*Math.cos(this.rotX),Math.sin(this.rotX)*r+.4,Math.cos(this.rotY)*r*Math.cos(this.rotX));this.cam.lookAt(0,.05,this.lookAtZ);this.ren.render(this.scene,this.cam)},

  updatePrice(){const c=this.cfg;const matBonus={oak:0,walnut:.12,white:-.05,grey:.05,taupe:.08,cream:.02};const ledBonus=c.led!=='off'?.06:0;
    const p=Math.round(c.basePrice*(c.w/240)*(c.h/240)*(1+(matBonus[c.mat]||0))*(1+ledBonus)/100)*100;
    const str='AED '+p.toLocaleString();document.getElementById('bPriceVal').textContent=str;
    document.getElementById('bDimsTag').innerHTML=`${c.w*10} × ${c.h*10} × ${c.d*10} <b>mm</b>`},

  applyConfiguration(configuration){
    if(!configuration||typeof configuration!=='object'||Array.isArray(configuration))throw new TypeError('Builder configuration must be an object.');
    this.cfg=Object.assign({},this.cfg||{},configuration);
    const c=this.cfg;const set=(id,v,lab)=>{const el=document.getElementById(id);if(el)el.value=v;const label=lab&&document.getElementById(lab);if(label)label.textContent=v};
    set('sections',c.sections,'sec-val');set('drawers',c.drawers,'drw-val');set('shelves',c.shelves,'sh-val');
    set('width',c.w,'w-val');set('height',c.h,'h-val');set('depth',c.d,'d-val');
    set('door-type',c.doorType);set('handle-type',c.handle);set('led',c.led);
    const name=document.getElementById('bName');if(name)name.textContent=c.name;
    const type=document.getElementById('bType');if(type)type.textContent=c.type.replace(/_/g,' ');
    document.querySelectorAll('.b-sw').forEach(s=>s.classList.toggle('active',s.dataset.mat===c.mat));
    this.build();return this.cfg;
  },

  applyWardrobeModel(model){
    if(!globalThis.LegacyBuilderAdapter)throw new Error('Legacy Builder adapter is unavailable.');
    return globalThis.LegacyBuilderAdapter.applyWardrobeModelToBuilder(this,model);
  },

  load(idx){this.cfg=Object.assign({},DESIGNS[idx]);const c=this.cfg;
    this.lookAtZ=0;
    if(c.type==='walkin_u'){this.camDist=6.8;this.rotY=.45}else if(c.type==='walkin_l'){this.camDist=5.6;this.rotY=.55}
    else if(c.type==='kitchen_island'){this.camDist=6.6;this.rotY=.6}else if(c.type==='kitchen_l'){this.camDist=6.6;this.rotY=.6}
    else if(c.type.startsWith('vanity')){this.camDist=4.2;this.rotY=.5}
    else{this.camDist=4.6;this.rotY=.5}this.rotX=.06;
    
    // Adjust slider ranges dynamically based on product type
    const wEl=document.getElementById('width');
    const hEl=document.getElementById('height');
    const dEl=document.getElementById('depth');
    if(c.type.startsWith('vanity')){
      wEl.min=60; wEl.max=240; wEl.step=10;
      hEl.min=45; hEl.max=100; hEl.step=5;
      dEl.min=40; dEl.max=65; dEl.step=5;
    } else if(c.type.startsWith('kitchen')){
      wEl.min=120; wEl.max=360; wEl.step=10;
      hEl.min=180; hEl.max=250; hEl.step=10;
      dEl.min=50; dEl.max=70; dEl.step=5;
    } else {
      wEl.min=120; wEl.max=360; wEl.step=10;
      hEl.min=180; hEl.max=280; hEl.step=10;
      dEl.min=40; dEl.max=80; dEl.step=5;
    }
    
    document.getElementById('bName').textContent=c.name;
    document.getElementById('bType').textContent=c.type.replace('_',' ');
    const set=(id,v)=>{document.getElementById(id).value=v};
    set('sections',c.sections);document.getElementById('sec-val').textContent=c.sections;
    set('drawers',c.drawers);document.getElementById('drw-val').textContent=c.drawers;
    set('shelves',c.shelves);document.getElementById('sh-val').textContent=c.shelves;
    set('door-type',c.doorType);set('width',c.w);document.getElementById('w-val').textContent=c.w;
    set('height',c.h);document.getElementById('h-val').textContent=c.h;set('depth',c.d);document.getElementById('d-val').textContent=c.d;
    set('handle-type',c.handle);set('led',c.led);
    document.querySelectorAll('.b-sw').forEach(s=>s.classList.toggle('active',s.dataset.mat===c.mat));
    document.querySelectorAll('.b-chip').forEach((ch,i)=>ch.classList.toggle('active',i===idx));
    this.build();},

  bindUI(){const self=this;
    // material swatches
    const sc=document.getElementById('bSwatches');
    MATKEYS.forEach(k=>{const d=document.createElement('div');d.className='b-sw';d.dataset.mat=k;d.style.background=MAT[k].css;d.title=MAT[k].label;
      d.addEventListener('click',()=>{document.querySelectorAll('.b-sw').forEach(s=>s.classList.remove('active'));d.classList.add('active');self.cfg.mat=k;self.build()});sc.appendChild(d)});
    // design switch chips
    const bs=document.getElementById('bSwitch');
    DESIGNS.forEach((g,i)=>{const c=document.createElement('div');c.className='b-chip';c.textContent=g.name;c.addEventListener('click',()=>go('#/build/'+i));bs.appendChild(c)});
    // sliders
    const bind=(id,key,lab)=>{document.getElementById(id).addEventListener('input',e=>{self.cfg[key]=parseInt(e.target.value);if(key==='sections'||key==='drawers'||key==='shelves')delete self.cfg.sectionLayouts;if(lab)document.getElementById(lab).textContent=e.target.value;self.build()})};
    bind('sections','sections','sec-val');bind('drawers','drawers','drw-val');bind('shelves','shelves','sh-val');
    bind('width','w','w-val');bind('height','h','h-val');bind('depth','d','d-val');
    document.getElementById('door-type').addEventListener('change',e=>{self.cfg.doorType=e.target.value;self.build()});
    document.getElementById('handle-type').addEventListener('change',e=>{self.cfg.handle=e.target.value;self.build()});
    document.getElementById('led').addEventListener('change',e=>{self.cfg.led=e.target.value;self.build()});
    document.getElementById('toggle-doors').addEventListener('click',e=>{self.doorsOpen=!self.doorsOpen;self.targetDoor=self.doorsOpen?1:0;self.animDoors=true;e.currentTarget.classList.toggle('on',self.doorsOpen)});
    document.getElementById('toggle-drawers').addEventListener('click',e=>{self.drawersOpen=!self.drawersOpen;self.targetDrawer=self.drawersOpen?.35:0;self.animDrawers=true;e.currentTarget.classList.toggle('on',self.drawersOpen)});
    document.getElementById('bFinish').addEventListener('click',()=>{const c=self.cfg;alert(`Configuration locked ✓\n\n${c.name}\n${c.w*10} × ${c.h*10} × ${c.d*10} mm · ${MAT[c.mat].label}\n${document.getElementById('bPriceVal').textContent}\n\nNext: payment → frozen config → cut list + production PDF dispatched to the workshop.`)});
    
    // mobile tabs switcher
    const bm=document.querySelector('.b-main');
    const tL=document.getElementById('tab-left');
    const tR=document.getElementById('tab-right');
    if(tL && tR){
      tL.addEventListener('click',()=>{
        bm.classList.remove('show-right'); bm.classList.add('show-left');
        tL.classList.add('active'); tR.classList.remove('active');
      });
      tR.addEventListener('click',()=>{
        bm.classList.remove('show-left'); bm.classList.add('show-right');
        tR.classList.add('active'); tL.classList.remove('active');
      });
    }
  }
};

addEventListener('resize',()=>{if(builderActive)Builder.resize()});

/* ===== boot ===== */
function boot(){
  heroInit();
  setTimeout(()=>thumbs.forEach(initThumb),300);
  route();
}
if(document.readyState!=='loading')boot();else addEventListener('DOMContentLoaded',boot);
