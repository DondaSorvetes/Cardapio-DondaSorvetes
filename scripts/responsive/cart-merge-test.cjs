const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
// Carrega só as funções puras do carrinho (sem React).
const source=fs.readFileSync('src/context/CarrinhoContext.tsx','utf8');
const mod={};new Function('require','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText)(()=>({createContext(){},useContext(){},useState(){},useEffect(){}}),mod);
const {juntarItem}=mod;
const acai={id:'7',name:'Açaí 500ml',price:20};
const item=(uid,extra={})=>({uid,produto:acai,qty:1,selections:{g1:['a','b']},observacoes:'',colher:true,total:24.5,...extra});

test('same product, options, spoon answer and note become one "2x" line',()=>{
 let itens=juntarItem([],item('1'));
 itens=juntarItem(itens,item('2',{selections:{g1:['b','a']}})); // mesma escolha em outra ordem
 assert.equal(itens.length,1);assert.equal(itens[0].qty,2);assert.equal(itens[0].total,49);assert.equal(itens[0].uid,'1');
});

test('different options, spoon answer or note stay on separate lines',()=>{
 let itens=juntarItem([],item('1'));
 itens=juntarItem(itens,item('2',{selections:{g1:['a','c']}}));
 itens=juntarItem(itens,item('3',{colher:false}));
 itens=juntarItem(itens,item('4',{observacoes:'sem leite condensado'}));
 assert.equal(itens.length,4);assert.ok(itens.every(i=>i.qty===1));
});

test('repeated lines from an older saved bag are merged on load, keeping cents exact',()=>{
 const salvos=[item('1',{total:10.1}),item('2',{total:10.1}),item('3',{total:10.1})].map(i=>({...i,selections:{}}));
 const itens=salvos.reduce(juntarItem,[]);
 assert.equal(itens.length,1);assert.equal(itens[0].qty,3);assert.equal(itens[0].total,30.3);
});

test('a line never passes the checkout limit of 100 units',()=>{
 const itens=juntarItem([item('1',{qty:100,total:2450})],item('2'));
 assert.equal(itens.length,2);
});
