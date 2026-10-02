# Candence — website

## View it
Double-click `index.html`. It opens in your browser. An internet connection is needed for the 3D library (Three.js) and the fonts.

## Shareable link
A copy is published at https://claude.ai/artifact/TSBAddB2RCfYCCpbEpGqha. It starts private: open it, use the **Share** menu and make it public, then send the link to anyone.

## Before you launch
- **Store links:** in `index.html`, find the two `href="#"` links in the "Your next PB" section and paste your App Store / Google Play URLs.
- **Screenshots:** the images in `assets/screens/` are your app screenshots, which show the profile name "Jonathan". Swap in screenshots with a demo name if you prefer.

## Your own domain (later, also free)
Upload the whole `website` folder to any static host, for example Netlify Drop (drag the folder in), Cloudflare Pages or GitHub Pages. No build step is needed.

## What's where
| File | What it does |
| --- | --- |
| `index.html` | All page content and copy |
| `css/style.css` | Design: colours, fonts and layout (colours are at the top) |
| `js/cube.js` | The 3D cube: rendering, turning, notation |
| `js/main.js` | Scroll choreography and the hero's virtual cube race |
| `js/timer.js` | The working timer demo (inspection, Ao5/Ao12, PBs) |
| `js/sections.js` | Stats charts, coach, alg player, solver demo, phone carousel |
