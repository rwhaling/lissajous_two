import passthroughVertexShader from './shaders/passthrough.vert?raw'
import simpleGradientFragmentShader from './shaders/simplegradient.frag?raw'
import spectralCompositeFragmentShader from './shaders/spectralComposite.frag?raw'
import blurFragmentShader from './shaders/gaussianBlur.frag?raw'
import elementAccumulationFragmentShader from './shaders/elementAccumulation.frag?raw'
import passthroughTextureFragmentShader from './shaders/passthroughTexture.frag?raw'
import combineAndPersistGlowFragmentShader from './shaders/combineAndPersistGlow.frag?raw'
import { mkSimplexNoise, SimplexNoise } from '@spissvinkel/simplex-noise';

let frameCount = 0

// Keep essential WebGL globals - remove | null
let gl: WebGLRenderingContext; // Changed
let frameTexture: WebGLTexture; // Changed
let framebuffer: WebGLFramebuffer; // Changed
let positionBuffer: WebGLBuffer; // Changed
let texCoordBuffer: WebGLBuffer; // Changed

// --- Step 3: Re-introduce Canvas Globals ---
let elementsCanvas: HTMLCanvasElement;
let elementsCtx: CanvasRenderingContext2D;

// --- Step 4: Modify Element Texture Globals ---
let currentFrameElementsTexture: WebGLTexture; // Renamed from elementsTexture
let blurredElementsTexture: WebGLTexture;
let tempBlurTexture: WebGLTexture;

// --- Step (New): Add Accumulation Texture Globals ---
let elementsAccumulationTextureA: WebGLTexture;
let elementsAccumulationTextureB: WebGLTexture;
let readAccumulationTexture: WebGLTexture;    // Pointer for ping-pong
let writeAccumulationTexture: WebGLTexture;   // Pointer for ping-pong
let accumulationFramebuffer: WebGLFramebuffer;

// --- Step (New): Texture for combined input to blur process ---
let blurProcessInputHolderTexture: WebGLTexture;

// --- Step 5: Add Blur Framebuffer Global ---
let blurFramebuffer: WebGLFramebuffer; // FBO for blur passes

// Keep time tracking
let startTime = Date.now();
let FRAMES_PER_SECOND = 60;

// Add back rendering state variables
let isRendering = false;
let currentFrameNumber = 0;
let dirHandle: FileSystemDirectoryHandle | null = null;
const TOTAL_FRAMES = 5550; // Example value, adjust as needed

// --- Step 2: Add Blur Parameters ---
const BLUR_RADIUS = 8.0; // Example blur radius
const BLUR_PASSES = 1;   // Example blur passes
const FADE_FACTOR = 0.995; // Example fade factor
const GLOW_PERSISTENCE = 0.97; // How much of the old glow persists
// Keep gradient noise parameters
let NOISE_CENTER = 0.0;
let NOISE_WIDTH = 1.1;
let NOISE_AMPLITUDE = 0.8;
let NOISE_SPEED = 0.4;
let NOISE_SCALE = 96.0;
let NOISE_OFFSET_SCALE = 1.0;

// Keep gradient wave parameters
let WAVE_AMPLITUDE = 0.25;
let WAVE_XSCALE = 2.5;      // NEW: x scale for the wave
let WAVE_TIMESCALE = 0.2;   // NEW: time scale for the wave

// Lissajous Parameters for the moving circle
const LISSAJOUS_A = 3.25;
const LISSAJOUS_B = 2.75;
const LISSAJOUS_AMPLITUDE = 300;
const LISSAJOUS_RADIUS = 10; // px
const LISSAJOUS_TIME_SCALE = 0.35; // Adjust for slower/faster movement

// Palette Colors
let GRADIENT_COLOR_A = '#000000'; // Base Color A
let GRADIENT_COLOR_B = '#0044CC'; // Base Color B
// --- Step 1: Add New Color Constants ---
const PALETTE_COLOR_C = '#FFFF00'; // Color for opaque black elements
const PALETTE_COLOR_D = '#8800FF'; // Color for opaque white elements (unused for now)

// --- New constants for multi-line drawing ---
const LINES_PER_FRAME = 1;
const LINE_SUB_STEP_FRAME_FRACTION = 0.2 // Each sub-step is 20% of a frame's duration
const LINE_THICKNESS = 3 // Desired thickness for each individual line segment

// --- New constants for noise modulation of line length ---
const LINE_NOISE_SPATIAL_SCALE = 550.0; // Adjust for spatial frequency of noise
const LINE_NOISE_TIME_SCALE = 0.2;    // Adjust for temporal frequency of noise
const LINE_NOISE_MIN_LENGTH_FACTOR = 3.2; // Min length as factor of LISSAJOUS_RADIUS
const LINE_NOISE_MAX_LENGTH_FACTOR = 20.2; // Max length as factor of LISSAJOUS_RADIUS

// --- New constants for endpoint noise displacement ---
const LINE_ENDPOINT_NOISE_SCALAR = 1.5;    // Scales the normalized [0,1] noise before lerping
const LINE_ENDPOINT_NOISE_AMOUNT_1 = 0.8;  // Noise influence for endpoint 1 (0-1)
const LINE_ENDPOINT_NOISE_AMOUNT_2 = 0.6;  // Noise influence for endpoint 2 (0-1)

// Add back frame padding helper
function padFrameNumber(num: number): string {
    return num.toString().padStart(6, '0');
}

// Keep passthrough vertex shader source
const vertexShaderSource = passthroughVertexShader;

// Keep gradient program, add blur program, rename palette to spectralComposite
let gradientProgram: WebGLProgram;
let blurProgram: WebGLProgram;
let spectralCompositeProgram: WebGLProgram;
// --- Step (New): Add new Program Globals ---
let elementAccumulationProgram: WebGLProgram;
let passthroughTextureProgram: WebGLProgram;
let combineAndPersistGlowProgram: WebGLProgram; // New program

// --- Step (New): Pointers for glow accumulator ping-pong ---
let readGlowAccumulator: WebGLTexture;
let writeGlowAccumulator: WebGLTexture;

// --- Global Simplex Noise instance ---
let simplex: SimplexNoise;

// --- Define CanvasContexts Interface ---
interface CanvasContexts {
    canvasWebGL: HTMLCanvasElement;
    // If you also use a 2D canvas, add it here:
    canvas2d?: HTMLCanvasElement;
}

function initWebGL(canvas: HTMLCanvasElement) {
    const localGl = canvas.getContext('webgl', {
        alpha: true,
        preserveDrawingBuffer: true
    });
    if (!localGl) {
        throw new Error('WebGL not supported');
    }
    gl = localGl;

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // --- Create Buffers ---
    const positions = new Float32Array([ -1, -1, 1, -1, -1, 1, 1, 1 ]);
    positionBuffer = gl.createBuffer();
    if (!positionBuffer) throw new Error("Failed to create position buffer");
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const texCoords = new Float32Array([ 0, 0, 1, 0, 0, 1, 1, 1 ]);
    texCoordBuffer = gl.createBuffer();
    if (!texCoordBuffer) throw new Error("Failed to create texCoord buffer");
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);

    // --- Create Textures (Step 7) ---
    frameTexture = gl.createTexture();
    if (!frameTexture) throw new Error("Failed to create frameTexture");
    gl.bindTexture(gl.TEXTURE_2D, frameTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    currentFrameElementsTexture = gl.createTexture(); // Renamed
    if (!currentFrameElementsTexture) throw new Error("Failed to create currentFrameElementsTexture");
    gl.bindTexture(gl.TEXTURE_2D, currentFrameElementsTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    blurredElementsTexture = gl.createTexture();
    if (!blurredElementsTexture) throw new Error("Failed to create blurredElementsTexture");
    gl.bindTexture(gl.TEXTURE_2D, blurredElementsTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    tempBlurTexture = gl.createTexture();
    if (!tempBlurTexture) throw new Error("Failed to create tempBlurTexture");
    gl.bindTexture(gl.TEXTURE_2D, tempBlurTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // --- Create Framebuffers (Step 7) ---
    framebuffer = gl.createFramebuffer(); // For gradient pass
    if (!framebuffer) throw new Error("Failed to create framebuffer");

    blurFramebuffer = gl.createFramebuffer(); // New: For blur passes
    if (!blurFramebuffer) throw new Error("Failed to create blurFramebuffer");

    // --- Step (New): Create Accumulation Textures ---
    elementsAccumulationTextureA = gl.createTexture();
    if (!elementsAccumulationTextureA) throw new Error("Failed to create elementsAccumulationTextureA");
    gl.bindTexture(gl.TEXTURE_2D, elementsAccumulationTextureA);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    elementsAccumulationTextureB = gl.createTexture();
    if (!elementsAccumulationTextureB) throw new Error("Failed to create elementsAccumulationTextureB");
    gl.bindTexture(gl.TEXTURE_2D, elementsAccumulationTextureB);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // --- Step (New): Create Accumulation Framebuffer ---
    accumulationFramebuffer = gl.createFramebuffer();
    if (!accumulationFramebuffer) throw new Error("Failed to create accumulationFramebuffer");

    // --- Step (New): Create blurProcessInputHolderTexture ---
    blurProcessInputHolderTexture = gl.createTexture();
    if (!blurProcessInputHolderTexture) throw new Error("Failed to create blurProcessInputHolderTexture");
    gl.bindTexture(gl.TEXTURE_2D, blurProcessInputHolderTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // --- Initial Allocation ---
    // Will be done in setup based on actual canvas size
    gl.bindTexture(gl.TEXTURE_2D, null); // Unbind texture
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); // Ensure we start unbound
}

export function setup({ /*canvas2d,*/ canvasWebGL }: CanvasContexts) {
    initWebGL(canvasWebGL);

    // --- Initialize SimplexNoise ---
    simplex = mkSimplexNoise(Math.random);

    // --- Step 8: Create elements canvas and context ---
    elementsCanvas = document.createElement('canvas');
    elementsCanvas.width = canvasWebGL.width;
    elementsCanvas.height = canvasWebGL.height;
    const localCtx = elementsCanvas.getContext('2d');
    if (!localCtx) {
        throw new Error("Failed to get 2D context for elements canvas");
    }
    elementsCtx = localCtx;

    // --- Step 8: Allocate Textures ---
    gl.bindTexture(gl.TEXTURE_2D, frameTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvasWebGL.width, canvasWebGL.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    gl.bindTexture(gl.TEXTURE_2D, currentFrameElementsTexture); // Renamed
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvasWebGL.width, canvasWebGL.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    gl.bindTexture(gl.TEXTURE_2D, blurredElementsTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvasWebGL.width, canvasWebGL.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    gl.bindTexture(gl.TEXTURE_2D, tempBlurTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvasWebGL.width, canvasWebGL.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    // --- Step (New): Allocate Accumulation Textures ---
    gl.bindTexture(gl.TEXTURE_2D, elementsAccumulationTextureA);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvasWebGL.width, canvasWebGL.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindTexture(gl.TEXTURE_2D, elementsAccumulationTextureB);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvasWebGL.width, canvasWebGL.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    // --- Step (New): Allocate blurProcessInputHolderTexture ---
    gl.bindTexture(gl.TEXTURE_2D, blurProcessInputHolderTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvasWebGL.width, canvasWebGL.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    gl.bindTexture(gl.TEXTURE_2D, null); // Unbind

    // --- Step (New): Assign initial accumulation textures for ping-pong ---
    readAccumulationTexture = elementsAccumulationTextureA;
    writeAccumulationTexture = elementsAccumulationTextureB;

    // --- Step 8: Initialize Programs ---
    initGradientProgram(gl);
    initBlurProgram(gl);
    initSpectralCompositeProgram(gl);
    // --- Step (New): Initialize new programs ---
    initElementAccumulationProgram(gl);
    initPassthroughTextureProgram(gl);
    initCombineAndPersistGlowProgram(gl); // Initialize new program

    // Clear blur textures initially (optional, good practice)
    gl.bindFramebuffer(gl.FRAMEBUFFER, blurFramebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, blurredElementsTexture, 0);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tempBlurTexture, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // --- Step (New): Clear accumulation textures initially ---
    gl.bindFramebuffer(gl.FRAMEBUFFER, accumulationFramebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, elementsAccumulationTextureA, 0);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, elementsAccumulationTextureB, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // --- Step (New): Clear blurProcessInputHolderTexture initially ---
    gl.bindFramebuffer(gl.FRAMEBUFFER, blurFramebuffer); // Use any FBO, just need a target
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, blurProcessInputHolderTexture, 0);
    gl.clearColor(0,0,0,0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null); // Ensure we end unbound
}

export function draw({ /*canvas2d,*/ canvasWebGL }: CanvasContexts) {
    // --- Step 15a: Update resource check ---
    if (!gl || !framebuffer || !frameTexture ||
        !elementsCanvas || !elementsCtx || !currentFrameElementsTexture ||
        !elementsAccumulationTextureA || !elementsAccumulationTextureB || !accumulationFramebuffer ||
        !blurProcessInputHolderTexture ||
        !blurFramebuffer || !blurredElementsTexture || !tempBlurTexture ||
        !positionBuffer || !texCoordBuffer ||
        !gradientProgram || !blurProgram || !spectralCompositeProgram ||
        !elementAccumulationProgram ||
        !combineAndPersistGlowProgram ||
        !passthroughTextureProgram) {
        // This check might technically be redundant now due to types,
        // but kept for explicit runtime safety.
        throw new Error('Context or critical resources not initialized');
    }

    const width = canvasWebGL.width;
    const height = canvasWebGL.height;
    const currentTime = frameCount / FRAMES_PER_SECOND;

    // --- Pass 1: Draw gradient to frameTexture (offscreen) ---
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, frameTexture, 0);
    gl.viewport(0, 0, width, height);
    gl.useProgram(gradientProgram);

    // Set uniforms for B&W gradient pass
    const colorA_Gradient = hexToRgb01("#000000");
    const colorB_Gradient = hexToRgb01("#FFFFFF");
    gl.uniform3fv(gl.getUniformLocation(gradientProgram, 'u_colorA'), colorA_Gradient);
    gl.uniform3fv(gl.getUniformLocation(gradientProgram, 'u_colorB'), colorB_Gradient);
    gl.uniform1f(gl.getUniformLocation(gradientProgram, 'u_time'), currentTime);
    gl.uniform1f(gl.getUniformLocation(gradientProgram, 'u_noiseCenter'), NOISE_CENTER);
    gl.uniform1f(gl.getUniformLocation(gradientProgram, 'u_noiseWidth'), NOISE_WIDTH);
    gl.uniform1f(gl.getUniformLocation(gradientProgram, 'u_noiseAmplitude'), NOISE_AMPLITUDE);
    gl.uniform1f(gl.getUniformLocation(gradientProgram, 'u_noiseSpeed'), NOISE_SPEED);
    gl.uniform1f(gl.getUniformLocation(gradientProgram, 'u_noiseScale'), NOISE_SCALE);
    gl.uniform1f(gl.getUniformLocation(gradientProgram, 'u_noiseOffsetScale'), NOISE_OFFSET_SCALE);
    gl.uniform1f(gl.getUniformLocation(gradientProgram, 'u_waveAmplitude'), WAVE_AMPLITUDE);
    gl.uniform1f(gl.getUniformLocation(gradientProgram, 'u_waveXScale'), WAVE_XSCALE);
    gl.uniform1f(gl.getUniformLocation(gradientProgram, 'u_waveTimeScale'), WAVE_TIMESCALE);

    // Draw the grayscale gradient quad
    gl.clearColor(0, 0, 0, 0); // Clear FBO with transparent black
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // --- Pass 2: Draw CURRENT 2D element to currentFrameElementsTexture ---
    // Clear the 2D canvas (transparent)
    elementsCtx.clearRect(0, 0, elementsCanvas.width, elementsCanvas.height);

    const canvasCenterX = elementsCanvas.width / 2;
    const canvasCenterY = elementsCanvas.height / 2;
    // const amplitudeX = (elementsCanvas.width / 2) - LISSAJOUS_RADIUS * 2; 
    // const amplitudeY = (elementsCanvas.height / 2) - LISSAJOUS_RADIUS * 2; 

    const amplitudeX = LISSAJOUS_AMPLITUDE;
    const amplitudeY = LISSAJOUS_AMPLITUDE;

    const timePerFrame = 1.0 / FRAMES_PER_SECOND;
    const subStepTimeDelta = timePerFrame * LINE_SUB_STEP_FRAME_FRACTION;

    elementsCtx.lineWidth = LINE_THICKNESS; // Set consistent line thickness

    for (let i = 0; i < LINES_PER_FRAME; i++) {
        const subSteppedCurrentTime = currentTime + i * subStepTimeDelta;
        const lissajousTime = subSteppedCurrentTime * LISSAJOUS_TIME_SCALE;
    
        // Lissajous point for the current sub-step (displacement from center)
        const argX = LISSAJOUS_A * lissajousTime + Math.PI / 2;
        const argY = LISSAJOUS_B * lissajousTime;
        const lissaX = amplitudeX * Math.sin(argX);
        const lissaY = amplitudeY * Math.sin(argY);

        // Calculate color based on progress through LINES_PER_FRAME
        let fadeProgress = 0;
        if (LINES_PER_FRAME > 1) {
            fadeProgress = i / (LINES_PER_FRAME - 1);
        }
        
        const colorVal = Math.round(255 * (1 - fadeProgress));
        const strokeColor = `rgb(${colorVal},${colorVal},${colorVal})`;
        elementsCtx.strokeStyle = strokeColor;

        // Determine if the Lissajous point is effectively at the center
        if (Math.abs(lissaX) > 0.01 || Math.abs(lissaY) > 0.01) {
            // Calculate noise-based scaling factors for endpoints
            const noiseInputXBase = lissaX / LINE_NOISE_SPATIAL_SCALE;
            const noiseInputYBase = lissaY / LINE_NOISE_SPATIAL_SCALE;
            const noiseInputTime = subSteppedCurrentTime * LINE_NOISE_TIME_SCALE;

            // Noise for endpoint 1 (x, y)
            let s_val_x1 = simplex.noise3D(noiseInputXBase, noiseInputYBase, noiseInputTime);
            let s_val_y1 = simplex.noise3D(noiseInputXBase + 10.3, noiseInputYBase + 20.7, noiseInputTime + 5.1);

            // Noise for endpoint 2 (x, y)
            let s_val_x2 = simplex.noise3D(noiseInputXBase + 30.5, noiseInputYBase + 40.1, noiseInputTime + 15.9);
            let s_val_y2 = simplex.noise3D(noiseInputXBase + 50.2, noiseInputYBase + 60.8, noiseInputTime + 25.4);

            // Helper function to calculate final scaling factor from raw simplex noise
            const calculateFactor = (simplexVal: number, amount: number) => {
                const normalized_simplex = (simplexVal + 1.0) / 2.0; // to [0,1]
                const scaled_noise_term = normalized_simplex * LINE_ENDPOINT_NOISE_SCALAR;
                return (1.0 - amount) * 1.0 + amount * scaled_noise_term;
            };

            const factor_x1 = calculateFactor(s_val_x1, LINE_ENDPOINT_NOISE_AMOUNT_1);
            const factor_y1 = calculateFactor(s_val_y1, LINE_ENDPOINT_NOISE_AMOUNT_1);
            const factor_x2 = calculateFactor(s_val_x2, LINE_ENDPOINT_NOISE_AMOUNT_2);
            const factor_y2 = calculateFactor(s_val_y2, LINE_ENDPOINT_NOISE_AMOUNT_2);

            const startX = canvasCenterX + lissaX * factor_x1;
            const startY = canvasCenterY + lissaY * factor_y1;
            const endX = canvasCenterX + lissaX * factor_x2;
            const endY = canvasCenterY + lissaY * factor_y2;

            elementsCtx.beginPath();
            elementsCtx.moveTo(startX, startY);
            elementsCtx.lineTo(endX, endY);
            elementsCtx.stroke();
        } else {
            // Fallback for Lissajous at the center: draw a small dot
            elementsCtx.fillStyle = strokeColor; 
            elementsCtx.beginPath();
            // currentCircleX and currentCircleY would be canvasCenterX/Y here
            elementsCtx.arc(canvasCenterX, canvasCenterY, LINE_THICKNESS / 2, 0, Math.PI * 2); 
            elementsCtx.fill();
        }
    }

    // Upload canvas to currentFrameElementsTexture
    gl.activeTexture(gl.TEXTURE0); // Use a consistent texture unit
    gl.bindTexture(gl.TEXTURE_2D, currentFrameElementsTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, elementsCanvas);

    // --- Pass 2A: Accumulate elements with fading (Trail Generation) ---
    gl.bindFramebuffer(gl.FRAMEBUFFER, accumulationFramebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, writeAccumulationTexture, 0);
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0); 
    gl.clear(gl.COLOR_BUFFER_BIT); // Clear target before drawing faded and new elements

    // Step 1: Draw faded previous accumulation state from readAccumulationTexture to writeAccumulationTexture
    gl.useProgram(elementAccumulationProgram);
    gl.uniform1f(gl.getUniformLocation(elementAccumulationProgram, "u_fadeFactor"), FADE_FACTOR);
    gl.uniform1f(gl.getUniformLocation(elementAccumulationProgram, "u_flipY"), 0.0); // Drawing to FBO

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, readAccumulationTexture);
    gl.uniform1i(gl.getUniformLocation(elementAccumulationProgram, "u_image"), 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Step 2: Draw current frame's elements on top of writeAccumulationTexture using blending
    gl.useProgram(passthroughTextureProgram);
    gl.uniform1f(gl.getUniformLocation(passthroughTextureProgram, "u_flipY"), 0.0); // Drawing to FBO

    gl.activeTexture(gl.TEXTURE0); 
    gl.bindTexture(gl.TEXTURE_2D, currentFrameElementsTexture);
    gl.uniform1i(gl.getUniformLocation(passthroughTextureProgram, "u_image"), 0);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); 
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disable(gl.BLEND);

    // Ping-pong accumulation textures. readAccumulationTexture now holds the sharp, faded trails.
    [readAccumulationTexture, writeAccumulationTexture] = [writeAccumulationTexture, readAccumulationTexture];
    const fadedTrailTexture = readAccumulationTexture; // This is our sharp trail

    // --- Pass 2B: Dedicated Blur Pass for Bloom "Glow" (Now Progressive) ---
    
    // Setup ping-pong pointers for glow accumulation if not already done (e.g. first frame)
    // This should ideally be in setup, but for safety if draw is called before full setup completion
    // or if we want to reset, this is a fallback.
    // More robustly, ensure they are assigned in setup.
    if (!readGlowAccumulator || !writeGlowAccumulator) {
        readGlowAccumulator = blurredElementsTexture; // Initially, read from blurredElementsTexture
        writeGlowAccumulator = tempBlurTexture;      // Initially, write to tempBlurTexture
    }

    // Step 2B.a: Combine current sharp trails with faded previous glow
    gl.bindFramebuffer(gl.FRAMEBUFFER, blurFramebuffer); // Use blur FBO for this temporary draw
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, blurProcessInputHolderTexture, 0);
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(combineAndPersistGlowProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fadedTrailTexture);
    gl.uniform1i(gl.getUniformLocation(combineAndPersistGlowProgram, "u_newContributionTex"), 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, readGlowAccumulator); // Previous frame's accumulated glow
    gl.uniform1i(gl.getUniformLocation(combineAndPersistGlowProgram, "u_previousGlowTex"), 1);
    
    gl.uniform1f(gl.getUniformLocation(combineAndPersistGlowProgram, "u_glowPersistence"), GLOW_PERSISTENCE);
    gl.uniform1f(gl.getUniformLocation(combineAndPersistGlowProgram, "u_flipY"), 0.0); // Drawing to FBO
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Step 2B.b: Multi-Pass Gaussian Blur on the combined result
    let readTexForBloomBlur = blurProcessInputHolderTexture;       // Start with the combined texture
    let tempTargetForBlurLoop = readGlowAccumulator;             // Use the non-final glow accum as temp for blur's internal ping-pong
    const finalTargetForBloom = writeGlowAccumulator;            // Final blurred glow goes here

    if (BLUR_PASSES > 0 && BLUR_RADIUS > 0) {
        for (let i = 0; i < BLUR_PASSES; ++i) {
            const isLastPass = (i === BLUR_PASSES - 1);
            const currentWriteTarget = isLastPass ? finalTargetForBloom : tempTargetForBlurLoop;

            gl.bindFramebuffer(gl.FRAMEBUFFER, blurFramebuffer);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, currentWriteTarget, 0);
            gl.viewport(0, 0, width, height);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);

            gl.useProgram(blurProgram);
            gl.uniform1f(gl.getUniformLocation(blurProgram, "u_blurRadius"), BLUR_RADIUS);
            gl.uniform1f(gl.getUniformLocation(blurProgram, "u_fadeFactor"), 1.0); // No fading here
            gl.uniform2f(gl.getUniformLocation(blurProgram, "u_resolution"), width, height);
            gl.uniform1f(gl.getUniformLocation(blurProgram, "u_time"), currentTime);
            gl.uniform1f(gl.getUniformLocation(blurProgram, "u_flipY"), 0.0);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, readTexForBloomBlur);
            gl.uniform1i(gl.getUniformLocation(blurProgram, "u_image"), 0);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

            if (!isLastPass) {
                [readTexForBloomBlur, tempTargetForBlurLoop] = [tempTargetForBlurLoop, readTexForBloomBlur]; 
            }
        }
    } else {
        // If no blur, copy the combined input (or clear) to the final target to maintain consistency
        gl.bindFramebuffer(gl.FRAMEBUFFER, blurFramebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, finalTargetForBloom, 0);
        // Option 1: Copy combined (passthrough shader would be needed)
        // For simplicity, let's clear if no blur, meaning no progressive glow if blur is off.
        // Or, draw blurProcessInputHolderTexture into finalTargetForBloom using passthroughTextureProgram
        gl.clearColor(0,0,0,0);
        gl.clear(gl.COLOR_BUFFER_BIT);
    }
    
    // Step 2B.c: Ping-Pong Glow Accumulators
    [readGlowAccumulator, writeGlowAccumulator] = [writeGlowAccumulator, readGlowAccumulator];
    const blurredTrailGlowTexture = readGlowAccumulator; // This now holds the latest accumulated glow

    // --- Pass 4: Composite to screen using spectral shader ---
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); // Render to screen
    gl.viewport(0, 0, width, height);
    gl.useProgram(spectralCompositeProgram);

    // Bind gradient texture to unit 0
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, frameTexture);
    gl.uniform1i(gl.getUniformLocation(spectralCompositeProgram, "u_gradientTex"), 0);

    // Bind sharp, faded trails texture to unit 1
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, fadedTrailTexture); 
    gl.uniform1i(gl.getUniformLocation(spectralCompositeProgram, "u_fadedTrailTex"), 1); // New uniform name

    // Bind blurred glow texture to unit 2
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, blurredTrailGlowTexture);
    gl.uniform1i(gl.getUniformLocation(spectralCompositeProgram, "u_blurredTrailGlowTex"), 2); // New uniform name

    // Set palette color uniforms
    const colorA_Palette = hexToRgb01(GRADIENT_COLOR_A);
    const colorB_Palette = hexToRgb01(GRADIENT_COLOR_B);
    const colorC_Palette = hexToRgb01(PALETTE_COLOR_C);
    const colorD_Palette = hexToRgb01(PALETTE_COLOR_D);
    gl.uniform3fv(gl.getUniformLocation(spectralCompositeProgram, "u_colorA"), colorA_Palette);
    gl.uniform3fv(gl.getUniformLocation(spectralCompositeProgram, "u_colorB"), colorB_Palette);
    gl.uniform3fv(gl.getUniformLocation(spectralCompositeProgram, "u_colorC"), colorC_Palette);
    gl.uniform3fv(gl.getUniformLocation(spectralCompositeProgram, "u_colorD"), colorD_Palette);

    // Set u_flipY for drawing to the screen
    gl.uniform1f(gl.getUniformLocation(spectralCompositeProgram, "u_flipY"), 1.0);

    // Clear screen before drawing final texture
    gl.clearColor(0, 0, 0, 1); // Clear with opaque black
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Draw the final composited quad
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    frameCount++;
}

// Add back rendering control functions
async function startRendering() {
    try {
        // Cast window to any to bypass the type error for showDirectoryPicker
        dirHandle = await (window as any).showDirectoryPicker();
        currentFrameNumber = 0;
        isRendering = true;
        console.log('Starting render sequence...');
    } catch (err: any) { // Added type annotation for err
        console.error(err.name, err.message);
    }
}

async function saveCurrentFrame(canvas: HTMLCanvasElement) {
    if (!dirHandle) return;

    const frameToSave = currentFrameNumber;  // Capture the frame number immediately
    try {
        const filename = `frame_${padFrameNumber(frameToSave)}.png`;  // Use captured value
        
        const dataUrl = canvas.toDataURL('image/png');
        const response = await fetch(dataUrl);
        const blob = await response.blob();

        const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
        const writableStream = await fileHandle.createWritable();
        await writableStream.write(blob);
        await writableStream.close();
        
        console.log(`Saved ${filename}`);
        
        currentFrameNumber = frameToSave + 1;  // Increment based on captured value
        
        if (currentFrameNumber >= TOTAL_FRAMES) {
            isRendering = false;
            dirHandle = null;
            console.log('Render sequence complete!');
        }
    } catch (err) {
        console.error('Failed to save frame:', err);
        isRendering = false;
        dirHandle = null;
    }
}

export function start(contexts: CanvasContexts) {
    // Modify animation loop for conditional saving
    async function animate() {
        draw(contexts);
        
        if (isRendering) {
            // Need to pass the correct canvas (canvasWebGL) to saveCurrentFrame
            await saveCurrentFrame(contexts.canvasWebGL);
            // Only request next frame if still rendering
            if (isRendering) {
            requestAnimationFrame(animate);
            }
        } else {
            requestAnimationFrame(animate); // Continue animation even when not saving
        }
    }

    // Add back render button listener
    const renderButton = document.querySelector('#render-button');
    renderButton?.addEventListener('click', startRendering);
    
    setup(contexts);
    animate();
}

// Keep initGradientProgram - no ! needed for gl, positionBuffer, texCoordBuffer
function initGradientProgram(gl: WebGLRenderingContext) {
    const vertexShader = gl.createShader(gl.VERTEX_SHADER); // Removed !
    if (!vertexShader) throw new Error("Couldn't create vertex shader"); // Added check
    gl.shaderSource(vertexShader, passthroughVertexShader);
    gl.compileShader(vertexShader);
    // TODO: Add error checking

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER); // Removed !
    if (!fragmentShader) throw new Error("Couldn't create fragment shader"); // Added check
    gl.shaderSource(fragmentShader, simpleGradientFragmentShader);
    gl.compileShader(fragmentShader);
    // TODO: Add error checking

    const localProgram = gl.createProgram(); // Removed !
    if (!localProgram) throw new Error("Couldn't create program"); // Added check
    gradientProgram = localProgram; // Assign to global
    gl.attachShader(gradientProgram, vertexShader);
    gl.attachShader(gradientProgram, fragmentShader);
    gl.linkProgram(gradientProgram);
    // TODO: Add error checking

    // Set up attributes using global buffers
    gl.useProgram(gradientProgram); // Use program before getting locations
    const positionLocation = gl.getAttribLocation(gradientProgram, "a_position");
    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer); // Bind correct buffer
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const texCoordLocation = gl.getAttribLocation(gradientProgram, "a_texCoord");
    gl.enableVertexAttribArray(texCoordLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer); // Bind correct buffer
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);
}

// --- Step 9: Implement initBlurProgram ---
function initBlurProgram(gl: WebGLRenderingContext) {
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    if (!vertexShader) throw new Error("Couldn't create vertex shader for blur");
    gl.shaderSource(vertexShader, passthroughVertexShader);
    gl.compileShader(vertexShader);
    // TODO: Check compile status: gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    if (!fragmentShader) throw new Error("Couldn't create fragment shader for blur");
    gl.shaderSource(fragmentShader, blurFragmentShader); // Use blur shader source
    gl.compileShader(fragmentShader);
    // TODO: Check compile status: gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)

    const localProgram = gl.createProgram();
    if (!localProgram) throw new Error("Couldn't create blur program");
    blurProgram = localProgram; // Assign to the global variable
    gl.attachShader(blurProgram, vertexShader);
    gl.attachShader(blurProgram, fragmentShader);
    gl.linkProgram(blurProgram);
    // TODO: Check link status: gl.getProgramParameter(blurProgram, gl.LINK_STATUS)

    // Set up attributes using global buffers
    gl.useProgram(blurProgram); // Use program before getting locations

    const positionLocation = gl.getAttribLocation(blurProgram, "a_position");
    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer); // Bind correct buffer
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const texCoordLocation = gl.getAttribLocation(blurProgram, "a_texCoord");
    gl.enableVertexAttribArray(texCoordLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer); // Bind correct buffer
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);
}

// Remove placeholder/old initPaletteProgram - Will be replaced by initSpectralCompositeProgram
// function initPaletteProgram(gl: WebGLRenderingContext) { ... }


// --- Step 10: Implement initSpectralCompositeProgram ---
function initSpectralCompositeProgram(gl: WebGLRenderingContext) {
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    if (!vertexShader) throw new Error("Couldn't create vertex shader for composite");
    gl.shaderSource(vertexShader, passthroughVertexShader);
    gl.compileShader(vertexShader);
    // TODO: Check compile status

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    if (!fragmentShader) throw new Error("Couldn't create fragment shader for composite");
    // Use the NEW spectral composite fragment shader source
    gl.shaderSource(fragmentShader, spectralCompositeFragmentShader); // Changed source
    gl.compileShader(fragmentShader);
    // TODO: Check compile status

    const localProgram = gl.createProgram();
    if (!localProgram) throw new Error("Couldn't create spectral composite program");
    spectralCompositeProgram = localProgram; // Assign to the renamed global variable
    gl.attachShader(spectralCompositeProgram, vertexShader);
    gl.attachShader(spectralCompositeProgram, fragmentShader);
    gl.linkProgram(spectralCompositeProgram);
    // TODO: Check link status

    // Set up attributes using global buffers
    gl.useProgram(spectralCompositeProgram); // Use program before getting locations

    const positionLocation = gl.getAttribLocation(spectralCompositeProgram, "a_position");
    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer); // Bind correct buffer
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const texCoordLocation = gl.getAttribLocation(spectralCompositeProgram, "a_texCoord");
    gl.enableVertexAttribArray(texCoordLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer); // Bind correct buffer
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);
}

// Keep helper function to convert hex to [r, g, b] in 0..1
function hexToRgb01(hex: string): [number, number, number] {
    const n = parseInt(hex.replace('#', ''), 16);
    return [
        ((n >> 16) & 0xff) / 255,
        ((n >> 8) & 0xff) / 255,
        (n & 0xff) / 255
    ];
}

// --- Step (New): Implement initElementAccumulationProgram ---
function initElementAccumulationProgram(gl: WebGLRenderingContext) {
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    if (!vertexShader) throw new Error("Couldn't create vertex shader for element accumulation");
    gl.shaderSource(vertexShader, passthroughVertexShader);
    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        console.error("Vertex shader (element_accumulation) compile error:", gl.getShaderInfoLog(vertexShader));
        throw new Error("Failed to compile element accumulation vertex shader");
    }

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    if (!fragmentShader) throw new Error("Couldn't create fragment shader for element accumulation");
    gl.shaderSource(fragmentShader, elementAccumulationFragmentShader);
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        console.error("Fragment shader (element_accumulation) compile error:", gl.getShaderInfoLog(fragmentShader));
        throw new Error("Failed to compile element accumulation fragment shader");
    }

    const localProgram = gl.createProgram();
    if (!localProgram) throw new Error("Couldn't create element accumulation program");
    elementAccumulationProgram = localProgram;
    gl.attachShader(elementAccumulationProgram, vertexShader);
    gl.attachShader(elementAccumulationProgram, fragmentShader);
    gl.linkProgram(elementAccumulationProgram);
    if (!gl.getProgramParameter(elementAccumulationProgram, gl.LINK_STATUS)) {
        console.error("Program (element_accumulation) link error:", gl.getProgramInfoLog(elementAccumulationProgram));
        throw new Error("Failed to link element accumulation program");
    }

    gl.useProgram(elementAccumulationProgram);
    const positionLocation = gl.getAttribLocation(elementAccumulationProgram, "a_position");
    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const texCoordLocation = gl.getAttribLocation(elementAccumulationProgram, "a_texCoord");
    gl.enableVertexAttribArray(texCoordLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);
}

// --- Step (New): Implement initPassthroughTextureProgram ---
function initPassthroughTextureProgram(gl: WebGLRenderingContext) {
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    if (!vertexShader) throw new Error("Couldn't create vertex shader for passthrough texture");
    gl.shaderSource(vertexShader, passthroughVertexShader);
    gl.compileShader(vertexShader);
     if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        console.error("Vertex shader (passthrough_texture) compile error:", gl.getShaderInfoLog(vertexShader));
        throw new Error("Failed to compile passthrough texture vertex shader");
    }

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    if (!fragmentShader) throw new Error("Couldn't create fragment shader for passthrough texture");
    gl.shaderSource(fragmentShader, passthroughTextureFragmentShader); // Use new shader source
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        console.error("Fragment shader (passthrough_texture) compile error:", gl.getShaderInfoLog(fragmentShader));
        throw new Error("Failed to compile passthrough texture fragment shader");
    }

    const localProgram = gl.createProgram();
    if (!localProgram) throw new Error("Couldn't create passthrough texture program");
    passthroughTextureProgram = localProgram;
    gl.attachShader(passthroughTextureProgram, vertexShader);
    gl.attachShader(passthroughTextureProgram, fragmentShader);
    gl.linkProgram(passthroughTextureProgram);
    if (!gl.getProgramParameter(passthroughTextureProgram, gl.LINK_STATUS)) {
        console.error("Program (passthrough_texture) link error:", gl.getProgramInfoLog(passthroughTextureProgram));
        throw new Error("Failed to link passthrough texture program");
    }

    gl.useProgram(passthroughTextureProgram);
    const positionLocation = gl.getAttribLocation(passthroughTextureProgram, "a_position");
    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const texCoordLocation = gl.getAttribLocation(passthroughTextureProgram, "a_texCoord");
    gl.enableVertexAttribArray(texCoordLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);
}

// --- Step (New): Implement initCombineAndPersistGlowProgram ---
function initCombineAndPersistGlowProgram(gl: WebGLRenderingContext) {
    const fragShaderSource = combineAndPersistGlowFragmentShader;

    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    if (!vertexShader) throw new Error("Couldn't create vertex shader for combine/persist glow");
    gl.shaderSource(vertexShader, passthroughVertexShader);
    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        console.error("Vertex shader (combine/persist glow) compile error:", gl.getShaderInfoLog(vertexShader));
        throw new Error("Failed to compile combine/persist glow vertex shader");
    }

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    if (!fragmentShader) throw new Error("Couldn't create fragment shader for combine/persist glow");
    gl.shaderSource(fragmentShader, fragShaderSource);
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        console.error("Fragment shader (combine/persist glow) compile error:", gl.getShaderInfoLog(fragmentShader));
        throw new Error("Failed to compile combine/persist glow fragment shader");
    }

    const localProgram = gl.createProgram();
    if (!localProgram) throw new Error("Couldn't create combine/persist glow program");
    combineAndPersistGlowProgram = localProgram;
    gl.attachShader(combineAndPersistGlowProgram, vertexShader);
    gl.attachShader(combineAndPersistGlowProgram, fragmentShader);
    gl.linkProgram(combineAndPersistGlowProgram);
    if (!gl.getProgramParameter(combineAndPersistGlowProgram, gl.LINK_STATUS)) {
        console.error("Program (combine/persist glow) link error:", gl.getProgramInfoLog(combineAndPersistGlowProgram));
        throw new Error("Failed to link combine/persist glow program");
    }

    gl.useProgram(combineAndPersistGlowProgram);
    const positionLocation = gl.getAttribLocation(combineAndPersistGlowProgram, "a_position");
    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const texCoordLocation = gl.getAttribLocation(combineAndPersistGlowProgram, "a_texCoord");
    gl.enableVertexAttribArray(texCoordLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);
}