// Homepage script: footer year, copy-the-email button and the waitlist form. A file of its own so the Content Security Policy can
// forbid inline scripts.
document.getElementById('yr').textContent=new Date().getFullYear();
const b=document.getElementById('copyBtn');
b.addEventListener('click',async()=>{try{await navigator.clipboard.writeText('launch@openorbia.com');b.textContent='Copied';}catch(e){const r=document.createRange();r.selectNodeContents(document.getElementById('mail'));const s=getSelection();s.removeAllRanges();s.addRange(r);b.textContent='Selected';}setTimeout(()=>b.textContent='Copy',2000);});
// The Turnstile token (empty if the check has not run): only a visitor who passes it gets the welcome email
const check=()=>{const t=document.querySelector('#wl [name="cf-turnstile-response"]');return t?t.value:'';};
const resetCheck=()=>{try{if(window.turnstile)window.turnstile.reset();}catch(e){/* no widget */}};
const form=document.getElementById('wl'),msg=document.getElementById('wl-msg'),btn=document.getElementById('wl-btn'),toolRow=document.getElementById('toolRow');
form.addEventListener('change',()=>{toolRow.hidden=form.role.value!=='maker';});
form.addEventListener('submit',async e=>{
  e.preventDefault();msg.className='msg';
  const email=form.email.value.trim(),tool=form.tool.value.trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){msg.className='msg err';msg.textContent='Enter a valid email address.';form.email.focus();return;}
  if(tool && !/^https?:\/\/\S+\.\S+/.test(tool)){msg.className='msg err';msg.textContent="Your tool's website should start with https://";form.tool.focus();return;}
  btn.disabled=true;btn.textContent='Joining...';
  try{
    const r=await fetch('/api/waitlist',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,role:form.role.value,tool:form.role.value==='maker'?tool:'',company:form.company.value,turnstile:check()})});
    const d=await r.json().catch(()=>({}));
    if(r.ok){form.reset();toolRow.hidden=false;msg.className='msg ok';msg.textContent=d.message||"You're on the list. We'll be in touch before Launch Week 1.";}
    else{msg.className='msg err';msg.textContent=d.error||'Something went wrong. Please try again, or email launch@openorbia.com.';}
  }catch(err){msg.className='msg err';msg.textContent='Could not reach the server. Check your connection and try again.';}
  resetCheck();btn.disabled=false;btn.textContent='Join the waitlist';
});
