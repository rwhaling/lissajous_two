(function(){const r=document.createElement("link").relList;if(r&&r.supports&&r.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))i(a);new MutationObserver(a=>{for(const n of a)if(n.type==="childList")for(const E of n.addedNodes)E.tagName==="LINK"&&E.rel==="modulepreload"&&i(E)}).observe(document,{childList:!0,subtree:!0});function o(a){const n={};return a.integrity&&(n.integrity=a.integrity),a.referrerPolicy&&(n.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?n.credentials="include":a.crossOrigin==="anonymous"?n.credentials="omit":n.credentials="same-origin",n}function i(a){if(a.ep)return;a.ep=!0;const n=o(a);fetch(a.href,n)}})();const xe=`attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;
void main() {
    gl_Position = vec4(a_position, 0, 1);
    v_texCoord = a_texCoord; // Pass through texCoord directly
}
`,o0=`precision mediump float;

uniform vec3 u_colorA;
uniform vec3 u_colorB;
varying vec2 v_texCoord;
uniform float u_time;
uniform float u_noiseCenter; // Center of noisy region (0.0-1.0)
uniform float u_noiseWidth;  // Width of noisy region (0.0-1.0)
uniform float u_noiseAmplitude;
uniform float u_noiseSpeed;
uniform float u_noiseScale;
uniform float u_noiseOffsetScale;
uniform float u_waveAmplitude; // Add this uniform for the wave amplitude
uniform float u_waveXScale;    // NEW: x scale for the wave
uniform float u_waveTimeScale; // NEW: time scale for the wave

vec3 mod289(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 mod289(vec4 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 permute(vec4 x) {
     return mod289(((x*34.0)+10.0)*x);
}

vec4 taylorInvSqrt(vec4 r)
{
  return 1.79284291400159 - 0.85373472095314 * r;
}

float snoise(vec3 v) { 
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

// First corner
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 =   v - i + dot(i, C.xxx) ;

// Other corners
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );

  //   x0 = x0 - 0.0 + 0.0 * C.xxx;
  //   x1 = x0 - i1  + 1.0 * C.xxx;
  //   x2 = x0 - i2  + 2.0 * C.xxx;
  //   x3 = x0 - 1.0 + 3.0 * C.xxx;
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy; // 2.0*C.x = 1/3 = C.y
  vec3 x3 = x0 - D.yyy;      // -1.0+3.0*C.x = -0.5 = -D.y

// Permutations
  i = mod289(i); 
  vec4 p = permute( permute( permute( 
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

// Gradients: 7x7 points over a square, mapped onto an octahedron.
// The ring size 17*17 = 289 is close to a multiple of 49 (49*6 = 294)
  float n_ = 0.142857142857; // 1.0/7.0
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  //  mod(p,7*7)

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );

  //vec4 s0 = vec4(lessThan(b0,0.0))*2.0 - 1.0;
  //vec4 s1 = vec4(lessThan(b1,0.0))*2.0 - 1.0;
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);

//Normalise gradients
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

// Mix final noise value
  vec4 m = max(0.5 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 105.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                dot(p2,x2), dot(p3,x3) ) );
}

// Fractal Brownian Motion (fBm) - sum of multiple octaves of noise
float fbm(vec3 p) {
    float sum = 0.0;
    float amp = 0.5;
    float freq = 1.0;
    for (int i = 0; i < 4; i++) { // 4 octaves is a good default
        sum += amp * snoise(p * freq);
        freq *= 2.0;
        amp *= 0.5;
    }
    return sum;
}

void main() {
    // Use uniforms for noise parameters
    float scale = u_noiseScale;
    float speed = u_noiseSpeed;
    float amplitude = u_noiseAmplitude;

    // --- 1. Compute the large single-octave 1D noise wave (time-wave) ---
    float wave = snoise(vec3(
        v_texCoord.x * u_waveXScale,
        0.0,
        u_time * u_waveTimeScale
    ));

    // --- 2. Compute the warp point (seam) ---
    float warpPoint = 0.5 + wave * u_waveAmplitude;

    // --- 3. Compute fBm noise using the ORIGINAL y coordinate ---
    float noise = fbm(vec3(
        v_texCoord.x * scale,
        v_texCoord.y * scale,
        u_time * speed
    ));

    // --- 4. Symmetric threshold and remap for blobs at both ends ---
    float threshold = 0.4;
    float blobNoise = 0.0;
    if (noise > threshold) {
        blobNoise = 1.0 * u_noiseOffsetScale;
    } else if (noise < -threshold) {
        blobNoise = -1.0 * u_noiseOffsetScale;
    } else {
        blobNoise = 0.0;
    }

    // --- 5. Cubic dropoff for noise region, using the original y ---
    float halfWidth = u_noiseWidth * 0.5;
    float dist = abs(v_texCoord.y - warpPoint);

    float falloff = 0.0;
    if (dist < halfWidth) {
        float t = 1.0 - (dist / halfWidth);
        falloff = t * t * (3.0 - 2.0 * t);
    }

    // --- 6. Offset y by blobNoise * falloff * amplitude ---
    float noisyY = v_texCoord.y + blobNoise * amplitude * falloff;
//    float noisyY = v_texCoord.y + blobNoise * amplitude;

    // --- 7. Warp mapping: map noisyY to [0,1] with seam at warpPoint ---
    float warpedY;
    if (noisyY < warpPoint) {
        // Map [0, warpPoint] -> [0, 0.5]
        warpedY = 0.4 * (noisyY / max(warpPoint, 1e-5));
    } else {
        // Map [warpPoint, 1] -> [0.5, 1]
        warpedY = 0.4 + 0.3 * ((noisyY - warpPoint) / max(1.0 - warpPoint, 1e-5));
    }
    warpedY = clamp(warpedY, 0.0, 1.0);

    // --- 8. Color mix ---
    vec3 color = mix(u_colorA, u_colorB, warpedY);
    gl_FragColor = vec4(color, 1.0);
}`,n0=`precision mediump float;

//  MIT License
//
//  Copyright (c) 2025 Ronald van Wijnen
//
//  Permission is hereby granted, free of charge, to any person obtaining a
//  copy of this software and associated documentation files (the "Software"),
//  to deal in the Software without restriction, including without limitation
//  the rights to use, copy, modify, merge, publish, distribute, sublicense,
//  and/or sell copies of the Software, and to permit persons to whom the
//  Software is furnished to do so, subject to the following conditions:
//
//  The above copyright notice and this permission notice shall be included in
//  all copies or substantial portions of the Software.
//
//  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
//  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
//  DEALINGS IN THE SOFTWARE.

#ifndef SPECTRAL
#define SPECTRAL

const int SPECTRAL_SIZE = 38;
const float SPECTRAL_GAMMA = 2.4;
const float SPECTRAL_EPSILON = 0.0000000000000001;

float spectral_uncompand(float x) {
  return (x < 0.04045) ? x / 12.92 : pow((x + 0.055) / 1.055, SPECTRAL_GAMMA);
}

float spectral_compand(float x) {
  return (x < 0.0031308) ? x * 12.92 : 1.055 * pow(x, 1.0 / SPECTRAL_GAMMA) - 0.055;
}

vec3 spectral_srgb_to_linear(vec3 srgb) {
  return vec3(spectral_uncompand(srgb[0]), spectral_uncompand(srgb[1]), spectral_uncompand(srgb[2]));
}

vec3 spectral_linear_to_srgb(vec3 lrgb) {
  return clamp(vec3(spectral_compand(lrgb[0]), spectral_compand(lrgb[1]), spectral_compand(lrgb[2])), 0., 1.);
}

void spectral_linear_to_reflectance(vec3 lrgb, inout float R[SPECTRAL_SIZE]) {
  float w = min(lrgb.r, min(lrgb.g, lrgb.b));

  lrgb -= w;

  float c = min(lrgb.g, lrgb.b);
  float m = min(lrgb.r, lrgb.b);
  float y = min(lrgb.r, lrgb.g);

  float r = min(max(0.0, lrgb.r - lrgb.b), max(0.0, lrgb.r - lrgb.g));
  float g = min(max(0.0, lrgb.g - lrgb.b), max(0.0, lrgb.g - lrgb.r));
  float b = min(max(0.0, lrgb.b - lrgb.g), max(0.0, lrgb.b - lrgb.r));
  
  R[ 0] = max(SPECTRAL_EPSILON, w * 1.0011607271876400 + c * 0.9705850013229620 + m * 0.9906735573199880 + y * 0.0210523371789306 + r * 0.0315605737777207 + g * 0.0095560747554212 + b * 0.9794047525020140);
  R[ 1] = max(SPECTRAL_EPSILON, w * 1.0011606515972800 + c * 0.9705924981434250 + m * 0.9906715249619790 + y * 0.0210564627517414 + r * 0.0315520718330149 + g * 0.0095581580120851 + b * 0.9794007068431300);
  R[ 2] = max(SPECTRAL_EPSILON, w * 1.0011603192274700 + c * 0.9706253487298910 + m * 0.9906625823534210 + y * 0.0210746178695038 + r * 0.0315148215513658 + g * 0.0095673245444588 + b * 0.9793829034702610);
  R[ 3] = max(SPECTRAL_EPSILON, w * 1.0011586727078900 + c * 0.9707868061190170 + m * 0.9906181076447950 + y * 0.0211649058448753 + r * 0.0313318044982702 + g * 0.0096129126297349 + b * 0.9792943649455940);
  R[ 4] = max(SPECTRAL_EPSILON, w * 1.0011525984455200 + c * 0.9713686732282480 + m * 0.9904514808787100 + y * 0.0215027957272504 + r * 0.0306729857725527 + g * 0.0097837090401843 + b * 0.9789630146085700);
  R[ 5] = max(SPECTRAL_EPSILON, w * 1.0011325252899800 + c * 0.9731632306212520 + m * 0.9898710814002040 + y * 0.0226738799041561 + r * 0.0286480476989607 + g * 0.0103786227058710 + b * 0.9778144666940430);
  R[ 6] = max(SPECTRAL_EPSILON, w * 1.0010850066332700 + c * 0.9767402231587650 + m * 0.9882866087596400 + y * 0.0258235649693629 + r * 0.0246450407045709 + g * 0.0120026452378567 + b * 0.9747243211338360);
  R[ 7] = max(SPECTRAL_EPSILON, w * 1.0009968788945300 + c * 0.9815876054913770 + m * 0.9842906927975040 + y * 0.0334879385639851 + r * 0.0192960753663651 + g * 0.0160977721473922 + b * 0.9671984823439730);
  R[ 8] = max(SPECTRAL_EPSILON, w * 1.0008652515227400 + c * 0.9862802656529490 + m * 0.9739349056253060 + y * 0.0519069663740307 + r * 0.0142066612220556 + g * 0.0267061902231680 + b * 0.9490796575305750);
  R[ 9] = max(SPECTRAL_EPSILON, w * 1.0006962900094000 + c * 0.9899491476891340 + m * 0.9418178384601450 + y * 0.1007490148334730 + r * 0.0102942608878609 + g * 0.0595555440185881 + b * 0.9008501289409770);
  R[10] = max(SPECTRAL_EPSILON, w * 1.0005049611488800 + c * 0.9924927015384200 + m * 0.8173903261951560 + y * 0.2391298997068470 + r * 0.0076191460521811 + g * 0.1860398265328260 + b * 0.7631504454622400);
  R[11] = max(SPECTRAL_EPSILON, w * 1.0003080818799200 + c * 0.9941456804052560 + m * 0.4324728050657290 + y * 0.5348043122727480 + r * 0.0058980410835420 + g * 0.5705798201161590 + b * 0.4659221716493190);
  R[12] = max(SPECTRAL_EPSILON, w * 1.0001196660201300 + c * 0.9951839750332120 + m * 0.1384539782588700 + y * 0.7978075786430300 + r * 0.0048233247781713 + g * 0.8614677684002920 + b * 0.2012632804510050);
  R[13] = max(SPECTRAL_EPSILON, w * 0.9999527659684070 + c * 0.9957567501108180 + m * 0.0537347216940033 + y * 0.9114498940673840 + r * 0.0042298748350633 + g * 0.9458790897676580 + b * 0.0877524413419623);
  R[14] = max(SPECTRAL_EPSILON, w * 0.9998218368992970 + c * 0.9959128182867100 + m * 0.0292174996673231 + y * 0.9537979630045070 + r * 0.0040599171299341 + g * 0.9704654864743050 + b * 0.0457176793291679);
  R[15] = max(SPECTRAL_EPSILON, w * 0.9997386095575930 + c * 0.9956061578345280 + m * 0.0213136517508590 + y * 0.9712416154654290 + r * 0.0043533695594676 + g * 0.9784136302844500 + b * 0.0284706050521843);
  R[16] = max(SPECTRAL_EPSILON, w * 0.9997095516396120 + c * 0.9945976009618540 + m * 0.0201349530181136 + y * 0.9793031238075880 + r * 0.0053434425970201 + g * 0.9795890314112240 + b * 0.0205271767569850);
  R[17] = max(SPECTRAL_EPSILON, w * 0.9997319302106270 + c * 0.9922157154923700 + m * 0.0241323096280662 + y * 0.9833801195075750 + r * 0.0076917201010463 + g * 0.9755335369086320 + b * 0.0165302792310211);
  R[18] = max(SPECTRAL_EPSILON, w * 0.9997994363461950 + c * 0.9862364527832490 + m * 0.0372236145223627 + y * 0.9854612465677550 + r * 0.0135969795736536 + g * 0.9622887553978130 + b * 0.0145135107212858);
  R[19] = max(SPECTRAL_EPSILON, w * 0.9999003303166710 + c * 0.9679433372645410 + m * 0.0760506552706601 + y * 0.9864350469766050 + r * 0.0316975442661115 + g * 0.9231215745131200 + b * 0.0136003508637687);
  R[20] = max(SPECTRAL_EPSILON, w * 1.0000204065261100 + c * 0.8912850042449430 + m * 0.2053754719423990 + y * 0.9867382506701410 + r * 0.1078611963552490 + g * 0.7934340189431110 + b * 0.0133604258769571);
  R[21] = max(SPECTRAL_EPSILON, w * 1.0001447879365800 + c * 0.5362024778620530 + m * 0.5412689034604390 + y * 0.9866178824450320 + r * 0.4638126031687040 + g * 0.4592701359024290 + b * 0.0135488943145680);
  R[22] = max(SPECTRAL_EPSILON, w * 1.0002599790341200 + c * 0.1541081190018780 + m * 0.8158416850864860 + y * 0.9862777767586430 + r * 0.8470554052720110 + g * 0.1855741036663030 + b * 0.0139594356366992);
  R[23] = max(SPECTRAL_EPSILON, w * 1.0003557969708900 + c * 0.0574575093228929 + m * 0.9128177041239760 + y * 0.9858605924440560 + r * 0.9431854093939180 + g * 0.0881774959955372 + b * 0.0144434255753570);
  R[24] = max(SPECTRAL_EPSILON, w * 1.0004275378026900 + c * 0.0315349873107007 + m * 0.9463398301669620 + y * 0.9854749276762100 + r * 0.9688621506965580 + g * 0.0543630228766700 + b * 0.0148854440621406);
  R[25] = max(SPECTRAL_EPSILON, w * 1.0004762334488800 + c * 0.0222633920086335 + m * 0.9599276963319910 + y * 0.9851769347655580 + r * 0.9780306674736030 + g * 0.0406288447060719 + b * 0.0152254296999746);
  R[26] = max(SPECTRAL_EPSILON, w * 1.0005072096750800 + c * 0.0182022841492439 + m * 0.9662605952303120 + y * 0.9849715740141810 + r * 0.9820436438543060 + g * 0.0342215204316970 + b * 0.0154592848180209);
  R[27] = max(SPECTRAL_EPSILON, w * 1.0005251915637300 + c * 0.0162990559732640 + m * 0.9693259700584240 + y * 0.9848463034157120 + r * 0.9839236237187070 + g * 0.0311185790956966 + b * 0.0156018026485961);
  R[28] = max(SPECTRAL_EPSILON, w * 1.0005350960689600 + c * 0.0153656239334613 + m * 0.9708545367213990 + y * 0.9847753518111990 + r * 0.9848454841543820 + g * 0.0295708898336134 + b * 0.0156824871281936);
  R[29] = max(SPECTRAL_EPSILON, w * 1.0005402209748200 + c * 0.0149111568733976 + m * 0.9716050665281280 + y * 0.9847380666252650 + r * 0.9852942758145960 + g * 0.0288108739348928 + b * 0.0157248764360615);
  R[30] = max(SPECTRAL_EPSILON, w * 1.0005427281678400 + c * 0.0146954339898235 + m * 0.9719627697573920 + y * 0.9847196483117650 + r * 0.9855072952198250 + g * 0.0284486271324597 + b * 0.0157458108784121);
  R[31] = max(SPECTRAL_EPSILON, w * 1.0005438956908700 + c * 0.0145964146717719 + m * 0.9721272722745090 + y * 0.9847110233919390 + r * 0.9856050715398370 + g * 0.0282820301724731 + b * 0.0157556123350225);
  R[32] = max(SPECTRAL_EPSILON, w * 1.0005444821215100 + c * 0.0145470156699655 + m * 0.9722094177458120 + y * 0.9847066833006760 + r * 0.9856538499335780 + g * 0.0281988376490237 + b * 0.0157605443964911);
  R[33] = max(SPECTRAL_EPSILON, w * 1.0005447695999200 + c * 0.0145228771899495 + m * 0.9722495776784240 + y * 0.9847045543930910 + r * 0.9856776850338830 + g * 0.0281581655342037 + b * 0.0157629637515278);
  R[34] = max(SPECTRAL_EPSILON, w * 1.0005448988776200 + c * 0.0145120341118965 + m * 0.9722676219987420 + y * 0.9847035963093700 + r * 0.9856883918061220 + g * 0.0281398910216386 + b * 0.0157640525629106);
  R[35] = max(SPECTRAL_EPSILON, w * 1.0005449625468900 + c * 0.0145066940939832 + m * 0.9722765094621500 + y * 0.9847031240775520 + r * 0.9856936646900310 + g * 0.0281308901665811 + b * 0.0157645892329510);
  R[36] = max(SPECTRAL_EPSILON, w * 1.0005449892705800 + c * 0.0145044507314479 + m * 0.9722802433068740 + y * 0.9847029256150900 + r * 0.9856958798482050 + g * 0.0281271086805816 + b * 0.0157648147772649);
  R[37] = max(SPECTRAL_EPSILON, w * 1.0005449969930000 + c * 0.0145038009464639 + m * 0.9722813248265600 + y * 0.9847028681227950 + r * 0.9856965214637620 + g * 0.0281260133612096 + b * 0.0157648801149616);
}

vec3 spectral_xyz_to_srgb(vec3 xyz) {
  mat3 XYZ_RGB;

  XYZ_RGB[0] = vec3( 3.2409699419045200, -1.537383177570090, -0.4986107602930030);
  XYZ_RGB[1] = vec3(-0.9692436362808790,  1.875967501507720,  0.0415550574071756);
  XYZ_RGB[2] = vec3( 0.0556300796969936, -0.203976958888976,  1.0569715142428700);
  
  float r = dot(XYZ_RGB[0], xyz);
  float g = dot(XYZ_RGB[1], xyz);
  float b = dot(XYZ_RGB[2], xyz);

  return spectral_linear_to_srgb(vec3(r, g, b));
}

vec3 spectral_reflectance_to_xyz(float R[SPECTRAL_SIZE]) {
  vec3 xyz = vec3(0.);
  
  xyz += R[ 0] * vec3(0.0000646919989576, 0.0000018442894440, 0.0003050171476380);
  xyz += R[ 1] * vec3(0.0002194098998132, 0.0000062053235865, 0.0010368066663574);
  xyz += R[ 2] * vec3(0.0011205743509343, 0.0000310096046799, 0.0053131363323992);
  xyz += R[ 3] * vec3(0.0037666134117111, 0.0001047483849269, 0.0179543925899536);
  xyz += R[ 4] * vec3(0.0118805536037990, 0.0003536405299538, 0.0570775815345485);
  xyz += R[ 5] * vec3(0.0232864424191771, 0.0009514714056444, 0.1136516189362870);
  xyz += R[ 6] * vec3(0.0345594181969747, 0.0022822631748318, 0.1733587261835500);
  xyz += R[ 7] * vec3(0.0372237901162006, 0.0042073290434730, 0.1962065755586570);
  xyz += R[ 8] * vec3(0.0324183761091486, 0.0066887983719014, 0.1860823707062960);
  xyz += R[ 9] * vec3(0.0212332056093810, 0.0098883960193565, 0.1399504753832070);
  xyz += R[10] * vec3(0.0104909907685421, 0.0152494514496311, 0.0891745294268649);
  xyz += R[11] * vec3(0.0032958375797931, 0.0214183109449723, 0.0478962113517075);
  xyz += R[12] * vec3(0.0005070351633801, 0.0334229301575068, 0.0281456253957952);
  xyz += R[13] * vec3(0.0009486742057141, 0.0513100134918512, 0.0161376622950514);
  xyz += R[14] * vec3(0.0062737180998318, 0.0704020839399490, 0.0077591019215214);
  xyz += R[15] * vec3(0.0168646241897775, 0.0878387072603517, 0.0042961483736618);
  xyz += R[16] * vec3(0.0286896490259810, 0.0942490536184085, 0.0020055092122156);
  xyz += R[17] * vec3(0.0426748124691731, 0.0979566702718931, 0.0008614711098802);
  xyz += R[18] * vec3(0.0562547481311377, 0.0941521856862608, 0.0003690387177652);
  xyz += R[19] * vec3(0.0694703972677158, 0.0867810237486753, 0.0001914287288574);
  xyz += R[20] * vec3(0.0830531516998291, 0.0788565338632013, 0.0001495555858975);
  xyz += R[21] * vec3(0.0861260963002257, 0.0635267026203555, 0.0000923109285104);
  xyz += R[22] * vec3(0.0904661376847769, 0.0537414167568200, 0.0000681349182337);
  xyz += R[23] * vec3(0.0850038650591277, 0.0426460643574120, 0.0000288263655696);
  xyz += R[24] * vec3(0.0709066691074488, 0.0316173492792708, 0.0000157671820553);
  xyz += R[25] * vec3(0.0506288916373645, 0.0208852059213910, 0.0000039406041027);
  xyz += R[26] * vec3(0.0354739618852640, 0.0138601101360152, 0.0000015840125870);
  xyz += R[27] * vec3(0.0214682102597065, 0.0081026402038399, 0.0000000000000000);
  xyz += R[28] * vec3(0.0125164567619117, 0.0046301022588030, 0.0000000000000000);
  xyz += R[29] * vec3(0.0068045816390165, 0.0024913800051319, 0.0000000000000000);
  xyz += R[30] * vec3(0.0034645657946526, 0.0012593033677378, 0.0000000000000000);
  xyz += R[31] * vec3(0.0014976097506959, 0.0005416465221680, 0.0000000000000000);
  xyz += R[32] * vec3(0.0007697004809280, 0.0002779528920067, 0.0000000000000000);
  xyz += R[33] * vec3(0.0004073680581315, 0.0001471080673854, 0.0000000000000000);
  xyz += R[34] * vec3(0.0001690104031614, 0.0000610327472927, 0.0000000000000000);
  xyz += R[35] * vec3(0.0000952245150365, 0.0000343873229523, 0.0000000000000000);
  xyz += R[36] * vec3(0.0000490309872958, 0.0000177059860053, 0.0000000000000000);
  xyz += R[37] * vec3(0.0000199961492222, 0.0000072209749130, 0.0000000000000000);

  return xyz;
}

float KS(float R) {
	return pow(1.0 - R, 2.0) / (2.0 * R);
}

float KM(float KS) {
  return 1.0 + KS - sqrt(pow(KS, 2.0) + 2.0 * KS);
}

vec3 spectral_mix(vec3 color1, float tintingStrength1, float factor1, vec3 color2, float tintingStrength2, float factor2) {
  vec3 lrgb1 = spectral_srgb_to_linear(color1);
  vec3 lrgb2 = spectral_srgb_to_linear(color2);

  float R1[SPECTRAL_SIZE];
  float R2[SPECTRAL_SIZE];

  spectral_linear_to_reflectance(lrgb1, R1);
  spectral_linear_to_reflectance(lrgb2, R2);

  float luminance1 = spectral_reflectance_to_xyz(R1)[1];
  float luminance2 = spectral_reflectance_to_xyz(R2)[1];

  float R[SPECTRAL_SIZE];

  for (int i = 0; i < SPECTRAL_SIZE; i++) {
    float concentration1 = pow(factor1, 2.) * pow(tintingStrength1, 2.) * luminance1;
    float concentration2 = pow(factor2, 2.) * pow(tintingStrength2, 2.) * luminance2;
		
		float totalConcentration = concentration1 + concentration2;
		
    float ksMix = 0.;
		
		ksMix += KS(R1[i]) * concentration1;
		ksMix += KS(R2[i]) * concentration2;

    R[i] = KM(ksMix / totalConcentration);
  }

  return spectral_xyz_to_srgb(spectral_reflectance_to_xyz(R));
}

vec3 spectral_mix(vec3 color1, vec3 color2, float factor) {
	return spectral_mix(color1, 1., 1. - factor, color2, 1., factor);
}

vec3 spectral_mix(vec3 color1, float factor1, vec3 color2, float factor2) {
	return spectral_mix(color1, 1., factor1, color2, 1., factor2);
}

vec3 spectral_mix(vec3 color1, float tintingStrength1, float factor1, vec3 color2, float tintingStrength2, float factor2, vec3 color3, float tintingStrength3, float factor3) {
  vec3 lrgb1 = spectral_srgb_to_linear(color1);
  vec3 lrgb2 = spectral_srgb_to_linear(color2);
  vec3 lrgb3 = spectral_srgb_to_linear(color3);

  float R1[SPECTRAL_SIZE];
  float R2[SPECTRAL_SIZE];
  float R3[SPECTRAL_SIZE];

  spectral_linear_to_reflectance(lrgb1, R1);
  spectral_linear_to_reflectance(lrgb2, R2);
  spectral_linear_to_reflectance(lrgb3, R3);

  float luminance1 = spectral_reflectance_to_xyz(R1)[1];
  float luminance2 = spectral_reflectance_to_xyz(R2)[1];
  float luminance3 = spectral_reflectance_to_xyz(R3)[1];

  float R[SPECTRAL_SIZE];

  for (int i = 0; i < SPECTRAL_SIZE; i++) {
    float concentration1 = pow(factor1, 2.) * pow(tintingStrength1, 2.) * luminance1;
    float concentration2 = pow(factor2, 2.) * pow(tintingStrength2, 2.) * luminance2;
    float concentration3 = pow(factor3, 2.) * pow(tintingStrength3, 2.) * luminance3;
		
		float totalConcentration = concentration1 + concentration2 + concentration3;
		
    float ksMix = 0.;
		
		ksMix += KS(R1[i]) * concentration1;
		ksMix += KS(R2[i]) * concentration2;
		ksMix += KS(R3[i]) * concentration3;

    R[i] = KM(ksMix / totalConcentration);
  }

  return spectral_xyz_to_srgb(spectral_reflectance_to_xyz(R));
}

vec3 spectral_mix(vec3 color1, float factor1, vec3 color2, float factor2, vec3 color3, float factor3) {
	return spectral_mix(color1, 1., factor1, color2, 1., factor2, color3, 1., factor3);
}

vec3 spectral_mix(vec3 color1, float tintingStrength1, float factor1, vec3 color2, float tintingStrength2, float factor2, vec3 color3, float tintingStrength3, float factor3, vec3 color4, float tintingStrength4, float factor4) {
  vec3 lrgb1 = spectral_srgb_to_linear(color1);
  vec3 lrgb2 = spectral_srgb_to_linear(color2);
  vec3 lrgb3 = spectral_srgb_to_linear(color3);
  vec3 lrgb4 = spectral_srgb_to_linear(color4);

  float R1[SPECTRAL_SIZE];
  float R2[SPECTRAL_SIZE];
  float R3[SPECTRAL_SIZE];
  float R4[SPECTRAL_SIZE];

  spectral_linear_to_reflectance(lrgb1, R1);
  spectral_linear_to_reflectance(lrgb2, R2);
  spectral_linear_to_reflectance(lrgb3, R3);
  spectral_linear_to_reflectance(lrgb4, R4);

  float luminance1 = spectral_reflectance_to_xyz(R1)[1];
  float luminance2 = spectral_reflectance_to_xyz(R2)[1];
  float luminance3 = spectral_reflectance_to_xyz(R3)[1];
  float luminance4 = spectral_reflectance_to_xyz(R4)[1];

  float R[SPECTRAL_SIZE];

  for (int i = 0; i < SPECTRAL_SIZE; i++) {
    float concentration1 = pow(factor1, 2.) * pow(tintingStrength1, 2.) * luminance1;
    float concentration2 = pow(factor2, 2.) * pow(tintingStrength2, 2.) * luminance2;
    float concentration3 = pow(factor3, 2.) * pow(tintingStrength3, 2.) * luminance3;
    float concentration4 = pow(factor4, 2.) * pow(tintingStrength4, 2.) * luminance4;
		
		float totalConcentration = concentration1 + concentration2 + concentration3 + concentration4;
		
    float ksMix = 0.;
		
		ksMix += KS(R1[i]) * concentration1;
		ksMix += KS(R2[i]) * concentration2;
		ksMix += KS(R3[i]) * concentration3;
		ksMix += KS(R4[i]) * concentration4;

    R[i] = KM(ksMix / totalConcentration);
  }

  return spectral_xyz_to_srgb(spectral_reflectance_to_xyz(R));
}

vec3 spectral_mix(vec3 color1, float factor1, vec3 color2, float factor2, vec3 color3, float factor3, vec3 color4, float factor4) {
	return spectral_mix(color1, 1., factor1, color2, 1., factor2, color3, 1., factor3, color4, 1., factor4);
}

#endif


uniform sampler2D u_gradientTex;         // Background B&W gradient
uniform sampler2D u_fadedTrailTex;       // Sharp, faded trails (alpha from black circle)
uniform sampler2D u_blurredTrailGlowTex; // Blurred version for bloom (alpha from black circle)

uniform vec3 u_colorA; // Gradient color 1 (e.g., Red)
uniform vec3 u_colorB; // Gradient color 2 (e.g., Yellow)
uniform vec3 u_colorC; // Color for the "core" element/trail (e.g., Black)
uniform vec3 u_colorD; // Color for the "bloom" effect (e.g., Blue)

uniform float u_flipY;
varying vec2 v_texCoord;

void main() {
    vec2 texCoord = v_texCoord;
    if (u_flipY > 0.5) { // Flip if drawing to screen
        texCoord.y = 1.0 - texCoord.y;
    }

    vec4 gradientSample = texture2D(u_gradientTex, texCoord);
    vec4 fadedTrailAlphaSample = texture2D(u_fadedTrailTex, texCoord);     // RGB is (0,0,0) if trail was black
    vec4 blurredTrailAlphaSample = texture2D(u_blurredTrailGlowTex, texCoord); // RGB is (0,0,0) if trail was black

    // 1. Determine base color from the gradient
    vec3 baseColor = mix(u_colorA, u_colorB, gradientSample.b);

    // 2. Alpha-blend the core trail color (u_colorC) onto the baseColor.
    // The visibility of u_colorC is determined by fadedTrailAlphaSample.a.
    vec3 blendedCoreTrailColor = mix(baseColor, u_colorC, fadedTrailAlphaSample.a);

    // 3. Additively blend the bloom effect on top.
    // The bloom color (u_colorD) is scaled by blurredTrailAlphaSample.a.
    vec3 finalColor = blendedCoreTrailColor + (u_colorD * blurredTrailAlphaSample.a);

    // Clamp final color to [0, 1] range (important for additive blending)
    finalColor = clamp(finalColor, 0.0, 1.0);

    gl_FragColor = vec4(finalColor, 1.0); // Output to screen is always opaque
}`,a0=`precision mediump float;
uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_blurRadius;
uniform float u_time;
uniform bool u_flipY;
uniform float u_fadeFactor;
varying vec2 v_texCoord;

void main() {
    // Flip Y coordinate if requested
    vec2 sampleCoord = v_texCoord;
    if (u_flipY) {
        sampleCoord.y = 1.0 - sampleCoord.y;
    }
    vec2 onePixel = vec2(1.0, 1.0) / u_resolution;
    
    // Calculate displacement using both time and x position
    float timeOffset = cos(sampleCoord.x * 20.0) * 2.0; // Spatial variation
    float displacement = 0.0 * cos((u_time + timeOffset) * 2.0 * 3.14159 / 10.0);
    vec2 offset = vec2(0.0, displacement) * onePixel;

    // Add offset to sampleCoord
    sampleCoord += offset;

    // 5x5 Gaussian kernel weights with displaced sampling
    vec4 colorSum = 
        // Row 1
        texture2D(u_image, sampleCoord + onePixel * vec2(-2, -2) * u_blurRadius) * 0.003765 +
        texture2D(u_image, sampleCoord + onePixel * vec2(-1, -2) * u_blurRadius) * 0.015019 +
        texture2D(u_image, sampleCoord + onePixel * vec2( 0, -2) * u_blurRadius) * 0.023792 +
        texture2D(u_image, sampleCoord + onePixel * vec2( 1, -2) * u_blurRadius) * 0.015019 +
        texture2D(u_image, sampleCoord + onePixel * vec2( 2, -2) * u_blurRadius) * 0.003765 +
        
        // Row 2
        texture2D(u_image, sampleCoord + onePixel * vec2(-2, -1) * u_blurRadius) * 0.015019 +
        texture2D(u_image, sampleCoord + onePixel * vec2(-1, -1) * u_blurRadius) * 0.059912 +
        texture2D(u_image, sampleCoord + onePixel * vec2( 0, -1) * u_blurRadius) * 0.094907 +
        texture2D(u_image, sampleCoord + onePixel * vec2( 1, -1) * u_blurRadius) * 0.059912 +
        texture2D(u_image, sampleCoord + onePixel * vec2( 2, -1) * u_blurRadius) * 0.015019 +
        
        // Row 3 (center)
        texture2D(u_image, sampleCoord + onePixel * vec2(-2,  0) * u_blurRadius) * 0.023792 +
        texture2D(u_image, sampleCoord + onePixel * vec2(-1,  0) * u_blurRadius) * 0.094907 +
        texture2D(u_image, sampleCoord + onePixel * vec2( 0,  0) * u_blurRadius) * 0.150342 +
        texture2D(u_image, sampleCoord + onePixel * vec2( 1,  0) * u_blurRadius) * 0.094907 +
        texture2D(u_image, sampleCoord + onePixel * vec2( 2,  0) * u_blurRadius) * 0.023792 +
        
        // Row 4
        texture2D(u_image, sampleCoord + onePixel * vec2(-2,  1) * u_blurRadius) * 0.015019 +
        texture2D(u_image, sampleCoord + onePixel * vec2(-1,  1) * u_blurRadius) * 0.059912 +
        texture2D(u_image, sampleCoord + onePixel * vec2( 0,  1) * u_blurRadius) * 0.094907 +
        texture2D(u_image, sampleCoord + onePixel * vec2( 1,  1) * u_blurRadius) * 0.059912 +
        texture2D(u_image, sampleCoord + onePixel * vec2( 2,  1) * u_blurRadius) * 0.015019 +
        
        // Row 5
        texture2D(u_image, sampleCoord + onePixel * vec2(-2,  2) * u_blurRadius) * 0.003765 +
        texture2D(u_image, sampleCoord + onePixel * vec2(-1,  2) * u_blurRadius) * 0.015019 +
        texture2D(u_image, sampleCoord + onePixel * vec2( 0,  2) * u_blurRadius) * 0.023792 +
        texture2D(u_image, sampleCoord + onePixel * vec2( 1,  2) * u_blurRadius) * 0.015019 +
        texture2D(u_image, sampleCoord + onePixel * vec2( 2,  2) * u_blurRadius) * 0.003765;

    gl_FragColor = colorSum - (1.0 - u_fadeFactor);
}
`,i0=`    precision mediump float;
    uniform sampler2D u_image;
    uniform float u_fadeFactor;
    varying vec2 v_texCoord;
    void main() {
        gl_FragColor = texture2D(u_image, v_texCoord) - (1.0 - u_fadeFactor);
    }`,c0=`    precision mediump float;
    uniform sampler2D u_image;
    varying vec2 v_texCoord;
    void main() {
        gl_FragColor = texture2D(u_image, v_texCoord);
    }`,l0=`precision mediump float;
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
}`,s0=t=>{const r=_0(t);return{noise2D:(o,i)=>u0(r,o,i),noise3D:(o,i,a)=>f0(r,o,i,a),noise4D:(o,i,a,n)=>m0(r,o,i,a,n)}},u0=(t,r,o)=>{const{perm:i,permMod12:a}=t;let n=0,E=0,p=0;var j=(r+o)*E0,z=Math.floor(r+j),G=Math.floor(o+j),y=(z+G)*Ie;const N=z-y,I=G-y,x=r-N,C=o-I,Y=x>C?1:0,ie=x>C?0:1,b=x-Y+Ie,h=C-ie+Ie,A=x-1+2*Ie,c=C-1+2*Ie,l=z&255,s=G&255;let u=.5-x*x-C*C;if(u>=0){const m=a[l+i[s]]*3;u*=u,n=u*u*(S[m]*x+S[m+1]*C)}let d=.5-b*b-h*h;if(d>=0){const m=a[l+Y+i[s+ie]]*3;d*=d,E=d*d*(S[m]*b+S[m+1]*h)}let f=.5-A*A-c*c;if(f>=0){const m=a[l+1+i[s+1]]*3;f*=f,p=f*f*(S[m]*A+S[m+1]*c)}return 70*(n+E+p)},f0=(t,r,o,i)=>{const{perm:a,permMod12:n}=t;let E=0,p=0,j=0,z=0;const G=(r+o+i)*d0,y=Math.floor(r+G),N=Math.floor(o+G),I=Math.floor(i+G),x=(y+N+I)*Q,C=y-x,Y=N-x,ie=I-x,b=r-C,h=o-Y,A=i-ie;let c,l,s,u,d,f;b>=h?h>=A?(c=1,l=0,s=0,u=1,d=1,f=0):b>=A?(c=1,l=0,s=0,u=1,d=0,f=1):(c=0,l=0,s=1,u=1,d=0,f=1):h<A?(c=0,l=0,s=1,u=0,d=1,f=1):b<A?(c=0,l=1,s=0,u=0,d=1,f=1):(c=0,l=1,s=0,u=1,d=1,f=0);const m=b-c+Q,H=h-l+Q,k=A-s+Q,q=b-u+2*Q,B=h-d+2*Q,M=A-f+2*Q,X=b-1+3*Q,oe=h-1+3*Q,ne=A-1+3*Q,$=y&255,J=N&255,U=I&255;let W=.6-b*b-h*h-A*A;if(W>=0){const v=n[$+a[J+a[U]]]*3;W*=W,E=W*W*(S[v]*b+S[v+1]*h+S[v+2]*A)}let V=.6-m*m-H*H-k*k;if(V>=0){const v=n[$+c+a[J+l+a[U+s]]]*3;V*=V,p=V*V*(S[v]*m+S[v+1]*H+S[v+2]*k)}let Z=.6-q*q-B*B-M*M;if(Z>=0){const v=n[$+u+a[J+d+a[U+f]]]*3;Z*=Z,j=Z*Z*(S[v]*q+S[v+1]*B+S[v+2]*M)}let K=.6-X*X-oe*oe-ne*ne;if(K>=0){var ae=n[$+1+a[J+1+a[U+1]]]*3;K*=K,z=K*K*(S[ae]*X+S[ae+1]*oe+S[ae+2]*ne)}return 32*(E+p+j+z)},m0=(t,r,o,i,a)=>{const{perm:n}=t;let E=0,p=0,j=0,z=0,G=0;const y=(r+o+i+a)*R0,N=Math.floor(r+y),I=Math.floor(o+y),x=Math.floor(i+y),C=Math.floor(a+y),Y=(N+I+x+C)*g,ie=N-Y,b=I-Y,h=x-Y,A=C-Y,c=r-ie,l=o-b,s=i-h,u=a-A;let d=0,f=0,m=0,H=0;c>l?d++:f++,c>s?d++:m++,c>u?d++:H++,l>s?f++:m++,l>u?f++:H++,s>u?m++:H++;let k,q,B,M,X,oe,ne,$,J,U,W,V;k=d>=3?1:0,q=f>=3?1:0,B=m>=3?1:0,M=H>=3?1:0,X=d>=2?1:0,oe=f>=2?1:0,ne=m>=2?1:0,$=H>=2?1:0,J=d>=1?1:0,U=f>=1?1:0,W=m>=1?1:0,V=H>=1?1:0;const Z=c-k+g,K=l-q+g,ae=s-B+g,v=u-M+g,pe=c-X+2*g,Ae=l-oe+2*g,Se=s-ne+2*g,Re=u-$+2*g,Xe=c-J+3*g,be=l-U+3*g,He=s-W+3*g,ke=u-V+3*g,We=c-1+4*g,Ve=l-1+4*g,Ze=s-1+4*g,Ke=u-1+4*g,he=N&255,ve=I&255,ge=x&255,Pe=C&255;let Ce=.6-c*c-l*l-s*s-u*u;if(Ce>=0){const _=n[he+n[ve+n[ge+n[Pe]]]]%32*4;Ce*=Ce,E=Ce*Ce*(T[_]*c+T[_+1]*l+T[_+2]*s+T[_+3]*u)}let we=.6-Z*Z-K*K-ae*ae-v*v;if(we>=0){const _=n[he+k+n[ve+q+n[ge+B+n[Pe+M]]]]%32*4;we*=we,p=we*we*(T[_]*Z+T[_+1]*K+T[_+2]*ae+T[_+3]*v)}let Le=.6-pe*pe-Ae*Ae-Se*Se-Re*Re;if(Le>=0){const _=n[he+X+n[ve+oe+n[ge+ne+n[Pe+$]]]]%32*4;Le*=Le,j=Le*Le*(T[_]*pe+T[_+1]*Ae+T[_+2]*Se+T[_+3]*Re)}let Fe=.6-Xe*Xe-be*be-He*He-ke*ke;if(Fe>=0){const _=n[he+J+n[ve+U+n[ge+W+n[Pe+V]]]]%32*4;Fe*=Fe,z=Fe*Fe*(T[_]*Xe+T[_+1]*be+T[_+2]*He+T[_+3]*ke)}let ye=.6-We*We-Ve*Ve-Ze*Ze-Ke*Ke;if(ye>=0){const _=n[he+1+n[ve+1+n[ge+1+n[Pe+1]]]]%32*4;ye*=ye,G=ye*ye*(T[_]*We+T[_+1]*Ve+T[_+2]*Ze+T[_+3]*Ke)}return 27*(E+p+j+z+G)},_0=t=>{const r=new Uint8Array(512),o=new Uint8Array(512),i=new Uint8Array(256);for(let n=0;n<256;n++)i[n]=n;for(let n=0;n<255;n++){const E=n+~~(t()*(256-n)),p=i[E];i[E]=i[n],r[n]=r[n+256]=p,o[n]=o[n+256]=p%12}const a=i[255];return r[255]=r[511]=a,o[255]=o[511]=a%12,{perm:r,permMod12:o}},E0=.5*(Math.sqrt(3)-1),Ie=(3-Math.sqrt(3))/6,d0=1/3,Q=1/6,R0=(Math.sqrt(5)-1)/4,g=(5-Math.sqrt(5))/20,S=new Float32Array([1,1,0,-1,1,0,1,-1,0,-1,-1,0,1,0,1,-1,0,1,1,0,-1,-1,0,-1,0,1,1,0,-1,1,0,1,-1,0,-1,-1]),T=new Float32Array([0,1,1,1,0,1,1,-1,0,1,-1,1,0,1,-1,-1,0,-1,1,1,0,-1,1,-1,0,-1,-1,1,0,-1,-1,-1,1,0,1,1,1,0,1,-1,1,0,-1,1,1,0,-1,-1,-1,0,1,1,-1,0,1,-1,-1,0,-1,1,-1,0,-1,-1,1,1,0,1,1,1,0,-1,1,-1,0,1,1,-1,0,-1,-1,1,0,1,-1,1,0,-1,-1,-1,0,1,-1,-1,0,-1,1,1,1,0,1,1,-1,0,1,-1,1,0,1,-1,-1,0,-1,1,1,0,-1,1,-1,0,-1,-1,1,0,-1,-1,-1,0]);let je=0,e,se,Ye,te,re,ee,D,ue,fe,me,_e,Ee,De,ze,Be,ce,de,qe=60,Me=!1,Ge=0,Oe=null;const T0=9360,x0=8,$e=1,p0=.995,A0=.97;let S0=0,b0=1.1,h0=.8,v0=.4,g0=96,P0=1,C0=.25,w0=2.5,L0=.2;const F0=3.25,y0=2.75,Je=300,I0=.35;let U0="#000000",D0="#0044CC";const O0="#FFFF00",N0="#8800FF",B0=1,M0=.2,Qe=3,e0=550,X0=.2,z0=1.5,t0=.8,r0=.6;function G0(t){return t.toString().padStart(6,"0")}let R,L,P,F,O,w,le,Ue,Ne;function Y0(t){const r=t.getContext("webgl",{alpha:!0,preserveDrawingBuffer:!0});if(!r)throw new Error("WebGL not supported");e=r,e.enable(e.BLEND),e.blendFunc(e.SRC_ALPHA,e.ONE_MINUS_SRC_ALPHA);const o=new Float32Array([-1,-1,1,-1,-1,1,1,1]);if(te=e.createBuffer(),!te)throw new Error("Failed to create position buffer");e.bindBuffer(e.ARRAY_BUFFER,te),e.bufferData(e.ARRAY_BUFFER,o,e.STATIC_DRAW);const i=new Float32Array([0,0,1,0,0,1,1,1]);if(re=e.createBuffer(),!re)throw new Error("Failed to create texCoord buffer");if(e.bindBuffer(e.ARRAY_BUFFER,re),e.bufferData(e.ARRAY_BUFFER,i,e.STATIC_DRAW),se=e.createTexture(),!se)throw new Error("Failed to create frameTexture");if(e.bindTexture(e.TEXTURE_2D,se),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),ue=e.createTexture(),!ue)throw new Error("Failed to create currentFrameElementsTexture");if(e.bindTexture(e.TEXTURE_2D,ue),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),fe=e.createTexture(),!fe)throw new Error("Failed to create blurredElementsTexture");if(e.bindTexture(e.TEXTURE_2D,fe),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),me=e.createTexture(),!me)throw new Error("Failed to create tempBlurTexture");if(e.bindTexture(e.TEXTURE_2D,me),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),Ye=e.createFramebuffer(),!Ye)throw new Error("Failed to create framebuffer");if(de=e.createFramebuffer(),!de)throw new Error("Failed to create blurFramebuffer");if(_e=e.createTexture(),!_e)throw new Error("Failed to create elementsAccumulationTextureA");if(e.bindTexture(e.TEXTURE_2D,_e),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),Ee=e.createTexture(),!Ee)throw new Error("Failed to create elementsAccumulationTextureB");if(e.bindTexture(e.TEXTURE_2D,Ee),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),Be=e.createFramebuffer(),!Be)throw new Error("Failed to create accumulationFramebuffer");if(ce=e.createTexture(),!ce)throw new Error("Failed to create blurProcessInputHolderTexture");e.bindTexture(e.TEXTURE_2D,ce),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,e.LINEAR),e.bindTexture(e.TEXTURE_2D,null),e.bindFramebuffer(e.FRAMEBUFFER,null)}function H0({canvasWebGL:t}){Y0(t),Ne=s0(Math.random),ee=document.createElement("canvas"),ee.width=t.width,ee.height=t.height;const r=ee.getContext("2d");if(!r)throw new Error("Failed to get 2D context for elements canvas");D=r,e.bindTexture(e.TEXTURE_2D,se),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,t.width,t.height,0,e.RGBA,e.UNSIGNED_BYTE,null),e.bindTexture(e.TEXTURE_2D,ue),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,t.width,t.height,0,e.RGBA,e.UNSIGNED_BYTE,null),e.bindTexture(e.TEXTURE_2D,fe),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,t.width,t.height,0,e.RGBA,e.UNSIGNED_BYTE,null),e.bindTexture(e.TEXTURE_2D,me),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,t.width,t.height,0,e.RGBA,e.UNSIGNED_BYTE,null),e.bindTexture(e.TEXTURE_2D,_e),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,t.width,t.height,0,e.RGBA,e.UNSIGNED_BYTE,null),e.bindTexture(e.TEXTURE_2D,Ee),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,t.width,t.height,0,e.RGBA,e.UNSIGNED_BYTE,null),e.bindTexture(e.TEXTURE_2D,ce),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,t.width,t.height,0,e.RGBA,e.UNSIGNED_BYTE,null),e.bindTexture(e.TEXTURE_2D,null),De=_e,ze=Ee,K0(e),j0(e),q0(e),$0(e),J0(e),Q0(e),e.bindFramebuffer(e.FRAMEBUFFER,de),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,fe,0),e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,me,0),e.clear(e.COLOR_BUFFER_BIT),e.bindFramebuffer(e.FRAMEBUFFER,Be),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,_e,0),e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,Ee,0),e.clear(e.COLOR_BUFFER_BIT),e.bindFramebuffer(e.FRAMEBUFFER,de),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,ce,0),e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT),e.bindFramebuffer(e.FRAMEBUFFER,null)}function k0({canvasWebGL:t}){if(!e||!Ye||!se||!ee||!D||!ue||!_e||!Ee||!Be||!ce||!de||!fe||!me||!te||!re||!R||!L||!P||!F||!w||!O)throw new Error("Context or critical resources not initialized");const r=t.width,o=t.height,i=je/qe;e.bindFramebuffer(e.FRAMEBUFFER,Ye),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,se,0),e.viewport(0,0,r,o),e.useProgram(R);const a=Te("#000000"),n=Te("#FFFFFF");e.uniform3fv(e.getUniformLocation(R,"u_colorA"),a),e.uniform3fv(e.getUniformLocation(R,"u_colorB"),n),e.uniform1f(e.getUniformLocation(R,"u_time"),i),e.uniform1f(e.getUniformLocation(R,"u_noiseCenter"),S0),e.uniform1f(e.getUniformLocation(R,"u_noiseWidth"),b0),e.uniform1f(e.getUniformLocation(R,"u_noiseAmplitude"),h0),e.uniform1f(e.getUniformLocation(R,"u_noiseSpeed"),v0),e.uniform1f(e.getUniformLocation(R,"u_noiseScale"),g0),e.uniform1f(e.getUniformLocation(R,"u_noiseOffsetScale"),P0),e.uniform1f(e.getUniformLocation(R,"u_waveAmplitude"),C0),e.uniform1f(e.getUniformLocation(R,"u_waveXScale"),w0),e.uniform1f(e.getUniformLocation(R,"u_waveTimeScale"),L0),e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT),e.drawArrays(e.TRIANGLE_STRIP,0,4),D.clearRect(0,0,ee.width,ee.height);const E=ee.width/2,p=ee.height/2,j=Je,z=Je,y=1/qe*M0;D.lineWidth=Qe;for(let c=0;c<B0;c++){const l=i+c*y,s=l*I0,u=F0*s+Math.PI/2,d=y0*s,f=j*Math.sin(u),m=z*Math.sin(d),k=Math.round(255*(1-0)),q=`rgb(${k},${k},${k})`;if(D.strokeStyle=q,Math.abs(f)>.01||Math.abs(m)>.01){const B=f/e0,M=m/e0,X=l*X0;let oe=Ne.noise3D(B,M,X),ne=Ne.noise3D(B+10.3,M+20.7,X+5.1),$=Ne.noise3D(B+30.5,M+40.1,X+15.9),J=Ne.noise3D(B+50.2,M+60.8,X+25.4);const U=(Se,Re)=>{const be=(Se+1)/2*z0;return(1-Re)*1+Re*be},W=U(oe,t0),V=U(ne,t0),Z=U($,r0),K=U(J,r0),ae=E+f*W,v=p+m*V,pe=E+f*Z,Ae=p+m*K;D.beginPath(),D.moveTo(ae,v),D.lineTo(pe,Ae),D.stroke()}else D.fillStyle=q,D.beginPath(),D.arc(E,p,Qe/2,0,Math.PI*2),D.fill()}e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,ue),e.texImage2D(e.TEXTURE_2D,0,e.RGBA,e.RGBA,e.UNSIGNED_BYTE,ee),e.bindFramebuffer(e.FRAMEBUFFER,Be),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,ze,0),e.viewport(0,0,r,o),e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT),e.useProgram(F),e.uniform1f(e.getUniformLocation(F,"u_fadeFactor"),p0),e.uniform1f(e.getUniformLocation(F,"u_flipY"),0),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,De),e.uniform1i(e.getUniformLocation(F,"u_image"),0),e.drawArrays(e.TRIANGLE_STRIP,0,4),e.useProgram(O),e.uniform1f(e.getUniformLocation(O,"u_flipY"),0),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,ue),e.uniform1i(e.getUniformLocation(O,"u_image"),0),e.enable(e.BLEND),e.blendFunc(e.SRC_ALPHA,e.ONE_MINUS_SRC_ALPHA),e.drawArrays(e.TRIANGLE_STRIP,0,4),e.disable(e.BLEND),[De,ze]=[ze,De];const N=De;(!le||!Ue)&&(le=fe,Ue=me),e.bindFramebuffer(e.FRAMEBUFFER,de),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,ce,0),e.viewport(0,0,r,o),e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT),e.useProgram(w),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,N),e.uniform1i(e.getUniformLocation(w,"u_newContributionTex"),0),e.activeTexture(e.TEXTURE1),e.bindTexture(e.TEXTURE_2D,le),e.uniform1i(e.getUniformLocation(w,"u_previousGlowTex"),1),e.uniform1f(e.getUniformLocation(w,"u_glowPersistence"),A0),e.uniform1f(e.getUniformLocation(w,"u_flipY"),0),e.drawArrays(e.TRIANGLE_STRIP,0,4);let I=ce,x=le;const C=Ue;for(let c=0;c<$e;++c){const l=c===$e-1,s=l?C:x;e.bindFramebuffer(e.FRAMEBUFFER,de),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,s,0),e.viewport(0,0,r,o),e.clearColor(0,0,0,0),e.clear(e.COLOR_BUFFER_BIT),e.useProgram(L),e.uniform1f(e.getUniformLocation(L,"u_blurRadius"),x0),e.uniform1f(e.getUniformLocation(L,"u_fadeFactor"),1),e.uniform2f(e.getUniformLocation(L,"u_resolution"),r,o),e.uniform1f(e.getUniformLocation(L,"u_time"),i),e.uniform1f(e.getUniformLocation(L,"u_flipY"),0),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,I),e.uniform1i(e.getUniformLocation(L,"u_image"),0),e.drawArrays(e.TRIANGLE_STRIP,0,4),l||([I,x]=[x,I])}[le,Ue]=[Ue,le];const Y=le;e.bindFramebuffer(e.FRAMEBUFFER,null),e.viewport(0,0,r,o),e.useProgram(P),e.activeTexture(e.TEXTURE0),e.bindTexture(e.TEXTURE_2D,se),e.uniform1i(e.getUniformLocation(P,"u_gradientTex"),0),e.activeTexture(e.TEXTURE1),e.bindTexture(e.TEXTURE_2D,N),e.uniform1i(e.getUniformLocation(P,"u_fadedTrailTex"),1),e.activeTexture(e.TEXTURE2),e.bindTexture(e.TEXTURE_2D,Y),e.uniform1i(e.getUniformLocation(P,"u_blurredTrailGlowTex"),2);const ie=Te(U0),b=Te(D0),h=Te(O0),A=Te(N0);e.uniform3fv(e.getUniformLocation(P,"u_colorA"),ie),e.uniform3fv(e.getUniformLocation(P,"u_colorB"),b),e.uniform3fv(e.getUniformLocation(P,"u_colorC"),h),e.uniform3fv(e.getUniformLocation(P,"u_colorD"),A),e.uniform1f(e.getUniformLocation(P,"u_flipY"),1),e.clearColor(0,0,0,1),e.clear(e.COLOR_BUFFER_BIT),e.drawArrays(e.TRIANGLE_STRIP,0,4),je++}async function W0(){try{Oe=await window.showDirectoryPicker(),Ge=0,Me=!0,console.log("Starting render sequence...")}catch(t){console.error(t.name,t.message)}}async function V0(t){if(!Oe)return;const r=Ge;try{const o=`frame_${G0(r)}.png`,i=t.toDataURL("image/png"),n=await(await fetch(i)).blob(),p=await(await Oe.getFileHandle(o,{create:!0})).createWritable();await p.write(n),await p.close(),console.log(`Saved ${o}`),Ge=r+1,Ge>=T0&&(Me=!1,Oe=null,console.log("Render sequence complete!"))}catch(o){console.error("Failed to save frame:",o),Me=!1,Oe=null}}function Z0(t){async function r(){k0(t),Me?(await V0(t.canvasWebGL),Me&&requestAnimationFrame(r)):requestAnimationFrame(r)}const o=document.querySelector("#render-button");o==null||o.addEventListener("click",W0),H0(t),r()}function K0(t){const r=t.createShader(t.VERTEX_SHADER);if(!r)throw new Error("Couldn't create vertex shader");t.shaderSource(r,xe),t.compileShader(r);const o=t.createShader(t.FRAGMENT_SHADER);if(!o)throw new Error("Couldn't create fragment shader");t.shaderSource(o,o0),t.compileShader(o);const i=t.createProgram();if(!i)throw new Error("Couldn't create program");R=i,t.attachShader(R,r),t.attachShader(R,o),t.linkProgram(R),t.useProgram(R);const a=t.getAttribLocation(R,"a_position");t.enableVertexAttribArray(a),t.bindBuffer(t.ARRAY_BUFFER,te),t.vertexAttribPointer(a,2,t.FLOAT,!1,0,0);const n=t.getAttribLocation(R,"a_texCoord");t.enableVertexAttribArray(n),t.bindBuffer(t.ARRAY_BUFFER,re),t.vertexAttribPointer(n,2,t.FLOAT,!1,0,0)}function j0(t){const r=t.createShader(t.VERTEX_SHADER);if(!r)throw new Error("Couldn't create vertex shader for blur");t.shaderSource(r,xe),t.compileShader(r);const o=t.createShader(t.FRAGMENT_SHADER);if(!o)throw new Error("Couldn't create fragment shader for blur");t.shaderSource(o,a0),t.compileShader(o);const i=t.createProgram();if(!i)throw new Error("Couldn't create blur program");L=i,t.attachShader(L,r),t.attachShader(L,o),t.linkProgram(L),t.useProgram(L);const a=t.getAttribLocation(L,"a_position");t.enableVertexAttribArray(a),t.bindBuffer(t.ARRAY_BUFFER,te),t.vertexAttribPointer(a,2,t.FLOAT,!1,0,0);const n=t.getAttribLocation(L,"a_texCoord");t.enableVertexAttribArray(n),t.bindBuffer(t.ARRAY_BUFFER,re),t.vertexAttribPointer(n,2,t.FLOAT,!1,0,0)}function q0(t){const r=t.createShader(t.VERTEX_SHADER);if(!r)throw new Error("Couldn't create vertex shader for composite");t.shaderSource(r,xe),t.compileShader(r);const o=t.createShader(t.FRAGMENT_SHADER);if(!o)throw new Error("Couldn't create fragment shader for composite");t.shaderSource(o,n0),t.compileShader(o);const i=t.createProgram();if(!i)throw new Error("Couldn't create spectral composite program");P=i,t.attachShader(P,r),t.attachShader(P,o),t.linkProgram(P),t.useProgram(P);const a=t.getAttribLocation(P,"a_position");t.enableVertexAttribArray(a),t.bindBuffer(t.ARRAY_BUFFER,te),t.vertexAttribPointer(a,2,t.FLOAT,!1,0,0);const n=t.getAttribLocation(P,"a_texCoord");t.enableVertexAttribArray(n),t.bindBuffer(t.ARRAY_BUFFER,re),t.vertexAttribPointer(n,2,t.FLOAT,!1,0,0)}function Te(t){const r=parseInt(t.replace("#",""),16);return[(r>>16&255)/255,(r>>8&255)/255,(r&255)/255]}function $0(t){const r=t.createShader(t.VERTEX_SHADER);if(!r)throw new Error("Couldn't create vertex shader for element accumulation");if(t.shaderSource(r,xe),t.compileShader(r),!t.getShaderParameter(r,t.COMPILE_STATUS))throw console.error("Vertex shader (element_accumulation) compile error:",t.getShaderInfoLog(r)),new Error("Failed to compile element accumulation vertex shader");const o=t.createShader(t.FRAGMENT_SHADER);if(!o)throw new Error("Couldn't create fragment shader for element accumulation");if(t.shaderSource(o,i0),t.compileShader(o),!t.getShaderParameter(o,t.COMPILE_STATUS))throw console.error("Fragment shader (element_accumulation) compile error:",t.getShaderInfoLog(o)),new Error("Failed to compile element accumulation fragment shader");const i=t.createProgram();if(!i)throw new Error("Couldn't create element accumulation program");if(F=i,t.attachShader(F,r),t.attachShader(F,o),t.linkProgram(F),!t.getProgramParameter(F,t.LINK_STATUS))throw console.error("Program (element_accumulation) link error:",t.getProgramInfoLog(F)),new Error("Failed to link element accumulation program");t.useProgram(F);const a=t.getAttribLocation(F,"a_position");t.enableVertexAttribArray(a),t.bindBuffer(t.ARRAY_BUFFER,te),t.vertexAttribPointer(a,2,t.FLOAT,!1,0,0);const n=t.getAttribLocation(F,"a_texCoord");t.enableVertexAttribArray(n),t.bindBuffer(t.ARRAY_BUFFER,re),t.vertexAttribPointer(n,2,t.FLOAT,!1,0,0)}function J0(t){const r=t.createShader(t.VERTEX_SHADER);if(!r)throw new Error("Couldn't create vertex shader for passthrough texture");if(t.shaderSource(r,xe),t.compileShader(r),!t.getShaderParameter(r,t.COMPILE_STATUS))throw console.error("Vertex shader (passthrough_texture) compile error:",t.getShaderInfoLog(r)),new Error("Failed to compile passthrough texture vertex shader");const o=t.createShader(t.FRAGMENT_SHADER);if(!o)throw new Error("Couldn't create fragment shader for passthrough texture");if(t.shaderSource(o,c0),t.compileShader(o),!t.getShaderParameter(o,t.COMPILE_STATUS))throw console.error("Fragment shader (passthrough_texture) compile error:",t.getShaderInfoLog(o)),new Error("Failed to compile passthrough texture fragment shader");const i=t.createProgram();if(!i)throw new Error("Couldn't create passthrough texture program");if(O=i,t.attachShader(O,r),t.attachShader(O,o),t.linkProgram(O),!t.getProgramParameter(O,t.LINK_STATUS))throw console.error("Program (passthrough_texture) link error:",t.getProgramInfoLog(O)),new Error("Failed to link passthrough texture program");t.useProgram(O);const a=t.getAttribLocation(O,"a_position");t.enableVertexAttribArray(a),t.bindBuffer(t.ARRAY_BUFFER,te),t.vertexAttribPointer(a,2,t.FLOAT,!1,0,0);const n=t.getAttribLocation(O,"a_texCoord");t.enableVertexAttribArray(n),t.bindBuffer(t.ARRAY_BUFFER,re),t.vertexAttribPointer(n,2,t.FLOAT,!1,0,0)}function Q0(t){const r=l0,o=t.createShader(t.VERTEX_SHADER);if(!o)throw new Error("Couldn't create vertex shader for combine/persist glow");if(t.shaderSource(o,xe),t.compileShader(o),!t.getShaderParameter(o,t.COMPILE_STATUS))throw console.error("Vertex shader (combine/persist glow) compile error:",t.getShaderInfoLog(o)),new Error("Failed to compile combine/persist glow vertex shader");const i=t.createShader(t.FRAGMENT_SHADER);if(!i)throw new Error("Couldn't create fragment shader for combine/persist glow");if(t.shaderSource(i,r),t.compileShader(i),!t.getShaderParameter(i,t.COMPILE_STATUS))throw console.error("Fragment shader (combine/persist glow) compile error:",t.getShaderInfoLog(i)),new Error("Failed to compile combine/persist glow fragment shader");const a=t.createProgram();if(!a)throw new Error("Couldn't create combine/persist glow program");if(w=a,t.attachShader(w,o),t.attachShader(w,i),t.linkProgram(w),!t.getProgramParameter(w,t.LINK_STATUS))throw console.error("Program (combine/persist glow) link error:",t.getProgramInfoLog(w)),new Error("Failed to link combine/persist glow program");t.useProgram(w);const n=t.getAttribLocation(w,"a_position");t.enableVertexAttribArray(n),t.bindBuffer(t.ARRAY_BUFFER,te),t.vertexAttribPointer(n,2,t.FLOAT,!1,0,0);const E=t.getAttribLocation(w,"a_texCoord");t.enableVertexAttribArray(E),t.bindBuffer(t.ARRAY_BUFFER,re),t.vertexAttribPointer(E,2,t.FLOAT,!1,0,0)}document.querySelector("#app").innerHTML=`
  <div>
    <div id="canvas-container">
      <canvas id="canvas-2d" width="800" height="800"></canvas>
      <canvas id="canvas-webgl" width="800" height="800"></canvas>
    </div>
    <div id="button-container">
      <button id="render-button">Render</button>
    </div>
  </div>
`;Z0({canvas2d:document.querySelector("#canvas-2d"),canvasWebGL:document.querySelector("#canvas-webgl")});
