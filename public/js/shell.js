(function () {
  const links = [
    ['/', 'Home'], ['/journey.html', 'Journey'], ['/highlights.html', 'Highlights'],
    ['/squad.html', 'Join the Squad'], ['/setup.html', 'Setup']
  ];
  const here = location.pathname === '/index.html' ? '/' : location.pathname;

  document.head.insertAdjacentHTML('beforeend',
    '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Rajdhani:wght@500;700&display=swap" rel="stylesheet">');

  const nav = links.map(([h, t]) =>
    `<a href="${h}" class="${h === here ? 'active' : ''}">${t}</a>`).join('');

  document.body.insertAdjacentHTML('afterbegin', `
    <header class="topbar">
      <a href="/" class="logo">TENZ<span>/</span>HUB</a>
      <button class="menu-btn" aria-label="Open menu" aria-expanded="false"><span></span></button>
    </header>
    <div class="overlay"></div>
    <nav class="sidebar" aria-label="Main">${nav}</nav>`);

  document.body.insertAdjacentHTML('beforeend', `
    <footer class="footer">
      <p><b>Unofficial fan project.</b> Not affiliated with, endorsed by, or connected to TenZ,
      his team, Riot Games, or any sponsor. All trademarks belong to their owners.</p>
    </footer>`);

  const btn = document.querySelector('.menu-btn');
  const bar = document.querySelector('.sidebar');
  const ov = document.querySelector('.overlay');
  const toggle = (open) => {
    bar.classList.toggle('open', open);
    ov.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open);
  };
  btn.addEventListener('click', () => toggle(!bar.classList.contains('open')));
  ov.addEventListener('click', () => toggle(false));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') toggle(false); });

  // reveal on scroll
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: .12 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
})();