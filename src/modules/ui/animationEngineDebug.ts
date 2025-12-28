import {LYRICS_CLASS} from "@constants";

const CANVAS_ID = "blyrics-lyric-debug-canvas";


export let ctx: CanvasRenderingContext2D | null = null;
function createDebugCanvas() {
    let tabRenderer = document.querySelector("#tab-renderer");
    if (!tabRenderer) {
        console.error("Can't find tab renderer");
        return;
    }
    let prevCanvas = document.getElementById(CANVAS_ID);
    if (prevCanvas) {
        document.removeChild(prevCanvas);
    }

    let canvas = document.createElement("canvas");
    canvas.id = CANVAS_ID;
    canvas.style.position = "fixed";
    // canvas.style.top = "0";
    // canvas.style.left = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.order = "100";

    const lyricsElement = document.getElementById("blyrics-wrapper");

    tabRenderer.insertBefore(canvas, lyricsElement);

    ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error("Can't find canvas context");
        return;
    }
    const dpr = window.devicePixelRatio || 1;

        // Get the size of the canvas in CSS pixels
    const styleHeight = Number(getComputedStyle(canvas).getPropertyValue('height').slice(0, -2));
    const styleWidth = Number(getComputedStyle(canvas).getPropertyValue('width').slice(0, -2));

    // Set the canvas buffer size to the actual device pixels
    canvas.width = styleWidth * dpr;
    canvas.height = styleHeight * dpr;

    // Scale the context so drawing commands use the CSS pixel size
    ctx.scale(dpr, dpr);
}

export function resetDebugRender(scrollPos: number) {
    if (!ctx) {
        createDebugCanvas();
        if (!ctx) {
            return null;
        }
    }

    ctx.reset();
    const dpr = window.devicePixelRatio || 1;
    ctx.scale(dpr, dpr);
    ctx.translate(0, -scrollPos);

    return ctx
}