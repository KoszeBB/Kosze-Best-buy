(function(){
"use strict";
const D=window.BB_DATA, LOCS=D.locs, $=id=>document.getElementById(id);
const fold=s=>s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/ł/g,"l").replace(/[-\s]+/g," ").trim();
const plural=n=>n===1?"sklep":(n%10>=2&&n%10<=4&&(n%100<10||n%100>=20))?"sklepy":"sklepów";
const town=k=>LOCS[k].name.replace(/\s*\(.*\)/,"");

// ten sam sklep wpisany dwa razy (ta sama nazwa i adres) pokazujemy raz
D.stores=D.stores.filter((s,i,a)=>a.findIndex(o=>o.d===s.d&&o.u===s.u&&o.l===s.l)===i);
// sklep bez dokładnych współrzędnych dostaje punkt swojej miejscowości
D.stores.forEach(s=>{ if(s.lat==null){ s.lat=LOCS[s.l].lat; s.lon=LOCS[s.l].lon; } });
for(const k in LOCS) LOCS[k].f=fold(town(k));

// ---------- mapa ----------
const PL=L.latLngBounds([49.0,14.1],[54.9,24.2]);
const map=L.map("map",{minZoom:5,maxZoom:18,maxBounds:L.latLngBounds([46.5,11.5],[57,27]),zoomSnap:0.5});
map.fitBounds(PL);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{
  maxZoom:19,
  attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
}).addTo(map);
map.attributionControl.setPrefix(false);

// znaczek rośnie razem z przybliżeniem
const iconCache={};
function pinIcon(z,dim){
  const h=Math.round(Math.max(16,Math.min(60,14+(z-5)*6))), w=Math.round(h/1.19), key=h+(dim?"d":"");
  return iconCache[key]||(iconCache[key]=L.divIcon({
    className:"bb-pin"+(dim?" dim":""), iconSize:[w,h], iconAnchor:[w/2,h], popupAnchor:[0,-h+2],
    html:'<svg viewBox="0 0 400 476" aria-hidden="true"><use href="#pin" x="0" y="0" width="400" height="476"/></svg>'
  }));
}

// sklepy pod tym samym adresem dzielą jeden znaczek
const PTS={};
D.stores.forEach(s=>{ const k=s.lat.toFixed(5)+","+s.lon.toFixed(5); (PTS[k]=PTS[k]||{k,lat:s.lat,lon:s.lon,l:s.l,stores:[]}).stores.push(s); s.p=k; });

function gmaps(s){ const q=(s.d==="Sklep partnerski"?"":s.d+", ")+s.u+", "+town(s.l); return "https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(q); }
function esc(t){ return String(t).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
function popupHtml(P){
  return P.stores.map((s,i)=>(i?'<div class="sep"></div>':"")+
    `<h3>${esc(s.d)}</h3><p>${esc(s.u)}, ${esc(town(s.l))}</p><a class="go" href="${gmaps(s)}" target="_blank" rel="noopener">zobacz w Google</a>`).join("");
}
const st={focus:null};
Object.values(PTS).forEach(P=>{
  P.m=L.marker([P.lat,P.lon],{icon:pinIcon(map.getZoom()),title:town(P.l),riseOnHover:true})
    .bindPopup(popupHtml(P),{className:"bb-pop",maxWidth:300,minWidth:240,autoPanPadding:[40,40]})
    .addTo(map);
  P.m.on("click",()=>nearestTo(P.lat,P.lon,LOCS[P.l].name,true));
});
function refreshIcons(){
  const z=map.getZoom();
  for(const k in PTS){ const P=PTS[k], dim=!!st.focus&&!st.focus.has(k); P.m.setIcon(pinIcon(z,dim)); P.m.setZIndexOffset(dim?-1000:0); }
  // karta ma siedzieć tuż nad znaczkiem także po zmianie jego rozmiaru
  for(const k in PTS){ const m=PTS[k].m; if(m.isPopupOpen()) m.getPopup().update(); }
}
map.on("zoomend",refreshIcons);

// ---------- lista ----------
function km(a,b,c,d){ const R=6371,t=Math.PI/180,x=(d-b)*t*Math.cos((a+c)/2*t),y=(c-a)*t; return R*Math.hypot(x,y); }
function row(s,dist){
  const r=document.createElement("div"); r.className="row"; r.tabIndex=0;
  r.innerHTML='<div class="n"></div><div class="km"></div><div class="a"></div><a target="_blank" rel="noopener">Prowadź ↗</a>';
  r.querySelector(".n").textContent=s.d; r.querySelector(".a").textContent=s.u+", "+town(s.l);
  r.querySelector(".km").textContent=dist==null?"":(dist<1?"na miejscu":(dist<10?dist.toFixed(1).replace(".",","):Math.round(dist))+" km");
  const a=r.querySelector("a"); a.href=gmaps(s); a.addEventListener("click",e=>e.stopPropagation());
  const go=()=>{ const P=PTS[s.p]; map.closePopup(); map.once("moveend",()=>P.m.openPopup()); map.setView([P.lat,P.lon],Math.max(map.getZoom(),15)); if(window.innerWidth<=900) $("map").scrollIntoView({behavior:"smooth",block:"center"}); };
  r.onclick=go; r.onkeydown=e=>{ if(e.key==="Enter") go(); };
  return r;
}
function renderAll(){
  st.focus=null; refreshIcons();
  $("lh").textContent="Wszystkie sklepy"; $("lp").textContent="Wpisz miejscowość, a pokażemy sklepy najbliżej Ciebie.";
  const L2=$("list"); L2.textContent=""; const by={}; D.stores.forEach(s=>(by[s.l]=by[s.l]||[]).push(s));
  const f=document.createDocumentFragment();
  Object.keys(by).sort((a,b)=>town(a).localeCompare(town(b),"pl")).forEach(k=>{
    const h=document.createElement("div"); h.className="grp"; h.innerHTML="<b></b><span></span>";
    h.firstChild.textContent=town(k); h.lastChild.textContent=by[k].length+" "+plural(by[k].length); f.appendChild(h);
    by[k].forEach(s=>f.appendChild(row(s)));
  });
  L2.appendChild(f);
}
function showAllButton(){
  const b=document.createElement("button"); b.type="button"; b.textContent="Pokaż wszystkie";
  b.onclick=()=>{ $("q").value=""; map.closePopup(); renderAll(); map.fitBounds(PL); }; return b;
}
function nearestTo(lat,lon,label,noFit){
  const arr=D.stores.map(s=>({s,d:km(lat,lon,s.lat,s.lon)})).sort((a,b)=>a.d-b.d);
  const within=arr.filter(o=>o.d<=30); const pick=(within.length>=5?within:arr.slice(0,5)).slice(0,25);
  st.focus=new Set(pick.map(o=>o.s.p)); refreshIcons();
  $("lh").textContent="Najbliżej: "+label.replace(/\s*\(.*\)/,"");
  const n=pick.length; $("lp").textContent=`${n} ${plural(n)} w promieniu ${Math.max(1,Math.ceil(pick[n-1].d))} km. `; $("lp").appendChild(showAllButton());
  const L2=$("list"); L2.textContent=""; pick.forEach(o=>L2.appendChild(row(o.s,o.d))); L2.scrollTop=0;
  if(!noFit) map.fitBounds(L.latLngBounds(pick.map(o=>[o.s.lat,o.s.lon]).concat([[lat,lon]])),{padding:[50,50],maxZoom:14});
}

// ---------- wyszukiwarka ----------
const dl=$("cities");
[...new Set(Object.keys(LOCS).map(town))].sort((a,b)=>a.localeCompare(b,"pl")).forEach(n=>{ const o=document.createElement("option"); o.value=n; dl.appendChild(o); });
function search(){
  map.closePopup();
  const q=fold($("q").value); if(!q){ renderAll(); map.fitBounds(PL); return; }
  const ls=Object.values(LOCS); const hit=ls.find(l=>l.f===q)||ls.find(l=>l.f.startsWith(q))||ls.find(l=>l.f.includes(q));
  if(hit) return nearestTo(hit.lat,hit.lon,hit.name);
  const m=D.stores.filter(s=>fold(s.u+" "+s.d).includes(q));
  st.focus=new Set(m.map(s=>s.p)); refreshIcons();
  $("lh").textContent=m.length?"Wyniki wyszukiwania":"Nie znaleźliśmy tej miejscowości";
  $("lp").textContent=m.length?`${m.length} ${plural(m.length)}. `:"Sprawdź pisownię albo wpisz większe miasto w pobliżu. ";
  $("lp").appendChild(showAllButton());
  const L2=$("list"); L2.textContent=""; m.forEach(s=>L2.appendChild(row(s)));
  if(m.length) map.fitBounds(L.latLngBounds(m.map(s=>[s.lat,s.lon])),{padding:[50,50],maxZoom:14});
}
$("find").addEventListener("submit",e=>{ e.preventDefault(); search(); });
$("q").addEventListener("change",search);
$("q").addEventListener("input",e=>{ if(!e.target.value){ renderAll(); } });
document.addEventListener("keydown",e=>{ if(e.key==="Escape") map.closePopup(); });

renderAll();
})();
