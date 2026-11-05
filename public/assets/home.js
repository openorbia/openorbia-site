// Homepage script: footer year, copy-the-email button and the waitlist form. A file of its own so the Content Security Policy can
// forbid inline scripts.
document.getElementById('yr').textContent=new Date().getFullYear();
// The copy-the-email button is a shared [data-copy] button, handled (and announced) by launch.js
// The Turnstile token (empty if the check has not run): only a visitor who passes it gets the welcome email
const check=()=>{const t=document.querySelector('#wl [name="cf-turnstile-response"]');return t?t.value:'';};
// The widget runs in the background after the page loads, so a quick visitor can press Join before the token exists. Wait for it (up to
// about 15 seconds, polled every 200 ms) instead of sending an empty token, which would save the signup but skip the welcome email.
const waitForCheck=()=>new Promise(done=>{let tries=0;const poll=()=>{const v=check();if(v||++tries>=75)return done(v);setTimeout(poll,200);};poll();});
const resetCheck=()=>{try{if(window.turnstile)window.turnstile.reset();}catch(e){/* no widget */}};
const form=document.getElementById('wl'),msg=document.getElementById('wl-msg'),btn=document.getElementById('wl-btn'),toolRow=document.getElementById('toolRow');
form.addEventListener('change',()=>{toolRow.hidden=form.role.value!=='maker';});
form.addEventListener('submit',async e=>{
  e.preventDefault();msg.className='msg';
  const email=form.email.value.trim(),tool=form.tool.value.trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){msg.className='msg err';msg.textContent='Enter a valid email address.';form.email.focus();return;}
  if(tool && !/^https?:\/\/\S+\.\S+/.test(tool)){msg.className='msg err';msg.textContent="Your tool's website should start with https://";form.tool.focus();return;}
  btn.disabled=true;
  let token=check();
  if(!token){btn.textContent='Checking...';token=await waitForCheck();}
  btn.textContent='Joining...';
  try{
    const r=await fetch('/api/waitlist',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,role:form.role.value,tool:form.role.value==='maker'?tool:'',company:form.company.value,turnstile:token})});
    const d=await r.json().catch(()=>({}));
    if(r.ok){form.reset();toolRow.hidden=false;msg.className='msg ok';msg.textContent=(d.message||"You're on the list. We'll be in touch before Launch Week 1.")+(token?'':" Our spam check didn't run in this browser, so no welcome email this time.");}
    else{msg.className='msg err';msg.textContent=d.error||'Something went wrong. Please try again, or email launch@openorbia.com.';}
  }catch(err){msg.className='msg err';msg.textContent='Could not reach the server. Check your connection and try again.';}
  resetCheck();btn.disabled=false;btn.textContent='Join the waitlist';
});
