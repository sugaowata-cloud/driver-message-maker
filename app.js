(() => {
  'use strict';

  const STORAGE_KEY = 'driverMessageMakerDataV1';
  const RECIPIENTS = ['会長本人', '会長の彼女', 'グループLINE', 'その他'];
  const OPENINGS = ['おはようございます！', 'おはようございます。', 'お疲れ様です。', '承知しました！', '承知しました。', 'かしこまりました。', '申し訳ありません。', 'なし'];
  const CLOSINGS = ['本日もよろしくお願いします🙇', '本日もよろしくお願いします。', '本日はよろしくお願いします。', 'よろしくお願いします！', 'よろしくお願いいたします。', 'よろしくお願いいたします🙏', 'ご確認よろしくお願いいたします。', 'なし'];
  const PLACEHOLDERS = ['日付', '時刻', '場所', '到着時刻', '所要時間', '名前', 'URL'];

  // 文面テンプレートの基本設定。表現を変える場合はここを編集します。
  const MESSAGE_TEMPLATES = {
    pickupConfirm: { title: 'お迎え確認', icon: '🚘', opening: '承知しました！', closing: 'よろしくお願いいたします🙏' },
    waitingLocation: { title: '待機場所を共有', icon: '📍', opening: 'お疲れ様です。', closing: 'よろしくお願いいたします。' },
    headingPickup: { title: 'お迎えに向かいます', icon: '🚗', opening: '承知しました。', closing: 'よろしくお願いいたします。' },
    arrived: { title: '到着しました', icon: '✅', opening: 'お疲れ様です。', closing: 'よろしくお願いいたします。' },
    delayed: { title: '到着が遅れます', icon: '⚠️', opening: '申し訳ありません。', closing: 'よろしくお願いいたします。' },
    morningWaiting: { title: '朝の待機連絡', icon: '🌅', opening: 'おはようございます！', closing: '本日もよろしくお願いします🙇' },
    pickupNotice: { title: 'お迎え予定を連絡', icon: '🕒', opening: 'お疲れ様です。', closing: 'よろしくお願いします！' },
    custom: { title: '自由テンプレ', icon: '📝', opening: 'なし', closing: 'なし' }
  };

  const DEFAULT_DATA = {
    settings: { defaultRecipient: '会長本人', defaultClosing: 'よろしくお願いいたします。', useEmoji: true },
    places: { pickup: [], waiting: [], meeting: [], arrival: [] },
    history: [],
    customTemplates: []
  };

  const app = document.getElementById('app');
  const backButton = document.getElementById('backButton');
  const settingsButton = document.getElementById('settingsButton');
  const toast = document.getElementById('toast');
  let data = loadData();
  let currentView = 'home';
  let currentType = null;
  let currentInputs = {};
  let currentResult = null;
  let toastTimer;

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function trim(value) { return String(value ?? '').trim(); }
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }
  function loadData() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!saved) return clone(DEFAULT_DATA);
      return {
        settings: { ...DEFAULT_DATA.settings, ...(saved.settings || {}) },
        places: { ...clone(DEFAULT_DATA.places), ...(saved.places || {}) },
        history: Array.isArray(saved.history) ? saved.history.slice(0, 10) : [],
        customTemplates: Array.isArray(saved.customTemplates) ? saved.customTemplates : []
      };
    } catch (error) { console.warn('保存データを読み込めませんでした。', error); return clone(DEFAULT_DATA); }
  }
  function saveData() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
    catch (error) { console.warn('データを保存できませんでした。', error); showToast('端末にデータを保存できませんでした。'); }
  }
  function showToast(message) {
    clearTimeout(toastTimer); toast.textContent = message; toast.classList.add('show');
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
  }
  function setView(view) {
    currentView = view;
    backButton.classList.toggle('hidden', view === 'home');
    settingsButton.classList.toggle('hidden', view === 'settings');
    window.scrollTo({ top: 0, behavior: 'instant' });
    requestAnimationFrame(() => app.focus({ preventScroll: true }));
  }
  function useTemplate(id) {
    const node = document.getElementById(id).content.cloneNode(true);
    app.replaceChildren(node);
  }
  function optionHtml(items, selected) {
    return items.map((item) => `<option value="${escapeHtml(item)}"${item === selected ? ' selected' : ''}>${escapeHtml(item)}</option>`).join('');
  }
  function getRecipient(form) {
    const selected = form.elements.recipient?.value || data.settings.defaultRecipient;
    return selected === 'その他' ? trim(form.elements.customRecipient?.value) || 'その他' : selected;
  }
  function stripEmoji(text) {
    return data.settings.useEmoji ? text : text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F]/gu, '');
  }
  function paragraphJoin(parts) { return parts.map(trim).filter(Boolean).join('\n\n'); }
  function formatTimestamp(iso) {
    const d = new Date(iso);
    return new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
  }
  function formatJapaneseDate(value) {
    if (!value) return '';
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const weekday = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
    return `${month}月${day}日（${weekday}）`;
  }
  function nearestTime() {
    const d = new Date();
    d.setMinutes(Math.round(d.getMinutes() / 5) * 5, 0, 0);
    if (d.getMinutes() === 60) { d.setHours(d.getHours() + 1); d.setMinutes(0); }
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  function timeOptions(selected = '', allowEmpty = true) {
    let html = allowEmpty ? '<option value="">未指定</option>' : '';
    for (let minutes = 0; minutes < 24 * 60; minutes += 5) {
      const value = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
      html += `<option value="${value}"${value === selected ? ' selected' : ''}>${value}</option>`;
    }
    return html;
  }
  function field(name, label, placeholder = '', type = 'text', value = '', extra = '') {
    return `<div class="field"><label for="${name}">${label}</label><input id="${name}" name="${name}" type="${type}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" ${extra}></div>`;
  }
  function selectField(name, label, choices, selected, hint = '') {
    return `<div class="field"><label for="${name}">${label}</label>${hint ? `<p class="hint">${escapeHtml(hint)}</p>` : ''}<select id="${name}" name="${name}">${optionHtml(choices, selected)}</select></div>`;
  }
  function textareaField(name, label, placeholder = '', value = '') {
    return `<div class="field"><label for="${name}">${label}</label><textarea id="${name}" name="${name}" rows="3" placeholder="${escapeHtml(placeholder)}">${escapeHtml(value)}</textarea></div>`;
  }
  function placeField(name, label, category, value = '', placeholder = '') {
    const chips = (data.places[category] || []).map((place) => `<button class="chip place-chip" data-target="${name}" data-value="${escapeHtml(place)}" type="button">${escapeHtml(place)}</button>`).join('');
    return `${field(name, label, placeholder, 'text', value, 'autocomplete="off"')}${chips ? `<div class="chips" aria-label="${escapeHtml(label)}の候補">${chips}</div>` : ''}`;
  }
  function timeRange(prefix, label, start = '', end = '') {
    return `<div class="field"><span class="label-like">${label}</span><div class="time-range"><div><label class="hint" for="${prefix}Start">開始</label><select id="${prefix}Start" name="${prefix}Start">${timeOptions(start)}</select></div><span class="sep">〜</span><div><label class="hint" for="${prefix}End">終了（任意）</label><select id="${prefix}End" name="${prefix}End">${timeOptions(end)}</select></div></div></div>`;
  }

  function renderHome() {
    setView('home'); useTemplate('homeTemplate');
    document.getElementById('homeRecipient').textContent = `送信先：${data.settings.defaultRecipient}`;
    const buttons = Object.entries(MESSAGE_TEMPLATES).map(([key, item]) => `<button class="template-button" data-type="${key}" type="button"><span class="icon">${item.icon}</span><span>${escapeHtml(item.title)}</span><span class="chevron">›</span></button>`).join('');
    document.getElementById('templateButtons').innerHTML = buttons;
    document.getElementById('templateButtons').addEventListener('click', (event) => {
      const button = event.target.closest('[data-type]'); if (!button) return;
      if (button.dataset.type === 'custom') renderSettings('templates'); else renderComposer(button.dataset.type);
    });
    document.getElementById('showAllHistory').addEventListener('click', () => renderSettings('history'));
    renderHistoryList(document.getElementById('recentHistory'), data.history.slice(0, 3), true);
  }

  function renderHistoryList(container, history, compact = false) {
    if (!history.length) { container.innerHTML = '<div class="empty-state">まだ履歴はありません。<br>作成した文面がここに表示されます。</div>'; return; }
    container.innerHTML = history.map((item) => `<article class="history-item" data-id="${escapeHtml(item.id)}" tabindex="0" role="button" aria-label="${escapeHtml(item.templateName)}の文面を開く"><div class="history-meta"><span>${escapeHtml(formatTimestamp(item.createdAt))}</span><span>送信先：${escapeHtml(item.recipient)}</span></div><p class="history-title">${escapeHtml(item.templateName)}</p><p class="history-snippet">${escapeHtml(item.message.replace(/\s+/g, ' ').slice(0, compact ? 42 : 80))}</p>${compact ? '' : `<div class="card-actions"><button class="small-button history-open" type="button">再表示</button><button class="small-button history-copy" type="button">再コピー</button><button class="small-button history-reuse" type="button">入力を再利用</button><button class="small-button danger history-delete" type="button">削除</button></div>`}</article>`).join('');
    container.addEventListener('click', handleHistoryAction);
    container.addEventListener('keydown', (event) => { if ((event.key === 'Enter' || event.key === ' ') && event.target.classList.contains('history-item')) { event.preventDefault(); handleHistoryAction(event); } });
  }
  function handleHistoryAction(event) {
    const card = event.target.closest('.history-item'); if (!card) return;
    const item = data.history.find((entry) => entry.id === card.dataset.id); if (!item) return;
    if (event.target.closest('.history-copy')) { copyText(item.message, item.recipient); return; }
    if (event.target.closest('.history-delete')) {
      data.history = data.history.filter((entry) => entry.id !== item.id); saveData(); renderSettings('history'); return;
    }
    if (event.target.closest('.history-reuse')) {
      if (item.templateType === 'custom') renderCustomComposer(item.customTemplateId, item.inputs); else renderComposer(item.templateType, item.inputs); return;
    }
    showResult({ ...item, fromHistory: true });
  }

  function renderComposer(type, values = {}) {
    currentType = type; currentInputs = clone(values || {}); setView('composer'); useTemplate('composerTemplate');
    const template = MESSAGE_TEMPLATES[type];
    document.getElementById('composerIcon').textContent = template.icon;
    document.getElementById('composerHeading').textContent = template.title;
    const recipient = values.recipientChoice || data.settings.defaultRecipient;
    document.getElementById('recipient').innerHTML = optionHtml(RECIPIENTS, recipient);
    document.getElementById('opening').innerHTML = optionHtml(OPENINGS, values.opening || template.opening);
    const initialClosing = ['morningWaiting', 'pickupNotice'].includes(type) ? template.closing : (data.settings.defaultClosing || template.closing);
    document.getElementById('closing').innerHTML = optionHtml(CLOSINGS, values.closing || initialClosing);
    document.getElementById('customRecipient').value = values.customRecipient || '';
    document.getElementById('customRecipientWrap').classList.toggle('hidden', recipient !== 'その他');
    document.getElementById('specificFields').innerHTML = buildFields(type, values);
    if (type === 'waitingLocation') document.getElementById('composerWarning').innerHTML = '<div class="warning-box" role="note">⚠️ 待機場所と合流場所を、会長本人へ共有しましたか？</div>';
    const form = document.getElementById('messageForm');
    form.addEventListener('submit', (event) => { event.preventDefault(); generateFromForm(form); });
    form.addEventListener('change', handleConditionalFields);
    form.addEventListener('input', updateRecipientBanner);
    form.addEventListener('click', (event) => {
      const chip = event.target.closest('.place-chip'); if (!chip) return;
      const target = form.elements[chip.dataset.target]; if (target) { target.value = chip.dataset.value; target.dispatchEvent(new Event('input', { bubbles: true })); }
    });
    handleConditionalFields(); updateRecipientBanner();
  }

  function buildFields(type, v) {
    const now = nearestTime();
    if (type === 'pickupConfirm') return `<section class="form-card"><h3>お迎えの内容</h3><div class="field"><span class="label-like">日付</span><div class="radio-row">${['今日','明日','日付指定'].map((x) => `<label class="radio-chip"><input type="radio" name="dateMode" value="${x}"${(v.dateMode || '明日') === x ? ' checked' : ''}><span>${x}</span></label>`).join('')}</div></div><div id="customDateWrap" class="field hidden"><label for="customDate">日付</label><input id="customDate" name="customDate" type="date" value="${escapeHtml(v.customDate || '')}"></div>${placeField('pickupPlace','迎え場所','pickup',v.pickupPlace,'例：ホテル')}${timeRange('departure','出発可能時間',v.departureStart || now,v.departureEnd)}${timeRange('meeting','集合時間',v.meetingStart,v.meetingEnd)}<label class="check-row"><input type="checkbox" name="includeMeeting"${v.includeMeeting ? ' checked' : ''}><span>集合時間も文面に記載する</span></label>${textareaField('note','補足','文面に加えたい内容',v.note)}</section>`;
    if (type === 'waitingLocation') return `<section class="form-card"><h3>待機・合流の内容</h3>${placeField('waitingPlace','現在の待機場所','waiting',v.waitingPlace,'例：二条付近')}${selectField('duration','迎えまでの所要時間',['すぐに向かえます','約5分','約10分','約15分','約20分','約30分','自由入力'],v.duration || '約15分')}<div id="customDurationWrap" class="field hidden"><label for="customDuration">所要時間</label><input id="customDuration" name="customDuration" value="${escapeHtml(v.customDuration || '')}" placeholder="例：約8分"></div>${placeField('meetingPlace','合流地点名','meeting',v.meetingPlace,'例：四条烏丸交差点西側')}${field('mapUrl','GoogleマップURL','https://maps.google.com/...','url',v.mapUrl)}${selectField('waitingReason','待機理由',['近隣で駐車できないため','交通規制のため','周辺駐車場が満車のため','警察から移動を求められたため','その他'],v.waitingReason || '近隣で駐車できないため')}<div id="customReasonWrap" class="field hidden"><label for="customReason">待機理由</label><input id="customReason" name="customReason" value="${escapeHtml(v.customReason || '')}" placeholder="例：道路工事のため"></div>${textareaField('note','補足','文面に加えたい内容',v.note)}</section>`;
    if (type === 'headingPickup') return `<section class="form-card"><h3>到着予定</h3>${selectField('duration','到着までの時間',['未指定','約5分','約10分','約15分','約20分','約30分','自由入力'],v.duration || '約10分')}<div id="customDurationWrap" class="field hidden"><label for="customDuration">到着までの時間</label><input id="customDuration" name="customDuration" value="${escapeHtml(v.customDuration || '')}" placeholder="例：約8分"></div><div class="field"><label for="arrivalTime">到着予定時刻（任意）</label><select id="arrivalTime" name="arrivalTime">${timeOptions(v.arrivalTime)}</select></div>${field('currentLocation','現在地','例：烏丸御池付近','text',v.currentLocation)}${textareaField('note','補足','文面に加えたい内容',v.note)}</section>`;
    if (type === 'arrived') return `<section class="form-card"><h3>到着の内容</h3>${placeField('arrivalPlace','到着場所','arrival',v.arrivalPlace,'例：ホテル')}${field('waitingPosition','待機位置','例：正面入口付近','text',v.waitingPosition)}${field('vehicleNote','車両補足','例：黒色の車両','text',v.vehicleNote)}</section>`;
    if (type === 'delayed') return `<section class="form-card"><h3>遅延の内容</h3>${selectField('delayReason','遅延理由',['渋滞のため','交通規制のため','駐車場からの出庫に時間がかかっているため','事故渋滞のため','その他'],v.delayReason || '渋滞のため')}<div id="customDelayReasonWrap" class="field hidden"><label for="customDelayReason">遅延理由</label><input id="customDelayReason" name="customDelayReason" value="${escapeHtml(v.customDelayReason || '')}" placeholder="例：道路工事のため"></div>${selectField('delayDuration','遅延時間',['未指定','約5分','約10分','約15分','約20分','約30分','自由入力'],v.delayDuration || '約15分')}<div id="customDelayDurationWrap" class="field hidden"><label for="customDelayDuration">遅延時間</label><input id="customDelayDuration" name="customDelayDuration" value="${escapeHtml(v.customDelayDuration || '')}" placeholder="例：約8分"></div><div class="field"><label for="newArrivalTime">新しい到着予定時刻（任意）</label><select id="newArrivalTime" name="newArrivalTime">${timeOptions(v.newArrivalTime)}</select></div>${textareaField('note','補足','文面に加えたい内容',v.note)}</section>`;
    if (type === 'morningWaiting') return `<section class="form-card"><h3>朝の待機状況</h3>${selectField('waitingStatus','連絡内容',['到着して待機中','少し早く到着・離れて待機中','到着予定を連絡'],v.waitingStatus || '到着して待機中')}${placeField('arrivalPlace','待機・到着場所','arrival',v.arrivalPlace,'例：ラトゥール下')}${field('waitingPosition','現在の待機位置（任意）','例：若干離れた場所','text',v.waitingPosition)}<div class="field"><label for="arrivalTime">到着・待機予定時刻（任意）</label><select id="arrivalTime" name="arrivalTime">${timeOptions(v.arrivalTime)}</select></div><div class="field"><label for="moveTime">入口へ移動する時刻（任意）</label><select id="moveTime" name="moveTime">${timeOptions(v.moveTime)}</select></div>${selectField('callToAction','呼びかけ',['いつでもご用命ください☺️','いつでもご用命ください！','ご用命ください。','なし'],v.callToAction || 'いつでもご用命ください☺️')}${textareaField('note','補足','文面に加えたい内容',v.note)}</section>`;
    if (type === 'pickupNotice') return `<section class="form-card"><h3>お迎え予定</h3><div class="field"><span class="label-like">日付</span><div class="radio-row">${['今日','明日','日付指定'].map((x) => `<label class="radio-chip"><input type="radio" name="dateMode" value="${x}"${(v.dateMode || '今日') === x ? ' checked' : ''}><span>${x}</span></label>`).join('')}</div></div><div id="customDateWrap" class="field hidden"><label for="customDate">日付</label><input id="customDate" name="customDate" type="date" value="${escapeHtml(v.customDate || '')}"></div><div class="field"><label for="pickupTime">お迎え時刻</label><select id="pickupTime" name="pickupTime">${timeOptions(v.pickupTime || now, false)}</select></div>${placeField('pickupPlace','お迎え場所','pickup',v.pickupPlace,'例：ラトゥール')}${textareaField('note','補足','文面に加えたい内容',v.note)}</section>`;
    return '';
  }

  function handleConditionalFields() {
    const form = document.getElementById('messageForm'); if (!form) return;
    const toggle = (id, show) => document.getElementById(id)?.classList.toggle('hidden', !show);
    toggle('customRecipientWrap', form.elements.recipient?.value === 'その他');
    toggle('customDateWrap', form.elements.dateMode?.value === '日付指定');
    toggle('customDurationWrap', form.elements.duration?.value === '自由入力');
    toggle('customReasonWrap', form.elements.waitingReason?.value === 'その他');
    toggle('customDelayReasonWrap', form.elements.delayReason?.value === 'その他');
    toggle('customDelayDurationWrap', form.elements.delayDuration?.value === '自由入力');
    updateRecipientBanner();
  }
  function updateRecipientBanner() {
    const form = document.getElementById('messageForm'); const banner = document.getElementById('recipientBanner');
    if (form && banner) banner.textContent = `送信先：${getRecipient(form)}`;
  }
  function formValues(form) {
    const values = {};
    new FormData(form).forEach((value, key) => { values[key] = trim(value); });
    values.includeMeeting = Boolean(form.elements.includeMeeting?.checked);
    values.recipientChoice = form.elements.recipient?.value;
    values.customRecipient = trim(form.elements.customRecipient?.value);
    return values;
  }
  function rangeText(start, end) { return start ? `${start}${end ? `〜${end}` : ''}` : ''; }
  function openingClosing(values, body) {
    const opening = values.opening === 'なし' ? '' : values.opening;
    const closing = values.closing === 'なし' ? '' : values.closing;
    return stripEmoji(paragraphJoin([opening, body, closing]));
  }
  function generateMessage(type, v) {
    if (type === 'pickupConfirm') {
      const dateText = v.dateMode === '今日' ? '本日は' : v.dateMode === '明日' ? '明日は' : `${formatJapaneseDate(v.customDate)}は`;
      const departure = rangeText(v.departureStart, v.departureEnd);
      let main = `${dateText}${departure ? `${departure}頃に` : ''}${v.pickupPlace ? `${v.pickupPlace}を` : ''}出発できるよう、お迎えに伺います。`;
      const meeting = rangeText(v.meetingStart, v.meetingEnd);
      if (v.includeMeeting && meeting) main += `\n\n集合時間は${meeting}と承知しております。`;
      return openingClosing(v, paragraphJoin([main, v.note]));
    }
    if (type === 'waitingLocation') {
      const reason = v.waitingReason === 'その他' ? v.customReason : v.waitingReason;
      const duration = v.duration === '自由入力' ? v.customDuration : v.duration;
      const reasonStem = reason.replace(/のため$/, '').replace(/ため$/, '');
      const waiting = v.waitingPlace ? `${reason ? `${reasonStem}のため、` : ''}現在は${v.waitingPlace}で待機しております。` : (reason ? `${reason}、近隣で待機しております。` : '近隣で待機しております。');
      const travel = duration === 'すぐに向かえます' ? 'ご連絡をいただき次第、すぐにお迎えに伺います。' : duration ? `ご連絡をいただいてから、${duration}でお迎えに伺います。` : '';
      const meeting = (v.meetingPlace || v.mapUrl) ? ['合流場所はこちらでお願いいたします。', v.meetingPlace, v.mapUrl].filter(Boolean).join('\n') : '';
      return openingClosing(v, paragraphJoin([waiting, travel, meeting, v.note]));
    }
    if (type === 'headingPickup') {
      const duration = v.duration === '自由入力' ? v.customDuration : (v.duration === '未指定' ? '' : v.duration);
      const location = v.currentLocation ? `現在${v.currentLocation}からお迎えに向かっております。` : '現在お迎えに向かっております。';
      const estimate = duration ? `${duration}で到着予定です。` : v.arrivalTime ? `${v.arrivalTime}頃に到着予定です。` : '';
      const second = duration && v.arrivalTime ? `${estimate}\n${v.arrivalTime}頃に到着予定です。` : estimate;
      return openingClosing(v, paragraphJoin([paragraphJoin([location, second]).replace(/\n\n/g, '\n'), v.note]));
    }
    if (type === 'arrived') {
      const place = `${v.arrivalPlace || ''}${v.waitingPosition || ''}`;
      const arrived = place ? `${place}に到着しております。` : '到着しております。';
      const vehicle = v.vehicleNote ? `${v.vehicleNote}で待機しております。` : '';
      return openingClosing(v, paragraphJoin([arrived, vehicle]));
    }
    if (type === 'delayed') {
      const reasonRaw = v.delayReason === 'その他' ? v.customDelayReason : v.delayReason;
      const reason = reasonRaw.replace(/のため$/, '').replace(/ため$/, '');
      const duration = v.delayDuration === '自由入力' ? v.customDelayDuration : (v.delayDuration === '未指定' ? '' : v.delayDuration);
      const delay = reason || duration ? `${reason ? `${reason}の影響により、` : ''}到着が${duration ? `${duration}` : ''}遅れる見込みです。` : '到着が遅れる見込みです。';
      const arrival = v.newArrivalTime ? `${v.newArrivalTime}頃に到着予定です。` : '';
      return openingClosing(v, paragraphJoin([paragraphJoin([delay, arrival]).replace(/\n\n/g, '\n'), v.note]));
    }
    if (type === 'morningWaiting') {
      let statusText = '';
      if (v.waitingStatus === '少し早く到着・離れて待機中') {
        statusText = `少し早いですが到着して${v.waitingPosition || '若干離れた場所'}で待機しております。`;
      } else if (v.waitingStatus === '到着予定を連絡') {
        statusText = `${v.arrivalTime ? `${v.arrivalTime}には` : ''}${v.arrivalPlace ? `${v.arrivalPlace}で` : ''}待機しておきます。`;
      } else {
        const place = [v.arrivalPlace, v.waitingPosition].filter(Boolean).join('・');
        statusText = `${place ? `${place}に` : ''}到着して待機しております！`;
      }
      const move = v.moveTime && v.arrivalPlace ? `${v.moveTime}前に${v.arrivalPlace}に移動します。` : '';
      const call = v.callToAction === 'なし' ? '' : v.callToAction;
      return openingClosing(v, paragraphJoin([statusText, move, call, v.note]));
    }
    if (type === 'pickupNotice') {
      const dateText = v.dateMode === '今日' ? '本日' : v.dateMode === '明日' ? '明日' : formatJapaneseDate(v.customDate);
      const main = `${dateText}${v.pickupTime ? `${v.pickupTime}ごろに` : ''}${v.pickupPlace ? `${v.pickupPlace}に` : ''}お迎えにあがらせていただきます。`;
      return openingClosing(v, paragraphJoin([main, v.note]));
    }
    return '';
  }
  function savePlace(category, value) {
    const clean = trim(value); if (!clean) return;
    data.places[category] = [clean, ...(data.places[category] || []).filter((item) => item !== clean)].slice(0, 10);
  }
  function savePlaces(type, v) {
    if (type === 'pickupConfirm') savePlace('pickup', v.pickupPlace);
    if (type === 'waitingLocation') { savePlace('waiting', v.waitingPlace); savePlace('meeting', v.meetingPlace); }
    if (type === 'arrived') savePlace('arrival', v.arrivalPlace);
    if (type === 'morningWaiting') savePlace('arrival', v.arrivalPlace);
    if (type === 'pickupNotice') savePlace('pickup', v.pickupPlace);
  }
  function generateFromForm(form) {
    const values = formValues(form); const recipient = getRecipient(form);
    currentInputs = values; savePlaces(currentType, values);
    const item = { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, createdAt: new Date().toISOString(), templateType: currentType, templateName: MESSAGE_TEMPLATES[currentType].title, recipient, message: generateMessage(currentType, values), inputs: values };
    data.settings.defaultRecipient = values.recipientChoice === 'その他' ? data.settings.defaultRecipient : values.recipientChoice;
    data.history = [item, ...data.history].slice(0, 10); saveData(); showResult(item);
  }

  function showResult(item) {
    currentResult = clone(item); setView('result'); useTemplate('resultTemplate');
    document.getElementById('resultRecipient').textContent = `送信先：${item.recipient}`;
    document.getElementById('resultText').value = item.message;
    document.getElementById('copyButton').addEventListener('click', () => copyText(document.getElementById('resultText').value, item.recipient));
    document.getElementById('editButton').addEventListener('click', () => {
      if (item.templateType === 'custom') renderCustomComposer(item.customTemplateId, item.inputs); else renderComposer(item.templateType, item.inputs);
    });
    document.getElementById('resultHomeButton').addEventListener('click', renderHome);
    const share = document.getElementById('shareButton');
    if (navigator.share) { share.classList.remove('hidden'); share.addEventListener('click', async () => { try { await navigator.share({ text: document.getElementById('resultText').value }); } catch (error) { if (error.name !== 'AbortError') showToast('共有画面を開けませんでした。'); } }); }
  }
  async function copyText(text, recipient) {
    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) await navigator.clipboard.writeText(text);
      else {
        const area = document.createElement('textarea'); area.value = text; area.style.position = 'fixed'; area.style.opacity = '0'; document.body.appendChild(area); area.focus(); area.select();
        if (!document.execCommand('copy')) throw new Error('copy failed'); area.remove();
      }
      showToast(`${recipient}に送る文面をコピーしました`);
    } catch (error) { console.warn('コピーに失敗しました。', error); showToast('コピーできませんでした。文面を長押ししてコピーしてください。'); }
  }

  function renderSettings(tab = 'history') {
    setView('settings'); useTemplate('settingsTemplate');
    document.querySelectorAll('.tab').forEach((button) => button.classList.toggle('active', button.dataset.tab === tab));
    renderSettingsTab(tab);
    document.querySelector('.tabs').addEventListener('click', (event) => { const button = event.target.closest('[data-tab]'); if (button) renderSettings(button.dataset.tab); });
  }
  function renderSettingsTab(tab) {
    const content = document.getElementById('settingsContent');
    if (tab === 'history') {
      content.innerHTML = `<div class="section-heading"><h2>生成履歴（${data.history.length}/10）</h2>${data.history.length ? '<button id="clearHistory" class="text-button" type="button">すべて削除</button>' : ''}</div><div id="historyList"></div>`;
      renderHistoryList(document.getElementById('historyList'), data.history);
      document.getElementById('clearHistory')?.addEventListener('click', () => { if (confirm('生成履歴をすべて削除しますか？')) { data.history = []; saveData(); renderSettings('history'); } });
      return;
    }
    if (tab === 'templates') { renderCustomTemplates(content); return; }
    renderPreferences(content);
  }

  function renderCustomTemplates(content) {
    content.innerHTML = `<div class="section-heading"><h2>自由テンプレート</h2><button id="newTemplate" class="text-button" type="button">＋ 新規作成</button></div><div id="customList"></div><div id="templateEditor"></div>`;
    const list = document.getElementById('customList');
    list.innerHTML = data.customTemplates.length ? data.customTemplates.map((item) => `<article class="list-card"><strong>${escapeHtml(item.name)}</strong><p class="history-snippet">${escapeHtml(item.body.replace(/\s+/g, ' ').slice(0, 70))}</p><div class="card-actions"><button class="small-button custom-use" data-id="${item.id}" type="button">この文面を使う</button><button class="small-button custom-edit" data-id="${item.id}" type="button">編集</button><button class="small-button custom-duplicate" data-id="${item.id}" type="button">複製</button><button class="small-button danger custom-delete" data-id="${item.id}" type="button">削除</button></div></article>`).join('') : '<div class="empty-state">よく使う文面を登録すると、ホームからすぐに使えます。</div>';
    document.getElementById('newTemplate').addEventListener('click', () => renderTemplateEditor());
    list.addEventListener('click', (event) => {
      const button = event.target.closest('[data-id]'); if (!button) return;
      const item = data.customTemplates.find((entry) => entry.id === button.dataset.id); if (!item) return;
      if (button.classList.contains('custom-use')) renderCustomComposer(item.id);
      if (button.classList.contains('custom-edit')) renderTemplateEditor(item);
      if (button.classList.contains('custom-duplicate')) { data.customTemplates.push({ ...item, id: `${Date.now()}`, name: `${item.name}（コピー）` }); saveData(); renderSettings('templates'); }
      if (button.classList.contains('custom-delete') && confirm(`「${item.name}」を削除しますか？`)) { data.customTemplates = data.customTemplates.filter((entry) => entry.id !== item.id); saveData(); renderSettings('templates'); }
    });
  }
  function renderTemplateEditor(item = {}) {
    const editor = document.getElementById('templateEditor');
    editor.innerHTML = `<form id="customEditorForm" class="form-card"><h3>${item.id ? '自由テンプレートを編集' : '自由テンプレートを作成'}</h3>${field('templateName','テンプレート名','例：ホテル到着','text',item.name)}${textareaField('templateBody','本文','{{場所}}に到着しております。',item.body)}<p class="hint">使用可能なプレースホルダー</p><div class="placeholder-list">${PLACEHOLDERS.map((x) => `<button class="placeholder insert-placeholder" data-value="{{${x}}}" type="button">{{${x}}}</button>`).join('')}</div><button class="primary-button" type="submit">保存</button></form>`;
    const form = document.getElementById('customEditorForm');
    form.addEventListener('click', (event) => {
      const button = event.target.closest('.insert-placeholder'); if (!button) return;
      const area = form.elements.templateBody; const start = area.selectionStart; area.value = area.value.slice(0, start) + button.dataset.value + area.value.slice(area.selectionEnd); area.focus(); area.setSelectionRange(start + button.dataset.value.length, start + button.dataset.value.length);
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault(); const name = trim(form.elements.templateName.value); const body = trim(form.elements.templateBody.value);
      if (!name || !body) { showToast('テンプレート名と本文を入力してください。'); return; }
      if (item.id) { const target = data.customTemplates.find((entry) => entry.id === item.id); Object.assign(target, { name, body }); }
      else data.customTemplates.push({ id: `${Date.now()}`, name, body });
      saveData(); showToast('自由テンプレートを保存しました'); renderSettings('templates');
    });
  }
  function renderCustomComposer(id, values = {}) {
    const template = data.customTemplates.find((item) => item.id === id); if (!template) { showToast('自由テンプレートが見つかりません。'); renderSettings('templates'); return; }
    currentType = 'custom'; setView('composer'); useTemplate('composerTemplate');
    document.getElementById('composerIcon').textContent = '📝'; document.getElementById('composerHeading').textContent = template.name;
    const recipient = values.recipientChoice || data.settings.defaultRecipient;
    document.getElementById('recipient').innerHTML = optionHtml(RECIPIENTS, recipient);
    document.getElementById('opening').innerHTML = optionHtml(OPENINGS, values.opening || 'なし');
    document.getElementById('closing').innerHTML = optionHtml(CLOSINGS, values.closing || 'なし');
    document.getElementById('customRecipient').value = values.customRecipient || '';
    const found = PLACEHOLDERS.filter((name) => template.body.includes(`{{${name}}}`));
    document.getElementById('specificFields').innerHTML = `<section class="form-card"><h3>文面に入れる内容</h3>${found.length ? found.map((name) => field(`ph_${name}`, name, `${name}を入力`, name === '日付' ? 'date' : 'text', values[`ph_${name}`])).join('') : '<p>入力項目はありません。そのまま文面を作成できます。</p>'}</section>`;
    const form = document.getElementById('messageForm');
    form.addEventListener('input', updateRecipientBanner); form.addEventListener('change', handleConditionalFields);
    form.addEventListener('submit', (event) => {
      event.preventDefault(); const v = formValues(form); let message = template.body;
      found.forEach((name) => { let value = v[`ph_${name}`] || ''; if (name === '日付' && value) value = formatJapaneseDate(value); message = message.split(`{{${name}}}`).join(value); });
      message = openingClosing(v, message); const recipientName = getRecipient(form);
      const entry = { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, createdAt: new Date().toISOString(), templateType: 'custom', customTemplateId: template.id, templateName: template.name, recipient: recipientName, message, inputs: v };
      data.history = [entry, ...data.history].slice(0, 10); saveData(); showResult(entry);
    });
    handleConditionalFields(); updateRecipientBanner();
  }

  function renderPreferences(content) {
    content.innerHTML = `<form id="settingsForm"><section class="settings-group"><h3>文面の初期設定</h3>${selectField('defaultRecipient','デフォルト送信先',RECIPIENTS.filter((x) => x !== 'その他'),data.settings.defaultRecipient)}${selectField('defaultClosing','デフォルト文末',CLOSINGS,data.settings.defaultClosing)}<div class="switch-row"><div><strong>絵文字を使用する</strong><p class="hint">OFFにすると生成文の絵文字を除きます。</p></div><label class="switch"><input id="useEmoji" type="checkbox"${data.settings.useEmoji ? ' checked' : ''} aria-label="絵文字を使用する"><span></span></label></div></section><section class="settings-group"><h3>端末内データ</h3><div class="result-actions"><button id="deleteHistory" class="danger-button" type="button">履歴をすべて削除</button><button id="deletePlaces" class="danger-button" type="button">場所候補をすべて削除</button><button id="resetApp" class="danger-button" type="button">アプリデータを初期化</button></div></section></form>`;
    const form = document.getElementById('settingsForm');
    form.addEventListener('change', () => { data.settings.defaultRecipient = form.elements.defaultRecipient.value; data.settings.defaultClosing = form.elements.defaultClosing.value; data.settings.useEmoji = form.elements.useEmoji.checked; saveData(); showToast('設定を保存しました'); });
    document.getElementById('deleteHistory').addEventListener('click', () => { if (confirm('生成履歴をすべて削除しますか？')) { data.history = []; saveData(); showToast('履歴を削除しました'); } });
    document.getElementById('deletePlaces').addEventListener('click', () => { if (confirm('場所候補をすべて削除しますか？')) { data.places = clone(DEFAULT_DATA.places); saveData(); showToast('場所候補を削除しました'); } });
    document.getElementById('resetApp').addEventListener('click', () => { if (confirm('設定・履歴・場所候補・自由テンプレートをすべて初期化しますか？')) { data = clone(DEFAULT_DATA); saveData(); showToast('アプリデータを初期化しました'); renderSettings('settings'); } });
  }

  backButton.addEventListener('click', () => {
    if (currentView === 'result' && currentResult) {
      if (currentResult.templateType === 'custom') renderCustomComposer(currentResult.customTemplateId, currentResult.inputs); else renderComposer(currentResult.templateType, currentResult.inputs);
    } else renderHome();
  });
  settingsButton.addEventListener('click', () => renderSettings('history'));
  if ('serviceWorker' in navigator && location.protocol !== 'file:') window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch((error) => console.warn('Service Workerを登録できませんでした。', error)));
  renderHome();
})();
