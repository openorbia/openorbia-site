// The Launch List page script (cards, filters). A module file of its own so the Content Security Policy can forbid inline scripts.
import{factRows,formatChecked,isTested,needsPaidService,NEEDS_PAID_LABEL}from"./facts.js?v=bf871439b3";
import{parseFilters,filterQuery,matchesRow}from"./launch-filters.js?v=168c942960";
import{ROWS as T,CATEGORIES as CAT,slugOf}from"./tools.js?v=e8b0ffeb64";
import{LOGOS}from"./logos.js?v=991a16939c";

const COL={biz:["#5b7cff","#7a4dff"],job:["#2fb8a0","#5b7cff"],sec:["#ff6b8a","#7a4dff"]};
// the filters live in the address bar: /launch-list/?for=job&setup=browser (older #job links still work)
const st=parseFilters(location.search,location.hash);
const grid=document.getElementById("grid"),count=document.getElementById("count");
const esc=s=>s.replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
// The Free facts on a card, short enough to compare cards at a glance: what is free, three chips (card, your data, setup),
// the catch on one line and the date. Every fact in full is on the tool page. With none of them there is no box.
function ff(facts){
  const rows=factRows(facts);
  if(!rows.length)return"";
  const by=Object.fromEntries(rows.map(r=>[r.key,r.value]));
  const when=formatChecked(facts&&facts.lastChecked);
  // "Runs on your computer (cloud AI only if you pick one)" -> "Runs on your computer": the note is on the tool page
  const short=v=>String(v).replace(/\s*\(.*\)$/,"");
  const chips=[["cardRequired",v=>v==="No"?"No card needed":v==="Yes"?"Card required":"Card: "+v.toLowerCase()],["dataLocation",short],["setup",short]]
    .filter(([k])=>by[k]).map(([k,fn])=>`<li class="fc fc-${k}">${esc(fn(by[k]))}</li>`).join("");
  return `<div class="ff">${by.freeTier?`<p class="ff-free"><span>Free</span>${esc(by.freeTier)}</p>`:""}${chips?`<ul class="fcs" aria-label="Free facts">${chips}</ul>`:""}${by.catch?`<p class="ff-catch"><span>The catch</span>${esc(by.catch)}</p>`:""}${when?`<small>Checked against docs ${esc(when)}</small>`:""}</div>`;
}
// a real logo for tools owned by an organization (public/logos/), the letter tile for the rest
function logo(name,a,b){
  const src=Object.hasOwn(LOGOS,slugOf(name))?LOGOS[slugOf(name)]:"";
  return src?`<img class="logo" src="${src}" alt="" width="44" height="44" loading="lazy" decoding="async">`:`<div class="logo" style="background:linear-gradient(135deg,${a},${b})" aria-hidden="true">${esc(name[0].toUpperCase())}</div>`;
}
function card(t){
  const [name,repo,desc,c,badge,lic,local,founder,facts]=t,[a,b]=COL[c];
  const claim="mailto:launch@openorbia.com?subject="+encodeURIComponent("Claim listing: "+name)+"&body="+encodeURIComponent("Hi OpenOrbia, I maintain "+name+" (https://github.com/"+repo+") and would like to claim the listing.");
  return `<article class="card"><div class="top">${logo(name,a,b)}<div><h2><a href="/tool/${slugOf(name)}/">${esc(name)}</a></h2><div class="by">${esc(repo)}</div></div></div><p>${esc(desc)}</p>${ff(facts)}<div class="tags"><span class="tg cat">${CAT[c]}</span><span class="tg ${badge}">${badge==="os"?"Open source":"Free self-hosted"} · ${esc(lic)}</span>${local?'<span class="tg loc">Works with local AI</span>':''}${founder?`<span class="tg fnd">Built by Khaja Syed, OpenOrbia's founder</span>`:''}${isTested(facts)?'<span class="tg tested">✓ Tested by OpenOrbia</span>':''}${needsPaidService(facts)?`<span class="tg paid">${NEEDS_PAID_LABEL}</span>`:''}</div><div class="foot"><a href="https://github.com/${repo}" data-tool="${slugOf(name)}" target="_blank" rel="noopener">View on GitHub ↗</a>${founder?'':`<a class="claim" href="${claim}">Claim listing</a>`}</div></article>`;
}
function render(){
  const r=T.filter(t=>matchesRow(t,st));
  grid.innerHTML=r.length?r.map(card).join(""):'<div class="empty">No tools match. Try another search.</div>';
  count.textContent=r.length+" TOOLS";
}
// show the state on the controls, and keep the address bar in step (replaceState: no extra history entries, no jump)
const FLAG={os:"os",loc:"local",free:"free"};
function sync(){
  document.querySelectorAll(".tab").forEach(x=>x.setAttribute("aria-pressed",x.dataset.c===st.for));
  document.querySelectorAll(".chip[data-f]").forEach(x=>x.setAttribute("aria-pressed",!!st[FLAG[x.dataset.f]]));
  document.querySelectorAll(".chip[data-setup]").forEach(x=>x.setAttribute("aria-pressed",x.dataset.setup===st.setup));
  const q=document.getElementById("q");if(q.value!==st.q)q.value=st.q;
}
const url=()=>history.replaceState(null,"",location.pathname+filterQuery(st));
const change=()=>{sync();render();url();};
document.getElementById("tabs").addEventListener("click",e=>{const b=e.target.closest(".tab");if(!b)return;st.for=b.dataset.c;change();});
document.querySelectorAll(".chip[data-f]").forEach(b=>b.addEventListener("click",()=>{const k=FLAG[b.dataset.f];st[k]=!st[k];change();}));
document.querySelectorAll(".chip[data-setup]").forEach(b=>b.addEventListener("click",()=>{st.setup=st.setup===b.dataset.setup?"":b.dataset.setup;change();}));
document.getElementById("q").addEventListener("input",e=>{st.q=e.target.value;render();url();});
sync();if(location.hash)url();
document.getElementById("yr").textContent=new Date().getFullYear();
render();
