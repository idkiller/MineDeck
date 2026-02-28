<script lang="ts">
  let { data, form } = $props();
</script>

<svelte:head>
  <title>World Packs - {data.world}</title>
</svelte:head>

<h1>World Packs: {data.world}</h1>

{#if form?.error}
  <div class="banner error">{form.error}</div>
{/if}
{#if form?.message}
  <div class="banner ok">{form.message}</div>
{/if}

<form method="POST" action="?/save" class="grid two">
  <input type="hidden" name="_csrf" value={data.csrfToken} />

  <section class="card">
    <h2 style="margin-top:0;">Behavior Packs</h2>
    {#if data.behaviorPacks.length === 0}
      <p style="color:var(--muted);">No behavior packs installed.</p>
    {:else}
      {#each data.behaviorPacks as pack}
        <label style="display:block;margin-bottom:0.5rem;">
          <input
            type="checkbox"
            name="behavior"
            value={pack.manifest.uuid}
            checked={data.enabledBehavior.includes(pack.manifest.uuid)}
          />
          {pack.manifest.name} ({pack.manifest.version.join('.')})
          <br />
          <code>{pack.manifest.uuid}</code>
        </label>
      {/each}
    {/if}
  </section>

  <section class="card">
    <h2 style="margin-top:0;">Resource Packs</h2>
    {#if data.resourcePacks.length === 0}
      <p style="color:var(--muted);">No resource packs installed.</p>
    {:else}
      {#each data.resourcePacks as pack}
        <label style="display:block;margin-bottom:0.5rem;">
          <input
            type="checkbox"
            name="resource"
            value={pack.manifest.uuid}
            checked={data.enabledResource.includes(pack.manifest.uuid)}
          />
          {pack.manifest.name} ({pack.manifest.version.join('.')})
          <br />
          <code>{pack.manifest.uuid}</code>
        </label>
      {/each}
    {/if}
  </section>

  <div style="grid-column:1/-1;display:flex;gap:0.7rem;">
    <button type="submit">Save World Pack Settings</button>
  </div>
</form>

<section class="card" style="margin-top:1rem;">
  <h2 style="margin-top:0;">Apply Packs</h2>
  <p style="margin-top:0;color:var(--muted);">Schedule an immediate restart after saving.</p>
  <form method="POST" action="?/apply">
    <input type="hidden" name="_csrf" value={data.csrfToken} />
    <button type="submit">Schedule Restart</button>
  </form>
</section>

<p><a href="/packs">Back to packs</a></p>