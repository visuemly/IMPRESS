
 // MediaPipe Hands: 21 landmarks.
 // Fingertips: 4 thumb, 8 index, 12 middle, 16 ring, 20 pinky

const divEins = document.getElementById("slide-eins");

const THUMB_TIP = 4;
const INDEX_TIP = 8;

// Fingertips only
const FINGERS = [
    ["thumb", 4],
    ["index", 8],
    ["middle", 12],
    ["ring", 16],
    ["pinky", 20],
];

const YTUC_MIN = 100;
const YTUC_MAX = 900;

// Pinch distance
const DIST_CLOSED = 0.03;
const DIST_OPEN = 0.22;

// Slide 1: eigene Video- und Canvas-Elemente
const video = document.getElementById("video1");
const canvas = document.getElementById("canvas1");
const ctx = canvas.getContext("2d");

let currentYTUC = YTUC_MIN;

// Buchstaben aus Slide 1
const letters = document.querySelectorAll(
    "#slide-eins [class^='box-item-']"
);

// Calculate the distance between thumb and index tips
function pinchDistance(landmarks) {
    const thumb = landmarks[THUMB_TIP];
    const index = landmarks[INDEX_TIP];

    const dx = thumb.x - index.x;
    const dy = thumb.y - index.y;

    return Math.hypot(dx, dy);
}

// Draw the line between thumb and index finger
function drawPinch(landmarks) {
    const thumb = landmarks[THUMB_TIP];
    const index = landmarks[INDEX_TIP];

    const x1 = thumb.x * canvas.width;
    const y1 = thumb.y * canvas.height;
    const x2 = index.x * canvas.width;
    const y2 = index.y * canvas.height;

    ctx.strokeStyle = "#8221ff";
    ctx.lineWidth = 4;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.fillStyle = "#8221ff";

    for (const [x, y] of [[x1, y1], [x2, y2]]) {
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Hand tracking results
function onResults(results) {
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

ctx.translate(0, canvas.width);
ctx.scale(1, -1);
ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

    const hands = results.multiHandLandmarks;

    checkSlideSwipe(hands);

    if (hands && hands.length > 0) {
        for (const landmarks of hands) {
            drawConnectors(ctx, landmarks, HAND_CONNECTIONS, {
                color: "#ffffff",
                lineWidth: 2,
            });

            drawPinch(landmarks);
        }

        const distance = pinchDistance(hands[0]);

        const ytuc = rangeMap(
            distance,
            DIST_CLOSED,
            DIST_OPEN,
            YTUC_MIN,
            YTUC_MAX
        );

        const indexTip = hands[0][INDEX_TIP];

        const indexX =  indexTip.x;
        const indexY = 1 - indexTip.y;

        const col = Math.max(
            0,
            Math.min(2, Math.floor(indexX * 3))
        );

        const row = Math.max(
            0,
            Math.min(2, Math.floor(indexY * 3))
        );

        const index = row * 3 + col;

        setYTUC(ytuc, index);
    }

        ctx.restore();
    if (window.onHandsSlide2) window.onHandsSlide2(results);
}




/* SLIDE WECHSEL ----------------------------------------- */

const slides = [
    document.getElementById("slide-null"),
    document.getElementById("slide-eins"),
    document.getElementById("slide-zwei"),
    document.getElementById("slide-drei"),
    document.getElementById("slide-vier"),
     document.getElementById("slide-fuenf")
];

let currentSlide = 0;
let isAnimating = false;

// Einstellungen für die Geste
const ANIMATION_DURATION = 5000;
const SWIPE_THRESHOLD = 0.12;
const COOLDOWN = 3500;
const FIST_STABLE_FRAMES = 5;

// Zustand der Geste
let fistFrames = 0;
let startY = null;
let lastSwitch = 0;
let gestureTriggered = false;

// Initialen Slide anzeigen
slides.forEach((slide, i) => {
    slide.classList.toggle("active", i === currentSlide);
    slide.classList.remove("slide-in", "slide-out");
});


// Abstand zwischen zwei Handpunkten berechnen
function landmarkDistance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}


// Prüfen, ob eine Hand eine Faust bildet
function isFist(landmarks) {
    const wrist = landmarks[0];

    // Fingerspitzen und zugehörige Fingergelenke
    const fingers = [
        [8, 6],   // Zeigefinger
        [12, 10], // Mittelfinger
        [16, 14], // Ringfinger
        [20, 18]  // Kleiner Finger
    ];

    let curledFingers = 0;

    for (const [tipIndex, jointIndex] of fingers) {
        const tip = landmarks[tipIndex];
        const joint = landmarks[jointIndex];

        // Die Fingerspitze liegt näher am Handgelenk
        // als das zugehörige Gelenk, wenn der Finger
        // typischerweise eingekrümmt ist.
        if (
            landmarkDistance(tip, wrist) <
            landmarkDistance(joint, wrist) * 0.95
        ) {
            curledFingers++;
        }
    }

    // Mindestens 3 von 4 Fingern müssen geschlossen sein.
    return curledFingers >= 3;
}


// Slide mit Animation wechseln
function showSlide(index) {
    if (index < 0 || index >= slides.length) return;
    if (index === currentSlide || isAnimating) return;

    const previousSlide = slides[currentSlide];
    const nextSlide = slides[index];

    isAnimating = true;

    previousSlide.classList.remove("slide-in");
    previousSlide.classList.add("active", "slide-out");

    nextSlide.classList.remove("slide-out");
    nextSlide.classList.add("active", "slide-in");

    currentSlide = index;

    setTimeout(() => {
        previousSlide.classList.remove("active", "slide-out");
        nextSlide.classList.remove("slide-in");
        isAnimating = false;
    }, ANIMATION_DURATION);

    console.log("WECHSEL ZU SLIDE:", currentSlide + 1);
}


// Slidewechsel nur mit zwei Fäusten und Abwärtsbewegung
function checkSlideSwipe(hands) {

    // Beide Hände müssen sichtbar sein
    if (!hands || hands.length !== 2) {
        fistFrames = 0;
        startY = null;
        gestureTriggered = false;
        return;
    }

    // Beide Hände müssen Fäuste bilden
    const bothFists =
        isFist(hands[0]) &&
        isFist(hands[1]);

    if (!bothFists) {
        fistFrames = 0;
        startY = null;
        gestureTriggered = false;
        return;
    }

    // Fäuste müssen zuerst stabil erkannt werden
    fistFrames++;

    if (fistFrames < FIST_STABLE_FRAMES) {
        return;
    }

    // Gemeinsame vertikale Position der Handgelenke
    const y =
        (hands[0][0].y + hands[1][0].y) / 2;

    // Ausgangsposition der Geste festlegen
    if (startY === null) {
        startY = y;
        console.log("Zwei Fäuste erkannt – bereit!");
        return;
    }

    const swipeDistance = y - startY;

    console.log("Faust-Swipe:", swipeDistance);

    // Nur einmal pro Faustbewegung wechseln
    if (
        swipeDistance > SWIPE_THRESHOLD &&
        !gestureTriggered &&
        !isAnimating &&
        performance.now() - lastSwitch > COOLDOWN
    ) {
        gestureTriggered = true;
        lastSwitch = performance.now();

        if (currentSlide < slides.length - 1) {
            showSlide(currentSlide + 1);
        }
    }
}



// Start hand tracking
function start() {
    const hands = new Hands({
        locateFile: (file) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`,
    });

    hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6,
    });

    hands.onResults(onResults);

    const camera = new Camera(video, {
        onFrame: async () => {
            await hands.send({ image: video });
        },
    width: 3840,
    height: 2160,
    });

    setYTUC(YTUC_MIN);

    camera.start().catch((error) => {
        console.error("Camera konnte nicht gestartet werden:", error);
    });
}

// Map a value from one range to another
function rangeMap(value, inMin, inMax, outMin, outMax) {
    if (inMax === inMin) return outMin;

    const t = (value - inMin) / (inMax - inMin);
    const clamped = Math.min(1, Math.max(0, t));

    return outMin + (outMax - outMin) * clamped;
}

// Change the selected letter
function setYTUC(target, index = 0) {
    currentYTUC += (target - currentYTUC) * 0.35;

    const value = Math.round(currentYTUC);

    letters.forEach((letter, i) => {
        if (i === index) {
            letter.style.fontVariationSettings = `"YTUC" ${value}`;

            const fontSize = rangeMap(
                value,
                YTUC_MIN,
                YTUC_MAX,
                14,
                55
            );

            letter.style.fontSize = `${fontSize}vh`;
        } else {
            letter.style.fontVariationSettings = `"YTUC" ${YTUC_MIN}`;
            letter.style.fontSize = "14vh";
        }
    });

    resizeGrid(index, value);
}

// Resize the grid in Slide 1
function resizeGrid(index, value) {
    const size = rangeMap(
        value,
        YTUC_MIN,
        YTUC_MAX,
        33.333,
        80
    );

    const small = (100 - size) / 2;

    const row = Math.floor(index / 3);
    const col = index % 3;

    const rows = [33.333, 33.333, 33.333];
    const cols = [33.333, 33.333, 33.333];

    rows[row] = size;
    cols[col] = size;

    rows[(row + 1) % 3] = small;
    rows[(row + 2) % 3] = small;

    cols[(col + 1) % 3] = small;
    cols[(col + 2) % 3] = small;

    const grid = document.querySelector(
        "#slide-eins .box-container"
    );

    grid.style.gridTemplateRows =
        rows.map(v => `${v}%`).join(" ");

    grid.style.gridTemplateColumns =
        cols.map(v => `${v}%`).join(" ");
}

start();
