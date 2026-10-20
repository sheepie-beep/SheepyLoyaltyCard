const {url: API_URL, publishableKey: API_KEY} = window.LOYALTY_CONFIG;
const stampRow = document.getElementById('stampRow');
const accessPanel = document.getElementById('accessPanel');
const card = document.getElementById('loyaltyCard');
const ticketForm = document.getElementById('ticketForm');
const ticketCode = document.getElementById('ticketCode');
const loginStatus = document.getElementById('loginStatus');
const saveStatus = document.getElementById('saveStatus');
const stampStatus = document.getElementById('stampStatus');
const rewardStatus = document.getElementById('rewardStatus');
const SIZE = 100;
const heartPixels = ['0111001110','1111111111','1111111111','1111111111','0111111110','0011111100','0001111000','0000110000'];
let currentCode = '';
let generation = 0;

async function requestTicket(payload) {
  const response = await fetch(`${API_URL}/functions/v1/loyalty-ticket`, {
    method: 'POST',
    headers: {'Content-Type':'application/json','apikey':API_KEY},
    body: JSON.stringify({...payload, environment:'live'})
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Something went wrong.');
  return result;
}

function drawHeart(ctx, color) {
  const pixelSize = SIZE / 10;
  ctx.fillStyle = color;
  heartPixels.forEach((row, y) => [...row].forEach((pixel, x) => {
    if (pixel === '1') ctx.fillRect(x * pixelSize, (y + 1) * pixelSize, pixelSize, pixelSize);
  }));
}

function eraseLine(ctx, from, to) {
  ctx.globalCompositeOperation = 'destination-out';
  ctx.lineWidth = 16;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
}

function createStamp(index, earned, existingStrokes, code, myGeneration) {
  const stamp = document.createElement('div');
  stamp.className = 'stamp';
  const pinkCanvas = document.createElement('canvas');
  pinkCanvas.width = SIZE; pinkCanvas.height = SIZE; pinkCanvas.className = 'pink-heart';
  drawHeart(pinkCanvas.getContext('2d'), '#ff8fbd');
  const silver = document.createElement('canvas');
  silver.width = SIZE; silver.height = SIZE; silver.className = 'scratch-layer';
  const ctx = silver.getContext('2d');
  drawHeart(ctx, '#c2c4ce');
  for (const s of existingStrokes) {
    if (s && ['x1','y1','x2','y2'].every(k => typeof s[k] === 'number')) {
      eraseLine(ctx, {x:s.x1,y:s.y1}, {x:s.x2,y:s.y2});
    }
  }
  stamp.append(pinkCanvas, silver);
  if (!earned) {
    stamp.classList.add('locked');
    stamp.title = 'Earn a commission stamp to unlock this heart!';
    silver.style.pointerEvents = 'none';
    stampRow.appendChild(stamp);
    return;
  }
  stamp.title = `Heart ${index + 1}: scratch me!`;
  stampRow.appendChild(stamp);

  let scratching = false;
  let last = null;
  let pending = [];
  let sending = false;
  let retryTimer = null;
  const position = e => {
    const r = silver.getBoundingClientRect();
    return {x:Math.max(0,Math.min(100,(e.clientX-r.left)*SIZE/r.width)),
            y:Math.max(0,Math.min(100,(e.clientY-r.top)*SIZE/r.height))};
  };
  async function flush() {
    if (sending || !pending.length || generation !== myGeneration) return;
    sending = true;
    const batch = pending.splice(0, 50);
    try {
      await requestTicket({action:'scratch', code, heart_number:index+1, strokes:batch});
      if (generation === myGeneration) saveStatus.textContent = '♡ Scratches saved!';
    } catch (err) {
      pending.unshift(...batch);
      if (generation === myGeneration) saveStatus.textContent = `Save interrupted: ${err.message} Please wait and try again.`;
      clearTimeout(retryTimer);
      retryTimer = setTimeout(flush, 12000);
      sending = false;
      return;
    }
    sending = false;
    if (pending.length) flush();
  }
  function mark(from, to) {
    eraseLine(ctx, from, to);
    pending.push({x1:from.x,y1:from.y,x2:to.x,y2:to.y});
    if (pending.length >= 40) flush();
  }
  silver.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    scratching = true;
    silver.setPointerCapture(e.pointerId);
    last = position(e);
    mark(last,last);
  });
  silver.addEventListener('pointermove', e => {
    if (!scratching) return;
    const next = position(e);
    mark(last,next);
    last = next;
  });
  function finish() {
    if (!scratching) return;
    scratching = false;
    last = null;
    flush();
  }
  silver.addEventListener('pointerup',finish);
  silver.addEventListener('pointercancel',finish);
  silver.addEventListener('lostpointercapture',finish);
  window.addEventListener('pagehide', () => {
    // Unsaved strokes remain visible until refresh; avoid silently claiming persistence.
    if (pending.length && generation === myGeneration) saveStatus.textContent = 'Some scratches are still saving.';
  });
}

async function openTicket(code) {
  loginStatus.textContent = 'Opening your card...';
  const result = await requestTicket({action:'load',code});
  generation++;
  const myGeneration = generation;
  currentCode = code;
  sessionStorage.setItem('delri-loyalty-code', code);
  stampRow.replaceChildren();
  const progress = new Map((result.hearts || []).map(h => [h.heart_number,h.strokes || []]));
  for (let i=0; i<5; i++) createStamp(i,i<result.stamps_earned,progress.get(i+1)||[],code,myGeneration);
  stampStatus.textContent = `${result.stamps_earned} / 5 hearts earned ♡`;
  rewardStatus.textContent = result.reward_claimed ? '♡ Your free reward has been claimed!' :
    result.stamps_earned === 5 ? '♡ All five hearts earned! Ask Delri about your free reward!' : '';
  saveStatus.textContent = '';
  accessPanel.hidden = true;
  card.hidden = false;
  loginStatus.textContent = '';
}

ticketForm.addEventListener('submit', async e => {
  e.preventDefault();
  const code = ticketCode.value.trim().toUpperCase();
  ticketForm.querySelector('button').disabled = true;
  try { await openTicket(code); }
  catch(err) { loginStatus.textContent = err.message; }
  finally { ticketForm.querySelector('button').disabled = false; }
});
document.getElementById('changeTicket').addEventListener('click', () => {
  generation++;
  currentCode = '';
  sessionStorage.removeItem('delri-loyalty-code');
  card.hidden = true;
  accessPanel.hidden = false;
  ticketCode.value = '';
  ticketCode.focus();
});
const storedCode = sessionStorage.getItem('delri-loyalty-code');
if (storedCode) openTicket(storedCode).catch(() => { sessionStorage.removeItem('delri-loyalty-code'); });
