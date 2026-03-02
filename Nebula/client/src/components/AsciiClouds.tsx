import React, { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface State {
  cellSize: number;
  waveAmplitude: number;
  waveSpeed: number;
  noiseIntensity: number;
  vignetteIntensity: number;
  vignetteRadius: number;
  brightnessAdjust: number;
  contrastAdjust: number;
  timeSpeed: number;
  hue: number;
  saturation: number;
  threshold1: number;
  threshold2: number;
  threshold3: number;
  threshold4: number;
  threshold5: number;
  noiseSeed: string;
}

interface AsciiCloudsProps {
  className?: string;
  showControls?: boolean;
  initialSettings?: Partial<State>;
}

const AsciiClouds: React.FC<AsciiCloudsProps> = ({
  className,
  showControls = true,
  initialSettings
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const [isControlsCollapsed, setIsControlsCollapsed] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const [state, setState] = useState<State>(() => ({
    cellSize: 18,
    waveAmplitude: 0.5,
    waveSpeed: 1.0,
    noiseIntensity: 0.125,
    vignetteIntensity: 0.5,
    vignetteRadius: 0.5,
    brightnessAdjust: 0.0,
    contrastAdjust: 1.25,
    timeSpeed: 1.5,
    hue: 180,
    saturation: 0.5,
    threshold1: 0.25,
    threshold2: 0.3,
    threshold3: 0.4,
    threshold4: 0.5,
    threshold5: 0.65,
    noiseSeed: Math.random().toString(36).substring(2, 8),
    ...initialSettings,
  }));

  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const noiseProgramRef = useRef<WebGLProgram | null>(null);
  const glyphProgramRef = useRef<WebGLProgram | null>(null);
  const noiseUniformsRef = useRef<any>(null);
  const glyphUniformsRef = useRef<any>(null);
  const quadBufferRef = useRef<WebGLBuffer | null>(null);
  const quadVAORef = useRef<WebGLVertexArrayObject | null>(null);
  const framebufferRef = useRef<WebGLFramebuffer | null>(null);
  const noiseTextureRef = useRef<WebGLTexture | null>(null);

  const animationFrameIdRef = useRef<number | null>(null);
  const timeRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerIntervalRef = useRef<number | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const hashSeed = useCallback((seed: string): number => {
    if (!seed) return 0;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash) % 10000;
  }, []);

  const initWebGL = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true });
    if (!gl) {
      throw new Error('WebGL 2.0 not supported');
    }
    glRef.current = gl;

    const vertexShaderSource = `#version 300 es
      in vec2 a_position;
      out vec2 v_uv;

      void main() {
        v_uv = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const noiseFragmentShaderSource = `#version 300 es
      precision highp float;

      in vec2 v_uv;
      out vec4 fragColor;

      uniform float u_time;
      uniform vec2 u_resolution;
      uniform float u_waveAmplitude;
      uniform float u_waveSpeed;
      uniform float u_noiseIntensity;
      uniform float u_vignetteIntensity;
      uniform float u_vignetteRadius;
      uniform float u_brightnessAdjust;
      uniform float u_contrastAdjust;
      uniform float u_noiseSeed;

      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
      vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

      float snoise(vec3 v) {
        const vec2 C = vec2(1.0/6.0, 1.0/3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

        vec3 i  = floor(v + dot(v, C.yyy));
        vec3 x0 = v - i + dot(i, C.xxx);

        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min(g.xyz, l.zxy);
        vec3 i2 = max(g.xyz, l.zxy);

        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;

        i = mod289(i);
        vec4 p = permute(permute(permute(
                  i.z + vec4(0.0, i1.z, i2.z, 1.0))
                + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                + i.x + vec4(0.0, i1.x, i2.x, 1.0));

        float n_ = 0.142857142857;
        vec3 ns = n_ * D.wyz - D.xzx;

        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_);

        vec4 x = x_ *ns.x + ns.yyyy;
        vec4 y = y_ *ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);

        vec4 b0 = vec4(x.xy, y.xy);
        vec4 b1 = vec4(x.zw, y.zw);

        vec4 s0 = floor(b0)*2.0 + 1.0;
        vec4 s1 = floor(b1)*2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));

        vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
        vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;

        vec3 p0 = vec3(a0.xy, h.x);
        vec3 p1 = vec3(a0.zw, h.y);
        vec3 p2 = vec3(a1.xy, h.z);
        vec3 p3 = vec3(a1.zw, h.w);

        vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;

        vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
        m = m * m;
        return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
      }

      float fbm(vec3 p) {
        float value = 0.0;
        float amplitude = 0.5;
        float frequency = 1.0;
        for (int i = 0; i < 4; i++) {
          value += amplitude * snoise(p * frequency);
          amplitude *= 0.5;
          frequency *= 2.0;
        }
        return value;
      }

      void main() {
        vec2 center = vec2(0.5, 0.5);
        float dist = length(v_uv - center);

        float aspect = u_resolution.x / u_resolution.y;
        vec2 uv = v_uv;
        uv.x *= aspect;

        vec2 drift = u_time * (0.02 + 0.02 * u_waveSpeed) * vec2(0.3, 0.2);

        float warpTime = u_time * max(0.025, 0.04 * u_waveSpeed);

        vec2 q = vec2(
          fbm(vec3(uv + drift, warpTime + u_noiseSeed)),
          fbm(vec3(uv + drift + vec2(5.2, 1.3), warpTime * 0.9 + u_noiseSeed))
        );

        vec2 driftR = u_time * (0.016 + 0.016 * u_waveSpeed) * vec2(0.25, 0.15);
        vec2 r = vec2(
          fbm(vec3(uv + 4.0 * q + vec2(1.7, 9.2) + driftR, warpTime * 0.8 + u_noiseSeed)),
          fbm(vec3(uv + 4.0 * q + vec2(8.3, 2.8) + driftR, warpTime * 0.7 + u_noiseSeed))
        );

        float warpStrength = u_waveAmplitude * 1.5;
        vec2 warpedUV = uv + warpStrength * r + drift;

        float density = fbm(vec3(warpedUV * 4.0, warpTime * 0.5 + u_noiseSeed)) * 0.5 + 0.5;

        density += (snoise(vec3(uv * 50.0 + drift * 10.0, u_noiseSeed)) * 0.5 + 0.5) * u_noiseIntensity;

        float visible = smoothstep(0.35, 0.70, density);

        float edgeFade = 1.0 - smoothstep(u_vignetteRadius * 0.5, u_vignetteRadius, dist) * u_vignetteIntensity;
        visible *= edgeFade;

        visible = (visible + u_brightnessAdjust) * u_contrastAdjust;
        visible = clamp(visible, 0.0, 1.0);

        fragColor = vec4(vec3(visible), 1.0);
      }
    `;

    const glyphFragmentShaderSource = `#version 300 es
      precision highp float;

      in vec2 v_uv;
      out vec4 fragColor;

      uniform sampler2D u_noiseTexture;
      uniform vec2 u_resolution;
      uniform float u_cellSize;
      uniform float u_hue;
      uniform float u_saturation;
      uniform float u_threshold1;
      uniform float u_threshold2;
      uniform float u_threshold3;
      uniform float u_threshold4;
      uniform float u_threshold5;

      vec3 hsl2rgb(float h, float s, float l) {
        float c = (1.0 - abs(2.0 * l - 1.0)) * s;
        float hp = h / 60.0;
        float x = c * (1.0 - abs(mod(hp, 2.0) - 1.0));
        vec3 rgb;
        if (hp < 1.0) rgb = vec3(c, x, 0.0);
        else if (hp < 2.0) rgb = vec3(x, c, 0.0);
        else if (hp < 3.0) rgb = vec3(0.0, c, x);
        else if (hp < 4.0) rgb = vec3(0.0, x, c);
        else if (hp < 5.0) rgb = vec3(x, 0.0, c);
        else rgb = vec3(c, 0.0, x);
        float m = l - c * 0.5;
        return rgb + m;
      }

      float drawDot(vec2 uv) {
        vec2 center = vec2(0.5, 0.5);
        float dist = length(uv - center);
        return smoothstep(0.2, 0.15, dist);
      }

      float drawDash(vec2 uv) {
        float h = smoothstep(0.35, 0.4, uv.y) * smoothstep(0.65, 0.6, uv.y);
        float w = smoothstep(0.15, 0.2, uv.x) * smoothstep(0.85, 0.8, uv.x);
        return h * w;
      }

      float drawPlus(vec2 uv) {
        float horiz = smoothstep(0.35, 0.4, uv.y) * smoothstep(0.65, 0.6, uv.y) *
                      smoothstep(0.1, 0.15, uv.x) * smoothstep(0.9, 0.85, uv.x);
        float vert = smoothstep(0.35, 0.4, uv.x) * smoothstep(0.65, 0.6, uv.x) *
                     smoothstep(0.1, 0.15, uv.y) * smoothstep(0.9, 0.85, uv.y);
        return max(horiz, vert);
      }

      float drawO(vec2 uv) {
        vec2 center = vec2(0.5, 0.5);
        float dist = length(uv - center);
        float outer = smoothstep(0.4, 0.35, dist);
        float inner = smoothstep(0.2, 0.25, dist);
        return outer * inner;
      }

      float drawX(vec2 uv) {
        vec2 c = uv - 0.5;
        float d1 = abs(c.x - c.y);
        float d2 = abs(c.x + c.y);
        float line1 = smoothstep(0.15, 0.1, d1);
        float line2 = smoothstep(0.15, 0.1, d2);
        float bounds = smoothstep(0.45, 0.4, abs(c.x)) * smoothstep(0.45, 0.4, abs(c.y));
        return max(line1, line2) * bounds;
      }

      float getGlyph(float brightness, vec2 localUV) {
        if (brightness < u_threshold1) {
          return 0.0;
        } else if (brightness < u_threshold2) {
          return drawDot(localUV);
        } else if (brightness < u_threshold3) {
          return drawDash(localUV);
        } else if (brightness < u_threshold4) {
          return drawPlus(localUV);
        } else if (brightness < u_threshold5) {
          return drawO(localUV);
        } else {
          return drawX(localUV);
        }
      }

      void main() {
        vec2 cellCount = u_resolution / u_cellSize;
        vec2 cellCoord = floor(v_uv * cellCount);
        vec2 cellUV = (cellCoord + 0.5) / cellCount;

        float brightness = texture(u_noiseTexture, cellUV).r;

        vec2 localUV = fract(v_uv * cellCount);

        float glyphValue = getGlyph(brightness, localUV);

        vec3 glyphColor = hsl2rgb(u_hue, u_saturation, 0.5 + brightness * 0.3);
        vec3 bgColor = vec3(0.02, 0.02, 0.02);

        vec3 finalColor = mix(bgColor, glyphColor, glyphValue * brightness);

        fragColor = vec4(finalColor, 1.0);
      }
    `;

    const compileShader = (type: number, source: string): WebGLShader => {
      const shader = gl.createShader(type);
      if (!shader) throw new Error('Failed to create shader');

      gl.shaderSource(shader, source);
      gl.compileShader(shader);

      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error('Shader compilation error: ' + info);
      }

      return shader;
    };

    const createProgram = (vertSource: string, fragSource: string): WebGLProgram => {
      const vertShader = compileShader(gl.VERTEX_SHADER, vertSource);
      const fragShader = compileShader(gl.FRAGMENT_SHADER, fragSource);

      const program = gl.createProgram();
      if (!program) throw new Error('Failed to create program');

      gl.attachShader(program, vertShader);
      gl.attachShader(program, fragShader);
      gl.linkProgram(program);

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const info = gl.getProgramInfoLog(program);
        throw new Error('Program link error: ' + info);
      }

      return program;
    };

    noiseProgramRef.current = createProgram(vertexShaderSource, noiseFragmentShaderSource);
    glyphProgramRef.current = createProgram(vertexShaderSource, glyphFragmentShaderSource);

    noiseUniformsRef.current = {
      time: gl.getUniformLocation(noiseProgramRef.current, 'u_time'),
      resolution: gl.getUniformLocation(noiseProgramRef.current, 'u_resolution'),
      waveAmplitude: gl.getUniformLocation(noiseProgramRef.current, 'u_waveAmplitude'),
      waveSpeed: gl.getUniformLocation(noiseProgramRef.current, 'u_waveSpeed'),
      noiseIntensity: gl.getUniformLocation(noiseProgramRef.current, 'u_noiseIntensity'),
      vignetteIntensity: gl.getUniformLocation(noiseProgramRef.current, 'u_vignetteIntensity'),
      vignetteRadius: gl.getUniformLocation(noiseProgramRef.current, 'u_vignetteRadius'),
      brightnessAdjust: gl.getUniformLocation(noiseProgramRef.current, 'u_brightnessAdjust'),
      contrastAdjust: gl.getUniformLocation(noiseProgramRef.current, 'u_contrastAdjust'),
      noiseSeed: gl.getUniformLocation(noiseProgramRef.current, 'u_noiseSeed'),
    };

    glyphUniformsRef.current = {
      noiseTexture: gl.getUniformLocation(glyphProgramRef.current, 'u_noiseTexture'),
      resolution: gl.getUniformLocation(glyphProgramRef.current, 'u_resolution'),
      cellSize: gl.getUniformLocation(glyphProgramRef.current, 'u_cellSize'),
      hue: gl.getUniformLocation(glyphProgramRef.current, 'u_hue'),
      saturation: gl.getUniformLocation(glyphProgramRef.current, 'u_saturation'),
      threshold1: gl.getUniformLocation(glyphProgramRef.current, 'u_threshold1'),
      threshold2: gl.getUniformLocation(glyphProgramRef.current, 'u_threshold2'),
      threshold3: gl.getUniformLocation(glyphProgramRef.current, 'u_threshold3'),
      threshold4: gl.getUniformLocation(glyphProgramRef.current, 'u_threshold4'),
      threshold5: gl.getUniformLocation(glyphProgramRef.current, 'u_threshold5'),
    };

    quadBufferRef.current = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBufferRef.current);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    quadVAORef.current = gl.createVertexArray();
    gl.bindVertexArray(quadVAORef.current);

    const positionLoc = gl.getAttribLocation(noiseProgramRef.current, 'a_position');
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);
  }, []);

  const createFramebuffer = useCallback((width: number, height: number) => {
    const gl = glRef.current;
    if (!gl) return;

    if (framebufferRef.current) gl.deleteFramebuffer(framebufferRef.current);
    if (noiseTextureRef.current) gl.deleteTexture(noiseTextureRef.current);

    noiseTextureRef.current = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, noiseTextureRef.current);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    framebufferRef.current = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebufferRef.current);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, noiseTextureRef.current, 0);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }, []);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const rect = canvas.getBoundingClientRect();
    const width = Math.floor(rect.width * dpr);
    const height = Math.floor(rect.height * dpr);

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      createFramebuffer(width, height);
    }
  }, [createFramebuffer]);

  const renderFrame = useCallback(() => {
    const gl = glRef.current;
    const canvas = canvasRef.current;
    if (!gl || !canvas || !noiseProgramRef.current || !glyphProgramRef.current) return;

    resize();

    const width = canvas.width;
    const height = canvas.height;

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebufferRef.current);
    gl.viewport(0, 0, width, height);
    gl.useProgram(noiseProgramRef.current);

    gl.uniform1f(noiseUniformsRef.current.time, timeRef.current);
    gl.uniform2f(noiseUniformsRef.current.resolution, width, height);
    gl.uniform1f(noiseUniformsRef.current.waveAmplitude, state.waveAmplitude);
    gl.uniform1f(noiseUniformsRef.current.waveSpeed, state.waveSpeed);
    gl.uniform1f(noiseUniformsRef.current.noiseIntensity, state.noiseIntensity);
    gl.uniform1f(noiseUniformsRef.current.vignetteIntensity, state.vignetteIntensity);
    gl.uniform1f(noiseUniformsRef.current.vignetteRadius, state.vignetteRadius);
    gl.uniform1f(noiseUniformsRef.current.brightnessAdjust, state.brightnessAdjust);
    gl.uniform1f(noiseUniformsRef.current.contrastAdjust, state.contrastAdjust);
    gl.uniform1f(noiseUniformsRef.current.noiseSeed, hashSeed(state.noiseSeed));

    gl.bindVertexArray(quadVAORef.current);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.useProgram(glyphProgramRef.current);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, noiseTextureRef.current);
    gl.uniform1i(glyphUniformsRef.current.noiseTexture, 0);

    gl.uniform2f(glyphUniformsRef.current.resolution, width, height);
    gl.uniform1f(glyphUniformsRef.current.cellSize, state.cellSize * (window.devicePixelRatio || 1));
    gl.uniform1f(glyphUniformsRef.current.hue, state.hue);
    gl.uniform1f(glyphUniformsRef.current.saturation, state.saturation);
    gl.uniform1f(glyphUniformsRef.current.threshold1, state.threshold1);
    gl.uniform1f(glyphUniformsRef.current.threshold2, state.threshold2);
    gl.uniform1f(glyphUniformsRef.current.threshold3, state.threshold3);
    gl.uniform1f(glyphUniformsRef.current.threshold4, state.threshold4);
    gl.uniform1f(glyphUniformsRef.current.threshold5, state.threshold5);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }, [state, resize, hashSeed]);

  const render = useCallback((currentTime: number) => {
    const deltaTime = (currentTime - lastTimeRef.current) / 1000;
    lastTimeRef.current = currentTime;

    if (!isPaused) {
      timeRef.current += deltaTime * state.timeSpeed;
    }

    renderFrame();
    animationFrameIdRef.current = requestAnimationFrame(render);
  }, [isPaused, state.timeSpeed, renderFrame]);

  useEffect(() => {
    try {
      initWebGL();
      resize();
      animationFrameIdRef.current = requestAnimationFrame(render);
    } catch (error) {
    }

    const handleResize = () => resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [initWebGL, resize, render]);

  useEffect(() => {
    if (isPaused) {
      renderFrame();
    }
  }, [state, renderFrame, isPaused]);

  const togglePaused = useCallback(() => {
    if (isPaused) {
      lastTimeRef.current = performance.now();
      animationFrameIdRef.current = requestAnimationFrame(render);
    } else {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    }
    setIsPaused(!isPaused);
  }, [isPaused, render]);

  const exportPNG = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) {
        alert('Failed to export image');
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `ascii-clouds-${Date.now()}.png`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.getElementById('ascii-clouds-app')?.requestFullscreen();
    }
  }, []);

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        togglePaused();
      } else if (e.code === 'KeyF') {
        toggleFullscreen();
      }
    };

    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [togglePaused, toggleFullscreen]);

  return (
    <div id="ascii-clouds-app" className={cn("relative w-full h-full bg-black overflow-hidden", className)}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ width: '100%', height: '100%' }}
      />

      {showControls && (
        <div
          ref={controlsRef}
          className={cn(
            "absolute top-4 right-4 bg-black/85 border border-white/20 rounded-lg p-4 min-w-72 max-h-[calc(100%-4rem)] overflow-y-auto z-10 transition-all duration-200",
            isControlsCollapsed && "bg-transparent border-transparent"
          )}
        >
          <button
            className={cn(
              "absolute -left-2 -top-2 bg-black border border-white/20 rounded w-8 h-8 p-0 cursor-pointer transition-all hover:bg-white/10",
              isControlsCollapsed && "relative left-0 top-0 float-right"
            )}
            onClick={() => setIsControlsCollapsed(!isControlsCollapsed)}
            aria-label="Toggle controls"
          >
            <div className="text-white text-lg leading-none">
              {isControlsCollapsed ? '+' : '−'}
            </div>
          </button>

          {!isControlsCollapsed && (
            <div className="pr-4">
              <div className="flex items-center gap-2 mb-3">
                <button
                  onClick={togglePaused}
                  className="p-2 bg-black border border-white/20 rounded hover:bg-white/10 transition-colors"
                  aria-label={isPaused ? 'Play' : 'Pause'}
                >
                  <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                    {isPaused ? (
                      <polygon points="5,3 19,12 5,21" />
                    ) : (
                      <>
                        <rect x="6" y="4" width="4" height="16" />
                        <rect x="14" y="4" width="4" height="16" />
                      </>
                    )}
                  </svg>
                </button>
                <button
                  onClick={toggleFullscreen}
                  className="px-3 py-2 bg-black border border-white/20 rounded hover:bg-white/10 transition-colors text-white text-sm"
                >
                  Fullscreen
                </button>
                <button
                  onClick={exportPNG}
                  className="px-3 py-2 bg-black border border-white/20 rounded hover:bg-white/10 transition-colors text-white text-sm"
                  aria-label="Export PNG"
                >
                  <svg className="w-4 h-4 inline mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  PNG
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-white/80 text-sm mb-2">Cell Size</label>
                  <input
                    type="range"
                    min="4"
                    max="32"
                    step="1"
                    value={state.cellSize}
                    onChange={(e) => setState(prev => ({ ...prev, cellSize: parseFloat(e.target.value) }))}
                    className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <span className="text-white/60 text-xs font-mono block mt-1">{state.cellSize}</span>
                </div>

                <div>
                  <label className="block text-white/80 text-sm mb-2">Wave Amplitude</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={state.waveAmplitude}
                    onChange={(e) => setState(prev => ({ ...prev, waveAmplitude: parseFloat(e.target.value) }))}
                    className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <span className="text-white/60 text-xs font-mono block mt-1">{state.waveAmplitude.toFixed(2)}</span>
                </div>

                <div>
                  <label className="block text-white/80 text-sm mb-2">Hue</label>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    step="1"
                    value={state.hue}
                    onChange={(e) => setState(prev => ({ ...prev, hue: parseFloat(e.target.value) }))}
                    className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <span className="text-white/60 text-xs font-mono block mt-1">{state.hue}</span>
                </div>

                <div>
                  <label className="block text-white/80 text-sm mb-2">Saturation</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={state.saturation}
                    onChange={(e) => setState(prev => ({ ...prev, saturation: parseFloat(e.target.value) }))}
                    className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <span className="text-white/60 text-xs font-mono block mt-1">{state.saturation.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AsciiClouds;