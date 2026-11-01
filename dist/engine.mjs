export const METHOD_VERSION='reperes-fr-2026.2';
// Versions antérieures dont les propositions sont reprises à l'identique : leurs sessions restent importables,
// les propositions ajoutées depuis restent simplement sans réponse.
export const COMPATIBLE_METHODS=['reperes-fr-2026.1'];
export const isAnswer=v=>[-2,-1,0,1,2,'skip'].includes(v);
export const mean=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
export function computeProfile(axes,answers={}){
 return axes.map(axis=>{
  const contributions=axis.questions.flatMap(q=>typeof answers[q.id]==='number'&&isAnswer(answers[q.id])?[{id:q.id,value:5+2.5*q.direction*answers[q.id]}]:[]);
  const values=contributions.map(x=>x.value);const value=mean(values);
  return {id:axis.id,score:values.length>=2?value:null,provisional:values.length===1?value:null,valid:values.length,completed:axis.questions.filter(q=>isAnswer(answers[q.id])).length,skipped:axis.questions.filter(q=>answers[q.id]==='skip').length,spread:values.length?Math.sqrt(mean(values.map(v=>(v-value)**2))):null,contrast:values.length>=2&&Math.max(...values)-Math.min(...values)>=7.5,contributions};
 });
}
// Nombre minimal d'axes mesurés de part et d'autre pour comparer une famille à un profil.
export const MIN_COMMON_AXES=6;
export function compareFamilies(profile,families,priorities={},usePriorities=true){
 const map=Object.fromEntries(profile.map(s=>[s.id,s]));
 return families.map(f=>{
  const common=Object.entries(f.positions).flatMap(([id,target])=>map[id]?.score!==null&&map[id]?.score!==undefined&&typeof target==='number'?[{id,target,score:map[id].score,weight:usePriorities?(priorities[id]??2):1}]:[]);
  const weight=common.reduce((s,x)=>s+x.weight,0);const distance=weight?common.reduce((s,x)=>s+Math.abs(x.score-x.target)*x.weight,0)/weight:null;
  return {...f,distance,common,coverage:common.length/Object.keys(f.positions).length};
 }).filter(f=>f.common.length>=MIN_COMMON_AXES).sort((a,b)=>a.distance-b.distance);
}
export function globalCoordinates(profile){
 const map=Object.fromEntries(profile.map(s=>[s.id,s.score]));
 const coords=ids=>{const xs=ids.map(id=>map[id]).filter(x=>typeof x==='number');return xs.length>=2?mean(xs):null};
 return {economic:coords(['redistribution','economy','work']),cultural:coords(['society','immigration','integration'])};
}
// Place une famille sur la carte à deux dimensions avec la même règle que le profil : null si ses repères ne suffisent pas.
export function familyCoordinates(family){return globalCoordinates(Object.entries(family.positions).map(([id,score])=>({id,score})));}
// Décrit chaque coordonnée en trois tranches : moins de 3,5, de 3,5 à 6,5, plus de 6,5.
export function coordinateReading(c){
 return {eco:c.economic===null?null:c.economic<3.5?'économie redistributive et collective':c.economic>6.5?'économie de marché':'économie mixte',
  culture:c.cultural===null?null:c.cultural<3.5?'valeurs culturelles ouvertes':c.cultural>6.5?'valeurs culturelles conservatrices':'positions culturelles intermédiaires'};
}
export function interpretation(profile,ranked){
 const map=Object.fromEntries(profile.map(s=>[s.id,s]));const measured=profile.filter(s=>s.score!==null).length;const c=globalCoordinates(profile);
 if(measured<12||c.economic===null||c.cultural===null||!ranked.length)return {ready:false,title:'Un bilan encore incomplet',description:'Il faut au moins 12 axes renseignés, dont deux en économie et deux sur les valeurs culturelles, pour proposer une lecture globale.',measured};
 const first=ranked[0],second=ranked[1];
 const mixed=first.distance>READING.transversal;const tied=!!second&&second.distance-first.distance<READING.tie;
 const {eco,culture}=coordinateReading(c);
 return {ready:true,measured,title:mixed?'Un profil transversal':tied?`${first.name} / ${second.name}`:first.name,description:mixed?'Vos réponses se combinent sans correspondre nettement à l’un des profils de référence. Aucun courant ne se détache : les axes détaillés et vos priorités feront la différence.':tied?'Deux familles présentent des écarts proches avec vos réponses. Cette synthèse conserve cette proximité plutôt que de forcer un choix.':'C’est la famille de référence dont les positions sont les moins éloignées de vos réponses, parmi les dix profils modélisés.',eco,culture,mixed,tied,first,second,checks:map.checks?.score};
}
// Seuils de lecture du bilan : conventions éditoriales de cette version, sans calibration statistique.
// strong et middle sont des distances au milieu de l'axe (5) ; tie, clear et transversal portent sur les écarts moyens
// aux familles ; agree et diverge sur l'écart entre un score et un repère, axe par axe.
export const READING={strong:3,middle:1,tie:.35,clear:1,transversal:3,agree:1,diverge:2};
// Traduit un score d'axe en phrase. `s` est une entrée de computeProfile, ou un nombre pour un repère de famille.
// Au milieu de l'axe, « avis partagés » (au moins une réponse vers chaque pôle) se distingue d'une position intermédiaire.
export function axisReading(axis,s){
 const score=typeof s==='number'?s:s?.score;
 if(typeof score!=='number')return {kind:'unmeasured',pole:null,contrast:false,text:'Non mesuré : moins de deux réponses de fond',short:'non mesuré'};
 const values=typeof s==='object'?(s.contributions??[]).map(x=>x.value):[],contrast=typeof s==='object'&&!!s.contrast,d=Math.abs(score-5);
 if(d<=READING.middle)return values.some(v=>v<5)&&values.some(v=>v>5)
  ?{kind:'split',pole:null,contrast,text:`Avis partagés entre « ${axis.low} » et « ${axis.high} »`,short:'avis partagés'}
  :{kind:'middle',pole:null,contrast,text:`Position intermédiaire entre « ${axis.low} » et « ${axis.high} »`,short:'entre les deux pôles'};
 const strong=d>READING.strong,pole=score<5?axis.low:axis.high;
 return {kind:strong?'strong':'moderate',pole:score<5?'low':'high',contrast,text:`Préférence ${strong?'nette':'modérée'} pour « ${pole} »${contrast?', avec des réponses contrastées':''}`,short:`${strong?'nettement':'plutôt'} « ${pole} »`};
}
// Qualifie un écart moyen à une famille avec les seuils d'accord, d'écart net et de profil transversal.
export function proximity(distance){
 return distance<=READING.agree?{level:'very-close',label:'Très proche'}:distance<=READING.diverge?{level:'close',label:'Proche'}:distance<=READING.transversal?{level:'rather-far',label:'Plutôt éloigné'}:{level:'far',label:'Éloigné'};
}
// Axes communs les plus proches et les plus éloignés du repère d'une famille classée par compareFamilies().
export function familyContrast(family){
 const gaps=family.common.map(x=>({...x,gap:Math.abs(x.score-x.target)}));
 return {agreements:gaps.filter(x=>x.gap<=READING.agree).sort((a,b)=>a.gap-b.gap||b.weight-a.weight).slice(0,3),
  divergences:gaps.filter(x=>x.gap>READING.diverge).sort((a,b)=>b.gap-a.gap||b.weight-a.weight).slice(0,3)};
}
// Enseignements du bilan, sous forme de données : le texte final est composé par l'interface.
// `ranked` suit le réglage courant des priorités, `alternative` le réglage inverse ; `ready` reprend interpretation().ready.
export function findings(axes,profile,priorities={},ranked=[],alternative=[],ready=true){
 const map=Object.fromEntries(profile.map(s=>[s.id,s]));
 const read=axes.map(a=>({id:a.id,score:map[a.id]?.score??null,priority:priorities[a.id]??2,reading:axisReading(a,map[a.id])}));
 const pulled=read.filter(x=>x.reading.kind==='strong'||x.reading.kind==='moderate')
  .sort((x,y)=>(y.reading.kind==='strong')-(x.reading.kind==='strong')||y.priority-x.priority||Math.abs(y.score-5)-Math.abs(x.score-5));
 const marked=pulled.slice(0,4),moreStrong=Math.max(0,pulled.filter(x=>x.reading.kind==='strong').length-marked.length);
 const split=read.filter(x=>x.reading.kind==='split'||x.reading.contrast).map(x=>x.id);
 const middle=read.filter(x=>x.reading.kind==='middle').map(x=>x.id),unmeasured=read.filter(x=>x.reading.kind==='unmeasured').map(x=>x.id);
 let family=null;
 if(ready&&ranked.length){
  const [first,...rest]=ranked,next=rest[0]??null,gap=next?next.distance-first.distance:null;
  const level=first.distance>READING.transversal?'transversal':!next?'only':gap<READING.tie?'tied':gap<READING.clear?'slight':'clear';
  family={first,next,gap,level,
   tied:rest.filter(f=>f.distance-first.distance<READING.tie),
   ...familyContrast(first),
   prioritiesSet:Object.values(priorities).some(v=>v!==2),
   alternativeLeader:alternative[0]??null};
 }
 return {marked,moreStrong,split,middle,unmeasured,family};
}
export function sanitizeSession(raw,axes){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||![METHOD_VERSION,...COMPATIBLE_METHODS].includes(raw.methodVersion))throw new Error('Format ou version de questionnaire incompatible.');
 const ids=new Set(axes.flatMap(a=>a.questions.map(q=>q.id)));const axisIds=new Set(axes.map(a=>a.id));const answers={};const priorities={};
 for(const [id,v]of Object.entries(raw.answers??{})){if(ids.has(id)&&isAnswer(v))answers[id]=v;}
 for(const [id,v]of Object.entries(raw.priorities??{})){if(axisIds.has(id)&&[1,2,3].includes(v))priorities[id]=v;}
 const usePriorities=typeof raw.usePriorities==='boolean'?raw.usePriorities:typeof raw.comparison?.usePriorities==='boolean'?raw.comparison.usePriorities:true;
 // Une session d'une version antérieure reprend à la première proposition sans réponse : l'ordre des propositions a pu changer.
 const all=axes.flatMap(a=>a.questions),firstOpen=Math.max(0,all.findIndex(q=>!(q.id in answers)));
 return {methodVersion:METHOD_VERSION,answers,priorities,usePriorities,cursor:raw.methodVersion!==METHOD_VERSION?firstOpen:Number.isInteger(raw.cursor)?Math.max(0,Math.min(all.length-1,raw.cursor)):0};
}
