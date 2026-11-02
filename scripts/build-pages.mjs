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

// Les pages d'une génération précédente qui n'existent plus sont retirées, puis les pages sont écrites.
for(const [path] of sections){
 const dir=new URL(path,base);
 for(const sub of fs.existsSync(dir)?fs.readdirSync(dir,{withFileTypes:true}):[])if(sub.isDirectory()&&!html.has(`${path}${sub.name}/`))fs.rmSync(new URL(`${sub.name}/`,dir),{recursive:true});
}
for(const [path,page] of html){const target=new URL(`${path}index.html`,base);fs.mkdirSync(new URL('./',target),{recursive:true});fs.writeFileSync(target,page);}

// Plan du site : l'accueil et toutes les pages statiques.
const paths=['',...html.keys()];
fs.writeFileSync(new URL('sitemap.xml',base),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map(p=>`  <url><loc>${SITE}${p}</loc></url>`).join('\n')}\n</urlset>\n`);
console.log(`Pages statiques prêtes : ${html.size} pages, sitemap.xml (${paths.length} adresses).`);
