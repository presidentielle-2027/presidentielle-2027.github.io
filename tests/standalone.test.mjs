import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {METHOD_VERSION} from '../dist/engine.mjs';

const read=path=>JSON.parse(fs.readFileSync(new URL(path,import.meta.url)));
const familyCatalog=read('../research/families.json');
const familyList=familyCatalog.families;
const questions=read('../research/questionnaire.json').axes.flatMap(a=>a.questions);

// Runs the assembled standalone page in a simulated browser; `session` pre-fills the local storage.
function boot(session){
 const html=fs.readFileSync(new URL('../reperes.html',import.meta.url),'utf8');
 assert.doesNotMatch(html,/<script\b[^>]*\bsrc\s*=|<link\b[^>]*rel=["']stylesheet/i);
 assert.doesNotMatch(html,/<script\b[^>]*type=["']module/i);
 const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(x=>x[1]);
 const elements=Object.fromEntries(['main','navigation','toast'].map(id=>[id,{innerHTML:'',style:{},focus(){},querySelector(){return null}}]));
 const handlers={},windowHandlers={},saved=new Map(session?[['reperes-politique-fr-v1',JSON.stringify(session)]]:[]);
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
 const fire=(list,event)=>{for(const fn of list??[])fn(event);};
 return {
  elements,handlers,windowHandlers,saved,location,bodyClasses,fire,
  html:()=>elements.main.innerHTML,
  action(name,value,extra={}){
   const target={disabled:false,dataset:{action:name,value,...extra},closest(){return this}};
   fire(handlers.click,{target,preventDefault(){}});
   fire(windowHandlers.hashchange);
  },
  go(route){location.hash=route;fire(windowHandlers.hashchange);},
 };
}

test('The standalone classic script starts and completes the questionnaire without imports or network',()=>{
 const app=boot();
 const {elements,handlers,windowHandlers,saved,location,bodyClasses,fire,action}=app;
 assert.match(app.html(),/Préparer mon choix/);
 action('start');
 assert.match(app.html(),/Question 1 sur 72/);
 for(let i=0;i<72;i++){
  action('answer',i===1?'skip':'0');
  action('next');
 }
 assert.equal(location.hash,'#resultats');
 assert.match(app.html(),/72\/72 propositions parcourues/);
 assert.match(app.html(),/71 prises de position/);
 assert.match(app.html(),/18\/18 axes mesurés/);
 assert.equal((app.html().match(/class="axis-mini"/g)||[]).length,18);
 assert.doesNotMatch(app.html(),/<svg id="radar-svg"/);
 assert.match(app.html(),/Ce que disent vos réponses/);
 assert.equal((app.html().match(/class="reading-guide"/g)||[]).length,1);
 assert.doesNotMatch(app.html(),/class="notice/);
 assert.match(app.html(),/class="panel map-panel"/);
 const mapTable=app.html().match(/<details class="compass-table"[\s\S]*?<\/details>/)[0];
 for(const f of familyList)assert.ok(mapTable.includes(`<td>${f.name}`),f.name);
 assert.equal((app.html().match(/<title>[^<]* · économie /g)||[]).length,8);
 assert.match(app.html(),/<strong>Position intermédiaire<\/strong>/);
 assert.equal(JSON.parse(saved.get('reperes-politique-fr-v1')).answers.q02,'skip');
 action('results-tab',undefined,{tab:'familles'});
 const families=app.html();
 assert.match(families,/class="proximity-chart"/);
 assert.equal((families.match(/class="pc-hit/g)||[]).length,familyList.length);
 assert.equal((families.match(/<details class="family-card"/g)||[]).length,familyList.length);
 assert.equal((families.match(/<details class="family-card"[^>]*open>/g)||[]).length,3);
 assert.match(families,/écart moyen/);
 assert.equal((families.match(/<strong>Textes de référence<\/strong>/g)||[]).length,familyList.length);
 assert.equal((families.match(/<strong>Textes comparés<\/strong>/g)||[]).length,familyList.filter(f=>f.compared?.length).length);
 assert.equal((families.match(/class="reading-guide"/g)||[]).length,1);
 assert.doesNotMatch(families,/class="notice/);
 action('results-tab',undefined,{tab:'axes'});
 assert.equal((app.html().match(/<details class="axis-row"/g)||[]).length,18);
 assert.doesNotMatch(app.html(),/class="axis-ref"/);
 fire(handlers.change,{target:{id:'compare-family',value:'socialdemocratie'}});
 const reference=familyList.find(f=>f.id==='socialdemocratie');
 assert.equal((app.html().match(/<option value="[a-z]+"/g)||[]).length,familyList.length);
 assert.equal((app.html().match(/class="axis-ref"/g)||[]).length,Object.keys(reference.positions).length);
 assert.match(app.html(),/Non défini pour Social-démocratie/);
 fire(windowHandlers.beforeprint);
 const report=elements['print-report'].innerHTML;
 assert.ok(bodyClasses.has('print-report-on'));
 for(const heading of ['Votre bilan avant de trancher','Comment lire ce bilan','Ce que disent vos réponses','Deux dimensions de lecture','Vos 18 positions, axe par axe','Vos proximités avec les familles d’idées'])assert.ok(report.includes(heading),heading);
 assert.equal((report.match(/<div class="axis-row">/g)||[]).length,18);
 assert.equal((report.match(/class="family-card report-family"/g)||[]).length,3);
 assert.doesNotMatch(report,/class="axis-ref"/);
 assert.ok(report.includes(`Repères des familles ${familyCatalog.version}`));
 fire(windowHandlers.afterprint);
 assert.equal(elements['print-report'],undefined);
 assert.ok(!bodyClasses.has('print-report-on'));
 app.go('#methode');
 const method=app.html(),parties=read('../research/parties.json').parties;
 assert.match(method,/id="familles-partis"/);
 assert.equal((method.match(/<table class="party-table">[\s\S]*?<\/table>/g)||[]).join('').match(/<tr><td>/g).length,parties.length);
 assert.match(method,/La France insoumise[\s\S]*?Texte de référence : Gauche de rupture écologique/);
 assert.match(method,/Reconquête[\s\S]*?Texte comparé : Droite nationale souverainiste/);
});

test('A partial questionnaire still lists every family of the catalog in the proximities',()=>{
 const answers=Object.fromEntries(questions.slice(0,36).map((q,i)=>[q.id,i%2?-1:1]));
 const app=boot({methodVersion:METHOD_VERSION,answers,priorities:{},cursor:36,usePriorities:true});
 app.go('#resultats');
 app.action('results-tab',undefined,{tab:'familles'});
 const families=app.html();
 assert.equal((families.match(/class="pc-hit/g)||[]).length,familyList.length);
 assert.equal((families.match(/<details class="family-card/g)||[]).length,familyList.length);
 assert.ok((families.match(/class="pc-hit uncompared"/g)||[]).length>0);
 assert.match(families,/Non comparée/);
 for(const f of familyList)assert.ok(families.includes(`<h3>${f.name}</h3>`),f.name);
});
