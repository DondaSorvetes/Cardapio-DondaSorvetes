const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const mod = {exports: {}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/combos/options.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText, {exports:mod.exports, module:mod});
const {loadComboOptionGroups, resolveComboChoices, resolveComboOrder} = mod.exports;
const tables = {
  produtos: [{id:1,nome:'Milkshake',esta_disponivel:true},{id:2,nome:'Água',esta_disponivel:true}],
  produto_grupos:[{produto_id:1,grupo_id:1,ordem:0}],
  grupos_opcoes:[{id:1,nome:'Sabor',min_escolha:1,max_escolha:1}],
  opcoes:[{id:1,grupo_id:1,nome:'Morango',preco_adicional:2},{id:2,grupo_id:1,nome:'Chocolate',preco_adicional:0},{id:3,grupo_id:1,nome:'Baunilha',esta_disponivel:false}],
};
const client = {from(table) {let rows=tables[table];const q={select(){return q},in(key,ids){rows=rows.filter(row=>ids.includes(row[key]));return q},order(){return q},then(resolve){return Promise.resolve({data:rows,error:null}).then(resolve)}};return q}};
(async()=>{
  const groups=await loadComboOptionGroups(client,[{produto_id:1,quantidade:2},{produto_id:2,quantidade:1}]);
  assert.equal(groups.length,2);
  assert.notEqual(groups[0].id,groups[1].id);
  const choices={[groups[0].id]:['1'],[groups[1].id]:['2']};
  assert.equal(resolveComboChoices(groups,choices).extras,2);
  const customer=resolveComboOrder(groups,{modo:'cliente',selecoes:{}},choices,2,44,20);
  assert.equal(customer.total,44);
  assert.equal(customer.adicionais.length,2);
  assert.notEqual(customer.adicionais[0].groupName,customer.adicionais[1].groupName);
  const fixed=resolveComboOrder(groups,{modo:'fixo',selecoes:choices},{},2,40,20);
  assert.equal(fixed.total,40);
  assert.ok(fixed.adicionais.every(choice=>choice.price===0));
  assert.equal(fixed.adicionais[0].name,'Morango');
  for(const invalid of [{}, {...choices,[groups[0].id]:['1','1']}, {...choices,[groups[0].id]:['3']}, {...choices,[groups[0].id]:['99']}, {...choices,extra:['1']}, {...choices,[groups[0].id]:'1'}]) assert.throws(()=>resolveComboChoices(groups,invalid));
  for(const [qty,total] of [[0,0],[1.5,33],[1,20],[1,NaN],[101,2222]]) assert.throws(()=>resolveComboOrder(groups,{modo:'cliente',selecoes:{}},choices,qty,total,20));
  assert.throws(()=>resolveComboOrder(groups,{modo:'fixo',selecoes:choices},choices,1,20,20));
  assert.equal(resolveComboOrder(groups,null,{},1,20,20).adicionais.length,0);
  tables.produtos[0].esta_disponivel=false;
  await assert.rejects(()=>loadComboOptionGroups(client,[{produto_id:1,quantidade:1}]));
  const acai=[];
  for(let unit=0;unit<2;unit++) {
    acai.push({id:`size${unit}`,name:'Tamanho',sourceGroupName:'Tamanho',productName:'Açaí',comboUnitKey:String(unit),min:1,max:1,items:[{id:'300',name:'300 ml'}]});
    for(const name of ['Cremes','Adicionais'])acai.push({id:name+unit,name,sourceGroupName:name,productName:'Açaí',comboUnitKey:String(unit),min:0,max:5,items:[{id:'a',name:'A'},{id:'b',name:'B'},{id:'c',name:'C'}]});
  }
  const selected={size0:['300'],size1:['300'],Cremes0:['a','b'],Adicionais0:['c'],Cremes1:['a','b'],Adicionais1:['c']};
  assert.equal(resolveComboChoices(acai,selected).resolved.length,8);
  assert.throws(()=>resolveComboChoices(acai,{...selected,Adicionais0:['a','c']}));
  console.log('Combo option rules passed: separate units, required options, unavailable options, extra charges, fixed inclusions, tampered totals, legacy combos and per-unit açaí limits.');
})().catch(error=>{console.error(error);process.exitCode=1});
