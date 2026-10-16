/* Browser Practice wrapper for The Krebs Run. Saves stay in the browser; no LMS is contacted. */
(function () {
  'use strict';
  const byId = id => document.getElementById(id);
  let busy = true, pendingImport = null;
  const build = window.KREBS_BUILD_FILES;
  const gameControls = ['download-save', 'load-save', 'fullscreen', 'save-exit'];
  function setBusy(value) {
    busy = value;
    gameControls.forEach(id => { byId(id).disabled = value || KrebsSave.details().ended; });
  }
  window.KrebsShowMessage = function (title, body) {
    byId('message-title').textContent = title;
    byId('message-body').textContent = body;
    if (!byId('message-dialog').open) byId('message-dialog').showModal();
  };
  function askUnityForCheckpoint() {
    if (!window.krebsUnity || busy || KrebsSave.details().ended) return;
    window.krebsUnity.SendMessage('KrebsGame', 'SaveProgress');
  }
  function downloadSave() {
    let checkpointWarning = '';
    try { askUnityForCheckpoint(); }
    catch (_) { checkpointWarning = 'The game could not provide a fresh checkpoint. This file contains the last retained progress and may omit your latest change.'; }
    const contents = KrebsSave.exportSave();
    const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Krebs-Run-Save-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return checkpointWarning;
  }
  byId('download-save').addEventListener('click', () => {
    try {
      const warning = downloadSave();
      KrebsShowMessage('Save file requested', (warning ? warning + '\n\n' : '') + 'Check your browser’s downloads for Krebs-Run-Save…json. Keep this file as a backup, or choose Load Save in the game on another computer. If your browser asks whether to keep the file, allow the download.');
    } catch (error) { KrebsShowMessage('Save file unavailable', error.message); }
  });
  byId('backup-before-load').addEventListener('click', () => {
    try { const warning = downloadSave(); byId('import-error').hidden = false; byId('import-error').textContent = (warning ? warning + ' ' : '') + 'Download requested. Check your downloads before replacing this progress.'; }
    catch (error) { byId('import-error').hidden = false; byId('import-error').textContent = error.message; }
  });
  byId('load-save').addEventListener('click', () => { byId('save-file').value = ''; byId('save-file').click(); });
  byId('save-file').addEventListener('change', async () => {
    const file = byId('save-file').files[0];
    if (!file || busy) return;
    try {
      if (file.size > 32768) throw new Error('This file is too large to be a Krebs Run save. Choose a save downloaded from this game.');
      const text = await file.text();
      const preview = KrebsSave.inspectSave(text);
      askUnityForCheckpoint();
      const current = KrebsSave.report();
      pendingImport = text;
      byId('import-summary').textContent = 'Selected save: ' + preview.stages + '/5 stages complete · ' + preview.gates + '/58 gates cleared.' +
        '\nSaved: ' + (preview.savedAt ? new Date(preview.savedAt).toLocaleString() : 'Date unavailable') +
        '\n\nCurrent game: ' + (current.currentStages || 0) + '/5 stages · ' + (current.currentGates || 0) + '/58 gates.';
      byId('import-error').hidden = true;
      byId('import-dialog').showModal();
    } catch (error) { pendingImport = null; KrebsShowMessage('Save file not loaded', error.message + '\n\nYour current progress has not been replaced.'); }
  });
  byId('cancel-load').addEventListener('click', () => byId('import-dialog').close());
  byId('import-dialog').addEventListener('close', () => { pendingImport = null; });
  byId('confirm-load').addEventListener('click', async () => {
    if (!pendingImport || busy) return;
    const selected = pendingImport;
    try {
      askUnityForCheckpoint();
      // The bridge holds old Unity writes before Quit can emit its final checkpoint.
      KrebsSave.applyImport(selected);
      setBusy(true);
      byId('import-dialog').close();
      byId('loading').hidden = false;
      byId('loading-label').textContent = 'RESTORING YOUR FLIGHT RECORD';
      const oldInstance = window.krebsUnity;
      window.krebsUnity = null;
      if (oldInstance) await oldInstance.Quit();
      const freshCanvas = document.createElement('canvas');
      freshCanvas.id = 'unity-canvas'; freshCanvas.tabIndex = 0;
      freshCanvas.setAttribute('aria-label', 'The Krebs Run, a citric acid cycle flight game.');
      byId('unity-canvas').replaceWith(freshCanvas);
      KrebsSave.resumeAfterImport();
      await startGame();
      KrebsShowMessage('Flight record loaded', 'Your selected save is now open.\n\n' + KrebsSave.status());
    } catch (error) {
      if (busy) loadFailure('The selected save could not be opened. ' + error.message + ' Keep your downloaded save file so you can load it again.');
      else { byId('import-error').hidden = false; byId('import-error').textContent = error.message; }
    }
  });
  byId('help').addEventListener('click', () => KrebsShowMessage('Your flight record',
    'Fly the citric acid cycle: a launch, three laps and a hyperspace jump, with unlimited hints and retries. This is ungraded practice.\n\nAutosave remembers progress in this browser profile at this activity address. It does not use your D2L account and does not move automatically between computers. Private browsing, clearing site data, or a lab computer reset can remove it.\n\nDownload Save keeps a portable backup. Load Save lets you select that file and review it before replacing your current game. On a shared computer, load your own save before playing; the browser save may belong to someone else.\n\nUse Save & exit before closing. If browser saving is unavailable, Download Save still lets you keep your progress. Press Esc to leave full screen and reach these controls.'));
  byId('save-details').addEventListener('click', () => {
    const info = KrebsSave.report();
    KrebsShowMessage('Save details', KrebsSave.status() +
      '\n\nCurrent flight record: ' + (info.currentStages || 0) + '/5 stages · ' + (info.currentGates || 0) + '/58 gates cleared · ' + (info.currentFirstTry || 0) + ' on the first try' +
      '\nLast browser save: ' + (info.lastSavedAt ? new Date(info.lastSavedAt).toLocaleString() : 'No confirmed save this session') +
      '\n\nDownload Save keeps a separate backup. Progress is not linked to a D2L account or gradebook.\nBrowser Practice 1.0.0');
  });
  byId('save-exit').addEventListener('click', () => {
    try {
      askUnityForCheckpoint();
      if (KrebsSave.finish()) {
        setBusy(true);
        document.querySelector('main').inert = true;
        byId('unity-canvas').style.opacity = '.35';
        byId('save-exit').textContent = 'Saved';
        KrebsShowMessage('Saved in this browser', 'Your progress is saved here. You may close this tab and return to your course. Reopen the same activity in this browser profile to continue.');
        byId('download-save').disabled = false;
      } else KrebsShowMessage('Keep a save file before leaving', KrebsSave.status() + '\n\nUse Download Save to keep this progress. Keep this tab open until you have the file.');
    } catch (error) { KrebsShowMessage('Save needs attention', error.message + '\nUse Download Save before leaving.'); }
  });
  byId('fullscreen').addEventListener('click', () => { if (!busy && window.krebsUnity) window.krebsUnity.SetFullscreen(1); });
  byId('retry').addEventListener('click', () => location.reload());
  function loadFailure(message) {
    byId('loading').hidden = false;
    byId('load-error').hidden = false;
    byId('load-error').textContent = 'The game could not start. ' + String(message || '') + ' Try a current desktop browser. If this continues, ask your instructor to check the game files.';
    byId('loading-label').textContent = 'LAUNCH NEEDS ATTENTION';
    byId('retry').hidden = false;
    // Allow saving the retained checkpoint even when the Unity renderer cannot start.
    byId('download-save').disabled = false;
  }
  async function startGame() {
    setBusy(true);
    byId('loading').hidden = false; byId('load-error').hidden = true; byId('retry').hidden = true;
    const config = { dataUrl: build.dataUrl, frameworkUrl: build.frameworkUrl, codeUrl: build.codeUrl,
      streamingAssetsUrl: build.streamingAssetsUrl || 'StreamingAssets', companyName: 'Krebs Run',
      productName: 'The Krebs Run', productVersion: '1.0.0-browser', backgroundColor: '#050b16',
      showBanner: (text, type) => { if (type === 'error') loadFailure(text); } };
    const instance = await createUnityInstance(byId('unity-canvas'), config, progress => {
      const value = Math.round(progress * 100);
      byId('progress-fill').style.width = value + '%';
      document.querySelector('.progress').setAttribute('aria-valuenow', String(value));
      byId('loading-label').textContent = 'LOADING YOUR SHIP · ' + value + '%';
    });
    window.krebsUnity = instance;
    byId('loading').hidden = true; setBusy(false); byId('unity-canvas').focus();
  }
  const initial = KrebsSave.init();
  if (KrebsSave.details().warning) KrebsShowMessage('Browser save needs attention', initial.status + '\n\nYou can still play and use Download Save to keep a file.');
  const loader = document.createElement('script'); loader.src = build.loaderUrl;
  loader.onerror = () => loadFailure('The Unity loader file is unavailable.');
  loader.onload = () => startGame().catch(error => loadFailure(error.message));
  document.body.appendChild(loader);
})();
