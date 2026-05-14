/**
 * energie-card-3fase
 * ─────────────────────────────────────────────────────────────────────────────
 * Installatie:
 *   1. Kopieer dit bestand naar /config/www/energie-card-3fase.js
 *   2. Instellingen → Dashboards → ⋮ → Bronnen beheren → Toevoegen:
 *        URL:  /local/energie-card-3fase.js
 *        Type: JavaScript module
 *   3. Herlaad de browser (Ctrl+Shift+R)
 *   4. Kaart toevoegen → zoek "Energie 3 Fase"
 *
 * SolarEdge (optioneel):
 *   Voeg onderaan de config toe:
 *   solaredge:
 *     power:   sensor.solaredge_current_power     # huidig vermogen (W of kW)
 *     current: sensor.solaredge_current_dc        # stroom in Ampere
 *     max_power: 8000                             # piek vermogen installatie in W
 *     unit: W                                     # W of kW
 */

const DEFAULT_PHASE_CFG = (suffix) => ({
  power_consume: `sensor.dsmr_reading_electricity_currently_delivered_${suffix}`,
  power_return:  `sensor.p1_power_return_${suffix}`,
  current:       `sensor.dsmr_current_${suffix}`,
  voltage:       `sensor.dsmr_voltage_${suffix}`,
  unit:          'kW',
  max_consume:   5750,
  max_return:    5750,
});

const DEFAULT_SE_CFG = {
  power:     'sensor.solaredge_current_power',
  current:   'sensor.solaredge_current_dc',
  max_power: 8000,
  unit:      'W',
};

const PHASES     = ['L1', 'L2', 'L3'];
const COLOR_CONS = '#1D9E75';
const COLOR_RET  = '#378ADD';
const COLOR_SE   = '#639922';
const MAX_ARROWS = 6;
const MIN_ARROWS = 1;

// ─────────────────────────────────────────────────────────────────────────────
class EnergieCard3Fase extends HTMLElement {

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config    = {};
    this._hass      = null;
    this._built     = false;
    this._prevState = {};
    for (const ph of PHASES) this._prevState[ph] = { isReturn: null, active: false, numArrows: 0 };
  }

  setConfig(config) {
    const phases = {};
    for (const ph of PHASES)
      phases[ph] = { ...DEFAULT_PHASE_CFG(ph.toLowerCase()), ...(config.phases?.[ph] || {}) };
    this._config = {
      ...config,
      phases,
      solaredge: config.solaredge ? { ...DEFAULT_SE_CFG, ...config.solaredge } : null,
    };
    if (this._built) this._update();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._built) { this._build(); this._built = true; }
    this._update();
  }

  static getConfigElement() { return document.createElement('energie-card-3fase-editor'); }
  static getStubConfig() {
    const phases = {};
    for (const ph of PHASES) phases[ph] = DEFAULT_PHASE_CFG(ph.toLowerCase());
    return { phases };
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  _buildStyles() {
    const st = document.createElement('style');
    st.textContent = `
      @keyframes arr-r {
        0%   { transform: translateX(-24px) translateY(-50%); opacity: 0; }
        12%  { opacity: 1; }
        88%  { opacity: 1; }
        100% { transform: translateX(110%) translateY(-50%); opacity: 0; }
      }
      @keyframes arr-l {
        0%   { transform: translateX(110%) translateY(-50%); opacity: 0; }
        12%  { opacity: 1; }
        88%  { opacity: 1; }
        100% { transform: translateX(-24px) translateY(-50%); opacity: 0; }
      }
      @keyframes se-pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50%      { opacity: .3; transform: scale(.6); }
      }
      :host { display: block; font-family: var(--primary-font-family, sans-serif); }
      ha-card { overflow: hidden; padding: 16px; }
      .title { font-size: 12px; font-weight: 500; color: var(--secondary-text-color);
               text-transform: uppercase; letter-spacing: .05em; margin-bottom: 14px; }
      .summary { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
      .sb { background: var(--secondary-background-color); border-radius: 10px; padding: 12px 14px; }
      .sl { font-size: 11px; color: var(--disabled-text-color); margin-bottom: 3px; }
      .sv { font-size: 22px; font-weight: 500; }
      .sbt { height: 4px; border-radius: 2px; background: var(--divider-color); overflow: hidden; margin-top: 8px; }
      .sbf { height: 100%; border-radius: 2px; width: 0%; transition: width .6s ease; }
      .ss { font-size: 10px; color: var(--disabled-text-color); margin-top: 4px; }
      .phases { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 0; }
      .phase { background: var(--secondary-background-color); border-radius: 12px; padding: 12px 10px; min-width: 0; }
      .pl { font-size: 12px; font-weight: 500; color: var(--secondary-text-color); margin-bottom: 5px; }
      .pv { font-size: 15px; font-weight: 500; margin-bottom: 2px; }
      .ps { font-size: 11px; color: var(--disabled-text-color); margin-bottom: 7px; }
      .bt { height: 6px; border-radius: 3px; background: var(--divider-color); overflow: hidden; margin-bottom: 8px; }
      .bf { height: 100%; border-radius: 3px; width: 0%; transition: width .6s ease, background .4s ease; }
      .flow-wrap { position: relative; height: 28px; overflow: hidden; margin-bottom: 6px;
                   border-radius: 4px; background: var(--divider-color); opacity: .9; }
      .arr { position: absolute; top: 50%; left: 0; will-change: transform, opacity;
             font-size: 13px; line-height: 1; opacity: 0; }
      .ff { font-size: 10px; display: flex; justify-content: space-between; color: var(--disabled-text-color); }
      .dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; margin-right: 3px; vertical-align: middle; }

      /* SolarEdge blok */
      .se-block { margin-top: 12px; background: var(--secondary-background-color);
                  border-radius: 12px; padding: 12px 14px; }
      .se-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
      .se-left { display: flex; align-items: center; gap: 8px; }
      .se-pulse { width: 8px; height: 8px; border-radius: 50%; background: ${COLOR_SE};
                  flex-shrink: 0; animation: se-pulse 2s infinite; }
      .se-title { font-size: 12px; font-weight: 500; color: var(--secondary-text-color); }
      .se-right { display: flex; align-items: baseline; gap: 6px; }
      .se-kw { font-size: 18px; font-weight: 500; color: ${COLOR_SE}; }
      .se-amp { font-size: 12px; color: var(--disabled-text-color); }
      .se-track { height: 6px; border-radius: 3px; background: var(--divider-color); overflow: hidden; }
      .se-fill { height: 100%; border-radius: 3px;
                 background: linear-gradient(90deg, ${COLOR_SE}, #8BC34A);
                 transition: width .8s ease; }
      .se-sub { display: flex; justify-content: space-between; font-size: 10px;
                color: var(--disabled-text-color); margin-top: 5px; }
    `;
    this.shadowRoot.appendChild(st);
  }

  // ── DOM opbouw ────────────────────────────────────────────────────────────
  _build() {
    const r = this.shadowRoot;
    r.innerHTML = '';
    this._buildStyles();

    const hasSE = !!this._config.solaredge;

    const card = document.createElement('ha-card');
    card.innerHTML = `
      <div class="title">⚡ Energiemeter — 3 fase</div>
      <div class="summary">
        <div class="sb">
          <div class="sl">Totaal verbruik</div>
          <div class="sv" id="tc" style="color:${COLOR_CONS}">— W</div>
          <div class="sbt"><div class="sbf" id="tbc" style="background:${COLOR_CONS}"></div></div>
          <div class="ss" id="tsc">van — W max</div>
        </div>
        <div class="sb">
          <div class="sl">Teruglevering</div>
          <div class="sv" id="tr" style="color:${COLOR_RET}">— W</div>
          <div class="sbt"><div class="sbf" id="tbr" style="background:${COLOR_RET}"></div></div>
          <div class="ss" id="tsr">van — W max</div>
        </div>
      </div>
      <div class="phases">
        ${PHASES.map(ph => `
          <div class="phase">
            <div class="pl">${ph}</div>
            <div class="pv" id="v-${ph}">— W</div>
            <div class="ps" id="s-${ph}">— V · — A</div>
            <div class="bt"><div class="bf" id="b-${ph}"></div></div>
            <div class="flow-wrap" id="fw-${ph}">
              ${Array.from({length: MAX_ARROWS}, (_, i) =>
                `<span class="arr" id="a-${ph}-${i}">▶</span>`).join('')}
            </div>
            <div class="ff">
              <span><span class="dot" style="background:${COLOR_CONS}"></span><span id="fc-${ph}">0W af</span></span>
              <span><span class="dot" style="background:${COLOR_RET}"></span><span id="fr-${ph}">0W ret</span></span>
            </div>
          </div>`).join('')}
      </div>

      <!-- SolarEdge live blok (altijd in DOM, tonen/verbergen via display) -->
      <div class="se-block" id="se-block" style="display:${hasSE ? 'block' : 'none'}">
        <div class="se-top">
          <div class="se-left">
            <span class="se-pulse" id="se-pulse"></span>
            <span class="se-title">SolarEdge — live productie</span>
          </div>
          <div class="se-right">
            <span class="se-kw" id="se-kw">—</span>
            <span class="se-amp" id="se-amp">— A</span>
          </div>
        </div>
        <div class="se-track"><div class="se-fill" id="se-fill"></div></div>
        <div class="se-sub">
          <span id="se-pct">— % van max</span>
          <span id="se-max">max — W</span>
        </div>
      </div>`;
    r.appendChild(card);
  }

  // ── Animatie per fase ─────────────────────────────────────────────────────
  _setAnimation(ph, isReturn, watt, maxW) {
    const prev      = this._prevState[ph];
    const ratio     = Math.min(Math.max(watt / maxW, 0), 1);
    const active    = watt > 0;
    const numArrows = active ? Math.round(MIN_ARROWS + ratio * (MAX_ARROWS - MIN_ARROWS)) : 0;
    const dur       = (2.2 - ratio * 1.75).toFixed(2);
    const color     = isReturn ? COLOR_RET : COLOR_CONS;
    const symbol    = isReturn ? '◀' : '▶';
    const anim      = isReturn ? 'arr-l' : 'arr-r';
    const dirChanged   = prev.isReturn !== isReturn || prev.active !== active;
    const countChanged = prev.numArrows !== numArrows;

    for (let i = 0; i < MAX_ARROWS; i++) {
      const el = this.shadowRoot.getElementById(`a-${ph}-${i}`);
      if (!el) continue;
      el.textContent = symbol;
      el.style.color = color;
      const shouldRun = i < numArrows;
      if (!shouldRun) {
        if (el.style.animationName !== 'none' && el.style.animation !== 'none')
          el.style.animation = 'none';
        continue;
      }
      const gap   = parseFloat(dur) / numArrows;
      const delay = (gap * i).toFixed(2);
      if (dirChanged || (countChanged && el.style.animation === 'none')) {
        el.style.animation = 'none';
        void el.offsetWidth;
        el.style.animation = `${anim} ${dur}s ${delay}s infinite linear`;
      } else {
        el.style.animationDuration = `${dur}s`;
        el.style.animationDelay   = `${delay}s`;
      }
    }
    this._prevState[ph] = { isReturn, active, numArrows };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  _val(id, unit = 'kW') {
    if (!id || !this._hass) return 0;
    const s = this._hass.states[id];
    if (!s) return 0;
    const n = parseFloat(s.state);
    return isNaN(n) ? 0 : (unit === 'kW' ? n * 1000 : n);
  }

  _fmtW(w) {
    return w >= 1000 ? (w / 1000).toFixed(2) + ' kW' : Math.round(w) + ' W';
  }

  // ── Update ────────────────────────────────────────────────────────────────
  _update() {
    if (!this._hass || !this._built) return;
    const r = this.shadowRoot;
    const q = id => r.getElementById(id);

    let totC = 0, totR = 0, totMaxC = 0, totMaxR = 0;

    for (const ph of PHASES) {
      const pc   = this._config.phases?.[ph] || {};
      const unit = pc.unit || 'kW';

      const consumeW = this._val(pc.power_consume, unit);
      const returnW  = this._val(pc.power_return,  unit);
      const currentA = this._val(pc.current, 'W');
      const voltageV = this._val(pc.voltage, 'W') || 230;
      const maxC     = parseFloat(pc.max_consume) || 5750;
      const maxR     = parseFloat(pc.max_return)  || 5750;

      totMaxC += maxC;
      totMaxR += maxR;

      const isReturn = returnW > consumeW;
      const activeW  = isReturn ? returnW : consumeW;
      const maxW     = isReturn ? maxR : maxC;

      totC += isReturn ? 0       : consumeW;
      totR += isReturn ? returnW : 0;

      const pct   = Math.round(Math.min(activeW / maxW, 1) * 100);
      const color = isReturn ? COLOR_RET : COLOR_CONS;

      if (q(`v-${ph}`))  { q(`v-${ph}`).textContent = `${activeW.toFixed(0)} W`; q(`v-${ph}`).style.color = color; }
      if (q(`s-${ph}`))  q(`s-${ph}`).textContent   = `${voltageV.toFixed(0)} V · ${currentA.toFixed(1)} A`;
      if (q(`b-${ph}`))  { q(`b-${ph}`).style.width = `${pct}%`; q(`b-${ph}`).style.background = color; }
      if (q(`fc-${ph}`)) q(`fc-${ph}`).textContent  = `${consumeW.toFixed(0)}W af`;
      if (q(`fr-${ph}`)) q(`fr-${ph}`).textContent  = `${returnW.toFixed(0)}W ret`;

      const fw = q(`fw-${ph}`);
      if (fw) fw.style.background = activeW > 0
        ? (isReturn ? 'rgba(55,138,221,.08)' : 'rgba(29,158,117,.08)')
        : 'var(--divider-color)';

      this._setAnimation(ph, isReturn, activeW, maxW);
    }

    // Totalen
    const pctC = Math.round(Math.min(totC / totMaxC, 1) * 100);
    const pctR = Math.round(Math.min(totR / totMaxR, 1) * 100);
    if (q('tc'))  q('tc').textContent  = `${totC.toFixed(0)} W`;
    if (q('tr'))  q('tr').textContent  = `${totR.toFixed(0)} W`;
    if (q('tbc')) q('tbc').style.width = `${pctC}%`;
    if (q('tbr')) q('tbr').style.width = `${pctR}%`;
    if (q('tsc')) q('tsc').textContent = `van ${totMaxC.toLocaleString('nl-NL')} W max (${pctC}%)`;
    if (q('tsr')) q('tsr').textContent = `van ${totMaxR.toLocaleString('nl-NL')} W max (${pctR}%)`;

    // SolarEdge
    const se = this._config.solaredge;
    const seBlock = q('se-block');
    if (seBlock) seBlock.style.display = se ? 'block' : 'none';

    if (se) {
      const seUnit  = se.unit || 'W';
      const seW     = this._val(se.power,   seUnit);
      const seA     = this._val(se.current, 'W');   // A is altijd direct
      const seMax   = parseFloat(se.max_power) || 8000;
      const sePct   = Math.round(Math.min(seW / seMax, 1) * 100);

      if (q('se-kw'))  q('se-kw').textContent  = this._fmtW(seW);
      if (q('se-amp')) q('se-amp').textContent  = seA > 0 ? `${seA.toFixed(1)} A` : '';
      if (q('se-fill')) q('se-fill').style.width = `${sePct}%`;
      if (q('se-pct')) q('se-pct').textContent  = `${sePct}% van max`;
      if (q('se-max')) q('se-max').textContent  = `max ${this._fmtW(seMax)}`;

      // Puls sneller bij meer productie
      const pulseDur = seW > 0 ? Math.max(0.5, 2 - (seW / seMax) * 1.5).toFixed(1) : '2';
      const pulse = q('se-pulse');
      if (pulse) pulse.style.animationDuration = `${pulseDur}s`;
    }
  }

  getCardSize() { return 4; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Visuele editor
// ─────────────────────────────────────────────────────────────────────────────
class EnergieCard3FaseEditor extends HTMLElement {

  setConfig(config) {
    this._config = {
      ...config,
      solaredge: config.solaredge ? { ...DEFAULT_SE_CFG, ...config.solaredge } : null,
    };
    if (this._built) this._populate();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._built) { this._build(); this._built = true; }
  }

  _fire(config) {
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config }, bubbles: true, composed: true }));
  }

  _build() {
    const ents = this._hass
      ? Object.keys(this._hass.states).filter(e => e.startsWith('sensor.')).sort()
      : [];

    this.innerHTML = `
      <style>
        .ed { padding: 4px 0; font-family: var(--primary-font-family, sans-serif); }
        .ib { font-size: 11px; color: var(--secondary-text-color);
              background: var(--secondary-background-color);
              border-radius: 0 6px 6px 0; padding: 8px 10px; margin-bottom: 12px;
              border-left: 3px solid ${COLOR_RET}; line-height: 1.6; }
        .sec { font-size: 12px; font-weight: 500; color: var(--primary-text-color);
               margin: 18px 0 8px; padding-bottom: 4px;
               border-bottom: 1px solid var(--divider-color); }
        .sec-sub { font-size: 11px; color: var(--secondary-text-color); font-weight: 400; margin-left: 6px; }
        .g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 4px; }
        .fi { display: flex; flex-direction: column; gap: 3px; }
        label { font-size: 11px; color: var(--secondary-text-color); display: flex; align-items: center; gap: 4px; }
        .be { font-size: 9px; padding: 1px 5px; border-radius: 10px; background: #E6F1FB; color: #185FA5; }
        .bm { font-size: 9px; padding: 1px 5px; border-radius: 10px; background: #EAF3DE; color: #3B6D11; }
        .bse{ font-size: 9px; padding: 1px 5px; border-radius: 10px; background: #EAF3DE; color: #3B6D11; }
        input[type=text], input[type=number], select {
          padding: 6px 8px; border-radius: 6px; font-size: 12px;
          border: 1px solid var(--divider-color);
          background: var(--secondary-background-color);
          color: var(--primary-text-color); width: 100%; }
        input[type=checkbox] { width: 16px; height: 16px; cursor: pointer; }
        .hi { font-size: 10px; color: var(--disabled-text-color); margin-top: 1px; }
        .se-toggle { display: flex; align-items: center; gap: 8px; margin-bottom: 10px;
                     font-size: 12px; color: var(--primary-text-color); cursor: pointer; }
        .se-fields { display: none; }
        .se-fields.active { display: block; }
        .tp { margin-top: 14px; padding: 10px 12px; background: var(--secondary-background-color);
              border-radius: 8px; font-size: 11px; color: var(--secondary-text-color); line-height: 1.8; }
        .tp strong { color: var(--primary-text-color); }
      </style>
      <div class="ed">
        <div class="ib">
          Afname én teruglevering komen <strong>direct van de sensor</strong> per fase.<br>
          Aantal pijltjes en snelheid schalen automatisch mee met het vermogen.
        </div>

        <datalist id="el">${ents.map(e => `<option value="${e}">`).join('')}</datalist>

        ${PHASES.map(ph => `
          <div class="sec">${ph}</div>
          <div class="g2">
            <div class="fi">
              <label>Afname <span class="be">entiteit</span></label>
              <input type="text" list="el" id="${ph}_power_consume" placeholder="sensor.…"/>
            </div>
            <div class="fi">
              <label>Teruglevering <span class="be">entiteit</span></label>
              <input type="text" list="el" id="${ph}_power_return" placeholder="sensor.p1_power_return_${ph.toLowerCase()}"/>
            </div>
            <div class="fi">
              <label>Stroom A <span class="be">entiteit</span></label>
              <input type="text" list="el" id="${ph}_current" placeholder="sensor.…"/>
            </div>
            <div class="fi">
              <label>Spanning V <span class="be">entiteit</span></label>
              <input type="text" list="el" id="${ph}_voltage" placeholder="sensor.…"/>
            </div>
            <div class="fi">
              <label>Eenheid sensor</label>
              <select id="${ph}_unit">
                <option value="kW">kW (DSMR standaard)</option>
                <option value="W">W (direct)</option>
              </select>
            </div>
            <div></div>
            <div class="fi">
              <label>Max afname W <span class="bm">max</span></label>
              <input type="number" id="${ph}_max_consume" min="1" step="100" placeholder="5750"/>
              <div class="hi">25A × 230V = 5750</div>
            </div>
            <div class="fi">
              <label>Max teruglevering W <span class="bm">max</span></label>
              <input type="number" id="${ph}_max_return" min="1" step="100" placeholder="5750"/>
              <div class="hi">omvormer max per fase</div>
            </div>
          </div>`).join('')}

        <!-- SolarEdge sectie -->
        <div class="sec">
          SolarEdge <span class="sec-sub">live productie (optioneel)</span>
        </div>
        <label class="se-toggle">
          <input type="checkbox" id="se-enabled"/>
          SolarEdge blok tonen onderaan de kaart
        </label>
        <div class="se-fields" id="se-fields">
          <div class="g2">
            <div class="fi">
              <label>Vermogen <span class="bse">entiteit</span></label>
              <input type="text" list="el" id="se_power" placeholder="sensor.solaredge_current_power"/>
            </div>
            <div class="fi">
              <label>Stroom A <span class="bse">entiteit</span></label>
              <input type="text" list="el" id="se_current" placeholder="sensor.solaredge_current_dc"/>
              <div class="hi">optioneel</div>
            </div>
            <div class="fi">
              <label>Eenheid</label>
              <select id="se_unit">
                <option value="W">W (SolarEdge standaard)</option>
                <option value="kW">kW</option>
              </select>
            </div>
            <div class="fi">
              <label>Max vermogen <span class="bm">max</span></label>
              <input type="number" id="se_max_power" min="1" step="100" placeholder="8000"/>
              <div class="hi">piek van je installatie in W</div>
            </div>
          </div>
        </div>

        <div class="tp">
          Totaal max afname: <strong id="pc">—</strong> W &nbsp;·&nbsp;
          Totaal max teruglevering: <strong id="pr">—</strong> W
          <br><span style="font-size:10px;opacity:.7">(automatisch = som fase-maxima)</span>
        </div>
      </div>`;

    this._built = true;
    this._populate();

    // Toggle SolarEdge velden
    this.querySelector('#se-enabled').addEventListener('change', (e) => {
      const fields = this.querySelector('#se-fields');
      fields.classList.toggle('active', e.target.checked);
      this._save();
    });

    this.querySelectorAll('input:not(#se-enabled), select').forEach(el => {
      el.addEventListener('change', () => this._save());
      el.addEventListener('input',  () => this._preview());
    });
  }

  _populate() {
    if (!this._built) return;
    const cfg    = this._config || {};
    const phases = cfg.phases   || {};
    const se     = cfg.solaredge;

    for (const p of PHASES) {
      const pc = { ...DEFAULT_PHASE_CFG(p.toLowerCase()), ...(phases[p] || {}) };
      for (const f of ['power_consume','power_return','current','voltage','max_consume','max_return','unit']) {
        const el = this.querySelector(`#${p}_${f}`);
        if (el && pc[f] !== undefined) el.value = pc[f];
      }
    }

    // SolarEdge
    const seEnabled = this.querySelector('#se-enabled');
    const seFields  = this.querySelector('#se-fields');
    if (se) {
      seEnabled.checked = true;
      seFields.classList.add('active');
      const set = (id, val) => { const el = this.querySelector(`#${id}`); if (el && val !== undefined) el.value = val; };
      set('se_power',     se.power);
      set('se_current',   se.current);
      set('se_unit',      se.unit);
      set('se_max_power', se.max_power);
    }
    this._preview();
  }

  _preview() {
    let c = 0, rv = 0;
    for (const p of PHASES) {
      c  += parseFloat(this.querySelector(`#${p}_max_consume`)?.value) || 5750;
      rv += parseFloat(this.querySelector(`#${p}_max_return`)?.value)  || 5750;
    }
    const pc = this.querySelector('#pc'), pr = this.querySelector('#pr');
    if (pc) pc.textContent = c.toLocaleString('nl-NL');
    if (pr) pr.textContent = rv.toLocaleString('nl-NL');
  }

  _save() {
    const phases = {};
    for (const p of PHASES) {
      phases[p] = {};
      for (const f of ['power_consume','power_return','current','voltage','max_consume','max_return','unit']) {
        const el = this.querySelector(`#${p}_${f}`);
        if (!el) continue;
        phases[p][f] = f.startsWith('max_') ? (parseFloat(el.value) || 5750) : el.value;
      }
    }

    const seEnabled = this.querySelector('#se-enabled')?.checked;
    const solaredge = seEnabled ? {
      power:     this.querySelector('#se_power')?.value     || DEFAULT_SE_CFG.power,
      current:   this.querySelector('#se_current')?.value   || DEFAULT_SE_CFG.current,
      unit:      this.querySelector('#se_unit')?.value      || DEFAULT_SE_CFG.unit,
      max_power: parseFloat(this.querySelector('#se_max_power')?.value) || DEFAULT_SE_CFG.max_power,
    } : null;

    this._preview();
    this._fire({ ...this._config, phases, solaredge });
  }
}

// ── Registreren ───────────────────────────────────────────────────────────────
customElements.define('energie-card-3fase', EnergieCard3Fase);
customElements.define('energie-card-3fase-editor', EnergieCard3FaseEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type:        'energie-card-3fase',
  name:        'Energie 3 Fase',
  description: '3-fase energiemeter met pijltjes + optioneel SolarEdge live productie',
  preview:     true,
});
