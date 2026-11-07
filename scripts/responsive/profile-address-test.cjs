const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),ts=require('typescript');
test('address edit verifies session, ownership and fields, preserving principal status',async()=>{
 let session=null,allowed=true,writes=[];
 const id='5f206fea-c6b7-4d2b-9a70-e28aa10be91a';
 const data={apelido:'Casa',logradouro:'Rua Teste',numero:'10',bairro:'Centro',cidade:'Poloni',estado:'SP',cep:'15160000',principal:false};
 const address={id,principal:true};
 const mocks={'@/lib/enderecos-cliente':{parseAdditionalAddresses:value=>Array.isArray(value)?value:JSON.parse(value || '[]')},zod:require('zod'),'next/headers':{headers:async()=>new Headers()},'@/lib/auth':{obterSessao:async()=>session},'@/lib/endereco':{atualizarEndereco:async(...args)=>{writes.push(args);return{sucesso:true}}},'@/integrations/supabase/client.server':{createServerClient:()=>({from:()=>({select(){return this},eq(_key,value){assert.equal(value,'owner');return this},single:async()=>({data:{enderecos_adicionais:[address]}})})})},'@/lib/security/sanitize':{sanitizeText:(s,n)=>s.slice(0,n)},'@/lib/security/rate-limit':{RATE_LIMITS:{mutation:{}},getClientIp:()=> 'test',rateLimitCheck:async()=>({success:allowed})}};
 const exports={};new Function('require','exports',ts.transpileModule(fs.readFileSync('src/actions/cliente-enderecos.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>{if(name in mocks)return mocks[name];throw Error(name)},exports);
 const save=exports.salvarEnderecoExistente;
 assert.equal((await save(id,data)).sucesso,false);assert.equal(writes.length,0);
 session={id:'owner'};allowed=false;assert.equal((await save(id,data)).sucesso,false);
 allowed=true;assert.equal((await save('endereco-legado',data)).sucesso,false);
 assert.equal((await save('6010fbfa-4a41-4585-a07b-3610d76d3301',data)).sucesso,false);
 assert.equal((await save(id,{...data,cep:'invalid'})).sucesso,false);assert.equal(writes.length,0);
 assert.equal((await save(id,{...data,id:'tampered',clienteId:'other'})).sucesso,true);
 assert.equal(writes[0][0],'owner');assert.equal(writes[0][1],id);assert.equal(writes[0][2].principal,true);assert.equal(writes[0][2].clienteId,undefined);
});
