<script lang="ts">
  let { data, form } = $props();

  const percentUsed = () => ((data.disk.usedBytes / Math.max(1, data.disk.totalBytes)) * 100).toFixed(1);
</script>

<svelte:head>
  <title>MineDeck Dashboard</title>
</svelte:head>

<h1>Dashboard</h1>

{#if form?.error}
  <div class="banner error">{form.error}</div>
{/if}

{#if form?.message}
  <div class="banner ok">{form.message}</div>
{/if}

{#if !data.commandStatus.ok}
  <div class="banner warn">Command channel unavailable: {data.commandStatus.message}</div>
{/if}

<div class="grid two">
  <section class="card">
    <h2 style="margin-top:0;">Server</h2>
    <p><strong>Provider:</strong> {data.providerType}</p>
    <p><strong>Active world:</strong> {data.activeWorld}</p>
    <p><strong>Command status:</strong> {data.commandStatus.ok ? 'Ready' : 'Failed'} ({data.commandStatus.message})</p>

    <form method="POST" action="?/restart">
      <input type="hidden" name="_csrf" value={data.csrfToken} />
      <button type="submit">Restart Server</button>
    </form>
  </section>

  <section class="card">
    <h2 style="margin-top:0;">Disk</h2>
    <p><strong>Used:</strong> {Math.round(data.disk.usedBytes / (1024 * 1024 * 1024) * 10) / 10} GB</p>
    <p><strong>Free:</strong> {Math.round(data.disk.freeBytes / (1024 * 1024 * 1024) * 10) / 10} GB</p>
    <p><strong>Total:</strong> {Math.round(data.disk.totalBytes / (1024 * 1024 * 1024) * 10) / 10} GB</p>
    <p><strong>Usage:</strong> {percentUsed()}%</p>
  </section>
</div>

<section class="card" style="margin-top:1rem;">
  <h2 style="margin-top:0;">Send Command</h2>
  <form method="POST" action="?/command" style="display:flex;gap:0.5rem;align-items:flex-end;">
    <input type="hidden" name="_csrf" value={data.csrfToken} />
    <label style="flex:1;">
      Command
      <input name="command" placeholder="say Hello from MineDeck" />
    </label>
    <button type="submit">Run</button>
  </form>
</section>

<section class="card" style="margin-top:1rem;">
  <h2 style="margin-top:0;">Recent Logs (last 200 lines)</h2>
  <pre style="margin:0;max-height:420px;overflow:auto;background:#0c1118;color:#dbe6f3;padding:0.8rem;border-radius:8px;">{data.logs}</pre>
</section>
