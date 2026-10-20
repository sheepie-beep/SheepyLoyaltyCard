
const stampRow = document.getElementById("stampRow");

const STAMP_COUNT = 5;
const SIZE = 100;
const STORAGE_KEY = "pixel-loyalty-test";

const heartPixels = [
  "0111001110",
  "1111111111",
  "1111111111",
  "1111111111",
  "0111111110",
  "0011111100",
  "0001111000",
  "0000110000"
];

let savedProgress = {};

try {
  savedProgress = JSON.parse(
    localStorage.getItem(STORAGE_KEY) || "{}"
  );
} catch {
  savedProgress = {};
}

function drawHeart(ctx, color) {
  const pixelSize = SIZE / 10;

  ctx.fillStyle = color;

  heartPixels.forEach((row, y) => {
    [...row].forEach((pixel, x) => {
      if (pixel === "1") {
        ctx.fillRect(
          x * pixelSize,
          (y + 1) * pixelSize,
          pixelSize,
          pixelSize
        );
      }
    });
  });
}

function saveProgress(index, canvas) {
  savedProgress[index] = canvas.toDataURL("image/png");

  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(savedProgress)
    );
  } catch (error) {
    console.warn(
      "Could not save scratch progress",
      error
    );
  }
}

function createStamp(index) {
  const stamp = document.createElement("div");
  stamp.className = "stamp";

  // PINK HEART

  const pinkCanvas = document.createElement("canvas");

  pinkCanvas.width = SIZE;
  pinkCanvas.height = SIZE;
  pinkCanvas.className = "pink-heart";

  const pinkCtx = pinkCanvas.getContext("2d");

  drawHeart(pinkCtx, "#ff8fbd");

  // SILVER  
  const scratchCanvas = document.createElement("canvas");

  scratchCanvas.width = SIZE;
  scratchCanvas.height = SIZE;
  scratchCanvas.className = "scratch-layer";

  const ctx = scratchCanvas.getContext("2d");

  function drawSilver() {
    ctx.clearRect(0, 0, SIZE, SIZE);
    drawHeart(ctx, "#c2c4ce");
  }

  drawSilver();

  //scritch scritch motherfucker 

  if (savedProgress[index]) {
    const image = new Image();

    image.onload = () => {
      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.drawImage(image, 0, 0);
    };

    image.src = savedProgress[index];
  }

  let scratching = false;
  let lastPosition = null;

  function getPosition(event) {
    const rect = scratchCanvas.getBoundingClientRect();

    return {
      x: (event.clientX - rect.left) * SIZE / rect.width,
      y: (event.clientY - rect.top) * SIZE / rect.height
    };
  }

  function eraseLine(from, to) {
    ctx.globalCompositeOperation = "destination-out";

    ctx.lineWidth = 16;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();

    ctx.globalCompositeOperation = "source-over";
  }

  scratchCanvas.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    scratching = true;

    scratchCanvas.setPointerCapture(event.pointerId);

    lastPosition = getPosition(event);

    eraseLine(lastPosition, lastPosition);
    saveProgress(index, scratchCanvas);
  });

  scratchCanvas.addEventListener("pointermove", (event) => {
    if (!scratching) return;

    const position = getPosition(event);

    eraseLine(lastPosition, position);

    lastPosition = position;
  });

  function stopScratching() {
    if (!scratching) return;

    scratching = false;
    lastPosition = null;

    saveProgress(index, scratchCanvas);
  }

  scratchCanvas.addEventListener("pointerup", stopScratching);
  scratchCanvas.addEventListener("pointercancel", stopScratching);
  scratchCanvas.addEventListener(
    "lostpointercapture",
    stopScratching
  );

  stamp.appendChild(pinkCanvas);
  stamp.appendChild(scratchCanvas);

  stampRow.appendChild(stamp);
}

for (let i = 0; i < STAMP_COUNT; i++) {
  createStamp(i);
}
