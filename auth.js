(()=>{
  'use strict';
  const SUPABASE_URL='https://yruaygqlsyecefrassqc.supabase.co';
  const PUBLISHABLE_KEY='sb_publishable_Av6qMayKTsXwGFado9FpVQ_41DGY8is';
  const ACCESS_BOUNDARY=`${SUPABASE_URL}/functions/v1/sage-phase3-access`;
  const K={access:'lifePursuitsP3AccessToken',refresh:'lifePursuitsP3RefreshToken',expires:'lifePursuitsP3TokenExpiresAt'};
  const LEGACY=['lifePursuitsAccessToken','lifePursuitsRefreshToken','lifePursuitsTokenExpiresAt'];
  const BOUNDARY_TTL_MS=15000;
  let boundaryCache={token:null,checkedAt:0,state:null};

  function resetBoundary(){boundaryCache={token:null,checkedAt:0,state:null};}
  function clearLegacy(){try{LEGACY.forEach(k=>sessionStorage.removeItem(k));}catch{}delete window.lifePursuitsSession;}
  function storeSession(s){
    if(!s?.access_token)return;
    clearLegacy();
    sessionStorage.setItem(K.access,s.access_token);
    if(s.refresh_token)sessionStorage.setItem(K.refresh,s.refresh_token);
    const exp=Date.now()+Math.max(60,Number(s.expires_in||3600))*1000;
    sessionStorage.setItem(K.expires,String(exp));
    resetBoundary();
  }
  function clear(){
    try{Object.values(K).forEach(k=>sessionStorage.removeItem(k));}catch{}
    clearLegacy();
    resetBoundary();
  }
  async function refresh(){
    const rt=sessionStorage.getItem(K.refresh); if(!rt)return null;
    const r=await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,{
      method:'POST',headers:{'Content-Type':'application/json','apikey':PUBLISHABLE_KEY},
      body:JSON.stringify({refresh_token:rt}),cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'
    });
    const b=await r.json().catch(()=>({}));
    if(!r.ok||!b.access_token){clear();return null;}
    storeSession(b); return b.access_token;
  }
  async function rawAccessToken(){
    const at=sessionStorage.getItem(K.access); if(!at)return null;
    const exp=Number(sessionStorage.getItem(K.expires)||0);
    if(exp&&exp-Date.now()<120000)return await refresh();
    return at;
  }
  async function boundaryRequest(accessToken,op='session',force=false){
    if(!accessToken)throw new Error('AUTH_REQUIRED');
    if(!force&&boundaryCache.token===accessToken&&boundaryCache.state?.allowed&&Date.now()-boundaryCache.checkedAt<BOUNDARY_TTL_MS)return boundaryCache.state;
    let r;
    try{
      r=await fetch(`${ACCESS_BOUNDARY}?op=${encodeURIComponent(op)}`,{
        method:'GET',headers:{Authorization:`Bearer ${accessToken}`,apikey:PUBLISHABLE_KEY,'X-Client-Info':'life-pursuits-web/p3'},
        cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'
      });
    }catch{
      const e=new Error('ACCESS_BOUNDARY_UNAVAILABLE');e.status=503;throw e;
    }
    const b=await r.json().catch(()=>({}));
    if(r.status===401||r.status===403){clear();const e=new Error(b.code||b.reason||'AUTH_REQUIRED');e.status=r.status;throw e;}
    if(!r.ok||!b?.allowed){const e=new Error(b.code||b.reason||'ACCESS_BOUNDARY_UNAVAILABLE');e.status=r.status;throw e;}
    boundaryCache={token:accessToken,checkedAt:Date.now(),state:b};
    return b;
  }
  async function getAccessToken(options={}){
    const at=await rawAccessToken(); if(!at)return null;
    await boundaryRequest(at,'session',Boolean(options.forceBoundary));
    return at;
  }
  async function bootstrapSecureAccess(){
    const at=await rawAccessToken(); if(!at)throw new Error('AUTH_REQUIRED');
    return await boundaryRequest(at,'bootstrap',true);
  }
  async function signOut(){
    const at=sessionStorage.getItem(K.access);
    if(at){try{await fetch(`${SUPABASE_URL}/auth/v1/logout`,{method:'POST',headers:{apikey:PUBLISHABLE_KEY,Authorization:`Bearer ${at}`},cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});}catch{}}
    clear(); location.assign('/login.html');
  }
  function captureRedirectSession(){
    if(!location.hash||location.hash.length<2)return false;
    const p=new URLSearchParams(location.hash.slice(1));
    const at=p.get('access_token');
    if(!at)return false;
    storeSession({access_token:at,refresh_token:p.get('refresh_token'),expires_in:Number(p.get('expires_in')||3600),token_type:p.get('token_type')||'bearer',type:p.get('type')||''});
    history.replaceState(null,'',location.pathname+location.search);
    return true;
  }
  clearLegacy();
  try{captureRedirectSession();}catch(e){console.warn('Auth callback processing failed',e);clear();}
  window.lifePursuitsAuth={getAccessToken,bootstrapSecureAccess,boundaryRequest,signOut,storeSession,clear,SUPABASE_URL,PUBLISHABLE_KEY,ACCESS_BOUNDARY};
})();