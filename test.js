// Run: node test.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const core = require('./resolver-core');
const original = 'https://www.apps.disneyplus.com/eg/movies/hannah-montana-the-movie/1260018296?utm_source=gwa';
const expected = 'https://www.disneyplus.com/en-gb/browse/entity-b6c11c9e-bda2-4346-a7df-f7e2a75d5e18';
assert.equal(core.parseLegacyUrl(original)?.numericId, '1260018296');
assert.equal(core.parseLegacyUrl('https://apps.disneyplus.com/ae/shows/high-potential/1271342309')?.title, 'high potential');
assert.equal(core.parseLegacyUrl('https://www.apps.disneyplus.com/my/shows/high-potential/1271342309/live/1271439566/watch'), null);
assert.equal(core.parseLegacyUrl('https://www.apps.disneyplus.com/eg/home'), null);
assert.equal(core.parseLegacyUrl('https://attacker.example/eg/movies/hannah-montana-the-movie/1260018296'), null);
assert.equal(core.getTarget(core.EXAMPLE_GUID), expected);
assert.equal(core.readTargetGuid(expected), core.EXAMPLE_GUID);
assert.equal(core.readTargetGuid('https://evil.com/en-gb/browse/entity-'+core.EXAMPLE_GUID),null);
assert.equal(core.matchesSearchResult('Watch Hannah Montana: The Movie | Disney+', 'hannah montana the movie'), true);
assert.equal(core.matchesSearchResult('Watch Hannah Montana | Disney+', 'hannah montana the movie'), false);
assert.equal(core.matchesSearchResult('Watch Cars 2 | Disney+', 'cars'), false);

const listeners = {}, stored = {enabled:true,locale:'en-gb', unknownAction:'search',overrides:{},cached:{}};
const chrome = {
 storage:{ local:{get:async keys=>Object.fromEntries((typeof keys==='string'?[keys]:keys).map(x=>[x,stored[x]])),set:async obj=>Object.assign(stored,obj)},onChanged:{addListener:f=>listeners.onChanged=f}},
 runtime:{onInstalled:{addListener:f=>listeners.onInstalled=f},onMessage:{addListener:f=>listeners.onMessage=f},getURL:s=>'chrome-extension://fake/'+s},
 tabs:{update:async (id,opts)=>{listeners.lastTab={id,...opts}},onRemoved:{addListener:f=>listeners.onRemove=f}},
 webNavigation:{onBeforeNavigate:{addListener:(f,filter)=>{listeners.onBeforeNavigate=f;listeners.filter=filter}}}
};
const rss = `<rss><channel><item><title>Watch Cars | Disney+</title><link>https://www.disneyplus.com/browse/entity-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa</link></item></channel></rss>`;
let wikidataSearchCalls = 0;
const fakeFetch = async url => {
 const u = new URL(url);
 if (u.hostname==='www.wikidata.org') {
   if(u.searchParams.get('action')==='wbsearchentities'){
     wikidataSearchCalls++;
     if(u.searchParams.get('search')==='toy story')return {ok:true,text:async()=>JSON.stringify({search:[{id:'Q171048',label:'Toy Story'}]})};
     return {ok:true,text:async()=>JSON.stringify({search:[]})};
   }
   return {ok:true,text:async()=>JSON.stringify({entities:{Q171048:{labels:{en:{value:'Toy Story'}},claims:{P13902:[{mainsnak:{datavalue:{value:'entity-f6174ebf-cb92-453c-a52b-62bb3576e402'}}}]}}}})};
 }
 if (u.hostname==='www.bing.com') return {ok:true,text:async()=>rss};
 throw new Error('unexpected host');
};
const context = vm.createContext({chrome,URL,URLSearchParams,AbortController, setTimeout,clearTimeout,fetch:fakeFetch,console,importScripts:(name)=>{
  vm.runInContext(fs.readFileSync(path.join(__dirname,name),'utf8'),context);
}});
vm.runInContext(fs.readFileSync(path.join(__dirname,'background.js'),'utf8'),context);
async function test() {
  assert.equal((await vm.runInContext(`resolveLink(${JSON.stringify(original)})`,context)).url,expected);
  assert.equal((await vm.runInContext(`resolveLink('https://www.apps.disneyplus.com/eg/movies/toy-story/1111111111')`,context)).url,
      'https://www.disneyplus.com/en-gb/browse/entity-f6174ebf-cb92-453c-a52b-62bb3576e402');
  assert.equal(stored.cached['1111111111'],'f6174ebf-cb92-453c-a52b-62bb3576e402');
  assert.equal((await vm.runInContext(`resolveLink('https://www.apps.disneyplus.com/eg/movies/cars/2222222222')`,context)).url,
      'https://www.disneyplus.com/en-gb/browse/entity-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  const unknown = await vm.runInContext(`resolveLink('https://www.apps.disneyplus.com/eg/movies/unknown-movie/3333333333')`,context);
  assert.equal(unknown.kind,'search');assert.ok(unknown.url.startsWith('https://www.google.com/search?q='));
  stored.overrides['3333333333']='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const custom = await vm.runInContext(`resolveLink('https://www.apps.disneyplus.com/eg/movies/unknown-movie/3333333333')`,context);
  assert.equal(custom.url,'https://www.disneyplus.com/en-gb/browse/entity-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  listeners.onBeforeNavigate({url: original,frameId:0,tabId:10});
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(listeners.lastTab.id,10);
  assert.ok(listeners.lastTab.url.startsWith('chrome-extension://fake/resolving.html?url='));
  console.log('All redirect, parsing, lookup, ambiguity, manual-mapping, fallback and interception tests passed.');
}
test().catch(e=>{console.error(e);process.exit(1)});
