const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { createRequire } = require('node:module');
function load(file, mocks = {}) {
  const absolute = path.resolve(file), native = createRequire(absolute), mod = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', source)(name => mocks[name] ?? (name.startsWith('@/') ? load('src/' + name.slice(2) + '.ts', mocks) : name.startsWith('.') ? load(path.resolve(path.dirname(absolute),name)+'.ts',mocks) : native(name)), mod, mod.exports);
  return mod.exports;
}

const {test}=require('node:test');
test('server prices ordinary items, validates choices and rejects client snapshots',()=>{
 const {checkoutItemSchema,resolveProductItem}=load('src/lib/checkout/items.ts');
 const product={id:1,nome:'Nome do catálogo',descricao:'',preco_base:30,preco_promocional:20,esta_disponivel:true,imagem_url:null};
 const group={id:'10',name:'Sabor',min:1,max:1,required:true,items:[{id:'2',name:'Opção real',priceDelta:3}]};
 const item=checkoutItemSchema.parse({produto:{id:'1',name:'Nome forjado',price:0},qty:2,total:46,selections:{10:['2']},adicionais:[{name:'forjado'}]});
 const saved=resolveProductItem(item,product,[group]);assert.equal(saved.total,46);assert.equal(saved.produto.name,product.nome);assert.equal(saved.adicionais[0].name,'Opção real');
 for(const qty of [-1,0,1.5,101])assert.equal(checkoutItemSchema.safeParse({...item,qty}).success,false);
 assert.throws(()=>resolveProductItem({...item,total:0.01},product,[group]));
 assert.throws(()=>resolveProductItem({...item,selections:{}},product,[group]));
 assert.throws(()=>resolveProductItem({...item,selections:{10:['2','2']}},product,[group]));
 assert.throws(()=>resolveProductItem({...item,selections:{99:['2']}},product,[group]));
 assert.throws(()=>resolveProductItem(item,{...product,esta_disponivel:false},[group]));
 assert.throws(()=>resolveProductItem(item,product,[{...group,items:[{...group.items[0],disponivel:false}]}]));
});
test('checkout never inserts forged subtotal, unknown items, unavailable configuration or invalid quantity',async()=>{
 let inserted=[],config={esta_aberto:true,taxa_entrega:3},products=[{id:1,nome:'Produto real',preco_base:20,preco_promocional:null,esta_disponivel:true}];
 const db={from(table){return {select(){return this},in(){return this},eq(){return this},order(){return this},limit(){return this},lte(){return this},gte(){return this},maybeSingle:async()=>({data:config}),then(resolve){return Promise.resolve({data:table==='produtos'?products:[]}).then(resolve)},insert(value){inserted.push(value);return this},single:async()=>({data:{id:'synthetic',...inserted.at(-1)}})}}};
 const {POST}=load('src/app/api/pedidos/criar/route.ts',{'@/lib/auth':{obterSessao:async()=>({id:'client-A'})},'@/integrations/supabase/client.server':{createServerClient:()=>db},'@/lib/security/with-api-guard':{withApiGuard:(_,handler)=>handler},'@/lib/security/logger':{securityLog(){}},'@/lib/combos/options':{loadComboOptionGroups:async()=>[],resolveComboChoices:()=>({extras:0,resolved:[]})}});
 const body={cliente_nome:'Fictício',cliente_telefone:'17900000000',tipo_entrega:'retirada',meio_pagamento:'dinheiro',subtotal:20,taxa_entrega:0,total:20,itens:[{produto:{id:'1'},qty:1,total:20}]};
 const call=b=>POST({json:async()=>b},{ip:'test'});
 assert.equal((await call(body)).status,201);assert.equal(inserted.length,1);assert.equal(inserted[0].cliente_id,'client-A');assert.equal(inserted[0].itens[0].produto.name,'Produto real');
 assert.equal((await call({...body,subtotal:0.01,itens:[{...body.itens[0],total:0.01}]})).status,409);
 assert.equal((await call({...body,subtotal:0.01})).status,409);
 assert.equal((await call({...body,itens:[{...body.itens[0],qty:-2}]})).status,400);
 products=[];assert.equal((await call(body)).status,409);
 config=null;assert.equal((await call(body)).status,503);assert.equal(inserted.length,1);
});
test('staff action permission is checked before service client access',async()=>{
 const {hasPermission}=load('src/lib/security/rbac.ts');let role='atendente',writes=0;
 const mocks={'@/lib/admin/auth':{requirePermission:async permission=>{if(!hasPermission(role,permission))throw Error('FORBIDDEN');}},'@/integrations/supabase/client.server':{createServiceRoleClient:()=>({from(){return {update(){writes++;return this},eq(){return this},select(){return this},maybeSingle:async()=>({data:{id:1}})}}})}};
 const {updateProduto}=load('src/actions/admin/produtos.ts',mocks);await assert.rejects(()=>updateProduto(1,{nome:'Teste'}),/FORBIDDEN/);assert.equal(writes,0);
 role='gerente';await updateProduto(1,{nome:'Teste'});assert.equal(writes,1);
 role='atendente';const {getRelatorios}=load('src/actions/admin/relatorios.ts',mocks);await assert.rejects(()=>getRelatorios({}),/FORBIDDEN/);
 const {updatePedidoStatus}=load('src/actions/admin/pedidos.ts',{...mocks,'@/lib/admin/auth':{requirePermission:async()=>{throw Error('FORBIDDEN')}}});await assert.rejects(()=>updatePedidoStatus('synthetic','preparando'),/FORBIDDEN/);
});
test('production mutations reject absent and forged origins',()=>{
 const old=process.env.NODE_ENV,url=process.env.NEXT_PUBLIC_APP_URL;process.env.NODE_ENV='production';process.env.NEXT_PUBLIC_APP_URL='https://store.example';
 try{const {isTrustedOrigin}=load('src/lib/security/origin.ts');const req=headers=>({method:'POST',headers:new Headers(headers)});assert.equal(isTrustedOrigin(req({host:'evil.example',origin:'https://evil.example'})),false);assert.equal(isTrustedOrigin(req({host:'store.example'})),false);assert.equal(isTrustedOrigin(req({origin:'http://localhost:3000'})),false);assert.equal(isTrustedOrigin(req({origin:'https://store.example'})),true);assert.equal(isTrustedOrigin(req({referer:'https://store.example/checkout'})),true);assert.equal(isTrustedOrigin(req({origin:'http://store.example'})),false);assert.equal(isTrustedOrigin(req({origin:'https://store.example.evil.example'})),false);}finally{if(old===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=old;if(url===undefined)delete process.env.NEXT_PUBLIC_APP_URL;else process.env.NEXT_PUBLIC_APP_URL=url;}
});
test('rate limiting uses atomic expiry, fails closed in production and ignores untrusted IP headers',async()=>{
 const saved={...process.env},nativeFetch=global.fetch;process.env.NODE_ENV='production';process.env.UPSTASH_REDIS_REST_URL='https://redis.example';process.env.UPSTASH_REDIS_REST_TOKEN='synthetic';delete process.env.VERCEL;delete process.env.TRUSTED_PROXY_IP_HEADER;
 try{const {rateLimitCheck,getClientIp}=load('src/lib/security/rate-limit.ts');let command;global.fetch=async(_url,init)=>{command=JSON.parse(init.body);return {ok:true,json:async()=>({result:[1,60000]})}};assert.equal((await rateLimitCheck('user',{bucket:'test',limit:2,windowSec:60})).success,true);assert.equal(command[0],'EVAL');assert.match(command[1],/PEXPIRE/);assert.equal(getClientIp(new Request('https://example.test',{headers:{'x-forwarded-for':'1.2.3.4'}})),'unknown');process.env.TRUSTED_PROXY_IP_HEADER='x-real-ip';assert.equal(getClientIp(new Request('https://example.test',{headers:{'x-real-ip':'1.2.3.4'}})),'1.2.3.4');global.fetch=async()=>({ok:false});assert.equal((await rateLimitCheck('user',{bucket:'test',limit:2,windowSec:60})).success,false);}finally{global.fetch=nativeFetch;for(const key of ['NODE_ENV','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','VERCEL','TRUSTED_PROXY_IP_HEADER'])if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];}
});
test('security logs redact nested credentials and tolerate circular metadata',()=>{
 const {securityLog}=load('src/lib/security/logger.ts');const native=console.info;let output;console.info=value=>output=value;try{const meta={nested:{token:'do-not-log',list:[{senha:'do-not-log'}]}};meta.circular=meta;securityLog({event:'api.error',meta});assert.ok(!output.includes('do-not-log'));assert.match(output,/REDACTED/);}finally{console.info=native;}
});

test('idempotency is scoped to the customer, hides the hash and rejects reused keys for a different body',async()=>{
 const old=process.env.CHECKOUT_IDEMPOTENCY_ENABLED;process.env.CHECKOUT_IDEMPOTENCY_ENABLED='true';
 try{const {checkoutIdentity,previousCheckout}=load('src/lib/checkout/idempotency.ts');const identity=checkoutIdentity('synthetic-key-12345',{total:20});assert.throws(()=>checkoutIdentity('short',{}));let filters=[];const db={from:()=>({select(){return this},eq(k,v){filters.push([k,v]);return this},maybeSingle:async()=>({data:{id:'existing',idempotency_hash:identity.hash}})})};const previous=await previousCheckout(db,'client-A',identity);assert.equal(previous.id,'existing');assert.equal(previous.idempotency_hash,undefined);assert.deepEqual(filters,[['cliente_id','client-A'],['idempotency_key',identity.key]]);await assert.rejects(()=>previousCheckout(db,'client-A',{...identity,hash:'different'}));}finally{if(old===undefined)delete process.env.CHECKOUT_IDEMPOTENCY_ENABLED;else process.env.CHECKOUT_IDEMPOTENCY_ENABLED=old;}
});
test('revocation stores only the token ID and expiry; database failure is not treated as a valid session',async()=>{
 const {isRevoked,revokeSession}=load('src/lib/security/session-revocation.ts');let saved;const db={from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:{jti:'synthetic'}}),upsert:async v=>{saved=v;return {error:null}}})};assert.equal(await isRevoked(db,'synthetic'),true);await revokeSession(db,'synthetic',2000000000);assert.deepEqual(Object.keys(saved),['jti','expires_at']);const broken={from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>({error:{message:'offline'}})})};await assert.rejects(()=>isRevoked(broken,'synthetic'));
});

test('API guard caps actual body bytes even when content-length lies, and passes valid JSON unchanged',async()=>{
 const {NextRequest,NextResponse}=require('next/server');let calls=0;
 const {withApiGuard}=load('src/lib/security/with-api-guard.ts',{'./rate-limit':{RATE_LIMITS:{api:{}},getClientIp:()=> 'test',rateLimitCheck:async()=>({success:true}),rateLimitHeaders:()=>({})},'./origin':{isTrustedOrigin:()=>true},'./logger':{securityLog(){}}});
 const handler=withApiGuard({methods:['POST'],maxBodyBytes:16},async req=>{calls++;return NextResponse.json(await req.json())});
 const tooLarge=new NextRequest('https://store.test/api',{method:'POST',headers:{'content-length':'1'},body:'x'.repeat(17)});assert.equal((await handler(tooLarge)).status,413);assert.equal(calls,0);
 const valid=new NextRequest('https://store.test/api',{method:'POST',body:'{"ok":true}'});assert.deepEqual(await(await handler(valid)).json(),{ok:true});assert.equal(calls,1);
});
test('public image proxy allows catalog folders only',()=>{
 const {isPublicCatalogImagePath,sanitizeStoragePath}=load('src/lib/security/sanitize.ts');
 for(const path of ['Produtos/acai.webp','Loja/logo.webp','configuracoes/legacy.png'])assert.equal(isPublicCatalogImagePath(path),true);
 for(const path of ['documentos/privado.png','avatars/personal.jpg','Loja/logo.svg'])assert.equal(isPublicCatalogImagePath(path),false);
 assert.equal(sanitizeStoragePath('../secret.png'),null);
});

test('signed customer token is refused after logout revocation and during revocation database failure',async()=>{
 const oldSecret=process.env.AUTH_JWT_SECRET,oldFlag=process.env.SESSION_REVOCATION_ENABLED;process.env.AUTH_JWT_SECRET='synthetic-test-only-secret-at-least-32-characters';process.env.SESSION_REVOCATION_ENABLED='true';
 let revoked=false,offline=false;try{const {gerarToken,verificarToken,revogarToken}=load('src/lib/auth.ts',{'next/headers':{cookies:async()=>({get(){return undefined}})},'@/integrations/supabase/client.server':{createServerClient:()=>({from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>offline?{error:{message:'offline'}}:{data:revoked?{jti:'synthetic'}:null},upsert:async()=>{revoked=true;return {error:null}}})})}});const token=await gerarToken({id:'synthetic-client',nome:'Teste',telefone:null,endereco:null});assert.equal((await verificarToken(token)).id,'synthetic-client');await revogarToken(token);assert.equal(await verificarToken(token),null);revoked=false;offline=true;assert.equal(await verificarToken(token),null);}finally{if(oldSecret===undefined)delete process.env.AUTH_JWT_SECRET;else process.env.AUTH_JWT_SECRET=oldSecret;if(oldFlag===undefined)delete process.env.SESSION_REVOCATION_ENABLED;else process.env.SESSION_REVOCATION_ENABLED=oldFlag;}
});

test('removing the reports capability actually revokes manager report access',()=>{
 const {hasPermission,buildPermissoesFromCapabilities}=load('src/lib/security/rbac.ts');
 const revoked=buildPermissoesFromCapabilities('gerente',[]);assert.equal(revoked.includes('relatorio:read'),false);assert.equal(hasPermission('gerente','relatorio:read',revoked),false);assert.equal(hasPermission('gerente','relatorio:read',buildPermissoesFromCapabilities('gerente',['relatorio:read'])),true);assert.equal(hasPermission('admin','relatorio:read',[]),true);
});

test('middleware keeps all refreshed cookie chunks and does not loop a nonstaff login',async()=>{
 const {NextRequest}=require('next/server');
 const mocks={'@supabase/ssr':{createServerClient:(_url,_key,options)=>({auth:{getUser:async()=>{options.cookies.set('session-part-0','part-zero',{});options.cookies.set('session-part-1','part-one',{});return {data:{user:{id:'synthetic-staff'}}}}},from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:null})})})},'@/lib/security/admin-mfa':{adminNeedsMfa:async()=>false},'@/lib/security/rate-limit':{RATE_LIMITS:{api:{},login:{},register:{}},getClientIp:()=> 'test',rateLimitCheck:async()=>({success:true}),rateLimitHeaders:()=>({})}};
 const {updateSession}=load('src/lib/supabase/middleware.ts',mocks);
 const response=await updateSession(new NextRequest('https://store.test/admin/login'));
 assert.equal(response.status,200);assert.equal(response.cookies.get('session-part-0').value,'part-zero');assert.equal(response.cookies.get('session-part-1').value,'part-one');assert.ok(response.headers.get('content-security-policy'));
 assert.equal(fs.existsSync('src/middleware.ts'),true);
});
