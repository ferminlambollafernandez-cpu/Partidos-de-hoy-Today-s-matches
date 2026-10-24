const matches = [
  { time: 'FINAL', state: 'finished', home: 'Talleres', hcode: 'T', hcolor: '#246aa0', away: 'Defensa y Justicia', acode: 'DYJ', acolor: '#88bd32', score: [2, 1], hg: [['18′', 'R. Botta'], ['64′', 'F. Girotti']], ag: [['42′', 'A. Molinas']] },
  { time: 'FINAL', state: 'finished', home: 'River Plate', hcode: 'R', hcolor: '#e7e7e7', away: 'Banfield', acode: 'B', acolor: '#25865c', score: [1, 1], hg: [['55′', 'M. Borja']], ag: [['73′', 'M. Giménez']] },
  { time: '19:15', state: 'upcoming', home: 'San Lorenzo', hcode: 'SL', hcolor: '#c53c54', away: 'Newell’s', acode: 'NOB', acolor: '#d54451' },
  { time: '21:30', state: 'upcoming', home: 'Rosario Central', hcode: 'RC', hcolor: '#e1c53b', away: 'Huracán', acode: 'H', acolor: '#dc555b' }
];
const teamMarkup = (team, code, color, side) => `<div class="team ${side}"><span class="team-name">${team}</span><span class="crest" style="--crest:${color}">${code}</span></div>`;
const scorerMarkup = list => list.length ? list.map(([minute, name]) => `<span><b>${minute}</b>${name}</span>`).join('') : '<span></span>';
function renderMatches(filter = 'all') {
  document.querySelector('#matchList').innerHTML = matches.map(m => `<article class="match-row" data-state="${m.state}" ${filter !== 'all' && m.state !== filter ? 'hidden' : ''}>
    <div class="match-time ${m.state}">${m.state === 'upcoming' ? m.time : 'FINAL'}</div>
    ${teamMarkup(m.home,m.hcode,m.hcolor,'home')}
    <div class="score">${m.state === 'finished' ? `<span>${m.score[0]}</span><span class="dash">–</span><span>${m.score[1]}</span>` : '<span class="dash">–</span>'}</div>
    ${teamMarkup(m.away,m.acode,m.acolor,'away')}
    <div class="goals"><span>${scorerMarkup(m.hg)}</span><span>${scorerMarkup(m.ag)}</span></div>
  </article>`).join('');
}
const clubs = [
  ['Boca Juniors','CABJ','#edb928',26,14,7,5,22],['River Plate','CARP','#f1f1f1',24,14,6,4,18],['Rosario Central','C',' #e8c83c',23,14,6,5,13],['Talleres','T','#3587b9',22,14,6,6,9],['San Lorenzo','CASLA','#c64056',21,14,5,7,6],['Independiente','CAI','#e5e7e8',20,14,5,8,5],['Vélez Sarsfield','V','#2a8bba',20,14,5,8,4],['Racing Club','RC','#8dcedd',19,14,5,9,3],['Estudiantes','E','#d64552',18,14,4,10,1],['Huracán','H','#d54b55',17,14,4,10,-1]
];
function renderTable(type='zona-a') {
 const rows = type === 'zona-b' ? [...clubs].reverse().slice(0,10) : type === 'anual' ? [...clubs].sort((a,b)=>b[5]-a[5]).slice(0,10) : clubs;
 document.querySelector('#standingsBody').innerHTML = rows.map((c,i)=>`<tr><td class="position">${i+1}</td><td class="club"><span class="club-wrap"><span class="club-crest" style="background:${c[2].trim()}">${c[1]}</span>${c[0]}</span></td><td class="points">${c[3]}</td><td>${c[4]}</td><td style="color:${c[7]>=0?'var(--green)':'#f07b7b'}">${c[7]>0?'+':''}${c[7]}</td><td>${c[5]}</td><td>${c[6]}</td><td>${14-c[5]-c[6]}</td></tr>`).join('');
}
renderMatches(); renderTable();
document.querySelectorAll('.filter').forEach(btn=>btn.addEventListener('click',()=>{document.querySelector('.filter.active').classList.remove('active');btn.classList.add('active');renderMatches(btn.dataset.filter)}));
document.querySelectorAll('.table-tab').forEach(btn=>btn.addEventListener('click',()=>{document.querySelector('.table-tab.active').classList.remove('active');btn.classList.add('active');renderTable(btn.dataset.table)}));
const date = new Date(2026,9,24); const formatDate = d => d.toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'}).toUpperCase();
function updateDate(){document.querySelector('#selectedDate').textContent=formatDate(date);document.querySelector('.section-kicker').textContent=`${formatDate(date)} · 2026`;}
document.querySelector('#prevDate').addEventListener('click',()=>{date.setDate(date.getDate()-1);updateDate()}); document.querySelector('#nextDate').addEventListener('click',()=>{date.setDate(date.getDate()+1);updateDate()}); document.querySelector('#todayButton').addEventListener('click',()=>{date.setFullYear(2026,9,24);updateDate()});
