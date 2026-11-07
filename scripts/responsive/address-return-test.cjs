const fs=require('fs'),path=require('path'),ts=require('typescript'),assert=require('node:assert/strict'),{createRequire}=require('node:module');
const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
const location={href:''};let pushed='';
const router={push:value=>pushed=value,refresh(){},back(){}};
function load(file,states,imports){let index=0;const native=createRequire(path.resolve(file)),react={...native('react'),useState:initial=>[states(index++,initial),()=>{}],useEffect(){},useRef:initial=>({current:initial})};
 const mocks={'@/context/AuthContext':{useAuth:()=>({refreshCliente:async()=>{}})},'@/actions/cliente-enderecos':{salvarEnderecoExistente:async()=>({sucesso:true})},'react':react,'next/navigation':{useRouter:()=>router},'sonner':{toast:{success(){},error(){},info(){}}},'@/lib/pagamento':{MEIOS_PAGAMENTO:[{valor:'dinheiro',rotulo:'Dinheiro'}],rotuloPagamento:String},...imports};
 const req=name=>name === '@/lib/customer-resource' ? { invalidateCustomerResources() {} } : name === '@/lib/cupom-pendente' ? { CUPOM_PENDENTE_KEY: 'cupom-pendente', lerCupomPendente: () => null, guardarCupomPendente() {}, limparCupomPendente() {} } : mocks[name]??(name.startsWith('@/components/ui/')?new Proxy({},{get:(_,key)=>String(key)}):name.startsWith('@/lib/utils/pedido')?{resolveSelectionsFromProduct:()=>[]}:native(name));
 const mod={exports:{}};
 new Function('require','module','exports','window','sessionStorage','fetch',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText)(req,mod,mod.exports,{location},storage,async()=>({ok:true,json:async()=>({})}));
 return mod.exports;
}
function find(node,predicate){if(!node||typeof node!=='object')return null;if(predicate(node))return node;for(const child of [].concat(node.props?.children??[])){const found=Array.isArray(child)?child.map(x=>find(x,predicate)).find(Boolean):find(child,predicate);if(found)return found}return null}
const product={id:'1',name:'Açaí',price:20};
// Estados da sacola: 0 = etapa, 6 = CEP digitado.
const cart=load('src/components/cardapio/ModalSacola.tsx',(i,initial)=>i===0?'entrega':i===6?'15160-000':initial,{
 '@/context/CarrinhoContext':{useCarrinho:()=>({itens:[{uid:'1',produto:product,qty:1,selections:{},total:20}],subtotal:20}),resumoOpcoes:()=>''},
 '@/context/AuthContext':{useAuth:()=>({cliente:{nome:'Cliente de teste',telefone:'17900000000'},session:{user:{id:'test'}},loading:false})},
 '@/lib/enderecos-cliente':{customerAddresses:()=>[]},
 '@/hooks/useCardapio':{useMenu:()=>({categories:[],isLoading:false})},
 '@/hooks/useLoja':{useLoja:()=>({loja:{esta_aberto:true,taxa_entrega:3}})},
 '@/data/tipos':{formatBRL:value=>String(value),getProductUnitPrice:p=>p.price},
});
const tree=cart.ModalSacola({open:true,onOpenChange(){}});
const add=find(tree,node=>node.type==='button'&&String(node.props.children).includes('Não sei meu CEP'));assert.ok(add);add.props.onClick();
assert.equal(location.href,'/perfil/enderecos/novo');assert.equal(storage.getItem('reopenCart'),'true');assert.equal(storage.getItem('cartStep'),'entrega');
// "Buscar CEP" abre o cadastro com o CEP já preenchido.
values.clear();location.href='';find(tree,node=>node.type==='form').props.onSubmit({preventDefault(){}});
assert.equal(location.href,'/perfil/enderecos/novo?cep=15160000');assert.equal(storage.getItem('reopenCart'),'true');
// CEP de um endereço já salvo: usa o endereço salvo e não abre o cadastro.
const salvo={id:'a1',apelido:'Casa',logradouro:'Rua Teste',numero:'10',bairro:'Centro',cidade:'Poloni',estado:'SP',cep:'15160-000',principal:true};
const cartSalvo=load('src/components/cardapio/ModalSacola.tsx',(i,initial)=>i===0?'entrega':i===2?[salvo]:i===6?'15160000':initial,{
 '@/context/CarrinhoContext':{useCarrinho:()=>({itens:[{uid:'1',produto:product,qty:1,selections:{},total:20}],subtotal:20})},
 '@/context/AuthContext':{useAuth:()=>({cliente:{nome:'Cliente de teste',telefone:'17900000000'},session:{user:{id:'test'}},loading:false})},
 '@/lib/enderecos-cliente':{customerAddresses:()=>[salvo]},
 '@/hooks/useCardapio':{useMenu:()=>({categories:[],isLoading:false})},
 '@/hooks/useLoja':{useLoja:()=>({loja:{esta_aberto:true,taxa_entrega:3}})},
 '@/data/tipos':{formatBRL:value=>String(value),getProductUnitPrice:p=>p.price},
});
values.clear();location.href='';find(cartSalvo.ModalSacola({open:true,onOpenChange(){}}),node=>node.type==='form').props.onSubmit({preventDefault(){}});
assert.equal(location.href,'');assert.equal(storage.getItem('reopenCart'),null);
storage.setItem('reopenCart','true'); // o cadastro abaixo continua vindo da sacola
const form=load('src/components/enderecos/FormularioEndereco.tsx',(i,initial)=>i===2?{apelido:'Casa',logradouro:'Rua Teste',numero:'10',bairro:'Centro',cidade:'Poloni',estado:'SP',cep:'15160000',principal:true}:initial,{});
(async()=>{
 let tree=form.FormularioEndereco();await find(tree,node=>node.type==='form').props.onSubmit({preventDefault(){}});assert.equal(location.href,'/');assert.equal(storage.getItem('reopenCart'),'true');assert.equal(pushed,'');
 values.clear();location.href='';tree=form.FormularioEndereco();await find(tree,node=>node.type==='form').props.onSubmit({preventDefault(){}});assert.equal(pushed,'/perfil/enderecos');
 console.log('Address flow passed: new account can add an address from the bag, return to checkout, and retain normal profile navigation.');
})().catch(error=>{console.error(error);process.exitCode=1});
