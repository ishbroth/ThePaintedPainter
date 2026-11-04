const fs = require('fs');
const f = 'src/components/ChatEstimator/ChatPanel.tsx';
let t = fs.readFileSync(f, 'utf8');
const crlf = t.includes('\r\n');
t = t.split('\r\n').join('\n');
function rep(a, b) { if (!t.includes(a)) throw new Error('NF ' + a.slice(0, 70)); t = t.replace(a, () => b); }

rep("    let focused = false;\n    let open = false;\n    const update = () => {", `    let focused = false;
    let open = false;
    // The conversation area gets an exact height in pixels while the keypad window is up (the visible height minus the title and the
    // footer), so it always scrolls inside itself instead of stretching to fit its content, and is kept scrolled to the latest line.
    const fit = () => {
      const box = messagesRef.current;
      const card = box?.parentElement;
      if (!box || !card) return;
      const visible = vv ? vv.height : window.innerHeight;
      let others = 0;
      for (const child of Array.from(card.children)) if (child !== box) others += (child as HTMLElement).offsetHeight;
      const h = Math.max(80, Math.floor(visible - others));
      box.style.flex = 'none';
      box.style.height = \`\${h}px\`;
      box.style.maxHeight = \`\${h}px\`;
      box.style.minHeight = '0';
      box.scrollTop = box.scrollHeight;
    };
    const unfit = () => {
      const box = messagesRef.current;
      if (!box) return;
      box.style.flex = '';
      box.style.height = '';
      box.style.maxHeight = '';
      box.style.minHeight = '';
    };
    // ?kbdebug on the address shows the numbers below on screen (to see what a real phone reports)
    let debugBox: HTMLDivElement | null = null;
    if (new URLSearchParams(window.location.search).has('kbdebug')) {
      debugBox = document.createElement('div');
      debugBox.style.cssText = 'position:fixed;left:4px;bottom:4px;z-index:9999;background:rgba(0,0,0,.8);color:#0f0;font:11px monospace;padding:4px 6px;border-radius:4px;pointer-events:none;max-width:90vw';
      document.body.appendChild(debugBox);
    }
    const showDebug = () => {
      const box = messagesRef.current;
      if (!debugBox || !box) return;
      debugBox.textContent = \`open=\${open} vvh=\${Math.round(vv?.height ?? 0)} top=\${Math.round(vv?.offsetTop ?? 0)} box h=\${box.clientHeight} content=\${box.scrollHeight} scroll=\${Math.round(box.scrollTop)}\`;
    };
    const update = () => {`);
rep("      // the window just changed size (the keypad moved): keep the latest line in view\n      if (nowOpen && messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight;\n      if (nowOpen === open) return;", "      // the window just changed size (the keypad moved): keep the exact height right and the latest line in view\n      if (nowOpen && open) fit();\n      if (nowOpen === open) {\n        showDebug();\n        return;\n      }");
rep("        section.classList.add('keyboard-open');\n        root.classList.add('chat-kbd-lock');\n        window.setTimeout(() => messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight }), 30);\n      } else {\n        section.classList.remove('keyboard-open');\n        root.classList.remove('chat-kbd-lock');\n        section.style.minHeight = '';\n      }\n    };", "        section.classList.add('keyboard-open');\n        root.classList.add('chat-kbd-lock');\n        fit();\n        window.requestAnimationFrame(fit);\n        window.setTimeout(fit, 60);\n        window.setTimeout(fit, 300);\n      } else {\n        section.classList.remove('keyboard-open');\n        root.classList.remove('chat-kbd-lock');\n        section.style.minHeight = '';\n        unfit();\n      }\n      showDebug();\n    };\n    // anything that changes in the conversation while the keypad is up (a new line, a reply, the words being typed) refits and scrolls\n    const box = messagesRef.current;\n    const observer = new MutationObserver(() => {\n      if (open) {\n        fit();\n        window.requestAnimationFrame(fit);\n      }\n      showDebug();\n    });\n    if (box) observer.observe(box, { childList: true, subtree: true, characterData: true });");
rep("      vv?.removeEventListener('scroll', update);\n      section.classList.remove('keyboard-open');\n      root.classList.remove('chat-kbd-lock');\n      section.style.minHeight = '';\n    };\n  }, [keyboardDevice]);", "      vv?.removeEventListener('scroll', update);\n      observer.disconnect();\n      debugBox?.remove();\n      unfit();\n      section.classList.remove('keyboard-open');\n      root.classList.remove('chat-kbd-lock');\n      section.style.minHeight = '';\n    };\n  }, [keyboardDevice]);");
fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
console.log('ok');
