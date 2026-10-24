const SCORE_BASE = 'https://site.api.espn.com/apis/site/v2/sports';
const SCORE_FALLBACK = 'https://site.web.api.espn.com/apis/site/v2/sports';
const TABLE_BASE = 'https://site.api.espn.com/apis/v2/sports';
const TABLE_FALLBACK = 'https://site.web.api.espn.com/apis/v2/sports';
const ARG_LEAGUE = 'soccer/arg.1';
const LEAGUES = [
  { id: 'arg.1', path: 'soccer/arg.1', name: 'LIGA PROFESIONAL' },
  { id: 'eng.1', path: 'soccer/eng.1', name: 'PREMIER LEAGUE' },
  { id: 'esp.1', path: 'soccer/esp.1', name: 'LA LIGA' }
];
const TIME_ZONE = 'America/Argentina/Buenos_Aires';
const state = { date: todayKey(), matches: [], feeds: [], tables: [], activeTable: 0, filter: 'all', season: null, scoresLoaded: false };

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
      const seasonName = feed.data?.leagues?.[0]?.season?.type?.name || 'PARTIDOS DEL DÍA';
      const content = feed.error
        ? '<div class="empty-state error">No se pudieron cargar los partidos de esta liga.</div>'
        : feedMatches.length ? feedMatches.map(renderMatch).join('')
          : `<div class="empty-state">${safe(state.filter === 'all' ? `No hay partidos programados para ${feed.league.name} en esta fecha.` : labels[state.filter])}</div>`;
      const tableLink = feed.league.id === 'arg.1' ? '<a href="#tablas">VER TABLA <span>↗</span></a>' : '';
      const anchor = feed.league.id === 'arg.1' ? ' id="ligas"' : '';
      return `<section class="competition-group"${anchor}><div class="league-heading"><span class="league-icon">⚽</span><div><strong>${safe(feed.league.name)}</strong><small>${safe(seasonName)}</small></div>${tableLink}</div><div class="competition-matches">${content}</div></section>`;
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
        return { league, data, events, error: false };
      } catch (error) {
        return { league, data: null, events: [], error: true };
      }
    }));
    if (feeds.every(feed => feed.error)) throw new Error('No se pudo obtener información de ninguna liga.');
    state.feeds = feeds;
    state.matches = feeds.flatMap(feed => feed.events);
    state.scoresLoaded = true;
    state.season = feeds.find(feed => feed.league.id === 'arg.1')?.data?.leagues?.[0]?.season || state.season;
    const competitionType = state.season?.type?.name || state.season?.type?.abbreviation || 'LIGA PROFESIONAL';
    document.querySelector('#competitionLabel').textContent = 'PARTIDOS DE ARGENTINA Y EUROPA · ESPN';
    renderMatches();
    const time = new Intl.DateTimeFormat('es-AR', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit' }).format(new Date());
    const cadence = state.date === todayKey() ? ' · se actualiza cada minuto' : '';
    const failedFeeds = feeds.filter(feed => feed.error).length;
    setFeedStatus(`Actualizado ${time} · ${state.matches.length} partidos${failedFeeds ? ` · ${failedFeeds} ligas sin conexión` : cadence}`, failedFeeds ? 'error' : 'ok');
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
function rowFromEntry(entry, index) {
  const team = entry.team || {};
  const stats = normalizedStats(entry);
  const abbreviation = team.abbreviation || team.name?.split(/\s+/).map(word => word[0]).join('').slice(0, 3) || 'FC';
  const logo = team.logo && /^https:\/\//i.test(team.logo) ? `<img class="club-logo" src="${safe(team.logo)}" alt="" loading="lazy">` : `<span class="club-crest">${safe(abbreviation)}</span>`;
  const rank = statValue(stats, ['rank', 'playoffrank']);
  return `<tr><td class="position">${safe(rank === '—' ? index + 1 : rank)}</td><td class="club"><span class="club-wrap">${logo}<span>${safe(team.displayName || team.name || 'Equipo')}</span></span></td><td class="points">${safe(statValue(stats, ['points', 'pts']))}</td><td>${safe(statValue(stats, ['gamesplayed', 'played', 'gp', 'matchesplayed']))}</td><td class="goal-difference">${safe(statValue(stats, ['goaldifferential', 'pointdifferential', 'goaldifference', 'gd']))}</td><td>${safe(statValue(stats, ['wins', 'w']))}</td><td>${safe(statValue(stats, ['ties', 'draws', 'd']))}</td><td>${safe(statValue(stats, ['losses', 'l']))}</td></tr>`;
}
function renderStandings() {
  const tabs = document.querySelector('#standingsTabs');
  const body = document.querySelector('#standingsBody');
  if (!state.tables.length) {
    tabs.innerHTML = '';
    body.innerHTML = '<tr><td class="empty-table" colspan="8">Todavía no hay posiciones disponibles para esta competencia.</td></tr>';
    return;
  }
  state.activeTable = Math.min(state.activeTable, state.tables.length - 1);
  tabs.innerHTML = state.tables.map((table, index) => {
    const title = table.name.replace(/group\s*a/i, 'Zona A').replace(/group\s*b/i, 'Zona B');
    return `<button class="table-tab ${index === state.activeTable ? 'active' : ''}" data-standings-index="${index}" role="tab" aria-selected="${index === state.activeTable}">${safe(title.toLocaleUpperCase('es-AR'))}</button>`;
  }).join('');
  body.innerHTML = state.tables[state.activeTable].entries.map(rowFromEntry).join('');
  const clubCount = new Set(state.tables.flatMap(table => table.entries.map(entry => String(entry.team?.id || entry.team?.name || '')))).size;
  document.querySelector('#teamCount').textContent = clubCount || '—';
  tabs.querySelectorAll('[data-standings-index]').forEach(button => button.addEventListener('click', () => {
    state.activeTable = Number(button.dataset.standingsIndex);
    renderStandings();
  }));
}
async function loadStandings() {
  document.querySelector('#tableStatus').textContent = 'Cargando posiciones de ESPN…';
  try {
    const year = dateParts(todayKey()).year;
    const data = await fetchFromEspn(`/${ARG_LEAGUE}/standings?season=${year}&region=ar&lang=es`, TABLE_BASE, TABLE_FALLBACK);
    state.tables = collectStandingsTables(data);
    renderStandings();
    const time = new Intl.DateTimeFormat('es-AR', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit' }).format(new Date());
    document.querySelector('#tableCompetition').textContent = `${state.season?.type?.name || 'LIGA PROFESIONAL'} · ${year}`;
    document.querySelector('#tableStatus').textContent = `Posiciones de ESPN · actualizado ${time}`;
  } catch (error) {
    console.error('No se pudo cargar la tabla de ESPN:', error);
    state.tables = [];
    renderStandings();
    document.querySelector('#tableStatus').textContent = 'No se pudo conectar con la tabla de posiciones.';
  }
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
  state.matches = [];
  state.feeds = [];
  state.scoresLoaded = false;
  renderMatches();
  loadAll();
}
document.querySelector('#prevDate').addEventListener('click', () => selectDate(shiftDate(state.date, -1)));
document.querySelector('#nextDate').addEventListener('click', () => selectDate(shiftDate(state.date, 1)));
document.querySelector('#todayButton').addEventListener('click', () => selectDate(todayKey()));
loadAll();
window.setInterval(() => {
  if (state.date === todayKey()) loadScores();
}, 60_000);
window.setInterval(() => { loadStandings(); }, 15 * 60_000);
