import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('The standalone classic script starts and completes the questionnaire without imports or network',()=>{
 const html=fs.readFileSync(new URL('../reperes.html',import.meta.url),'utf8');
 assert.doesNotMatch(html,/<script\b[^>]*\bsrc\s*=|<link\b[^>]*rel=["']stylesheet/i);
 assert.doesNotMatch(html,/<script\b[^>]*type=["']module/i);
 const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(x=>x[1]);
 const elements=Object.fromEntries(['main','navigation','toast'].map(id=>[id,{innerHTML:'',style:{},focus(){},querySelector(){return null}}]));
 const handlers={},windowHandlers={},saved=new Map();
 let hash='';
 const location={get hash(){return hash},set hash(value){hash=value.startsWith('#')?value:'#'+value}};
 const bodyClasses=new Set();
 const document={getElementById:id=>elements[id],addEventListener(type,fn){(handlers[type]??=[]).push(fn)},querySelector(){return null},
  createElement:()=>({id:'',innerHTML:'',remove(){delete elements[this.id]}}),
  body:{appendChild(el){elements[el.id]=el},classList:{add:c=>bodyClasses.add(c),remove:c=>bodyClasses.delete(c)}}};
 const context={document,location,innerWidth:1280,scrollTo(){},addEventListener(type,fn){(windowHandlers[type]??=[]).push(fn)},localStorage:{getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value)},setTimeout(){return 0},clearTimeout(){},URL,Blob,confirm(){return true},fetch(){throw new Error('Unexpected network request')}};
 context.window=context;
 vm.createContext(context);
 vm.runInContext(scripts.join('\n'),context,{timeout:3000});
 assert.match(elements.main.innerHTML,/Préparer mon choix/);
 function action(name,value,extra={}){
  const target={disabled:false,dataset:{action:name,value,...extra},closest(){return this}};
  for(const fn of handlers.click??[])fn({target,preventDefault(){}});
  for(const fn of windowHandlers.hashchange??[])fn();
 }
 action('start');
 assert.match(elements.main.innerHTML,/Question 1 sur 72/);
 for(let i=0;i<72;i++){
  action('answer',i===1?'skip':'0');
  action('next');
 }
 assert.equal(location.hash,'#resultats');
 assert.match(elements.main.innerHTML,/72\/72 propositions parcourues/);
 assert.match(elements.main.innerHTML,/71 prises de position/);
 assert.match(elements.main.innerHTML,/18\/18 axes mesurés/);
 assert.equal((elements.main.innerHTML.match(/class="axis-mini"/g)||[]).length,18);
 assert.doesNotMatch(elements.main.innerHTML,/<svg id="radar-svg"/);
 assert.match(elements.main.innerHTML,/Ce que disent vos réponses/);
 assert.equal((elements.main.innerHTML.match(/class="reading-guide"/g)||[]).length,1);
 assert.doesNotMatch(elements.main.innerHTML,/class="notice/);
 assert.match(elements.main.innerHTML,/class="panel map-panel"/);
 const mapTable=elements.main.innerHTML.match(/<details class="compass-table"[\s\S]*?<\/details>/)[0];
 for(const f of JSON.parse(fs.readFileSync(new URL('../research/families.json',import.meta.url))).families)assert.ok(mapTable.includes(`<td>${f.name}`),f.name);
 assert.equal((elements.main.innerHTML.match(/<title>[^<]* · économie /g)||[]).length,7);
 assert.match(elements.main.innerHTML,/<strong>Position intermédiaire<\/strong>/);
 assert.equal(JSON.parse(saved.get('reperes-politique-fr-v1')).answers.q02,'skip');
 action('results-tab',undefined,{tab:'familles'});
 const families=elements.main.innerHTML;
 assert.match(families,/class="proximity-chart"/);
 assert.equal((families.match(/<details class="family-card"/g)||[]).length,10);
 assert.equal((families.match(/<details class="family-card"[^>]*open>/g)||[]).length,3);
 assert.match(families,/écart moyen/);
 assert.equal((families.match(/class="family-sources"/g)||[]).length,10);
 assert.equal((families.match(/class="reading-guide"/g)||[]).length,1);
 assert.doesNotMatch(families,/class="notice/);
 action('results-tab',undefined,{tab:'axes'});
 assert.equal((elements.main.innerHTML.match(/<details class="axis-row"/g)||[]).length,18);
 assert.doesNotMatch(elements.main.innerHTML,/class="axis-ref"/);
 for(const fn of handlers.change??[])fn({target:{id:'compare-family',value:'socialdemocratie'}});
 const catalog=JSON.parse(fs.readFileSync(new URL('../research/families.json',import.meta.url))).families;
 const reference=catalog.find(f=>f.id==='socialdemocratie');
 assert.equal((elements.main.innerHTML.match(/<option value="[a-z]+"/g)||[]).length,catalog.length);
 assert.equal((elements.main.innerHTML.match(/class="axis-ref"/g)||[]).length,Object.keys(reference.positions).length);
 assert.match(elements.main.innerHTML,/Non défini pour Social-démocratie/);
 for(const fn of windowHandlers.beforeprint??[])fn();
 const report=elements['print-report'].innerHTML;
 assert.ok(bodyClasses.has('print-report-on'));
 for(const heading of ['Votre bilan avant de trancher','Comment lire ce bilan','Ce que disent vos réponses','Deux dimensions de lecture','Vos 18 positions, axe par axe','Vos proximités avec les familles d’idées'])assert.ok(report.includes(heading),heading);
 assert.equal((report.match(/<div class="axis-row">/g)||[]).length,18);
 assert.equal((report.match(/class="family-card report-family"/g)||[]).length,3);
 assert.doesNotMatch(report,/class="axis-ref"/);
 assert.ok(report.includes(`Repères des familles ${JSON.parse(fs.readFileSync(new URL('../research/families.json',import.meta.url))).version}`));
 for(const fn of windowHandlers.afterprint??[])fn();
 assert.equal(elements['print-report'],undefined);
 assert.ok(!bodyClasses.has('print-report-on'));
 location.hash='#methode';
 for(const fn of windowHandlers.hashchange??[])fn();
 const method=elements.main.innerHTML,parties=JSON.parse(fs.readFileSync(new URL('../research/parties.json',import.meta.url))).parties;
 assert.match(method,/id="familles-partis"/);
 assert.equal((method.match(/<table class="party-table">[\s\S]*?<\/table>/g)||[]).join('').match(/<tr><td>/g).length,parties.length);
 assert.match(method,/La France insoumise[\s\S]*?Aucune pour l’instant/);
});
