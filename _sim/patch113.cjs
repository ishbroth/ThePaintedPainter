const fs = require('fs');
function patch(f, pairs) {
  let t = fs.readFileSync(f, 'utf8');
  const crlf = t.includes('\r\n');
  t = t.split('\r\n').join('\n');
  for (const [a, b] of pairs) { if (!t.includes(a)) throw new Error(f + ' NF: ' + a.slice(0, 60)); t = t.replace(a, () => b); }
  fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
}
patch('src/index.css', [
  [".carousel-slide {\n  width: 280px;\n  position: relative;", ".carousel-slide {\n  width: 322px;\n  position: relative;"],
  [".carousel-slide img {\n  width: 100%;\n  height: 200px;", ".carousel-slide img {\n  width: 100%;\n  height: 230px;"],
  ["  .carousel-slide {\n    width: 200px;\n  }\n\n  .carousel-slide img {\n    height: 150px;\n  }", "  .carousel-slide {\n    width: 230px;\n  }\n\n  .carousel-slide img {\n    height: 173px;\n  }"],
  ["  .carousel-slide {\n    width: 150px;\n  }\n\n  .carousel-slide img {\n    height: 120px;\n  }", "  .carousel-slide {\n    width: 173px;\n  }\n\n  .carousel-slide img {\n    height: 138px;\n  }"],
]);
// the pictures are 15% wider, so the scroll time grows 15% to keep the same speed on screen
let f = 'src/pages/Home.tsx';
let t = fs.readFileSync(f, 'utf8');
t = t.replace(/speed=\{43\.75\}/g, 'speed={50.3}').replace(/speed=\{50\}/g, 'speed={57.5}');
fs.writeFileSync(f, t);
