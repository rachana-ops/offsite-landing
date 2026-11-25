import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const source=readFileSync(new URL('../js/wellness-attribution.js',import.meta.url),'utf8');
function run({search='',href='https://hellonancy.com/products/lem',stored='',blockedStorage=false}={}) {
  const storage=new Map([['wellness-guide-attribution-v1',stored]]);
  const listeners=new Map(); let mutation;
  const anchor={attributes:{href},getAttribute(k){return this.attributes[k]},setAttribute(k,v){this.attributes[k]=v},closest(){return this},get href(){return this.attributes.href}};
  const document={readyState:'complete',documentElement:{},querySelectorAll(){return [anchor]},addEventListener(k,fn){listeners.set(k,fn)}};
  const window={location:{href:'https://wellnessinsiderguide.com/'+search,search},_tfa:[]};
  const sessionStorage={getItem(k){if(blockedStorage)throw Error('blocked');return storage.get(k)},setItem(k,v){if(blockedStorage)throw Error('blocked');storage.set(k,v)}};
  const context=vm.createContext({window,document,sessionStorage,URL,URLSearchParams,Set,WeakSet,MutationObserver:class{constructor(fn){mutation=fn}observe(){}}});
  vm.runInContext(source,context);
  return {anchor,window,storage,listeners,context,mutate(){mutation([{type:'attributes',target:anchor,addedNodes:[]}])}};
}

test('Wellness links preserve every query field, repeated values, encoded characters, and blanks',()=>{
  const q='?utm_source=taboola&utm_content=original%20%26%20creative&tblci=click-123&_gl=google-linker&campaign_id=123&custom=hello%2Bworld&repeat=a&repeat=b&empty=&__proto__=safe';
  const {anchor}=run({search:q,href:'https://get.nancyflow.com/en/products/lem?discount=SAVE&variant=42&utm_content=old#details'});
  const u=new URL(anchor.href);assert.equal(u.origin,'https://hellonancy.com');assert.equal(u.pathname,'/products/lem');
  for(const key of new Set(new URLSearchParams(q).keys()))assert.deepEqual(u.searchParams.getAll(key),new URLSearchParams(q).getAll(key));
  assert.equal(u.searchParams.get('discount'),'SAVE');assert.equal(u.searchParams.get('variant'),'42');assert.equal(u.hash,'#details');
});

test('a new campaign replaces stale session parameters and parameter-free refreshes retain attribution',()=>{
  const fresh=run({search:'?utm_source=new&tblci=fresh',stored:'utm_source=old&tblci=stale&gclid=stale'});
  assert.equal(new URL(fresh.anchor.href).searchParams.has('gclid'),false);
  const saved=fresh.storage.get('wellness-guide-attribution-v1');assert.equal(saved,'utm_source=new&tblci=fresh');
  const revisit=run({stored:saved});assert.equal(new URL(revisit.anchor.href).searchParams.get('tblci'),'fresh');
});

test('storage blocking leaves current URL forwarding functional',()=>{
  const {anchor}=run({search:'?utm_source=taboola&tblci=current',blockedStorage:true});
  assert.equal(new URL(anchor.href).searchParams.get('tblci'),'current');
});

test('late anchor changes and new-tab interactions preserve parameters without adding duplicate keys',()=>{
  const env=run({search:'?utm_source=taboola&tblci=current'});
  env.anchor.attributes.href='https://hellonancy.com/products/lem?discount=NEW#changed';env.mutate();
  const href=env.anchor.href;
  for(const type of ['pointerdown','focusin','contextmenu'])env.listeners.get(type)({target:env.anchor,button:0});
  assert.equal(env.anchor.href,href);assert.equal(new URL(href).searchParams.get('discount'),'NEW');assert.equal(new URL(href).hash,'#changed');
  assert.equal(env.window._tfa.length,0);
});

test('the CAPI relay token is retained and its raw cookie carriers are not reintroduced',()=>{
  const {anchor}=run({search:'?fbclid=meta-click&tblci=taboola-click&_fbc=raw&_fbp=raw&hn_at=stale',href:'https://hellonancy.com/products/lem?hn_at=current-token'});
  const q=new URL(anchor.href).searchParams;assert.equal(q.get('hn_at'),'current-token');assert.equal(q.get('fbclid'),'meta-click');assert.equal(q.get('tblci'),'taboola-click');assert.equal(q.has('_fbc'),false);assert.equal(q.has('_fbp'),false);
});

test('Taboola records a product click once per primary or middle click and ignores right clicks',()=>{
  const env=run({search:'?tblci=current'});
  env.listeners.get('click')({target:env.anchor,button:0});
  env.listeners.get('auxclick')({target:env.anchor,button:1});
  env.listeners.get('auxclick')({target:env.anchor,button:2});
  env.listeners.get('contextmenu')({target:env.anchor,button:2});
  const lem=env.window._tfa.filter(e=>e.name==='lem_product_click');
  assert.deepEqual(lem.map(e=>e.id),[2079308,2143240,2079308,2143240]);
  assert.equal(env.window._tfa.length,6);
  vm.runInContext(source,env.context);assert.equal(env.window._tfa.length,6);
});

test('click_cta goes to account 2143240 only, once per store-bound click, with the exact payload',()=>{
  const env=run({search:'?tblci=current'});
  const click={target:env.anchor,button:0};
  env.listeners.get('click')(click);env.listeners.get('click')(click); // same event twice must not double fire
  env.listeners.get('auxclick')({target:env.anchor,button:1});
  env.listeners.get('auxclick')({target:env.anchor,button:2});
  for(const type of ['pointerdown','focusin','contextmenu'])env.listeners.get(type)({target:env.anchor,button:0});
  const cta=env.window._tfa.filter(e=>e.name==='click_cta');
  assert.deepEqual(JSON.parse(JSON.stringify(cta)),[{notify:'event',name:'click_cta',id:2143240},{notify:'event',name:'click_cta',id:2143240}]);
  assert.equal(typeof cta[0].id,'number');
});

test('click_cta matches store hosts and paths despite decoration, and ignores non-CTA links',()=>{
  const fires=href=>{const env=run({href});env.listeners.get('click')({target:env.anchor,button:0});return env.window._tfa.some(e=>e.name==='click_cta')};
  for(const href of ['https://hellonancy.com/products/lem','https://hellonancy.com/products/lem?tblci=x#hn_at=abc','https://www.hellonancy.com/en-gb/products/lem','https://get.nancyflow.com/products/lem','https://shop.hellonancy.com/products/lem?x=1'])assert.equal(fires(href),true,href);
  for(const href of ['#details','/unlock/','https://hellonancy.com/policies/privacy-policy','https://hellonancy.com/policies/terms-of-service','mailto:care@hellonancy.com','tel:+441234','https://example.com/products/lem','https://www.nhs.uk/conditions/menopause-and-perimenopause/symptoms/','https://commons.wikimedia.org/wiki/File:Clitoris_Anatomy.svg'])assert.equal(fires(href),false,href);
});

test('unrelated product and external links remain unchanged',()=>{
  for(const href of ['https://example.com/products/lem','https://hellonancy.com/products/other','#details','mailto:care@hellonancy.com']){
    assert.equal(run({search:'?tblci=click',href}).anchor.href,href);
  }
});
