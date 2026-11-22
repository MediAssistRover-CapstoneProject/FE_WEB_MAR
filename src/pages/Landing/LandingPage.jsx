import { useEffect, useRef } from 'react';
import { vi } from '../../i18n/vi.js';
import { injectStyles } from '../../styles/injectStyles.js';
import robotImage from '../../assets/images/mentorpi-m1.png';
import BrandMark from '../../components/BrandMark.jsx';
import RobotIllustration from '../../components/RobotIllustration.jsx';

const inlineStyles = String.raw`
.landing-page{--sky:#1f8fff;--sky-2:#38bdf8;--teal:#2dd4bf;--violet:#8b5cf6;--ink:#0f2a4a;--muted:#5d7898;--line:#dbeafb;
  min-width:320px;overflow:hidden;background:#f6faff;color:var(--ink);font-family:'Be Vietnam Pro',Inter,ui-sans-serif,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.landing-page *{box-sizing:border-box}
.landing-page button{font-family:inherit;cursor:pointer}

/* ---------- Buttons ---------- */
.lp-btn{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:10px;height:52px;padding:0 24px;border-radius:14px;border:0;font-size:15px;font-weight:700;white-space:nowrap;transition:transform .25s cubic-bezier(.2,.8,.2,1),box-shadow .25s,background .25s,color .25s}
.lp-btn svg{width:18px;height:18px;transition:transform .25s}
.lp-btn:hover svg{transform:translateX(3px)}
.lp-btn--primary{overflow:hidden;background:linear-gradient(135deg,#1f8fff,#38bdf8 55%,#2dd4bf);background-size:180% 180%;color:#fff;box-shadow:0 10px 30px -8px #1f8fffaa,inset 0 1px 0 #ffffff55;animation:lp-gradient 6s ease infinite}
.lp-btn--primary:after{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent 30%,#ffffff66 50%,transparent 70%);transform:translateX(-120%);transition:transform .7s}
.lp-btn--primary:hover{transform:translateY(-2px);box-shadow:0 16px 36px -8px #1f8fffcc,inset 0 1px 0 #ffffff55}
.lp-btn--primary:hover:after{transform:translateX(120%)}
.lp-btn--ghost{background:#ffffff12;color:#e6f2ff;border:1px solid #ffffff2a;backdrop-filter:blur(10px)}
.lp-btn--ghost:hover{background:#ffffff22;transform:translateY(-2px)}
.lp-btn--light{background:#fff;color:var(--ink);border:1px solid var(--line)}
.lp-btn--light:hover{transform:translateY(-2px);box-shadow:0 12px 28px -12px #0f2a4a55}

/* ---------- Header ---------- */
.lp-header{position:absolute;z-index:20;top:18px;left:50%;transform:translateX(-50%);width:min(1240px,calc(100% - 48px));height:72px;padding:0 14px 0 22px;display:flex;align-items:center;justify-content:space-between;gap:20px;border:1px solid #bdd9ed;border-radius:20px;background:#ffffffc9;backdrop-filter:blur(16px) saturate(140%);box-shadow:0 20px 40px -20px #286b9d30;animation:lp-drop .8s cubic-bezier(.2,.8,.2,1) both}
.lp-logo{display:flex;align-items:center;gap:11px;color:#fff;text-decoration:none}
.lp-logo-mark{display:grid;place-items:center;flex:0 0 54px;width:54px;height:48px}
.lp-logo-text{display:flex;flex-direction:column;line-height:1}
.lp-logo-text b{font-size:19px;font-weight:800;letter-spacing:-.5px}
.lp-logo-text b span{background:linear-gradient(90deg,#38bdf8,#2dd4bf);-webkit-background-clip:text;background-clip:text;color:transparent}
.lp-logo-text small{margin-top:4px;color:#8fb3d9;font-size:9px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase}
.lp-header .lp-logo{color:var(--ink)}
.lp-header .lp-logo-text b span{background-image:linear-gradient(90deg,#1675b9,#087d8d)}
.lp-header .lp-logo-text small{color:#55738f}
.lp-nav{display:flex;align-items:center;gap:6px}
.lp-nav-link{position:relative;height:40px;padding:0 14px;border:0;border-radius:10px;background:none;color:#3d6080;font-size:14px;font-weight:600;transition:.2s}
.lp-nav-link:hover{color:#145b96;background:#e5f2fc}
.lp-nav .lp-btn{height:42px;padding:0 18px;font-size:14px;border-radius:12px}
.lp-nav .lp-btn--ghost{margin-left:8px}
.lp-header .lp-btn--primary,.lp-hero .lp-btn--primary{background-image:linear-gradient(135deg,#1675c5,#087f99);box-shadow:0 10px 26px -10px #1675c570,inset 0 1px 0 #ffffff55}
.lp-header .lp-btn--primary:hover,.lp-hero .lp-btn--primary:hover{box-shadow:0 14px 28px -10px #1675c58c,inset 0 1px 0 #ffffff55}
.lp-header .lp-btn--ghost,.lp-hero .lp-btn--ghost{background:#ffffffa6;color:#244e73;border-color:#accfe7}
.lp-header .lp-btn--ghost:hover,.lp-hero .lp-btn--ghost:hover{background:#fff}

/* ---------- Hero ---------- */
.lp-hero{position:relative;isolation:isolate;padding:150px 24px 120px;background:radial-gradient(1100px 650px at 78% 38%,#d3edf9 0%,transparent 65%),linear-gradient(150deg,#edf7ff 0%,#dcefff 55%,#e7f7ff 100%);color:var(--ink);overflow:hidden}
.lp-hero:after{content:"";position:absolute;z-index:-1;left:0;right:0;bottom:-1px;height:120px;background:linear-gradient(180deg,transparent,#f6faff)}
.lp-grid-bg{position:absolute;inset:0;z-index:-2;background-image:linear-gradient(#4e8cb71a 1px,transparent 1px),linear-gradient(90deg,#4e8cb71a 1px,transparent 1px);background-size:56px 56px;mask-image:radial-gradient(ellipse 80% 70% at 60% 40%,#000 30%,transparent 75%);animation:lp-grid 22s linear infinite}
.lp-aurora{position:absolute;z-index:-1;border-radius:50%;filter:blur(80px);opacity:.55;animation:lp-float-blob 16s ease-in-out infinite}
.lp-aurora--1{width:520px;height:520px;left:-160px;top:-120px;background:#afd6fb}
.lp-aurora--2{width:460px;height:460px;right:-120px;top:120px;background:#b3e8ef;opacity:.45;animation-delay:-5s}
.lp-aurora--3{width:380px;height:380px;left:35%;bottom:-180px;background:#c6ddf8;opacity:.35;animation-delay:-10s}
.lp-hero-inner{max-width:1240px;margin:auto;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);gap:40px;align-items:center}
.lp-hero-copy{min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:26px}
.lp-badge{display:inline-flex;align-items:center;gap:10px;padding:7px 14px 7px 8px;border:1px solid #a8cfe8;border-radius:999px;background:#ffffff8c;color:#2b6087;font-size:13px;font-weight:600;animation:lp-rise .8s .1s both}
.lp-badge i{display:inline-flex;align-items:center;gap:6px;padding:3px 9px;border-radius:999px;background:linear-gradient(90deg,#1675c5,#087f99);color:#fff;font-size:11px;font-style:normal;font-weight:800;letter-spacing:.5px}
.lp-badge i:before{content:"";width:6px;height:6px;border-radius:50%;background:#fff;animation:lp-blink 1.6s infinite}
.lp-hero h1{margin:0;font-size:clamp(44px,5.6vw,76px);line-height:1.22;letter-spacing:-.025em;font-weight:800;text-wrap:balance;animation:lp-rise .8s .2s both}
.lp-hero h1 em{font-style:normal;background:linear-gradient(90deg,#146db5,#087d8d,#3a6bb0,#146db5);background-size:300% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:lp-gradient 8s linear infinite}
.lp-hero-copy>p{max-width:540px;margin:0;color:#476984;font-size:18px;line-height:1.7;animation:lp-rise .8s .3s both}
.lp-actions{display:flex;flex-wrap:wrap;gap:14px;animation:lp-rise .8s .4s both}
.lp-stats{display:flex;gap:34px;margin-top:10px;padding-top:26px;border-top:1px solid #accfe480;animation:lp-rise .8s .5s both}
.lp-stats div{display:flex;flex-direction:column;gap:4px}
.lp-stats b{font-size:28px;font-weight:800;letter-spacing:-1px;background:linear-gradient(180deg,#164e79,#1d6ca5);-webkit-background-clip:text;background-clip:text;color:transparent}
.lp-stats span{color:#4e708c;font-size:13px}

/* Robot stage */
.lp-stage{position:relative;aspect-ratio:1/0.92;width:100%;margin:0;animation:lp-zoom 1.1s .2s cubic-bezier(.2,.8,.2,1) both}
.lp-stage-glow{position:absolute;left:50%;top:50%;width:78%;aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle,#fff 0%,#b5e0fa99 30%,#a4d2f033 55%,transparent 72%);filter:blur(6px);animation:lp-breathe 5s ease-in-out infinite}
.lp-ring{position:absolute;left:50%;top:56%;width:86%;aspect-ratio:1;transform:translate(-50%,-50%) rotateX(68deg);border-radius:50%;border:1.5px solid #509ecc66}
.lp-ring--pulse{animation:lp-pulse 3.6s cubic-bezier(.2,.6,.3,1) infinite;opacity:0}
.lp-ring--pulse.d2{animation-delay:1.2s}.lp-ring--pulse.d3{animation-delay:2.4s}
.lp-ring--static{width:62%;border:1px dashed #509ecc55}
.lp-sweep{position:absolute;left:50%;top:56%;width:86%;aspect-ratio:1;transform:translate(-50%,-50%) rotateX(68deg);border-radius:50%;overflow:hidden}
.lp-sweep:before{content:"";position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 0deg,#2dd4bf88,#2dd4bf00 70deg,transparent 360deg);animation:lp-spin 4s linear infinite}
.lp-robot{position:absolute;z-index:3;left:50%;top:50%;width:82%;transform:translate(-50%,-50%);filter:drop-shadow(0 25px 26px #335e7a38) drop-shadow(0 0 40px #9dd7fa33);animation:lp-hover 6s ease-in-out infinite}
.lp-shadow{position:absolute;z-index:2;left:50%;top:80%;width:58%;height:7%;transform:translateX(-50%);border-radius:50%;background:radial-gradient(ellipse,#4e789b45,transparent 70%);animation:lp-shadow 6s ease-in-out infinite}
.lp-laser{position:absolute;z-index:4;left:calc(52.5% - 5px);top:20%;width:10px;height:10px;border-radius:50%;background:#2dd4bf;box-shadow:0 0 0 0 #2dd4bfaa;animation:lp-ping 2s infinite,lp-hover 6s ease-in-out infinite}
.lp-chip{position:absolute;z-index:5;display:flex;align-items:center;gap:10px;padding:10px 14px;border:1px solid #ffffff26;border-radius:14px;background:#0b2547b3;backdrop-filter:blur(14px);box-shadow:0 18px 36px -16px #000c;color:#e6f2ff;font-size:13px;font-weight:600;white-space:nowrap;animation:lp-bob 5s ease-in-out infinite}
.lp-chip i{display:grid;place-items:center;width:30px;height:30px;border-radius:9px;font-style:normal}
.lp-chip i svg{width:16px;height:16px}
.lp-chip small{display:block;color:#8fb3d9;font-size:11px;font-weight:500}
.lp-chip--lidar{left:-2%;top:16%}.lp-chip--lidar i{background:#2dd4bf26;color:#5eead4}
.lp-chip--cam{right:-2%;top:30%;animation-delay:-1.6s}.lp-chip--cam i{background:#a78bfa26;color:#c4b5fd}
.lp-chip--bat{right:4%;bottom:12%;animation-delay:-3.2s}.lp-chip--bat i{background:#4ade8026;color:#86efac}
.lp-bat{width:64px;height:6px;margin-top:5px;border-radius:9px;background:#ffffff1f;overflow:hidden}
.lp-bat:after{content:"";display:block;width:87%;height:100%;border-radius:9px;background:linear-gradient(90deg,#4ade80,#2dd4bf);animation:lp-fill 2.4s .8s cubic-bezier(.2,.8,.2,1) both}

/* ---------- Marquee ---------- */
.lp-marquee{position:relative;z-index:2;margin:-28px auto 0;max-width:1240px;padding:0 24px}
.lp-marquee-track{overflow:hidden;padding:18px 0;border:1px solid var(--line);border-radius:20px;background:#fff;box-shadow:0 20px 40px -24px #0f2a4a40;mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)}
.lp-marquee-inner{display:flex;gap:44px;width:max-content;animation:lp-marquee 28s linear infinite}
.lp-marquee-inner span{display:inline-flex;align-items:center;gap:10px;color:var(--muted);font-size:15px;font-weight:700}
.lp-marquee-inner span:before{content:"";width:8px;height:8px;border-radius:3px;background:linear-gradient(135deg,#1f8fff,#2dd4bf);transform:rotate(45deg)}

/* ---------- Sections ---------- */
.lp-section{max-width:1240px;margin:auto;padding:110px 24px 40px}
.lp-eyebrow{display:inline-flex;align-items:center;gap:8px;color:var(--sky);font-size:12px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase}
.lp-eyebrow:before{content:"";width:22px;height:2px;border-radius:2px;background:linear-gradient(90deg,#1f8fff,#2dd4bf)}
.lp-section h2{margin:14px 0 0;font-size:clamp(32px,3.6vw,48px);line-height:1.3;letter-spacing:-.025em;font-weight:800;text-wrap:balance}
.lp-section h2 em{font-style:normal;background:linear-gradient(90deg,#1f8fff,#2dd4bf);-webkit-background-clip:text;background-clip:text;color:transparent}
.lp-lead{max-width:600px;margin:16px 0 0;color:var(--muted);font-size:17px;line-height:1.65}
.lp-head-row{display:flex;align-items:flex-end;justify-content:space-between;gap:30px}

/* Features */
.lp-features{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;margin-top:48px}
.lp-card{position:relative;isolation:isolate;display:flex;flex-direction:column;gap:16px;min-height:330px;padding:30px;border:1px solid var(--line);border-radius:26px;background:#fff;overflow:hidden;transition:transform .4s cubic-bezier(.2,.8,.2,1),box-shadow .4s,border-color .4s}
.lp-card:before{content:"";position:absolute;z-index:-1;width:260px;height:260px;right:-90px;top:-90px;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--c,#1f8fff) 22%,transparent),transparent 70%);transition:transform .6s}
.lp-card:hover{transform:translateY(-8px);border-color:transparent;box-shadow:0 30px 60px -28px #0f2a4a55,0 0 0 1.5px color-mix(in srgb,var(--c,#1f8fff) 40%,transparent)}
.lp-card:hover:before{transform:scale(1.6)}
.lp-card-icon{display:grid;place-items:center;width:56px;height:56px;border-radius:17px;background:linear-gradient(135deg,var(--c,#1f8fff),var(--c2,#38bdf8));color:#fff;box-shadow:0 12px 24px -10px var(--c,#1f8fff)}
.lp-card-icon svg{width:26px;height:26px}
.lp-card-tag{position:absolute;top:30px;right:30px;color:#9fb6d0;font-size:12px;font-weight:800;letter-spacing:1px}
.lp-card h3{margin:8px 0 0;font-size:23px;line-height:1.35;letter-spacing:-.4px}
.lp-card p{margin:0;color:var(--muted);font-size:15px;line-height:1.6}
.lp-card-foot{display:flex;align-items:center;gap:10px;margin-top:auto;padding:13px 15px;border-radius:14px;background:#f2f8ff;color:var(--ink);font-size:13px;font-weight:700}
.lp-card-foot:before{content:"";width:8px;height:8px;border-radius:50%;background:var(--c,#1f8fff);box-shadow:0 0 0 4px color-mix(in srgb,var(--c,#1f8fff) 20%,transparent);animation:lp-blink 2s infinite}
.lp-card--featured{background:linear-gradient(160deg,#0b2547,#0f3a6e);border-color:transparent;color:#fff}
.lp-card--featured p{color:#a9c4e2}.lp-card--featured .lp-card-foot{background:#ffffff14;color:#fff}.lp-card--featured .lp-card-tag{color:#6f93bb}

/* Robot spec */
.lp-spec{display:grid;grid-template-columns:1.1fr 1fr;gap:60px;align-items:center;margin-top:20px}
.lp-spec-visual{position:relative;aspect-ratio:1.15;border-radius:32px;background:radial-gradient(circle at 50% 55%,#e0f2ff 0%,#f6faff 60%),#f6faff;border:1px solid var(--line);overflow:hidden}
.lp-spec-visual:before{content:"";position:absolute;inset:0;background-image:radial-gradient(#1f8fff22 1.2px,transparent 1.2px);background-size:22px 22px;mask-image:radial-gradient(circle at 50% 50%,#000 30%,transparent 75%)}
.lp-spec-visual img{position:absolute;left:50%;top:50%;width:84%;transform:translate(-50%,-50%);filter:drop-shadow(0 30px 28px #0f2a4a40);transition:transform .6s cubic-bezier(.2,.8,.2,1)}
.lp-spec-visual:hover img{transform:translate(-50%,-52%) scale(1.03)}
.lp-hotspot{position:absolute;z-index:2;width:18px;height:18px;border:0;padding:0;border-radius:50%;background:#1f8fff;box-shadow:0 0 0 5px #1f8fff33;cursor:default}
.lp-hotspot:before{content:"";position:absolute;inset:-5px;border-radius:50%;border:2px solid #1f8fff;animation:lp-ping-ring 2s infinite}
.lp-hotspot span{position:absolute;left:50%;bottom:calc(100% + 12px);transform:translateX(-50%) translateY(6px);padding:7px 11px;border-radius:9px;background:var(--ink);color:#fff;font-size:12px;font-weight:700;white-space:nowrap;opacity:0;pointer-events:none;transition:.25s}
.lp-hotspot:hover span,.lp-spec-visual:hover .lp-hotspot span{opacity:1;transform:translateX(-50%) translateY(0)}
.lp-hs-1{left:52%;top:19%}.lp-hs-2{left:32%;top:41%}.lp-hs-3{left:65%;top:45%}.lp-hs-4{left:61%;top:70%}
.lp-spec-list{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:30px}
.lp-spec-item{display:flex;gap:14px;padding:18px;border:1px solid var(--line);border-radius:18px;background:#fff;transition:.3s}
.lp-spec-item:hover{transform:translateY(-4px);border-color:#bfe0ff;box-shadow:0 18px 36px -22px #1f8fff88}
.lp-spec-item i{flex:0 0 auto;display:grid;place-items:center;width:42px;height:42px;border-radius:12px;background:#e8f4ff;color:var(--sky);font-style:normal}
.lp-spec-item i svg{width:20px;height:20px}
.lp-spec-item b{display:block;font-size:15px}
.lp-spec-item span{color:var(--muted);font-size:13px;line-height:1.45}

/* Steps */
.lp-steps{position:relative;display:grid;grid-template-columns:repeat(3,1fr);gap:26px;margin-top:54px}
.lp-steps:before{content:"";position:absolute;left:8%;right:8%;top:34px;height:2px;background:repeating-linear-gradient(90deg,#bfe0ff 0 8px,transparent 8px 16px)}
.lp-steps:after{content:"";position:absolute;left:8%;top:34px;width:0;height:2px;background:linear-gradient(90deg,#1f8fff,#2dd4bf);transition:width 1.8s .3s cubic-bezier(.2,.8,.2,1)}
.lp-steps.is-visible:after{width:84%}
.lp-step{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:12px;padding:0 6px}
.lp-step-num{position:relative;z-index:1;display:grid;place-items:center;width:68px;height:68px;border-radius:22px;background:#fff;border:1px solid var(--line);box-shadow:0 14px 30px -18px #1f8fff99;color:var(--sky);font-size:22px;font-weight:800;transition:.35s}
.lp-step:hover .lp-step-num{background:linear-gradient(135deg,#1f8fff,#2dd4bf);color:#fff;transform:rotate(-6deg) scale(1.06)}
.lp-step h3{margin:10px 0 0;font-size:20px;letter-spacing:-.4px}
.lp-step p{margin:0;color:var(--muted);font-size:15px;line-height:1.6}

/* CTA */
.lp-cta-wrap{max-width:1240px;margin:auto;padding:100px 24px 110px}
.lp-cta{position:relative;isolation:isolate;display:grid;grid-template-columns:1.2fr 1fr;align-items:center;gap:30px;min-height:300px;padding:56px 60px;border-radius:32px;background:linear-gradient(120deg,#0b2547,#0f4c8a 55%,#0d7f8f);color:#fff;overflow:hidden}
.lp-cta:before{content:"";position:absolute;z-index:-1;inset:0;background-image:linear-gradient(#ffffff10 1px,transparent 1px),linear-gradient(90deg,#ffffff10 1px,transparent 1px);background-size:40px 40px;mask-image:linear-gradient(90deg,transparent,#000)}
.lp-cta:after{content:"";position:absolute;z-index:-1;right:-80px;top:-120px;width:420px;height:420px;border-radius:50%;background:radial-gradient(circle,#38bdf866,transparent 65%);animation:lp-glow 6s ease-in-out infinite}
.lp-cta h2{margin:0 0 14px;font-size:clamp(30px,3.4vw,44px);letter-spacing:-.025em;line-height:1.3;text-wrap:balance}
.lp-cta p{margin:0 0 28px;color:#b9d5f0;font-size:17px;line-height:1.6}
.lp-cta .lp-actions{animation:none}
.lp-cta-robot{position:relative;height:100%;min-height:220px}
.lp-cta-robot img{position:absolute;right:-10px;bottom:-70px;width:min(440px,115%);filter:drop-shadow(0 30px 30px #0009);animation:lp-drive 7s ease-in-out infinite}

/* ---------- Footer ---------- */
.lp-footer{background:#061427;color:#b9d5eb}
.lp-footer-main{max-width:1240px;margin:auto;padding:64px 24px 52px;display:grid;grid-template-columns:1.05fr 1.45fr;gap:70px}
.lp-footer-brand{display:flex;flex-direction:column;align-items:flex-start;gap:18px}
.lp-footer-brand p{max-width:300px;margin:0;color:#8fb3d9;font-size:15px;line-height:1.6}
.lp-footer-login{padding:0;border:0;background:none;color:#5eead4;font-size:14px;font-weight:700;transition:.2s}
.lp-footer-login:hover{color:#fff;transform:translateX(3px)}
.lp-footer-links{display:grid;grid-template-columns:repeat(3,1fr);gap:28px}
.lp-footer-links>div{display:flex;flex-direction:column;align-items:flex-start;gap:12px}
.lp-footer-links b{color:#fff;font-size:14px}
.lp-footer-links button{padding:0;border:0;background:none;color:#8fb3d9;font-size:14px;transition:.2s}
.lp-footer-links button:hover{color:#fff}
.lp-footer-links span{color:#8fb3d9;font-size:14px;line-height:1.6}
.lp-footer-bottom{max-width:1240px;margin:auto;padding:22px 24px;border-top:1px solid #ffffff14;display:flex;justify-content:space-between;color:#6f93bb;font-size:13px}

/* ---------- Reveal ---------- */
[data-reveal]{opacity:0;transform:translateY(34px);transition:opacity .9s cubic-bezier(.2,.8,.2,1),transform .9s cubic-bezier(.2,.8,.2,1);transition-delay:var(--d,0s)}
[data-reveal].is-visible{opacity:1;transform:none}

/* ---------- Keyframes ---------- */
@keyframes lp-gradient{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
@keyframes lp-rise{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
@keyframes lp-drop{from{opacity:0;transform:translate(-50%,-20px)}to{opacity:1;transform:translate(-50%,0)}}
@keyframes lp-zoom{from{opacity:0;transform:scale(.9)}to{opacity:1;transform:none}}
@keyframes lp-blink{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes lp-grid{to{background-position:56px 56px}}
@keyframes lp-float-blob{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(40px,-30px) scale(1.08)}66%{transform:translate(-30px,30px) scale(.95)}}
@keyframes lp-breathe{0%,100%{opacity:.85;transform:translate(-50%,-50%) scale(1)}50%{opacity:1;transform:translate(-50%,-50%) scale(1.06)}}
@keyframes lp-pulse{0%{opacity:.9;width:30%}100%{opacity:0;width:100%}}
@keyframes lp-spin{to{transform:rotate(360deg)}}
@keyframes lp-glow{0%,100%{opacity:.7;transform:scale(1)}50%{opacity:1;transform:scale(1.12)}}
@keyframes lp-hover{0%,100%{translate:0 0}50%{translate:0 -14px}}
@keyframes lp-shadow{0%,100%{opacity:1;width:58%}50%{opacity:.6;width:50%}}
@keyframes lp-ping{0%{box-shadow:0 0 0 0 #2dd4bfaa}100%{box-shadow:0 0 0 18px #2dd4bf00}}
@keyframes lp-ping-ring{0%{transform:scale(.8);opacity:1}100%{transform:scale(2.1);opacity:0}}
@keyframes lp-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
@keyframes lp-fill{from{width:0}}
@keyframes lp-marquee{to{transform:translateX(-50%)}}
@keyframes lp-drive{0%,100%{transform:translateX(0) rotate(0)}50%{transform:translateX(-24px) rotate(-1.5deg)}}

/* ---------- Responsive ---------- */
@media(max-width:1000px){
  .lp-hero-inner,.lp-spec{grid-template-columns:1fr}
  .lp-stage{max-width:620px;margin:20px auto 0}
  .lp-features{grid-template-columns:1fr 1fr}.lp-features .lp-card:first-child{grid-column:span 2}
  .lp-cta{grid-template-columns:1fr;padding:48px 36px}.lp-cta-robot{min-height:200px}.lp-cta-robot img{position:relative;right:auto;bottom:-40px;margin:auto;display:block;width:min(380px,90%)}
  .lp-footer-main{grid-template-columns:1fr;gap:40px}
  .lp-nav-link{display:none}
}
@media(max-width:640px){
  .lp-header{top:12px;width:calc(100% - 24px);height:64px;padding:0 10px 0 14px;gap:12px}
  .lp-logo-text small,.lp-nav .lp-btn--ghost{display:none}
  .lp-logo-text b{font-size:17px}
  .lp-header .lp-logo-text b{font-size:15px}
  .lp-header .lp-nav .lp-btn{padding:0 12px;font-size:13px}
  .lp-hero{padding:120px 18px 90px}
  .lp-hero h1{letter-spacing:-.02em}
  .lp-hero-copy>p{font-size:16px}
  .lp-actions{width:100%;flex-direction:column}.lp-actions .lp-btn{width:100%}
  .lp-stats{gap:20px;flex-wrap:wrap}
  .lp-chip{font-size:12px;padding:8px 10px}.lp-chip small{display:none}.lp-chip--cam{right:0}
  .lp-section{padding:80px 18px 20px}
  .lp-head-row{flex-direction:column;align-items:flex-start}
  .lp-features,.lp-steps,.lp-spec-list{grid-template-columns:1fr}.lp-features .lp-card:first-child{grid-column:auto}
  .lp-steps:before,.lp-steps:after{display:none}
  .lp-cta-wrap{padding:70px 18px 80px}.lp-cta{padding:40px 24px;border-radius:26px}
  .lp-footer-links{grid-template-columns:1fr 1fr}.lp-footer-links>div:last-child{grid-column:span 2}
  .lp-footer-bottom{flex-direction:column;gap:8px}
}
@media(max-width:380px){.lp-header .lp-logo-text{display:none}}
@media(prefers-reduced-motion:reduce){.landing-page *,.landing-page *:before,.landing-page *:after{animation:none!important;transition:none!important}[data-reveal]{opacity:1;transform:none}}
`;
injectStyles('mediassist-style-pages-Landing-LandingPage-v2', inlineStyles);

/* ---------- Inline icons ---------- */
const Icon = {
  arrow: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
  shield: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3z" /><path d="M9 12l2 2 4-4" /></svg>,
  clock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>,
  heart: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 8.6a5 5 0 00-8.8-3.2 5 5 0 00-8.8 3.2c0 5.4 8.8 11 8.8 11s8.8-5.6 8.8-11z" /><path d="M7 12h3l1.5-2.5L13 14l1.5-2H17" /></svg>,
  users: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0113 0M16 4.5a3.5 3.5 0 010 7M18 14.5a6.5 6.5 0 013.5 5.5" /></svg>,
  box: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8" /></svg>,
  guide: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0119 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>,
  monitor: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="12" rx="2.5" /><path d="M8 20h8M12 16v4M7 12l3-3 2 2 4-4" /></svg>,
};

const features = [
  { tag: '01', icon: Icon.box, c: '#1f8fff', c2: '#38bdf8', title: 'Mỗi chuyến giao hàng, một điểm đến rõ ràng.', text: 'Điều phối vật tư y tế từ lúc nhận đến khi bàn giao, tự động lập lộ trình tối ưu giữa các khoa.', foot: 'Khoa Dược  →  Phòng 305', featured: true },
  { tag: '02', icon: Icon.guide, c: '#14b8a6', c2: '#2dd4bf', title: 'Người dẫn đường quen thuộc ở nơi xa lạ.', text: 'Hỗ trợ bệnh nhân và người nhà tìm đúng phòng khám, quầy xét nghiệm hay khu điều trị.', foot: 'Dẫn đường bệnh nhân' },
  { tag: '03', icon: Icon.monitor, c: '#8b5cf6', c2: '#a78bfa', title: 'Toàn bộ vận hành trong một màn hình.', text: 'Theo dõi nhiệm vụ, bản đồ và trạng thái robot theo thời gian thực trong một không gian làm việc.', foot: 'Giám sát trực tiếp' },
];

const specs = [
  { icon: Icon.clock, title: 'Vận hành 24/7', text: 'Hỗ trợ liên tục cả ca ngày lẫn ca đêm' },
  { icon: Icon.shield, title: 'An toàn trong bệnh viện', text: 'Di chuyển chậm rãi, tự tránh người và vật cản' },
  { icon: Icon.heart, title: 'Giảm tải cho điều dưỡng', text: 'Nhận các chuyến vận chuyển lặp lại mỗi ngày' },
  { icon: Icon.users, title: 'Thân thiện với bệnh nhân', text: 'Dẫn đường và thông báo rõ ràng, dễ hiểu' },
];

const steps = [
  ['01', 'Thiết lập khu vực', 'Quản trị viên cấu hình bản đồ khoa phòng, điểm nhận – giao và các quy trình mẫu.'],
  ['02', 'Gửi yêu cầu', 'Điều dưỡng hoặc nhân viên tạo nhiệm vụ chỉ với một cú nhấp từ máy trạm.'],
  ['03', 'Theo dõi & hoàn tất', 'MediAssistRover thực hiện nhiệm vụ, đội ngũ theo dõi tiến độ và nhận xác nhận khi hoàn tất.'],
];

const marquee = ['Giao thuốc & vật tư y tế', 'Dẫn đường bệnh nhân', 'Vận chuyển mẫu xét nghiệm', 'Thông báo bằng giọng nói', 'Kết nối các khoa phòng', 'Giám sát thời gian thực', 'Quản lý ca trực', 'Điều phối nhiều robot'];

function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return undefined;
    const nodes = root.querySelectorAll('[data-reveal], .lp-steps');
    if (!('IntersectionObserver' in window)) { nodes.forEach(n => n.classList.add('is-visible')); return undefined; }
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
    }), { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    nodes.forEach(n => io.observe(n));
    return () => io.disconnect();
  }, []);
  return ref;
}

function Logo() {
  return <span className="lp-logo" role="img" aria-label="MediAssistRover">
    <span className="lp-logo-mark"><BrandMark /></span>
    <span className="lp-logo-text"><b>MediAssist<span>Rover</span></b><small>{vi('HOSPITAL SERVICE ROBOTICS')}</small></span>
  </span>;
}

export default function LandingPage({ onLogin, onRegister }) {
  const rootRef = useReveal();
  const scrollTo = id => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return <div className="landing-page" ref={rootRef}>
    <header className="lp-header">
      <Logo />
      <nav className="lp-nav" aria-label={vi('Primary navigation')}>
        <button id="nav-features" className="lp-nav-link" onClick={() => scrollTo('features')}>{vi('Features')}</button>
        <button id="nav-robot" className="lp-nav-link" onClick={() => scrollTo('robot')}>Giới thiệu</button>
        <button id="nav-how" className="lp-nav-link" onClick={() => scrollTo('how-it-works')}>{vi('How it works')}</button>
        <button id="nav-login" type="button" className="lp-btn lp-btn--ghost" onClick={onLogin}>{vi('Log in')}</button>
        <button id="nav-register" type="button" className="lp-btn lp-btn--primary" onClick={onRegister}>Yêu cầu tài khoản</button>
      </nav>
    </header>

    <main>
      <section className="lp-hero">
        <div className="lp-grid-bg" aria-hidden="true" />
        <div className="lp-aurora lp-aurora--1" aria-hidden="true" />
        <div className="lp-aurora lp-aurora--2" aria-hidden="true" />
        <div className="lp-aurora lp-aurora--3" aria-hidden="true" />

        <div className="lp-hero-inner">
          <div className="lp-hero-copy">
            <span className="lp-badge"><i>LIVE</i>Robot dịch vụ bệnh viện thông minh</span>
            <h1>Thêm thời gian cho <em>sự chăm sóc</em> của con người.</h1>
            <p>{vi('MediAssistRover quietly takes care of the little journeys, so your team can stay present for the moments that matter.')}</p>
            <div className="lp-actions">
              <button id="hero-register" type="button" className="lp-btn lp-btn--primary" onClick={onRegister}>Yêu cầu tài khoản {Icon.arrow}</button>
              <button id="hero-login" type="button" className="lp-btn lp-btn--ghost" onClick={onLogin}>{vi('Log in to workspace')}</button>
            </div>
            <div className="lp-stats">
              <div><b>24/7</b><span>Hỗ trợ đội ngũ y tế</span></div>
              <div><b>Mọi khoa</b><span>Kết nối liền mạch</span></div>
              <div><b>1 chạm</b><span>Giao nhiệm vụ</span></div>
            </div>
          </div>

          <figure className="lp-stage">
            <div className="lp-stage-glow" aria-hidden="true" />
            <div className="lp-ring lp-ring--static" aria-hidden="true" />
            <div className="lp-ring lp-ring--pulse" aria-hidden="true" />
            <div className="lp-ring lp-ring--pulse d2" aria-hidden="true" />
            <div className="lp-ring lp-ring--pulse d3" aria-hidden="true" />
            <div className="lp-shadow" aria-hidden="true" />
            <RobotIllustration className="lp-robot" />

          </figure>
        </div>
      </section>

      <div className="lp-marquee" aria-hidden="true">
        <div className="lp-marquee-track">
          <div className="lp-marquee-inner">{[...marquee, ...marquee].map((m, i) => <span key={i}>{m}</span>)}</div>
        </div>
      </div>

      <section id="features" className="lp-section">
        <div className="lp-head-row" data-reveal="">
          <div>
            <span className="lp-eyebrow">Tính năng</span>
            <h2>Ít đi lại hơn.<br /><em>Nhiều thời gian chăm sóc hơn.</em></h2>
          </div>
          <p className="lp-lead">{vi('Practical support for the moments that keep your hospital moving.')}</p>
        </div>
        <div className="lp-features">
          {features.map((f, i) => <article key={f.tag} data-reveal="" style={{ '--d': `${i * 0.12}s`, '--c': f.c, '--c2': f.c2 }} className={`lp-card ${f.featured ? 'lp-card--featured' : ''}`}>
            <span className="lp-card-tag">{f.tag}</span>
            <span className="lp-card-icon">{f.icon}</span>
            <h3>{f.title}</h3>
            <p>{f.text}</p>
            <div className="lp-card-foot">{f.foot}</div>
          </article>)}
        </div>
      </section>

      <section id="robot" className="lp-section">
        <div className="lp-spec">
          <div className="lp-spec-visual" data-reveal="">
            <img src={robotImage} alt="Robot MediAssistRover" loading="lazy" />
          </div>
          <div data-reveal="" style={{ '--d': '.15s' }}>
            <span className="lp-eyebrow">Về MediAssistRover</span>
            <h2>Người đồng hành <em>thầm lặng</em> của đội ngũ y tế.</h2>
            <p className="lp-lead">MediAssistRover là robot dịch vụ dành riêng cho bệnh viện: đảm nhận những chuyến di chuyển lặp đi lặp lại giữa các khoa phòng, để bác sĩ và điều dưỡng dành trọn thời gian cho người bệnh.</p>
            <div className="lp-spec-list">
              {specs.map(s => <div key={s.title} className="lp-spec-item"><i>{s.icon}</i><div><b>{s.title}</b><span>{s.text}</span></div></div>)}
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="lp-section">
        <div data-reveal="">
          <span className="lp-eyebrow">{vi('Simple by design')}</span>
          <h2>Kết nối chu đáo.<br /><em>Từ yêu cầu đến khi tới nơi.</em></h2>
        </div>
        <div className="lp-steps">
          {steps.map(([n, title, text], i) => <article key={n} className="lp-step" data-reveal="" style={{ '--d': `${i * 0.15}s` }}>
            <span className="lp-step-num">{n}</span>
            <h3>{title}</h3>
            <p>{text}</p>
          </article>)}
        </div>
      </section>

      <div className="lp-cta-wrap">
        <section className="lp-cta" data-reveal="">
          <div>
            <h2>{vi('A better flow starts here.')}</h2>
            <p>{vi('Give your team a workspace that moves with them.')}</p>
            <div className="lp-actions">
              <button id="cta-register" type="button" className="lp-btn lp-btn--primary" onClick={onRegister}>Yêu cầu tài khoản {Icon.arrow}</button>
              <button id="cta-login" type="button" className="lp-btn lp-btn--ghost" onClick={onLogin}>{vi('Log in')}</button>
            </div>
          </div>
          <div className="lp-cta-robot"><img src={robotImage} alt="" loading="lazy" /></div>
        </section>
      </div>
    </main>

    <footer className="lp-footer">
      <div className="lp-footer-main">
        <div className="lp-footer-brand">
          <Logo />
          <p>{vi('A calmer, more connected way to care.')}</p>
          <button className="lp-footer-login" onClick={onLogin}>{vi('Log in to your workspace →')}</button>
        </div>
        <div className="lp-footer-links">
          <div><b>{vi('Explore')}</b><button onClick={() => scrollTo('features')}>{vi('What we do')}</button><button onClick={() => scrollTo('robot')}>Về MediAssistRover</button><button onClick={() => scrollTo('how-it-works')}>{vi('How it works')}</button></div>
          <div><b>{vi('Workspace')}</b><button onClick={onLogin}>{vi('Log in')}</button><button onClick={onRegister}>Yêu cầu tài khoản</button></div>
          <div><b>{vi('Built for care teams')}</b><span>{vi('Purposeful robotics.')}<br />{vi('Human-centered care.')}</span></div>
        </div>
      </div>
      <div className="lp-footer-bottom"><span>{vi('© 2026 MediAssistRover. All rights reserved.')}</span><span>{vi('Private & secure hospital workspace')}</span></div>
    </footer>
  </div>;
}
