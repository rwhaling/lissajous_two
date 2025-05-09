import passthroughVertexShader from './shaders/passthrough.vert?raw'
import simpleGradientFragmentShader from './shaders/simplegradient.frag?raw'
import spectralCompositeFragmentShader from './shaders/spectralComposite.frag?raw'
import blurFragmentShader from './shaders/gaussianBlur.frag?raw'
// import elementAccumulationFragmentShader from './shaders/elementAccumulation.frag?raw' // Removed
import passthroughTextureFragmentShader from './shaders/passthroughTexture.frag?raw'

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
const BLUR_RADIUS = 5.0; // Example blur radius
const BLUR_PASSES = 10;   // Example blur passes
const FADE_FACTOR = 0.995; // Example fade factor
// Keep gradient noise parameters
let NOISE_CENTER = 0.4;
let NOISE_WIDTH = 0.55;
let NOISE_AMPLITUDE = 0.4;
let NOISE_SPEED = 0.4;
let NOISE_SCALE = 96.0;
let NOISE_OFFSET_SCALE = 0.7;

// Keep gradient wave parameters
let WAVE_AMPLITUDE = 0.4;
let WAVE_XSCALE = 5.5;      // NEW: x scale for the wave
let WAVE_TIMESCALE = 0.6;   // NEW: time scale for the wave

// Lissajous Parameters for the moving circle
const LISSAJOUS_A = 4.25;
const LISSAJOUS_B = 2.75;
const LISSAJOUS_RADIUS = 30; // px
const LISSAJOUS_TIME_SCALE = 1.0; // Adjust for slower/faster movement

// Palette Colors
let GRADIENT_COLOR_A = '#FF0000'; // Base Color A
let GRADIENT_COLOR_B = '#FFFF00'; // Base Color B
// --- Step 1: Add New Color Constants ---
const PALETTE_COLOR_C = '#000000'; // Color for opaque black elements
const PALETTE_COLOR_D = '#0000FF'; // Color for opaque white elements (unused for now)

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
// let elementAccumulationProgram: WebGLProgram; // Removed
let passthroughTextureProgram: WebGLProgram;

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

    // --- Initial Allocation ---
    // Will be done in setup based on actual canvas size
    gl.bindTexture(gl.TEXTURE_2D, null); // Unbind texture
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); // Ensure we start unbound
}

export function setup({ /*canvas2d,*/ canvasWebGL }: CanvasContexts) {
    initWebGL(canvasWebGL);

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

    gl.bindTexture(gl.TEXTURE_2D, null); // Unbind

    // --- Step (New): Assign initial accumulation textures for ping-pong ---
    readAccumulationTexture = elementsAccumulationTextureA;
    writeAccumulationTexture = elementsAccumulationTextureB;

    // --- Step 8: Initialize Programs ---
    initGradientProgram(gl);
    initBlurProgram(gl);
    initSpectralCompositeProgram(gl);
    // --- Step (New): Initialize new programs ---
    // initElementAccumulationProgram(gl); // Removed
    initPassthroughTextureProgram(gl);

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

    gl.bindFramebuffer(gl.FRAMEBUFFER, null); // Ensure we end unbound
}

export function draw({ /*canvas2d,*/ canvasWebGL }: CanvasContexts) {
    // --- Step 15a: Update resource check ---
    if (!gl || !framebuffer || !frameTexture ||
        !elementsCanvas || !elementsCtx || !currentFrameElementsTexture ||
        !elementsAccumulationTextureA || !elementsAccumulationTextureB || !accumulationFramebuffer ||
        !blurFramebuffer || !blurredElementsTexture || !tempBlurTexture ||
        !positionBuffer || !texCoordBuffer ||
        !gradientProgram || !blurProgram || !spectralCompositeProgram ||
        // !elementAccumulationProgram || // Removed
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
    // Clear the 2D canvas (transparent) - RE-ENABLE THIS
    elementsCtx.clearRect(0, 0, elementsCanvas.width, elementsCanvas.height);

    // Calculate Lissajous coordinates for the circle
    const canvasCenterX = elementsCanvas.width / 2;
    const canvasCenterY = elementsCanvas.height / 2;
    
    // Max amplitude for Lissajous figure to keep the circle within bounds
    const amplitudeX = (elementsCanvas.width / 2) - LISSAJOUS_RADIUS;
    const amplitudeY = (elementsCanvas.height / 2) - LISSAJOUS_RADIUS;
    
    const lissajousTime = currentTime * LISSAJOUS_TIME_SCALE;
    
    // δ = Math.PI / 2 for a common Lissajous shape
    const circleX = canvasCenterX + amplitudeX * Math.sin(LISSAJOUS_A * lissajousTime + Math.PI / 2);
    const circleY = canvasCenterY + amplitudeY * Math.sin(LISSAJOUS_B * lissajousTime);

    // Draw the black circle at the calculated Lissajous position
    elementsCtx.fillStyle = 'black'; // Opaque black
    elementsCtx.beginPath();
    elementsCtx.arc(circleX, circleY, LISSAJOUS_RADIUS, 0, Math.PI * 2);
    elementsCtx.fill();

    // Upload canvas to currentFrameElementsTexture
    gl.activeTexture(gl.TEXTURE0); // Use a consistent texture unit
    gl.bindTexture(gl.TEXTURE_2D, currentFrameElementsTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, elementsCanvas);

    // --- Pass 2A: Accumulate elements with progressive blur & fading ---
    gl.bindFramebuffer(gl.FRAMEBUFFER, accumulationFramebuffer);
    // Target 'writeAccumulationTexture' for the entire accumulation step.
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, writeAccumulationTexture, 0);
    gl.viewport(0, 0, width, height);
    
    // Step 1: Blur and fade the previous frame's trails ('readAccumulationTexture')
    // and draw them into 'writeAccumulationTexture'.
    // The BLUR_PASSES and BLUR_RADIUS will control this blur. FADE_FACTOR controls the fade.
    
    let texToBlurAndFade = readAccumulationTexture;
    let targetForBlurredAndFaded = writeAccumulationTexture; // Initial target for single pass or final target for multi-pass

    if (BLUR_PASSES <= 0 || BLUR_RADIUS <= 0) { // If no blur, just fade (or draw if FADE_FACTOR is 1)
        // This case might need a simple "fade program" if we want to separate fading from blurring completely.
        // For now, if no blur, the trails won't be processed by blurProgram.
        // Let's assume blurProgram is always used if accumulation is happening.
        // If FADE_FACTOR is 1.0 and BLUR_RADIUS is 0, gaussianBlur.frag would effectively be a passthrough.
        // To handle "no blur but fade", one might reintroduce a dedicated fade shader or ensure gaussianBlur with radius 0 + fade works.
        // For now, we assume BLUR_RADIUS > 0 for this path.
        
        // Fallback: if no blur/fade, just clear and prepare for new element
        // This part of logic might need refinement based on desired behavior when BLUR_RADIUS = 0
        gl.clearColor(0,0,0,0);
        gl.clear(gl.COLOR_BUFFER_BIT); // Clear if not drawing faded/blurred previous state

    } else {
        // Use blurFramebuffer for intermediate blur passes if BLUR_PASSES > 1
        // For BLUR_PASSES = 1, intermediate FBO is not strictly needed, can draw directly.
        let readForBlur = texToBlurAndFade;
        let writeForBlurPass = tempBlurTexture; // Use temp for ping-pong if BLUR_PASSES > 1

        for (let i = 0; i < BLUR_PASSES; ++i) {
            const isLastPass = (i === BLUR_PASSES - 1);
            const currentTargetTexture = isLastPass ? targetForBlurredAndFaded : writeForBlurPass;
            const effectiveFadeFactor = isLastPass ? FADE_FACTOR : 1.0; // Apply fade only on the final output of blur stage

            // Bind FBO for the current blur pass output
            if (isLastPass) {
                 // Final pass writes to accumulationFramebuffer's 'writeAccumulationTexture'
                gl.bindFramebuffer(gl.FRAMEBUFFER, accumulationFramebuffer); // Already bound from start of Pass 2A
                gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, currentTargetTexture, 0);
            } else {
                // Intermediate passes write to blurFramebuffer's 'tempBlurTexture' (or 'writeForBlurPass')
                gl.bindFramebuffer(gl.FRAMEBUFFER, blurFramebuffer);
                gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, currentTargetTexture, 0);
            }
            gl.viewport(0, 0, width, height);
            gl.clearColor(0, 0, 0, 0); // Clear target before drawing blurred content
            gl.clear(gl.COLOR_BUFFER_BIT);

            gl.useProgram(blurProgram);
            gl.uniform1f(gl.getUniformLocation(blurProgram, "u_blurRadius"), BLUR_RADIUS);
            gl.uniform1f(gl.getUniformLocation(blurProgram, "u_fadeFactor"), effectiveFadeFactor);
            gl.uniform2f(gl.getUniformLocation(blurProgram, "u_resolution"), width, height);
            gl.uniform1f(gl.getUniformLocation(blurProgram, "u_time"), currentTime); // Pass time
            gl.uniform1f(gl.getUniformLocation(blurProgram, "u_flipY"), 0.0); // Drawing to FBO

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, readForBlur);
            gl.uniform1i(gl.getUniformLocation(blurProgram, "u_image"), 0);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

            if (!isLastPass) {
                [readForBlur, writeForBlurPass] = [writeForBlurPass, readForBlur]; // Ping-pong
            } else {
                // 'targetForBlurredAndFaded' (which is 'writeAccumulationTexture') now has the result.
            }
        }
        // Ensure we are back to accumulationFramebuffer if multiple blur passes used blurFramebuffer
        gl.bindFramebuffer(gl.FRAMEBUFFER, accumulationFramebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, writeAccumulationTexture, 0);
        gl.viewport(0, 0, width, height); // Reset viewport if it changed
    }

    // Step 2: Draw current frame's elements ('currentFrameElementsTexture')
    // on top of 'writeAccumulationTexture' (which now contains blurred & faded trails).
    gl.useProgram(passthroughTextureProgram);
    gl.uniform1f(gl.getUniformLocation(passthroughTextureProgram, "u_flipY"), 0.0); // Drawing to FBO

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, currentFrameElementsTexture);
    gl.uniform1i(gl.getUniformLocation(passthroughTextureProgram, "u_image"), 0);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); // Standard alpha blending
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disable(gl.BLEND);

    // Ping-pong accumulation textures
    [readAccumulationTexture, writeAccumulationTexture] = [writeAccumulationTexture, readAccumulationTexture];

    // --- Pass 3: Blur accumulated elements (REMOVED as blur is now progressive) ---
    // let readTex = readAccumulationTexture; 
    // let writeTex = blurredElementsTexture;
    // let finalBlurredTexture = readAccumulationTexture; 
    // if (BLUR_PASSES > 0 && BLUR_RADIUS > 0) { ... } else { ... }
    // The final result of accumulation (which has been progressively blurred) is in readAccumulationTexture
    const finalBlurredTexture = readAccumulationTexture;

    // --- Pass 4: Composite to screen using spectral shader ---
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); // Render to screen
    gl.viewport(0, 0, width, height);
    gl.useProgram(spectralCompositeProgram);

    // Bind gradient texture to unit 0
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, frameTexture);
    gl.uniform1i(gl.getUniformLocation(spectralCompositeProgram, "u_gradientTex"), 0);

    // Bind blurred elements texture to unit 1
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, finalBlurredTexture); // Use the result from blur pass
    gl.uniform1i(gl.getUniformLocation(spectralCompositeProgram, "u_elementsTex"), 1);

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
        dirHandle = await window.showDirectoryPicker();
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