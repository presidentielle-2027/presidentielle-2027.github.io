import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {METHOD_VERSION,COMPATIBLE_METHODS,READING,computeProfile,compareFamilies,globalCoordinates,interpretation,axisReading,proximity,familyContrast,findings,familyCoordinates,coordinateReading,sanitizeSession} from '../dist/engine.mjs';
const axes=JSON.parse(fs.readFileSync(new URL('../research/questionnaire.json',import.meta.url))).axes;
const families=JSON.parse(fs.readFileSync(new URL('../research/families.json',import.meta.url))).families;
const responsesFor=(scoreFn)=>Object.fromEntries(axes.flatMap(a=>a.questions.map(q=>[q.id,Math.max(-2,Math.min(2,Math.round((scoreFn(a.id)-5)/2.5/q.direction)))])));

test('A missing or skipped opinion cannot become a middle score',()=>{
 for(const answers of [{},Object.fromEntries(axes.flatMap(a=>a.questions.map(q=>[q.id,'skip'])))]){
  const p=computeProfile(axes,answers);assert.ok(p.every(a=>a.score===null));assert.equal(globalCoordinates(p).economic,null);assert.equal(interpretation(p,compareFamilies(p,families)).ready,false);
 }
 const a=axes[0];const p=computeProfile(axes,{[a.questions[0].id]:0});assert.equal(p[0].score,null);assert.equal(p[0].provisional,5);
});
test('Opposite wording produces identical endpoint convictions',()=>{
 const lo=computeProfile(axes,responsesFor(()=>0)),hi=computeProfile(axes,responsesFor(()=>10));
 assert.ok(lo.every(a=>a.score===0&&a.valid===4));assert.ok(hi.every(a=>a.score===10&&a.valid===4));
});
test('Contrast is not erased by a numerical middle',()=>{
 const p=computeProfile(axes,Object.fromEntries(axes.flatMap(a=>a.questions.map(q=>[q.id,2]))));
 assert.ok(p.every(a=>a.score===5&&a.contrast));
 const neutral=computeProfile(axes,Object.fromEntries(axes.flatMap(a=>a.questions.map(q=>[q.id,0]))));assert.ok(neutral.every(a=>a.score===5&&!a.contrast));
});
test('An economically collective and culturally conservative profile stays crossed',()=>{
 const p=computeProfile(axes,responsesFor(id=>['redistribution','economy','work'].includes(id)?0:['society','immigration','integration'].includes(id)?10:5));
 assert.deepEqual(globalCoordinates(p),{economic:0,cultural:10});const out=interpretation(p,compareFamilies(p,families));assert.equal(out.ready,true);assert.equal(out.eco,'économie redistributive et collective');assert.equal(out.culture,'valeurs culturelles conservatrices');
});
test('Priorities affect affinities but never axis scores',()=>{
 const p=computeProfile(axes,responsesFor(()=>5));const before=JSON.stringify(p);
 const a=compareFamilies(p,families,{},false),b=compareFamilies(p,families,{society:3,redistribution:1,work:1},true);
 assert.equal(JSON.stringify(p),before);assert.notEqual(JSON.stringify(a.map(f=>f.distance)),JSON.stringify(b.map(f=>f.distance)));
});
test('Reference profiles do not silently assign missing dimensions',()=>{
 const p=computeProfile(axes,responsesFor(()=>5));for(const f of compareFamilies(p,families))assert.equal(f.common.length,Object.keys(f.positions).length);
});
test('Each deliberately distinct family is recoverable from its exact coordinate profile',()=>{
 for(const family of families){const p=axes.map(a=>({id:a.id,score:family.positions[a.id]??null}));const ranked=compareFamilies(p,families);const exact=ranked.find(f=>f.id===family.id);assert.equal(exact.distance,0);assert.equal(ranked[0].distance,0);}
});
test('Imports enforce version, known identifiers, values, priorities and cursor bounds',()=>{
 assert.throws(()=>sanitizeSession({methodVersion:'other'},axes));const s=sanitizeSession({methodVersion:METHOD_VERSION,answers:{q01:2,q02:3,q03:'skip',foreign:2},priorities:{redistribution:3,work:9},cursor:999},axes);assert.deepEqual(s.answers,{q01:2,q03:'skip'});assert.deepEqual(s.priorities,{redistribution:3});assert.equal(s.cursor,axes.flatMap(a=>a.questions).length-1);
});
test('A session from a compatible earlier method keeps its answers and resumes at the first open proposition',()=>{
 const all=axes.flatMap(a=>a.questions);
 const answers=Object.fromEntries(all.filter(q=>!['military','assistance'].includes(q.axis)).map(q=>[q.id,1]));
 for(const version of COMPATIBLE_METHODS){
  const s=sanitizeSession({methodVersion:version,answers,cursor:71},axes);
  assert.equal(s.methodVersion,METHOD_VERSION);assert.deepEqual(s.answers,answers);
  assert.equal(s.cursor,all.findIndex(q=>q.axis==='military'));
 }
});
test('A saved comparison preference survives export and import',()=>{
 assert.equal(sanitizeSession({methodVersion:METHOD_VERSION,usePriorities:false},axes).usePriorities,false);
 assert.equal(sanitizeSession({methodVersion:METHOD_VERSION,comparison:{usePriorities:false}},axes).usePriorities,false);
});

test('An axis reading follows the distance to the middle of the scale',()=>{
 const axis=axes[0];
 assert.equal(axisReading(axis,{score:null}).kind,'unmeasured');
 assert.equal(axisReading(axis,null).kind,'unmeasured');
 const strong=axisReading(axis,1.9);assert.equal(strong.kind,'strong');assert.equal(strong.pole,'low');assert.match(strong.text,new RegExp(`nette pour «\\u00a0${axis.low}\\u00a0»`));
 assert.equal(axisReading(axis,2).kind,'moderate');assert.equal(axisReading(axis,8).kind,'moderate');assert.equal(axisReading(axis,8.1).pole,'high');
 assert.equal(axisReading(axis,4).kind,'middle');assert.equal(axisReading(axis,6).kind,'middle');assert.equal(axisReading(axis,3.9).kind,'moderate');
});
test('A middle score separates neutral answers from answers pulling both ways',()=>{
 const neutral=computeProfile(axes,Object.fromEntries(axes.flatMap(a=>a.questions.map(q=>[q.id,0]))));
 const opposed=computeProfile(axes,Object.fromEntries(axes.flatMap(a=>a.questions.map(q=>[q.id,2]))));
 assert.ok(axes.every((a,i)=>axisReading(a,neutral[i]).kind==='middle'));
 assert.ok(axes.every((a,i)=>axisReading(a,opposed[i]).kind==='split'));
 const contrasted={score:6.25,contrast:true,contributions:[10,10,2.5,2.5].map(value=>({value}))};
 const r=axisReading(axes[0],contrasted);assert.equal(r.kind,'moderate');assert.match(r.text,/réponses contrastées/);
});
test('Marked positions list clear preferences first and let decisive topics lead within a group',()=>{
 const strongIds=axes.slice(0,6).map(a=>a.id),moderateId=axes[6].id;
 const p=computeProfile(axes,responsesFor(id=>strongIds.includes(id)?0:id===moderateId?2.5:5));
 const out=findings(axes,p,{[strongIds[5]]:3,[moderateId]:3});
 assert.equal(out.marked.length,4);assert.equal(out.marked[0].id,strongIds[5]);
 assert.ok(out.marked.every(x=>x.reading.kind==='strong'));assert.equal(out.moreStrong,2);
 assert.equal(out.middle.length,axes.length-7);assert.deepEqual(out.split,[]);assert.deepEqual(out.unmeasured,[]);
 assert.equal(findings(axes,computeProfile(axes,{})).unmeasured.length,axes.length);
});
test('The closest family is qualified by its lead over the next one',()=>{
 const fam=(id,distance,common=[])=>({id,name:id,distance,common});const level=(...d)=>findings(axes,[],{},d.map((x,i)=>fam('f'+i,x)),[],true).family.level;
 assert.equal(level(1,1.2),'tied');assert.equal(level(1,1.5),'slight');assert.equal(level(1,2),'clear');assert.equal(level(3.2,3.3),'transversal');assert.equal(level(1),'only');
 assert.equal(findings(axes,[],{},[fam('a',1),fam('b',1.2),fam('c',1.3),fam('d',2)],[],true).family.tied.length,2);
 assert.equal(findings(axes,[],{},[fam('a',1)],[],false).family,null);
 assert.equal(READING.tie,.35);
});
test('Agreements and divergences with the closest family use per-axis gaps',()=>{
 const common=[[0.5,'a'],[1,'b'],[1.5,'c'],[2,'d'],[2.5,'e'],[4,'f']].map(([g,id])=>({id,score:5,target:5+g,weight:2}));
 const out=findings(axes,[],{redistribution:3},[{id:'x',name:'X',distance:1.9,common}],[{id:'y',name:'Y'}],true).family;
 assert.deepEqual(out.agreements.map(x=>x.id),['a','b']);assert.deepEqual(out.divergences.map(x=>x.id),['f','e']);
 assert.equal(out.prioritiesSet,true);assert.equal(out.alternativeLeader.id,'y');
 assert.equal(findings(axes,[],{redistribution:2},[{id:'x',name:'X',distance:1,common}],[],true).family.prioritiesSet,false);
});
test('Family proximity labels reuse the agreement, divergence and transversal thresholds',()=>{
 assert.deepEqual([0,1,1.01,2,2.01,3,3.01,10].map(d=>proximity(d).level),['very-close','very-close','close','close','rather-far','rather-far','far','far']);
 const p=computeProfile(axes,responsesFor(()=>5));const ranked=compareFamilies(p,families);
 const out=findings(axes,p,{},ranked,[],true).family;assert.deepEqual(familyContrast(ranked[0]),{agreements:out.agreements,divergences:out.divergences});
});
test('Families are placed on the two-dimension map only where their reference points define both coordinates',()=>{
 const placed=families.filter(f=>{const c=familyCoordinates(f);return c.economic!==null&&c.cultural!==null;});
 assert.equal(placed.length,8);
 for(const f of families){const c=familyCoordinates(f),p=axes.map(a=>({id:a.id,score:f.positions[a.id]??null}));assert.deepEqual(c,globalCoordinates(p));}
 assert.deepEqual(coordinateReading({economic:3.4,cultural:6.6}),{eco:'économie redistributive et collective',culture:'valeurs culturelles conservatrices'});
 assert.deepEqual(coordinateReading({economic:5,cultural:null}),{eco:'économie mixte',culture:null});
});
