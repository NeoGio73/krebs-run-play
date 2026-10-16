/* Completion certificate for The Krebs Run: 5 points of extra credit. Built like The Battle of Embden's (its Tools/certificate.js).
 *
 * The game counts the gates cleared in this visit only (KrebsGame.cs, runSolved). When its completion screen opens it calls
 * KrebsCert.update() through KrebsSave.jslib, and this script draws the certificate panel over the right half of that screen:
 * a name box, the download button, a status line, a live preview and the verification code. The panel unlocks only when all
 * 58 gates were cleared in this visit. The name box starts with the name the student's Embden certificate was made for, when
 * Embden left one in this browser (embden-handoff.js).
 *
 * The picture is a 1650 x 1275 PNG drawn on a canvas. Its 12-character code packs the finishing minute, the minutes played,
 * the first-try count and the number of questions, keyed to the name, so the instructor's checker page can confirm that the
 * game issued that code to that name. Same packing as The Battle of Embden, with this game's own salt (see certCode), so the
 * same private checker reads both games' codes and tells them apart. It must use exactly the same salt and packing.
 *
 * Saving works three ways: in a Claude artifact through its "downloads" capability; on a normal web page with an <a download>
 * link; and on an iPhone or iPad through the share sheet (Save Image puts it in Photos).
 */
(function () {
  'use strict';
  const byId = id => document.getElementById(id);

  // ---------- Verification code ----------
  // d (43 bits) = finishing minute since 2026-01-01 (21 bits, good through 2029) | minutes played (8 bits, up to 4 h 15 min)
  //               | first-try answers (7 bits) | questions (7 bits). A 17-bit check tied to the name and the salt sits on top.
  const CERT_SALT = 'chem-krebs/citric-acid-cycle-ch16/v1', CERT_EPOCH = Date.UTC(2026, 0, 1), CERT_B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  function certHash(str, seed = 0) {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0; i < str.length; i++) { const ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507); h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507); h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }
  const certNorm = name => name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
  function certCode(name, endMs, durMin, first, total) {
    const mins = BigInt(Math.max(0, Math.min(2097151, Math.floor((endMs - CERT_EPOCH) / 60000))));
    const d = (mins << 22n) | (BigInt(Math.min(255, durMin)) << 14n) | (BigInt(Math.min(127, first)) << 7n) | BigInt(Math.min(127, total));
    const mac = BigInt(certHash(CERT_SALT + '|' + certNorm(name) + '|' + d.toString()) % 131072);
    const ks = BigInt(certHash(CERT_SALT + '#' + mac.toString())) & ((1n << 43n) - 1n);
    let v = (mac << 43n) | (d ^ ks), out = '';
    for (let i = 0; i < 12; i++) { out = CERT_B32[Number(v & 31n)] + out; v >>= 5n; }
    return `${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8)}`;
  }

  // ---------- State ----------
  const CERT_ROUTE = [['LAUNCH', 'The PDH complex'], ['LAP 1', 'The route'], ['LAP 2', 'The mechanics'], ['LAP 3', 'The blockades'], ['HYPERSPACE', 'The ATP count']];
  const CERT = { W: 1650, H: 1275, canvas: null, blob: null, blobName: '', url: '', timer: 0, seq: 0, ready: false, shown: false, fonts: null, saving: false,
    end: 0, dur: 0, first: 0, answered: 0, total: 58 };
  const els = { layer: byId('cert-layer'), name: byId('cert-name'), btn: byId('cert-btn'), status: byId('cert-status'), img: byId('cert-preview'),
    code: byId('cert-code'), tip: byId('cert-tip'), lock: byId('cert-lock') };
  // In the Claude artifact viewer, downloads go through its "downloads" capability; anywhere else a plain link download is used.
  let certDlP = null;
  const certGetDl = () => {
    if (!certDlP && window.claude && typeof window.claude.use === 'function') certDlP = Promise.resolve(window.claude.use('downloads')).catch(() => null);
    return certDlP || Promise.resolve(null);
  };
  const certTouch = () => matchMedia('(pointer: coarse)').matches;
  // On an iPhone or iPad the share sheet is the dependable way to keep the picture ("Save Image" puts it in Photos,
  // "Save to Files" in Files), and it also works when the game was opened from a Home Screen icon.
  const certIOS = () => /iP(hone|od|ad)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const certCleanName = () => els.name.value.replace(/\s+/g, ' ').trim();
  const certHasName = n => (n.match(/\p{L}/gu) || []).length >= 2;
  function certWhen(ms) {
    const d = new Date(ms);
    return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}  ·  ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}`;
  }
  const certDur = m => m >= 255 ? '4 h 15 min or more' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;

  // ---------- The picture ----------
  function certSpaced(ctx, text, x, y, sp) {
    // letter-spaced text, centred on x (canvas letterSpacing is not everywhere yet)
    const chars = [...text], ws = chars.map(c => ctx.measureText(c).width), w = ws.reduce((a, b) => a + b, 0) + sp * (chars.length - 1);
    let cx = x - w / 2; const al = ctx.textAlign; ctx.textAlign = 'left';
    chars.forEach((c, i) => { ctx.fillText(c, cx, y); cx += ws[i] + sp; });
    ctx.textAlign = al; return w;
  }
  function drawSpace(ctx, W, H) {
    // Deep space: a faint glow behind the words, stars, and the curve of a planet low down, with the cycle's eight stations on it.
    let g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#060c1c'); g.addColorStop(1, '#02050c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    g = ctx.createRadialGradient(W / 2, 300, 40, W / 2, 300, 950); g.addColorStop(0, 'rgba(255,194,77,0.08)'); g.addColorStop(1, 'rgba(255,194,77,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    let seed = 23; const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 340; i++) {
      const x = rand() * W, y = rand() * H, r = 0.5 + rand() * 1.5, a = 0.15 + rand() * 0.6;
      ctx.fillStyle = `rgba(224,240,245,${a.toFixed(2)})`; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.save(); ctx.beginPath(); ctx.arc(W * 0.5, H + 2350, 2620, 0, Math.PI * 2);
    g = ctx.createLinearGradient(0, H - 330, 0, H); g.addColorStop(0, 'rgba(59,219,235,0.10)'); g.addColorStop(1, 'rgba(20,50,70,0.35)');
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(59,219,235,0.3)'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
  }
  function drawCert(ctx, info) {
    const { W, H } = CERT, cx = W / 2, gold = '#ffc24d', cyan = '#3bdbeb', green = '#57e0a6', ink = '#e0f0f5', muted = '#8fb3bf';
    const font = (w, px) => `${w} ${px}px Inter, "Segoe UI", Arial, sans-serif`;
    drawSpace(ctx, W, H);
    // a quiet panel behind the words, then the frame with targeting corner brackets
    ctx.fillStyle = 'rgba(4,10,16,0.55)'; ctx.fillRect(150, 70, W - 300, H - 140);
    ctx.strokeStyle = 'rgba(255,194,77,0.55)'; ctx.lineWidth = 2; ctx.strokeRect(40, 40, W - 80, H - 80);
    ctx.strokeStyle = 'rgba(255,194,77,0.22)'; ctx.lineWidth = 1; ctx.strokeRect(56, 56, W - 112, H - 112);
    ctx.strokeStyle = gold; ctx.lineWidth = 7; ctx.lineCap = 'square';
    for (const [x, y, sx, sy] of [[40, 40, 1, 1], [W - 40, 40, -1, 1], [40, H - 40, 1, -1], [W - 40, H - 40, -1, -1]]) {
      ctx.beginPath(); ctx.moveTo(x, y + sy * 80); ctx.lineTo(x, y); ctx.lineTo(x + sx * 80, y); ctx.stroke();
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = muted; ctx.font = font(600, 24); certSpaced(ctx, 'THE KREBS RUN  ·  FLIGHT TRAINING', cx, 150, 7);
    ctx.fillStyle = gold; ctx.font = font(800, 72); certSpaced(ctx, 'CERTIFICATE OF COMPLETION', cx, 252, 5);
    ctx.fillStyle = muted; ctx.font = font(400, 32); ctx.fillText('This certifies that', cx, 330);
    // the name, shrunk to fit
    const name = info.name || 'Your name';
    let px = 104; ctx.font = font(700, px);
    while (ctx.measureText(name).width > 1240 && px > 44) { px -= 4; ctx.font = font(700, px); }
    ctx.fillStyle = info.name ? '#ffffff' : 'rgba(224,240,245,0.28)'; ctx.fillText(name, cx, 448);
    let g = ctx.createLinearGradient(cx - 560, 0, cx + 560, 0); g.addColorStop(0, 'rgba(255,194,77,0)'); g.addColorStop(0.5, 'rgba(255,194,77,0.9)'); g.addColorStop(1, 'rgba(255,194,77,0)');
    ctx.fillStyle = g; ctx.fillRect(cx - 560, 486, 1120, 3);
    ctx.fillStyle = ink; ctx.font = font(400, 31); ctx.fillText('flew the Falcon from pyruvate to ATP and cleared every gate on', cx, 556);
    ctx.fillStyle = cyan; ctx.font = font(700, 40); certSpaced(ctx, 'THE CITRIC ACID CYCLE  ·  LEHNINGER, CHAPTER 16', cx, 620, 3);
    // the four battles, each checked off, on the road from glucose to pyruvate
    const x0 = 330, x1 = W - 330, ry = 726, step = (x1 - x0) / (CERT_ROUTE.length - 1);
    ctx.fillStyle = muted; ctx.font = font(600, 17);
    ctx.textAlign = 'right'; ctx.fillText('PYRUVATE', x0 - 52, ry + 6); ctx.textAlign = 'left'; ctx.fillText('ATP', x1 + 52, ry + 6); ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(59,219,235,0.45)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x0 - 40, ry); ctx.lineTo(x1 + 40, ry); ctx.stroke();
    CERT_ROUTE.forEach(([stop, topic], i) => {
      const x = x0 + i * step;
      ctx.fillStyle = i === CERT_ROUTE.length - 1 ? green : gold; ctx.beginPath(); ctx.arc(x, ry, 18, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#04080c'; ctx.lineWidth = 4.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(x - 8, ry + 1); ctx.lineTo(x - 2, ry + 7); ctx.lineTo(x + 9, ry - 6); ctx.stroke();
      ctx.fillStyle = ink; ctx.font = font(700, 21); certSpaced(ctx, stop, x, ry + 56, 1.5);
      ctx.fillStyle = muted; ctx.font = font(400, 20); ctx.fillText(topic, x, ry + 84);
    });
    ctx.lineCap = 'square';
    // stats
    const stats = [['COMPLETED', certWhen(info.end)], ['TIME PLAYED', certDur(info.dur)], ['GATES', `${info.answered} of ${info.total}  ·  ${info.first} first try`]];
    const bw = 430, gap = 26, bx0 = cx - (3 * bw + 2 * gap) / 2, by = 868, bh = 116;
    stats.forEach(([label, value], i) => {
      const bx = bx0 + i * (bw + gap);
      ctx.fillStyle = 'rgba(59,219,235,0.06)'; ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = 'rgba(59,219,235,0.32)'; ctx.lineWidth = 1.5; ctx.strokeRect(bx, by, bw, bh);
      ctx.fillStyle = muted; ctx.font = font(600, 18); certSpaced(ctx, label, bx + bw / 2, by + 40, 4);
      let vp = 30; ctx.font = font(700, vp);
      while (ctx.measureText(value).width > bw - 36 && vp > 18) { vp -= 1; ctx.font = font(700, vp); }
      ctx.fillStyle = ink; ctx.fillText(value, bx + bw / 2, by + 86);
    });
    // verification code
    ctx.fillStyle = muted; ctx.font = font(600, 18); certSpaced(ctx, 'VERIFICATION CODE', cx, 1052, 5);
    ctx.fillStyle = info.name ? gold : 'rgba(255,194,77,0.3)'; ctx.font = font(700, 56); certSpaced(ctx, info.name ? info.code : '••••-••••-••••', cx, 1118, 10);
    ctx.fillStyle = muted; ctx.font = font(400, 23); ctx.fillText('Extra credit  ·  5 points  ·  Upload this image to the D2L assignment folder', cx, 1188);
  }
  function certInfo() {
    const name = certCleanName(), ok = certHasName(name);
    return { name: ok ? name : '', code: ok ? certCode(name, CERT.end, CERT.dur, CERT.first, CERT.total) : '', end: CERT.end, dur: CERT.dur,
      answered: CERT.answered, total: CERT.total, first: CERT.first };
  }
  async function certRender() {
    // Draw the full-size certificate and show it as the preview picture (a real PNG, so right-click "Save image" also works).
    const seq = ++CERT.seq;
    try { await CERT.fonts; } catch (err) { /* fall back to system fonts */ }
    if (seq !== CERT.seq || !CERT.ready) return null;
    if (!CERT.canvas) { CERT.canvas = document.createElement('canvas'); CERT.canvas.width = CERT.W; CERT.canvas.height = CERT.H; }
    const info = certInfo();
    drawCert(CERT.canvas.getContext('2d'), info);
    const blob = await new Promise(res => CERT.canvas.toBlob(res, 'image/png'));
    if (seq !== CERT.seq || !blob) return null;
    if (CERT.url) URL.revokeObjectURL(CERT.url);
    CERT.blob = blob; CERT.blobName = info.name; CERT.url = URL.createObjectURL(blob);
    els.img.src = CERT.url; els.img.hidden = false;
    els.code.textContent = info.name ? info.code : '';
    return { blob, info };
  }

  // ---------- The panel ----------
  function certStatus(text, kind = '') { els.status.textContent = text; els.status.className = kind; }
  function certRefresh() {
    const ok = certHasName(certCleanName());
    els.btn.disabled = !ok || CERT.saving;
    if (!CERT.saving) certStatus(ok ? 'Check the spelling, then download. The file is a PNG picture.' : 'Type your first and last name to unlock the download.');
    clearTimeout(CERT.timer); CERT.timer = setTimeout(certRender, 220);
  }
  function certFile(name) {
    const safe = name.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'Student';
    return `The_Krebs_Run_Certificate_${safe}.png`;
  }
  function certShare(name) {
    // the picture must already be drawn for this name: the share sheet only opens straight from the tap
    if (!certIOS() || !navigator.share || !navigator.canShare || !CERT.blob || CERT.blobName !== name) return false;
    let file;
    try { file = new File([CERT.blob], certFile(name), { type: 'image/png' }); if (!navigator.canShare({ files: [file] })) return false; } catch (err) { return false; }
    CERT.saving = true; els.btn.disabled = true;
    navigator.share({ files: [file] })
      .then(() => certStatus('Done. Upload the picture to the D2L assignment folder.', 'ok'))
      .catch(err => certStatus(err && err.name === 'AbortError'
        ? 'Cancelled. Tap DOWNLOAD CERTIFICATE again and choose Save Image, or press and hold the picture.'
        : 'Press and hold the certificate picture, then choose Save to Photos.', err && err.name === 'AbortError' ? '' : 'warn'))
      .finally(() => { CERT.saving = false; els.btn.disabled = !certHasName(certCleanName()); });
    return true;
  }
  async function certDownload() {
    const name = certCleanName();
    if (!CERT.ready || CERT.saving || !certHasName(name)) return;
    if (!(window.claude && typeof window.claude.use === 'function') && certShare(name)) return;
    CERT.saving = true; els.btn.disabled = true; certStatus('Preparing your certificate…');
    try {
      const r = await certRender();
      if (!r) throw new Error('render');
      const filename = certFile(name);
      const dl = await Promise.race([certGetDl(), new Promise(res => setTimeout(() => res(null), 3000))]);
      if (dl) {
        try {
          await dl.save({ filename, data: r.blob });
          certStatus(`Saved as ${filename}. Upload it to the D2L assignment folder.`, 'ok');
        } catch (err) {
          if (err && err.code === 'declined') certStatus('Download cancelled. Click DOWNLOAD CERTIFICATE when you are ready.');
          else if (err && err.code === 'rate_limited') certStatus('A save prompt is already open. Finish that one first.');
          else certStatus('The download did not start here. Right-click the certificate picture and choose “Save image as…”.', 'warn');
        }
      } else {
        const a = document.createElement('a');
        a.href = CERT.url; a.download = filename; a.rel = 'noopener';
        document.body.appendChild(a); a.click(); a.remove();
        certStatus(certTouch() ? `Downloading ${filename}. If nothing appears, press and hold the picture and save it.` : `Downloading ${filename}. If nothing appears, right-click the picture and choose “Save image as…”.`, 'ok');
      }
    } catch (err) {
      certStatus('Something went wrong drawing the certificate. Try again, or take a screenshot of this screen.', 'warn');
    } finally {
      CERT.saving = false; els.btn.disabled = !certHasName(certCleanName());
    }
  }
  // The panel sits in the game's own 1600 x 1000 layout, which the game scales to fit its canvas and centres.
  function place() {
    const canvas = byId('unity-canvas'), host = els.layer.parentElement;
    if (!canvas || !CERT.shown) return;
    const c = canvas.getBoundingClientRect(), h = host.getBoundingClientRect();
    if (!c.width || !c.height) return;
    const s = Math.min(c.width / 1600, c.height / 1000);
    els.layer.style.transform = `translate(${c.left - h.left + (c.width - 1600 * s) / 2}px, ${c.top - h.top + (c.height - 1000 * s) / 2}px) scale(${s})`;
  }
  function update(info) {
    if (!info || !info.show) {
      CERT.shown = false; els.layer.hidden = true; clearTimeout(CERT.timer);
      if (document.activeElement === els.name) els.name.blur();
      return;
    }
    // The panel is part of the page, not the game's canvas, so it would be hidden in full screen.
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
    CERT.end = Math.floor((info.end || 0) / 60000) * 60000; CERT.dur = Math.max(0, info.minutes | 0);
    CERT.first = info.first | 0; CERT.answered = info.answered | 0; CERT.total = info.total | 0 || 58;
    CERT.ready = !!info.ready && CERT.answered >= CERT.total && CERT.end > 0;
    if (!CERT.fonts) CERT.fonts = Promise.race([
      Promise.all(['800 72px Inter', '700 40px Inter', '600 24px Inter', '400 32px Inter'].map(f => document.fonts.load(f))),
      new Promise(res => setTimeout(res, 2500))]);
    const wasShown = CERT.shown; CERT.shown = true; els.layer.hidden = false; place(); certGetDl();
    els.layer.classList.toggle('locked', !CERT.ready);
    if (!CERT.ready) {
      els.name.disabled = true; els.btn.disabled = true; els.tip.hidden = true; els.img.hidden = true; els.lock.hidden = false; els.code.textContent = '';
      certStatus(`The certificate unlocks after a full playthrough: all ${CERT.total} gates cleared in one visit. So far this visit: ${CERT.answered} of ${CERT.total}.`, 'warn');
      return;
    }
    els.name.disabled = false; els.tip.hidden = false; els.lock.hidden = true;
    // the name the student's Embden certificate was made for, if Embden left one in this browser; it can still be changed
    if (!wasShown && !els.name.value) {
      try { const pilot = window.KrebsHandoff && window.KrebsHandoff.read().pilot; if (pilot) els.name.value = pilot; } catch (err) { /* nothing left behind */ }
    }
    els.tip.textContent = certTouch() ? 'If the download doesn’t start, press and hold the picture and save it.' : 'If the download doesn’t start, right-click the picture and choose “Save image as…”.';
    certRefresh();
    if (!wasShown && !certTouch()) els.name.focus();
  }
  els.name.addEventListener('input', certRefresh);
  // Keys typed in the name box belong to the name, not to the game. Unity listens on the whole window and cancels the keys it
  // reads, so these listeners are registered before Unity starts and stop the keys on their way down, before Unity sees them.
  // That also stops them reaching the box's own listeners, so Enter (download) is handled here.
  for (const type of ['keydown', 'keyup', 'keypress']) window.addEventListener(type, e => {
    if (e.target !== els.name) return;
    e.stopImmediatePropagation();
    if (type === 'keydown' && e.key === 'Enter') { e.preventDefault(); certDownload(); }
  }, true);
  els.btn.addEventListener('click', certDownload);
  window.addEventListener('resize', place);
  if ('ResizeObserver' in window) new ResizeObserver(place).observe(els.layer.parentElement);
  window.KrebsCert = { update, place, code: certCode, norm: certNorm };
})();
