const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const exportsQr={};new Function('exports',ts.transpileModule(fs.readFileSync('src/lib/security/mfa-qr.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exportsQr);
const {mfaQrImageSource}=exportsQr;
test('raw Supabase SVG with trailing newline is encoded without changing the artwork',()=>{
 const svg='<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="207" height="207"><rect width="207" height="207" fill="#fff"/></svg>\n';
 const source=mfaQrImageSource('data:image/svg+xml;utf-8,'+svg);
 assert.equal(decodeURIComponent(source.slice(source.indexOf(',')+1)),svg.trim());assert.ok(!/[\s<>"#]/.test(source));
 const {getImageProps}=require('next/image');assert.doesNotThrow(()=>getImageProps({src:source,width:200,height:200,unoptimized:true,alt:'QR code'}));
 assert.equal(mfaQrImageSource(source),source);
});
test('encoded and base64 SVG sources remain valid and unsupported sources are rejected',()=>{
 const svg='<svg xmlns="http://www.w3.org/2000/svg"/>';
 assert.equal(decodeURIComponent(mfaQrImageSource('data:image/svg+xml,'+encodeURIComponent(svg)).split(',')[1]),svg);
 const payload=Buffer.from(svg).toString('base64');assert.equal(mfaQrImageSource('data:image/svg+xml;base64,\n'+payload+'\n'),'data:image/svg+xml;base64,'+payload);
 assert.throws(()=>mfaQrImageSource('https://example.com/code.svg'),/inválido/);
});
