precision mediump float;
uniform sampler2D u_newContributionTex; // Current sharp trails
uniform sampler2D u_previousGlowTex;  // Accumulated glow from last frame
uniform float u_glowPersistence;      // How much the old glow should persist
uniform float u_flipY;                // Standard flip uniform, usually 0 for FBOs
varying vec2 v_texCoord;

void main() {
    vec2 tc = v_texCoord;
    // Flipping Y is generally not needed when rendering to an FBO
    // if (u_flipY > 0.5) {
    //     tc.y = 1.0 - tc.y;
    // }
    vec4 newPart = texture2D(u_newContributionTex, tc);
    vec4 oldPart = texture2D(u_previousGlowTex, tc);

    // Add the new contribution to the faded old glow
    // The alpha channel will accumulate as well, which is good.
    gl_FragColor = newPart + oldPart - (1.0 - u_glowPersistence);
    //gl_FragColor = max(newPart,oldPart) - (1.0 - u_glowPersistence); 

    // Clamping is a good idea to keep values in a predictable range,
    // especially since blur shaders might not handle HDR values gracefully
    // without specific design for it.
    gl_FragColor = clamp(gl_FragColor, 0.0, 1.0);
}