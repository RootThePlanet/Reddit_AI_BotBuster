/* Redd-Eye – Chrome popup script */
(function () {
  'use strict';

  const DEFAULT_AI_THRESHOLD  = 2.5;
  const DEFAULT_BOT_THRESHOLD = 2.9;
  const DEFAULT_POSITION      = 'bottom-right';
  const MIN_THRESHOLD         = 0.5;
  const MAX_THRESHOLD         = 10;

  const aiSlider   = document.getElementById('aiThreshold');
  const botSlider  = document.getElementById('botThreshold');
  const aiValue    = document.getElementById('aiValue');
  const botValue   = document.getElementById('botValue');
  const saveBtn    = document.getElementById('saveBtn');
  const saveStatus = document.getElementById('saveStatus');
  const posButtons = document.querySelectorAll('.pos-btn');

  let selectedPosition = DEFAULT_POSITION;

  /* ── Helpers ─────────────────────────── */
  function updateSliderFill(slider) {
    const pct = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
    slider.style.setProperty('--pct', pct + '%');
  }

  function selectPosition(pos) {
    selectedPosition = pos;
    posButtons.forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.position === pos);
    });
  }

  /* ── Load saved settings ─────────────── */
  chrome.storage.sync.get({
    ai_threshold: DEFAULT_AI_THRESHOLD,
    bot_threshold: DEFAULT_BOT_THRESHOLD,
    widget_position: DEFAULT_POSITION
  }, result => {
    aiSlider.value  = result.ai_threshold;
    botSlider.value = result.bot_threshold;
    aiValue.textContent  = parseFloat(result.ai_threshold).toFixed(1);
    botValue.textContent = parseFloat(result.bot_threshold).toFixed(1);
    updateSliderFill(aiSlider);
    updateSliderFill(botSlider);
    selectPosition(result.widget_position || DEFAULT_POSITION);
  });

  /* ── Slider live updates ─────────────── */
  aiSlider.addEventListener('input', () => {
    aiValue.textContent = parseFloat(aiSlider.value).toFixed(1);
    updateSliderFill(aiSlider);
  });

  botSlider.addEventListener('input', () => {
    botValue.textContent = parseFloat(botSlider.value).toFixed(1);
    updateSliderFill(botSlider);
  });

  /* ── Position buttons ────────────────── */
  posButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      selectPosition(btn.dataset.position);
    });
  });

  /* ── Save ────────────────────────────── */
  saveBtn.addEventListener('click', () => {
    const aiVal  = Math.max(MIN_THRESHOLD, Math.min(MAX_THRESHOLD, parseFloat(aiSlider.value) || DEFAULT_AI_THRESHOLD));
    const botVal = Math.max(MIN_THRESHOLD, Math.min(MAX_THRESHOLD, parseFloat(botSlider.value) || DEFAULT_BOT_THRESHOLD));

    chrome.storage.sync.set({
      ai_threshold: aiVal,
      bot_threshold: botVal,
      widget_position: selectedPosition
    }, () => {
      saveStatus.textContent = '✓ Settings saved';
      saveBtn.textContent = 'Saved!';
      setTimeout(() => {
        saveStatus.textContent = '';
        saveBtn.textContent = 'Save Settings';
      }, 1500);
    });
  });
})();
