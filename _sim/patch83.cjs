const fs = require('fs');
function patch(f, pairs) {
  let t = fs.readFileSync(f, 'utf8');
  const crlf = t.includes('\r\n');
  t = t.split('\r\n').join('\n');
  for (const [a, b] of pairs) { if (!t.includes(a)) throw new Error(f + ' NF: ' + a.slice(0, 60)); t = t.replace(a, () => b); }
  fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
}
patch('src/pages/Home.tsx', [
  ["      {/* Carousel 4 */}\n      <SmoothCarousel triplets={carousel4Triplets} speed={40} />\n\n      <div className=\"divider\"></div>\n\n", ""],
  ["        </div>\n      </section>\n    </div>\n  );\n};\n\nexport default Home;", "        </div>\n      </section>\n\n      <div className=\"divider\"></div>\n\n      {/* Carousel 4 (firefighter, Kool-Aid Man), at the very bottom under the map */}\n      <SmoothCarousel triplets={carousel4Triplets} speed={40} />\n    </div>\n  );\n};\n\nexport default Home;"],
]);
patch('src/components/ChatEstimator/ChatPanel.tsx', [
  ["      }, 1400); // brief pause so the user sees the wrap-up message", "      }, 1500); // the paintbrush spinner shows for 1.5 seconds, then the customer moves on to pick their painter"],
  ["              <div className=\"chat-bubble-text chat-loading\">Preparing your results…</div>", "              <div className=\"chat-bubble-text chat-loading chat-preparing\">\n                <svg className=\"chat-brush-spinner\" viewBox=\"0 0 48 48\" width=\"34\" height=\"34\" aria-hidden=\"true\">\n                  <g className=\"chat-brush-swing\">\n                    <rect x=\"22\" y=\"2\" width=\"5\" height=\"22\" rx=\"2.5\" fill=\"#8a5a2b\" />\n                    <rect x=\"20\" y=\"22\" width=\"9\" height=\"7\" rx=\"1\" fill=\"#b9bec6\" />\n                    <path d=\"M19.5 29 h10 l-1 14 q-4 3 -8 0 z\" fill=\"#ff8a3d\" />\n                  </g>\n                </svg>\n                <span>Preparing your results…</span>\n              </div>"],
]);
fs.appendFileSync('src/styles/chat-estimator.css', `
/* Paintbrush spinner shown while the price is being prepared (1.5 seconds before the painter page) */
.chat-preparing {
  display: flex;
  align-items: center;
  gap: 10px;
}

.chat-brush-swing {
  transform-origin: 24px 4px;
  animation: chat-brush-swing 0.75s ease-in-out infinite alternate;
}

@keyframes chat-brush-swing {
  from { transform: rotate(-28deg); }
  to { transform: rotate(28deg); }
}

@media (prefers-reduced-motion: reduce) {
  .chat-brush-swing { animation: none; }
}
`);
