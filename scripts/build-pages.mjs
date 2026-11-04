// Pages statiques lisibles sans JavaScript, pour les moteurs de recherche et les liens partagés : méthode, axes, familles
// d'idées, partis et auteurs, plus le plan du site (sitemap.xml). Leur contenu vient des gabarits de dist/pages.js et des
// fonctions de rendu de dist/app.mjs, exécutés ici dans un navigateur simulé : le texte est celui de l'application.
// Lancé par scripts/build-standalone.py, après l'assemblage de dist/data.js.
import fs from 'node:fs';
import vm from 'node:vm';

const base=new URL('../',import.meta.url);
const read=file=>fs.readFileSync(new URL(file,base),'utf8');
const fail=message=>{console.error(`Pages statiques : ${message}`);process.exit(1);};

// Le code de l'application, sans ses instructions de module, comme dans le fichier autonome, puis les gabarits.
const engine=read('dist/engine.mjs').replace(/^export\s+/gm,'');
const app=read('dist/app.mjs').replace(/^import\s+[^\n]+\s+from\s+['"]\.\/engine\.mjs['"];?\s*\n/m,'');
if(/^\s*(?:import|export)\b/m.test(`${engine}\n${app}`))fail('la structure des modules a changé, adapter scripts/build-pages.mjs.');
const node=()=>({innerHTML:'',textContent:'',style:{},focus(){},querySelector(){return null}});
const elements={main:node(),navigation:node(),toast:node()},edition=node();
const context={
 document:{getElementById:id=>elements[id]??null,querySelector:sel=>sel==='.edition'?edition:null,addEventListener(){},createElement:node,body:{appendChild(){},classList:{add(){},remove(){}}}},
 location:{hash:'',protocol:'https:',origin:'',pathname:'/'},innerWidth:1280,scrollTo(){},addEventListener(){},
 localStorage:{getItem(){return null},setItem(){},removeItem(){}},setTimeout(){return 0},clearTimeout(){},URL,
 fetch(){throw new Error('Unexpected network request');}};
context.window=context;
vm.createContext(context);
vm.runInContext(`"use strict";\n${read('dist/data.js')}\n${engine}\n${app}\n${read('dist/pages.js')}`,context,{filename:'pages.js'});
const R=expression=>vm.runInContext(expression,context);
const [e,areaHead,staticCta,navLinks,pages,sections]=['e','areaHead','staticCta','navLinks','staticPages()','SECTIONS'].map(R);

// En-tête, pied de page, icônes et adresse du site : ceux de l'application.
const shell=read('dist/index.html');
const pick=(pattern,what)=>{const m=shell.match(pattern);if(!m)fail(`${what} introuvable dans dist/index.html.`);return m;};
const SITE=pick(/<link rel="canonical" href="(https:\/\/[^"]+\/)">/,'l’adresse canonique')[1];
const OG_IMAGE=pick(/<meta property="og:image" content="([^"]+)">/,'l’image de partage')[1];
const icons=shell.match(/^ *<link rel="(?:icon|apple-touch-icon)"[^\n]*$/gm)??fail('icônes introuvables dans dist/index.html.');
const header=pick(/<header class="site-header">[\s\S]*?<\/header>/,'l’en-tête')[0];
const footer=pick(/<footer class="site-footer">[\s\S]*?<\/footer>/,'le pied de page')[0];

// Liens de l'application vers les adresses statiques : routes de l'application et pages écrites depuis la racine.
const routes={'#accueil':'','#questionnaire':'#questionnaire','#resultats':'#resultats','#reponses':'#reponses','#methode':'methode/'};
const pageLink=new RegExp(`href="((?:${sections.map(([p])=>p.slice(0,-1)).join('|')})/[^"]*)"`,'g');
function staticize(html,root){
 const out=html.replace(/href="(#[\w-]*)"/g,(m,hash)=>hash in routes?`href="${root}${routes[hash]}"`:m).replace(pageLink,(m,href)=>`href="${root}${href}"`);
 const action=out.match(/data-action="[\w-]+"/);if(action)fail(`commande de l’application restée dans une page statique : ${action[0]}.`);
 return out;
}
const json=value=>JSON.stringify(value).replace(/</g,'\\u003c');
function render({path,section,title,description,body}){
 const root='../'.repeat(path.split('/').filter(Boolean).length),canonical=SITE+path;
 const head=header.replace('href="#accueil"',`href="${root}"`).replace('<nav aria-label="Navigation principale" id="navigation"></nav>',`<nav aria-label="Navigation principale">${navLinks(path)}</nav>`).replace('<span class="edition"></span>',`<span class="edition">${e(edition.textContent)}</span>`);
 const page={'@context':'https://schema.org','@type':'WebPage',name:title,description,url:canonical,inLanguage:'fr',isPartOf:{'@type':'WebSite',name:'Avant l’isoloir',url:SITE}};
 return staticize(`<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#ffffff">
  <title>${e(title)}</title>
  <meta name="description" content="${e(description)}">
  <link rel="canonical" href="${canonical}">
  <meta property="og:type" content="article">
  <meta property="og:locale" content="fr_FR">
  <meta property="og:site_name" content="Avant l’isoloir">
  <meta property="og:title" content="${e(title)}">
  <meta property="og:description" content="${e(description)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${OG_IMAGE}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">${json(page)}</script>
${icons.join('\n')}
  <link rel="stylesheet" href="${root}dist/styles.css">
</head>
<body class="static-page">
  <a class="skip-link" href="#main">Aller au contenu</a>
  ${head}
  <main id="main" tabindex="-1">${areaHead(section,path)}${body}${staticCta()}</main>
  ${footer}
</body>
</html>
`,root);
}
const html=new Map(pages.map(p=>[p.path,render(p)]));

// Chaque lien interne doit viser une page générée (ou l'application) et, s'il porte une ancre, un identifiant de la page visée.
for(const [path,page] of html){
 for(const [,href] of page.matchAll(/<a [^>]*href="([^"]+)"/g)){
  if(/^https?:/.test(href))continue;
  const target=new URL(href,SITE+path);
  const to=target.pathname.slice(1);
  if(to===''){if(target.hash&&!(target.hash in routes))fail(`${path} : route inconnue de l’application, ${href}.`);continue;}
  if(to===path&&target.hash){if(!page.includes(`id="${target.hash.slice(1)}"`))fail(`${path} : ancre sans cible, ${href}.`);continue;}
  if(!html.has(to))fail(`${path} : lien vers une page absente, ${href}.`);
  if(target.hash&&!html.get(to).includes(`id="${target.hash.slice(1)}"`))fail(`${path} : ancre sans cible, ${href}.`);
 }
}

// Plan du site : l'accueil, puis toutes les pages statiques, avec leur fréquence de changement et leur priorité. Une page
// dont le contenu change, ou qui apparaît, est datée de cette génération ; une page identique garde la date du plan
// précédent, pour que la date de mise à jour reste fiable d'une génération à l'autre. Le fichier autonome est écrit après
// cette génération par scripts/build-standalone.py, qui signale par --home-changed que l'accueil change.
const FREQUENCIES=['always','hourly','daily','weekly','monthly','yearly','never'];
const entries=[{path:'',changefreq:'weekly',priority:1},...pages];
for(const {path,changefreq,priority} of entries)if(!FREQUENCIES.includes(changefreq)||!(priority>=0&&priority<=1))fail(`${path||'accueil'} : fréquence ou priorité du plan du site invalide (${changefreq}, ${priority}).`);
const sitemapFile=new URL('sitemap.xml',base);
const previous=new Map(fs.existsSync(sitemapFile)?[...read('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)].map(m=>[m[1],m[2]]):[]);
const changed=new Set([...html].filter(([path,page])=>{const file=new URL(`${path}index.html`,base);return !fs.existsSync(file)||fs.readFileSync(file,'utf8')!==page;}).map(([path])=>path));
if(process.argv.includes('--home-changed'))changed.add('');
// Date et heure de la génération, à l'heure de Paris, au format W3C des plans de site (2026-11-04T14:16:00+01:00).
const clock=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',timeZoneName:'longOffset',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
const now=`${clock.year}-${clock.month}-${clock.day}T${clock.hour}:${clock.minute}:${clock.second}${clock.timeZoneName.replace('GMT','')||'+00:00'}`;
const sitemap=entries.map(({path,changefreq,priority})=>{const loc=SITE+path,lastmod=changed.has(path)?now:previous.get(loc)??now;return `<url>\n<loc>${loc}</loc>\n<lastmod>${lastmod}</lastmod>\n<changefreq>${changefreq}</changefreq>\n<priority>${priority.toFixed(1)}</priority>\n</url>`;});

// Les pages d'une génération précédente qui n'existent plus sont retirées, puis les pages sont écrites.
for(const [path] of sections){
 const dir=new URL(path,base);
 for(const sub of fs.existsSync(dir)?fs.readdirSync(dir,{withFileTypes:true}):[])if(sub.isDirectory()&&!html.has(`${path}${sub.name}/`))fs.rmSync(new URL(`${sub.name}/`,dir),{recursive:true});
}
for(const [path,page] of html){const target=new URL(`${path}index.html`,base);fs.mkdirSync(new URL('./',target),{recursive:true});fs.writeFileSync(target,page);}

fs.writeFileSync(sitemapFile,`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">\n${sitemap.join('\n')}\n</urlset>\n`);
console.log(`Pages statiques prêtes : ${html.size} pages (modifiées : ${[...changed].filter(Boolean).length}) ; sitemap.xml (${entries.length} adresses${changed.has('')?', accueil modifié':''}).`);
