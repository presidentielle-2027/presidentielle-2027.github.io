import {METHOD_VERSION,MIN_COMMON_AXES,MIN_SYNTHESIS_AXES,READING,isAnswer,computeProfile,compareFamilies,globalCoordinates,familyCoordinates,coordinateReading,interpretation,axisReading,proximity,familyContrast,findings,sanitizeSession,mean} from './engine.mjs';

const D=window.ISOLOIR_DATA;
const root=document.getElementById('main');
if(!D){root.innerHTML='<p class="notice error">Les données du questionnaire ne sont pas disponibles. Actualisez la page.</p>';throw new Error('Questionnaire data missing');}
const axes=D.axes, questions=axes.flatMap(a=>a.questions), byAxis=Object.fromEntries(axes.map(a=>[a.id,a]));
const groups=Object.fromEntries(D.themes.map(t=>[t.id,t]));
const partyById=Object.fromEntries(D.parties.parties.map(p=>[p.id,p]));
// Nombres affichés, calculés à partir des catalogues.
const familyCount=D.families.length,AXES_N=axes.length,QUESTIONS_N=questions.length,PER_AXIS=axes[0].questions.length;
// Mois de la dernière mise à jour, tiré de la version de la distribution (fichier VERSION, AAAA.M) ; l'en-tête l'affiche aussi.
const [,VY,VM]=/^(\d{4})\.(\d{1,2})/.exec(D.version),VDATE=new Date(+VY,+VM-1,1),UPDATED=VDATE.toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
const editionTag=document.querySelector('.edition');if(editionTag)editionTag.textContent=`Éd. ${VDATE.toLocaleDateString('fr-FR',{month:'short'})} ${VY}`.toLocaleUpperCase('fr');
const choices=[{value:2,label:'Tout à fait favorable'},{value:1,label:'Plutôt favorable'},{value:0,label:'Ni favorable ni opposé'},{value:-1,label:'Plutôt opposé'},{value:-2,label:'Tout à fait opposé'},{value:'skip',label:'Je ne sais pas / je ne peux pas trancher'}];
const DEGREES=choices.filter(c=>typeof c.value==='number').length;
const KEY='avant-isoloir-v1';
// Anciennes clés : les réponses qui y sont enregistrées passent sous la clé actuelle au premier chargement.
const LEGACY_KEYS=['reperes-politique-fr-v1'];
// Couleurs des graphiques SVG, alignées sur styles.css : le violet est réservé aux positions de l’utilisateur.
const C={grid:'#d5d9df',ref:'#8b9096',user:'#6247e8',ink:'#141414',muted:'#5c6066',surface:'#f3f5f7',card:'#ffffff'};
const fresh=()=>({methodVersion:METHOD_VERSION,answers:{},priorities:{},cursor:0,usePriorities:true});
let state=fresh(),storageOK=true,resultsTab='panorama',openAxes=new Set(),compareFamily='',usePriorities=true,toastTimer;
try{let raw=localStorage.getItem(KEY);const legacy=raw?null:LEGACY_KEYS.find(k=>localStorage.getItem(k)!==null);if(legacy)raw=localStorage.getItem(legacy);if(raw)state=sanitizeSession(JSON.parse(raw),axes);if(legacy){localStorage.setItem(KEY,JSON.stringify(state));localStorage.removeItem(legacy);}}catch{storageOK=false;}
usePriorities=state.usePriorities!==false;
const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const url=s=>/^https?:\/\//.test(s)?e(s):'#';
const fmt=n=>typeof n==='number'?n.toLocaleString('fr-FR',{maximumFractionDigits:1}):'—';
const lcFirst=s=>s?s[0].toLocaleLowerCase('fr')+s.slice(1):s;
const listFr=xs=>xs.length<2?xs.join(''):`${xs.slice(0,-1).join(', ')} et ${xs[xs.length-1]}`;
const points=n=>`${fmt(n)} point${Math.abs(n)>=2?'s':''}`;
const fmtExact=n=>n.toLocaleString('fr-FR');
const dateFr=d=>`${d.getDate()===1?'1er':d.getDate()} ${d.toLocaleDateString('fr-FR',{month:'long',year:'numeric'})}`;
const completed=()=>questions.filter(q=>isAnswer(state.answers[q.id])).length;
const valid=()=>questions.filter(q=>typeof state.answers[q.id]==='number').length;
// L'ancienne page « Idées » (#references) mène désormais à la méthode, qui liste les auteurs cités.
const route=()=>{const h=location.hash.slice(1);return h==='references'?'methode':['questionnaire','resultats','methode','reponses'].includes(h)?h:'accueil';};
function persist(){try{localStorage.setItem(KEY,JSON.stringify(state));storageOK=true;}catch{storageOK=false;}}
function toast(s){const el=document.getElementById('toast');el.textContent=s;el.style.display='block';clearTimeout(toastTimer);toastTimer=setTimeout(()=>{el.style.display='none'},4000);}
function go(view){if(location.hash==='#'+view)render();else location.hash=view;}
function focusMain(){root.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
function nav(){document.getElementById('navigation').innerHTML=[['questionnaire','Propositions','nav-quiz'],['resultats','Bilan',''],['methode','Méthode','']].map(([id,label,cl])=>`<a class="${cl} ${route()===id?'active':''}" ${route()===id?'aria-current="page"':''} href="#${id}">${label}</a>`).join('');}
function warning(){return storageOK?'':'<p class="storage-warning" role="status">La sauvegarde dans ce navigateur est indisponible. Exportez vos réponses pour les conserver.</p>';}
// Aperçu du bilan sur la page d'accueil, sans aucun résultat simulé : une mini-cible où les familles, sans nom, dérivent
// entre les cercles sans jamais se fixer, et ce que le bilan apporte. Les nombres viennent des catalogues.
function homeGraphic(){
 const n=D.families.length,cx=130,cy=108,R=92,r0=14,rad=d=>r0+(R-r0)*Math.min(Math.max(d,0),4)/4;
 const rings=[1,2,3,4].map(d=>`<circle class="home-ring${d===4?' outer':''}" cx="${cx}" cy="${cy}" r="${rad(d)}"/>`).join('');
 const dots=D.families.map((_,k)=>{
  const a=-Math.PI/2+k*2*Math.PI/n,base=.9+((k*37)%26)/10,p=r=>`${(r*Math.cos(a)).toFixed(1)}px,${(r*Math.sin(a)).toFixed(1)}px`;
  const [x1,y1]=p(rad(base-.7)).split(','),[x2,y2]=p(rad(base+.7)).split(',');
  return `<line class="home-spoke" x1="0" y1="0" x2="${(R*Math.cos(a)).toFixed(1)}" y2="${(R*Math.sin(a)).toFixed(1)}"/><circle class="home-dot" r="5" style="--x1:${x1};--y1:${y1};--x2:${x2};--y2:${y2};--d:${(4.5+((k*13)%30)/10).toFixed(1)}s;--delay:-${(k*.7).toFixed(1)}s"/>`;
 }).join('');
 const glyph={
  axes:'<svg viewBox="0 0 28 20" aria-hidden="true"><line class="g-track" x1="3" y1="10" x2="25" y2="10"/><line class="g-mid" x1="14" y1="5" x2="14" y2="15"/><circle class="g-you" cx="19" cy="10" r="4"/></svg>',
  families:'<svg viewBox="0 0 28 20" aria-hidden="true"><circle class="g-ring" cx="14" cy="10" r="8.5"/><circle class="g-ring" cx="14" cy="10" r="4.5"/><circle class="g-family" cx="21" cy="5.5" r="2.2"/><circle class="g-family" cx="8.5" cy="14.5" r="2.2"/><circle class="g-you" cx="14" cy="10" r="2.6"/></svg>',
  gaps:'<svg viewBox="0 0 28 20" aria-hidden="true"><line class="g-track" x1="3" y1="10" x2="25" y2="10"/><line class="g-gap" x1="8" y1="10" x2="20" y2="10"/><rect class="g-ref" x="5" y="7" width="6" height="6" transform="rotate(45 8 10)"/><circle class="g-you" cx="20" cy="10" r="4"/></svg>'};
 const gets=[[glyph.axes,`Vos ${AXES_N} positions, axe par axe`,'Chaque axe tracé entre ses deux pôles, réponses contrastées signalées.'],
  [glyph.families,`Votre écart avec ${familyCount} familles d’idées`,'Chacune placée à sa distance de vous, de la plus proche à la plus éloignée.'],
  [glyph.gaps,'Accords et écarts expliqués','Repère par repère, avec les textes qui les justifient.']];
 return `<div class="home-preview"><div class="home-orbit"><svg viewBox="0 0 260 216" role="img" aria-label="Illustration : vous au centre, ${familyCount} familles d’idées sans nom placées autour à des distances qui varient. Aucun résultat simulé."><circle class="home-zone" cx="${cx}" cy="${cy}" r="${rad(1)}"/>${rings}<g transform="translate(${cx} ${cy})">${dots}</g><circle class="home-you" cx="${cx}" cy="${cy}" r="7"/><text class="home-you-label" x="${cx}" y="${cy+22}" text-anchor="middle">Vous</text></svg></div><ul class="home-gets">${gets.map(([g,title,sub])=>`<li><span class="home-glyph">${g}</span><span><strong>${title}</strong><span class="sub">${sub}</span></span></li>`).join('')}</ul></div>`;
}
// Pictogrammes au trait des sections de l'accueil ; ils prennent la couleur du texte qui les entoure.
const icon=d=>`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${d}</svg>`;
const ICONS={
 axes:'<path d="M3 6h18M3 12h18M3 18h18"/><circle class="i-fill" cx="8" cy="6" r="2.4"/><circle class="i-fill" cx="16" cy="12" r="2.4"/><circle class="i-fill" cx="11" cy="18" r="2.4"/>',
 propositions:'<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4"/>',
 authors:'<path d="M12 6.5C10 5 7 4.6 3.5 5v13c3.5-.4 6.5.1 8.5 1.5 2-1.4 5-1.9 8.5-1.5V5C17 4.6 14 5 12 6.5z"/><path d="M12 6.5v13"/>',
 device:'<rect x="3" y="4" width="18" height="12.5" rx="1.5"/><path d="M8 20.5h8M12 16.5v4"/><rect x="9.5" y="9.6" width="5" height="3.8" rx=".6"/><path d="M10.6 9.6V8.4a1.4 1.4 0 0 1 2.8 0v1.2"/>',
 ballot:'<path d="M8 11V3.5h8V11"/><path d="M10.5 6.5h3"/><rect x="3.5" y="11" width="17" height="9.5" rx="1"/><path d="M7 14.5h10"/>',
 calendar:'<rect x="3.5" y="5" width="17" height="15.5" rx="1.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4M7.5 13h2M11 13h2M14.5 13h2M7.5 16.5h2M11 16.5h2"/>',
 compass:'<circle cx="12" cy="12" r="8.5"/><path d="M14.8 9.2l-1.6 4-4 1.6 1.6-4z"/>',
 chip:'<rect x="7" y="7" width="10" height="10" rx="1.2"/><path d="M10 3.5V7M14 3.5V7M10 17v3.5M14 17v3.5M3.5 10H7M3.5 14H7M17 10h3.5M17 14h3.5"/>'};
const ico=name=>`<span class="ico">${icon(ICONS[name])}</span>`;
// Le parcours en chiffres, tirés des catalogues.
function homeFacts(){
 const facts=[['axes',AXES_N,'axes mesurés séparément'],['propositions',QUESTIONS_N,'propositions, sans bonne réponse'],['authors',D.references.thinkers.length,'auteurs cités, aux deux pôles des axes'],['device','100 %','des calculs dans votre navigateur']];
 return `<section class="fact-strip" aria-label="Le parcours en chiffres">${facts.map(([i,v,t])=>`<div class="fact">${ico(i)}<strong>${v}</strong><span class="fact-label">${t}</span></div>`).join('')}</section>`;
}
// Les trois étapes, chacune illustrée par une version simplifiée de l'écran correspondant : réponse choisie, importance d'un sujet, écart sur un axe.
// Le violet marque les choix et les positions de l'utilisateur, l'encre le repère d'une famille.
function homeSteps(){
 const choice=[0,1,2,3,4].map(i=>`<circle class="art-choice${i===1?' on':''}" cx="${38+i*30}" cy="76" r="10"/>`).join('');
 const answer=`<rect class="art-text" x="30" y="20" width="160" height="8" rx="4"/><rect class="art-text" x="30" y="35" width="112" height="8" rx="4"/>${choice}<line class="art-sep" x1="183" y1="62" x2="183" y2="90"/><circle class="art-skip" cx="208" cy="76" r="10"/><text class="art-q" x="208" y="80.5" text-anchor="middle">?</text>`;
 const weight=[[26,3],[55,1],[84,2]].map(([y,on])=>`<rect class="art-text" x="24" y="${y-4}" width="${on===1?58:72}" height="8" rx="4"/><rect class="art-pill" x="108" y="${y-10}" width="108" height="20" rx="4"/><rect class="art-seg" x="${108+(on-1)*36+2}" y="${y-8}" width="32" height="16" rx="3"/><line class="art-div" x1="144" y1="${y-6}" x2="144" y2="${y+6}"/><line class="art-div" x1="180" y1="${y-6}" x2="180" y2="${y+6}"/>${[1,2,3].map(k=>Array.from({length:k},(_,j)=>`<circle class="art-dot${k===on?' on':''}" cx="${108+(k-1)*36+18+(j-(k-1)/2)*7}" cy="${y}" r="2.2"/>`).join('')).join('')}`).join('');
 const gap=[[38,70,150],[76,180,156]].map(([y,ref,you])=>`<line class="art-track" x1="26" y1="${y}" x2="214" y2="${y}"/><line class="art-mid" x1="120" y1="${y-8}" x2="120" y2="${y+8}"/><line class="art-gap" x1="${ref}" y1="${y}" x2="${you}" y2="${y}"/><rect class="art-ref" x="${ref-4.5}" y="${y-4.5}" width="9" height="9" transform="rotate(45 ${ref} ${y})"/><circle class="art-you" cx="${you}" cy="${y}" r="6.5"/>`).join('');
 const steps=[['Prenez position',`${PER_AXIS} propositions par axe et ${DEGREES} degrés d’accord. « Je ne sais pas » reste une réponse à part.`,answer],['Pesez ce qui compte','Chaque axe peut être secondaire, important ou déterminant. Ce poids modifie vos proximités, jamais vos positions.',weight],['Mesurez les écarts',`Situez-vous sur ${AXES_N} axes, comparez votre profil à ${familyCount} familles d’idées et lisez, sous chaque axe, les arguments des deux pôles.`,gap]];
 return `<div class="section-intro stacked"><h2>Le parcours en trois étapes</h2><p>Vous pouvez interrompre le questionnaire et le reprendre plus tard.</p></div><ol class="steps">${steps.map(([t,p,art],k)=>`<li class="step"><div class="step-art" aria-hidden="true"><svg viewBox="0 0 240 110">${art}</svg></div><div class="step-body"><span class="step-number">${String(k+1).padStart(2,'0')}</span><h3>${t}</h3><p>${p}</p></div></li>`).join('')}</ol>`;
}
// Avertissement d'indépendance, une phrase par repère, suivi du lien vers la méthode.
function homeAbout(){
 const items=[['ballot','Ce site indépendant, sans lien avec les pouvoirs publics ni avec les partis, aide à préparer un choix pour l’élection présidentielle de 2027 et ne donne aucune consigne de vote.'],['calendar',`Les repères des familles d’idées et la liste des partis sont mis à jour à mesure que les candidatures et les programmes de 2027 sont connus. Dernière mise à jour : ${UPDATED}.`],['compass','Les scores et les familles sont des repères éditoriaux, sans validation psychométrique ; un écart décrit une proximité d’idées, pas une probabilité de vote.'],['chip','L’outil a été élaboré avec l’aide d’une intelligence artificielle, mais aucune IA ne reçoit vos réponses ni ne calcule votre bilan.']];
 return `<section class="about" aria-labelledby="apropos-titre"><div class="about-head"><h2 id="apropos-titre">Ce qu’il faut savoir</h2><a class="btn" href="#methode">La méthode, les auteurs et les sources →</a></div><ul class="about-list">${items.map(([i,t])=>`<li>${ico(i)}<p>${t}</p></li>`).join('')}</ul></section>`;
}
// Actions du parcours en tête de l'accueil : commencer, reprendre, ou ouvrir le bilan une fois toutes les propositions parcourues.
function homeStart(n){
 const method='<a class="btn subtle" href="#methode">Comprendre la méthode →</a>';
 if(!n)return `<div class="actions"><button class="btn primary" data-action="start">Commencer le questionnaire <span aria-hidden="true">→</span></button>${method}</div><p class="hero-note">${QUESTIONS_N} propositions · Environ 20 minutes · Méthode publique</p>`;
 if(n===QUESTIONS_N)return `<div class="hero-progress"><p class="hero-note">Parcours terminé · ${QUESTIONS_N} / ${QUESTIONS_N} propositions</p></div><div class="actions"><a class="btn primary" href="#resultats">Voir mon bilan <span aria-hidden="true">→</span></a>${method}</div>`;
 const left=QUESTIONS_N-n;
 return `<div class="hero-progress"><p class="hero-note">${n} / ${QUESTIONS_N} propositions parcourues · ${left} restante${left>1?'s':''}</p><div class="progress-track" role="progressbar" aria-label="Questionnaire parcouru" aria-valuenow="${n}" aria-valuemin="0" aria-valuemax="${QUESTIONS_N}"><div class="progress-fill" style="width:${n/QUESTIONS_N*100}%"></div></div></div><div class="actions"><button class="btn primary" data-action="resume">Reprendre le questionnaire <span aria-hidden="true">→</span></button>${method}</div>`;
}
// Gestion des réponses enregistrées en bas de l'accueil : importer, exporter, effacer. Sans sauvegarde locale, l'exportation devient l'action principale.
function sessionPanel(n){
 const text=!storageOK?warning():n?`<p>${n} réponse${n>1?'s':''} et vos priorités sont conservées dans ce navigateur, nulle part ailleurs. Exportez-les pour les garder ou les ouvrir sur un autre appareil.</p>`:'<p>Aucune réponse enregistrée dans ce navigateur. Si vous avez exporté vos réponses sur un autre appareil, importez ce fichier pour reprendre où vous en étiez.</p>';
 const buttons=n?`<button class="btn${storageOK?'':' primary'}" data-action="export-session">Exporter mes réponses ↓</button><button class="btn" data-action="import">Importer mes réponses</button><button class="btn danger session-reset" data-action="reset">Effacer mes réponses</button>`:'<button class="btn" data-action="import">Importer mes réponses</button>';
 return `<section class="session-panel" aria-labelledby="session-titre">${ico('device')}<div class="session-body"><h2 id="session-titre">Vos réponses dans ce navigateur</h2>${text}<div class="actions">${buttons}</div>${n?'<p class="session-hint">L’import remplace les réponses présentes, après confirmation.</p>':''}</div></section>`;
}
function home(){const n=completed();return `
 <section class="hero"><div><h1><span class="election-tag">Élection présidentielle 2027</span> Faites le point<br><em>sur vos convictions.</em></h1><p class="lead">Répondez à ${QUESTIONS_N} propositions, lisez les arguments de chaque côté, puis voyez de quelles familles d’idées vous êtes le plus proche.</p>${homeStart(n)}</div><div class="hero-graphic"><div class="mini-label"><span>Ce que montre le bilan</span><span>Aperçu</span></div>${homeGraphic()}<p class="graphic-note">Illustration · aucun résultat simulé</p></div></section>
 ${homeFacts()}
 ${homeSteps()}
 ${homeAbout()}
 ${sessionPanel(n)}`;}
function priorityControls(id){return `<div class="priority-controls" role="group" aria-label="Importance de l’axe ${e(byAxis[id].name)}">${[[1,'Secondaire'],[2,'Important'],[3,'Déterminant']].map(([v,t])=>`<button type="button" class="${(state.priorities[id]??2)===v?'active':''}" aria-pressed="${(state.priorities[id]??2)===v}" data-action="priority" data-axis="${id}" data-value="${v}">${t}</button>`).join('')}</div>`;}
function questionnaire(){const q=questions[state.cursor],a=byAxis[q.axis],n=completed(),local=a.questions.indexOf(q);const sidebar=Object.entries(groups).map(([id,g])=>`<p class="group-name">${g.number} · ${g.name}</p>${axes.filter(a=>a.group===id).map(ax=>{const c=ax.questions.filter(x=>isAnswer(state.answers[x.id])).length;return `<button class="axis-jump ${ax.id===a.id?'current':''} ${c===4?'complete':''}" data-action="jump" data-axis="${ax.id}" ${ax.id===a.id?'aria-current="step"':''}><span class="dot"></span><span>${e(ax.shortName)}</span><span class="count">${c}/4</span></button>`}).join('')}`).join('');return `
 <div class="mobile-progress"><div class="caption"><span>Votre parcours</span><span>${n} / ${QUESTIONS_N} réponses</span></div><div class="progress-track"><div class="progress-fill" style="width:${n/QUESTIONS_N*100}%"></div></div></div>
 <div class="question-layout"><aside class="quiz-sidebar" aria-label="Avancement du questionnaire"><div class="progress-number">${n} <span>/ ${QUESTIONS_N}</span></div><p class="progress-caption">propositions parcourues</p><div class="progress-track" role="progressbar" aria-label="Questionnaire parcouru" aria-valuenow="${n}" aria-valuemin="0" aria-valuemax="${QUESTIONS_N}"><div class="progress-fill" style="width:${n/QUESTIONS_N*100}%"></div></div>${sidebar}<button class="btn subtle" data-action="export-session">Exporter mes réponses ↓</button></aside>
 <section><div class="quiz-meta"><span>${e(groups[a.group].name)} / ${e(a.shortName)}</span><span>Question ${state.cursor+1} sur ${QUESTIONS_N}</span></div>
 <div class="question-card"><div class="eyebrow">${e(a.name)}</div><h1 id="question-title">${e(q.text)}</h1><p class="question-context">${e(q.context)}</p><div class="answers" role="group" aria-labelledby="question-title">${choices.map((c,i)=>`<button type="button" class="answer ${c.value==='skip'?'skip':''} ${state.answers[q.id]===c.value?'selected':''}" aria-pressed="${state.answers[q.id]===c.value}" data-action="answer" data-value="${c.value}"><span class="radio" aria-hidden="true"></span>${e(c.label)}<span class="key" aria-hidden="true">${i+1}</span></button>`).join('')}</div><div class="priority"><span>Ce sujet pèse dans mon choix :</span>${priorityControls(a.id)}</div></div>
 <div class="question-nav"><button class="btn" data-action="prev" ${state.cursor===0?'disabled':''}>← Précédent</button><button class="btn primary" data-action="next" ${!isAnswer(state.answers[q.id])?'disabled':''}>${state.cursor===QUESTIONS_N-1?'Voir mon bilan':'Suivant'} →</button></div><div class="quiz-meta" style="margin-top:20px"><span class="keyboard-hint">Clavier : 1 à 6 pour répondre · Entrée pour continuer</span><span class="axis-progress" aria-label="Proposition ${local+1} sur 4 dans cet axe">${a.questions.map((x,i)=>`<i class="${isAnswer(state.answers[x.id])?'filled':''} ${i===local?'current':''}"></i>`).join('')}</span></div>${warning()}</section></div>`;}
// Place une étiquette autour d'un point sans chevaucher les boîtes déjà posées ni sortir du cadre ; la meilleure position est retenue.
// Les positions d'une ligne plus haut ou plus bas départagent les points voisins ; masquer un point coûte plus cher que chevaucher une étiquette.
function placeLabel(p,text,size,boxes,frame){
 const w=text.length*size*.56+2,line=size*1.2;let best;
 for(const [dx,dy] of [[1,0],[-1,0],[0,-1],[0,1],[1,-1],[1,1],[-1,-1],[-1,1],[1,-2],[1,2],[0,-2],[0,2]]){
  const anchor=dx>0?'start':dx<0?'end':'middle',x=p.x+dx*(p.r+4),y=dy===0?p.y+size*.35:dy<0?p.y-p.r-4-(-dy-1)*line:p.y+p.r+4+size*.75+(dy-1)*line;
  const left=anchor==='start'?x:anchor==='end'?x-w:x-w/2,box={x1:left,y1:y-size*.8,x2:left+w,y2:y+size*.25};
  const overlap=boxes.reduce((t,b)=>t+(b.weight??1)*Math.max(0,Math.min(box.x2,b.x2)-Math.max(box.x1,b.x1))*Math.max(0,Math.min(box.y2,b.y2)-Math.max(box.y1,b.y1)),0);
  const score=overlap+(box.x1<frame.x1||box.x2>frame.x2||box.y1<frame.y1||box.y2>frame.y2?1e5:0);
  if(!best||score<best.score)best={score,x,y,anchor,box};
  if(!score)break;
 }
 boxes.push({...best.box,weight:4});return best;
}
// Carte à deux dimensions : votre point et les familles dont les repères définissent les deux coordonnées.
// En largeur réduite, les familles portent un numéro repris dans le tableau des coordonnées.
function compass(profile,ranked,compact=window.innerWidth<620){
 const c=globalCoordinates(profile),size=compact?12:10.5;
 const W=compact?320:560,x0=16,x1=W-16,y0=34,y1=compact?264:326,H=y1+50,frame={x1:x0,y1:y0,x2:x1,y2:y1};
 const X=v=>x0+v/10*(x1-x0),Y=v=>y0+v/10*(y1-y0),mid=(x0+x1)/2;
 const all=familyList(ranked).map((f,i)=>({f,n:i+1,c:familyCoordinates(f)})),isPlaced=x=>x.c.economic!==null&&x.c.cultural!==null;
 const placed=all.filter(isPlaced).map(x=>({...x,x:X(x.c.economic),y:Y(x.c.cultural),r:compact?9:4.5}));
 // Deux familles presque confondues sont écartées juste assez pour que chaque point reste visible ; le tableau garde les valeurs exactes.
 let nudged=false;
 placed.forEach((b,i)=>placed.slice(0,i).forEach(a=>{const dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy),min=a.r+b.r+2;if(dist<min){b.x=a.x+(dist?dx/dist:0)*min;b.y=a.y+(dist?dy/dist:1)*min;nudged=true;}}));
 const missing=all.filter(x=>!isPlaced(x)).map(x=>e(x.f.name));
 const you=c.economic!==null&&c.cultural!==null?{x:X(c.economic),y:Y(c.cultural),r:7}:null;
 const boxes=[...placed,...(you?[you]:[])].map(q=>({x1:q.x-q.r-2,y1:q.y-q.r-2,x2:q.x+q.r+2,y2:q.y+q.r+2,weight:20}));
 const halo=`stroke="${C.surface}" stroke-width="3" paint-order="stroke"`;
 const youMark=you?(()=>{const l=placeLabel(you,'Vous',size+1,boxes,frame);return `<circle cx="${you.x}" cy="${you.y}" r="7" fill="${C.user}" stroke="${C.card}" stroke-width="3"/><text x="${l.x}" y="${l.y}" text-anchor="${l.anchor}" fill="${C.ink}" font-size="${size+1}" font-weight="600" ${halo}>Vous</text>`;})():`<text x="${mid}" y="${(y0+y1)/2}" text-anchor="middle" fill="${C.muted}" font-size="12">Votre point apparaîtra avec 2 axes renseignés sur 3</text>`;
 const marks=placed.map(q=>{const tip=`${e(q.f.name)} · économie ${fmt(q.c.economic)} · valeurs culturelles ${fmt(q.c.cultural)}`;if(compact)return `<g><title>${tip}</title><circle cx="${q.x}" cy="${q.y}" r="${q.r}" fill="${C.muted}" stroke="${C.card}" stroke-width="2"/><text x="${q.x}" y="${q.y+4}" text-anchor="middle" fill="${C.card}" font-size="11" font-weight="600">${q.n}</text></g>`;const l=placeLabel(q,q.f.name,size,boxes,frame);return `<g><title>${tip}</title><circle cx="${q.x}" cy="${q.y}" r="${q.r}" fill="${C.muted}" stroke="${C.card}" stroke-width="2"/><text x="${l.x}" y="${l.y}" text-anchor="${l.anchor}" fill="${C.muted}" font-size="${size}" ${halo}>${e(q.f.name)}</text></g>`;}).join('');
 const poles=`<g font-size="12" fill="${C.muted}"><text x="${mid}" y="${y0-12}" text-anchor="middle">↑ Valeurs culturelles ouvertes</text><text x="${x0}" y="${y1+18}">${compact?'← Redistribution':'← Redistribution / collectif'}</text><text x="${x1}" y="${y1+18}" text-anchor="end">Marché / privé →</text><text x="${mid}" y="${y1+38}" text-anchor="middle">↓ Valeurs culturelles conservatrices</text></g>`;
 const label=`Carte à deux dimensions : économie à l’horizontale, valeurs culturelles à la verticale. ${you?`Votre point : économie ${fmt(c.economic)} sur 10, valeurs culturelles ${fmt(c.cultural)} sur 10.`:'Coordonnées encore incomplètes.'} ${placed.length} familles placées ; les valeurs figurent dans le tableau des coordonnées.`;
 const table=`<details class="compass-table" ${compact?'open':''}><summary>Coordonnées des repères</summary><table><thead><tr>${compact?'<th>N°</th>':''}<th>Famille</th><th>Économie</th><th>Valeurs culturelles</th></tr></thead><tbody>${you?`<tr class="you">${compact?'<td></td>':''}<td>Vous</td><td>${fmt(c.economic)}</td><td>${fmt(c.cultural)}</td></tr>`:''}${all.map(q=>`<tr>${compact?`<td>${isPlaced(q)?q.n:''}</td>`:''}<td>${e(q.f.name)}${isPlaced(q)?'':' <small>· non placée</small>'}</td><td>${fmt(q.c.economic)}</td><td>${fmt(q.c.cultural)}</td></tr>`).join('')}</tbody></table></details>`;
 return `<figure class="compass"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}"><rect x="${x0}" y="${y0}" width="${x1-x0}" height="${y1-y0}" fill="${C.surface}"/><path d="M${mid} ${y0}V${y1}M${x0} ${Y(5)}H${x1}" stroke="${C.grid}" stroke-width="1"/>${poles}${marks}${youMark}</svg><figcaption>${missing.length?`Non placée${missing.length>1?'s':''}, faute de repères sur l’une des deux coordonnées : ${listFr(missing)}.`:''}${nudged?' Les points très proches sont légèrement écartés pour rester lisibles ; les valeurs exactes figurent dans le tableau des coordonnées.':''}</figcaption>${table}</figure>`;
}
// Ligne d'un axe, de 0 à 10 : milieu de l'échelle, votre point et, en comparaison, le repère d'une famille relié à votre point.
// Liste unique des familles pour toutes les vues : d'abord celles comparées à vos réponses, de la moins éloignée à la plus
// éloignée, puis les autres dans l'ordre du catalogue. Le rang dans cette liste est le même partout.
function familyList(ranked){return [...ranked,...D.families.filter(f=>!ranked.some(r=>r.id===f.id))];}
function axisTrack(score,target){
 const has=typeof score==='number',ref=typeof target==='number';
 return `<span class="axis-track" aria-hidden="true"><span class="axis-mid"></span>${has&&ref?`<span class="axis-link" style="left:${Math.min(score,target)*10}%;width:${Math.abs(score-target)*10}%"></span>`:''}${ref?`<span class="axis-ref" style="left:${target*10}%"></span>`:''}${has?`<span class="axis-dot" style="left:${score*10}%"></span>`:''}</span>`;
}
// Contenu visible d'un axe : nom, importance, score, ligne, pôles, phrase de lecture et, en comparaison, repère d'une famille.
function axisSummary(a,s,family){
 const prio=state.priorities[a.id]??2,target=family?.positions[a.id];
 const tag=prio===3?'<span class="axis-tag">Déterminant pour vous</span>':prio===1?'<span class="axis-tag secondary">Secondaire pour vous</span>':'';
 const reference=family?`<span class="axis-family">${typeof target==='number'?`Repère ${e(family.name)} : ${e(axisReading(a,target).short)} (${fmt(target)})`:`Non défini pour ${e(family.name)}`}</span>`:'';
 return `<span class="axis-row-head"><span class="axis-row-name">${String(axes.indexOf(a)+1).padStart(2,'0')} · ${e(a.name)}</span>${tag}<span class="axis-row-score">${fmt(s.score)}<small>/10</small></span></span>${axisTrack(s.score,target)}<span class="axis-poles"><span>${e(a.low)}</span><span>${e(a.high)}</span></span><span class="axis-reading">${e(axisReading(a,s).text)}</span>${reference}`;
}
function axisRow(a,s,family){
 return `<details class="axis-row" id="axe-${e(a.id)}" data-axis="${e(a.id)}" ${openAxes.has(a.id)?'open':''}><summary>${axisSummary(a,s,family)}</summary><div class="axis-row-body"><p>${e(a.description)}</p><p>${s.valid}/${a.questions.length} réponses de fond${s.skipped?` · ${s.skipped} sans position`:''}.${s.valid<2?' Il faut 2 réponses de fond au minimum pour mesurer cet axe.':''}</p>${s.contrast?'<p><strong>Réponses contrastées.</strong> Certains arbitrages vous conduisent vers des pôles différents. Consultez vos réponses avant de résumer cet axe.</p>':''}<div class="priority"><span>Ce sujet pèse dans mon choix</span>${priorityControls(a.id)}</div>${argumentsBlock(a)}<button class="btn subtle" data-action="jump" data-axis="${e(a.id)}">Revoir mes ${a.questions.length} réponses →</button></div></details>`;
}
// Onglet « Les axes » : une ligne par axe, groupée par thème, avec la comparaison facultative à une famille.
function axesView(profile,ranked){
 const map=Object.fromEntries(profile.map(s=>[s.id,s])),family=D.families.find(f=>f.id===compareFamily)??null;
 const order=familyList(ranked);
 const options=`<option value="">Aucune</option>${order.map(f=>{const r=ranked.find(x=>x.id===f.id);return `<option value="${e(f.id)}" ${f.id===compareFamily?'selected':''}>${e(f.name)}${r?` · ${lcFirst(proximity(r.distance).label)}`:''}</option>`;}).join('')}`;
 const legend=`<div class="axes-legend"><span><i class="key-dot"></i>Vous</span><span><i class="key-mid"></i>Milieu de l’échelle (5)</span>${family?`<span><i class="key-ref"></i>Repère ${e(family.name)}</span>`:''}</div>`;
 return `<div class="section-intro"><h2>Vos convictions, axe par axe</h2></div><div class="axes-toolbar"><label class="no-print" for="compare-family">Comparer avec une famille d’idées</label><select id="compare-family" class="no-print">${options}</select>${legend}</div><p class="chart-note no-print">Chaque ligne va du premier pôle de l’axe (0) au second (10). Ouvrez un axe pour lire sa définition, régler son importance et revoir vos réponses.</p>${Object.entries(groups).map(([id,g])=>`<section class="axis-group" aria-labelledby="groupe-${id}"><h3 class="axis-group-title" id="groupe-${id}"><span>${g.number}</span>${g.name}</h3>${axes.filter(a=>a.group===id).map(a=>axisRow(a,map[a.id],family)).join('')}</section>`).join('')}`;
}
// Vue d'ensemble : une ligne compacte par axe ; chacune ouvre l'axe correspondant dans l'onglet « Les axes ».
function axesOverview(profile){
 const map=Object.fromEntries(profile.map(s=>[s.id,s]));
 return `<section class="axes-overview" aria-labelledby="overview-axes-title"><div class="section-intro"><h2 id="overview-axes-title">Vos ${AXES_N} positions</h2><button class="btn subtle no-print" data-action="results-tab" data-tab="axes">Examiner axe par axe →</button></div><div class="axes-overview-grid">${Object.entries(groups).map(([id,g])=>`<div class="axis-group"><h3 class="axis-group-title"><span>${g.number}</span>${g.name}</h3>${axes.filter(a=>a.group===id).map(a=>{const s=map[a.id];return `<button type="button" class="axis-mini" data-action="open-axis" data-axis="${e(a.id)}" aria-label="${e(a.name)} : ${s.score===null?'non mesuré':`${fmt(s.score)} sur 10, ${e(lcFirst(axisReading(a,s).text))}`}. Examiner cet axe."><span class="axis-mini-head"><span>${e(a.shortName)}</span><span class="axis-mini-score">${fmt(s.score)}</span></span>${axisTrack(s.score)}<span class="axis-poles"><span>${e(a.low)}</span><span>${e(a.high)}</span></span></button>`;}).join('')}</div>`).join('')}</div></section>`;
}
// Arguments en présence sous un axe : pour chaque pôle, une ou deux thèses mises en avant, les autres dans un volet replié.
// Les deux pôles sont présentés côte à côte, dans l'ordre de l'axe, sans hiérarchie entre eux.
const thinkerById=Object.fromEntries(D.references.thinkers.map(t=>[t.id,t]));
const thinkerMeta=t=>[t.years,t.discipline,t.role].filter(Boolean).join(' · ');
// Espaces insécables de la typographie française : un guillemet ou un signe double ne se retrouve jamais seul en début ou en fin de ligne.
const nbsp=s=>e(s).replace(/« /g,'« ').replace(/ ([»:;?!])/g,' $1');
function argumentCard(x){
 const who=x.authors.map(id=>thinkerById[id]);
 const meta=who.length===1?thinkerMeta(who[0]):[...new Set(who.map(t=>t.discipline))].join(' · ');
 return `<article class="arg"><p class="arg-who"><strong>${e(listFr(who.map(t=>t.name)))}</strong><span>${e(meta)}</span></p><p class="arg-thesis">${nbsp(x.thesis)}</p>${x.quote?`<blockquote class="arg-quote">${nbsp(`« ${x.quote} »`)}</blockquote>`:''}${x.nuance?`<p class="arg-nuance">${nbsp(x.nuance)}</p>`:''}<a class="arg-source" href="${url(x.source.url)}" target="_blank" rel="noopener noreferrer">${e(x.source.title)}${x.source.year?` · ${e(x.source.year)}`:''} ↗</a></article>`;
}
function argumentsBlock(a){
 const pole=(key,label)=>{const list=D.references.arguments.filter(x=>x.axis===a.id&&x.pole===key),main=list.filter(x=>x.featured),more=list.filter(x=>!x.featured);return `<div class="arg-pole"><p class="arg-pole-name">${e(label)}</p>${main.map(argumentCard).join('')}${more.length?`<details class="arg-more"><summary>Autres lectures · ${more.length}</summary>${more.map(argumentCard).join('')}</details>`:''}</div>`;};
 return `<section class="arguments" aria-label="Arguments en présence sur l’axe ${e(a.name)}"><span class="round-label">Arguments en présence</span><div class="arg-poles">${pole('low',a.low)}${pole('high',a.high)}</div><p class="arg-note">Ces thèses éclairent les deux pôles de l’axe ; elles ne déterminent ni votre position ni sa mesure. Les auteurs et les critères de leur choix sont présentés dans la page <a href="#methode">Méthode</a>.</p></section>`;
}
function familyLead(x){
 const first=`<strong>${e(x.first.name)}</strong>`,group=[x.first,...x.tied];
 return {
   transversal:`Aucune famille ne se détache. La moins éloignée, ${first}, reste à ${points(x.first.distance)} d’écart moyen : au-delà de ${READING.transversal} points, le bilan parle de profil transversal.`,
   only:`${first} est la seule famille comparable à vos réponses, avec ${points(x.first.distance)} d’écart moyen.`,
   tied:`${listFr(group.map(t=>`<strong>${e(t.name)}</strong>`))} sont à égalité : leurs écarts moyens (${listFr(group.map(t=>fmt(t.distance)))} points) diffèrent de moins de ${fmtExact(READING.tie)} point.`,
   slight:`${first} arrive en tête, de peu : ${points(x.first.distance)} d’écart moyen, contre ${fmt(x.next.distance)} pour ${e(x.next.name)}.`,
   clear:`${first} se détache nettement : ${points(x.first.distance)} d’écart moyen, contre ${fmt(x.next.distance)} pour ${e(x.next.name)}, la suivante.`}[x.level];
}
function prioritiesNote(x){
 const alt=x.alternativeLeader,leader=alt&&(alt.id===x.first.id?`${e(x.first.name)} resterait en tête`:`${e(alt.name)} arriverait en tête`);
 return !x.prioritiesSet?'Tous les axes comptent autant : vous n’avez indiqué aucun sujet déterminant ou secondaire.':!leader?'':usePriorities?`Sans vos priorités, ${leader}.`:`Vos priorités ne sont pas prises en compte ; avec elles, ${leader}.`;
}
// Accords et écarts nets avec une famille : `x` porte agreements et divergences (familyContrast ou findings().family).
function contrastHtml(x,compared,profile){
 const agreements=x.agreements.length?`<p><strong>Accords</strong>, à ${READING.agree} point d’écart au plus : ${listFr(x.agreements.map(g=>e(byAxis[g.id].shortName)))}.</p>`:`<p>Aucun axe à ${READING.agree} point ou moins du repère.</p>`;
 const divergences=x.divergences.length?`<p><strong>Écarts les plus nets</strong>, à plus de ${READING.diverge} points :</p><ul class="finding-gaps">${x.divergences.map(g=>{const a=byAxis[g.id];return `<li><strong>${e(a.shortName)}</strong> : vous, ${e(axisReading(a,profile.find(s=>s.id===g.id)).short)} (${fmt(g.score)}) ; le repère, ${e(axisReading(a,g.target).short)} (${fmt(g.target)}).</li>`}).join('')}</ul>`:`<p>Aucun écart de plus de ${READING.diverge} points sur les ${compared} axes comparés.</p>`;
 return agreements+divergences;
}
function mapPanel(profile,ranked,compact=window.innerWidth<620){
 const c=globalCoordinates(profile),r=coordinateReading(c),ucFirst=t=>t[0].toLocaleUpperCase('fr')+t.slice(1);
 const line=(value,text,missing)=>`<li>${value===null?`<strong>${missing}</strong> : il faut au moins 2 des 3 axes renseignés.`:`<strong>${ucFirst(text)}</strong> <span class="finding-num">${fmt(value)}/10</span>`}</li>`;
 return `<section class="panel map-panel"><div class="map-text"><h3>Deux dimensions de lecture</h3><ul class="map-reading">${line(c.economic,r.eco,'Économie non mesurée')}${line(c.cultural,r.culture,'Valeurs culturelles non mesurées')}</ul><p>La carte résume 6 axes : redistribution, organisation de l’économie et pouvoir dans l’entreprise à l’horizontale ; choix de vie, immigration et intégration à la verticale. Les familles d’idées y sont placées avec la même règle, à partir de leurs repères.</p><p>Être proche d’une famille sur cette carte ne signifie pas en être proche sur les ${AXES_N} axes : l’Europe, l’écologie, les libertés et les institutions n’y figurent pas.</p></div>${compass(profile,ranked,compact)}</section>`;
}
// Animation « Votre position face aux familles d'idées » : une cible centrée sur vos réponses, où chaque famille comparée
// est placée à une distance égale à son écart moyen (mêmes calculs que la liste des proximités), et le détail axe par axe
// de la famille mise en avant. Les familles sont rangées par ordre alphabétique autour du centre : la direction ne porte
// aucune information. Les familles non comparées restent visibles sur le pourtour, pour que le catalogue soit complet.
const orbit={selected:null,playing:false,timer:null,observer:null,introDone:false,last:{}};
const reduceMotion=()=>!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const nextFrame=f=>(window.requestAnimationFrame?requestAnimationFrame(()=>requestAnimationFrame(f)):setTimeout(f,32));
function orbitGeometry(ranked,compact){
 const W=compact?360:700,H=compact?360:600,cx=W/2,cy=H/2,R=compact?128:200,r0=compact?18:24,band=R+(compact?24:28);
 const maxD=Math.max(4,Math.ceil(Math.max(0,...ranked.map(x=>x.distance))));
 const rad=d=>r0+(R-r0)*Math.min(d,maxD)/maxD;
 const order=D.families.slice().sort((a,b)=>a.name.localeCompare(b.name,'fr',{sensitivity:'base'}));
 const angle=Object.fromEntries(order.map((f,i)=>[f.id,-Math.PI/2+i*2*Math.PI/order.length]));
 const at=(id,r)=>({x:cx+r*Math.cos(angle[id]),y:cy+r*Math.sin(angle[id])});
 return {W,H,cx,cy,R,band,maxD,rad,at,step:2*Math.PI/order.length};
}
function orbitPanel(profile,ranked,compact=window.innerWidth<620){
 const g=orbitGeometry(ranked,compact),all=familyList(ranked),rank=Object.fromEntries(all.map((f,i)=>[f.id,i+1]));
 const cmp=Object.fromEntries(ranked.map(x=>[x.id,x])),size=12.5,frame={x1:2,y1:2,x2:g.W-2,y2:g.H-2};
 const pts=all.map(f=>({f,c:cmp[f.id],r:compact?10:6,...g.at(f.id,cmp[f.id]?g.rad(cmp[f.id].distance):g.band)}));
 const boxes=[...pts.map(p=>({x1:p.x-p.r-2,y1:p.y-p.r-2,x2:p.x+p.r+2,y2:p.y+p.r+2,weight:20})),{x1:g.cx-10,y1:g.cy-10,x2:g.cx+10,y2:g.cy+10,weight:20}];
 // Graduations des cercles : dans le secteur entre deux rayons le plus éloigné des points des familles.
 const levels=[READING.agree,READING.diverge,READING.transversal],gaps=Array.from({length:D.families.length},(_,k)=>-Math.PI/2+(k+.5)*g.step);
 const clearance=a=>Math.min(...levels.flatMap(d=>pts.map(p=>Math.hypot(g.cx+g.rad(d)*Math.cos(a)-p.x,g.cy+g.rad(d)*Math.sin(a)-p.y))));
 const a=gaps.reduce((best,x)=>clearance(x)>clearance(best)?x:best,gaps[gaps.length-1]);
 const ticks=compact?[]:levels.map(d=>{const x=g.cx+g.rad(d)*Math.cos(a),y=g.cy+g.rad(d)*Math.sin(a)+3.5,w=(d>1?5:4)*6.2;boxes.push({x1:x-w/2,y1:y-9,x2:x+w/2,y2:y+2,weight:6});return {d,x,y};});
 const you=placeLabel({x:g.cx,y:g.cy,r:8},'Vous',size+1,boxes,frame);
 const rings=[...levels,g.maxD].map((d,i)=>`<circle class="orb-ring${i===levels.length?' outer':''}" cx="${g.cx}" cy="${g.cy}" r="${g.rad(d).toFixed(1)}" style="animation-delay:${i*90}ms"/>`).join('');
 const scale=ticks.map(k=>`<text class="orb-scale" x="${k.x.toFixed(1)}" y="${k.y.toFixed(1)}" text-anchor="middle">${k.d} pt${k.d>1?'s':''}</text>`).join('');
 const spokes=pts.map(p=>{const end=g.at(p.f.id,g.band);return `<line class="orb-spoke" data-family="${e(p.f.id)}" x1="${g.cx}" y1="${g.cy}" x2="${end.x.toFixed(1)}" y2="${end.y.toFixed(1)}"/>`;}).join('');
 const fams=pts.map(p=>{
  const seen=orbit.last[p.f.id],from=seen??(orbit.introDone?p:g.at(p.f.id,g.band+46));
  const label=compact?`<text class="orb-num" y="4" text-anchor="middle">${rank[p.f.id]}</text>`:(()=>{const l=placeLabel(p,p.f.name,size,boxes,frame);return `<text x="${(l.x-p.x).toFixed(1)}" y="${(l.y-p.y).toFixed(1)}" text-anchor="${l.anchor}">${e(p.f.name)}</text>`;})();
  const desc=p.c?`${p.f.name} : écart moyen ${points(p.c.distance)}, ${lcFirst(proximity(p.c.distance).label)}, ${p.c.common.length} axes comparés.`:`${p.f.name} : non comparée, ${axesCount(commonAxes(p.f,profile))}.`;
  return `<g class="orb-fam${p.c?'':' uncompared'}" data-action="orbit-select" data-family="${e(p.f.id)}" data-x="${p.x.toFixed(1)}" data-y="${p.y.toFixed(1)}" style="transform:translate(${from.x.toFixed(1)}px,${from.y.toFixed(1)}px)${seen||orbit.introDone?'':';opacity:0'}" tabindex="0" role="button" aria-pressed="false" aria-label="${e(desc)} Afficher le détail axe par axe."><circle class="hit" r="${compact?17:15}"/><circle class="halo" r="${p.r}"/><circle class="dot" r="${p.r}"/>${label}</g>`;
 }).join('');
 const chips=compact?`<ol class="orb-chips">${all.map(f=>`<li><button type="button" data-action="orbit-select" data-family="${e(f.id)}" aria-pressed="false"><span class="orb-chip-n">${rank[f.id]}</span><span>${e(f.name)}</span><span class="orb-chip-d">${cmp[f.id]?fmt(cmp[f.id].distance):'non comparée'}</span></button></li>`).join('')}</ol>`:'';
 const map=Object.fromEntries(profile.map(s=>[s.id,s.score]));let theme='';
 const rows=axes.map(ax=>{const s=map[ax.id],x=s===null?50:s*10,head=ax.group!==theme?(theme=ax.group,`<div class="orb-theme">${e(groups[ax.group].name)}</div>`):'';
  return `${head}<div class="orb-row" data-axis="${e(ax.id)}"><span class="orb-name">${e(ax.shortName)}</span><span class="axis-track orb-track" aria-hidden="true"><span class="axis-mid"></span><span class="orb-link" style="left:${x}%;width:0"></span><span class="orb-ref" style="left:${x}%;opacity:0"></span>${s===null?'':`<span class="axis-dot" style="left:${x}%"></span>`}</span><span class="orb-gap">${s===null?'non mesuré':''}</span></div>`;}).join('');
 const none=!ranked.length,weights=usePriorities?'en tenant compte du poids que vous accordez à chaque sujet':'sans tenir compte du poids que vous accordez à chaque sujet';
 const caption=`Vous êtes au centre. Chaque famille comparée est placée à une distance égale à son écart moyen avec vos réponses, calculé sur les axes renseignés des deux côtés, ${weights}. Cercles : ${listFr(levels.map(d=>`${d} point${d>1?'s':''}`))} d’écart (très proche, proche, plutôt éloigné). Les familles sont rangées par ordre alphabétique autour du centre : la direction ne signifie rien.${ranked.length<D.families.length?` Les familles non comparées, faute de ${MIN_COMMON_AXES} axes communs, restent sur le pourtour.`:''}`;
 const label=`Cible des proximités. ${ranked.length?ranked.map(x=>`${x.name} : écart moyen ${points(x.distance)}`).join(' ; '):'Aucune famille n’est encore comparée.'}`;
 return `<section class="panel orbit-panel no-print" aria-labelledby="orbit-title"><div class="section-intro"><h2 id="orbit-title">Votre position face aux familles d’idées</h2><button class="btn subtle" data-action="results-tab" data-tab="familles">Voir toutes les proximités →</button></div><div class="orbit-grid"><figure class="orbit${compact?' compact':''}" id="orbit"><svg viewBox="0 0 ${g.W} ${g.H}" role="group" aria-label="${e(label)}"><circle class="orb-zone" cx="${g.cx}" cy="${g.cy}" r="${g.rad(READING.agree).toFixed(1)}"/>${spokes}${rings}${scale}<line class="orb-ray" id="orb-ray" x1="${g.cx}" y1="${g.cy}" x2="${g.cx}" y2="${g.cy}"/><circle class="orb-you" cx="${g.cx}" cy="${g.cy}" r="8"/><text class="orb-you-label" x="${you.x.toFixed(1)}" y="${you.y.toFixed(1)}" text-anchor="${you.anchor}">Vous</text>${fams}</svg>${chips}<figcaption>${caption}</figcaption></figure><div class="orb-detail"><div class="orb-head" id="orb-head" aria-live="polite">${none?'<strong>Aucune famille comparée</strong><span>Il faut au moins '+MIN_COMMON_AXES+' axes mesurés à la fois par vos réponses et par les repères d’une famille.</span>':''}</div><div class="orb-controls"><button type="button" class="btn" data-action="orbit-prev" aria-label="Famille précédente" ${none?'disabled':''}>←</button><button type="button" class="btn" data-action="orbit-play" aria-pressed="${orbit.playing}" ${none?'disabled':''}>${orbit.playing?'Pause':'Lecture'}</button><button type="button" class="btn" data-action="orbit-next" aria-label="Famille suivante" ${none?'disabled':''}>→</button><button type="button" class="btn subtle" data-action="orbit-replay" ${none?'disabled':''}>Rejouer l’animation</button></div><p class="orb-key"><span><i class="key-you"></i>Vous</span><span><i class="key-family"></i>Repère de la famille</span><span><i class="key-far"></i>Écart de plus de ${READING.diverge} points</span></p><div class="orb-axes" id="orb-axes">${rows}</div></div></div></section>`;
}
const orbitRanking=()=>{const profile=computeProfile(axes,state.answers);return {profile,ranked:compareFamilies(profile,D.families,state.priorities,usePriorities)};};
// Met une famille en avant : son rayon, son point, l'en-tête et ses repères qui glissent sur chaque ligne d'axe.
function orbitSelect(id){
 const el=document.getElementById('orbit'),f=D.families.find(x=>x.id===id);if(!el||!f)return;orbit.selected=id;
 const {profile,ranked}=orbitRanking(),c=ranked.find(x=>x.id===id),score=Object.fromEntries(profile.map(s=>[s.id,s.score]));
 document.querySelectorAll('.orbit-panel [data-family]').forEach(n=>{const on=n.dataset.family===id;n.classList.toggle('on',on);if(n.hasAttribute('aria-pressed'))n.setAttribute('aria-pressed',on);});
 const dot=el.querySelector(`.orb-fam[data-family="${CSS.escape?CSS.escape(id):id}"]`),ray=document.getElementById('orb-ray');
 if(dot&&ray){ray.setAttribute('x2',dot.dataset.x);ray.setAttribute('y2',dot.dataset.y);ray.classList.toggle('uncompared',!c);}
 document.querySelectorAll('#orb-axes .orb-row').forEach(row=>{
  const s=score[row.dataset.axis],t=f.positions[row.dataset.axis],hasS=typeof s==='number',hasT=typeof t==='number',d=hasS&&hasT?Math.abs(s-t):null,far=d!==null&&d>READING.diverge;
  const ref=row.querySelector('.orb-ref'),link=row.querySelector('.orb-link'),gap=row.querySelector('.orb-gap');
  ref.style.left=`${(hasT?t:hasS?s:5)*10}%`;ref.style.opacity=hasT?1:0;
  link.style.left=`${(d!==null?Math.min(s,t):hasS?s:5)*10}%`;link.style.width=`${d===null?0:d*10}%`;
  link.classList.toggle('far',far);gap.classList.toggle('far',far);row.classList.toggle('off',d===null);
  gap.textContent=!hasS?'non mesuré':!hasT?'non défini':points(d);
 });
 const head=document.getElementById('orb-head'),i=ranked.findIndex(x=>x.id===id);
 if(head)head.innerHTML=c?`<strong>${e(f.name)}</strong><span>${e(proximity(c.distance).label)} · écart moyen ${points(c.distance)} · ${c.common.length} axes comparés · ${i===0?'la plus proche':`${i+1}<sup>e</sup> sur ${ranked.length}`}</span>`:`<strong>${e(f.name)}</strong><span>Non comparée · ${axesCount(commonAxes(f,profile))}</span>`;
}
function orbitPlay(on){
 orbit.playing=on;clearTimeout(orbit.timer);
 const b=document.querySelector('[data-action="orbit-play"]');if(b){b.textContent=on?'Pause':'Lecture';b.setAttribute('aria-pressed',on);}
 // Pendant la lecture automatique, l'en-tête n'est pas annoncé à chaque famille par les lecteurs d'écran.
 document.getElementById('orb-head')?.setAttribute('aria-live',on?'off':'polite');
 if(on)orbit.timer=setTimeout(orbitTick,4200);
}
// Visite guidée : de la famille la plus proche à la plus éloignée, puis retour à la plus proche et arrêt.
function orbitTick(){
 const ids=orbitRanking().ranked.map(x=>x.id),i=ids.indexOf(orbit.selected);
 if(!document.getElementById('orbit')||!ids.length){orbit.playing=false;return;}
 if(i<0||i>=ids.length-1){orbitSelect(ids[0]);orbitPlay(false);return;}
 orbitSelect(ids[i+1]);orbit.timer=setTimeout(orbitTick,4200);
}
function orbitStep(dir){const ids=orbitRanking().ranked.map(x=>x.id);if(!ids.length)return;orbitPlay(false);const i=ids.indexOf(orbit.selected);orbitSelect(ids[i<0?0:(i+dir+ids.length)%ids.length]);}
// Après chaque rendu : les familles rejoignent leur place, depuis le bord à la première apparition (déclenchée quand la
// cible devient visible), depuis leur place précédente ensuite, par exemple après un changement de pondération.
function orbitMount(){
 clearTimeout(orbit.timer);orbit.observer?.disconnect();
 const el=document.getElementById('orbit');if(!el)return;
 const {ranked}=orbitRanking(),ids=ranked.map(x=>x.id),fams=[...el.querySelectorAll('.orb-fam')];
 if(!fams.some(n=>n.dataset.family===orbit.selected)||(ids.length&&!ids.includes(orbit.selected)))orbit.selected=ids[0]??null;
 const settle=intro=>{
  el.classList.toggle('intro',intro);
  const order=[...fams].sort((a,b)=>(ids.indexOf(b.dataset.family)+1||99)-(ids.indexOf(a.dataset.family)+1||99));
  nextFrame(()=>{
   order.forEach((n,k)=>{n.style.transitionDelay=intro?`${k*80}ms`:'0ms';n.style.transform=`translate(${n.dataset.x}px,${n.dataset.y}px)`;n.style.opacity='';orbit.last[n.dataset.family]={x:+n.dataset.x,y:+n.dataset.y};});
   if(orbit.selected)orbitSelect(orbit.selected);
   if(intro&&ids.length)orbit.timer=setTimeout(()=>{orbitSelect(ids[0]);orbitPlay(true);},order.length*80+700);
   else if(orbit.playing)orbitPlay(true);
  });
 };
 if(orbit.introDone||reduceMotion()){orbit.introDone=true;settle(false);return;}
 const start=()=>{orbit.introDone=true;settle(true);};
 if('IntersectionObserver' in window){orbit.observer=new IntersectionObserver(es=>{if(es.some(x=>x.isIntersecting)){orbit.observer.disconnect();start();}},{threshold:.3});orbit.observer.observe(el);}else start();
}
function findingsSection(profile,f,summary){
 const names=ids=>listFr(ids.map(id=>e(byAxis[id].shortName)));
 const row=(label,body)=>`<div class="finding"><h3 class="finding-label">${label}</h3><div class="finding-body">${body}</div></div>`;
 const plural=n=>n>1?'s':'';
 const marked=f.marked.length?`<ul class="finding-list">${f.marked.map(x=>`<li><span class="finding-axis">${e(byAxis[x.id].name)} <span class="finding-num">${fmt(x.score)}/10</span></span><span class="finding-text">${e(x.reading.text)}</span>${x.priority===3?'<span class="finding-tag">Déterminant pour vous</span>':''}</li>`).join('')}</ul>${f.moreStrong?`<p class="finding-note">Et ${f.moreStrong} autre${plural(f.moreStrong)} préférence${plural(f.moreStrong)} nette${plural(f.moreStrong)}. <button class="btn subtle no-print" data-action="results-tab" data-tab="axes">Voir les ${AXES_N} axes →</button></p>`:''}`:'<p>Aucun axe mesuré ne s’écarte de plus d’un point du milieu de l’échelle.</p>';
 const open=[f.split.length?`<p><strong>Avis partagés</strong>, avec des réponses vers chaque pôle : ${names(f.split)}.</p>`:'',f.middle.length?`<p><strong>Position intermédiaire</strong> : ${names(f.middle)}.</p>`:'',f.unmeasured.length?`<p><strong>Non mesuré${plural(f.unmeasured.length)}</strong>, faute de 2 réponses de fond : ${f.unmeasured.length>6?`${f.unmeasured.length} axes`:names(f.unmeasured)}.</p>`:''].join('')||'<p>Chacun de vos axes mesurés penche nettement d’un côté.</p>';
 let family;
 if(!f.family)family=row('La famille d’idées la plus proche',`<p>${e(summary.description)}</p>`);
 else{
  const x=f.family;
  family=row('La famille d’idées la plus proche',`<p>${familyLead(x)}</p><p class="finding-note">${prioritiesNote(x)} L’écart moyen va de 0 (mêmes positions) à 10 (positions opposées). <button class="btn subtle no-print" data-action="results-tab" data-tab="familles">Voir toutes les proximités →</button></p>`);
  family+=row(`Avec ${e(x.first.name)} : accords et écarts`,contrastHtml(x,x.first.common.length,profile));
 }
 return `<section class="findings" aria-labelledby="findings-title"><h2 id="findings-title">Ce que disent vos réponses</h2>${row('Vos positions les plus marquées',marked)}${row('Ce que vos réponses ne tranchent pas',open)}${family}</section>`;
}
const commonAxes=(f,profile)=>Object.keys(f.positions).filter(id=>profile.find(s=>s.id===id)?.score!==null).length;
const axesCount=n=>`${n} axe${n>1?'s':''} commun${n>1?'s':''} sur ${MIN_COMMON_AXES} requis`;
function proximityChart(ranked,f,profile){
 const max=Math.max(5,Math.ceil(Math.max(...ranked.map(x=>x.distance)))),pct=v=>`${(v/max*100).toFixed(2)}%`;
 const lead=new Set((f.family?[f.family.first,...f.family.tied]:ranked.slice(0,1)).map(x=>x.id));
 const grid=[0,READING.agree,READING.diverge,READING.transversal].map(b=>`<span class="pc-grid" style="left:${pct(b)}"></span>`).join('');
 const zones=[[0,READING.agree],[READING.agree,READING.diverge],[READING.diverge,READING.transversal],[READING.transversal,max]].map(([a,b])=>`<span class="pc-zone" style="left:${pct(a)};width:${pct(b-a)}">${proximity(b).label}</span>`).join('');
 const rows=ranked.map(x=>{const p=proximity(x.distance);return `<li><button type="button" class="pc-hit ${lead.has(x.id)?'lead':''}" data-action="family-focus" data-family="${e(x.id)}" aria-label="${e(x.name)} : écart moyen ${points(x.distance)}, ${lcFirst(p.label)}, ${x.common.length} axes comparés. Afficher le détail."><span class="pc-name">${e(x.name)}<small>${x.common.length} axes comparés</small></span><span class="pc-track">${grid}<span class="pc-bar" style="width:${pct(x.distance)}"></span><span class="pc-value" style="left:${pct(x.distance)}">${fmt(x.distance)}</span></span><span class="pc-level">${p.label}</span></button></li>`;}).join('');
 const ticks=Array.from({length:max+1},(_,k)=>`<span class="pc-tick" style="left:${pct(k)}">${k}</span>`).join('');
 const others=familyList(ranked).slice(ranked.length).map(g=>{const n=commonAxes(g,profile);return `<li><button type="button" class="pc-hit uncompared" data-action="family-focus" data-family="${e(g.id)}" aria-label="${e(g.name)} : non comparée, ${axesCount(n)}. Afficher le détail."><span class="pc-name">${e(g.name)}<small>${axesCount(n)}</small></span><span class="pc-track">${grid}<span class="pc-none">Non comparée</span></span><span class="pc-level">—</span></button></li>`;}).join('');
 return `<figure class="proximity-chart"><div class="pc-line pc-zones" aria-hidden="true"><span></span><span class="pc-track">${zones}</span><span></span></div><ol class="pc-rows">${rows}${others}</ol><div class="pc-line pc-ticks" aria-hidden="true"><span></span><span class="pc-track">${ticks}</span><span></span></div><figcaption>Écart moyen entre vos scores et le repère de chaque famille, en points : 0 signifie des positions identiques sur les axes comparés.<span class="no-print"> Sélectionnez une famille pour lire le détail.</span>${others?` Une famille n’est comparée qu’à partir de ${MIN_COMMON_AXES} axes mesurés à la fois par vos réponses et par ses repères.`:''}</figcaption></figure>`;
}
// Cartes de l'onglet Proximités. L'en-tête reste visible : rang, nom, axes comparés, niveau de proximité, écart moyen et une
// jauge sur une échelle commune à toutes les cartes. Le corps sépare ce qui rapproche et ce qui sépare, la présentation du
// courant, puis deux volets repliables : les sources, par catégorie, et les repères axe par axe. Le bilan imprimé déplie tout.
const gapScale=ranked=>Math.max(4,Math.ceil(Math.max(0,...ranked.map(x=>x.distance))));
// Ligne d'un axe dans une carte : votre point, le repère de la famille et l'écart entre les deux, épaissi au-delà de READING.diverge.
function gapTrack(score,target){
 const has=typeof score==='number',ref=typeof target==='number',far=has&&ref&&Math.abs(score-target)>READING.diverge;
 return `<span class="axis-track gap-track" aria-hidden="true"><span class="axis-mid"></span>${has&&ref?`<span class="gap-link${far?' far':''}" style="left:${Math.min(score,target)*10}%;width:${Math.abs(score-target)*10}%"></span>`:''}${ref?`<span class="gap-ref" style="left:${target*10}%"></span>`:''}${has?`<span class="axis-dot" style="left:${score*10}%"></span>`:''}</span>`;
}
const familyToggle='<span class="family-toggle" aria-hidden="true"><span class="ft-open">Détails</span><span class="ft-close">Replier</span><svg viewBox="0 0 12 12"><path d="M2 4.5l4 4 4-4"/></svg></span>';
function familyHead(f,i,{scale=4,toggle=true}={}){
 const ticks=[READING.agree,READING.diverge,READING.transversal].filter(b=>b<scale).map(b=>`<span class="family-meter-tick" style="left:${(b/scale*100).toFixed(2)}%"></span>`).join('');
 return `<span class="family-rank">${String(i+1).padStart(2,'0')}</span><span class="family-title"><h3>${e(f.name)}</h3><span class="family-meta">${f.common.length} axes comparés sur ${Object.keys(f.positions).length} définis</span></span><span class="family-score"><span class="family-level">${e(proximity(f.distance).label)}</span><span class="family-distance">écart moyen ${points(f.distance)}</span><span class="family-meter" aria-hidden="true"><span class="family-meter-bar" style="width:${(Math.min(f.distance,scale)/scale*100).toFixed(2)}%"></span>${ticks}</span></span>${toggle?familyToggle:''}`;
}
function uncomparedHead(g,i,n,toggle=true){return `<span class="family-rank">${String(i+1).padStart(2,'0')}</span><span class="family-title"><h3>${e(g.name)}</h3><span class="family-meta">${axesCount(n)}</span></span><span class="family-score"><span class="family-level uncompared">Non comparée</span></span>${toggle?familyToggle:''}`;}
// Sources d'une famille, par catégorie : textes de référence, déclarations provisoires, textes comparés.
function sourcesBlock(f,open){
 const fixed=f.sources.filter(s=>!s.provisional),interim=f.sources.filter(s=>s.provisional),compared=f.compared??[];
 const count=[[fixed.length,'texte de référence','textes de référence'],[interim.length,'déclaration provisoire','déclarations provisoires'],[compared.length,'texte comparé','textes comparés']].filter(([n])=>n).map(([n,one,many])=>`${n} ${n>1?many:one}`).join(' · ');
 const list=items=>`<ul class="source-list">${items.map(s=>`<li><a href="${url(s.url)}" target="_blank" rel="noopener noreferrer">${e(s.title)}</a><span>${e(publisher(s))}</span></li>`).join('')}</ul>`;
 const group=(label,note,items)=>items.length?`<div class="source-group"><p class="source-kind"><strong>${label}</strong></p><p class="source-note">${note}</p>${list(items)}</div>`:'';
 return `<details class="family-sub"${open?' open':''}><summary><span class="family-sub-title">Sources</span><span class="family-sub-count">${count}</span></summary><div class="family-sub-body">${group('Textes de référence','Ils fixent les repères de la famille.',fixed)}${group('Déclarations retenues à titre provisoire','Elles tranchent un axe que les textes de référence laissent ouvert, en attendant les programmes de 2027.',interim)}${group('Textes comparés','Textes d’autres partis restés proches des repères ; ils ne fixent rien.',compared)}</div></details>`;
}
// Repères d'une famille axe par axe, regroupés par thème, face à vos scores.
function referencesBlock(f,profile,open){
 const score=Object.fromEntries(profile.map(s=>[s.id,s.score])),defined=axes.filter(a=>a.id in f.positions),missing=axes.filter(a=>!(a.id in f.positions));let theme='';
 const rows=defined.map(a=>{const s=score[a.id],t=f.positions[a.id],d=typeof s==='number'?Math.abs(s-t):null,head=a.group!==theme?(theme=a.group,`<tr class="ref-theme"><th colspan="5" scope="colgroup">${e(groups[a.group].name)}</th></tr>`):'';return `${head}<tr><th scope="row">${e(a.shortName)}</th><td class="ref-track">${gapTrack(s,t)}</td><td class="num">${fmt(s)}</td><td class="num">${fmt(t)}</td><td class="num${d!==null&&d>READING.diverge?' far':''}">${d===null?'—':fmt(d)}</td></tr>`;}).join('');
 return `<details class="family-sub"${open?' open':''}><summary><span class="family-sub-title">Repères axe par axe</span><span class="family-sub-count">${defined.length} axes définis${missing.length?` · ${missing.length} non définis`:''}</span></summary><div class="family-sub-body"><p class="source-note">Ces valeurs sont une modélisation éditoriale de courants d’idées, pas des scores mesurés de partis ni des réponses attribuées à leurs membres. Les axes non définis ne participent pas à la comparaison.</p><table class="ref-table"><thead><tr><th scope="col">Axe</th><th scope="col"><span class="sr-only">Positions sur l’axe</span></th><th scope="col" class="num">Vous</th><th scope="col" class="num">Repère</th><th scope="col" class="num">Écart</th></tr></thead><tbody>${rows}</tbody></table>${missing.length?`<p class="source-note">Non définis pour cette famille : ${listFr(missing.map(a=>e(a.shortName)))}.</p>`:''}</div></details>`;
}
function familyBody(f,profile,{report=false}={}){
 const x=familyContrast(f),you=id=>profile.find(s=>s.id===id);
 const near=x.agreements.length?`<ul class="family-chips">${x.agreements.map(g=>`<li><span>${e(byAxis[g.id].shortName)}</span><span class="chip-gap">${points(g.gap)}</span></li>`).join('')}</ul>`:`<p class="family-empty">Aucun axe à ${READING.agree} point ou moins du repère.</p>`;
 const far=x.divergences.length?`<ul class="family-gaps">${x.divergences.map(g=>{const a=byAxis[g.id];return `<li><div class="family-gap-head"><strong>${e(a.shortName)}</strong><span class="chip-gap far">${points(g.gap)}</span></div>${gapTrack(g.score,g.target)}<p>Vous : ${e(axisReading(a,you(g.id)).short)} (${fmt(g.score)}) · repère : ${e(axisReading(a,g.target).short)} (${fmt(g.target)})</p></li>`;}).join('')}</ul>`:`<p class="family-empty">Aucun écart de plus de ${READING.diverge} points sur les ${f.common.length} axes comparés.</p>`;
 return `<div class="family-contrast"><section><h4 class="family-block-title">Ce qui vous rapproche <span>à ${READING.agree} point au plus</span></h4>${near}</section><section><h4 class="family-block-title">Ce qui vous sépare le plus <span>plus de ${READING.diverge} points</span></h4>${far}</section></div><section class="family-about"><h4 class="family-block-title">Le courant en bref</h4><p class="family-desc">${e(f.description)}</p></section>${sourcesBlock(f,report)}${referencesBlock(f,profile,report)}`;
}
// Éditeur d'une source : nommé dans la source, ou tiré du catalogue des partis pour un texte de parti.
const publisher=s=>s.publisher??partyById[s.party]?.name;
// Liste de liens vers des sources, avec leur éditeur, pour la page Méthode.
const textLinks=list=>list.map(s=>`<a href="${url(s.url)}" target="_blank" rel="noopener noreferrer">${e(s.title)}</a> (${e(publisher(s))})`).join(' · ');
// Section « Familles et partis » de la page Méthode : les textes de chaque famille, puis tous les partis du catalogue.
function familiesAndParties(){
 const status=Object.fromEntries(D.parties.parties.map(p=>[p.id,{reference:D.families.filter(f=>f.sources.some(s=>s.party===p.id)).map(f=>f.name),compared:D.families.filter(f=>(f.compared??[]).some(t=>t.party===p.id)).map(f=>f.name)}]));
 const basisLabel={assemblee:'Assemblée nationale','parlement-europeen':'Parlement européen','presidentielle-2027':'Présidentielle 2027'};
 const link=(href,text)=>href?`<a href="${url(href)}" target="_blank" rel="noopener noreferrer">${text}</a>`:text;
 const familyCell=p=>{const st=status[p.id];return [st.reference.length?`Texte de référence : ${st.reference.map(e).join(', ')}`:'',st.compared.length?`Texte comparé : ${st.compared.map(e).join(', ')}`:''].filter(Boolean).join('<br>')||`<span class="muted">${e(p.unmodelled)}</span>`;};
 const row=p=>{const c=p.candidate,name=`<span class="party-name">${e(p.name)}</span>${p.acronym?` <span class="party-acronym">${e(p.acronym)}</span>`:''}`;return `<tr><td>${link(p.url,name)}${p.territory?`<small>${e(p.territory)}</small>`:''}</td><td>${p.basis.map(b=>`<span class="party-basis">${link(b.evidence,basisLabel[b.type])}${b.toVerify?'<sup>*</sup>':''}</span>`).join('')}</td><td>${c?(c.own?e(c.name):`Soutien à ${e(c.name)}${c.party?` (${e(partyById[c.party].acronym??partyById[c.party].name)})`:''}`):'—'}</td><td>${familyCell(p)}</td></tr>`;};
 const table=list=>`<div class="table-wrap"><table class="party-table"><thead><tr><th>Parti</th><th>Critère d’inclusion</th><th>Candidature 2027</th><th>Famille d’idées</th></tr></thead><tbody>${list.slice().sort((a,b)=>a.name.localeCompare(b.name,'fr',{sensitivity:'base'})).map(row).join('')}</tbody></table></div>`;
 const national=D.parties.parties.filter(p=>p.scope==='national'),local=D.parties.parties.filter(p=>p.scope!=='national');
 const [y,m,d]=D.parties.asOf.split('-').map(Number),asOf=dateFr(new Date(y,m-1,d));
 const withReference=D.parties.parties.filter(p=>status[p.id].reference.length).length,withCompared=D.parties.parties.filter(p=>!status[p.id].reference.length&&status[p.id].compared.length).length;
 return `<h2 id="familles-partis">Familles et partis</h2><p>Les familles d’idées ne sont pas des partis. Pour fixer leurs repères, la rédaction s’appuie sur des textes de référence : programmes, textes doctrinaux, rapports. Quand l’un de ces textes émane d’un parti, ce parti est cité. Cela ne signifie ni qu’il se résume à cette famille, ni qu’il est le seul à s’en réclamer.</p><p>Des textes d’autres partis ont ensuite été comparés aux repères des familles. Un texte est cité comme texte comparé lorsque, sur chaque axe qu’il aborde parmi ceux que la famille définit, sa position reste à ${READING.diverge} points au plus du repère. Il n’a pas servi à fixer ces repères.</p><dl class="family-texts">${D.families.map(f=>`<dt>${e(f.name)}</dt><dd>${textLinks(f.sources.filter(s=>!s.provisional))}${f.sources.some(s=>s.provisional)?`<br><span class="family-compared">Déclarations provisoires : ${textLinks(f.sources.filter(s=>s.provisional))}</span>`:''}${f.compared?.length?`<br><span class="family-compared">Comparés : ${textLinks(f.compared)}</span>`:''}</dd>`).join('')}</dl><p>Les partis ci-dessous répondent au critère suivant, au ${asOf} : ${e(lcFirst(D.parties.criterion))} La liste est établie à partir des données ouvertes de l’Assemblée nationale et du Parlement européen et d’articles de presse ; chaque critère renvoie à sa source. ${withReference} partis sur ${D.parties.parties.length} ont un texte de référence et ${withCompared} un texte comparé ; pour les autres, la raison de l’absence est indiquée.</p><h3 class="party-heading">Partis nationaux · ${national.length}</h3>${table(national)}<details class="party-more"><summary>Partis régionaux et ultramarins · ${local.length}</summary>${table(local)}</details><p class="small muted">* Critère établi à partir d’une source unique ou de Wikipédia, à confirmer.</p>`;
}
function familyCard(f,profile,i,scale){return `<details class="family-card" id="famille-${e(f.id)}" ${i<3?'open':''}><summary class="family-head">${familyHead(f,i,{scale})}</summary><div class="family-body">${familyBody(f,profile)}</div></details>`;}
function uncomparedCard(g,profile,i){const n=commonAxes(g,profile);return `<details class="family-card uncompared" id="famille-${e(g.id)}"><summary class="family-head">${uncomparedHead(g,i,n)}</summary><div class="family-body"><p class="family-why">Cette famille définit ${Object.keys(g.positions).length} axes ; vos réponses en mesurent ${n}. La comparaison demande au moins ${MIN_COMMON_AXES} axes mesurés de part et d’autre.</p><section class="family-about"><h4 class="family-block-title">Le courant en bref</h4><p class="family-desc">${e(g.description)}</p></section>${sourcesBlock(g,false)}${referencesBlock(g,profile,false)}</div></details>`;}
function familiesSection(profile,ranked,f,summary){const x=f.family;return `<div class="section-intro"><h2>Vos proximités avec les familles d’idées</h2></div>${x?`<p class="pc-lead">${familyLead(x)}</p>`:ranked.length?`<p class="pc-lead">Comparaison provisoire. ${e(summary.description)}</p>`:''}<label class="small no-print pc-toggle"><input type="checkbox" id="use-priorities" ${usePriorities?'checked':''}> Tenir compte du poids que j’accorde à chaque sujet</label>${x?`<p class="finding-note pc-priorities">${prioritiesNote(x)}</p>`:''}${proximityChart(ranked,f,profile)}<div class="family-list">${ranked.map((r,i)=>familyCard(r,profile,i,gapScale(ranked))).join('')}${familyList(ranked).slice(ranked.length).map((g,k)=>uncomparedCard(g,profile,ranked.length+k)).join('')}</div><p class="chart-note no-print">Les familles ne sont pas des partis. Les textes de référence de chacune et la liste des partis retenus figurent dans la méthode. <button class="btn subtle" data-action="method-section" data-section="familles-partis">Voir « Familles et partis » →</button></p>`;}
// Les limites de lecture communes à tous les onglets du bilan, regroupées en un seul encadré repliable.
const readingPoints=[
  ['Aucune consigne de vote',`Le bilan décrit vos réponses aux ${QUESTIONS_N} propositions et les compare à ${familyCount} familles d’idées, et non à des candidats. Un écart mesure une distance d’idées ; il ne prédit pas votre vote.`],
  ['Chaque axe a ses propres pôles','0 et 10 sont les deux pôles de l’axe ; 5 en est le milieu, sans signification centriste. Un axe n’est mesuré qu’à partir de 2 réponses de fond : une réponse manquante n’est jamais remplacée par 5.'],
  ['Pas d’échelle gauche-droite unique','Les pôles diffèrent d’un axe à l’autre : un score extrême ne mesure ni une radicalité ni une cohérence. Les profils croisés sont conservés : une économie à gauche et des valeurs culturelles conservatrices ne font pas un « centre ». Les contre-pouvoirs et les institutions sont décrits à part.'],
  ['Des familles simplifiées','Leurs repères sont des choix éditoriaux inspirés de textes doctrinaux, pas des scores mesurés de partis ; certaines ne définissent pas tous les axes. Le classement dépend de ces repères, des axes comparés et de vos priorités : les écarts restent indicatifs.'],
  ['Des seuils de lecture conventionnels','Les qualificatifs comme « préférence nette » ou « proche » suivent des seuils fixés pour cette version, sans calibration statistique. Ils ne modifient aucun score.']];
function readingGuide(){
 return `<details class="reading-guide"><summary><strong>Comment lire ce bilan</strong><span>Un outil indicatif : il décrit vos réponses, sans prédire ni recommander un vote.</span></summary><ul>${readingPoints.map(([t,d])=>`<li><strong>${t}</strong>${d}</li>`).join('')}</ul><p><a href="#methode">Toute la méthode, les calculs et les sources →</a></p></details>`;
}
// Rapport imprimé : toutes les sections du bilan, quel que soit l'onglet ouvert. Il est construit avant l'impression et retiré après.
function reportFamily(f,profile,i,scale){return `<section class="family-card report-family"><div class="family-head">${familyHead(f,i,{scale,toggle:false})}</div><div class="family-body">${familyBody(f,profile,{report:true})}</div></section>`;}
function printReport(){
 const profile=computeProfile(axes,state.answers),ranked=compareFamilies(profile,D.families,state.priorities,usePriorities),summary=interpretation(profile,ranked),n=completed();
 const f=findings(axes,profile,state.priorities,ranked,compareFamilies(profile,D.families,state.priorities,!usePriorities),summary.ready);
 const map=Object.fromEntries(profile.map(s=>[s.id,s])),measured=profile.filter(s=>s.score!==null).length;
 const date=dateFr(new Date());
 // Une adresse de fichier local révélerait le chemin de l'ordinateur : seule une adresse web est imprimée.
 const site=/^https?:$/.test(location.protocol)?`${location.origin}${location.pathname}`:'';
 const positions=Object.entries(groups).map(([id,g])=>`<div class="axis-group"><h3 class="axis-group-title"><span>${g.number}</span>${g.name}</h3>${axes.filter(a=>a.group===id).map(a=>`<div class="axis-row">${axisSummary(a,map[a.id],null)}</div>`).join('')}</div>`).join('');
 const families=ranked.length?`${f.family?`<p class="pc-lead">${familyLead(f.family)}</p><p class="finding-note">${prioritiesNote(f.family)}</p>`:''}${proximityChart(ranked,f,profile)}<h3 class="report-sub">Les 3 familles les moins éloignées</h3>${ranked.slice(0,3).map((r,i)=>reportFamily(r,profile,i,gapScale(ranked))).join('')}`:`<p>Renseignez au moins ${MIN_COMMON_AXES} axes communs à un profil pour obtenir une comparaison.</p>`;
 return `<article class="report"><header class="report-head"><div class="eyebrow">Avant l’isoloir · Présidentielle 2027</div><h1>Votre bilan avant de trancher</h1><p>Imprimé le ${date}. ${n}/${QUESTIONS_N} propositions parcourues · ${valid()} prises de position · ${n-valid()} sans position · ${measured}/${AXES_N} axes mesurés.${n<QUESTIONS_N?' Ce bilan est partiel : le questionnaire n’est pas terminé.':''}</p></header><section class="report-guide"><h2>Comment lire ce bilan</h2><ul>${readingPoints.map(([t,d])=>`<li><strong>${t}</strong> ${d}</li>`).join('')}</ul></section>${findingsSection(profile,f,summary)}${mapPanel(profile,ranked,false)}<section class="report-axes"><h2>Vos ${AXES_N} positions, axe par axe</h2>${positions}</section><section class="report-families"><h2>Vos proximités avec les familles d’idées</h2>${families}</section><footer class="report-foot">Version ${e(D.version)} · Calcul effectué dans ce navigateur · Aucune consigne de vote.${site?` Méthode complète et sources : ${e(site)}#methode`:''}</footer></article>`;
}
function preparePrint(){
 if(route()!=='resultats'||!completed())return;
 let el=document.getElementById('print-report');
 if(!el){el=document.createElement('div');el.id='print-report';document.body.appendChild(el);}
 el.innerHTML=printReport();document.body.classList.add('print-report-on');
}
function endPrint(){document.getElementById('print-report')?.remove();document.body.classList.remove('print-report-on');}
function result(){if(!completed())return `<div class="empty"><div class="eyebrow" style="justify-content:center">Votre bilan</div><h2>Pas encore de bilan</h2><p>Répondez aux propositions : le bilan affichera vos positions sur ${AXES_N} axes et vos proximités avec chaque famille d’idées.</p><button class="btn primary" data-action="start">Commencer le questionnaire →</button></div>`;
 const profile=computeProfile(axes,state.answers),ranked=compareFamilies(profile,D.families,state.priorities,usePriorities),summary=interpretation(profile,ranked),n=completed();
 const alternative=compareFamilies(profile,D.families,state.priorities,!usePriorities),f=findings(axes,profile,state.priorities,ranked,alternative,summary.ready);
 let body='';if(resultsTab==='panorama')body=`${findingsSection(profile,f,summary)}${orbitPanel(profile,ranked)}${mapPanel(profile,ranked)}${axesOverview(profile)}`;
 else if(resultsTab==='axes')body=axesView(profile,ranked);
 else if(resultsTab==='familles')body=familiesSection(profile,ranked,f,summary);
 else body=reviewContent();
 return `<div class="page-head"><div class="result-title"><div class="eyebrow">Votre bilan avant de trancher</div><h1>Vos positions et vos proximités</h1><p>${n===QUESTIONS_N?'Votre parcours est terminé.':'Votre parcours est en cours.'} ${n}/${QUESTIONS_N} propositions parcourues · ${valid()} prises de position · ${n-valid()} sans position · ${profile.filter(s=>s.score!==null).length}/${AXES_N} axes mesurés.</p></div><div class="actions no-print"><button class="btn" data-action="export-session">Exporter mes réponses ↓</button><button class="btn" data-action="print">Imprimer le bilan</button></div></div>${n<QUESTIONS_N?`<div class="notice no-print">Ce bilan est partiel. <button class="btn subtle" data-action="resume">Continuer le questionnaire →</button></div>`:''}${readingGuide()}<div class="tabs no-print" role="group" aria-label="Vues des résultats">${[['panorama','Vue d’ensemble'],['axes',`Les ${AXES_N} axes`],['familles','Proximités'],['reponses','Mes réponses']].map(([id,t])=>`<button class="tab ${resultsTab===id?'active':''}" aria-pressed="${resultsTab===id}" data-action="results-tab" data-tab="${id}">${t}</button>`).join('')}</div>${body}<div class="actions no-print" style="margin-top:32px"><button class="btn" data-action="results-tab" data-tab="axes">Lire les arguments, axe par axe →</button><button class="btn subtle" data-action="reset">Effacer mes réponses</button></div>${warning()}`;}
function reviewContent(){return `<div class="review">${axes.map(a=>`<details><summary>${e(a.name)} <span class="small" style="color:var(--muted)">· ${a.questions.filter(q=>isAnswer(state.answers[q.id])).length}/4</span></summary>${a.questions.map(q=>`<div class="review-row"><p>${e(q.text)}</p><span class="review-answer">${e(choices.find(c=>c.value===state.answers[q.id])?.label??'Sans réponse')}</span><button data-action="edit-question" data-question="${q.id}">Modifier</button></div>`).join('')}</details>`).join('')}</div>`;}
function review(){return `<div class="page-head"><div><div class="eyebrow">Votre parcours</div><h1>Questionnaire inachevé</h1><p>${QUESTIONS_N-completed()} propositions n’ont pas encore reçu de réponse. Vous pouvez les compléter ou consulter un bilan provisoire.</p></div></div><div class="actions" style="margin-bottom:25px"><button class="btn primary" data-action="resume">Continuer →</button><a class="btn" href="#resultats">Voir le bilan provisoire</a></div>${reviewContent()}`;}
// Liste des auteurs cités sous les axes, dans l'ordre alphabétique des noms, avec les axes où chacun apparaît.
function authorsIndex(){
 const key=t=>(t.name.includes(' de ')?t.name.split(' de ').pop():t.name.split(' ').pop());
 const list=D.references.thinkers.slice().sort((x,y)=>key(x).localeCompare(key(y),'fr',{sensitivity:'base'})||x.name.localeCompare(y.name,'fr'));
 const axesOf=t=>axes.filter(a=>D.references.arguments.some(x=>x.axis===a.id&&x.authors.includes(t.id))).map(a=>e(a.shortName));
 return `<h2 id="auteurs">Les auteurs cités</h2><p>Sous chaque axe du bilan, des thèses d’auteurs éclairent les deux pôles : une ou deux mises en avant de chaque côté, parfois complétées par d’autres lectures. Elles ne modifient ni vos réponses ni vos scores.</p><p>Sont retenus des chercheurs, des intellectuels et des penseurs dont la pensée ou les écrits ont été reconnus par leurs pairs, et qui ne sont associés ni à une théorie du complot, ni à la désinformation, ni à des propos extrémistes, racistes ou antisémites, ni à une condamnation ou à un scandale public. Les auteurs classiques sont lus pour leur œuvre. Les responsables politiques du passé figurent lorsque leur pensée éclaire un axe ; les candidats et les dirigeants en fonction n’y figurent pas, leurs positions apparaissant dans les textes de référence des familles d’idées. Les thèses sont des synthèses de la rédaction ; les citations, en français, reproduisent mot pour mot le texte de l’auteur ou sa traduction publiée, et chaque source est conservée dans les archives de l’outil.</p><details class="family-sub authors-index"><summary><span class="family-sub-title">${list.length} auteurs</span><span class="family-sub-count">par ordre alphabétique</span></summary><ul class="author-list">${list.map(t=>`<li><strong>${e(t.name)}</strong><span>${e(thinkerMeta(t))}</span><span class="author-axes">${listFr(axesOf(t))}</span></li>`).join('')}</ul></details>`;
}
function method(){return `<div class="page-head"><div><div class="eyebrow">Méthode</div><h1>Comment le bilan est calculé</h1><p>Version ${e(D.version)}. Cadre français, ${UPDATED}.</p></div></div><div class="reading"><aside>Ce que le bilan mesure,<br>et ce qu’il ne mesure pas.</aside><article>
 <h2 style="margin-top:0">${AXES_N} axes, sans moyenne gauche-droite</h2><p>Les dimensions retenues distinguent redistribution, organisation de l’économie, travail, budget, autonomie personnelle, libertés, immigration, intégration, expression religieuse, méthodes antidiscriminatoires, écologie, Europe, commerce, alliances, effort de défense, soutien à un pays agressé, contre-pouvoirs, exécutif, participation et territoires. Elles peuvent être corrélées ; leur indépendance statistique n’est pas démontrée.</p>
 <h2>${PER_AXIS} propositions par axe</h2><p>Chaque axe comporte ${PER_AXIS/2} propositions dont l’accord conduit vers le pôle 0 et ${PER_AXIS/2} dont l’accord conduit vers le pôle 10. Les ${DEGREES} réponses sont codées −2, −1, 0, +1, +2. « Je ne sais pas » est exclu du calcul, jamais remplacé par une valeur neutre.</p><div class="formula">score d’une réponse = 5 + 2,5 × orientation × accord<br>score de l’axe = moyenne des réponses de fond</div><p style="margin-top:15px">L’orientation vaut −1 ou +1 selon la proposition. Il faut 2 réponses de fond au minimum pour afficher un axe. Les scores sont affichés à une décimale pour rendre le calcul lisible ; cette précision n’est pas une mesure de certitude.</p><p>Une moyenne proche de 5 peut traduire des réponses neutres ou des arbitrages opposés. Un signal « Réponses contrastées » apparaît lorsque l’écart entre deux contributions d’un axe atteint 7,5 points. Ce signal invite à relire les réponses ; il ne signifie pas une incohérence.</p>
 <h2>Une lecture globale à deux niveaux</h2><p>La petite carte à deux dimensions projette la moyenne de redistribution, économie et travail sur l’axe horizontal, et la moyenne d’autonomie personnelle, immigration et intégration sur l’axe vertical. Chaque coordonnée demande 2 axes renseignés sur 3. Cette projection est volontairement partielle. Chaque coordonnée est décrite en trois tranches : moins de 3,5, de 3,5 à 6,5, plus de 6,5. Les familles d’idées y sont placées avec la même règle à partir de leurs repères ; celles qui ne définissent pas 2 des 3 axes d’une coordonnée n’apparaissent pas.</p><p>La synthèse compare aussi votre profil à ${familyCount} familles d’idées. Leurs coordonnées sont des choix éditoriaux explicites, inspirés de textes doctrinaux et de programmes consultés, pas des données d’enquête sur les partis. Quand ces textes ne traitent pas un sujet, des déclarations publiques datées de leurs responsables, citées mot pour mot, servent de repère provisoire en attendant les programmes de 2027 ; elles sont signalées comme telles. Certaines coordonnées restent indéfinies pour ne pas inventer une doctrine commune sur tous les sujets. Les repères des familles peuvent évoluer d’une version à l’autre : les modifier ne change ni vos réponses ni vos scores, et des réponses exportées restent importables.</p><div class="formula">écart = Σ (importance × |votre score − repère|) / Σ importance</div><p style="margin-top:15px">Seuls les axes renseignés des deux côtés sont comparés. Importance : secondaire = 1, important = 2, déterminant = 3. Les priorités modifient les proximités, jamais les scores de vos axes. Le nombre d’axes comparés est affiché pour chaque famille : les profils n’ayant pas le même périmètre, leur classement reste indicatif.</p><p>Il faut au moins ${MIN_COMMON_AXES} axes communs pour afficher une comparaison. La synthèse globale exige ${MIN_SYNTHESIS_AXES} axes mesurés et les deux coordonnées de projection. Deux écarts distants de moins de 0,35 point sont présentés ensemble ; si le meilleur écart dépasse 3 points, le résultat est « Profil transversal ». Ces seuils sont des conventions de cette version, sans calibration statistique.</p>
 <h2>Des scores traduits en phrases</h2><p>Le bilan décrit chaque axe selon sa distance au milieu de l’échelle (5). À plus de ${READING.strong} points du milieu : préférence nette pour le pôle le plus proche. De plus de ${READING.middle} à ${READING.strong} points : préférence modérée. À ${READING.middle} point ou moins : avis partagés si au moins une réponse va vers chaque pôle, position intermédiaire sinon. Les positions les plus marquées regroupent d’abord les préférences nettes, puis les préférences modérées ; dans chaque groupe, les sujets jugés déterminants passent en premier.</p><p>Pour les familles, deux écarts moyens distants de moins de ${fmtExact(READING.tie)} point sont présentés à égalité ; de ${fmtExact(READING.tie)} à moins de ${READING.clear} point, la première famille arrive en tête de peu ; à partir de ${READING.clear} point, elle se détache nettement. Sur un axe, un accord correspond à ${READING.agree} point d’écart au plus avec le repère, un écart net à plus de ${READING.diverge} points. Sur l’échelle des proximités, un écart moyen d’au plus ${READING.agree} point est qualifié de très proche, d’au plus ${READING.diverge} points de proche, d’au plus ${READING.transversal} points de plutôt éloigné, et d’éloigné au-delà. Ces seuils de lecture sont des conventions de cette version, sans calibration statistique ; ils ne modifient aucun score.</p>
 ${familiesAndParties()}
 <h2>Ce que signifie un score extrême</h2><p>Chaque axe est tracé comme une ligne qui va de son pôle 0 à son pôle 10, avec le milieu de l’échelle marqué. Les pôles sont propres à chaque axe : il n’existe pas de sens « gauche vers droite » commun aux ${AXES_N} lignes. Un score extrême sur un axe ne suffit pas à attribuer l’étiquette d’extrême gauche ou d’extrême droite. La position sur les contre-pouvoirs reste décrite séparément des orientations économiques et culturelles.</p>
 <h2>Un outil indicatif, encore à éprouver</h2><p>Les ${QUESTIONS_N} propositions sont originales. Elles n’ont pas fait l’objet d’un étalonnage représentatif, d’une analyse factorielle, ni d’une validation de fidélité ou de biais. Certains sujets peuvent être consensuels et certaines formulations sensibles au contexte. Les références académiques justifient l’intérêt de plusieurs dimensions ; elles ne valident pas ce questionnaire.</p><p>Les thèses citées sous chaque axe éclairent ses deux pôles ; elles ne valident pas la mesure. Un auteur cité à un pôle d’un axe peut se trouver à l’autre pôle d’un autre axe, et aucune réponse ne lui est imputée.</p><p>L’outil a été élaboré avec l’aide d’une intelligence artificielle. Les choix éditoriaux relèvent de l’éditeur, qui les a validés, et les citations ont été vérifiées mot pour mot sur leurs sources archivées. Le bilan est calculé dans votre navigateur par un programme fixe : aucune IA n’intervient dans ce calcul ni ne reçoit vos réponses.</p>
 <h2>Une aide au choix, sans consigne de vote</h2><p>Le site est indépendant : il n’a de lien ni avec les pouvoirs publics, ni avec les autorités électorales, ni avec les partis. L’outil compare vos réponses à ${familyCount} familles d’idées, pas à des candidats. Il ne recommande aucun vote, n’affiche aucun pourcentage de compatibilité et ne publie aucune statistique sur les réponses.</p>
 <h2>Vos réponses restent sur cet appareil</h2><p>L’application ne demande ni nom ni adresse électronique. Les réponses sont calculées et conservées dans le stockage local de votre navigateur. Aucun service d’analyse, de publicité ou d’IA ne reçoit les réponses. Le site est hébergé ; cette promesse concerne les réponses au questionnaire, pas les journaux techniques ordinaires de son hébergement.</p><p>Vous pouvez exporter vos réponses dans un fichier JSON, le réimporter sur un autre navigateur, imprimer le résultat ou supprimer vos réponses. Effacer les données du navigateur supprime aussi les réponses enregistrées.</p><div class="actions"><button class="btn" data-action="export-session">Exporter mes réponses ↓</button><button class="btn" data-action="import">Importer mes réponses</button><button class="btn danger" data-action="reset">Effacer mes réponses</button></div>
 <h2>Les sources</h2>${D.references.methods.map(s=>`<a class="source-link" href="${url(s.url)}" target="_blank" rel="noopener noreferrer">${e(s.title)} · ${s.year} ↗<small>${e(s.summary)}</small></a>`).join('')}<p style="margin-top:20px">Les valeurs chiffrées de chaque famille sont consultables dans « Bilan → Proximités → Examiner les repères chiffrés », et leurs textes de référence dans la section « Familles et partis ». Ces textes sont des repères de lecture, pas une validation des coordonnées choisies.</p>${authorsIndex()}
 </article></div>`;}
function render({focus=true}={}){nav();const r=route();root.innerHTML=r==='questionnaire'?questionnaire():r==='resultats'?result():r==='methode'?method():r==='reponses'?review():home();if(focus)focusMain();orbitMount();}
function exportSession(){const profile=computeProfile(axes,state.answers);const payload={...state,exportedAt:new Date().toISOString(),edition:D.edition,axes:axes.map(a=>({id:a.id,name:a.name,low:a.low,high:a.high,...profile.find(s=>s.id===a.id)})),questionnaire:questions.map(q=>({id:q.id,axis:q.axis,text:q.text,direction:q.direction})),comparison:{usePriorities,modelVersion:METHOD_VERSION,familiesVersion:D.familiesVersion,results:compareFamilies(profile,D.families,state.priorities,usePriorities).map(f=>({id:f.id,name:f.name,distance:f.distance,comparedAxes:f.common.length}))}};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),href=URL.createObjectURL(blob),a=document.createElement('a');a.href=href;a.download='presidentielle-2027-reponses.json';a.click();setTimeout(()=>URL.revokeObjectURL(href),500);toast('Vos réponses ont été exportées.');}
function importSession(){const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.addEventListener('change',async()=>{const f=input.files?.[0];if(!f)return;if(f.size>1000000){toast('Ce fichier est trop volumineux.');return;}try{const next=sanitizeSession(JSON.parse(await f.text()),axes);if(completed()&&!confirm('Remplacer les réponses présentes dans ce navigateur par celles de ce fichier ?'))return;state=next;usePriorities=state.usePriorities;persist();go('accueil');toast('Réponses importées. Vous pouvez reprendre votre parcours.');}catch(err){toast('Import impossible : fichier ou version de questionnaire incompatible.');}});input.click();}
function setAnswer(v){const q=questions[state.cursor];if(!isAnswer(v))return;state.answers[q.id]=v;persist();render({focus:false});const selected=root.querySelector('.answer.selected');selected?.focus({preventScroll:true});}
function next(){if(!isAnswer(state.answers[questions[state.cursor].id]))return;if(state.cursor<QUESTIONS_N-1){state.cursor++;persist();render();}else{persist();go(completed()===QUESTIONS_N?'resultats':'reponses');}}
document.addEventListener('click',ev=>{const target=ev.target.closest('[data-action]');if(!target||target.disabled)return;ev.preventDefault();const action=target.dataset.action;
 if(action==='start'||action==='resume'){const i=questions.findIndex(q=>!isAnswer(state.answers[q.id]));state.cursor=i<0?0:i;persist();go('questionnaire');}
 if(action==='reset'){if(!completed()||confirm('Effacer les réponses et les priorités conservées dans ce navigateur ?')){state=fresh();persist();go('accueil');toast('Les réponses ont été effacées.');}}
 if(action==='answer')setAnswer(target.dataset.value==='skip'?'skip':Number(target.dataset.value));
 if(action==='next')next();
 if(action==='prev'&&state.cursor>0){state.cursor--;persist();render();}
 if(action==='priority'){const {axis,value}=target.dataset;state.priorities[axis]=Number(value);persist();render({focus:false});root.querySelector(`[data-action="priority"][data-axis="${axis}"][data-value="${value}"]`)?.focus({preventScroll:true});}
 if(action==='jump'){const a=byAxis[target.dataset.axis];const q=a.questions.find(q=>!isAnswer(state.answers[q.id]))??a.questions[0];state.cursor=questions.indexOf(q);persist();go('questionnaire');}
 if(action==='edit-question'){state.cursor=questions.findIndex(q=>q.id===target.dataset.question);persist();go('questionnaire');}
 if(action==='results-tab'){resultsTab=target.dataset.tab;render({focus:false});}
 if(action==='family-focus'){const card=document.getElementById('famille-'+target.dataset.family);if(card){card.open=true;card.scrollIntoView({block:'start'});card.querySelector('summary')?.focus({preventScroll:true});}}
 if(action==='open-axis'){const id=target.dataset.axis;openAxes.add(id);resultsTab='axes';render({focus:false});const row=document.getElementById('axe-'+id);if(row){row.scrollIntoView({block:'start'});row.querySelector('summary')?.focus({preventScroll:true});}}
 if(action==='method-section'){const id=target.dataset.section;go('methode');setTimeout(()=>document.getElementById(id)?.scrollIntoView({block:'start'}),60);}
 if(action==='orbit-select'){orbitPlay(false);orbitSelect(target.dataset.family);}
 if(action==='orbit-play'){if(!orbit.playing){const ids=orbitRanking().ranked.map(x=>x.id);if(ids.indexOf(orbit.selected)>=ids.length-1)orbitSelect(ids[0]);}orbitPlay(!orbit.playing);}
 if(action==='orbit-prev')orbitStep(-1);
 if(action==='orbit-next')orbitStep(1);
 if(action==='orbit-replay'){orbit.introDone=false;orbit.last={};orbitPlay(false);render({focus:false});}
 if(action==='export-session')exportSession();
 if(action==='import')importSession();
 if(action==='print'){if(route()!=='resultats'){go('resultats');setTimeout(()=>{preparePrint();window.print();},150);}else{preparePrint();window.print();}}
});
document.addEventListener('change',ev=>{if(ev.target.id==='use-priorities'){usePriorities=ev.target.checked;state.usePriorities=usePriorities;persist();render({focus:false});}});
document.addEventListener('keydown',ev=>{if(route()!=='questionnaire'||ev.altKey||ev.ctrlKey||ev.metaKey||['INPUT','TEXTAREA','SELECT'].includes(ev.target.tagName))return;if(/^[1-6]$/.test(ev.key)){ev.preventDefault();setAnswer(choices[Number(ev.key)-1].value);}if(ev.key==='Enter'&&(ev.target===root||ev.target.closest('.answer'))){ev.preventDefault();next();}});
document.addEventListener('change',ev=>{if(ev.target.id==='compare-family'){compareFamily=ev.target.value;render({focus:false});document.getElementById('compare-family')?.focus();}});
// Familles de la cible : Entrée ou Espace sélectionne, comme pour un bouton.
document.addEventListener('keydown',ev=>{const g=ev.target.closest?.('.orb-fam');if(g&&(ev.key==='Enter'||ev.key===' ')){ev.preventDefault();orbitPlay(false);orbitSelect(g.dataset.family);}});
// Mémorise les axes ouverts pour qu'un nouveau rendu (réglage d'importance, comparaison) les laisse ouverts.
document.addEventListener('toggle',ev=>{const d=ev.target;if(d?.classList?.contains('axis-row')){if(d.open)openAxes.add(d.dataset.axis);else openAxes.delete(d.dataset.axis);}},true);
window.addEventListener('hashchange',()=>render());
window.addEventListener('beforeprint',preparePrint);
window.addEventListener('afterprint',endPrint);
render();
