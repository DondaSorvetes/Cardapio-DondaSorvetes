const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),{createRequire}=require('node:module');
function load(file,mocks={}){const native=createRequire(path.resolve(file)),exports={};new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText)(name=>name in mocks?mocks[name]:name.startsWith('@/')?load('src/'+name.slice(2)+'.ts',mocks):native(name),exports);return exports;}
const id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
test('optional MFA enforces only verified factors and fails closed when assurance is unavailable',async()=>{
 const {adminNeedsMfa,requiresSecondFactor}=load('src/lib/security/admin-mfa.ts');
 assert.equal(requiresSecondFactor([], 'aal1'),false);assert.equal(requiresSecondFactor([{status:'unverified'}], 'aal1'),false);assert.equal(requiresSecondFactor([{status:'verified'}], 'aal1'),true);assert.equal(requiresSecondFactor([{status:'verified'}], 'aal2'),false);
 const client={auth:{mfa:{getAuthenticatorAssuranceLevel:async()=>({data:null,error:Error('offline')})}}};assert.equal(await adminNeedsMfa(client,{factors:[{status:'verified'}]}),true);
});
test('server admin guards deny AAL1 access before any privileged database read',async()=>{
 const client={auth:{getUser:async()=>({data:{user:{id,factors:[{status:'verified'}]}}}),mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:'aal1'}})}}};let reads=0;
 const guards=load('src/lib/admin/auth.ts',{'react':{cache:fn=>fn},'@/integrations/supabase/server':{createServerSupabaseClient:async()=>client},'@/integrations/supabase/client.server':{createServiceRoleClient(){reads++;throw Error('must not read')}},'@/lib/security/rbac':{},'next/navigation':{redirect:path=>{throw Error(path)}}});
 assert.equal(await guards.getAdminUser(),null);await assert.rejects(()=>guards.requireAdmin(),/admin\/login/);await assert.rejects(()=>guards.requireAdminApi(),/UNAUTHORIZED/);assert.equal(reads,0);
});
test('middleware sends password-only admin sessions to MFA and rejects protected APIs until AAL2',async()=>{
 const {NextRequest}=require('next/server');let level='aal1';const user={id,factors:[{status:'verified'}]};const client={auth:{getUser:async()=>({data:{user}}),mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:level}})}}};
 const {updateSession}=load('src/lib/supabase/middleware.ts',{'@supabase/ssr':{createServerClient:()=>client},'@/lib/security/rate-limit':{RATE_LIMITS:{api:{}},getClientIp:()=> 'test',rateLimitCheck:async()=>({success:true}),rateLimitHeaders:()=>({})}});
 for(const route of ['/admin/login','/admin/pedidos']){const response=await updateSession(new NextRequest('https://store.example'+route));assert.equal(response.status,307);assert.equal(new URL(response.headers.get('location')).pathname,'/admin/verificar');}
 assert.equal((await updateSession(new NextRequest('https://store.example/admin/verificar'))).status,200);
 const response=await updateSession(new NextRequest('https://store.example/api/admin/test'));assert.equal(response.status,403);assert.equal((await response.json()).codigo,'MFA_REQUIRED');
 level='aal2';assert.equal((await updateSession(new NextRequest('https://store.example/admin/pedidos'))).status,200);
});
test('MFA actions are scoped to the signed-in account and active removal verifies a fresh code server-side',async()=>{
 let authenticated=true,allowed=true,status='verified',verifyCalls=0,removals=0,limited=false;
 const client={auth:{getUser:async()=>({data:{user:authenticated?{id,factors:[{id,factor_type:'totp',status}]}:null}}),mfa:{listFactors:async()=>({data:{totp:[{id,status:'verified'}]}}),enroll:async()=>({data:{id,totp:{qr_code:'data:image/svg+xml,test',secret:'test-only-secret'}}}),challengeAndVerify:async({code})=>{verifyCalls++;return{error:code==='123456'?null:Error('invalid')}},unenroll:async()=>{removals++;return{error:null}}}}};
 const actions=load('src/actions/admin/mfa.ts',{'next/headers':{headers:async()=>new Headers()},'@/integrations/supabase/server':{createServerSupabaseClient:async()=>client},'@/lib/admin/auth':{requireAdmin:async()=>{if(!allowed)throw Error('UNAUTHORIZED')}},'@/lib/security/rate-limit':{getClientIp:()=> 'test',rateLimitCheck:async()=>({success:!limited})}});
 assert.equal((await actions.verifyAdminMfa(other,'123456')).success,false);assert.equal(verifyCalls,0);assert.equal((await actions.verifyAdminMfa(id,'000000')).success,false);assert.equal((await actions.verifyAdminMfa(id,'123456')).success,true);
 authenticated=false;assert.equal((await actions.verifyAdminMfa(id,'123456')).success,false);authenticated=true;
 await assert.rejects(()=>actions.unenrollAdminMfa(id),/código/);await assert.rejects(()=>actions.unenrollAdminMfa(id,'000000'),/Código/);assert.equal(removals,0);await actions.unenrollAdminMfa(id,'123456');assert.equal(removals,1);
 status='unverified';await actions.unenrollAdminMfa(id);assert.equal(removals,2);
 allowed=false;await assert.rejects(()=>actions.enrollAdminMfa(),/UNAUTHORIZED/);allowed=true;limited=true;await assert.rejects(()=>actions.verifyAdminMfa(id,'123456'),/Aguarde/);
});
