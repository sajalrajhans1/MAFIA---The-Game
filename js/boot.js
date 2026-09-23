// Runs first, as a plain script. Phones and tablets get a "made for PC" screen (and never download
// the 3D engine); computers get PeerJS (pinned and integrity-checked) and then the game itself.
(function () {
  var app = document.getElementById('app');

  if (location.protocol === 'file:') {
    app.innerHTML = '<div class="overlay"><div class="panel modal-box"><h2>ONE MORE STEP</h2><p>Browsers block games opened straight from a file.</p>' +
      '<p>Run <kbd>python serve.py</kbd> in the game folder (or double-click <b>start.bat</b> on Windows), then open <b>http://localhost:8080</b>.</p></div></div>';
    return;
  }

  var ua = navigator.userAgent || '';
  var mq = function (q) { return !!(window.matchMedia && window.matchMedia(q).matches); };
  var touchOnly = mq('(pointer: coarse)') && !mq('(any-pointer: fine)');
  var handheld = (navigator.userAgentData && navigator.userAgentData.mobile) ||
    /Android|iPhone|iPad|iPod|Mobile|Tablet|Silk|Kindle|PlayBook|BlackBerry|BB10|Opera Mini|IEMobile|webOS/i.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) || // iPads report themselves as Macs
    touchOnly;

  if (handheld) {
    document.body.classList.add('pc-only');
    app.innerHTML =
      '<section class="pc-screen">' +
        '<div class="title-art"></div><div class="title-shade"></div>' +
        '<div class="panel pc-box">' +
          '<div class="logo-kicker">A GAME OF CARDS &amp; LIES</div>' +
          '<div class="logo-main">MAFIA</div>' +
          '<div class="logo-suits"><span>&#9824;</span><span class="r">&#9829;</span><span class="r">&#9830;</span><span>&#9827;</span></div>' +
          '<h2>THIS GAME IS ONLY FOR PC</h2>' +
          '<p>Please open the website on a PC to fully enjoy the game.</p>' +
          '<button class="btn primary" id="pcCopy">COPY THE LINK</button>' +
          '<div class="pc-note" id="pcNote">Send it to yourself and open it on your computer.</div>' +
        '</div>' +
      '</section>';
    var btn = document.getElementById('pcCopy');
    btn.addEventListener('click', function () {
      var url = location.origin + location.pathname + location.search;
      var done = function () { document.getElementById('pcNote').textContent = 'Link copied. Open it on your computer.'; btn.textContent = 'COPIED'; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, function () { window.prompt('Copy this link:', url); });
      else window.prompt('Copy this link:', url);
    });
    return;
  }

  var peer = document.createElement('script');
  peer.src = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
  peer.integrity = 'sha384-nlUQ8ZqCbvStErob+biJNzSgltf6urV3VGqhfIfzhmg9RXmpeRm76ELw0pYnKlTR';
  peer.crossOrigin = 'anonymous';
  peer.referrerPolicy = 'no-referrer';
  document.head.appendChild(peer);

  var main = document.createElement('script');
  main.type = 'module';
  main.src = 'js/main.js';
  document.body.appendChild(main);
})();
