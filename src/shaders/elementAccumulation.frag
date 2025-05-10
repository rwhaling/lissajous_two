    precision mediump float;
    uniform sampler2D u_image;
    uniform float u_fadeFactor;
    varying vec2 v_texCoord;
    void main() {
        gl_FragColor = texture2D(u_image, v_texCoord) - (1.0 - u_fadeFactor);
    }