const fs=require('fs'),path=require('path'),ts=require('typescript'),assert=require('node:assert/strict'),{createRequire}=require('node:module');
const file=path.resolve('src/app/api/auth/registrar/route.ts'),native=createRequire(file);
let inserted=null,lookup=false;
const db={from(){return {select(){return this},eq(){return this},async maybeSingle(){return {data:lookup?{id:'existing'}:null}},insert(value){inserted=value;return this},async single(){return {data:{id:inserted.id,nome:inserted.nome,telefone:inserted.telefone},error:null}}}}};
const imports={
 '@/lib/auth':{normalizarTelefone:value=>value.replace(/\D/g,'')},
 '@/integrations/supabase/client.server':{createServerClient:()=>db},
 '@/lib/security/with-api-guard':{withApiGuard:(_,handler)=>handler},
 '@/lib/security/rate-limit':{RATE_LIMITS:{register:{}}},
 '@/lib/security/api-response':{apiOk:(data,status=200)=>({status,data}),apiError:(message,status)=>({status,message}),apiValidation:message=>({status:400,message}),apiServerError:error=>{throw error}},
 '@/lib/security/sanitize':{sanitizePhone:value=>value.replace(/\D/g,''),sanitizeText:value=>value.trim()},
 '@/lib/security/logger':{securityLog(){}},
};
const moduleObject={exports:{}};
new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(name=>imports[name]??native(name),moduleObject,moduleObject.exports);
const send=body=>moduleObject.exports.POST({json:async()=>body},{ip:'test'});
(async()=>{
 const base={nome:'Cliente de teste',telefone:'17900000000'};
 let result=await send(base);assert.equal(result.status,201);assert.equal(inserted.endereco,null);assert.deepEqual(JSON.parse(inserted.enderecos_adicionais),[]);
 result=await send({...base,endereco:null});assert.equal(result.status,201);assert.equal(inserted.endereco,null);
 const address='Rua Teste, 10 - Centro, Poloni/SP - CEP: 15160000';result=await send({...base,endereco:address});assert.equal(result.status,201);assert.equal(inserted.endereco,address);assert.equal(JSON.parse(inserted.enderecos_adicionais).length,1);
 for(const body of [{...base,telefone:'123'},{...base,nome:'A'},{...base,endereco:'x'}])assert.equal((await send(body)).status,400);
 lookup=true;inserted=null;assert.equal((await send(base)).status,409);assert.equal(inserted,null);
 console.log('Registration contract passed: optional address, legacy address, existing validation and conflict behavior. No live database writes.');
})().catch(error=>{console.error(error);process.exitCode=1});
