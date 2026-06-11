/**
 * 马年贺卡生成器 - 核心逻辑
 * Horse Year Greeting Card Generator
 */

(function () {
  'use strict';

  // ═══════════════════════════════════════
  // Configuration
  // ═══════════════════════════════════════
  const SUPABASE_URL = 'https://XXXXXXXXXXXX.supabase.co'; // 部署时替换
  const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';               // 部署时替换

  // ═══════════════════════════════════════
  // State
  // ═══════════════════════════════════════
  const state = {
    phase: 'idle',       // idle | generating | greeting_done | image_generating | image_done | error
    greeting: '',
    backgroundImage: '', // wan2.7 base64
    finalImageBlob: null,
  };

  // ═══════════════════════════════════════
  // DOM References
  // ═══════════════════════════════════════
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const dom = {
    generateBtn: $('#generateBtn'),
    generateBtnText: $('#generateBtnText'),
    btnLoading: $('#btnLoading'),
    greetingPlaceholder: $('#greetingPlaceholder'),
    greetingContent: $('#greetingContent'),
    greetingText: $('#greetingText'),
    greetingActions: $('#greetingActions'),
    copyBtn: $('#copyBtn'),
    imageBtn: $('#imageBtn'),
    retryBtn: $('#retryBtn'),
    toast: $('#toast'),
    imageModal: $('#imageModal'),
    modalClose: $('#modalClose'),
    modalImage: $('#modalImage'),
    modalLoading: $('#modalLoading'),
    modalFooter: $('#modalFooter'),
    downloadBtn: $('#downloadBtn'),
    fireworkCanvas: $('#fireworkCanvas'),
    cardCanvas: $('#cardCanvas'),
  };

  // ═══════════════════════════════════════
  // Firework Canvas Animation
  // ═══════════════════════════════════════
  function initFireworks() {
    const canvas = dom.fireworkCanvas;
    const ctx = canvas.getContext('2d');
    let particles = [];
    let animId;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    function createParticle() {
      return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height * 0.5,
        vx: (Math.random() - 0.5) * 2,
        vy: Math.random() * 1 + 0.5,
        life: 1,
        decay: Math.random() * 0.008 + 0.004,
        size: Math.random() * 3 + 1,
        color: Math.random() > 0.5 ? '#FFD700' : '#FF6B6B',
      };
    }

    function burst(x, y) {
      const count = 20;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
        const speed = Math.random() * 4 + 2;
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          decay: Math.random() * 0.015 + 0.01,
          size: Math.random() * 2.5 + 1,
          color: ['#FFD700', '#FF6B6B', '#FFA500', '#FF4500', '#FFF'][Math.floor(Math.random() * 5)],
        });
      }
    }

    // Periodic random bursts
    setInterval(() => {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height * 0.4;
      burst(x, y);
    }, 2500);

    // Initial particles
    for (let i = 0; i < 30; i++) {
      particles.push(createParticle());
    }

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles = particles.filter(p => p.life > 0);

      if (particles.length < 20) {
        particles.push(createParticle());
      }

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;

        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        // Glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life * 0.15;
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      animId = requestAnimationFrame(animate);
    }

    animate();
  }

  // ═══════════════════════════════════════
  // API Calls
  // ═══════════════════════════════════════
  async function apiCall(endpoint) {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: '{}',
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    return res.json();
  }

  // ═══════════════════════════════════════
  // Toast
  // ═══════════════════════════════════════
  let toastTimer;
  function showToast(message, isError = false) {
    clearTimeout(toastTimer);
    const toast = dom.toast;
    toast.querySelector('.toast-text').textContent = message;
    toast.className = 'toast' + (isError ? ' error' : '');
    toast.classList.add('show');

    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }

  // ═══════════════════════════════════════
  // UI State Transitions
  // ═══════════════════════════════════════
  function setPhase(phase) {
    state.phase = phase;
    const btn = dom.generateBtn;
    const btnText = dom.generateBtnText;

    switch (phase) {
      case 'idle':
        btn.classList.remove('loading', 'done');
        btnText.textContent = '生成马年贺词';
        dom.greetingPlaceholder.classList.remove('hidden');
        dom.greetingContent.classList.remove('active');
        dom.greetingActions.classList.remove('active');
        dom.greetingText.textContent = '';
        state.greeting = '';
        state.backgroundImage = '';
        state.finalImageBlob = null;
        break;

      case 'generating':
        btn.classList.add('loading');
        btn.classList.remove('done');
        btnText.textContent = '生成中...';
        break;

      case 'greeting_done':
        btn.classList.remove('loading', 'done');
        btn.classList.remove('loading');
        btnText.textContent = '已生成';
        dom.greetingPlaceholder.classList.add('hidden');
        dom.greetingContent.classList.add('active');
        dom.greetingActions.classList.add('active');
        break;

      case 'image_generating':
        // Modal is shown with loading spinner
        break;

      case 'image_done':
        // Modal shows image
        break;

      case 'error':
        btn.classList.remove('loading', 'done');
        btnText.textContent = '生成马年贺词';
        break;
    }
  }

  // ═══════════════════════════════════════
  // Greeting Text Animation (character by character)
  // ═══════════════════════════════════════
  function animateGreeting(text) {
    const el = dom.greetingText;
    el.textContent = '';
    el.classList.add('animating');

    // Split by character (handles emoji correctly)
    const chars = [...text];

    chars.forEach((char, i) => {
      const span = document.createElement('span');
      span.className = 'char';
      span.textContent = char;
      span.style.animationDelay = `${i * 0.04}s`;
      el.appendChild(span);
    });

    // Remove animating class after all chars done
    const totalDuration = chars.length * 0.04 * 1000 + 300;
    setTimeout(() => {
      el.classList.remove('animating');
    }, totalDuration);
  }

  // ═══════════════════════════════════════
  // Copy to Clipboard
  // ═══════════════════════════════════════
  async function copyGreeting() {
    try {
      await navigator.clipboard.writeText(state.greeting);
      showToast('贺词已复制到剪贴板');
      // Haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(20);
      }
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = state.greeting;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      showToast('贺词已复制到剪贴板');
    }
  }

  // ═══════════════════════════════════════
  // Canvas Composition: Background + Greeting Text
  // ═══════════════════════════════════════
  function composeGreetingCard(backgroundBase64) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1920;
      const ctx = canvas.getContext('2d');

      const bgImg = new Image();
      bgImg.onload = () => {
        // Draw background
        ctx.drawImage(bgImg, 0, 0, 1080, 1920);

        // Configure text style
        const fontSize = 64;
        const lineHeight = 96;
        const textColor = '#D4A017'; // Gold
        const textStroke = '#000000';
        const maxWidth = 800;
        const startY = 700;

        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        // Draw semi-transparent backdrop for readability
        const lines = wrapText(ctx, state.greeting, fontSize, maxWidth);
        const textHeight = lines.length * lineHeight + 60;
        const backdropY = startY - 30;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.roundRect(140, backdropY, 800, textHeight, 20);
        ctx.fill();

        // Draw text with stroke for readability
        ctx.font = `bold ${fontSize}px "KaiTi", "STKaiti", "楷体", "Noto Serif SC", serif`;
        ctx.fillStyle = textColor;
        ctx.strokeStyle = textStroke;
        ctx.lineWidth = 4;
        ctx.lineJoin = 'round';

        lines.forEach((line, i) => {
          const y = startY + i * lineHeight;
          ctx.strokeText(line, 540, y);
          ctx.fillText(line, 540, y);
        });

        // Draw signature / footer
        const footerY = startY + textHeight + 60;
        ctx.font = `bold 36px "KaiTi", "STKaiti", "楷体", serif`;
        ctx.fillStyle = '#D4A017';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeText('—— 丙午马年 · 新春大吉 ——', 540, footerY);
        ctx.fillText('—— 丙午马年 · 新春大吉 ——', 540, footerY);

        // Decorative corner elements
        drawCornerDecorations(ctx);

        canvas.toBlob((blob) => {
          resolve(blob);
        }, 'image/png');
      };

      bgImg.src = backgroundBase64;
    });
  }

  function wrapText(ctx, text, fontSize, maxWidth) {
    ctx.font = `bold ${fontSize}px "KaiTi", "STKaiti", "楷体", serif`;
    const lines = [];
    let current = '';

    for (const char of text) {
      const test = current + char;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = char;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  function drawCornerDecorations(ctx) {
    const gold = '#D4A017';
    ctx.strokeStyle = gold;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.5;

    // Top-left
    ctx.beginPath();
    ctx.moveTo(60, 100); ctx.lineTo(60, 60); ctx.lineTo(100, 60);
    ctx.stroke();
    // Top-right
    ctx.beginPath();
    ctx.moveTo(1020, 100); ctx.lineTo(1020, 60); ctx.lineTo(980, 60);
    ctx.stroke();
    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(60, 1820); ctx.lineTo(60, 1860); ctx.lineTo(100, 1860);
    ctx.stroke();
    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(1020, 1820); ctx.lineTo(1020, 1860); ctx.lineTo(980, 1860);
    ctx.stroke();

    ctx.globalAlpha = 1;
  }

  // ═══════════════════════════════════════
  // Modal Management
  // ═══════════════════════════════════════
  function openModal() {
    dom.imageModal.classList.add('active');
    dom.modalImage.style.display = 'none';
    dom.modalLoading.style.display = 'block';
    dom.modalFooter.style.display = 'none';
  }

  function showModalImage(imageBase64) {
    dom.modalLoading.style.display = 'none';
    dom.modalImage.src = imageBase64;
    dom.modalImage.style.display = 'block';
    dom.modalFooter.style.display = 'flex';
  }

  function closeModal() {
    dom.imageModal.classList.remove('active');
    dom.modalImage.src = '';
    dom.modalImage.style.display = 'none';
  }

  dom.modalClose.addEventListener('click', closeModal);
  dom.imageModal.querySelector('.modal-backdrop').addEventListener('click', closeModal);

  // ═══════════════════════════════════════
  // Download Card Image
  // ═══════════════════════════════════════
  dom.downloadBtn.addEventListener('click', () => {
    if (!state.finalImageBlob) return;

    const url = URL.createObjectURL(state.finalImageBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '马年贺卡.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('贺卡已开始下载');
  });

  // ═══════════════════════════════════════
  // Generate Greeting
  // ═══════════════════════════════════════
  async function handleGenerate() {
    if (state.phase === 'generating' || state.phase === 'image_generating') return;

    setPhase('generating');

    try {
      const data = await apiCall('generate-greeting');
      if (!data.success) throw new Error(data.error);

      state.greeting = data.greeting;
      setPhase('greeting_done');
      animateGreeting(data.greeting);

      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate([20, 50, 20]);
      }
    } catch (err) {
      console.error('Generate greeting error:', err);
      setPhase('error');
      showToast('贺词生成失败，请重试', true);
    }
  }

  // ═══════════════════════════════════════
  // Generate Card Image
  // ═══════════════════════════════════════
  async function handleGenerateImage() {
    if (!state.greeting) return;
    if (state.phase === 'image_generating') return;

    setPhase('image_generating');
    openModal();

    try {
      // Step 1: Generate background image from wan2.7
      const data = await apiCall('generate-card-image');
      if (!data.success) throw new Error(data.error);

      state.backgroundImage = data.image;

      // Step 2: Compose greeting text onto background
      state.finalImageBlob = await composeGreetingCard(data.image);

      // Step 3: Show in modal
      const reader = new FileReader();
      reader.onload = () => {
        showModalImage(reader.result);
      };
      reader.readAsDataURL(state.finalImageBlob);

      setPhase('image_done');

      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(20);
      }
    } catch (err) {
      console.error('Generate card image error:', err);
      closeModal();
      setPhase('greeting_done');
      showToast('贺卡图片生成失败，请重试', true);
    }
  }

  // ═══════════════════════════════════════
  // Retry (Regenerate Greeting)
  // ═══════════════════════════════════════
  function handleRetry() {
    state.greeting = '';
    state.backgroundImage = '';
    state.finalImageBlob = null;
    setPhase('idle');
    // Auto-trigger generation for smoother UX
    setTimeout(() => handleGenerate(), 300);
  }

  // ═══════════════════════════════════════
  // Event Bindings
  // ═══════════════════════════════════════
  dom.generateBtn.addEventListener('click', handleGenerate);
  dom.copyBtn.addEventListener('click', copyGreeting);
  dom.imageBtn.addEventListener('click', handleGenerateImage);
  dom.retryBtn.addEventListener('click', handleRetry);

  // ═══════════════════════════════════════
  // Init
  // ═══════════════════════════════════════
  function init() {
    initFireworks();

    // Safety: polyfill roundRect for Safari
    if (!CanvasRenderingContext2D.prototype.roundRect) {
      CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
        if (typeof r === 'number') r = { tl: r, tr: r, br: r, bl: r };
        this.beginPath();
        this.moveTo(x + r.tl, y);
        this.lineTo(x + w - r.tr, y);
        this.quadraticCurveTo(x + w, y, x + w, y + r.tr);
        this.lineTo(x + w, y + h - r.br);
        this.quadraticCurveTo(x + w, y + h, x + w - r.br, y + h);
        this.lineTo(x + r.bl, y + h);
        this.quadraticCurveTo(x, y + h, x, y + h - r.bl);
        this.lineTo(x, y + r.tl);
        this.quadraticCurveTo(x, y, x + r.tl, y);
        this.closePath();
      };
    }
  }

  init();
})();
