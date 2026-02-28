<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  let { data } = $props();
  let autoRefresh = $state(false);

  onMount(() => {
    const id = setInterval(() => {
      if (autoRefresh) {
        void goto(`/logs?lines=${data.lines}`, { invalidateAll: true, replaceState: true, noScroll: true });
      }
    }, 5000);

    return () => clearInterval(id);
  });
</script>

<svelte:head>
  <title>MineDeck Logs</title>
</svelte:head>

<h1>Server Logs</h1>

<section class="card">
  <form method="GET" style="display:flex;gap:0.6rem;align-items:flex-end;flex-wrap:wrap;">
    <label>
      Lines
      <input type="number" min="50" max="2000" name="lines" value={data.lines} />
    </label>
    <button type="submit">Refresh</button>
    <label style="display:flex;gap:0.4rem;align-items:center;">
      <input type="checkbox" bind:checked={autoRefresh} style="width:auto;" />
      Auto refresh (5s)
    </label>
    <span style="color:var(--muted);">Refreshed: {data.refreshedAt}</span>
  </form>

  <pre style="margin-top:0.8rem;max-height:70vh;overflow:auto;background:#0c1118;color:#dbe6f3;padding:0.8rem;border-radius:8px;">{data.logs}</pre>
</section>
