from pathlib import Path

p = Path(r"C:\Users\eduar\Documents\GitHub\controle_contas\mobile\www\cc-bridge.js")
text = p.read_text(encoding="utf-8")

start = text.find("  // Modo apresent")
if start < 0:
    start = text.find("setupWhatsAppPresentation")
    if start < 0:
        raise SystemExit("block not found")
    start = text.rfind("\n", 0, start) + 1

end = text.find("  function LN()", start)
if end < 0:
    raise SystemExit("LN not found")

new_block = """  // Status bar sempre visivel; conteudo nao cobre hora/bateria
  (function setupStatusBarVisible() {
    try {
      var SB = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.StatusBar;
      if (SB) {
        if (SB.setOverlaysWebView) SB.setOverlaysWebView({ overlay: false });
        if (SB.setBackgroundColor) SB.setBackgroundColor({ color: '#ffffff' });
        if (SB.setStyle) SB.setStyle({ style: 'DARK' });
        if (SB.show) SB.show();
      }
      var old = document.getElementById('cc-safe-area-style');
      if (old) old.remove();
    } catch (_) {}
  })();

"""

p.write_text(text[:start] + new_block + text[end:], encoding="utf-8")
print("bridge updated ok")
