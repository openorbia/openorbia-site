// The Launch List page script (cards, filters). A module file of its own so the Content Security Policy can forbid inline scripts.
// card() and defaultCardsHtml() also run in Node: scripts/build-home.mjs writes the default list into the page, so the tools are
// in the HTML for crawlers and for visitors without JavaScript, and the first render here puts back the same markup.
import{cardFactsHtml,needsPaidService,NEEDS_PAID_LABEL}from"./facts.js?v=ac132e9281";
import{parseFilters,filterQuery,matchesRow}from"./launch-filters.js?v=693c071ef8";
import{ROWS as T,CATEGORIES as CAT,slugOf}from"./tools.js?v=966388f499";
import{LOGOS}from"./logos.js?v=6922797546";

const COL={biz:["#5b7cff","#7a4dff"],job:["#2fb8a0","#5b7cff"],sec:["#ff6b8a","#7a4dff"]};
const esc=s=>s.replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m]));
// a real logo for tools owned by an organization (public/logos/), the letter tile for the rest
function logo(name,a,b){
  const src=Object.hasOwn(LOGOS,slugOf(name))?LOGOS[slugOf(name)]:"";
  return src?`<img class="logo" src="${src}" alt="" width="44" height="44" loading="lazy" decoding="async">`:`<div class="logo" style="background:linear-gradient(135deg,${a},${b})" aria-hidden="true">${esc(name[0].toUpperCase())}</div>`;
}
export function card(t){
  const [name,repo,desc,c,badge,lic,local,founder,facts]=t,[a,b]=COL[c];
  const claim="mailto:launch@openorbia.com?subject="+encodeURIComponent("Claim listing: "+name)+"&body="+encodeURIComponent("Hi OpenOrbia, I maintain "+name+" (https://github.com/"+repo+") and would like to claim the listing.");
  return `<article class="card"><div class="top">${logo(name,a,b)}<div><h2><a href="/tool/${slugOf(name)}/">${esc(name)}</a></h2><div class="by">${esc(repo)}</div></div></div><p>${esc(desc)}</p>${cardFactsHtml(facts)}<div class="tags"><span class="tg cat">${CAT[c]}</span><span class="tg ${badge}">${badge==="os"?"Open source":"Free self-hosted"} · ${esc(lic)}</span>${local?'<span class="tg loc">Works with local AI</span>':''}${founder?`<span class="tg fnd">Built by Khaja Syed, OpenOrbia's founder</span>`:''}${needsPaidService(facts)?`<span class="tg paid">${NEEDS_PAID_LABEL}</span>`:''}</div><div class="foot"><a href="https://github.com/${repo}" data-tool="${slugOf(name)}" target="_blank" rel="noopener">View on GitHub ↗</a>${founder?'':`<a class="claim" href="${claim}">Claim listing</a>`}</div></article>`;
}
// the default view (no filters: All, Runs free on), as the page HTML carries it, and its count
export const defaultRows=()=>T.filter(t=>matchesRow(t,parseFilters("","")));
export const defaultCardsHtml=()=>defaultRows().map(card).join("");
if(typeof document!=="undefined"){
// the filters live in the address bar: /launch-list/?for=job&setup=browser (older #job links still work)
const st=parseFilters(location.search,location.hash);
const grid=document.getElementById("grid"),count=document.getElementById("count");
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
}
