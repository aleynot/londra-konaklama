// Yedek tahmin motoru: Google rotası alınamazsa kullanılan sadeleştirilmiş Londra raylı sistem modeli (TfL 2026 ücretleri)
const ST = {
 "Highgate":[51.5777,-0.1458,3],"Archway":[51.5653,-0.1353,2],"Tufnell Park":[51.5567,-0.1374,2],"Kentish Town":[51.5503,-0.1404,2],
 "Hampstead":[51.5568,-0.1780,2],"Belsize Park":[51.5502,-0.1642,2],"Chalk Farm":[51.5442,-0.1538,2],"Camden Town":[51.5392,-0.1426,2],
 "Mornington Crescent":[51.5343,-0.1387,2],"Euston":[51.5282,-0.1337,1],"Warren Street":[51.5247,-0.1384,1],"Goodge Street":[51.5205,-0.1347,1],
 "Tottenham Court Road":[51.5165,-0.1310,1],"Leicester Square":[51.5113,-0.1281,1],"Charing Cross":[51.5080,-0.1247,1],"Embankment":[51.5074,-0.1223,1],
 "Waterloo":[51.5036,-0.1143,1],"Kennington":[51.4884,-0.1053,2],"Oval":[51.4819,-0.1126,2],"Stockwell":[51.4723,-0.1229,2],"Clapham North":[51.4649,-0.1299,2],
 "Clapham Common":[51.4618,-0.1384,2],"Clapham South":[51.4527,-0.1480,3],"Balham":[51.4431,-0.1525,3],"Tooting Bec":[51.4359,-0.1597,3],
 "Tooting Broadway":[51.4275,-0.1680,3],"Colliers Wood":[51.4180,-0.1781,3],"South Wimbledon":[51.4154,-0.1919,3],"Morden":[51.4022,-0.1948,4],
 "King's Cross St Pancras":[51.5308,-0.1238,1],"Angel":[51.5322,-0.1058,1],"Old Street":[51.5263,-0.0873,1],"Moorgate":[51.5186,-0.0886,1],
 "Bank":[51.5133,-0.0886,1],"London Bridge":[51.5052,-0.0864,1],"Borough":[51.5011,-0.0943,1],"Elephant & Castle":[51.4943,-0.1001,1],
 "Highbury & Islington":[51.5460,-0.1040,2],"Oxford Circus":[51.5152,-0.1415,1],"Green Park":[51.5067,-0.1428,1],"Victoria":[51.4965,-0.1447,1],
 "Pimlico":[51.4893,-0.1334,1],"Vauxhall":[51.4861,-0.1253,1],"Brixton":[51.4627,-0.1145,2],
 "North Acton":[51.5237,-0.2597,2],"East Acton":[51.5168,-0.2475,2],"White City":[51.5120,-0.2240,2],"Shepherd's Bush":[51.5046,-0.2187,2],
 "Holland Park":[51.5075,-0.2060,2],"Notting Hill Gate":[51.5094,-0.1967,1],"Queensway":[51.5107,-0.1871,1],"Lancaster Gate":[51.5119,-0.1756,1],
 "Marble Arch":[51.5136,-0.1586,1],"Bond Street":[51.5142,-0.1494,1],"Holborn":[51.5174,-0.1201,1],"Chancery Lane":[51.5185,-0.1111,1],
 "St Paul's":[51.5146,-0.0973,1],"Liverpool Street":[51.5178,-0.0823,1],"Bethnal Green":[51.5270,-0.0549,2],"Mile End":[51.5249,-0.0332,2],
 "Stratford":[51.5416,-0.0042,3],"Wembley Park":[51.5635,-0.2795,4],"Neasden":[51.5542,-0.2503,3],"Dollis Hill":[51.5520,-0.2386,3],
 "Willesden Green":[51.5492,-0.2215,2],"Kilburn":[51.5471,-0.2047,2],"West Hampstead":[51.5469,-0.1906,2],"Finchley Road":[51.5472,-0.1803,2],
 "Swiss Cottage":[51.5432,-0.1747,2],"St John's Wood":[51.5347,-0.1740,2],"Baker Street":[51.5226,-0.1571,1],"Westminster":[51.5010,-0.1254,1],
 "Southwark":[51.5038,-0.1052,1],"Bermondsey":[51.4979,-0.0637,2],"Canada Water":[51.4982,-0.0502,2],"Canary Wharf":[51.5035,-0.0191,2],
 "North Greenwich":[51.5005,0.0039,2],"Great Portland Street":[51.5238,-0.1439,1],"Euston Square":[51.5260,-0.1359,1],"Farringdon":[51.5203,-0.1053,1],
 "Barbican":[51.5204,-0.0979,1],"Aldgate":[51.5143,-0.0755,1],"Edgware Road":[51.5199,-0.1679,1],"Paddington":[51.5154,-0.1755,1],
 "Bayswater":[51.5121,-0.1879,1],"High Street Kensington":[51.5009,-0.1925,1],"Gloucester Road":[51.4945,-0.1829,1],"South Kensington":[51.4941,-0.1738,1],
 "Sloane Square":[51.4924,-0.1565,1],"St James's Park":[51.4994,-0.1335,1],"Temple":[51.5111,-0.1141,1],"Blackfriars":[51.5120,-0.1039,1],
 "Mansion House":[51.5122,-0.0940,1],"Cannon Street":[51.5113,-0.0904,1],"Monument":[51.5108,-0.0863,1],"Tower Hill":[51.5098,-0.0766,1],
 "Earl's Court":[51.4920,-0.1934,1],"West Brompton":[51.4872,-0.1953,2],"Fulham Broadway":[51.4804,-0.1950,2],"Parsons Green":[51.4753,-0.2011,2],
 "Putney Bridge":[51.4682,-0.2089,2],"East Putney":[51.4590,-0.2110,3],"Southfields":[51.4454,-0.2066,3],"Wimbledon Park":[51.4343,-0.1992,3],
 "Wimbledon":[51.4214,-0.2064,3],"Aldgate East":[51.5152,-0.0722,1],"Whitechapel":[51.5194,-0.0612,2],"Stepney Green":[51.5216,-0.0465,2],
 "Bow Road":[51.5269,-0.0247,2],"Holloway Road":[51.5526,-0.1132,2],"Arsenal":[51.5586,-0.1059,2],"Finsbury Park":[51.5642,-0.1065,2],"Manor House":[51.5712,-0.0958,2],"Turnpike Lane":[51.5904,-0.1028,3],"Wood Green":[51.5975,-0.1097,3],"Caledonian Road":[51.5481,-0.1188,2],"Russell Square":[51.5230,-0.1244,1],
 "Covent Garden":[51.5129,-0.1243,1],"Piccadilly Circus":[51.5098,-0.1342,1],"Hyde Park Corner":[51.5027,-0.1527,1],"Knightsbridge":[51.5015,-0.1607,1],
 "Marylebone":[51.5225,-0.1631,1],"Regent's Park":[51.5234,-0.1466,1],"Lambeth North":[51.4991,-0.1115,1],
 "Shadwell":[51.5112,-0.0569,2],"Limehouse":[51.5124,-0.0397,2],"Westferry":[51.5097,-0.0265,2],"Heron Quays":[51.5033,-0.0215,2],
 "South Quay":[51.5007,-0.0167,2],"Crossharbour":[51.4957,-0.0144,2],"Mudchute":[51.4907,-0.0147,2],"Island Gardens":[51.4876,-0.0101,2],
 "Cutty Sark":[51.4827,-0.0096,2],"Greenwich":[51.4781,-0.0149,2],"Deptford Bridge":[51.4740,-0.0216,2],"Elverson Road":[51.4693,-0.0174,2],
 "Lewisham":[51.4657,-0.0142,2],"Deptford":[51.4789,-0.0262,2],"Clapham Junction":[51.4642,-0.1703,2],"Earlsfield":[51.4423,-0.1877,3],
 "Herne Hill":[51.4533,-0.1023,2],"West Dulwich":[51.4407,-0.0913,3],"Sydenham Hill":[51.4327,-0.0805,3],"Penge East":[51.4192,-0.0541,4],
 "Kent House":[51.4122,-0.0451,4],"New Beckenham":[51.4168,-0.0353,4],"Lower Sydenham":[51.4248,-0.0335,4],"Catford Bridge":[51.4447,-0.0247,3],"Ladywell":[51.4561,-0.0189,3],"Beckenham Junction":[51.4110,-0.0259,4],"Kensington Olympia":[51.4977,-0.2104,2]
};
const N_N=["Highgate","Archway","Tufnell Park","Kentish Town","Camden Town"], N_E=["Hampstead","Belsize Park","Chalk Farm","Camden Town"];
const N_CX=["Camden Town","Mornington Crescent","Euston","Warren Street","Goodge Street","Tottenham Court Road","Leicester Square","Charing Cross","Embankment","Waterloo","Kennington"];
const N_BK=["Camden Town","Euston","King's Cross St Pancras","Angel","Old Street","Moorgate","Bank","London Bridge","Borough","Elephant & Castle","Kennington"];
const N_S=["Kennington","Oval","Stockwell","Clapham North","Clapham Common","Clapham South","Balham","Tooting Bec","Tooting Broadway","Colliers Wood","South Wimbledon","Morden"];
const CIRCLE=["Aldgate","Liverpool Street","Moorgate","Barbican","Farringdon","King's Cross St Pancras","Euston Square","Great Portland Street","Baker Street","Edgware Road","Paddington","Bayswater","Notting Hill Gate","High Street Kensington","Gloucester Road","South Kensington","Sloane Square","Victoria","St James's Park","Westminster","Embankment","Temple","Blackfriars","Mansion House","Cannon Street","Monument","Tower Hill","Aldgate"];
const LINES = [
 {id:"N1",name:"Northern",color:"#000000",kind:"tube",seq:[...N_N,...N_CX.slice(1),...N_S.slice(1)]},
 {id:"N2",name:"Northern",color:"#000000",kind:"tube",seq:[...N_N,...N_BK.slice(1),...N_S.slice(1)]},
 {id:"N3",name:"Northern",color:"#000000",kind:"tube",seq:[...N_E,...N_CX.slice(1),...N_S.slice(1)]},
 {id:"N4",name:"Northern",color:"#000000",kind:"tube",seq:[...N_E,...N_BK.slice(1),...N_S.slice(1)]},
 {id:"VIC",name:"Victoria",color:"#0098D4",kind:"tube",seq:["Finsbury Park","Highbury & Islington","King's Cross St Pancras","Euston","Warren Street","Oxford Circus","Green Park","Victoria","Pimlico","Vauxhall","Stockwell","Brixton"]},
 {id:"CEN",name:"Central",color:"#E32017",kind:"tube",seq:["North Acton","East Acton","White City","Shepherd's Bush","Holland Park","Notting Hill Gate","Queensway","Lancaster Gate","Marble Arch","Bond Street","Oxford Circus","Tottenham Court Road","Holborn","Chancery Lane","St Paul's","Bank","Liverpool Street","Bethnal Green","Mile End","Stratford"]},
 {id:"JUB",name:"Jubilee",color:"#A0A5A9",kind:"tube",seq:["Wembley Park","Neasden","Dollis Hill","Willesden Green","Kilburn","West Hampstead","Finchley Road","Swiss Cottage","St John's Wood","Baker Street","Bond Street","Green Park","Westminster","Waterloo","Southwark","London Bridge","Bermondsey","Canada Water","Canary Wharf","North Greenwich","Stratford"]},
 {id:"MET",name:"Metropolitan",color:"#9B0056",kind:"tube",seq:["Wembley Park","Finchley Road","Baker Street","Great Portland Street","Euston Square","King's Cross St Pancras","Farringdon","Barbican","Moorgate","Liverpool Street","Aldgate"]},
 {id:"CIR",name:"Circle",color:"#FFD300",kind:"tube",seq:CIRCLE},
 {id:"DIS",name:"District",color:"#00782A",kind:"tube",seq:["Wimbledon","Wimbledon Park","Southfields","East Putney","Putney Bridge","Parsons Green","Fulham Broadway","West Brompton","Earl's Court","Gloucester Road","South Kensington","Sloane Square","Victoria","St James's Park","Westminster","Embankment","Temple","Blackfriars","Mansion House","Cannon Street","Monument","Tower Hill","Aldgate East","Whitechapel","Stepney Green","Mile End","Bow Road"]},
 {id:"DIS2",name:"District",color:"#00782A",kind:"tube",seq:["Kensington Olympia","Earl's Court","High Street Kensington","Notting Hill Gate","Bayswater","Paddington","Edgware Road"]},
 {id:"PIC",name:"Piccadilly",color:"#003688",kind:"tube",seq:["Wood Green","Turnpike Lane","Manor House","Finsbury Park","Arsenal","Holloway Road","Caledonian Road","King's Cross St Pancras","Russell Square","Holborn","Covent Garden","Leicester Square","Piccadilly Circus","Green Park","Hyde Park Corner","Knightsbridge","South Kensington","Gloucester Road","Earl's Court"]},
 {id:"BAK",name:"Bakerloo",color:"#B36305",kind:"tube",seq:["Paddington","Edgware Road","Marylebone","Baker Street","Regent's Park","Oxford Circus","Piccadilly Circus","Charing Cross","Embankment","Waterloo","Lambeth North","Elephant & Castle"]},
 {id:"ELZ",name:"Elizabeth",color:"#6950A1",kind:"tube",fast:true,seq:["Paddington","Bond Street","Tottenham Court Road","Farringdon","Liverpool Street","Whitechapel","Canary Wharf"]},
 {id:"DLR",name:"DLR",color:"#00A4A7",kind:"dlr",seq:["Bank","Shadwell","Limehouse","Westferry","Heron Quays","South Quay","Crossharbour","Mudchute","Island Gardens","Cutty Sark","Greenwich","Deptford Bridge","Elverson Road","Lewisham"]},
 {id:"SE1",name:"Southeastern",color:"#1F3C88",kind:"rail",seq:["Charing Cross","Waterloo","London Bridge","Deptford","Greenwich"]},
 {id:"SE2",name:"Southeastern",color:"#1F3C88",kind:"rail",seq:["Charing Cross","Waterloo","London Bridge","Lewisham"]},
 {id:"SE3",name:"Southeastern",color:"#1F3C88",kind:"rail",seq:["Victoria","Brixton","Herne Hill","West Dulwich","Sydenham Hill","Penge East","Kent House","Beckenham Junction"]},
 {id:"SE4",name:"Southeastern",color:"#1F3C88",kind:"rail",seq:["London Bridge","Lewisham","Ladywell","Catford Bridge","Lower Sydenham","New Beckenham"]},
 {id:"SWR",name:"South Western",color:"#24398C",kind:"rail",seq:["Waterloo","Vauxhall","Clapham Junction","Earlsfield","Wimbledon"]},
 {id:"OVG",name:"Overground",color:"#EE7C0E",kind:"rail",seq:["Clapham Junction","Kensington Olympia","Shepherd's Bush"]}
];
function hav(a,b,c,d){const R=6371,t=Math.PI/180,x=(c-a)*t,y=(d-b)*t,s=Math.sin(x/2)**2+Math.cos(a*t)*Math.cos(c*t)*Math.sin(y/2)**2;return 2*R*Math.asin(Math.sqrt(s));}
const WALK_KMPM=0.075, DETOUR=1.3; // ~4.5 km/h, sokak katsayısı
function walkMin(km){return km*DETOUR/WALK_KMPM;}
function hopMin(km,line){const v=line.kind==="rail"?0.9:line.fast?0.9:line.kind==="dlr"?0.5:0.6;return 0.8+km/v;}
// Graph nodes: "station|line"
function buildGraph(){
 const adj={};const add=(a,b,w,meta)=>{(adj[a]=adj[a]||[]).push({to:b,w,meta});};
 const linesAt={};
 for(const L of LINES){for(let i=0;i<L.seq.length;i++){const s=L.seq[i];(linesAt[s]=linesAt[s]||new Set()).add(L.id);
  if(i>0){const p=L.seq[i-1];const k=hav(ST[p][0],ST[p][1],ST[s][0],ST[s][1]);const w=hopMin(k,L);add(p+"|"+L.id,s+"|"+L.id,w,{ride:L.id});add(s+"|"+L.id,p+"|"+L.id,w,{ride:L.id});}}}
 // transfers within station and short walks between stations
 const names=Object.keys(ST);
 for(const s of names){const ls=[...(linesAt[s]||[])];
  for(const a of ls)for(const b of ls)if(a!==b){const same=LINES.find(x=>x.id===a).name===LINES.find(x=>x.id===b).name;add(s+"|"+a,s+"|"+b,same?3:5,{xfer:!same});}}
 for(const s of names)for(const t of names){if(s===t)continue;const k=hav(ST[s][0],ST[s][1],ST[t][0],ST[t][1]);if(k<0.45){for(const a of linesAt[s]||[])for(const b of linesAt[t]||[])add(s+"|"+a,t+"|"+b,walkMin(k)+3,{xfer:true,walk:Math.round(walkMin(k))});}}
 return {adj,linesAt};
}
const G=buildGraph();
const FARE_Z1={1:[3.10,3.00],2:[3.60,3.10],3:[3.90,3.30],4:[4.80,3.60],5:[5.30,3.80],6:[5.90,4.00]};
const FARE_NZ={1:[2.30,2.20],2:[2.50,2.30],3:[3.20,2.40],4:[3.40,2.50],5:[3.80,2.60]};
const BUS=1.85;
function route(o,d){ // o,d: [lat,lng]
 const direct=hav(o[0],o[1],d[0],d[1]);
 const best={walk:walkMin(direct)};
 const dist={},prev={},pq=[];const push=(n,c)=>{pq.push([c,n]);};
 const names=Object.keys(ST);
 for(const s of names){const k=hav(o[0],o[1],ST[s][0],ST[s][1]);if(k>1.8)continue;for(const l of G.linesAt[s]||[]){const n=s+"|"+l;const c=walkMin(k)+4;if(dist[n]===undefined||c<dist[n]){dist[n]=c;prev[n]={start:true,walk:walkMin(k)};push(n,c);}}}
 const done=new Set();
 while(pq.length){pq.sort((a,b)=>a[0]-b[0]);const [c,n]=pq.shift();if(done.has(n))continue;done.add(n);
  for(const e of G.adj[n]||[]){const nc=c+e.w;if(dist[e.to]===undefined||nc<dist[e.to]-1e-9){dist[e.to]=nc;prev[e.to]={from:n,meta:e.meta};push(e.to,nc);}}}
 let bestEnd=null,bestT=Infinity,bestEg=0;
 for(const n in dist){const s=n.split("|")[0];const k=hav(d[0],d[1],ST[s][0],ST[s][1]);if(k>1.8)continue;const t=dist[n]+walkMin(k);if(t<bestT){bestT=t;bestEnd=n;bestEg=walkMin(k);}}
 if(!bestEnd||best.walk<=bestT) return {mode:"walk",minutes:Math.round(best.walk),changes:0,legs:[{type:"walk",min:Math.round(best.walk)}],fare:0,km:+(direct).toFixed(1),zones:[]};
 // reconstruct
 const path=[];let n=bestEnd;while(true){path.unshift(n);const p=prev[n];if(p.start)break;n=p.from;}
 const sw=prev[path[0]].walk;
 const segs=[];const zones=new Set();
 for(let i=0;i<path.length;i++){const [s,l]=path[i].split("|");const L=LINES.find(x=>x.id===l);
  const m=i>0?prev[path[i]].meta:null;
  if(i===0||(m&&!m.ride)){ // new segment (start or transfer)
   segs.push({line:L.name,color:L.color,kind:L.kind,from:s,to:s,stops:0,walkBefore:m&&m.walk?m.walk:0});
  } else {const g=segs[segs.length-1];g.to=s;g.stops++;}
 }
 // drop zero-stop segments, merge same-name consecutive (aynı hat, şube değişimi)
 const rides=[];for(const g of segs){if(g.stops===0)continue;const last=rides[rides.length-1];if(last&&last.line===g.line&&last.to===g.from){last.to=g.to;last.stops+=g.stops;}else rides.push({...g});}
 for(const r of rides){zones.add(ST[r.from][2]);zones.add(ST[r.to][2]);}
 const cleanLegs=[{type:"walk",min:Math.round(sw)},...rides.map(r=>({type:"ride",...r})),{type:"walk",min:Math.round(bestEg)}];
 const zs=[...zones];const zmax=Math.max(...zs),zmin=Math.min(...zs);
 const hasRail=rides.some(r=>r.kind==="rail");
 let fare=zs.includes(1)?FARE_Z1[Math.min(zmax,6)][0]:FARE_NZ[Math.min(zmax-zmin+1,5)][0];
 if(hasRail&&zs.includes(1)) fare=+(fare+0.2).toFixed(2);
 return {mode:"transit",minutes:Math.round(bestT),changes:Math.max(0,rides.length-1),legs:cleanLegs,fare,km:+(direct).toFixed(1),zones:[zmin,zmax]};
}
if(typeof module!=="undefined")module.exports={route,ST,LINES,hav};
