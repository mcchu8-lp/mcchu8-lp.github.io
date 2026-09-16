(()=>{
  'use strict';
  const BASE='https://yruaygqlsyecefrassqc.supabase.co/functions/v1';
  const ENROLL=`${BASE}/ccf-credential-enroll`;
  const $=id=>document.getElementById(id);
  const state={connections:[],selected:null,secureAccess:null};

  function setText(id,value){const e=$(id);if(e)e.textContent=value??'—';}
  function setNotice(message,kind=''){const e=$('notice');e.className=`notice ${kind}`.trim();e.textContent=message;e.hidden=false;}
  function clearNotice(){const e=$('notice');e.hidden=true;e.textContent='';}
  function badge(id,value,stateClass=''){const e=$(id);if(!e)return;e.textContent=value??'—';e.className=`connection-state ${stateClass}`.trim();}
  function stateClass(value){const v=String(value||'').toUpperCase();if(v==='GREEN'||v==='AUTHENTICATED'||v==='SHADOW_SYNCED'||v==='READ_ONLY')return 'good';if(v==='ERROR'||v==='UNSAFE'||v==='RED')return 'bad';return 'warn';}

  async function token(){
    if(!window.lifePursuitsAuth?.getAccessToken)throw new Error('ACCESS_BOUNDARY_UNAVAILABLE');
    const t=await window.lifePursuitsAuth.getAccessToken();
    if(!t)throw new Error('AUTH_REQUIRED');
    return t;
  }

  async function call(body){
    const t=await token();
    const r=await fetch(ENROLL,{
      method:'POST',
      headers:{Authorization:`Bearer ${t}`,'Content-Type':'application/json','X-Client-Info':'life-pursuits-web/ccf-v1'},
      body:JSON.stringify(body),
      cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'
    });
    const b=await r.json().catch(()=>({}));
    if(!r.ok){
      if(r.status===401||r.status===403){window.lifePursuitsAuth?.clear?.();throw new Error('AUTH_REQUIRED');}
      const e=new Error(b.error||`HTTP_${r.status}`);e.status=r.status;throw e;
    }
    return b;
  }

  function renderConnectionList(rows){
    state.connections=Array.isArray(rows)?rows:[];
    const select=$('connectionPicker');
    select.innerHTML='';
    for(const c of state.connections){
      const o=document.createElement('option');o.value=c.id;o.textContent=c.connection_label||'Bitrue connection';select.appendChild(o);
    }
    const preferred=state.connections.find(c=>/angela/i.test(String(c.connection_label||'')))||state.connections[0]||null;
    state.selected=preferred;
    if(preferred)select.value=preferred.id;
    select.disabled=state.connections.length<2;
    $('credentialForm').hidden=!preferred;
    $('emptyState').hidden=Boolean(preferred);
    if(preferred)renderSummary(preferred);
    select.onchange=async()=>{state.selected=state.connections.find(c=>c.id===select.value)||null;if(state.selected){renderSummary(state.selected);await refreshStatus();}};
  }

  function renderSummary(c){
    setText('connectionName',c.connection_label||'Bitrue');
    badge('permissionState',c.permission_model||'—',stateClass(c.permission_model));
    badge('authState',c.auth_state||'—',stateClass(c.auth_state));
    badge('syncState',c.sync_state||'—',stateClass(c.sync_state));
    badge('coverageState',c.coverage_state||'—',stateClass(c.coverage_state));
    badge('healthState',c.health_state||'—',stateClass(c.health_state));
  }

  function renderStatus(s){
    if(!s)return;
    badge('permissionState',s.read_allowed&&!s.trade_allowed&&!s.withdraw_allowed&&!s.treasury_automation_allowed?'READ_ONLY':'UNSAFE',s.read_allowed&&!s.trade_allowed&&!s.withdraw_allowed&&!s.treasury_automation_allowed?'good':'bad');
    badge('authState',s.auth_state||'—',stateClass(s.auth_state));
    badge('syncState',s.sync_state||'—',stateClass(s.sync_state));
    badge('coverageState',s.coverage_state||'—',stateClass(s.coverage_state));
    badge('healthState',s.health_state||'—',stateClass(s.health_state));
    setText('credentialState',s.credential_configured?'Encrypted credential stored':'Not configured');
    setText('lastRefresh',s.last_successful_refresh_at?new Date(s.last_successful_refresh_at).toLocaleString():'Not yet');
  }

  async function refreshStatus(){
    if(!state.selected)return;
    const b=await call({action:'status',connection_id:state.selected.id});
    renderStatus(b.status);
  }

  async function load(){
    clearNotice();
    const b=await call({action:'list'});
    renderConnectionList(b.connections||[]);
    if(state.selected)await refreshStatus();
  }

  function renderValidation(v){
    if(!v){setText('validationResult','Validation unavailable');return;}
    if(v.ok){
      const count=Number.isFinite(Number(v.normalized_positions))?`${Number(v.normalized_positions)} non-zero spot positions normalized`:'Live read succeeded';
      setText('validationResult',`${count}${v.coverage?` · ${v.coverage}`:''}`);
    }else{
      setText('validationResult',v.error||v.reason||v.state||'Live validation did not complete');
    }
  }

  async function submitCredentials(ev){
    ev.preventDefault();
    if(!state.selected)return;
    const apiKey=$('apiKey');const apiSecret=$('apiSecret');const submit=$('saveCredentials');
    const key=apiKey.value.trim();const secret=apiSecret.value.trim();
    if(!key||!secret){setNotice('Enter the replacement Bitrue API key and secret.','warn');return;}
    submit.disabled=true;submit.textContent='Encrypting & validating…';clearNotice();setText('validationResult','Running live read-only validation…');
    try{
      const result=await call({action:'store',connection_id:state.selected.id,api_key:key,api_secret:secret});
      renderValidation(result.live_validation);
      renderStatus(result.status);
      if(result.live_validation?.ok){setNotice('Credential stored encrypted and the live Bitrue read-only validation succeeded.','success');}
      else{setNotice('Credential was stored encrypted, but live Bitrue validation is not GREEN yet. Review the validation result below; no trade, transfer, or withdrawal permission was enabled.','warn');}
    }catch(e){
      console.error('Credential enrollment failed without logging secret material',e?.message||e);
      setNotice(e.message==='AUTH_REQUIRED'?'Your secure session ended. Sign in again and return to Connections.':'The credential was not accepted by the secure enrollment service. Nothing was saved in browser storage.','warn');
    }finally{
      apiKey.value='';apiSecret.value='';submit.disabled=false;submit.textContent='Store encrypted credential & validate';
    }
  }

  async function start(){
    $('credentialForm').addEventListener('submit',submitCredentials);
    $('refreshStatus').addEventListener('click',async()=>{try{await refreshStatus();setNotice('Connection status refreshed.','success');}catch(e){setNotice(e.message==='AUTH_REQUIRED'?'Sign in again to refresh status.':'Status refresh failed.','warn');}});
    try{
      if(!window.lifePursuitsAuth?.bootstrapSecureAccess)throw new Error('ACCESS_BOUNDARY_UNAVAILABLE');
      state.secureAccess=await window.lifePursuitsAuth.bootstrapSecureAccess();
      setText('securityBadge',`Secure · ${String(state.secureAccess?.session?.effective_aal||'aal1').toUpperCase()}`);
      $('securityBadge').className='badge secure';
      await load();
    }catch(e){
      console.error(e);
      $('credentialForm').hidden=true;
      $('emptyState').hidden=false;
      setText('emptyState',e.message==='AUTH_REQUIRED'?'Sign in required before provider credentials can be managed.':'Secure connection management is currently unavailable.');
      setText('securityBadge','Secure access unavailable');$('securityBadge').className='badge warn';
    }
  }

  start();
})();