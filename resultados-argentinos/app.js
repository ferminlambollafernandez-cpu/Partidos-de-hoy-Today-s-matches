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
const state = { date: todayKey(), matches: [], feeds: [], tables: [], tableData: {}, activeStandings: 'arg.1', activeTable: 0, filter: 'all', season: null, scoresLoaded: false };

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
    const minute = detail.clock?.displayValue || detail.displayValue || '';
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
function renderMatch(event) {
  const competition = getCompetition(event);
  const { home, away } = getParticipants(event);
  const status = competition.status || event.status || {};
  const phase = matchState(event);
  const homeScore = home.score;
  const awayScore = away.score;
  const scoreTotal = (Number(homeScore) || 0) + (Number(awayScore) || 0);
  const timeLabel = phase === 'live'
    ? `<span class="live-dot"></span>${safe(status.displayClock || status.type?.shortDetail || 'EN JUEGO')}`
    : phase === 'finished' ? 'FINAL' : safe(localTime(event.date || competition.date));
  const scoreMarkup = phase === 'upcoming' || homeScore == null || awayScore == null
    ? '<span class="dash">–</span>'
    : `<span>${safe(homeScore)}</span><span class="dash">–</span><span>${safe(awayScore)}</span>`;
  return `<article class="match-row ${phase === 'live' ? 'is-live' : ''}" data-state="${phase}">
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
      return `<section class="competition-group"${anchor}><div class="league-heading"><span class="league-icon">${safe(feed.league.icon || '⚽')}</span><div><strong>${safe(feed.league.name)}</strong><small>${safe(seasonName)}</small></div>${tableLink}</div><div class="competition-matches">${content}</div></section>`;
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
  list.querySelectorAll('[data-table-league]').forEach(link => link.addEventListener('click', () => {
    state.activeStandings = link.dataset.tableLeague;
    state.activeTable = 0;
    renderStandings();
  }));
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
        const events = Array.isArray(data.events) ? data.events.map(event => ({ ...event, _leagueId: league.id })) : [];
        return { league, data, events: mergeOfficialSchedule(state.date, league, events), error: false };
      } catch (error) {
        const events = mergeOfficialSchedule(state.date, league, []);
        return { league, data: null, events, error: !events.length };
      }
    }));
    if (feeds.every(feed => feed.error)) throw new Error('No se pudo obtener información de ninguna liga.');
    state.feeds = feeds;
    state.matches = feeds.flatMap(feed => feed.events);
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
  renderMatches();
}));
function selectDate(date) {
  state.date = date;
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
window.setInterval(() => { loadStandings(); }, 15 * 60_000);
