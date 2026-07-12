const state = { photos: [], duration: 3, transition: 'mix', playing: false, audioContext: null, musicTimer: null, musicNodes: [], renderSession: 0, musicSession: 0 };
const $ = (id) => document.getElementById(id);
const input = $('photoInput'), grid = $('photoGrid'), dropzone = $('dropzone');
const previewBtn = $('previewBtn'), previewSection = $('previewSection'), canvas = $('movieCanvas'), ctx = canvas.getContext('2d');

function updateUI() {
  $('countBadge').textContent = `${state.photos.length} / 5`;
  previewBtn.disabled = state.photos.length < 3;
  $('readyHint').textContent = state.photos.length < 3 ? `Add ${3 - state.photos.length} more photo${3 - state.photos.length === 1 ? '' : 's'} to begin` : 'Your story is ready to preview';
  grid.innerHTML = '';
  state.photos.forEach((photo, index) => {
    const card = document.createElement('div'); card.className = 'photo-card'; card.draggable = true; card.dataset.index = index;
    card.innerHTML = `<img src="${photo.url}" alt="Selected photo ${index + 1}"><span>${index + 1}</span><button class="remove-photo" type="button" aria-label="Remove photo ${index + 1}">×</button>`;
    card.querySelector('button').onclick = (event) => { event.stopPropagation(); URL.revokeObjectURL(photo.url); state.photos.splice(index, 1); updateUI(); };
    card.addEventListener('dragstart', (event) => event.dataTransfer.setData('text/plain', index));
    card.addEventListener('dragover', (event) => event.preventDefault());
    card.addEventListener('drop', (event) => { event.preventDefault(); const oldIndex = Number(event.dataTransfer.getData('text/plain')); const [moved] = state.photos.splice(oldIndex, 1); state.photos.splice(index, 0, moved); updateUI(); });
    grid.append(card);
  });
}

async function addFiles(files) {
  const valid = [...files].filter(file => file.type.startsWith('image/'));
  const room = 5 - state.photos.length;
  $('photoWarning').textContent = valid.length > room ? `Only five photos can be used. Added the first ${room}.` : '';
  for (const file of valid.slice(0, room)) {
    const url = URL.createObjectURL(file); const img = new Image(); img.src = url;
    await img.decode(); state.photos.push({ url, img, name: file.name });
  }
  updateUI(); input.value = '';
}
input.addEventListener('change', event => addFiles(event.target.files));
['dragenter','dragover'].forEach(type => dropzone.addEventListener(type, event => { event.preventDefault(); dropzone.classList.add('dragging'); }));
['dragleave','drop'].forEach(type => dropzone.addEventListener(type, event => { event.preventDefault(); dropzone.classList.remove('dragging'); }));
dropzone.addEventListener('drop', event => addFiles(event.dataTransfer.files));
$('durationRange').addEventListener('input', event => { state.duration = Number(event.target.value); $('durationValue').textContent = `${state.duration} seconds per photo`; });
$('transitionSelect').addEventListener('change', event => state.transition = event.target.value);

function drawPhoto(image, alpha = 1, xOffset = 0) {
  // A subtle, blurred fill keeps the cinematic 16:9 frame without cutting off faces.
  const scale = Math.max(canvas.width / image.width, canvas.height / image.height);
  const w = image.width * scale, h = image.height * scale;
  ctx.save(); ctx.globalAlpha = alpha; ctx.filter = 'blur(24px) brightness(.56)'; ctx.drawImage(image, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h); ctx.restore();
  const fullScale = Math.min(canvas.width / image.width, canvas.height / image.height);
  const fullWidth = image.width * fullScale, fullHeight = image.height * fullScale;
  ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(image, (canvas.width - fullWidth) / 2 + xOffset, (canvas.height - fullHeight) / 2, fullWidth, fullHeight); ctx.restore();
}
function drawZoomPhoto(image, alpha, zoom, blur = 0) {
  const scale = Math.min(canvas.width / image.width, canvas.height / image.height) * zoom;
  const width = image.width * scale, height = image.height * scale;
  ctx.save(); ctx.globalAlpha = alpha; ctx.filter = blur ? `blur(${blur}px)` : 'none'; ctx.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height); ctx.restore();
}
function ease(t) { return t * t * (3 - 2 * t); }
function drawAt(seconds) {
  if (!state.photos.length) {
    ctx.fillStyle = '#141725'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff'; ctx.font = '600 28px DM Sans, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Please add your photos first', canvas.width / 2, canvas.height / 2); return;
  }
  const transitionTime = .8, step = state.duration - transitionTime;
  const index = Math.min(Math.floor(seconds / step), state.photos.length - 1);
  const progress = seconds - index * step;
  ctx.fillStyle = '#141725'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (index === 0 || progress >= transitionTime) { drawPhoto(state.photos[index].img); return; }
  const t = ease(progress / transitionTime), previous = state.photos[index - 1], current = state.photos[index];
  const effects = ['dissolve', 'slide', 'zoom', 'wipe', 'blur'];
  const effect = state.transition === 'mix' ? effects[(index - 1) % effects.length] : state.transition;
  if (effect === 'slide') { drawPhoto(previous.img, 1, -t * canvas.width * .16); drawPhoto(current.img, 1, (1 - t) * canvas.width); return; }
  if (effect === 'zoom') {
    drawPhoto(previous.img); drawZoomPhoto(current.img, t, .88 + t * .12);
    ctx.save(); ctx.globalAlpha = (1 - t) * .18; ctx.fillStyle = '#fff4dd'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.restore(); return;
  }
  if (effect === 'wipe') {
    drawPhoto(previous.img); ctx.save(); ctx.beginPath(); ctx.rect(0, 0, canvas.width * t, canvas.height); ctx.clip(); drawPhoto(current.img); ctx.restore();
    ctx.save(); ctx.globalAlpha = .65; ctx.fillStyle = '#fff'; ctx.fillRect(canvas.width * t - 3, 0, 6, canvas.height); ctx.restore(); return;
  }
  if (effect === 'blur') { drawZoomPhoto(previous.img, 1 - t, 1 + t * .04, t * 11); drawZoomPhoto(current.img, t, 1.04 - t * .04, (1 - t) * 11); return; }
  drawPhoto(previous.img, 1); drawPhoto(current.img, t);
}
function movieLength() { return state.photos.length * state.duration - (state.photos.length - 1) * .8; }

function primeAudio() {
  const audio = state.audioContext || new AudioContext(); state.audioContext = audio;
  if (audio.state === 'suspended') audio.resume().catch(() => {});
}

async function startMusic(destination) {
  stopMusic();
  const musicSession = ++state.musicSession;
  const audio = state.audioContext || new AudioContext(); state.audioContext = audio;
  if (audio.state === 'suspended') await audio.resume();
  const master = audio.createGain(), compressor = audio.createDynamicsCompressor();
  master.gain.value = .34; compressor.threshold.value = -20; compressor.knee.value = 18; master.connect(compressor).connect(destination || audio.destination);
  const chords = [[196,246.94,293.66],[174.61,220,261.63],[220,277.18,329.63],[146.83,196,246.94]];
  const melody = [587.33,493.88,440,493.88,587.33,659.25,587.33,493.88,440,392,440,493.88,587.33,493.88,440,392]; let phrase = 0;
  const schedule = () => {
    if (musicSession !== state.musicSession) return;
    const start = audio.currentTime + .08;
    chords.forEach((chord, chordIndex) => chord.forEach((note, noteIndex) => {
      const when = start + chordIndex * 2, pad = audio.createOscillator(), padGain = audio.createGain();
      pad.type = noteIndex === 0 ? 'triangle' : 'sine'; pad.frequency.value = note;
      padGain.gain.setValueAtTime(.0001, when); padGain.gain.linearRampToValueAtTime(noteIndex === 0 ? .11 : .07, when + .28); padGain.gain.exponentialRampToValueAtTime(.0001, when + 1.94);
      pad.connect(padGain).connect(master); pad.start(when); pad.stop(when + 1.98); state.musicNodes.push(pad);
    }));
    for (let i = 0; i < 16; i++) {
      const when = start + i * .5, bell = audio.createOscillator(), bellGain = audio.createGain();
      bell.type = 'sine'; bell.frequency.value = melody[(phrase + i) % melody.length];
      bellGain.gain.setValueAtTime(.0001, when); bellGain.gain.exponentialRampToValueAtTime(.17, when + .035); bellGain.gain.exponentialRampToValueAtTime(.0001, when + .42);
      bell.connect(bellGain).connect(master); bell.start(when); bell.stop(when + .45); state.musicNodes.push(bell);
    }
    phrase = (phrase + 2) % melody.length;
  };
  // Defer node creation so the click handler stays responsive (avoids INP blocking).
  setTimeout(() => { if (musicSession === state.musicSession) { schedule(); state.musicTimer = setInterval(schedule, 8000); } }, 0);
  return audio;
}
function stopMusic() { ++state.musicSession; clearInterval(state.musicTimer); state.musicTimer = null; state.musicNodes.forEach(node => { try { node.stop(); } catch (_) {} }); state.musicNodes = []; }

async function playPreview() {
  if (state.playing) return; const session = ++state.renderSession; state.playing = true; $('movieOverlay').classList.remove('visible'); drawAt(0);
  // Never make the visual preview wait for audio-device initialization.
  startMusic().catch(() => { $('exportStatus').textContent = 'Preview is playing, but your browser blocked audio. Click Preview once more to enable sound.'; });
  const started = performance.now(); const length = movieLength();
  const frame = (now) => { const elapsed = (now - started) / 1000; drawAt(Math.min(elapsed, length)); if (elapsed < length && state.playing && session === state.renderSession) requestAnimationFrame(frame); else if (session === state.renderSession) { state.playing = false; stopMusic(); $('movieOverlay').classList.add('visible'); } };
  requestAnimationFrame(frame);
}
previewBtn.onclick = () => { primeAudio(); previewSection.hidden = false; previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' }); requestAnimationFrame(playPreview); };
$('replayBtn').onclick = () => { primeAudio(); playPreview(); };
$('closePreview').onclick = () => { ++state.renderSession; state.playing = false; stopMusic(); previewSection.hidden = true; };

async function exportVideo() {
  primeAudio();
  if (!window.MediaRecorder) { $('exportStatus').textContent = 'Your browser does not support video export. Try Chrome or Edge.'; return; }
  if (state.photos.length < 3) { $('exportStatus').textContent = 'Please choose at least 3 photos before exporting.'; return; }
  ++state.renderSession; state.playing = false; stopMusic(); drawAt(0);
  const button = $('exportBtn'); button.disabled = true; $('exportStatus').textContent = 'Rendering your movie… please keep this tab open.';
  try {
    const videoStream = canvas.captureStream(30);
    state.audioContext = state.audioContext || new AudioContext();
    const audio = state.audioContext, destination = audio.createMediaStreamDestination();
    const stream = new MediaStream([...videoStream.getVideoTracks(), ...destination.stream.getAudioTracks()]);
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' : 'video/webm';
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6000000 }), chunks = [];
    recorder.ondataavailable = event => event.data.size && chunks.push(event.data);
    const done = new Promise(resolve => recorder.onstop = resolve); recorder.start();
    startMusic(destination).catch(() => {}); // Video rendering must still complete if audio is unavailable.
    const length = movieLength(), started = performance.now();
    await new Promise(resolve => {
      const renderer = setInterval(() => {
        const elapsed = (performance.now() - started) / 1000; drawAt(Math.min(elapsed, length));
        if (elapsed >= length) { clearInterval(renderer); resolve(); }
      }, 1000 / 30);
    });
    stopMusic(); recorder.stop(); await done;
    if (!chunks.length) throw new Error('The browser did not create any video data.');
    const url = URL.createObjectURL(new Blob(chunks, { type: mime })), link = document.createElement('a');
    link.href = url; link.download = 'frameflow-photo-story.webm'; link.style.display = 'none'; document.body.append(link); link.click(); link.remove();
    $('exportStatus').innerHTML = `Export complete. If the download did not start, <a href="${url}" download="frameflow-photo-story.webm">download your video here</a>.`;
    setTimeout(() => URL.revokeObjectURL(url), 300000);
  } catch (error) {
    stopMusic(); $('exportStatus').textContent = `Export could not finish: ${error.message} Please try Chrome or Edge.`;
  } finally { button.disabled = false; }
}
$('exportBtn').onclick = exportVideo;
$('resetBtn').onclick = () => { state.playing = false; stopMusic(); state.photos.forEach(photo => URL.revokeObjectURL(photo.url)); state.photos = []; previewSection.hidden = true; $('photoWarning').textContent = ''; updateUI(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
updateUI();
