const identity=await (await fetch('../pibbl-big-bubbles/source/identity.json')).json();
const paths=['M0 0H128L0 140Z','M0 0H124V140H0Z','M0 0H20C64 0 100 31 100 70C100 109 64 140 20 140H0Z'];
const colors=['coral','green','violet'].map(k=>identity.palette[k]);
const p=(x,y,r=0)=>({x,y,r});
const poses=[
 {name:'Meet on the floor',contact:'Three independent pieces, one shared floor.',parts:[p(35,390,-90),p(183,250),p(342,250)],enter:'Each arrives with its own weight: triangle lands on its short flat, rectangle plants itself, violet rocks to rest.',exit:'Violet tips onto its curved edge and offers its flat face as a platform.'},
 {name:'The lookout',contact:'Violet rests flat-side down; coral balances on its curved crown.',parts:[p(193.333333,150,-90),p(170,250),p(170,250,-90)],enter:'Violet lands flat-side down on green. Coral balances over violet’s curved crown. A deliberately precarious perch.',exit:'Coral hops off first. Violet rolls toward the edge, and green catches it.'},
 {name:'The cradle',contact:'Green rests on violet’s broad flat; violet balances on its curve.',parts:[p(22,390,-90),p(178,150),p(310,290,90)],enter:'Violet rolls a quarter-turn. Green settles onto the platform and makes it rock.',exit:'The pair sticks together and rolls; coral follows on foot.'},
 {name:'The magnetic ride',contact:'A full green edge meets violet’s full flat edge.',parts:[p(32,390,-90),p(-124,-70),p(0,-70)],assembly:{indices:[1,2],rotation:32,center:[290,285]},enter:'Green docks against violet. Their contact stays fixed while the pair turns on violet’s curved edge.',exit:'Green releases near the top of the roll and lands on a flat. Violet keeps rocking.'},
 {name:'The tipping point',contact:'The same cradle, leaning as one connected pair.',parts:[p(28,390,-90),p(-62,-210),p(70,-70,90)],assembly:{indices:[1,2],rotation:-22,center:[285,280]},enter:'Coral approaches. Green leans toward it, taking violet just past balance.',exit:'A pause at the tipping point, then a quicker rock back. Green lifts off as the platform tilts.'},
 {name:'The ramp',contact:'Green’s lower edge sits exactly along coral’s diagonal.',parts:[p(303,390,180),p(97.275966319682,267.532312063709,-47.563770211),p(354,250)],enter:'Coral braces on the floor. Green lands edge-first on the slope and slides down it.',exit:'Green reaches the bottom and nudges violet into a roll. Coral recoils from the load.'},
 {name:'Almost P',contact:'The approved P geometry, before any bubble release.',parts:[p(117,110),p(117,250),p(245,110)],enter:'Green becomes the anchor. Coral settles onto its upper-left corner; violet docks alongside coral.',exit:'Hold for a beat, then let the bubbles escape. This is the ready state, not another loading trick.'},
 {name:'The bridge',contact:'Green spans coral’s upper point and violet’s short flat shoulder.',parts:[p(198,390,180),p(165,250,-90),p(290,250)],enter:'Coral stays planted. Violet stands opposite it. Green falls across coral’s upper point and violet’s short flat shoulder.',exit:'Violet rolls away, removing one support. Green pivots on coral’s corner before landing.'},
];
// Ground connected assemblies from their actual transformed outlines, not their centers.
function outline(i){if(i===0)return [[0,0],[128,0],[0,140]];if(i===1)return [[0,0],[124,0],[124,140],[0,140]];const pts=[[0,0],[20,0],[0,140]];for(const q of [[[20,0],[64,0],[100,31],[100,70]],[[100,70],[100,109],[64,140],[20,140]]])for(let n=0;n<=500;n++){const t=n/500,u=1-t;pts.push([0,1].map(k=>u*u*u*q[0][k]+3*u*u*t*q[1][k]+3*u*t*t*q[2][k]+t*t*t*q[3][k]));}return pts;}
const rotate=([x,y],r)=>{const a=r*Math.PI/180;return [x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)];};
const world=(pt,part)=>{const [x,y]=rotate(pt,part.r);return [x+part.x,y+part.y];};
const ns='http://www.w3.org/2000/svg';
function node(name,attrs,parent){const el=document.createElementNS(ns,name);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);parent.append(el);return el;}
poses.forEach((pose,n)=>{
 const card=document.createElement('article');card.className='card';document.querySelector('#board').append(card);
 const svg=node('svg',{viewBox:'0 0 480 440',role:'img','aria-label':pose.name},card);
 node('line',{x1:25,x2:455,y1:390,y2:390,stroke:'#d8dfd4','stroke-width':1,'stroke-dasharray':'4 6'},svg);
 let parent=svg;
 if(pose.assembly){const a=pose.assembly;const ymax=Math.max(...a.indices.flatMap(i=>outline(i).map(pt=>rotate(world(pt,pose.parts[i]),a.rotation)[1])));parent=node('g',{transform:`translate(${a.center[0]} ${390-ymax}) rotate(${a.rotation})`},svg);}
 pose.parts.forEach((part,i)=>node('path',{d:paths[i],fill:colors[i],transform:`translate(${part.x} ${part.y}) rotate(${part.r})`},pose.assembly?.indices.includes(i)?parent:svg));
 const copy=document.createElement('div');copy.className='copy';copy.innerHTML=`<span class="number">POSE ${String(n+1).padStart(2,'0')}</span><h2>${pose.name}</h2><p class="contact">${pose.contact}</p><p><strong>Into it:</strong> ${pose.enter}</p><p><strong>Out of it:</strong> ${pose.exit}</p>`;card.append(copy);
});
