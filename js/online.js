// Online spil via Supabase: login, lobby med spilkode, ture og besked i realtid.
'use strict';

const ONLINE = {
  url: 'https://hmvyggzhrtqrijfzafia.supabase.co',
  key: 'sb_publishable_MHCKiFpfnUK275fDnw_Thg_TkxiqWH1',
  sb: null, user: null,
  game: null,        // række fra tabellen games
  players: [],       // rækker fra players, sorteret efter plads
  version: 0,
  chan: null,
  lobbyChan: null,
  secrets: {},       // spillerkoder pr. spil-id
  messages: [],

  async ready() {
    if (this.user) return true;
    if (!window.supabase || !window.supabase.createClient) throw new Error('Online-biblioteket kunne ikke hentes. Tjek din internetforbindelse.');
    if (!this.sb) this.sb = window.supabase.createClient(this.url, this.key, { auth: { persistSession: true, storageKey: 'imperium-online-auth', autoRefreshToken: true } });
    const { data } = await this.sb.auth.getSession();
    if (!data.session) {
      const r = await this.sb.auth.signInAnonymously();
      if (r.error) throw new Error(r.error.message.includes('Anonymous') ? 'Anonymt login er ikke slået til i Supabase-projektet.' : r.error.message);
    }
    const u = await this.sb.auth.getUser();
    this.user = u.data.user;
    return true;
  },
  err(e) { const m = (e && (e.message || e.details)) || String(e); return m.replace(/^.*?:\s*(?=[A-ZÆØÅ])/, ''); },

  async createGame(name, civKey, settings) {
    await this.ready();
    const { data, error } = await this.sb.rpc('create_game', { p_name: name, p_civ: civKey, p_settings: settings });
    if (error) throw error;
    return data[0];
  },
  async joinGame(code, name, civKey) {
    await this.ready();
    const { data, error } = await this.sb.rpc('join_game', { p_code: code, p_name: name, p_civ: civKey });
    if (error) throw error;
    return data;
  },
  async leaveGame(id) {
    await this.ready();
    const { error } = await this.sb.rpc('leave_game', { p_game: id });
    if (error) throw error;
  },
  async myGames() {
    await this.ready();
    const { data, error } = await this.sb.from('players').select('seat, civ, name, games(id, code, status, turn, current_player, updated_at, host)').eq('user_id', this.user.id);
    if (error) throw error;
    return (data || []).filter(r => r.games).sort((a, b) => (b.games.updated_at || '').localeCompare(a.games.updated_at || ''));
  },
  async loadSecrets() {
    const { data } = await this.sb.from('player_secrets').select('game_id, code');
    this.secrets = {};
    for (const r of data || []) this.secrets[r.game_id] = r.code;
    return this.secrets;
  },
  async recover(code, secret) {
    await this.ready();
    const { data, error } = await this.sb.rpc('recover_seat', { p_code: code, p_secret: secret });
    if (error) throw error;
    return data;
  },
  async setAI(seat, on) {
    const { error } = await this.sb.rpc('set_ai', { p_game: this.game.id, p_seat: seat, p_ai: on });
    if (error) throw error;
  },
  isHost() { return !!(this.game && this.user && this.game.host === this.user.id); },
  seatIsAI(seat) { const p = this.players.find(x => x.seat === seat); return !!(p && p.is_ai); },
  // Computerstyrede pladser bliver almindelige computerspillere i spillet, og de vender tilbage, når spilleren gør
  syncSeats() {
    if (!G.online || !G.online.seats) return;
    G.online.seats.forEach((seat, cid) => {
      const cv = civ(cid);
      if (!cv || !cv.alive) return;
      const ai = this.seatIsAI(seat);
      if (ai && cv.human && cid !== G.human) { cv.human = false; G.humans = G.humans.filter(x => x !== cid); }
      else if (!ai && !cv.human) {
        cv.human = true;
        if (!G.humans.includes(cid)) G.humans.push(cid);
        G.humans.sort((a, b) => G.online.seats[a] - G.online.seats[b]);
        if (!G.exploredBy[cid]) G.exploredBy[cid] = new Array(G.w * G.h).fill(0);
      }
    });
  },
  // Værten spiller turen for de pladser, computeren styrer, indtil det er en rigtig spillers tur
  async playAITurns() {
    let n = 0;
    const cur = this.civOfSeat(this.game.current_player);
    if (cur >= 0) { G.human = cur; G.explored = G.exploredBy[cur] || G.explored; }
    while (this.game.status === 'playing' && !G.over && this.isHost() && this.seatIsAI(this.seatOfCiv(G.human)) && n < 8) {
      const cv = civ(G.human);
      aiPlay(cv);
      endTurn();
      this.syncSeats();
      n++;
    }
    if (n) await this.push();
    return n;
  },
  async loadMessages() {
    const { data } = await this.sb.from('messages').select('id, user_id, name, body, created_at').eq('game_id', this.game.id).order('id', { ascending: false }).limit(60);
    this.messages = (data || []).reverse();
    return this.messages;
  },
  async sendMessage(body) {
    const me = this.players.find(p => p.user_id === this.user.id);
    const { error } = await this.sb.from('messages').insert({ game_id: this.game.id, user_id: this.user.id, name: me ? me.name : '?', body: body.slice(0, 300) });
    if (error) throw error;
  },

  async fetch(id) {
    const g = await this.sb.from('games').select('*').eq('id', id).single();
    if (g.error) throw g.error;
    const p = await this.sb.from('players').select('*').eq('game_id', id).order('seat');
    if (p.error) throw p.error;
    this.game = g.data; this.players = p.data || []; this.version = g.data.version;
    return g.data;
  },
  mySeat() { const me = this.players.find(p => p.user_id === this.user.id); return me ? me.seat : null; },
  seatOfCiv(cid) { return G.online && G.online.seats ? G.online.seats[cid] : null; },
  civOfSeat(seat) { return G.online && G.online.seats ? G.online.seats.indexOf(seat) : -1; },
  myCiv() { return this.civOfSeat(this.mySeat()); },
  nameOfCiv(cid) {
    const seat = this.seatOfCiv(cid);
    const p = this.players.find(x => x.seat === seat);
    return p ? p.name : null;
  },
  isMyTurn() { return !!(this.game && this.game.status === 'playing' && this.game.current_player === this.mySeat()); },

  subscribe(id, onChange, onMessage) {
    this.unsubscribe();
    let ch = this.sb.channel('imperium-' + id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: 'id=eq.' + id }, () => onChange('game'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: 'game_id=eq.' + id }, () => onChange('players'));
    if (onMessage) ch = ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'game_id=eq.' + id }, (pl) => onMessage(pl.new));
    this.chan = ch.subscribe();
  },
  unsubscribe() { if (this.chan) { this.sb.removeChannel(this.chan); this.chan = null; } },

  // Værten starter spillet ud fra lobbyens spillere
  async start() {
    const s = this.game.settings || {};
    const ps = this.players.slice().sort((a, b) => a.seat - b.seat);
    newGame({ civ: ps[0].civ, humans: ps.map(p => p.civ), opponents: Math.min(s.opponents ?? 3, CIVS.length - ps.length), size: s.size || 'medium',
      difficulty: s.difficulty || 'normal', mapType: s.mapType || 'continents', minors: s.minors, tutorial: s.tutorial !== false, pace: s.pace, victories: s.victories });
    G.online = { id: this.game.id, code: this.game.code, seats: ps.map(p => p.seat), names: ps.map(p => p.name) };
    const nv = await this.push('playing');
    return nv;
  },
  // Gem spillet efter din tur. G.human er den spiller, der skal spille nu.
  async push(status) {
    this.syncSeats();
    const packed = await packSave(saveData());
    const next = this.seatOfCiv(G.human);
    const { data, error } = await this.sb.rpc('submit_turn', { p_game: this.game.id, p_version: this.version, p_state: JSON.stringify(packed), p_turn: G.turn, p_next: next, p_status: status || (G.over ? 'over' : 'playing') });
    if (error) throw error;
    this.version = data;
    this.game.version = data; this.game.current_player = next; this.game.status = status || (G.over ? 'over' : 'playing');
    return data;
  },
  // Hent spillets tilstand og vis det fra din egen plads
  async pull() {
    const row = await this.fetch(this.game.id);
    if (!row.state) return false;
    const str = await unpackSave(JSON.parse(row.state));
    if (!loadFromString(str)) return false;
    this.viewAsMe();
    return true;
  },
  viewAsMe() {
    const me = this.myCiv();
    if (me < 0) return;
    G.human = me;
    if (!G.exploredBy[me]) G.exploredBy[me] = new Array(G.w * G.h).fill(0);
    G.explored = G.exploredBy[me];
    updateVisibility();
  },
};

// ---------- Brugerflade ----------
Object.assign(UI, {
  online: null, readOnly: false,

  onlineName() { try { return localStorage.getItem('imperium-name') || ''; } catch (e) { return ''; } },
  setOnlineName(n) { try { localStorage.setItem('imperium-name', n); } catch (e) { /* ingen lager */ } },
  startSettings() {
    const mv = $('#opt-minors').value;
    return { opponents: +$('#opt-opp').value, size: $('#opt-size').value, difficulty: $('#opt-diff').value, mapType: $('#opt-map').value, minors: mv === 'auto' ? undefined : +mv, tutorial: $('#opt-guide').checked, pace: $('#opt-pace').value, victories: this.victoryChoice() };
  },

  async openOnline(tab) {
    this.onlineTab = tab || this.onlineTab || 'list';
    const civName = (k) => (CIVS.find(c => c.key === k) || {}).name || k;
    const tabs = [['list', 'Mine spil'], ['create', 'Opret spil'], ['join', 'Deltag med kode'], ['recover', 'Fortsæt på denne enhed']];
    const bg = this.modal('Spil online', `<div class="tabs">${tabs.map(([k, n]) => `<button type="button" data-otab="${k}" class="${this.onlineTab === k ? 'on' : ''}">${n}</button>`).join('')}</div><div id="online-body"><p class="sub">Forbinder …</p></div>`, '', true);
    bg.querySelectorAll('[data-otab]').forEach(b => b.onclick = () => this.openOnline(b.dataset.otab));
    const body = bg.querySelector('#online-body');
    try { await ONLINE.ready(); } catch (e) { body.innerHTML = `<p class="dmsg bad">${esc(ONLINE.err(e))}</p>`; return; }
    const nameField = `<label class="field" for="on-name"><span class="label">Dit navn</span><input id="on-name" maxlength="24" value="${esc(this.onlineName())}" placeholder="Fx Rasmus"></label>`;
    const civField = `<label class="field" for="on-civ"><span class="label">Dit folk</span><select id="on-civ">${CIVS.map(c => `<option value="${c.key}" ${c.key === (this.chosenCiv || 'dk') ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>`;
    if (this.onlineTab === 'create') {
      const s = this.startSettings();
      body.innerHTML = `<div class="row2">${nameField}${civField}</div>
        <p class="sub">Spillet bruger indstillingerne fra startskærmen: ${esc(MAPSIZES[s.size].name.toLowerCase())} kort, ${esc(MAPTYPES[s.mapType].name.toLowerCase())}, ${s.opponents} computermodstandere, sværhedsgrad ${esc(DIFFICULTY[s.difficulty].name.toLowerCase())}, ${esc(PACES[s.pace].name.toLowerCase())} tempo.</p>
        <button type="button" class="act primary" id="on-create">Opret spil og få en kode</button><p id="on-msg"></p>`;
      bg.querySelector('#on-create').onclick = async () => {
        const name = bg.querySelector('#on-name').value.trim();
        if (!name) { bg.querySelector('#on-msg').innerHTML = '<span class="dmsg bad">Skriv dit navn først.</span>'; return; }
        this.setOnlineName(name);
        try { const g = await ONLINE.createGame(name, bg.querySelector('#on-civ').value, s); this.openLobby(g.id); }
        catch (e) { bg.querySelector('#on-msg').innerHTML = `<span class="dmsg bad">${esc(ONLINE.err(e))}</span>`; }
      };
    } else if (this.onlineTab === 'join') {
      body.innerHTML = `<div class="row2"><label class="field" for="on-code"><span class="label">Spilkode</span><input id="on-code" maxlength="5" placeholder="ABCDE" style="text-transform:uppercase;letter-spacing:.2em;font-weight:800"></label>${nameField}${civField}</div>
        <button type="button" class="act primary" id="on-join">Deltag</button><p id="on-msg"></p>`;
      bg.querySelector('#on-join').onclick = async () => {
        const name = bg.querySelector('#on-name').value.trim(), code = bg.querySelector('#on-code').value.trim();
        if (!name || code.length < 5) { bg.querySelector('#on-msg').innerHTML = '<span class="dmsg bad">Skriv både spilkode og navn.</span>'; return; }
        this.setOnlineName(name);
        try { const id = await ONLINE.joinGame(code, name, bg.querySelector('#on-civ').value); this.openLobby(id); }
        catch (e) { bg.querySelector('#on-msg').innerHTML = `<span class="dmsg bad">${esc(ONLINE.err(e))}</span>`; }
      };
    } else if (this.onlineTab === 'recover') {
      body.innerHTML = `<p>Har du startet et spil på en anden enhed, kan du fortsætte her. Du skal bruge spilkoden og din personlige spillerkode. Spillerkoden står under <b>Mine spil</b> og under <b>Spillere</b> på den enhed, du spillede på før.</p>
        <div class="row2"><label class="field" for="on-code"><span class="label">Spilkode</span><input id="on-code" maxlength="5" placeholder="ABCDE" style="text-transform:uppercase;letter-spacing:.2em;font-weight:800"></label>
        <label class="field" for="on-secret"><span class="label">Spillerkode</span><input id="on-secret" maxlength="9" placeholder="ABCD-EFGH" style="text-transform:uppercase;letter-spacing:.12em;font-weight:800"></label></div>
        <button type="button" class="act primary" id="on-recover">Fortsæt her</button><p id="on-msg"></p>`;
      bg.querySelector('#on-recover').onclick = async () => {
        const code = bg.querySelector('#on-code').value.trim(), secret = bg.querySelector('#on-secret').value.trim();
        if (code.length < 5 || secret.length < 8) { bg.querySelector('#on-msg').innerHTML = '<span class="dmsg bad">Skriv både spilkode og spillerkode.</span>'; return; }
        try { const id = await ONLINE.recover(code, secret); this.openLobby(id); }
        catch (e) { bg.querySelector('#on-msg').innerHTML = `<span class="dmsg bad">${esc(ONLINE.err(e))}</span>`; }
      };
    } else {
      try {
        const rows = await ONLINE.myGames();
        await ONLINE.loadSecrets().catch(() => ({}));
        const st = (g, r) => g.status === 'lobby' ? 'Venter i lobbyen' : g.status === 'over' ? 'Slut' : g.current_player === r.seat ? '<b style="color:var(--good)">Din tur</b>' : 'Venter på de andre';
        body.innerHTML = rows.length ? `<div class="slots">${rows.map(r => `<div class="slot"><div><b>Kode ${esc(r.games.code)} · ${esc(civName(r.civ))}</b><span>${st(r.games, r)} · tur ${r.games.turn || 0}${ONLINE.secrets[r.games.id] ? ` · din spillerkode <b class="pcode">${esc(ONLINE.secrets[r.games.id])}</b>` : ''}</span></div><button type="button" class="act ${r.games.status === 'playing' && r.games.current_player === r.seat ? 'primary' : ''}" data-open="${r.games.id}">Åbn</button></div>`).join('')}</div>`
          : '<p>Du er ikke med i nogen onlinespil endnu. Opret et spil, eller deltag med en kode fra en ven.</p>';
        bg.querySelectorAll('[data-open]').forEach(b => b.onclick = () => this.openLobby(b.dataset.open));
      } catch (e) { body.innerHTML = `<p class="dmsg bad">${esc(ONLINE.err(e))}</p>`; }
    }
  },

  async openLobby(id) {
    try { await ONLINE.fetch(id); await ONLINE.loadSecrets(); } catch (e) { notify(G.human, ONLINE.err(e), null, 'bad'); return; }
    if (ONLINE.game.status !== 'lobby') { this.closeModal(true); this.enterOnline(); return; }
    const render = () => {
      const g = ONLINE.game;
      const host = g.host === ONLINE.user.id;
      const civName = (k) => (CIVS.find(c => c.key === k) || {}).name || k;
      const colorOf = (k) => (CIVS.find(c => c.key === k) || {}).color || '#888';
      const bg = this.modal('Lobby', `<div class="lobby-code"><span class="label">Spilkode</span><b>${esc(g.code)}</b><button type="button" class="act" id="lb-copy">Kopiér</button></div>
        <p>Send koden til dine venner. De åbner spillet, vælger <b>Spil online → Deltag med kode</b> og taster koden.</p>
        <div class="section-h">Spillere (${ONLINE.players.length}/4)</div>
        <div class="diplo">${ONLINE.players.map(p => `<div class="drow"><i style="background:${colorOf(p.civ)}"></i><div><div class="nm">${esc(p.name)}${p.user_id === g.host ? ' <span class="chip w">Vært</span>' : ''}${p.user_id === ONLINE.user.id ? ' <span class="chip">Dig</span>' : ''}</div><div class="meta">${esc(civName(p.civ))}</div></div><span></span></div>`).join('')}</div>
        ${ONLINE.secrets[g.id] ? `<p class="sub">Din personlige spillerkode er <b class="pcode">${esc(ONLINE.secrets[g.id])}</b>. Gem den, hvis du vil fortsætte på en anden enhed. Del den ikke med andre.</p>` : ''}
        <p class="sub">${host ? 'Når alle er med, starter du spillet. Turene går i den rækkefølge, spillerne kom ind.' : 'Venter på, at værten starter spillet.'}</p>`,
        `<button type="button" class="act danger" id="lb-leave">${host ? 'Slet spillet' : 'Forlad'}</button>${host ? `<button type="button" class="act primary" id="lb-start">Start spillet</button>` : ''}`);
      bg.querySelector('#lb-copy').onclick = (e) => { navigator.clipboard.writeText(g.code).then(() => { e.target.textContent = 'Kopieret'; }, () => {}); };
      bg.querySelector('#lb-leave').onclick = async () => { try { await ONLINE.leaveGame(g.id); } catch (e) { /* ignorer */ } ONLINE.unsubscribe(); this.closeModal(true); this.openOnline('list'); };
      const sb = bg.querySelector('#lb-start');
      if (sb) sb.onclick = async () => {
        sb.disabled = true; sb.textContent = 'Starter …';
        try { await ONLINE.start(); this.closeModal(true); this.enterOnline(true); }
        catch (e) { sb.disabled = false; sb.textContent = 'Start spillet'; notify(G.human, ONLINE.err(e), null, 'bad'); }
      };
    };
    render();
    ONLINE.subscribe(id, async () => {
      try { await ONLINE.fetch(id); } catch (e) { return; }
      if (ONLINE.game.status !== 'lobby') { this.closeModal(true); this.enterOnline(); }
      else if (document.querySelector('.modal-bg h2') && document.querySelector('.modal-bg h2').textContent === 'Lobby') render();
    });
  },

  // Åbn et onlinespil, der er i gang
  async enterOnline(alreadyLoaded) {
    this.online = { id: ONLINE.game.id };
    if (!alreadyLoaded) {
      const ok = await ONLINE.pull().catch(() => false);
      if (!ok) { notify(G.human, 'Spillet kunne ikke hentes.', null, 'bad'); return; }
    } else ONLINE.viewAsMe();
    this.enterGame();
    this.chatUnread = 0;
    ONLINE.loadSecrets().catch(() => {});
    ONLINE.loadMessages().then(() => { this.renderChat(); }).catch(() => {});
    this.applyOnlineTurn(true);
    ONLINE.subscribe(ONLINE.game.id, async (what) => {
      const before = ONLINE.version;
      try { await ONLINE.fetch(ONLINE.game.id); } catch (e) { return; }
      if (this.busy) return;
      if (what === 'game' && ONLINE.version !== before) {
        await ONLINE.pull();
        this.sel = null; this.reach = null;
        if (await this.hostTakeover()) return;
        this.applyOnlineTurn(false);
        if (G.over) this.showGameOver();
      } else {
        if (await this.hostTakeover(true)) return;
        this.renderOnlineBar();
        if (document.querySelector('.modal-bg [data-seats]')) this.openSeats();
      }
    }, (m) => this.onChatMessage(m));
    this.hostTakeover(true);
  },

  // Er det en computerstyret plads' tur, spiller værten den. Returnerer true, hvis noget blev spillet.
  async hostTakeover(needPull) {
    const g = ONLINE.game;
    if (!g || g.status !== 'playing' || !ONLINE.isHost() || !ONLINE.seatIsAI(g.current_player) || this.busy) return false;
    this.busy = true; $('#busy').hidden = false; $('#busy span').textContent = 'Computeren spiller for en fraværende spiller …';
    let n = 0;
    try {
      if (needPull) await ONLINE.pull();
      n = await ONLINE.playAITurns();
    } catch (e) {
      notify(G.human, `Computeren kunne ikke tage turen: ${ONLINE.err(e)}`, null, 'bad');
      await ONLINE.pull().catch(() => {});
    }
    this.busy = false; $('#busy').hidden = true; $('#busy span').textContent = 'Modstanderne trækker …';
    ONLINE.viewAsMe();
    this.sel = null; this.reach = null;
    this.applyOnlineTurn(false);
    if (G.over) this.showGameOver();
    return true;
  },

  // ---------- Spillere: overtagelse og spillerkode ----------
  openSeats() {
    const g = ONLINE.game, host = ONLINE.isHost();
    const colorOf = (cid) => civ(cid) ? civ(cid).color : '#888';
    const rows = ONLINE.players.map(p => {
      const cid = ONLINE.civOfSeat(p.seat), cv = civ(cid);
      const me = p.user_id === ONLINE.user.id;
      const btn = host && !me && cv && cv.alive && g.status === 'playing'
        ? `<button type="button" class="act" data-ai="${p.seat}" data-on="${p.is_ai ? 0 : 1}">${p.is_ai ? 'Giv pladsen tilbage' : 'Lad computeren styre'}</button>` : '<span></span>';
      return `<div class="drow"><i style="background:${colorOf(cid)}"></i><div><div class="nm">${esc(p.name)}${p.user_id === g.host ? ' <span class="chip w">Vært</span>' : ''}${me ? ' <span class="chip">Dig</span>' : ''}${p.is_ai ? ` <span class="chip">${ART.miscGlyph('robot', 13)} Computer styrer</span>` : ''}${g.current_player === p.seat ? ' <span class="chip ok">Har turen</span>' : ''}</div><div class="meta">${esc(cv ? cv.name : p.civ)}${cv && !cv.alive ? ' · faldet' : ''}</div></div>${btn}</div>`;
    }).join('');
    const code = ONLINE.secrets[g.id];
    const bg = this.modal('Spillere', `<div data-seats class="diplo">${rows}</div>
      ${host ? '<p class="sub">Er en spiller væk, kan du lade computeren styre pladsen, så spillet ikke går i stå. Computeren spiller fra din enhed, så du skal have spillet åbent. Spilleren får pladsen igen, når du giver den tilbage.</p>' : '<p class="sub">Kun værten kan lade computeren styre en plads.</p>'}
      ${code ? `<div class="lobby-code"><span class="label">Din spillerkode</span><b class="pcode">${esc(code)}</b><button type="button" class="act" id="lb-pcopy">Kopiér</button></div><p class="sub">Med spilkoden ${esc(g.code)} og spillerkoden kan du fortsætte på en anden enhed under <b>Spil online → Fortsæt på denne enhed</b>. Del den ikke med andre.</p>` : ''}`, '', true);
    const pc = bg.querySelector('#lb-pcopy');
    if (pc) pc.onclick = (e) => { navigator.clipboard.writeText(code).then(() => { e.target.textContent = 'Kopieret'; }, () => {}); };
    bg.querySelectorAll('[data-ai]').forEach(b => b.onclick = async () => {
      b.disabled = true;
      try {
        await ONLINE.setAI(+b.dataset.ai, b.dataset.on === '1');
        await ONLINE.fetch(g.id);
        if (await this.hostTakeover(true)) { this.openSeats(); return; }
      } catch (e) { notify(G.human, ONLINE.err(e), null, 'bad'); }
      this.renderOnlineBar();
      this.openSeats();
    });
  },

  // ---------- Chat ----------
  onChatMessage(m) {
    if (!m || ONLINE.messages.some(x => x.id === m.id)) return;
    ONLINE.messages.push(m);
    if (ONLINE.messages.length > 100) ONLINE.messages.shift();
    const open = !$('#chat').hidden;
    if (!open && m.user_id !== ONLINE.user.id) {
      this.chatUnread = (this.chatUnread || 0) + 1;
      SFX.play('click');
      if (document.hidden) this.notifyBrowser(`${m.name}: ${m.body}`);
    }
    this.renderChat();
    this.renderOnlineBar();
  },
  renderChat() {
    const el = $('#chat');
    if (!el || el.hidden) return;
    const log = el.querySelector('.chat-log');
    const t = (s) => { try { return new Date(s).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };
    log.innerHTML = ONLINE.messages.length ? ONLINE.messages.map(m => `<div class="cmsg ${m.user_id === ONLINE.user.id ? 'me' : ''}"><b>${esc(m.name)}</b> <em>${t(m.created_at)}</em><div>${esc(m.body)}</div></div>`).join('') : '<p class="sub">Ingen beskeder endnu. Sig hej.</p>';
    log.scrollTop = log.scrollHeight;
  },
  toggleChat(force) {
    const el = $('#chat');
    el.hidden = force === undefined ? !el.hidden : !force;
    if (!el.hidden) {
      this.chatUnread = 0;
      this.renderChat();
      const inp = el.querySelector('input');
      setTimeout(() => inp.focus(), 30);
    }
    this.renderOnlineBar();
  },
  initChat() {
    const el = $('#chat');
    if (el.dataset.ready) return;
    el.dataset.ready = '1';
    el.querySelector('.x').onclick = () => this.toggleChat(false);
    el.querySelector('form').onsubmit = async (e) => {
      e.preventDefault();
      const inp = el.querySelector('input');
      const v = inp.value.trim();
      if (!v) return;
      inp.value = '';
      try { await ONLINE.sendMessage(v); }
      catch (err) { inp.value = v; notify(G.human, `Beskeden kunne ikke sendes: ${ONLINE.err(err)}`, null, 'bad'); }
    };
    el.addEventListener('keydown', e => e.stopPropagation());
  },

  // ---------- Besked i browseren ----------
  notifyBrowser(text) {
    try {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      const n = new Notification('Imperium', { body: text, tag: 'imperium-' + (ONLINE.game ? ONLINE.game.id : '') });
      n.onclick = () => { window.focus(); n.close(); };
    } catch (e) { /* ikke understøttet */ }
  },
  async askNotify() {
    try {
      if (!('Notification' in window)) { notify(G.human, 'Din browser kan ikke vise beskeder.', null, 'info'); return; }
      const r = await Notification.requestPermission();
      notify(G.human, r === 'granted' ? 'Du får nu en besked i browseren, når det er din tur.' : 'Beskeder i browseren er slået fra. Du kan slå dem til i browserens indstillinger.', null, r === 'granted' ? 'good' : 'info');
    } catch (e) { /* ignorer */ }
    this.renderOnlineBar();
  },

  applyOnlineTurn(first) {
    const mine = ONLINE.isMyTurn();
    this.readOnly = !mine && ONLINE.game.status !== 'over';
    document.body.classList.toggle('readonly', this.readOnly);
    this.renderOnlineBar();
    if (mine) {
      document.title = '(Din tur) Imperium';
      if (!first && document.hidden) this.notifyBrowser(`Det er din tur i ${yearLabel(G.turn)} (tur ${G.turn}).`);
      const h = human();
      const inbox = (h.inbox || []).slice(-12);
      h.inbox = [];
      if (!first) SFX.play('tech');
      this.selectNext(true);
      this.refresh();
      if (inbox.length) {
        this.modal('Din tur', `<p>Det er din tur i ${yearLabel(G.turn)} (tur ${G.turn}). Siden sidst:</p><div class="log">${inbox.map(e => `<div class="${e.kind}"><em>Tur ${e.turn}</em>${esc(e.text)}</div>`).join('')}</div>`, `<button type="button" class="act primary" id="yt-ok">Spil</button>`);
        this.afterModal = () => this.nextOffer();
        document.querySelector('#yt-ok').onclick = () => this.closeModal();
      } else this.nextOffer();
    } else {
      document.title = 'Imperium';
      this.sel = null;
      this.refresh();
    }
  },

  renderOnlineBar() {
    const el = $('#online-bar');
    if (!this.online || !ONLINE.game) { el.hidden = true; return; }
    const g = ONLINE.game;
    const curCiv = ONLINE.civOfSeat(g.current_player);
    const who = curCiv >= 0 ? `${ONLINE.nameOfCiv(curCiv) || 'en spiller'} (${civ(curCiv).name})` : '';
    const aiTurn = g.status === 'playing' && ONLINE.seatIsAI(g.current_player);
    const canAsk = 'Notification' in window && Notification.permission === 'default';
    const unread = this.chatUnread || 0;
    el.innerHTML = `<span class="label">Online · kode ${esc(g.code)}</span>
      <b class="${ONLINE.isMyTurn() ? 'go' : ''}">${g.status === 'over' ? 'Spillet er slut' : ONLINE.isMyTurn() ? 'Din tur' : aiTurn ? `Computeren spiller for ${esc(who)}` : `Venter på ${esc(who)}`}</b>
      <button type="button" class="act ico" id="ob-chat" title="Chat" aria-label="Chat">${ART.miscGlyph('chat', 18)}${unread ? `<i class="badge">${unread > 9 ? '9+' : unread}</i>` : ''}</button>
      <button type="button" class="act ico" id="ob-seats" title="Spillere" aria-label="Spillere">${ART.miscGlyph('players', 18)}</button>
      ${canAsk ? `<button type="button" class="act ico" id="ob-bell" title="Få besked, når det er din tur" aria-label="Få besked, når det er din tur">${ART.miscGlyph('bell', 18)}</button>` : ''}
      <button type="button" class="act" id="ob-games">Mine spil</button>`;
    el.hidden = false;
    this.initChat();
    $('#ob-games').onclick = () => this.openOnline('list');
    $('#ob-chat').onclick = () => this.toggleChat();
    $('#ob-seats').onclick = () => this.openSeats();
    if (canAsk) $('#ob-bell').onclick = () => this.askNotify();
  },

  // Kaldes efter endTurn() i et onlinespil
  async finishOnlineTurn(res) {
    void res;
    this.busy = true; $('#busy').hidden = false; $('#busy span').textContent = 'Sender turen …';
    try { await ONLINE.push(); }
    catch (e) {
      this.busy = false; $('#busy').hidden = true; $('#busy span').textContent = 'Modstanderne trækker …';
      notify(G.human, `Turen kunne ikke sendes: ${ONLINE.err(e)} Spillet hentes igen.`, null, 'bad');
      await ONLINE.pull().catch(() => {}); this.applyOnlineTurn(false); return;
    }
    this.busy = false; $('#busy').hidden = true; $('#busy span').textContent = 'Modstanderne trækker …';
    ONLINE.viewAsMe();
    if (G.over) { this.refresh(); this.showGameOver(); return; }
    if (await this.hostTakeover()) return;
    this.applyOnlineTurn(false);
  },
});
