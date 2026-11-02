import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {METHOD_VERSION} from '../dist/engine.mjs';

const read=path=>JSON.parse(fs.readFileSync(new URL(path,import.meta.url)));
const familyCatalog=read('../research/families.json');
const familyList=familyCatalog.families;
const axisList=read('../research/questionnaire.json').axes;
const questions=axisList.flatMap(a=>a.questions);
const Q=questions.length,A=axisList.length;
const VERSION=fs.readFileSync(new URL('../VERSION',import.meta.url),'utf8').trim();

// Runs the assembled standalone page in a simulated browser; `session` pre-fills the local storage under `key`.
function boot(session,key='avant-isoloir-v1'){
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.doesNotMatch(html,/<script\b[^>]*\bsrc\s*=|<link\b[^>]*rel=["']stylesheet/i);
 assert.doesNotMatch(html,/<script\b[^>]*type=["']module/i);
 // Les données structurées (JSON-LD) décrivent la page pour les moteurs de recherche ; elles ne s'exécutent pas.
 const scripts=[...html.matchAll(/<script\b(?![^>]*application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/gi)].map(x=>x[1]);
 const elements=Object.fromEntries(['main','navigation','toast'].map(id=>[id,{innerHTML:'',style:{},focus(){},querySelector(){return null}}]));
 const handlers={},windowHandlers={},saved=new Map(session?[[key,JSON.stringify(session)]]:[]);
 let hash='';
 const location={get hash(){return hash},set hash(value){hash=value.startsWith('#')?value:'#'+value}};
 const bodyClasses=new Set();
 const document={getElementById:id=>elements[id],addEventListener(type,fn){(handlers[type]??=[]).push(fn)},querySelector(){return null},
  createElement:()=>({id:'',innerHTML:'',remove(){delete elements[this.id]}}),
  body:{appendChild(el){elements[el.id]=el},classList:{add:c=>bodyClasses.add(c),remove:c=>bodyClasses.delete(c)}}};
 const context={document,location,innerWidth:1280,scrollTo(){},addEventListener(type,fn){(windowHandlers[type]??=[]).push(fn)},localStorage:{getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value),removeItem:key=>saved.delete(key)},setTimeout(){return 0},clearTimeout(){},URL,Blob,confirm(){return true},fetch(){throw new Error('Unexpected network request')}};
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
 assert.match(app.html(),/Commencer le questionnaire/);
 // L'aperçu du bilan montre une famille sans nom par famille du catalogue, sans résultat simulé.
 assert.equal((app.html().match(/class="home-dot"/g)||[]).length,familyList.length);
 assert.match(app.html(),/aucun résultat simulé/);
 action('start');
 assert.match(app.html(),new RegExp(`Question 1 sur ${Q}`));
 for(let i=0;i<Q;i++){
  action('answer',i===1?'skip':'0');
  action('next');
 }
 assert.equal(location.hash,'#resultats');
 assert.match(app.html(),new RegExp(`${Q}/${Q} propositions parcourues`));
 assert.match(app.html(),new RegExp(`${Q-1} prises de position`));
 assert.match(app.html(),new RegExp(`${A}/${A} axes mesurés`));
 assert.equal((app.html().match(/class="axis-mini"/g)||[]).length,A);
 assert.doesNotMatch(app.html(),/<svg id="radar-svg"/);
 // La cible des proximités montre tout le catalogue : familles comparées et non comparées.
 assert.equal((app.html().match(/<g class="orb-fam/g)||[]).length,familyList.length);
 assert.equal((app.html().match(/<div class="orb-row"/g)||[]).length,A);
 assert.match(app.html(),/Ce que disent vos réponses/);
 assert.equal((app.html().match(/class="reading-guide"/g)||[]).length,1);
 assert.doesNotMatch(app.html(),/class="notice/);
 assert.match(app.html(),/class="panel map-panel"/);
 const mapTable=app.html().match(/<details class="compass-table"[\s\S]*?<\/details>/)[0];
 for(const f of familyList)assert.ok(mapTable.includes(`<td>${f.name}`),f.name);
 assert.equal((app.html().match(/<title>[^<]* · économie /g)||[]).length,8);
 assert.match(app.html(),/<strong>Position intermédiaire<\/strong>/);
 assert.equal(JSON.parse(saved.get('avant-isoloir-v1')).answers.q02,'skip');
 action('results-tab',undefined,{tab:'familles'});
 const families=app.html();
 assert.match(families,/class="proximity-chart"/);
 assert.equal((families.match(/class="pc-hit/g)||[]).length,familyList.length);
 assert.equal((families.match(/<details class="family-card"/g)||[]).length,familyList.length);
 assert.equal((families.match(/<details class="family-card"[^>]*open>/g)||[]).length,3);
 assert.match(families,/écart moyen/);
 assert.equal((families.match(/<strong>Textes de référence<\/strong>/g)||[]).length,familyList.length);
 assert.equal((families.match(/<strong>Textes comparés<\/strong>/g)||[]).length,familyList.filter(f=>f.compared?.length).length);
 // Chaque carte replie ses sources et ses repères axe par axe dans deux volets distincts.
 assert.equal((families.match(/<details class="family-sub"/g)||[]).length,familyList.length*2);
 // Les déclarations publiques retenues à titre provisoire sont listées à part des textes de référence.
 assert.equal((families.match(/<strong>Déclarations retenues à titre provisoire<\/strong>/g)||[]).length,familyList.filter(f=>f.sources.some(s=>s.provisional)).length);
 assert.equal((families.match(/class="reading-guide"/g)||[]).length,1);
 assert.doesNotMatch(families,/class="notice/);
 action('results-tab',undefined,{tab:'axes'});
 assert.equal((app.html().match(/<details class="axis-row"/g)||[]).length,A);
 assert.doesNotMatch(app.html(),/class="axis-ref"/);
 fire(handlers.change,{target:{id:'compare-family',value:'socialdemocratie'}});
 const reference=familyList.find(f=>f.id==='socialdemocratie');
 assert.equal((app.html().match(/<option value="[a-z]+"/g)||[]).length,familyList.length);
 assert.equal((app.html().match(/class="axis-ref"/g)||[]).length,Object.keys(reference.positions).length);
 assert.match(app.html(),/Non défini pour Social-démocratie/);
 fire(windowHandlers.beforeprint);
 const report=elements['print-report'].innerHTML;
 assert.ok(bodyClasses.has('print-report-on'));
 for(const heading of ['Votre bilan avant de trancher','Comment lire ce bilan','Ce que disent vos réponses','Deux dimensions de lecture',`Vos ${A} positions, axe par axe`,'Vos proximités avec les familles d’idées'])assert.ok(report.includes(heading),heading);
 assert.equal((report.match(/<div class="axis-row">/g)||[]).length,A);
 assert.equal((report.match(/class="family-card report-family"/g)||[]).length,3);
 // Le bilan imprimé déplie les sources et les repères des familles qu'il présente.
 assert.equal((report.match(/<details class="family-sub" open>/g)||[]).length,6);
 assert.doesNotMatch(report,/class="axis-ref"/);
 assert.ok(report.includes(`Version ${VERSION}`));
 fire(windowHandlers.afterprint);
 assert.equal(elements['print-report'],undefined);
 assert.ok(!bodyClasses.has('print-report-on'));
 app.go('#methode');
 const method=app.html(),parties=read('../research/parties.json').parties;
 assert.match(method,/id="familles-partis"/);
 assert.ok(method.includes(`Version ${VERSION}.`));
 assert.equal((method.match(/<table class="party-table">[\s\S]*?<\/table>/g)||[]).join('').match(/<tr><td>/g).length,parties.length);
 assert.match(method,/La France insoumise[\s\S]*?Texte de référence : Gauche de rupture écologique/);
 assert.match(method,/Reconquête[\s\S]*?Texte comparé : Droite nationale souverainiste/);
});

test('Every axis presents arguments for both poles and the method page lists every cited author',()=>{
 const refs=read('../research/references.json');
 const answers=Object.fromEntries(questions.slice(0,36).map((q,i)=>[q.id,i%2?-1:1]));
 const app=boot({methodVersion:METHOD_VERSION,answers,priorities:{},cursor:36,usePriorities:true});
 assert.doesNotMatch(app.elements.navigation.innerHTML,/Idées/);
 app.go('#resultats');
 app.action('results-tab',undefined,{tab:'axes'});
 const html=app.html();
 assert.equal((html.match(/<section class="arguments"/g)||[]).length,A);
 assert.equal((html.match(/<div class="arg-pole">/g)||[]).length,2*A);
 assert.equal((html.match(/<article class="arg">/g)||[]).length,refs.arguments.length);
 for(const a of axisList){
  const row=html.split(`id="axe-${a.id}"`)[1].split('<details class="axis-row"')[0];
  assert.ok(row.includes(`<p class="arg-pole-name">${a.low}</p>`)&&row.includes(`<p class="arg-pole-name">${a.high}</p>`),a.id);
 }
 // L'ancienne adresse de la page Idées mène à la méthode, qui liste tous les auteurs du catalogue.
 app.go('#references');
 const method=app.html();
 assert.match(method,/id="auteurs"/);
 assert.equal(method.match(/<ul class="author-list">[\s\S]*?<\/ul>/)[0].match(/<li>/g).length,refs.thinkers.length);
 assert.ok(method.includes(`${refs.thinkers.length} auteurs`));
});

test('Answers saved under the former storage key move to the current key on first load',()=>{
 const app=boot({methodVersion:'reperes-fr-2026.2',answers:{q01:2,q02:-1},priorities:{work:3},cursor:2,usePriorities:true},'reperes-politique-fr-v1');
 assert.ok(!app.saved.has('reperes-politique-fr-v1'));
 const moved=JSON.parse(app.saved.get('avant-isoloir-v1'));
 assert.deepEqual(moved.answers,{q01:2,q02:-1});assert.deepEqual(moved.priorities,{work:3});assert.equal(moved.cursor,2);
 assert.equal(moved.methodVersion,METHOD_VERSION);
});

test('The home page leads with the next step of the questionnaire and gathers session management at the bottom',()=>{
 const session=n=>({methodVersion:METHOD_VERSION,answers:Object.fromEntries(questions.slice(0,n).map(q=>[q.id,1])),priorities:{},cursor:Math.min(n,Q-1),usePriorities:true});
 const empty=boot().html();
 assert.match(empty,/data-action="start"/);
 assert.match(empty,/data-action="import"/);
 assert.doesNotMatch(empty,/data-action="(?:resume|export-session|reset)"/);
 const partial=boot(session(10)).html();
 assert.match(partial,/data-action="resume"[^>]*>Reprendre le questionnaire/);
 assert.match(partial,new RegExp(`10 / ${Q} propositions parcourues · ${Q-10} restantes`));
 assert.doesNotMatch(partial,/href="#resultats"/);
 for(const a of ['export-session','import','reset'])assert.ok(partial.indexOf(`data-action="${a}"`)>partial.indexOf('class="notice"'),a);
 assert.match(partial,/data-action="export-session">Exporter mes réponses/);
 assert.match(partial,/data-action="import">Importer mes réponses/);
 const done=boot(session(Q));
 assert.match(done.html(),/href="#resultats">Voir mon bilan/);
 assert.doesNotMatch(done.html(),/data-action="resume"/);
 // Les libellés parlent de réponses : le mot « session » ne reste que dans les identifiants internes.
 for(const page of ['accueil','questionnaire','resultats','methode']){done.go(page);assert.doesNotMatch(done.html(),/>[^<]*\bsession/i,page);}
});

test('The page describes itself for search engines with figures taken from the catalogs',()=>{
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const meta=name=>html.match(new RegExp(`<meta (?:name|property)="${name}" content="([^"]*)"`))?.[1]??'';
 const title=html.match(/<title>([^<]*)<\/title>/)[1];
 for(const text of [title,meta('description'),meta('og:description')])assert.ok(text.includes(`${Q} propositions`),text);
 for(const text of [meta('description'),meta('og:description')])assert.ok(text.includes(`${familyList.length} familles`),text);
 assert.ok(meta('og:description').includes(`${A} thèmes`));
 assert.match(html,/<link rel="canonical" href="https:\/\/presidentielle-2027\.github\.io\/">/);
 const ld=[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(x=>JSON.parse(x[1]));
 assert.equal(ld.length,1);assert.ok(ld[0].some(x=>x['@type']==='WebApplication'));
 const noscript=html.match(/<noscript><div class="noscript">([\s\S]*?)<\/div><\/noscript>/)[1];
 assert.ok(noscript.includes(`${Q} propositions réparties sur ${A} thèmes`));
 for(const a of axisList)assert.ok(noscript.includes(a.name.slice(1)),a.name);
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
