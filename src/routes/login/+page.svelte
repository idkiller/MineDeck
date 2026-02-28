<script lang="ts">
  let { form } = $props();
</script>

<svelte:head>
  <title>MineDeck Login</title>
</svelte:head>

<div class="card" style="max-width:420px;margin:2rem auto;">
  <h1 style="margin-top:0;">Sign in</h1>
  <p style="color:var(--muted);margin-top:0;">MineDeck admin authentication</p>

  {#if form?.error}
    <div class="banner error">{form.error}</div>
  {/if}

  <form method="POST" class="grid" style="gap:0.7rem;">
    <label>
      Username
      <input name="username" autocomplete="username" required />
    </label>

    <label>
      Password
      <input name="password" type="password" autocomplete="current-password" required />
    </label>

    <button type="submit">Login</button>
  </form>
</div>