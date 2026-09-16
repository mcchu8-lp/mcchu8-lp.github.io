(()=>{
  'use strict';
  const {SUPABASE_URL,PUBLISHABLE_KEY,storeSession,clear,bootstrapSecureAccess}=window.lifePursuitsAuth;
  const $=id=>document.getElementById(id),sendForm=$('sendForm'),verifyForm=$('verifyForm'),email=$('email'),otp=$('otp'),msg=$('message'),sendBtn=$('sendBtn'),verifyBtn=$('verifyBtn'),backBtn=$('backBtn');
  let pendingEmail='';
  function show(t,error=false){msg.hidden=false;msg.textContent=t;msg.className=`message${error?' error':''}`;}
  async function post(path,body){const r=await fetch(`${SUPABASE_URL}${path}`,{method:'POST',headers:{'Content-Type':'application/json','apikey':PUBLISHABLE_KEY},body:JSON.stringify(body),cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b.error_description||b.msg||b.message||'Request failed');return b;}
  sendForm.onsubmit=async e=>{e.preventDefault();pendingEmail=email.value.trim().toLowerCase();sendBtn.disabled=true;try{await post('/auth/v1/otp',{email:pendingEmail,create_user:false});sendForm.hidden=true;verifyForm.hidden=false;otp.focus();show('One-time code sent. Check your email.');}catch{show('Sign-in could not be started. Use the email that was securely enrolled for this platform.',true);}finally{sendBtn.disabled=false;}};
  verifyForm.onsubmit=async e=>{e.preventDefault();verifyBtn.disabled=true;try{
    const b=await post('/auth/v1/verify',{email:pendingEmail,token:otp.value.trim(),type:'email'});
    if(!b.access_token)throw new Error('No session');
    storeSession(b);
    await bootstrapSecureAccess();
    location.replace('/');
  }catch(err){
    clear();
    const boundaryIssue=err?.message==='ACCESS_BOUNDARY_UNAVAILABLE';
    show(boundaryIssue?'Your identity was verified, but the secure session boundary is unavailable. No private data was released. Try again when the secure service is healthy.':'The code is invalid, expired, or the resulting session was not authorized. Request a new code and try again.',true);
  }finally{verifyBtn.disabled=false;}};
  backBtn.onclick=()=>{verifyForm.hidden=true;sendForm.hidden=false;otp.value='';msg.hidden=true;email.focus();};
  (async()=>{try{if(await window.lifePursuitsAuth.getAccessToken())location.replace('/');}catch{}})();
})();