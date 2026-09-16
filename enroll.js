(()=>{
  'use strict';
  const ENDPOINT='https://yruaygqlsyecefrassqc.supabase.co/functions/v1/platform-enroll';
  const $=id=>document.getElementById(id),form=$('enrollForm'),email=$('email'),code=$('code'),btn=$('enrollBtn'),msg=$('message');
  function show(t,error=false){msg.hidden=false;msg.textContent=t;msg.className=`message${error?' error':''}`;}
  form.onsubmit=async e=>{
    e.preventDefault();btn.disabled=true;
    try{
      const r=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email.value.trim(),code:code.value.trim()}),cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});
      const b=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(b.error||'Enrollment failed');
      form.hidden=true;show('Secure invitation sent. Open the invitation email on this device, then continue to the Life Pursuits dashboard.');
    }catch(err){show('Enrollment was not accepted. Verify the one-time code and try again before it expires.',true);}
    finally{btn.disabled=false;}
  };
})();