const SCORE_BASE = 'https://site.api.espn.com/apis/site/v2/sports';
const SCORE_FALLBACK = 'https://site.web.api.espn.com/apis/site/v2/sports';
const TABLE_BASE = 'https://site.api.espn.com/apis/v2/sports';
const TABLE_FALLBACK = 'https://site.web.api.espn.com/apis/v2/sports';
const ARG_LEAGUE = 'soccer/arg.1';
const LEAGUES = [
  { id: 'arg.1', path: 'soccer/arg.1', name: 'LIGA PROFESIONAL', icon: '🇦🇷' },
  { id: 'eng.1', path: 'soccer/eng.1', name: 'PREMIER LEAGUE', icon: '🏴' },
  { id: 'esp.1', path: 'soccer/esp.1', name: 'LA LIGA', icon: '🇪🇸' },
  { id: 'usa.1', path: 'soccer/usa.1', name: 'MLS', icon: '🇺🇸' },
  { id: 'bra.1', path: 'soccer/bra.1', name: 'BRASILEIRÃO', icon: '🇧🇷' },
  { id: 'uefa.champions', path: 'soccer/uefa.champions', name: 'CHAMPIONS LEAGUE', icon: '🏆' },
  { id: 'uefa.europa', path: 'soccer/uefa.europa', name: 'EUROPA LEAGUE', icon: '🟠' },
  { id: 'uefa.europa.conf', path: 'soccer/uefa.europa.conf', name: 'CONFERENCE LEAGUE', icon: '🟣' },
  { id: 'conmebol.libertadores', path: 'soccer/conmebol.libertadores', name: 'COPA LIBERTADORES', icon: '🌎' },
  { id: 'conmebol.sudamericana', path: 'soccer/conmebol.sudamericana', name: 'COPA SUDAMERICANA', icon: '🟡' }
];
const OFFICIAL_SCHEDULES = {
  '2026-11-03': {
    'uefa.champions': {
      label: 'JORNADA 4 · FASE DE LIGA',
      matches: [
        { home: 'Shakhtar Donetsk', away: 'Sporting CP', kickoff: '2026-11-03T17:45:00Z' },
        { home: 'Galatasaray', away: 'Stuttgart', kickoff: '2026-11-03T17:45:00Z' },
        { home: 'Atlético de Madrid', away: 'Bayern München', kickoff: '2026-11-03T20:00:00Z' },
        { home: 'Barcelona', away: 'Aston Villa', kickoff: '2026-11-03T20:00:00Z' },
        { home: 'Feyenoord', away: 'Inter', kickoff: '2026-11-03T20:00:00Z' },
        { home: 'Bodø/Glimt', away: 'Lille', kickoff: '2026-11-03T20:00:00Z' },
        { home: 'LASK', away: 'Slovan Bratislava', kickoff: '2026-11-03T20:00:00Z' },
        { home: 'Manchester United', away: 'Roma', kickoff: '2026-11-03T20:00:00Z' },
        { home: 'Villarreal', away: 'Paris Saint-Germain', kickoff: '2026-11-03T20:00:00Z' }
      ]
    }
  },
  '2026-11-21': {
    'conmebol.sudamericana': {
      label: 'FINAL · BARRANQUILLA',
      matches: [{ home: 'Boca Juniors', away: 'Atlético Mineiro' }]
    }
  },
  '2026-11-28': {
    'conmebol.libertadores': {
      label: 'FINAL · MONTEVIDEO',
      matches: [{ home: 'Estudiantes de La Plata', away: 'Palmeiras' }]
    }
  }
};
const TIME_ZONE = 'America/Argentina/Buenos_Aires';
const FOLLOWED_MATCHES_KEY = 'futbol-argentino-followed-v1';
function readLocalData(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value ?? fallback;
  } catch { return fallback; }
}
function writeLocalData(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch (error) { console.warn('No se pudo guardar en este dispositivo.', error); }
}
function readFollowedMatches() {
  const value = readLocalData(FOLLOWED_MATCHES_KEY, []);
  return new Set(Array.isArray(value) ? value.map(String) : []);
}
const ALERTS_ENABLED_KEY = 'futbol-argentino-alerts-v1';
function notificationAvailable() { return typeof window !== 'undefined' && 'Notification' in window; }
function sendBrowserAlert(title, body) {
  if (!state.alertsEnabled || !notificationAvailable() || Notification.permission !== 'granted') return;
  try { new Notification(title, { body }); } catch (error) { console.warn('No se pudo mostrar el aviso.', error); }
}
function enableMatchAlerts() {
  if (!notificationAvailable()) { window.alert('Este navegador no permite notificaciones. Los avisos funcionan mientras la página esté abierta.'); return; }
  Notification.requestPermission().then(permission => {
    state.alertsEnabled = permission === 'granted';
    writeLocalData(ALERTS_ENABLED_KEY, state.alertsEnabled);
    renderMatches();
    if (state.alertsEnabled) window.alert('Avisos activados para los partidos que sigas.');
  });
}
function eventScore(event) {
  const { home, away } = getParticipants(event);
  return [home.score == null ? null : Number(home.score), away.score == null ? null : Number(away.score)];
}
function notifyFollowedMatchChanges(previous, current) {
  const before = new Map(previous.map(event => [String(event.id), event]));
  current.forEach(event => {
    const id = String(event.id || '');
    if (!id || !state.followedMatchIds.has(id)) return;
    const old = before.get(id);
    if (!old) return;
    const [oldHome, oldAway] = eventScore(old);
    const [home, away] = eventScore(event);
    const pair = getParticipants(event);
    const homeName = pair.home.team?.shortDisplayName || pair.home.team?.displayName || 'Local';
    const awayName = pair.away.team?.shortDisplayName || pair.away.team?.displayName || 'Visitante';
    if (home != null && away != null && (home > (Number(oldHome) || 0) || away > (Number(oldAway) || 0)))
      sendBrowserAlert('¡Gol! ' + homeName + ' ' + home + ' – ' + away + ' ' + awayName, 'Actualización del partido que estás siguiendo.');
    if (matchState(old) !== 'finished' && matchState(event) === 'finished')
      sendBrowserAlert('Final: ' + homeName + ' ' + (home ?? '–') + ' – ' + (away ?? '–') + ' ' + awayName, 'Terminó el partido que estás siguiendo.');
  });
}
function collectRedCardFingerprints(value, output = new Set()) {
  if (!value || typeof value !== 'object') return output;
  if (Array.isArray(value)) { value.forEach(item => collectRedCardFingerprints(item, output)); return output; }
  const text = Object.entries(value).filter(([,item]) => typeof item === 'string' || typeof item === 'number')
    .map(([key,item]) => key + ' ' + item).join(' ').toLocaleLowerCase('es');
  if (/red.?card|tarjeta roja|expuls|sent off/.test(text)) {
    const identity = value.id || value.guid || value.athlete?.displayName || value.player?.displayName || value.text || value.description || text;
    output.add(String(identity).slice(0, 180));
  }
  Object.values(value).forEach(item => collectRedCardFingerprints(item, output));
  return output;
}
function notifyMatchDetailChanges(matchId, summary, event) {
  const next = [...collectRedCardFingerprints(summary)];
  const previous = state.detailSnapshots[matchId];
  if (previous) {
    const known = new Set(previous);
    if (next.some(item => !known.has(item))) {
      const pair = getParticipants(event);
      sendBrowserAlert('Tarjeta roja', (pair.home.team?.shortDisplayName || 'Local') + ' vs ' + (pair.away.team?.shortDisplayName || 'Visitante') + ': se registró una expulsión.');
    }
  }
  state.detailSnapshots[matchId] = next;
}
async function refreshFollowedLiveCards(matches) {
  const tracked = matches.filter(event => {
    const id = String(event.id || '');
    return id && state.followedMatchIds.has(id) && id !== state.selectedMatchId && !state.cardFetches.has(id)
      && !id.startsWith('official-schedule-') && matchState(event) === 'live';
  });
  await Promise.all(tracked.map(async event => {
    const id = String(event.id);
    const league = LEAGUES.find(item => item.id === event._leagueId) || LEAGUES[0];
    state.cardFetches.add(id);
    try {
      const summary = await fetchFromEspn('/' + league.path + '/summary?event=' + encodeURIComponent(id) + '&region=ar&lang=es');
      notifyMatchDetailChanges(id, summary, event);
    } catch { /* Se vuelve a intentar en la próxima actualización del marcador. */ }
    finally { state.cardFetches.delete(id); }
  }));
}
function metricValue(statistics, aliases) {
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const names = aliases.map(normalize);
  const item = statistics.find(stat => names.includes(normalize(stat.name || stat.abbreviation || stat.displayName || stat.label)));
  return item ? (item.displayValue ?? item.value ?? item.display ?? '—') : '—';
}
function matchStats(summary, event) {
  const { home, away } = getParticipants(event);
  const source = summary?.boxscore?.teams || summary?.boxscore?.teamStats || [];
  const teams = Array.isArray(source) ? source : [];
  const getStats = (competitor, index) => {
    const id = String(competitor.team?.id || competitor.id || '');
    const found = teams.find(item => String(item.team?.id || item.id || '') === id) || teams[index];
    return Array.isArray(found?.statistics) ? found.statistics : [];
  };
  const sides = [getStats(home, 0), getStats(away, 1)];
  return [
    { label: 'Posesión', values: sides.map(items => metricValue(items, ['possessionPct','possession','possessionPercentage'])) },
    { label: 'Remates al arco', values: sides.map(items => metricValue(items, ['shotsOnTarget','shotsOnGoal','sot','onTarget'])) },
    { label: 'Faltas', values: sides.map(items => metricValue(items, ['foulsCommitted','fouls'])) }
  ];
}
function renderAdvancedStats(event) {
  const rows = matchStats(state.matchDetails, event);
  const hasData = rows.some(row => row.values.some(value => value !== '—' && value !== ''));
  const { home, away } = getParticipants(event);
  return '<section class="detail-section advanced-stats"><div class="detail-section-title"><h4>ESTADÍSTICAS</h4><span>' + (matchState(event) === 'live' ? 'EN VIVO · ACTUALIZA CADA MINUTO' : 'DEL PARTIDO') + '</span></div>'
    + '<div class="stats-head"><span></span><b>' + safe(home.team?.shortDisplayName || home.team?.displayName || 'Local') + '</b><b>' + safe(away.team?.shortDisplayName || away.team?.displayName || 'Visitante') + '</b></div>'
    + rows.map(row => '<div class="stats-row"><span>' + row.label + '</span><strong>' + safe(row.values[0]) + '</strong><strong>' + safe(row.values[1]) + '</strong></div>').join('')
    + (hasData ? '' : '<div class="detail-note">ESPN todavía no publicó estas estadísticas para el partido.</div>') + '</section>';
}
function renderFollowControls(event) {
  const id = String(event.id || '');
  const followed = state.followedMatchIds.has(id);
  return '<div class="match-tools"><button type="button" class="follow-match-button ' + (followed ? 'active' : '') + '" data-follow-match="' + safe(id) + '">' + (followed ? '★ SIGUIENDO' : '☆ SEGUIR PARTIDO') + '</button>'
    + '<button type="button" class="alerts-button ' + (state.alertsEnabled ? 'active' : '') + '" data-enable-alerts>' + (state.alertsEnabled ? 'AVISOS ACTIVOS' : 'ACTIVAR AVISOS') + '</button></div>'
    + '<p class="alert-limit-note">Avisos disponibles mientras la página esté abierta.</p>';
}
const state = { date: todayKey(), matches: [], feeds: [], tables: [], tableData: {}, activeStandings: 'arg.1', activeTable: 0, filter: 'all', season: null, scoresLoaded: false, selectedMatchId: null, matchDetails: null, matchDetailsLoading: false, matchDetailsError: false, matchDetailRequest: 0, teamProfile: null, teamProfileLoading: false, teamProfileTab: 'principal', teamProfileRequest: 0, followedMatchIds: readFollowedMatches(), alertsEnabled: readLocalData(ALERTS_ENABLED_KEY, false), matchSnapshotsInitialized: false, detailSnapshots: {}, cardFetches: new Set(), finalDetailsLoadedFor: new Set() };

function dateParts(key) {
  const [year, month, day] = key.split('-').map(Number);
  return { year, month, day };
}
function todayKey() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}
function shiftDate(key, days) {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
function espnDate(key) { return key.replaceAll('-', ''); }
function normalizedTeamName(value = '') {
  const key = String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const aliases = {
    atleticomg: 'atleticomineiro',
    estudiantes: 'estudiantesdelaplata',
    shakhtar: 'shakhtardonetsk',
    atleticodemadrid: 'atleticomadrid',
    bayernmunchen: 'bayernmunich',
    sportinglisbon: 'sportingcp',
    psg: 'parissaintgermain',
    paris: 'parissaintgermain',
    intermilan: 'inter',
    fcintermilan: 'inter',
    slovan: 'slovanbratislava'
  };
  return aliases[key] || key;
}
function eventTeamNames(competitor) {
  const team = competitor?.team || {};
  return [team.displayName, team.name, team.location, team.shortDisplayName, team.abbreviation]
    .filter(Boolean).map(normalizedTeamName);
}
function officialScheduleEvents(date, league) {
  const schedule = OFFICIAL_SCHEDULES[date]?.[league.id];
  if (!schedule || date < todayKey()) return [];
  const team = (name, side, abbreviation) => ({
    type: 'team',
    homeAway: side,
    team: { name, displayName: name, shortDisplayName: name, abbreviation }
  });
  return schedule.matches.map((fixture, index) => ({
    id: `official-schedule-${league.id}-${date}-${index + 1}`,
    name: `${fixture.home} vs ${fixture.away}`,
    date: fixture.kickoff,
    _leagueId: league.id,
    _officialSchedule: schedule.label,
    competitions: [{
      status: { type: { name: 'STATUS_SCHEDULED', state: 'pre', detail: fixture.kickoff ? 'Scheduled' : 'HORA A CONFIRMAR' } },
      competitors: [
        team(fixture.home, 'home', fixture.home.split(/\s+/).map(word => word[0]).join('').slice(0, 3)),
        team(fixture.away, 'away', fixture.away.split(/\s+/).map(word => word[0]).join('').slice(0, 3))
      ]
    }]
  }));
}
function mergeOfficialSchedule(date, league, events) {
  const officialEvents = officialScheduleEvents(date, league);
  if (!officialEvents.length) return events;
  const merged = [...events];
  for (const fixture of officialEvents) {
    const competitors = fixture.competitions[0].competitors;
    const expectedHome = normalizedTeamName(competitors[0].team.name);
    const expectedAway = normalizedTeamName(competitors[1].team.name);
    const exists = merged.some(event => {
      const { home, away } = getParticipants(event);
      const homeNames = eventTeamNames(home);
      const awayNames = eventTeamNames(away);
      return homeNames.includes(expectedHome) && awayNames.includes(expectedAway)
        || homeNames.includes(expectedAway) && awayNames.includes(expectedHome);
    });
    if (!exists) merged.push(fixture);
  }
  return merged;
}
function formatDate(key) {
  const { year, month, day } = dateParts(key);
  return new Intl.DateTimeFormat('es-AR', { timeZone: TIME_ZONE, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}
function safe(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
function setFeedStatus(message, kind = 'loading') {
  const status = document.querySelector('#feedStatus');
  status.textContent = message;
  status.dataset.state = kind;
}
function setLivePill(message, kind = '') {
  const pill = document.querySelector('.live-pill');
  pill.classList.toggle('is-error', kind === 'error');
  pill.classList.toggle('is-loading', kind === 'loading');
  pill.innerHTML = `<span class="live-dot"></span> ${safe(message)}`;
}
async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
  if (!response.ok) throw new Error(`Error ${response.status}`);
  return response.json();
}
async function fetchFromEspn(path, base = SCORE_BASE, fallback = SCORE_FALLBACK) {
  try { return await fetchJson(`${base}${path}`); }
  catch (firstError) {
    try { return await fetchJson(`${fallback}${path}`); }
    catch { throw firstError; }
  }
}
function getCompetition(event) { return event.competitions?.[0] || {}; }
function getParticipants(event) {
  const competitors = getCompetition(event).competitors || [];
  return {
    home: competitors.find(team => team.homeAway === 'home') || competitors[0] || {},
    away: competitors.find(team => team.homeAway === 'away') || competitors[1] || {}
  };
}
function matchState(event) {
  const status = getCompetition(event).status || event.status || {};
  const type = status.type || {};
  if (type.completed || type.state === 'post' || /final|full.time|finished/i.test(`${type.name || ''} ${type.detail || ''}`)) return 'finished';
  if (type.state === 'in' || /progress|in.play|half.time|live/i.test(`${type.name || ''} ${type.detail || ''}`)) return 'live';
  return 'upcoming';
}
function parseSoccerClock(value) {
  const text = String(value ?? '').trim().replace(/[’′]/g, "'");
  let match = text.match(/^(\d{1,3})(?:\s*\+\s*(\d{1,2}))?\s*'?$/);
  if (match) return { minute: Number(match[1]), added: match[2] === undefined ? null : Number(match[2]) };
  match = text.match(/^(\d{1,3}):(\d{2})$/);
  if (match) return { minute: Number(match[1]), added: null };
  return null;
}
function formatGoalMinute(value) {
  const clock = parseSoccerClock(value);
  if (clock) return String(clock.minute) + (clock.added === null ? '' : '+' + clock.added) + "'";
  const text = String(value ?? '').trim().replace(/[’′]/g, "'");
  const match = text.match(/(?:^|\s)(\d{1,3})(?:\s*\+\s*(\d{1,2}))?\s*(?:'|min(?:ute)?s?)(?:$|\s)/i);
  if (!match) return '';
  return String(Number(match[1])) + (match[2] === undefined ? '' : '+' + Number(match[2])) + "'";
}
function liveClockLabel(event) {
  const status = getCompetition(event).status || event.status || {};
  const type = status.type || {};
  const description = `${type.name || ''} ${type.detail || ''} ${type.shortDetail || ''}`;
  if (/half.?time|entretiempo|break|paused|suspend|delay|var review/i.test(description)) {
    return /half.?time|entretiempo/i.test(description) ? 'ENTRETIEMPO' : 'EN PAUSA';
  }
  const displayClock = String(status.displayClock || '').trim();
  const shortDetail = String(type.shortDetail || type.detail || '').trim();
  const displayParts = parseSoccerClock(displayClock);
  const shortParts = parseSoccerClock(shortDetail);
  const source = shortParts?.added !== null && shortParts?.added !== undefined
    ? shortDetail
    : displayParts ? displayClock
    : shortParts ? shortDetail
    : displayClock || shortDetail;
  const clock = parseSoccerClock(source);
  if (!clock) return source || 'EN JUEGO';
  const elapsed = Math.floor(Math.max(0, Date.now() - (event._clockSyncedAt || Date.now())) / 60_000);
  return clock.added === null
    ? `${clock.minute + elapsed}'`
    : `${clock.minute}+${clock.added + elapsed}'`;
}
function updateVisibleLiveClocks() {
  document.querySelectorAll('.match-row[data-state="live"][data-match-id]').forEach(row => {
    const event = state.matches.find(item => String(item.id) === row.dataset.matchId);
    const time = row.querySelector('.match-time');
    if (event && time) time.innerHTML = `<span class="live-dot"></span>${safe(liveClockLabel(event))}`;
  });
}
function localTime(isoDate) {
  if (!isoDate) return 'HORA A CONFIRMAR';
  return new Intl.DateTimeFormat('es-AR', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(isoDate));
}
function crest(team, side) {
  const info = team.team || {};
  const name = info.shortDisplayName || info.displayName || info.name || 'Equipo';
  const logo = info.logo;
  const initials = info.abbreviation || name.split(/\s+/).map(word => word[0]).join('').slice(0, 3);
  const logoMarkup = logo && /^https:\/\//i.test(logo)
    ? `<img class="team-logo" src="${safe(logo)}" alt="" loading="lazy" onerror="this.hidden=true">`
    : `<span class="team-logo fallback">${safe(initials)}</span>`;
  const nameMarkup = `<span class="team-name">${safe(name)}</span>`;
  return `<div class="team ${side}">${side === 'home' ? nameMarkup + logoMarkup : logoMarkup + nameMarkup}</div>`;
}
function goalsFor(event, teamId) {
  const details = getCompetition(event).details || [];
  return details.filter(detail => {
    const label = detail.type?.text || detail.type?.name || '';
    return (detail.scoringPlay || /goal/i.test(label)) && String(detail.team?.id || '') === String(teamId || '');
  }).map(detail => {
    const scorer = detail.athletesInvolved?.[0]?.displayName || detail.athletesInvolved?.[0]?.fullName || 'Autor no informado';
    const minute = formatGoalMinute(detail.clock?.displayValue || detail.displayValue || '');
    const extra = detail.ownGoal ? ' (EC)' : detail.penaltyKick ? ' (P)' : '';
    return `<span><b>${safe(minute)}</b>${safe(scorer + extra)}</span>`;
  });
}
function renderGoals(event, home, away, scoreTotal) {
  const homeGoals = goalsFor(event, home.id);
  const awayGoals = goalsFor(event, away.id);
  const noDetail = scoreTotal > 0 && !homeGoals.length && !awayGoals.length;
  const emptyText = noDetail ? '<span class="goal-empty">Detalle de goles no publicado</span>' : '';
  return `<div class="goals"><span>${homeGoals.join('') || emptyText}</span><span>${awayGoals.join('')}</span></div>`;
}
function asBoolean(value) {
  return value === true || value === 1 || /^(true|yes|starter|starting|titular)$/i.test(String(value || ''));
}
function extractMatchLineups(payload, event) {
  const { home, away } = getParticipants(event);
  const homeId = String(home.id || home.team?.id || '');
  const awayId = String(away.id || away.team?.id || '');
  const teams = new Map([
    [homeId, { team: home.team || home, players: [] }],
    [awayId, { team: away.team || away, players: [] }]
  ].filter(([id]) => id));
  if (!teams.size) return { home: [], away: [], confirmed: false };

  function addPlayer(record, teamId, assumedStarter) {
    const player = record.athlete || record.player || record.person || record;
    const starterValue = record.starter ?? record.isStarter ?? record.isStarting ?? record.starting ?? player.starter ?? player.isStarter ?? player.isStarting;
    if (!teamId || !teams.has(teamId) || !(assumedStarter || asBoolean(starterValue))) return;
    const name = player.displayName || player.fullName || player.name || record.displayName || record.fullName || record.name;
    if (!name) return;
    const side = teams.get(teamId);
    const id = String(player.id || record.id || `${name}|${record.jersey || player.jersey || ''}`);
    if (side.players.some(existing => existing.id === id)) return;
    const position = record.position?.abbreviation || record.position?.displayName || player.position?.abbreviation || player.position?.displayName || player.position?.name || '';
    const jersey = record.jersey || record.jerseyNumber || player.jersey || player.jerseyNumber || '';
    side.players.push({ id, name, position, jersey });
  }

  const playerKeys = new Set(['athletes', 'players', 'roster', 'entries', 'lineup', 'starters', 'statistics', 'competitors', 'home', 'away']);
  function walk(value, inheritedTeam = '', assumedStarter = false, key = '', depth = 0) {
    if (!value || typeof value !== 'object' || depth > 10) return;
    if (Array.isArray(value)) {
      value.forEach(item => walk(item, inheritedTeam, assumedStarter, key, depth + 1));
      return;
    }
    const candidateTeam = String(value.team?.id || value.competitor?.id || value.teamId || value.team?.uid || value.id || '');
    const teamId = teams.has(candidateTeam) ? candidateTeam
      : key.toLowerCase() === 'home' ? homeId
      : key.toLowerCase() === 'away' ? awayId
      : inheritedTeam;
    const recordLooksLikePlayer = value.athlete || value.player || value.person
      || ((value.displayName || value.fullName || value.name) && (value.starter !== undefined || value.isStarter !== undefined || value.isStarting !== undefined));
    if (recordLooksLikePlayer) addPlayer(value, teamId, assumedStarter);
    for (const [childKey, child] of Object.entries(value)) {
      const normalizedKey = childKey.toLowerCase();
      if (playerKeys.has(normalizedKey)) {
        const childAssumedStarter = assumedStarter || normalizedKey === 'starters' || normalizedKey === 'lineup';
        walk(child, teamId, childAssumedStarter, childKey, depth + 1);
      }
    }
  }

  const summaryCompetition = getCompetition(payload || {});
  const sources = [
    payload?.rosters, payload?.lineups, payload?.lineup,
    payload?.boxscore?.players, payload?.boxscore?.rosters,
    summaryCompetition.competitors, getCompetition(event).competitors
  ];
  for (const source of sources) walk(source);
  const homePlayers = teams.get(homeId)?.players || [];
  const awayPlayers = teams.get(awayId)?.players || [];
  return { home: homePlayers, away: awayPlayers, confirmed: homePlayers.length >= 11 && awayPlayers.length >= 11 };
}
function collectSubstitutions(payload, event) {
  const items = [];
  const seen = new Set();
  const roots = [
    payload?.plays, payload?.keyEvents, payload?.commentary, payload?.events,
    getCompetition(payload || {}).details, getCompetition(event).details
  ];
  function visit(value, depth = 0) {
    if (!value || typeof value !== 'object' || depth > 9) return;
    if (Array.isArray(value)) {
      value.forEach(item => visit(item, depth + 1));
      return;
    }
    const type = typeof value.type === 'string' ? value.type : [value.type?.name, value.type?.text, value.type?.abbreviation].filter(Boolean).join(' ');
    const text = value.text || value.shortText || value.description || value.headline || value.detail || '';
    const matchText = `${type} ${text} ${value.playType || value.eventType || ''}`;
    if (/substitut|replac|cambio|sustituc|ingresa|sale del campo/i.test(matchText)) {
      const involved = (value.athletesInvolved || value.athletes || value.participants || [])
        .map(person => person.athlete || person)
        .map(person => person.displayName || person.fullName || person.name).filter(Boolean);
      const description = text && !/^substitution$|^cambio$/i.test(text) ? text
        : involved.length ? `Cambio registrado: ${involved.join(' · ')}`
        : 'Cambio registrado';
      const spanishChange = text.match(/(?:entra|ingresa)\s+(?:al\s+campo\s+)?(.+?)\s+sustituyendo\s+a\s+(.+?)(?:[.!?,;]|$)/i);
      const englishChange = text.match(/(?:enters?|comes on)\s+(.+?)\s+(?:for|replacing)\s+(.+?)(?:[.!?,;]|$)/i);
      const namesMatch = spanishChange || englishChange;
      const incoming = namesMatch ? namesMatch[1].trim() : '';
      const outgoing = namesMatch ? namesMatch[2].trim() : '';
      const minute = value.clock?.displayValue || value.time?.displayValue || value.minute?.displayValue || value.displayClock
        || (Number.isFinite(Number(value.minute)) ? `${value.minute}'` : '');
      const id = String(value.id || `${minute}|${description}`);
      if (!seen.has(id)) {
        seen.add(id);
        items.push({ minute, description, incoming, outgoing });
      }
    }
    for (const child of Object.values(value)) visit(child, depth + 1);
  }
  roots.forEach(root => visit(root));
  return items;
}
function collectRosterPlayers(payload) {
  const players = [];
  const seen = new Set();
  const childKeys = ['athletes', 'items', 'players', 'roster', 'entries'];
  function positionName(value) {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return value.displayName || value.name || value.abbreviation || value.shortName || '';
  }
  function visit(value, inheritedPosition = '', depth = 0) {
    if (!value || typeof value !== 'object' || depth > 10) return;
    if (Array.isArray(value)) {
      value.forEach(item => visit(item, inheritedPosition, depth + 1));
      return;
    }
    const position = positionName(value.position) || value.positionName || inheritedPosition;
    const hasChildren = childKeys.some(key => value[key] && typeof value[key] === 'object');
    const person = value.athlete || value.player || value.person || value;
    const name = person.displayName || person.fullName || person.name
      || [person.firstName, person.lastName].filter(Boolean).join(' ');
    const playerLike = Boolean(value.athlete || value.player || value.person || value.jersey
      || value.headshot || value.firstName || value.lastName || ((value.id || value.uid) && name && !hasChildren));
    if (name && playerLike && !hasChildren) {
      const id = String(person.id || person.uid || value.id || value.uid || name + '|' + (value.jersey || person.jersey || ''));
      if (!seen.has(id)) {
        seen.add(id);
        const playerPosition = positionName(person.position) || positionName(value.position) || value.positionName || inheritedPosition;
        const positionCode = person.position?.abbreviation || value.position?.abbreviation || value.positionCode || '';
        players.push({
          id,
          name,
          jersey: value.jersey || value.jerseyNumber || person.jersey || person.jerseyNumber || '',
          position: playerPosition,
          positionCode
        });
      }
    }
    for (const key of childKeys) {
      if (value[key] && typeof value[key] === 'object') visit(value[key], position, depth + 1);
    }
  }
  [payload?.athletes, payload?.roster, payload?.team?.athletes, payload?.team?.roster, payload?.items]
    .forEach(source => visit(source));
  return players;
}
function rosterPositionGroup(player) {
  const code = String(player.positionCode || '').trim().toUpperCase();
  const text = (String(player.position || '') + ' ' + code).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (['g', 'gk', 'goalkeeper'].includes(code) || /goalkeeper|keeper|arquero|portero/.test(text)) return 'ARQUEROS';
  if (['d', 'df', 'def'].includes(code) || /defender|defensa|centre.?back|center.?back|full.?back|lateral/.test(text) || ['cb', 'lb', 'rb', 'lwb', 'rwb'].includes(code.toLowerCase())) return 'DEFENSORES';
  if (['m', 'mf', 'mid'].includes(code) || /midfielder|mediocampista|volante|centrocampista/.test(text) || ['cm', 'dm', 'am', 'cdm', 'cam', 'rm', 'lm'].includes(code.toLowerCase())) return 'MEDIOCAMPISTAS';
  if (['f', 'fw', 'forward'].includes(code) || /forward|attacker|delantero|striker|winger/.test(text) || ['st', 'cf', 'lw', 'rw'].includes(code.toLowerCase())) return 'DELANTEROS';
  return player.position ? 'OTROS' : 'SIN POSICIÓN';
}
function groupRoster(players) {
  const order = ['ARQUEROS', 'DEFENSORES', 'MEDIOCAMPISTAS', 'DELANTEROS', 'OTROS', 'SIN POSICIÓN'];
  const groups = new Map(order.map(name => [name, []]));
  players.forEach(player => groups.get(rosterPositionGroup(player)).push(player));
  return order.map(name => ({
    name,
    players: groups.get(name).sort((a, b) => a.position.localeCompare(b.position, 'es') || a.name.localeCompare(b.name, 'es'))
  })).filter(group => group.players.length);
}
function profileTeamMatches(competitor, profile) {
  const team = competitor?.team || competitor || {};
  const id = String(team.id || competitor?.id || '');
  if (id && profile.teamId && id === String(profile.teamId)) return true;
  const profileNames = [
    profile.team?.displayName, profile.team?.name, profile.team?.location,
    profile.team?.shortDisplayName, profile.team?.abbreviation
  ].filter(Boolean).map(normalizedTeamName);
  return eventTeamNames(competitor).some(name => profileNames.includes(name));
}
function teamScheduleEvents(schedule, profile) {
  const events = schedule?.events || schedule?.schedule?.events || schedule?.team?.events || schedule?.items || [];
  if (!Array.isArray(events)) return [];
  return [...new Map(events
    .filter(event => {
      const date = event.date || getCompetition(event).date;
      const timestamp = Date.parse(date || '');
      if (!Number.isFinite(timestamp) || timestamp < Date.now() - 60_000 || matchState(event) !== 'upcoming') return false;
      return true;
    })
    .sort((a, b) => Date.parse(a.date || getCompetition(a).date) - Date.parse(b.date || getCompetition(b).date))
    .map(event => [String(event.id || event.date + event.name), event])).values()];
}
function shortFixtureDate(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'A CONFIRMAR';
  return new Intl.DateTimeFormat('es-AR', { timeZone: TIME_ZONE, day: '2-digit', month: '2-digit' }).format(date);
}
function teamScheduleAllEvents(schedule) {
  const events = schedule?.events || schedule?.schedule?.events || schedule?.team?.events || schedule?.items || [];
  return Array.isArray(events) ? events : [];
}
function teamRecentForm(schedule, profile) {
  return teamScheduleAllEvents(schedule).filter(event => {
    if (matchState(event) !== 'finished') return false;
    const { home, away } = getParticipants(event);
    return profileTeamMatches(home, profile) || profileTeamMatches(away, profile);
  }).map(event => {
    const { home, away } = getParticipants(event), isHome = profileTeamMatches(home, profile);
    const own = Number(isHome ? home.score : away.score), rival = Number(isHome ? away.score : home.score);
    if (!Number.isFinite(own) || !Number.isFinite(rival)) return null;
    return { date: Date.parse(event.date || getCompetition(event).date || ''), result: own > rival ? 'G' : own < rival ? 'P' : 'E' };
  }).filter(Boolean).sort((a,b) => b.date-a.date).slice(0,5).reverse();
}
function renderTeamRecentForm(profile) {
  const form = teamRecentForm(profile.schedule, profile);
  return '<section class="team-form-guide"><h4>FORMA RECIENTE</h4><div>' + (form.length
    ? form.map(item => '<span class="form-result form-' + item.result.toLowerCase() + '" title="' + (item.result === 'G' ? 'Ganó' : item.result === 'E' ? 'Empató' : 'Perdió') + '">' + item.result + '</span>').join('')
    : '<span class="detail-note">Sin resultados recientes publicados.</span>') + '</div></section>';
}
function renderTeamUpcoming(profile) {
  if (state.teamProfileLoading && !profile.schedule) return '<div class="detail-note">Buscando los próximos partidos…</div>';
  if (profile.scheduleError && !profile.schedule) return '<div class="detail-note">No se pudo cargar el calendario de este equipo.</div>';
  const fixtures = teamScheduleEvents(profile.schedule, profile);
  if (!fixtures.length) return '<div class="detail-note">Todavía no hay próximos partidos publicados para este equipo.</div>';
  return '<div class="team-fixture-table"><div class="team-fixture-heading"><span>DÍA</span><span>L/V</span><span>VS EQUIPO</span><span>HORA</span></div>'
    + fixtures.map(event => {
      const { home, away } = getParticipants(event);
      const isHome = profileTeamMatches(home, profile);
      const opponent = isHome ? away : home;
      const opponentTeam = opponent.team || opponent;
      const opponentName = opponentTeam.shortDisplayName || opponentTeam.displayName || opponentTeam.name || 'Rival';
      const date = event.date || getCompetition(event).date;
      const logo = opponentTeam.logo && /^https:\/\//i.test(opponentTeam.logo)
        ? '<img src="' + safe(opponentTeam.logo) + '" alt="" loading="lazy">'
        : '<span class="fixture-crest">' + safe(opponentTeam.abbreviation || 'FC') + '</span>';
      return '<div class="team-fixture-row"><span>' + safe(shortFixtureDate(date)) + '</span><b class="fixture-venue">' + (isHome ? 'L' : 'V') + '</b><span class="fixture-opponent">' + logo + '<strong>' + safe(opponentName) + '</strong></span><time>' + safe(localTime(date)) + '</time></div>';
    }).join('') + '</div>';
}
function renderTeamRoster(profile) {
  if (state.teamProfileLoading && !profile.roster) return '<div class="detail-note">Cargando el plantel completo…</div>';
  if (profile.rosterError && !profile.roster) return '<div class="detail-note">No se pudo cargar el plantel de este equipo.</div>';
  const players = collectRosterPlayers(profile.roster);
  if (!players.length) return '<div class="detail-note">ESPN todavía no publicó jugadores para este equipo.</div>';
  const groups = groupRoster(players);
  return '<div class="team-roster-summary"><strong>' + players.length + '</strong> JUGADORES · PLANTEL COMPLETO</div>'
    + groups.map(group => '<section class="roster-position-group"><h4>' + safe(group.name) + '<span>' + group.players.length + '</span></h4><ul>'
      + group.players.map(player => '<li><b>' + safe(player.jersey || '·') + '</b><span><strong>' + safe(player.name) + '</strong><small>' + safe(player.position || 'Posición no informada') + '</small></span></li>').join('')
      + '</ul></section>').join('');
}
function teamProfileStatus(profile) {
  const updated = profile.updatedAt
    ? new Intl.DateTimeFormat('es-AR', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(profile.updatedAt))
    : '';
  if (state.teamProfileLoading) return updated ? 'ACTUALIZANDO · ÚLTIMO DATO ' + updated : 'CARGANDO FICHA…';
  if (profile.refreshError) return updated ? 'ACTUALIZACIÓN PARCIAL · ÚLTIMO DATO ' + updated : 'SIN CONEXIÓN';
  return updated ? 'ACTUALIZADO ' + updated : 'DATOS NO DISPONIBLES';
}
function renderTeamProfile() {
  const profile = state.teamProfile;
  const team = profile?.team || {};
  const league = LEAGUES.find(item => item.id === profile?.leagueId) || LEAGUES[0];
  const teamName = team.displayName || team.name || team.shortDisplayName || 'Equipo';
  const logo = team.logo || team.logos?.[0]?.href;
  const initials = team.abbreviation || teamName.split(/\s+/).map(word => word[0]).join('').slice(0, 3);
  const crest = logo && /^https:\/\//i.test(logo)
    ? '<img class="team-profile-logo" src="' + safe(logo) + '" alt="" loading="lazy">'
    : '<span class="team-profile-logo-fallback">' + safe(initials) + '</span>';
  const playersTab = state.teamProfileTab === 'players';
  const content = playersTab ? renderTeamRoster(profile) : renderTeamUpcoming(profile);
  return '<aside class="match-details team-profile-panel" aria-label="Ficha de equipo">'
    + '<div class="team-profile-actions"><button type="button" class="team-profile-back" data-back-match>← VOLVER AL PARTIDO</button><button type="button" class="detail-close" data-close-match-details aria-label="Cerrar ficha">×</button></div>'
    + '<div class="team-profile-identity">' + crest + '<div><small>FICHA DEL EQUIPO · ' + safe(league.name) + '</small><h3>' + safe(teamName) + '</h3><span class="team-profile-updated">' + safe(teamProfileStatus(profile)) + '</span></div></div>'
    + '<div class="team-profile-tabs" role="tablist" aria-label="Secciones del equipo">'
    + '<button type="button" class="team-profile-tab ' + (playersTab ? '' : 'active') + '" data-team-tab="principal" role="tab" aria-selected="' + (!playersTab) + '">PRINCIPAL</button>'
    + '<button type="button" class="team-profile-tab ' + (playersTab ? 'active' : '') + '" data-team-tab="players" role="tab" aria-selected="' + playersTab + '">JUGADORES</button></div>'
    + '<div class="team-profile-content">'
    + (playersTab ? '<div class="team-profile-section-title"><h4>JUGADORES</h4><span>TODAS LAS POSICIONES</span></div>' : '<div class="team-profile-section-title"><h4>PRÓXIMOS PARTIDOS</h4><span>LOCAL / VISITANTE</span></div>')
    + (!playersTab ? renderTeamRecentForm(profile) : '') + content + '</div></aside>';
}
function teamProfileButton(competitor, side, title) {
  const teamId = competitor?.team?.id || competitor?.id;
  if (!teamId) return safe(title);
  return '<button type="button" class="team-profile-link" data-team-profile="' + side + '" aria-label="Ver ficha de ' + safe(title) + '">' + safe(title) + '</button>';
}
function renderLineupSide(title, players, side, competitor) {
  return '<div class="lineup-side"><h5>' + teamProfileButton(competitor, side, title) + '</h5><ol>' + players.map(player => '<li><b>' + safe(player.jersey || '·') + '</b><span title="' + safe(player.name) + '">' + safe(player.name) + '<small>' + safe(player.position) + '</small></span></li>').join('') + '</ol></div>';
}
function ratingKey(value) {
  if (value && typeof value === 'object') value = value.name || value.abbreviation || value.displayName || value.label || '';
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
function ratingNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const match = String(value ?? '').match(/-?\d+(?:[.,]\d+)?/);
  return match ? Number(match[0].replace(',', '.')) : undefined;
}
function playerStatsFromRecord(record, inheritedKeys = []) {
  const stats = {};
  const keys = record.keys || record.labels || record.statKeys || inheritedKeys;
  const raw = record.stats ?? record.values;
  if (Array.isArray(raw)) raw.forEach((value, index) => {
    if (value && typeof value === 'object') {
      const key = ratingKey(value.name || value.abbreviation || value.displayName || value.label || keys[index]);
      if (key) stats[key] = value.value ?? value.displayValue ?? value.display ?? value.stats;
      return;
    }
    const key = ratingKey(keys[index]);
    if (key) stats[key] = value;
  });
  else if (raw && typeof raw === 'object') Object.entries(raw).forEach(([key, value]) => { stats[ratingKey(key)] = value; });
  const individual = record.statistics;
  if (Array.isArray(individual)) individual.forEach(item => {
    if (!item || typeof item !== 'object') return;
    const key = ratingKey(item.name || item.abbreviation || item.displayName || item.label);
    if (key) stats[key] = item.displayValue ?? item.value ?? item.display ?? item.stats;
  });
  else if (individual && typeof individual === 'object') Object.entries(individual).forEach(([key, value]) => { stats[ratingKey(key)] = value?.displayValue ?? value?.value ?? value; });
  return stats;
}
function matchPlayerRatings(summary, event) {
  const { home, away } = getParticipants(event);
  const homeId = String(home.team?.id || home.id || ''), awayId = String(away.team?.id || away.id || '');
  const teams = new Map([[homeId, []], [awayId, []]].filter(([id]) => id));
  const entries = new Map();
  function upsert(player, teamId, stats = {}) {
    if (!player || !teams.has(teamId)) return;
    const name = player.displayName || player.fullName || player.name || player.shortName;
    if (!name) return;
    const id = String(player.id || player.athleteId || player.uid || name.toLowerCase());
    const key = teamId + '|' + id;
    let entry = entries.get(key);
    if (!entry) {
      entry = {
        id, name,
        surname: player.lastName || player.surname || '',
        position: player.position?.abbreviation || player.position?.displayName || player.position?.name || player.position || '',
        jersey: player.jersey || player.jerseyNumber || player.uniform || '',
        stats: {}, starter: false, goalkeeper: false
      };
      entries.set(key, entry);
      teams.get(teamId).push(entry);
    }
    Object.assign(entry.stats, stats);
    if (player.lastName || player.surname) entry.surname = player.lastName || player.surname;
    const positionText = [player.position?.name, player.position?.displayName, player.position?.abbreviation || player.position].filter(Boolean).join(' ').toLowerCase();
    if (/goalkeeper|arquero|portero|\bgk\b|\bpor\b/.test(positionText)) entry.goalkeeper = true;
    if (player.starter || player.isStarter || player.isStarting) entry.starter = true;
  }
  const starters = extractMatchLineups(summary, event);
  starters.home.forEach(player => {
    const id = homeId + '|' + String(player.id || player.name.toLowerCase());
    upsert({ ...player, starter: true }, homeId, {});
    entries.get(id) && (entries.get(id).starter = true);
  });
  starters.away.forEach(player => {
    const id = awayId + '|' + String(player.id || player.name.toLowerCase());
    upsert({ ...player, starter: true }, awayId, {});
    entries.get(id) && (entries.get(id).starter = true);
  });
  const teamIds = new Set([homeId, awayId].filter(Boolean));
  const containers = [summary?.boxscore?.players, summary?.boxscore?.playerStats, summary?.players, summary?.rosters, summary?.leaders];
  function walk(value, inheritedTeam = '', inheritedKeys = [], key = '', depth = 0) {
    if (!value || typeof value !== 'object' || depth > 12) return;
    if (Array.isArray(value)) {
      value.forEach(item => walk(item, inheritedTeam, inheritedKeys, key, depth + 1));
      return;
    }
    const candidate = String(value.team?.id || value.competitor?.id || value.teamId || value.team?.uid || '');
    const teamId = teamIds.has(candidate) ? candidate : key.toLowerCase() === 'home' ? homeId : key.toLowerCase() === 'away' ? awayId : inheritedTeam;
    const keys = value.keys || value.labels || value.statKeys || inheritedKeys;
    const athlete = value.athlete || value.player || value.person;
    if (athlete && teamId) upsert({ ...athlete, position: value.position || athlete.position, jersey: value.jersey || athlete.jersey, starter: value.starter ?? athlete.starter }, teamId, playerStatsFromRecord(value, keys));
    const childKeys = new Set(['statistics','athletes','players','entries','groups','stats','items','leaders','competitors','home','away','roster']);
    for (const [childKey, child] of Object.entries(value)) {
      if (childKeys.has(childKey.toLowerCase()) && !(athlete && childKey.toLowerCase() === 'stats'))
        walk(child, teamId, keys, childKey, depth + 1);
    }
  }
  containers.forEach(source => walk(source));
  const phase = matchState(event);
  const aliases = {
    minutes: ['minutes','minutesPlayed','playedMinutes','mins'],
    appearances: ['appearances'],
    subIns: ['subIns','substitutionsEntered'],
    goals: ['totalGoals','goals','goal'],
    assists: ['goalAssists','assists','assist','ast'],
    shotsOnTarget: ['shotsOnTarget','shotsOnGoal','sot'],
    totalShots: ['totalShots','shots','totalAttempts'],
    expectedGoals: ['expectedGoals','xG'],
    expectedAssists: ['expectedAssists','xA'],
    accuratePasses: ['accuratePasses','passesCompleted'],
    keyPasses: ['shotAssists','keyPasses','chancesCreated','bigChanceCreated','bigChancesCreated'],
    dribbles: ['successfulDribbles','dribblesCompleted','takeOnsWon'],
    tackles: ['effectiveTackles','successfulTackles','tackles','totalTackles'],
    interceptions: ['interceptions','defensiveInterventions'],
    defensiveInterventions: ['defensiveInterventions'],
    clearances: ['effectiveClearance','totalClearance','clearances'],
    recoveries: ['ballRecoveries','recoveries'],
    duelsWon: ['duelsWon','wonDuels','duelWon','effectiveDuels'],
    offsides: ['offsides'],
    saves: ['saves','goalkeeperSaves'],
    penaltiesSaved: ['penaltiesSaved','penaltySaves'],
    goalsConceded: ['goalsConceded','goalsAgainst'],
    shotsFaced: ['shotsFaced','goalkeeperShotsFaced'],
    yellowCards: ['yellowCards','yellowCard','yc'],
    redCards: ['redCards','redCard','rc'],
    ownGoals: ['ownGoals','ownGoal'],
    fouls: ['foulsCommitted','fouls'],
    dispossessed: ['dispossessed','turnovers','possessionLost'],
    errors: ['errorsLeadingToGoal','errors','mistakes'],
    penaltiesMissed: ['penaltiesMissed','penaltyMissed'],
    penaltiesConceded: ['penaltiesConceded','penaltyConceded'],
    bigChancesMissed: ['bigChancesMissed','bigChanceMissed']
  };
  const statNumber = (stats, names) => {
    for (const name of names) {
      const key = ratingKey(name);
      if (stats[key] !== undefined) return ratingNumber(stats[key]) ?? 0;
    }
    return undefined;
  };
  const number = (entry, key) => statNumber(entry.stats, aliases[key]);
  for (const players of teams.values()) players.forEach(player => {
    player.metrics = Object.fromEntries(Object.keys(aliases).map(key => [key, number(player, key)]).filter(([,value]) => value !== undefined));
    const pos = String(player.position || '').toLowerCase();
    player.goalkeeper = player.goalkeeper || /keeper|goal|arquero|portero|\bgk\b|\bpor\b/.test(pos) || player.metrics.saves !== undefined;
    const played = player.starter || (player.metrics.appearances || 0) > 0 || (player.metrics.subIns || 0) > 0
      || (player.metrics.minutes || 0) > 0
      || Object.entries(player.metrics).some(([key,value]) => !['minutes','appearances','subIns'].includes(key) && value > 0);
    player.played = played;
    let rating = 6, changes = [];
    const add = (label, value) => { if (value) { rating += value; changes.push((value > 0 ? '+' : '') + value.toFixed(2) + ' ' + label); } };
    const cap = (key, max) => Math.min(Math.max(player.metrics[key] || 0, 0), max);
    add('goles', cap('goals', 4) * 1.20);
    add('asistencias', cap('assists', 4) * 0.75);
    add('remates al arco', cap('shotsOnTarget', 6) * 0.10);
    add('remates', cap('totalShots', 8) * 0.04);
    add('goles esperados', Math.min(Math.max(player.metrics.expectedGoals || 0, 0), 2) * 0.20);
    add('asistencias esperadas', Math.min(Math.max(player.metrics.expectedAssists || 0, 0), 1.5) * 0.20);
    add('pases precisos', cap('accuratePasses', 80) * 0.005);
    add('pases clave', cap('keyPasses', 6) * 0.10);
    add('intervenciones defensivas', cap('defensiveInterventions', 8) * 0.05);
    add('fuera de juego', cap('offsides', 3) * -0.05);
    add('regates', cap('dribbles', 6) * 0.07);
    add('entradas', cap('tackles', 7) * 0.07);
    add('intercepciones', cap('interceptions', 7) * 0.07);
    add('despejes', cap('clearances', 8) * 0.04);
    add('recuperaciones', cap('recoveries', 12) * 0.025);
    add('duelos ganados', cap('duelsWon', 12) * 0.025);
    add('atajadas', cap('saves', 8) * 0.16);
    add('penal atajado', cap('penaltiesSaved', 2) * 0.70);
    add('tarjeta amarilla', cap('yellowCards', 2) * -0.40);
    add('tarjeta roja', cap('redCards', 2) * -1.80);
    add('gol en contra', cap('ownGoals', 2) * -1.80);
    add('faltas', cap('fouls', 8) * -0.025);
    add('pérdidas', cap('dispossessed', 8) * -0.05);
    add('error grave', cap('errors', 3) * -0.80);
    add('penal fallado', cap('penaltiesMissed', 2) * -0.70);
    add('penal cometido', cap('penaltiesConceded', 2) * -0.45);
    add('ocasión clara fallada', cap('bigChancesMissed', 4) * -0.20);
    if (player.goalkeeper) add('goles recibidos', cap('goalsConceded', 6) * -0.20);
    const pair = getParticipants(event);
    const teamScore = String(player.id) && teams.get(homeId)?.includes(player) ? Number(pair.home.score) : Number(pair.away.score);
    if (phase === 'finished' && teamScore === 0 && player.played && ((player.metrics.minutes || 0) >= 45 || (player.metrics.appearances || 0) > 0)) {
      add('arco en cero', player.goalkeeper ? 0.25 : /def|back|defensor|central|lateral/.test(pos) ? 0.15 : 0);
    }
    player.rating = Math.round(Math.max(0, Math.min(10, rating)) * 100) / 100;
    player.changes = changes;
    player.hasStats = Object.keys(player.metrics).some(key => player.metrics[key] !== 0);
  });
  for (const players of teams.values()) players.sort((a,b) => Number(b.starter)-Number(a.starter) || Number(b.metrics.minutes || 0)-Number(a.metrics.minutes || 0) || a.name.localeCompare(b.name, 'es'));
  return { home: teams.get(homeId) || [], away: teams.get(awayId) || [], confirmed: starters.confirmed, hasStats: [...entries.values()].some(player => player.hasStats) };
}
function ratingSurname(player) {
  if (player.surname) return String(player.surname).trim();
  const parts = String(player.name || '').trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : (parts[0] || '');
}
function renderPlayerRatingSide(name, players) {
  const rated = players.filter(player => player.played);
  if (!rated.length) return '<div class="detail-note">Todavía no hay jugadores publicados.</div>';
  return '<section class="rating-team"><h5>' + safe(name) + '</h5><ol class="player-rating-list">'
    + rated.map(player => {
      const delta = player.rating - 6;
      const deltaText = delta === 0 ? '6,00 inicial' : (delta > 0 ? '+' : '') + delta.toFixed(2).replace('.', ',');
      const title = player.changes.length ? player.changes.join(' · ') : 'Sin acciones individuales publicadas · nota base 6,00';
      const position = player.position ? '<small>' + safe(player.position) + '</small>' : '';
      return '<li title="' + safe(title) + '"><span class="rating-player"><b>' + safe(player.jersey || '·') + '</b><strong>' + safe(ratingSurname(player)) + position + '</strong></span><span class="rating-change ' + (delta > 0 ? 'up' : delta < 0 ? 'down' : '') + '">' + safe(deltaText) + '</span><b class="rating-score">' + player.rating.toFixed(2) + '</b></li>';
    }).join('') + '</ol></section>';
}
function renderPlayerRatings(event) {
  const ratings = matchPlayerRatings(state.matchDetails, event);
  const phase = matchState(event);
  const { home, away } = getParticipants(event);
  const label = phase === 'finished' ? 'NOTA FINAL' : phase === 'live' ? 'EN VIVO · ESTIMADA' : 'BASE · 6,00';
  const content = ratings.home.some(player => player.played) || ratings.away.some(player => player.played)
    ? '<div class="rating-sides">' + renderPlayerRatingSide(home.team?.shortDisplayName || home.team?.displayName || 'Local', ratings.home)
      + renderPlayerRatingSide(away.team?.shortDisplayName || away.team?.displayName || 'Visitante', ratings.away) + '</div>'
    : '<div class="detail-note">' + (phase === 'upcoming' ? 'Las notas comienzan en 6,00 cuando se confirmen las alineaciones.' : 'ESPN todavía no publicó los datos individuales de este partido.') + '</div>';
  return '<section class="detail-section player-ratings"><div class="detail-section-title"><h4>CALIFICACIONES</h4><span class="' + (phase === 'finished' ? 'confirmed' : '') + '">' + label + '</span></div>'
    + content + '<details class="rating-method"><summary>CRITERIOS Y ESCALA</summary><p>Base 6,00 · límite 0,00–10,00. Suma por goles, asistencias, remates al arco, pases clave, regates, entradas, intercepciones, despejes, recuperaciones, duelos ganados y atajadas. Resta por tarjetas, goles en contra, faltas, pérdidas, errores y penales fallados o cometidos. Se actualiza con las estadísticas que ESPN publique.</p></details></section>';
}
function renderMatchDetails(event) {
  if (state.teamProfile && state.teamProfile.matchId === String(event.id)) return renderTeamProfile();
  const { home, away } = getParticipants(event);
  const homeName = home.team?.shortDisplayName || home.team?.displayName || home.team?.name || 'Local';
  const awayName = away.team?.shortDisplayName || away.team?.displayName || away.team?.name || 'Visitante';
  const phase = matchState(event);
  const lineups = extractMatchLineups(state.matchDetails, event);
  const substitutions = collectSubstitutions(state.matchDetails, event);
  const loading = state.matchDetailsLoading && !state.matchDetails;
  const lineupStatus = lineups.confirmed ? 'CONFIRMADAS'
    : phase === 'upcoming' ? 'NO CONFIRMADAS'
    : state.matchDetailsError ? 'NO DISPONIBLES' : 'SIN PUBLICAR';
  const lineupContent = lineups.confirmed
    ? '<div class="lineup-teams">' + renderLineupSide(homeName, lineups.home, 'home', home) + renderLineupSide(awayName, lineups.away, 'away', away) + '</div>'
    : '<div class="detail-note">' + (loading ? 'Consultando la información del partido…' : phase === 'upcoming' ? 'Las alineaciones todavía no fueron confirmadas.' : state.matchDetailsError ? 'No se pudieron cargar las alineaciones.' : 'La fuente todavía no publicó las alineaciones.') + '</div>';
  const substitutionsContent = substitutions.length
    ? '<ol class="substitution-list">' + substitutions.map(item => '<li><b>' + safe(item.minute || 'CAMBIO') + '</b>' + (item.incoming && item.outgoing
      ? '<span class="substitution-pair"><span class="substitution-player entering"><i aria-hidden="true">↑</i><strong>' + safe(item.incoming) + '</strong></span><span class="substitution-player leaving"><i aria-hidden="true">↓</i><strong>' + safe(item.outgoing) + '</strong></span></span>'
      : '<span>' + safe(item.description) + '</span>') + '</li>').join('') + '</ol>'
    : '<div class="detail-note">' + (loading ? 'Buscando novedades…' : phase === 'upcoming' ? 'Los cambios aparecerán cuando empiece el partido.' : state.matchDetailsError ? 'No se pudieron cargar los cambios.' : phase === 'live' ? 'Todavía no hay cambios registrados.' : 'La fuente no publicó cambios para este partido.') + '</div>';
  const statusLabel = phase === 'live' ? 'EN JUEGO' : phase === 'finished' ? 'FINAL' : 'PRÓXIMO';
  const homeLink = teamProfileButton(home, 'home', homeName);
  const awayLink = teamProfileButton(away, 'away', awayName);
  return '<aside class="match-details" aria-label="Detalle del partido">'
    + '<div class="detail-heading"><div><span>DETALLE DEL PARTIDO · ' + statusLabel + '</span><h3>' + homeLink + ' <b>vs</b> ' + awayLink + '</h3></div><button type="button" class="detail-close" data-close-match-details aria-label="Cerrar detalle">×</button></div>'
    + renderFollowControls(event) + renderAdvancedStats(event)
    + renderPlayerRatings(event)
    + '<section class="detail-section"><div class="detail-section-title"><h4>ALINEACIONES</h4><span class="' + (lineups.confirmed ? 'confirmed' : '') + '">' + lineupStatus + '</span></div>' + lineupContent + '</section>'
    + '<section class="detail-section"><div class="detail-section-title"><h4>CAMBIOS</h4><span>' + substitutions.length + '</span></div>' + substitutionsContent + '</section>'
    + '</aside>';
}

function renderMatch(event) {
  const competition = getCompetition(event);
  const { home, away } = getParticipants(event);
  const phase = matchState(event);
  const homeScore = home.score;
  const awayScore = away.score;
  const scoreTotal = (Number(homeScore) || 0) + (Number(awayScore) || 0);
  const timeLabel = phase === 'live'
    ? `<span class="live-dot"></span>${safe(liveClockLabel(event))}`
    : phase === 'finished' ? 'FINAL' : safe(localTime(event.date || competition.date));
  const scoreMarkup = phase === 'upcoming' || homeScore == null || awayScore == null
    ? '<span class="dash">–</span>'
    : `<span>${safe(homeScore)}</span><span class="dash">–</span><span>${safe(awayScore)}</span>`;
  return `<article class="match-row ${state.followedMatchIds.has(String(event.id)) ? 'is-followed' : ''} ${phase === 'live' ? 'is-live' : ''} ${String(state.selectedMatchId) === String(event.id) ? 'is-selected' : ''}" data-state="${phase}" data-match-id="${safe(event.id || '')}" role="button" tabindex="0" aria-expanded="${String(state.selectedMatchId) === String(event.id)}" aria-label="Ver alineaciones y cambios de ${safe(home.team?.displayName || home.team?.name || 'equipo local')} contra ${safe(away.team?.displayName || away.team?.name || 'equipo visitante')}">
    <div class="match-time ${phase}">${timeLabel}</div>
    ${crest(home, 'home')}
    <div class="score">${scoreMarkup}</div>
    ${crest(away, 'away')}
    ${renderGoals(event, home, away, scoreTotal)}
  </article>`;
}
function renderMatches() {
  const list = document.querySelector('#matchList');
  const filtered = state.filter === 'all' ? state.matches : state.matches.filter(event => matchState(event) === state.filter);
  const labels = { all: 'No hay partidos programados para esta fecha.', live: 'No hay partidos en juego en este momento.', finished: 'Todavía no hay partidos finalizados.', upcoming: 'No hay próximos partidos para esta fecha.' };
  if (!state.feeds.length) {
    list.innerHTML = `<div class="empty-state">${safe(labels[state.filter] || labels.all)}</div>`;
  } else {
    list.innerHTML = state.feeds.map(feed => {
      const feedMatches = state.filter === 'all' ? feed.events : feed.events.filter(event => matchState(event) === state.filter);
      if (state.filter !== 'all' && !feedMatches.length) return '';
      const officialEvent = feed.events.find(event => event._officialSchedule);
      const seasonName = officialEvent?._officialSchedule || feed.data?.leagues?.[0]?.season?.type?.name || 'PARTIDOS DEL DÍA';
      const content = feed.error
        ? '<div class="empty-state error">No se pudieron cargar los partidos de esta liga.<br><button type="button" class="retry-feed">Reintentar</button></div>'
        : feedMatches.length ? feedMatches.map(renderMatch).join('')
          : `<div class="empty-state">${safe(state.filter === 'all' ? `No hay partidos programados para ${feed.league.name} en esta fecha.` : labels[state.filter])}</div>`;
      const tableLink = `<a href="#tablas" data-table-league="${safe(feed.league.id)}">VER TABLA <span>↗</span></a>`;
      const anchor = feed.league.id === 'arg.1' ? ' id="ligas"' : '';
      const selectedEvent = feedMatches.find(event => String(event.id) === String(state.selectedMatchId));
      const detail = selectedEvent ? renderMatchDetails(selectedEvent) : '';
      return `<section class="competition-group ${selectedEvent ? 'has-details' : ''}"${anchor}><div class="league-heading"><span class="league-icon">${safe(feed.league.icon || '⚽')}</span><div><strong>${safe(feed.league.name)}</strong><small>${safe(seasonName)}</small></div>${tableLink}</div><div class="competition-matches">${content}</div>${detail}</section>`;
    }).join('') || `<div class="empty-state">${safe(labels[state.filter] || labels.all)}</div>`;
  }
  for (const filter of ['all', 'live', 'finished', 'upcoming']) {
    const button = document.querySelector(`[data-filter="${filter}"]`);
    const count = filter === 'all' ? state.matches.length : state.matches.filter(event => matchState(event) === filter).length;
    button.querySelector('span').textContent = count;
  }
  const goalCount = state.matches.reduce((total, event) => {
    const { home, away } = getParticipants(event);
    return total + (Number(home.score) || 0) + (Number(away.score) || 0);
  }, 0);
  document.querySelector('#dayMatches').textContent = state.matches.length;
  document.querySelector('#dayGoals').textContent = goalCount;
  const liveCount = state.matches.filter(event => matchState(event) === 'live').length;
  if (state.scoresLoaded) setLivePill(liveCount ? `${liveCount} EN JUEGO` : 'DATOS ACTUALIZADOS');
  list.querySelectorAll('.retry-feed').forEach(button => button.addEventListener('click', loadScores));
  list.querySelectorAll('.match-row[data-match-id]').forEach(row => {
    const openDetails = () => {
      const event = state.matches.find(item => String(item.id) === row.dataset.matchId);
      if (!event) return;
      if (state.selectedMatchId === String(event.id)) {
        state.selectedMatchId = null;
        state.matchDetails = null;
        state.matchDetailsLoading = false;
        state.teamProfile = null;
        state.teamProfileLoading = false;
        state.teamProfileRequest += 1;
        state.matchDetailRequest += 1;
        renderMatches();
        return;
      }
      state.selectedMatchId = String(event.id);
      state.matchDetails = null;
      state.matchDetailsLoading = true;
      state.matchDetailsError = false;
      state.teamProfile = null;
      state.teamProfileLoading = false;
      state.teamProfileRequest += 1;
      state.matchDetailRequest += 1;
      renderMatches();
      loadMatchDetails(event, true);
    };
    row.addEventListener('click', openDetails);
    row.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openDetails();
      }
    });
  });
  list.querySelector('[data-close-match-details]')?.addEventListener('click', () => {
    state.selectedMatchId = null;
    state.matchDetails = null;
    state.matchDetailsLoading = false;
    state.teamProfile = null;
    state.teamProfileLoading = false;
    state.teamProfileRequest += 1;
    state.matchDetailRequest += 1;
    renderMatches();
  });
  list.querySelectorAll('[data-follow-match]').forEach(button => button.addEventListener('click', () => {
    const id = button.dataset.followMatch;
    if (state.followedMatchIds.has(id)) state.followedMatchIds.delete(id);
    else state.followedMatchIds.add(id);
    writeLocalData(FOLLOWED_MATCHES_KEY, [...state.followedMatchIds]);
    renderMatches();
  }));
  list.querySelector('[data-enable-alerts]')?.addEventListener('click', enableMatchAlerts);
  list.querySelectorAll('[data-team-profile]').forEach(button => button.addEventListener('click', () => {
    const event = state.matches.find(item => String(item.id) === state.selectedMatchId);
    if (!event) return;
    const { home, away } = getParticipants(event);
    const competitor = button.dataset.teamProfile === 'home' ? home : away;
    openTeamProfile(event, competitor);
  }));
  list.querySelectorAll('[data-team-tab]').forEach(button => button.addEventListener('click', () => {
    state.teamProfileTab = button.dataset.teamTab;
    renderMatches();
  }));
  list.querySelector('[data-back-match]')?.addEventListener('click', () => {
    state.teamProfile = null;
    state.teamProfileLoading = false;
    state.teamProfileRequest += 1;
    renderMatches();
  });
  list.querySelectorAll('[data-table-league]').forEach(link => link.addEventListener('click', () => {
    state.activeStandings = link.dataset.tableLeague;
    state.activeTable = 0;
    renderStandings();
  }));
}
function openTeamProfile(event, competitor) {
  const team = competitor.team || competitor;
  const teamId = String(team.id || competitor.id || '');
  const leagueId = event._leagueId || 'arg.1';
  const request = ++state.teamProfileRequest;
  state.teamProfile = {
    matchId: String(event.id),
    teamId,
    team,
    leagueId,
    roster: null,
    schedule: null,
    rosterError: !teamId,
    scheduleError: !teamId,
    updatedAt: null,
    refreshError: false
  };
  state.teamProfileTab = 'principal';
  state.teamProfileLoading = Boolean(teamId);
  renderMatches();
  if (teamId) loadTeamProfile(event, teamId, leagueId, request);
}
async function loadTeamProfile(event, teamId, leagueId, request, preserveScroll = false) {
  const league = LEAGUES.find(item => item.id === leagueId) || LEAGUES[0];
  const year = dateParts(todayKey()).year;
  const base = '/' + league.path + '/teams/' + encodeURIComponent(teamId);
  const rosterPrimary = base + '/roster?season=' + year + '&region=ar&lang=es&limit=500';
  const rosterFallback = base + '/roster?region=ar&lang=es&limit=500';
  const schedulePrimary = base + '/schedule?season=' + year + '&region=ar&lang=es';
  const scheduleFallback = base + '/schedule?region=ar&lang=es';
  const rosterRequest = fetchFromEspn(rosterPrimary).catch(() => fetchFromEspn(rosterFallback));
  const scheduleRequest = fetchFromEspn(schedulePrimary).catch(() => fetchFromEspn(scheduleFallback));
  const [rosterResult, scheduleResult] = await Promise.allSettled([rosterRequest, scheduleRequest]);
  if (request !== state.teamProfileRequest || state.teamProfile?.matchId !== String(event.id) || state.teamProfile?.teamId !== String(teamId)) return;
  const previous = state.teamProfile;
  const rosterFailed = rosterResult.status !== 'fulfilled';
  const scheduleFailed = scheduleResult.status !== 'fulfilled';
  const refreshed = !rosterFailed || !scheduleFailed;
  const scrollTop = preserveScroll ? document.querySelector('.team-profile-content')?.scrollTop || 0 : 0;
  state.teamProfile = {
    ...previous,
    roster: rosterFailed ? previous.roster : rosterResult.value,
    schedule: scheduleFailed ? previous.schedule : scheduleResult.value,
    rosterError: rosterFailed && !previous.roster,
    scheduleError: scheduleFailed && !previous.schedule,
    refreshError: rosterFailed || scheduleFailed,
    updatedAt: refreshed ? Date.now() : previous.updatedAt
  };
  state.teamProfileLoading = false;
  renderMatches();
  if (preserveScroll) {
    const content = document.querySelector('.team-profile-content');
    if (content) content.scrollTop = scrollTop;
  }
}
async function loadMatchDetails(event, keepPanel = false) {
  const matchId = String(event.id || '');
  const request = ++state.matchDetailRequest;
  const officialFixture = matchId.startsWith('official-schedule-');
  const league = LEAGUES.find(item => item.id === event._leagueId) || LEAGUES[0];
  if (!officialFixture) {
    if (!keepPanel) {
      state.matchDetailsLoading = true;
      state.matchDetailsError = false;
      renderMatches();
    }
    try {
      const summary = await fetchFromEspn(`/${league.path}/summary?event=${encodeURIComponent(matchId)}&region=ar&lang=es`);
      if (request === state.matchDetailRequest && state.selectedMatchId === matchId) {
        state.matchDetails = summary;
        state.matchDetailsError = false;
        if (state.followedMatchIds.has(matchId)) notifyMatchDetailChanges(matchId, summary, event);
      }
    } catch (error) {
      if (request === state.matchDetailRequest && state.selectedMatchId === matchId) {
        state.matchDetailsError = true;
      }
    }
  }
  if (request === state.matchDetailRequest && state.selectedMatchId === matchId) {
    state.matchDetailsLoading = false;
    renderMatches();
  }
}
async function loadScores() {
  document.querySelector('#selectedDate').textContent = formatDate(state.date).toLocaleUpperCase('es-AR');
  setFeedStatus('Buscando partidos y goles…', 'loading');
  setLivePill('CARGANDO DATOS', 'loading');
  try {
    const date = espnDate(state.date);
    const feeds = await Promise.all(LEAGUES.map(async league => {
      try {
        const data = await fetchFromEspn(`/${league.path}/scoreboard?dates=${date}&limit=100&region=ar&lang=es`);
        const clockSyncedAt = Date.now();
        const events = Array.isArray(data.events) ? data.events.map(event => ({ ...event, _leagueId: league.id, _clockSyncedAt: clockSyncedAt })) : [];
        return { league, data, events: mergeOfficialSchedule(state.date, league, events), error: false };
      } catch (error) {
        const events = mergeOfficialSchedule(state.date, league, []);
        return { league, data: null, events, error: !events.length };
      }
    }));
    if (feeds.every(feed => feed.error)) throw new Error('No se pudo obtener información de ninguna liga.');
    const previousMatches = state.matches;
    const nextMatches = feeds.flatMap(feed => feed.events);
    if (state.matchSnapshotsInitialized) notifyFollowedMatchChanges(previousMatches, nextMatches);
    state.feeds = feeds;
    state.matches = nextMatches;
    state.matchSnapshotsInitialized = true;
    refreshFollowedLiveCards(nextMatches);
    state.scoresLoaded = true;
    state.season = feeds.find(feed => feed.league.id === 'arg.1')?.data?.leagues?.[0]?.season || state.season;
    document.querySelector('#competitionLabel').textContent = 'ARGENTINA · EUROPA · SUDAMÉRICA · ESPN';
    renderMatches();
    const time = new Intl.DateTimeFormat('es-AR', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit' }).format(new Date());
    const cadence = state.date === todayKey() ? ' · se actualiza cada minuto' : '';
    const failedFeeds = feeds.filter(feed => feed.error).length;
    if (failedFeeds) setLivePill('DATOS PARCIALES', 'error');
    const officialScheduleNote = feeds.some(feed => feed.events.some(event => event._officialSchedule)) ? ' · calendario oficial como respaldo' : '';
    setFeedStatus(`Actualizado ${time} · ${state.matches.length} partidos${officialScheduleNote}${failedFeeds ? ` · ${failedFeeds} ligas sin conexión` : cadence}`, failedFeeds ? 'error' : 'ok');
  } catch (error) {
    console.error('No se pudieron cargar los partidos de ESPN:', error);
    if (!state.scoresLoaded) {
      state.matches = [];
      state.feeds = [];
      renderMatches();
    }
    setFeedStatus(state.scoresLoaded ? 'Sin conexión · se muestran los datos de la última actualización.' : 'No se pudo conectar con los datos de partidos.', 'error');
    setLivePill('SIN CONEXIÓN', 'error');
    if (!state.scoresLoaded) {
      document.querySelector('#matchList').insertAdjacentHTML('beforeend', '<div class="empty-state error">Revisá tu conexión e intentá de nuevo.<br><button type="button" id="retryScores">Reintentar</button></div>');
      document.querySelector('#retryScores')?.addEventListener('click', loadScores);
    }
  }
}
function normalizedStats(entry) {
  return Object.fromEntries((entry.stats || []).map(stat => [String(stat.name || stat.abbreviation || '').toLowerCase().replace(/[^a-z]/g, ''), stat.displayValue ?? stat.value ?? '—']));
}
function statValue(stats, names) {
  for (const name of names) {
    const value = stats[name];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return '—';
}
function numericStat(entry, names) {
  const value = statValue(normalizedStats(entry), names);
  if (value === '—') return null;
  const parsed = Number(String(value).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}
function compareStandingsEntries(a, b) {
  const tieBreakers = [
    ['points', 'pts'],
    ['goaldifferential', 'pointdifferential', 'goaldifference', 'gd'],
    ['goalsfor', 'pointsfor', 'gf'],
    ['wins', 'w']
  ];
  for (const names of tieBreakers) {
    const aValue = numericStat(a, names);
    const bValue = numericStat(b, names);
    if (aValue !== null && bValue !== null && aValue !== bValue) return bValue - aValue;
  }
  return 0;
}
function collectStandingsTables(data) {
  const tables = [];
  function walk(node, inheritedName = '') {
    if (!node || typeof node !== 'object') return;
    const children = node.children || node.groups || node.divisions;
    if (Array.isArray(children) && children.length) {
      children.forEach(child => walk(child, child.name || child.abbreviation || inheritedName));
      return;
    }
    const container = node.standings || node;
    if (Array.isArray(container.entries) && container.entries.length) {
      tables.push({ name: node.name || node.abbreviation || inheritedName || 'Tabla general', entries: container.entries });
    }
  }
  walk(data);
  if (!tables.length && Array.isArray(data.entries)) tables.push({ name: 'Tabla general', entries: data.entries });
  return tables;
}
function rowFromEntry(entry, index, sequentialRank = false) {
  const team = entry.team || {};
  const stats = normalizedStats(entry);
  const abbreviation = team.abbreviation || team.name?.split(/\s+/).map(word => word[0]).join('').slice(0, 3) || 'FC';
  const logo = team.logo && /^https:\/\//i.test(team.logo) ? `<img class="club-logo" src="${safe(team.logo)}" alt="" loading="lazy">` : `<span class="club-crest">${safe(abbreviation)}</span>`;
  const rank = sequentialRank ? index + 1 : statValue(stats, ['rank', 'playoffrank']);
  return `<tr><td class="position">${safe(rank === '—' ? index + 1 : rank)}</td><td class="club"><span class="club-wrap">${logo}<span>${safe(team.displayName || team.name || 'Equipo')}</span></span></td><td class="points">${safe(statValue(stats, ['points', 'pts']))}</td><td>${safe(statValue(stats, ['gamesplayed', 'played', 'gp', 'matchesplayed']))}</td><td class="goal-difference">${safe(statValue(stats, ['goaldifferential', 'pointdifferential', 'goaldifference', 'gd']))}</td><td>${safe(statValue(stats, ['wins', 'w']))}</td><td>${safe(statValue(stats, ['ties', 'draws', 'd']))}</td><td>${safe(statValue(stats, ['losses', 'l']))}</td></tr>`;
}
function seasonTypeId(data) {
  return String(data.season?.type?.id ?? data.seasonType?.id ?? data.seasontype ?? '');
}
function annualNumber(entry, aliases) {
  const keys = aliases.map(name => name.toLowerCase().replace(/[^a-z]/g, ''));
  const stat = (entry.stats || []).find(item => keys.includes(String(item.name || item.abbreviation || '').toLowerCase().replace(/[^a-z]/g, '')));
  const value = Number(stat?.value ?? stat?.displayValue);
  return Number.isFinite(value) ? value : null;
}
function combineAnnualTables(apertura, clausura) {
  if (seasonTypeId(apertura) !== '5' || seasonTypeId(clausura) !== '6') return null;
  const totals = new Map();
  for (const source of [apertura, clausura]) {
    const tables = collectStandingsTables(source);
    if (!tables.length) return null;
    for (const table of tables) for (const entry of table.entries) {
      const team = entry.team || {};
      const id = String(team.id || '');
      const played = annualNumber(entry, ['gamesPlayed', 'played', 'gp']);
      const wins = annualNumber(entry, ['wins', 'w']);
      const draws = annualNumber(entry, ['ties', 'draws', 'd']);
      const losses = annualNumber(entry, ['losses', 'l']);
      const goalsFor = annualNumber(entry, ['pointsFor', 'goalsFor', 'gf']);
      const goalsAgainst = annualNumber(entry, ['pointsAgainst', 'goalsAgainst', 'ga']);
      const points = annualNumber(entry, ['points', 'pts']);
      if (!id || [played, wins, draws, losses, goalsFor, goalsAgainst, points].some(value => value === null)) return null;
      const total = totals.get(id) || { team, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };
      total.played += played;
      total.wins += wins;
      total.draws += draws;
      total.losses += losses;
      total.goalsFor += goalsFor;
      total.goalsAgainst += goalsAgainst;
      total.points += points;
      totals.set(id, total);
    }
  }
  const sorted = [...totals.values()].sort((a, b) => b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst) || b.goalsFor - a.goalsFor);
  return sorted.map((total, index) => {
    const difference = total.goalsFor - total.goalsAgainst;
    const stat = (name, value) => ({ name, value, displayValue: String(value) });
    return { team: total.team, stats: [
      stat('rank', index + 1), stat('points', total.points), stat('gamesPlayed', total.played),
      { name: 'pointDifferential', value: difference, displayValue: `${difference > 0 ? '+' : ''}${difference}` },
      stat('wins', total.wins), stat('ties', total.draws), stat('losses', total.losses),
      stat('pointsFor', total.goalsFor), stat('pointsAgainst', total.goalsAgainst)
    ] };
  });
}
async function loadAnnualTable(year, currentData) {
  const currentType = seasonTypeId(currentData);
  if (currentType !== '5' && currentType !== '6') return null;
  let apertura = currentType === '5' ? currentData : null;
  let clausura = currentType === '6' ? currentData : null;
  try {
    if (!apertura) apertura = await fetchFromEspn(`/${ARG_LEAGUE}/standings?season=${year}&seasontype=5&region=ar&lang=es`, TABLE_BASE, TABLE_FALLBACK);
    if (!clausura) clausura = await fetchFromEspn(`/${ARG_LEAGUE}/standings?season=${year}&seasontype=6&region=ar&lang=es`, TABLE_BASE, TABLE_FALLBACK);
    return combineAnnualTables(apertura, clausura);
  } catch (error) {
    console.warn('La fuente no entregó las dos fases necesarias para la tabla anual.', error);
    return null;
  }
}
function renderStandings() {
  const competitions = document.querySelector('#standingsCompetitions');
  const tabs = document.querySelector('#standingsTabs');
  const body = document.querySelector('#standingsBody');
  const active = state.tableData[state.activeStandings] || { tables: [], league: LEAGUES.find(item => item.id === state.activeStandings), error: false };
  const league = active.league || LEAGUES[0];
  const tableData = active.tables || [];
  competitions.innerHTML = LEAGUES.map(item => `<button class="competition-tab ${item.id === state.activeStandings ? 'active' : ''}" data-table-competition="${safe(item.id)}" role="tab" aria-selected="${item.id === state.activeStandings}">${safe(item.name)}</button>`).join('');
  competitions.querySelectorAll('[data-table-competition]').forEach(button => button.addEventListener('click', () => {
    state.activeStandings = button.dataset.tableCompetition;
    state.activeTable = 0;
    renderStandings();
  }));
  const seasonName = active.data?.leagues?.[0]?.season?.displayName || active.data?.season?.displayName || active.data?.season?.type?.name || 'POSICIONES';
  document.querySelector('#tableCompetition').textContent = `${league.name} · ${seasonName}`;
  if (!tableData.length) {
    tabs.innerHTML = '';
    body.innerHTML = `<tr><td class="empty-table" colspan="8">${active.error ? 'No se pudieron cargar las posiciones de esta competencia.' : 'La fuente todavía no publicó una tabla para esta competencia.'}</td></tr>`;
    document.querySelector('#teamCount').textContent = '—';
    return;
  }
  state.activeTable = Math.min(state.activeTable, tableData.length - 1);
  tabs.innerHTML = tableData.map((table, index) => {
    const title = table.name.replace(/(?:group|grupo)\s*a/i, 'Zona A').replace(/(?:group|grupo)\s*b/i, 'Zona B');
    return `<button class="table-tab ${index === state.activeTable ? 'active' : ''}" data-standings-index="${index}" role="tab" aria-selected="${index === state.activeTable}">${safe(title.toLocaleUpperCase('es-AR'))}</button>`;
  }).join('');
  const selectedTable = tableData[state.activeTable];
  const isAnnual = /(?:tabla\s*anual|annual)/i.test(selectedTable.name || '');
  const isArgentinaZones = state.activeStandings === 'arg.1' && !isAnnual && tableData.length > 1;
  const entries = isArgentinaZones ? [...selectedTable.entries].sort(compareStandingsEntries) : selectedTable.entries;
  body.innerHTML = entries.map((entry, index) => rowFromEntry(entry, index, isArgentinaZones)).join('');
  const clubCount = new Set(tableData.flatMap(table => table.entries.map(entry => String(entry.team?.id || entry.team?.name || '')))).size;
  document.querySelector('#teamCount').textContent = clubCount || '—';
  tabs.querySelectorAll('[data-standings-index]').forEach(button => button.addEventListener('click', () => {
    state.activeTable = Number(button.dataset.standingsIndex);
    renderStandings();
  }));
}
async function loadStandings() {
  document.querySelector('#tableStatus').textContent = 'Cargando tablas de ESPN…';
  const year = dateParts(todayKey()).year;
  const feeds = await Promise.all(LEAGUES.map(async league => {
    try {
      const data = await fetchFromEspn(`/${league.path}/standings?season=${year}&region=ar&lang=es`, TABLE_BASE, TABLE_FALLBACK);
      let tables = collectStandingsTables(data);
      let annualAvailable = false;
      if (league.id === ARG_LEAGUE.split('/').at(-1)) {
        const annual = await loadAnnualTable(year, data);
        if (annual?.length) {
          tables = [...tables, { name: 'Tabla anual', entries: annual }];
          annualAvailable = true;
        }
      }
      return { league, data, tables, error: false, annualAvailable };
    } catch (error) {
      console.warn(`No se pudo cargar la tabla de ${league.name}.`, error);
      return { league, data: null, tables: [], error: true, annualAvailable: false };
    }
  }));
  state.tableData = Object.fromEntries(feeds.map(feed => [feed.league.id, feed]));
  const argFeed = state.tableData['arg.1'];
  state.tables = argFeed?.tables || [];
  renderStandings();
  const time = new Intl.DateTimeFormat('es-AR', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit' }).format(new Date());
  const available = feeds.filter(feed => feed.tables.length).length;
  const argAnnual = Boolean(argFeed?.annualAvailable);
  document.querySelector('#tableStatus').textContent = `${available} de ${LEAGUES.length} tablas disponibles en ESPN${argAnnual ? ' · tabla anual suma Apertura y Clausura' : ''} · actualizado ${time}`;
}
async function loadAll() {
  await Promise.all([loadScores(), loadStandings()]);
}
document.querySelectorAll('.filter').forEach(button => button.addEventListener('click', () => {
  document.querySelector('.filter.active')?.classList.remove('active');
  button.classList.add('active');
  state.filter = button.dataset.filter;
  state.selectedMatchId = null;
  state.matchDetails = null;
  state.matchDetailsLoading = false;
  state.teamProfile = null;
  state.teamProfileLoading = false;
  state.teamProfileRequest += 1;
  state.matchDetailRequest += 1;
  renderMatches();
}));
function selectDate(date) {
  state.date = date;
  state.selectedMatchId = null;
  state.matchDetails = null;
  state.matchDetailsLoading = false;
  state.teamProfile = null;
  state.teamProfileLoading = false;
  state.teamProfileRequest += 1;
  state.matchDetailRequest += 1;
  document.querySelector('#datePicker').value = date;
  state.matches = [];
  state.feeds = [];
  state.scoresLoaded = false;
  renderMatches();
  loadAll();
}
document.querySelector('#prevDate').addEventListener('click', () => selectDate(shiftDate(state.date, -1)));
document.querySelector('#nextDate').addEventListener('click', () => selectDate(shiftDate(state.date, 1)));
document.querySelector('#todayButton').addEventListener('click', () => selectDate(todayKey()));
const datePicker = document.querySelector('#datePicker');
datePicker.value = state.date;
datePicker.addEventListener('change', () => {
  if (datePicker.value) selectDate(datePicker.value);
});
loadAll();
window.setInterval(() => {
  if (state.date === todayKey()) loadScores();
}, 60_000);
window.setInterval(() => {
  if (state.date !== todayKey()) loadScores();
}, 15 * 60_000);
window.setInterval(() => {
  if (!state.selectedMatchId) return;
  const event = state.matches.find(item => String(item.id) === state.selectedMatchId);
  if (!event) return;
  const id = String(event.id), finished = matchState(event) === 'finished';
  if (!finished || !state.finalDetailsLoadedFor.has(id)) {
    if (finished) state.finalDetailsLoadedFor.add(id);
    loadMatchDetails(event, true);
  }
}, 60_000);
window.setInterval(updateVisibleLiveClocks, 15_000);
window.setInterval(() => {
  const profile = state.teamProfile;
  if (!profile?.teamId || state.teamProfileLoading) return;
  const event = state.matches.find(item => String(item.id) === profile.matchId);
  if (!event) return;
  state.teamProfileLoading = true;
  const status = document.querySelector('.team-profile-updated');
  if (status) status.textContent = teamProfileStatus(profile);
  const request = ++state.teamProfileRequest;
  loadTeamProfile(event, profile.teamId, profile.leagueId, request, true);
}, 15 * 60_000);
window.setInterval(() => { loadStandings(); }, 15 * 60_000);
