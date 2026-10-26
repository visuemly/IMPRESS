
const divZwei = document.getElementById("slide-zwei");

document.addEventListener("DOMContentLoaded", () => {

    const box = divZwei.querySelector(".box");

    const upperLetter = divZwei.querySelector("#upper-letter");
    const lowerLetter = divZwei.querySelector("#lower-letter");

    const upperGlyphName = divZwei.querySelector("#upper-glyph-name");
    const upperUnicodeName = divZwei.querySelector("#upper-unicode-name");
    const upperDecimal = divZwei.querySelector("#upper-decimal");
    const upperHex = divZwei.querySelector("#upper-hex");
    const upperEntity = divZwei.querySelector("#upper-entity");

    const lowerGlyphName = divZwei.querySelector("#lower-glyph-name");
    const lowerUnicodeName = divZwei.querySelector("#lower-unicode-name");
    const lowerDecimal = divZwei.querySelector("#lower-decimal");
    const lowerHex = divZwei.querySelector("#lower-hex");
    const lowerEntity = divZwei.querySelector("#lower-entity");

    const line1 = divZwei.querySelector("#line1");
    const line2 = divZwei.querySelector("#line2");
    const line3 = divZwei.querySelector("#line3");
    const line4 = divZwei.querySelector("#line4");

    const fontInfo = divZwei.querySelector("#font-info");

    let lastInfoValue = null;

    const probe = document.createElement("span");

    probe.style.cssText =
        "display:inline-block;width:0;height:0;vertical-align:baseline;";

    const ctx = document.createElement("canvas").getContext("2d");

    // [Achse, Versalhöhe, x-Höhe, Oberlänge, Unterlänge] in em
    const TABLE = [
        [100, 0.7060, 0.5320, 0.7060, 0.1640],
        [150, 0.7347, 0.5494, 0.7347, 0.1640],
        [200, 0.7633, 0.5693, 0.7633, 0.1640],
        [250, 0.7920, 0.5917, 0.7920, 0.1640],
        [300, 0.8189, 0.6191, 0.8189, 0.1640],
        [350, 0.8459, 0.6470, 0.8459, 0.1640],
        [400, 0.8728, 0.6756, 0.8728, 0.1640],
        [450, 0.8997, 0.7047, 0.8997, 0.1640],
        [500, 0.9266, 0.7345, 0.9266, 0.1640],
        [550, 0.9535, 0.7629, 0.9535, 0.1640],
        [600, 0.9805, 0.7927, 0.9805, 0.1640],
        [650, 1.0074, 0.8239, 1.0074, 0.1640],
        [700, 1.0343, 0.8565, 1.0343, 0.1640],
        [750, 1.0612, 0.8905, 1.0612, 0.1640],
        [800, 1.0881, 0.9260, 1.0881, 0.1640],
        [850, 1.1151, 0.9628, 1.1151, 0.1640],
        [900, 1.1420, 1.0010, 1.1420, 0.1640]
    ];

    const KEYS = { cap: 1, xh: 2, asc: 3, desc: 4 };

    function metric(key, axis, fontSizePx) {
        const a = Math.min(900, Math.max(100, axis));
        const k = KEYS[key];

        const idx = Math.min(
            TABLE.length - 2,
            Math.floor((a - 100) / 50)
        );

        const t = (a - TABLE[idx][0]) / 50;

        return (
            TABLE[idx][k] +
            (TABLE[idx + 1][k] - TABLE[idx][k]) * t
        ) * fontSizePx;
    }

    function setBand(el, top, bottom) {
        el.style.top = top + "px";
        el.style.height = bottom - top + "px";
    }

    function setVisible(el, visible) {
        el.style.opacity = visible ? "1" : "0";
    }

    function update() {
        if (!upperLetter.contains(probe)) {
            upperLetter.appendChild(probe);
        }

        const cs = getComputedStyle(upperLetter);
        const fs = parseFloat(cs.fontSize);

        const axis = currentAxis;

        const cap = metric("cap", axis, fs);
        const xh = metric("xh", axis, fs);
        const asc = metric("asc", axis, fs);
        const desc = metric("desc", axis, fs);

        ctx.font = `${cs.fontSize} "HGKRuderPlakat"`;

        const xhC = ctx.measureText("x").actualBoundingBoxAscent;
        const ascC = ctx.measureText("d").actualBoundingBoxAscent;
        const descC = ctx.measureText("p").actualBoundingBoxDescent;

        const lower = lowerLetter.textContent.trim();
        const m = ctx.measureText(lower);

        const hasAscender =
            m.actualBoundingBoxAscent >
            xhC + (ascC - xhC) * 0.5;

        const hasDescender =
            m.actualBoundingBoxDescent > descC * 0.5;

        const baseline =
            probe.getBoundingClientRect().bottom -
            box.getBoundingClientRect().top;

        setBand(line1, baseline - cap, baseline);
        setBand(line2, baseline - xh, baseline);
        setBand(line3, baseline - asc, baseline - xh);
        setBand(line4, baseline, baseline + desc);

        setVisible(line3, hasAscender);
        setVisible(line4, hasDescender);
    }

    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let i = 0;

    function showLetter() {
        const upper = alphabet[i];
        const lower = upper.toLowerCase();

        const upperCode = upper.charCodeAt(0);
        const lowerCode = lower.charCodeAt(0);

        upperLetter.textContent = upper;
        lowerLetter.textContent = lower;

        upperGlyphName.textContent = upper;
        upperUnicodeName.textContent = `Latin Capital Letter ${upper}`;
        upperDecimal.textContent = upperCode;
        upperHex.textContent =
            upperCode.toString(16).toUpperCase().padStart(4, "0");
        upperEntity.textContent = `&#x${upperCode.toString(16)};`;

        lowerGlyphName.textContent = lower;
        lowerUnicodeName.textContent = `Latin Small Letter ${upper}`;
        lowerDecimal.textContent = lowerCode;
        lowerHex.textContent =
            lowerCode.toString(16).toUpperCase().padStart(4, "0");
        lowerEntity.textContent = `&#x${lowerCode.toString(16)};`;

        update();

        i = (i + 1) % alphabet.length;
    }

    let targetAxis = 900;
    let currentAxis = 900;

    let lettersPerSecond = 1;
    let lastSwitch = performance.now();

    function map(value, inMin, inMax, outMin, outMax) {
        const t = Math.min(
            1,
            Math.max(0, (value - inMin) / (inMax - inMin))
        );

        return outMin + (outMax - outMin) * t;
    }

    const video = document.getElementById("video2");
    const canvas = document.getElementById("canvas2");
    const handCtx = canvas.getContext("2d");

    function onResults(results) {
        handCtx.save();

        handCtx.clearRect(0, 0, canvas.width, canvas.height);

        handCtx.translate(canvas.width, 0);
        handCtx.scale(-1, 1);

        handCtx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

        const hands = results.multiHandLandmarks;

        if (hands && hands.length > 0) {
            for (const landmarks of hands) {
                drawConnectors(
                    handCtx,
                    landmarks,
                    HAND_CONNECTIONS,
                    {
                        color: "#ffffff",
                        lineWidth: 2
                    }
                );
            }

            const palm = hands[0][9];

            const x = palm.x;
            const y = 1 - palm.y;

            targetAxis = map(y, 0.15, 0.85, 900, 100);
            lettersPerSecond = map(x, 0.1, 0.9, 0.3, 10);
        }

        handCtx.restore();
    }
            window.onHandsSlide2 = onResults;

   
    function styleName(v) {
        const uc =
            v < 175 ? "Low" :
            v < 400 ? "" :
            v < 725 ? "High" :
            "Tall";

        const lc =
            v < 300 ? 100 :
            v < 700 ? 500 :
            900;

        return `${uc} ${lc}`.trim();
    }

    function animationLoop(now) {
        currentAxis += (targetAxis - currentAxis) * 0.2;

        const value = Math.round(currentAxis);
        const name = styleName(value);

        if (name !== lastInfoValue) {
            fontInfo.textContent = `Ruder Plakat LL Var ${name}`;
            lastInfoValue = name;
        }

        box.style.fontVariationSettings =
            `"YTUC" ${value}, "YTLC" ${value}`;

        update();

        if (now - lastSwitch >= 1000 / lettersPerSecond) {
            lastSwitch = now;
            showLetter();
        }

        requestAnimationFrame(animationLoop);
    }

document.fonts.load('50vh "HGKRuderPlakat"').then(() => {
    showLetter();
    requestAnimationFrame(animationLoop);
});
});