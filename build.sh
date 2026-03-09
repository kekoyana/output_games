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

# Collect game directories
games=()
for dir in */; do
  if [ -f "${dir}package.json" ] && [ -f "${dir}index.html" ]; then
    games+=("${dir%/}")
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

# Generate index page
cat > dist/index.html << 'HTMLEOF'
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Game Collection</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0a0a0a;
      color: #e0e0e0;
      min-height: 100vh;
      padding: 2rem;
    }
    h1 {
      text-align: center;
      font-size: 2rem;
      margin-bottom: 2rem;
      background: linear-gradient(135deg, #667eea, #764ba2);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .games {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1.5rem;
      max-width: 960px;
      margin: 0 auto;
    }
    .game-card {
      background: #1a1a2e;
      border: 1px solid #333;
      border-radius: 12px;
      padding: 1.5rem;
      text-decoration: none;
      color: inherit;
      transition: transform 0.2s, border-color 0.2s;
    }
    .game-card:hover {
      transform: translateY(-4px);
      border-color: #667eea;
    }
    .game-card h2 {
      font-size: 1.2rem;
      margin-bottom: 0.5rem;
    }
    .game-card p {
      color: #888;
      font-size: 0.9rem;
    }
  </style>
</head>
<body>
  <h1>Game Collection</h1>
  <div class="games" id="games"></div>
  <script>
HTMLEOF

# Inject game list into index.html
echo "    const games = [" >> dist/index.html
for game in "${games[@]}"; do
  echo "      { name: \"$game\", url: \"./$game/\" }," >> dist/index.html
done
cat >> dist/index.html << 'HTMLEOF'
    ];
    const container = document.getElementById('games');
    games.forEach(g => {
      const a = document.createElement('a');
      a.className = 'game-card';
      a.href = g.url;
      a.innerHTML = `<h2>${g.name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</h2><p>Play now</p>`;
      container.appendChild(a);
    });
  </script>
</body>
</html>
HTMLEOF

echo "=== Build complete: ${#games[@]} games ==="
