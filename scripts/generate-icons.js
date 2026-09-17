const fs = require("fs");
const path = require("path");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <defs>
    <linearGradient id="flowdev-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2563eb" />
      <stop offset="50%" stop-color="#4f46e5" />
      <stop offset="100%" stop-color="#06b6d4" />
    </linearGradient>
    <linearGradient id="glow-grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.35" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
    </linearGradient>
  </defs>
  <rect width="32" height="32" rx="7" fill="url(#flowdev-grad)" />
  <rect width="32" height="16" rx="7" fill="url(#glow-grad)" />
  <g fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path d="M 8 16 L 14 16 C 18 16 18 10 22 10 L 24 10" />
    <path d="M 14 16 C 18 16 18 22 22 22 L 24 22" />
    <circle cx="8" cy="16" r="2.2" fill="#ffffff" stroke="#2563eb" stroke-width="1" />
    <circle cx="24" cy="10" r="2.2" fill="#38bdf8" stroke="#ffffff" stroke-width="1" />
    <circle cx="24" cy="22" r="2.2" fill="#818cf8" stroke="#ffffff" stroke-width="1" />
    <circle cx="16" cy="16" r="1.2" fill="#ffffff" stroke="none" />
  </g>
</svg>`;

const root = path.resolve(__dirname, "..");
fs.mkdirSync(path.join(root, "public"), { recursive: true });
fs.writeFileSync(path.join(root, "public", "favicon.svg"), svg, "utf-8");
fs.writeFileSync(path.join(root, "public", "favicon.ico"), svg, "utf-8");
fs.writeFileSync(path.join(root, "src", "app", "icon.svg"), svg, "utf-8");
fs.writeFileSync(path.join(root, "src", "app", "favicon.ico"), svg, "utf-8");
console.log("Icons generated successfully");
