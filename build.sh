#!/bin/bash
set -e

# Get repository name for base path
REPO_NAME="${GITHUB_REPOSITORY##*/}"
if [ -z "$REPO_NAME" ]; then
  REPO_NAME="output_games"
fi

# Create dist directory for final output
rm -rf dist
mkdir -p dist

# Prevent Jekyll processing on GitHub Pages
touch dist/.nojekyll

# Games excluded from the index page (e.g. published on itch.io)
EXCLUDE="neon-sweep slime-grow sangokushi-ha-no-michi"

# Collect game directories
games=()
for dir in */; do
  name="${dir%/}"
  if [ -f "${dir}package.json" ] && [ -f "${dir}index.html" ] && ! echo "$EXCLUDE" | grep -qw "$name"; then
    games+=("$name")
  fi
done

# Build each game
for game in "${games[@]}"; do
  echo "=== Building $game ==="
  cd "$game"
  npm install
  npx vite build --base="/$REPO_NAME/$game/"
  cd ..
  cp -r "$game/dist" "dist/$game"
  echo "=== Done: $game ==="
done

GAME_COUNT=${#games[@]}

# Build JSON array of game metadata
GAMES_JSON="["
first=true
for game in "${games[@]}"; do
  if [ "$first" = true ]; then
    first=false
  else
    GAMES_JSON+=","
  fi

  # Read game.json if it exists, otherwise use defaults
  if [ -f "$game/game.json" ]; then
    title=$(python3 -c "import json; d=json.load(open('$game/game.json')); print(d.get('title','$game'))")
    desc=$(python3 -c "import json; d=json.load(open('$game/game.json')); print(d.get('description',''))")
    genre=$(python3 -c "import json; d=json.load(open('$game/game.json')); print(d.get('genre','ゲーム'))")
    color=$(python3 -c "import json; d=json.load(open('$game/game.json')); print(d.get('color','#667eea'))")
    emoji=$(python3 -c "import json; d=json.load(open('$game/game.json')); print(d.get('emoji','🎮'))")
  else
    title="$game"
    desc=""
    genre="ゲーム"
    color="#667eea"
    emoji="🎮"
  fi

  # Escape for JSON
  title_esc=$(echo "$title" | sed 's/"/\\"/g')
  desc_esc=$(echo "$desc" | sed 's/"/\\"/g')

  GAMES_JSON+="{\"id\":\"$game\",\"title\":\"$title_esc\",\"description\":\"$desc_esc\",\"genre\":\"$genre\",\"color\":\"$color\",\"emoji\":\"$emoji\",\"url\":\"./$game/\"}"
done
GAMES_JSON+="]"

# Generate index page
cat > dist/index.html << HTMLEOF
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AI Game Arcade - AIが作ったWebゲームコレクション</title>
  <meta name="description" content="AIエージェントが自動生成したブラウザで遊べるWebゲームコレクション。パズル、アクション、ランナーなど多彩なジャンルを収録。" />
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');

    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    :root {
      --bg: #06060f;
      --surface: #10101e;
      --surface-hover: #181830;
      --border: #1e1e3a;
      --border-hover: #667eea;
      --text: #e8e8f0;
      --text-dim: #8888aa;
      --accent: #667eea;
      --accent2: #a855f7;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      overflow-x: hidden;
    }

    /* === HERO === */
    .hero {
      text-align: center;
      padding: 4rem 2rem 3rem;
      position: relative;
      overflow: hidden;
    }
    .hero::before {
      content: '';
      position: absolute;
      top: -50%;
      left: 50%;
      transform: translateX(-50%);
      width: 800px;
      height: 800px;
      background: radial-gradient(circle, rgba(102,126,234,0.12) 0%, transparent 70%);
      pointer-events: none;
    }
    .hero-title {
      font-size: clamp(2rem, 5vw, 3.5rem);
      font-weight: 900;
      letter-spacing: -0.02em;
      background: linear-gradient(135deg, #667eea 0%, #a855f7 50%, #f472b6 100%);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 1rem;
    }
    .hero-sub {
      font-size: clamp(0.9rem, 2vw, 1.15rem);
      color: var(--text-dim);
      max-width: 600px;
      margin: 0 auto 2rem;
      line-height: 1.7;
    }
    .hero-stats {
      display: flex;
      justify-content: center;
      gap: 2.5rem;
      flex-wrap: wrap;
    }
    .stat {
      text-align: center;
    }
    .stat-num {
      font-size: 2rem;
      font-weight: 900;
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .stat-label {
      font-size: 0.8rem;
      color: var(--text-dim);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    /* === FILTERS === */
    .filters {
      display: flex;
      justify-content: center;
      gap: 0.5rem;
      padding: 0 2rem 2rem;
      flex-wrap: wrap;
    }
    .filter-btn {
      background: var(--surface);
      border: 1px solid var(--border);
      color: var(--text-dim);
      padding: 0.5rem 1.2rem;
      border-radius: 100px;
      cursor: pointer;
      font-size: 0.85rem;
      font-family: inherit;
      transition: all 0.2s;
    }
    .filter-btn:hover {
      border-color: var(--accent);
      color: var(--text);
    }
    .filter-btn.active {
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      border-color: transparent;
      color: #fff;
      font-weight: 600;
    }

    /* === GRID === */
    .games {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1.5rem;
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 2rem 4rem;
    }

    /* === CARD === */
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      overflow: hidden;
      text-decoration: none;
      color: inherit;
      transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
      display: flex;
      flex-direction: column;
    }
    .card:hover {
      transform: translateY(-6px);
      border-color: var(--border-hover);
      box-shadow: 0 20px 40px rgba(102,126,234,0.1);
    }

    /* Preview area */
    .card-preview {
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 10;
      background: #08080f;
      overflow: hidden;
    }
    .card-preview iframe {
      width: 200%;
      height: 200%;
      transform: scale(0.5);
      transform-origin: top left;
      border: none;
      pointer-events: none;
    }
    .card-preview .preview-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, transparent 50%, rgba(6,6,15,0.9) 100%);
      display: flex;
      align-items: flex-end;
      justify-content: center;
      padding-bottom: 1rem;
      opacity: 0;
      transition: opacity 0.25s;
    }
    .card:hover .preview-overlay {
      opacity: 1;
    }
    .play-btn {
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      color: #fff;
      padding: 0.6rem 2rem;
      border-radius: 100px;
      font-weight: 700;
      font-size: 0.95rem;
      letter-spacing: 0.03em;
      box-shadow: 0 4px 20px rgba(102,126,234,0.4);
    }
    .card-preview .preview-loading {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 3rem;
      background: linear-gradient(135deg, #0a0a1a 0%, #12122a 100%);
    }

    /* Card body */
    .card-body {
      padding: 1.2rem 1.4rem 1.4rem;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .card-header {
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }
    .card-emoji {
      font-size: 1.4rem;
      line-height: 1;
    }
    .card-title {
      font-size: 1.15rem;
      font-weight: 700;
    }
    .card-desc {
      color: var(--text-dim);
      font-size: 0.88rem;
      line-height: 1.6;
      flex: 1;
    }
    .card-footer {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-top: 0.3rem;
    }
    .tag {
      font-size: 0.75rem;
      padding: 0.25rem 0.7rem;
      border-radius: 100px;
      font-weight: 600;
      letter-spacing: 0.02em;
    }

    /* === FOOTER === */
    .site-footer {
      text-align: center;
      padding: 2rem;
      color: var(--text-dim);
      font-size: 0.8rem;
      border-top: 1px solid var(--border);
      max-width: 1200px;
      margin: 0 auto;
    }
    .site-footer a {
      color: var(--accent);
      text-decoration: none;
    }

    /* === NO RESULTS === */
    .no-results {
      grid-column: 1 / -1;
      text-align: center;
      padding: 4rem 2rem;
      color: var(--text-dim);
    }

    /* === RESPONSIVE === */
    @media (max-width: 700px) {
      .hero { padding: 3rem 1.5rem 2rem; }
      .games { grid-template-columns: 1fr; padding: 0 1rem 3rem; }
      .hero-stats { gap: 1.5rem; }
    }
  </style>
</head>
<body>
  <section class="hero">
    <h1 class="hero-title">AI Game Arcade</h1>
    <p class="hero-sub">
      AIエージェントが自動生成したブラウザゲームを今すぐプレイ。<br />
      インストール不要 — タップするだけで遊べます。
    </p>
    <div class="hero-stats">
      <div class="stat">
        <div class="stat-num" id="game-count">0</div>
        <div class="stat-label">Games</div>
      </div>
      <div class="stat">
        <div class="stat-num" id="genre-count">0</div>
        <div class="stat-label">Genres</div>
      </div>
      <div class="stat">
        <div class="stat-num">100%</div>
        <div class="stat-label">AI Generated</div>
      </div>
    </div>
  </section>

  <nav class="filters" id="filters"></nav>
  <div class="games" id="games"></div>

  <footer class="site-footer">
    All games are generated by AI agents using TypeScript + Canvas API.<br />
    PC & mobile supported. No downloads required.
  </footer>

  <script>
    const games = ${GAMES_JSON};

    // Stats
    document.getElementById('game-count').textContent = games.length;
    const genres = [...new Set(games.map(g => g.genre))];
    document.getElementById('genre-count').textContent = genres.length;

    // Filters
    const filtersEl = document.getElementById('filters');
    const allBtn = document.createElement('button');
    allBtn.className = 'filter-btn active';
    allBtn.textContent = 'すべて';
    allBtn.dataset.genre = '';
    filtersEl.appendChild(allBtn);

    genres.forEach(genre => {
      const btn = document.createElement('button');
      btn.className = 'filter-btn';
      btn.textContent = genre;
      btn.dataset.genre = genre;
      filtersEl.appendChild(btn);
    });

    filtersEl.addEventListener('click', e => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;
      filtersEl.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderGames(btn.dataset.genre);
    });

    // Render
    const container = document.getElementById('games');

    function renderGames(filterGenre) {
      container.innerHTML = '';
      const filtered = filterGenre ? games.filter(g => g.genre === filterGenre) : games;

      if (filtered.length === 0) {
        container.innerHTML = '<div class="no-results">該当するゲームがありません</div>';
        return;
      }

      filtered.forEach(g => {
        const a = document.createElement('a');
        a.className = 'card';
        a.href = g.url;

        a.innerHTML =
          '<div class="card-preview">' +
            '<div class="preview-loading">' + g.emoji + '</div>' +
            '<div class="preview-overlay"><span class="play-btn">PLAY</span></div>' +
          '</div>' +
          '<div class="card-body">' +
            '<div class="card-header">' +
              '<span class="card-emoji">' + g.emoji + '</span>' +
              '<span class="card-title">' + g.title + '</span>' +
            '</div>' +
            '<p class="card-desc">' + g.description + '</p>' +
            '<div class="card-footer">' +
              '<span class="tag" style="background:' + g.color + '22;color:' + g.color + '">' + g.genre + '</span>' +
            '</div>' +
          '</div>';

        container.appendChild(a);

        // Lazy-load iframe preview when card is near viewport
        const observer = new IntersectionObserver(entries => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const previewDiv = a.querySelector('.card-preview');
              const iframe = document.createElement('iframe');
              iframe.src = g.url;
              iframe.loading = 'lazy';
              iframe.setAttribute('tabindex', '-1');
              iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
              iframe.onload = () => {
                const loading = previewDiv.querySelector('.preview-loading');
                if (loading) loading.style.display = 'none';
              };
              previewDiv.insertBefore(iframe, previewDiv.firstChild);
              observer.disconnect();
            }
          });
        }, { rootMargin: '200px' });
        observer.observe(a);
      });
    }

    renderGames('');
  </script>
</body>
</html>
HTMLEOF

echo "=== Build complete: ${GAME_COUNT} games ==="
