<script lang="ts">
  import '../app.css';
  let { data, children } = $props();
</script>

<header style="background:#0f1723;color:#fff;border-bottom:3px solid #1f6feb;">
  <div class="container" style="display:flex;justify-content:space-between;gap:1rem;align-items:center;">
    <div>
      <strong style="font-size:1.1rem;">MineDeck</strong>
      <div style="font-size:0.85rem;opacity:0.8;">Bedrock Server Control Panel</div>
    </div>

    {#if data.user}
      <nav style="display:flex;align-items:center;gap:0.7rem;flex-wrap:wrap;">
        <a href="/">Dashboard</a>
        <a href="/server">Server</a>
        <a href="/packs">Packs</a>
        <a href="/worlds">Worlds</a>
        <a href="/players">Players</a>
        <a href="/automation">Automation</a>
        <a href="/logs">Logs</a>
        <form method="POST" action="/logout">
          <input type="hidden" name="_csrf" value={data.csrfToken} />
          <button class="secondary" type="submit">Logout</button>
        </form>
      </nav>
    {/if}
  </div>
</header>

<main class="container" style="padding-top:1rem;padding-bottom:2rem;">
  {@render children()}
</main>