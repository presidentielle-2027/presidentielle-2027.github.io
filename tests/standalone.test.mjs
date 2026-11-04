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
 const location={get hash(){return hash},set hash(value){hash=value.startsWith('#')?value:'#'+value},replace(href){this.replaced=href}};
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
 // Les pages de référence sont des pages statiques : le menu « Comprendre » de l'en-tête y mène, l'ancienne adresse #methode y renvoie.
 const menu=elements.navigation.innerHTML.match(/<details class="nav-menu[^"]*">[\s\S]*?<\/details>/)[0];
 for(const path of ['methode/','axes/','familles/','partis/','auteurs/'])assert.ok(menu.includes(`<a href="${path}">`),path);
 app.go('#methode');
 assert.equal(location.replaced,'methode/');
});

test('Every axis presents arguments for both poles and links to its static page',()=>{
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
  // Le volet d'un axe liste chacune de ses propositions avec la réponse donnée et un bouton pour la modifier.
  assert.equal((row.match(/data-action="edit-question"/g)||[]).length,a.questions.length,a.id);
  for(const t of ['Ce que mesure cet axe','Ce sujet pèse dans mon choix','Vos réponses','Arguments en présence'])assert.ok(row.includes(t),`${a.id} : ${t}`);
  assert.ok(row.includes(`href="axes/${a.id}/"`),a.id);
 }
 // Chaque carte de famille de l'onglet Proximités mène à la page de la famille.
 app.action('results-tab',undefined,{tab:'familles'});
 for(const f of familyList)assert.ok(app.html().includes(`href="familles/${f.id}/"`),f.id);
 // L'ancienne adresse de la page Idées mène à la page des auteurs.
 app.go('#references');
 assert.equal(app.location.replaced,'auteurs/');
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
 assert.ok(partial.indexOf('class="about"')>partial.indexOf('class="steps"'));
 // La date de dernière mise à jour suit le fichier VERSION (AAAA.M).
 const [y,m]=VERSION.split('.');
 assert.match(partial,new RegExp(`Dernière mise à jour : ${new Date(+y,+m-1,1).toLocaleDateString('fr-FR',{month:'long',year:'numeric'})}\\.`));
 for(const a of ['export-session','import','reset'])assert.ok(partial.indexOf(`data-action="${a}"`)>partial.indexOf('class="about"'),a);
 assert.match(partial,/data-action="export-session">Exporter mes réponses/);
 // Les nombres des catalogues s'écrivent en chiffres ; ↗ est réservé aux liens externes.
 assert.match(partial,new RegExp(`${familyList.length} familles d’idées`));
 assert.match(partial,new RegExp(`${questions.length/A} propositions par axe`));
 assert.doesNotMatch(partial,/↗/);
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
 assert.ok(meta('og:description').includes(`${A} sujets`));
 assert.match(html,/<link rel="canonical" href="https:\/\/presidentielle-2027\.github\.io\/">/);
 const ld=[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(x=>JSON.parse(x[1]));
 assert.equal(ld.length,1);assert.ok(ld[0].some(x=>x['@type']==='WebApplication'));
 const noscript=html.match(/<noscript><div class="noscript">([\s\S]*?)<\/div><\/noscript>/)[1];
 assert.ok(noscript.includes(`${Q} propositions réparties sur ${A} sujets`));
 for(const a of axisList)assert.ok(noscript.includes(a.name.slice(1)),a.name);
});

test('Static pages present the method, axes, families, parties and authors without JavaScript, and the sitemap lists them all',()=>{
 const page=path=>fs.readFileSync(new URL(`../${path}index.html`,import.meta.url),'utf8');
 const refs=read('../research/references.json'),parties=read('../research/parties.json').parties;
 const site='https://presidentielle-2027.github.io/';
 const byName=familyList.slice().sort((x,y)=>x.name.localeCompare(y.name,'fr',{sensitivity:'base'}));
 const check=(path,html)=>{
  // Une page statique ne charge aucun programme : seules les données structurées (JSON-LD) y figurent.
  assert.equal((html.match(/<script\b/g)||[]).length,1,path);
  assert.doesNotMatch(html,/data-action=/,path);
  assert.ok(html.includes(`<link rel="canonical" href="${site}${path}">`),path);
  const ld=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(ld['@type'],'WebPage');assert.equal(ld.url,site+path);
  // L'en-tête mène à toutes les pages de référence par le menu « Comprendre », marqué comme rubrique courante.
  const menu=html.match(/<details class="nav-menu active">[\s\S]*?<\/details>/)[0];
  assert.equal((menu.match(/<a href=/g)||[]).length,5,path);
  assert.doesNotMatch(html,/class="crumbs"/,path);
  // Les rubriques figurent en onglets, comme les vues du bilan, la rubrique courante marquée ; un seul titre h1 par page.
  assert.equal((html.match(/<nav class="tabs" aria-label="Rubriques">[\s\S]*?<\/nav>/)[0].match(/class="tab active"/g)||[]).length,1,path);
  assert.equal((html.match(/<h1\b/g)||[]).length,1,path);
  for(const [,id] of html.matchAll(/href="#([\w-]*)"/g))assert.ok(html.includes(`id="${id}"`),`${path} #${id}`);
 };
 const method=page('methode/');check('methode/',method);
 assert.ok(method.includes(`Version ${VERSION}, cadre français.`));
 assert.doesNotMatch(method,/class="reading"/);
 assert.doesNotMatch(method,/id="familles-partis"|id="auteurs"/);
 const index=page('axes/');check('axes/',index);
 assert.ok(index.includes(`<span>Les ${A} axes du questionnaire</span></h1>`));
 for(const a of axisList){
  const path=`axes/${a.id}/`,html=page(path);check(path,html);
  assert.ok(index.includes(`href="../${path}"`),a.id);
  assert.ok(html.includes(`<span>${a.name}</span></h1>`),a.id);
  assert.equal((html.match(/class="prop-text"/g)||[]).length,a.questions.length,a.id);
  assert.equal((html.match(/<article class="arg">/g)||[]).length,refs.arguments.filter(x=>x.axis===a.id).length,a.id);
  // Toutes les familles figurent, par ordre alphabétique ; celles qui ne tranchent pas l'axe sont dites non définies.
  const rows=[...html.matchAll(/<a class="axis-mini ref-mini[^"]*" href="..\/..\/familles\/([\w-]+)\/"/g)].map(x=>x[1]);
  assert.deepEqual(rows,byName.map(f=>f.id),a.id);
  assert.equal((html.match(/class="axis-ref"/g)||[]).length,familyList.filter(f=>typeof f.positions[a.id]==='number').length,a.id);
 }
 const families=page('familles/');check('familles/',families);
 assert.ok(families.includes(`<span>Les ${familyList.length} familles d’idées</span></h1>`));
 for(const f of familyList){
  const path=`familles/${f.id}/`,html=page(path);check(path,html);
  assert.ok(families.includes(`href="../${path}"`),f.id);
  assert.ok(html.includes(`<span>${f.name}</span></h1>`),f.id);
  // Une ligne par axe : les axes que la famille ne définit pas restent affichés comme non définis.
  assert.equal((html.match(/<a class="axis-mini ref-mini/g)||[]).length,A,f.id);
  assert.equal((html.match(/class="gap-ref"/g)||[]).length,Object.keys(f.positions).length,f.id);
  assert.equal((html.match(/<a class="axis-mini ref-mini undefined"/g)||[]).length,A-Object.keys(f.positions).length,f.id);
  assert.equal((html.match(/<strong>Textes de référence<\/strong>/g)||[]).length,1,f.id);
 }
 const partiesPage=page('partis/');check('partis/',partiesPage);
 assert.equal((partiesPage.match(/<tr id="parti-[\w-]+"><th scope="row">/g)||[]).length,parties.length);
 assert.match(partiesPage,/La France insoumise[\s\S]*?Texte de référence : <a href="..\/familles\/gauchederupture\/">Gauche de rupture écologique<\/a>/);
 assert.match(partiesPage,/Reconquête[\s\S]*?Texte comparé : <a href="..\/familles\/droitenationale\/">Droite nationale souverainiste<\/a>/);
 const authors=page('auteurs/');check('auteurs/',authors);
 // Partis et auteurs partagent le même tableau.
 assert.equal((partiesPage.match(/<table class="data-table">/g)||[]).length,2);assert.equal((authors.match(/<table class="data-table">/g)||[]).length,1);
 assert.equal((authors.match(/<tr><th scope="row">/g)||[]).length,refs.thinkers.length);
 assert.ok(authors.includes(`<span>Les ${refs.thinkers.length} auteurs cités</span></h1>`));
 const sitemap=fs.readFileSync(new URL('../sitemap.xml',import.meta.url),'utf8');
 assert.deepEqual([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(x=>x[1]),[site,`${site}methode/`,`${site}axes/`,...axisList.map(a=>`${site}axes/${a.id}/`),`${site}familles/`,...byName.map(f=>`${site}familles/${f.id}/`),`${site}partis/`,`${site}auteurs/`]);
 // Chaque adresse porte sa date de mise à jour (format W3C, avec le décalage horaire), sa fréquence et sa priorité.
 assert.ok(sitemap.includes('<urlset xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">'));
 const urls=[...sitemap.matchAll(/<url>\n<loc>([^<]+)<\/loc>\n<lastmod>([^<]+)<\/lastmod>\n<changefreq>([^<]+)<\/changefreq>\n<priority>([^<]+)<\/priority>\n<\/url>/g)];
 assert.equal(urls.length,(sitemap.match(/<url>/g)||[]).length);
 for(const [,loc,lastmod,changefreq,priority] of urls){
  assert.match(lastmod,/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d$/,loc);
  assert.ok(Date.parse(lastmod)<=Date.now(),loc);
  assert.ok(['always','hourly','daily','weekly','monthly','yearly','never'].includes(changefreq),loc);
  assert.match(priority,/^(?:0\.\d|1\.0)$/,loc);
 }
 assert.equal(urls[0][4],'1.0');
 // Les pages statiques chargent la feuille de style de dist/, que les robots doivent pouvoir lire.
 const robots=fs.readFileSync(new URL('../robots.txt',import.meta.url),'utf8');
 assert.match(robots,/^Allow: \/dist\/styles\.css$/m);assert.match(robots,/^Allow: \/dist\/fonts\/$/m);
 // Sans JavaScript, la présentation de l'accueil mène aussi aux pages statiques.
 const home=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 // Les pages sont à la racine : la version modulaire de dist/ y remonte, le fichier autonome y est déjà.
 assert.doesNotMatch(home,/<meta name="site-root"/);
 assert.match(fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8'),/<meta name="site-root" content="\.\.\/">/);
 assert.match(home,/<noscript><div class="noscript">[\s\S]*?<a href="methode\/">[\s\S]*?<a href="axes\/">/);
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

test('The README figure cards show the counts of the catalogs and every card the README links to exists',()=>{
 const card=name=>fs.readFileSync(new URL(`../branding/chiffres/${name}.svg`,import.meta.url),'utf8');
 const thinkers=read('../research/references.json').thinkers.length;
 for(const [name,count] of [['questions',Q],['axes',A],['familles',familyList.length],['auteurs',thinkers]]){
  const svg=card(name);
  assert.match(svg,new RegExp(`<title>${count} `),name);
  assert.match(svg,new RegExp(`font-size="48"[^>]*>${count}</text>`),name);
 }
 const readme=fs.readFileSync(new URL('../README.md',import.meta.url),'utf8');
 const linked=[...readme.matchAll(/\]\((branding\/chiffres\/[\w-]+\.svg)\)/g)].map(x=>x[1]);
 assert.equal(linked.length,4);
 for(const path of linked)assert.ok(fs.existsSync(new URL(`../${path}`,import.meta.url)),path);
});
