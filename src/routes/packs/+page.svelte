<script lang="ts">
  let { data, form } = $props();
</script>

<svelte:head>
  <title>MineDeck Packs</title>
</svelte:head>

<h1>Packs</h1>

{#if form?.error}
  <div class="banner error">{form.error}</div>
{/if}
{#if form?.message}
  <div class="banner ok">{form.message}</div>
{/if}

<section class="card">
  <h2 style="margin-top:0;">Upload Pack</h2>
  <form method="POST" action="?/upload" enctype="multipart/form-data" style="display:flex;gap:0.7rem;align-items:flex-end;flex-wrap:wrap;">
    <input type="hidden" name="_csrf" value={data.csrfToken} />
    <label style="flex:1;min-width:260px;">
      Archive (.mcpack/.mcaddon/.zip)
      <input type="file" name="pack" accept=".mcpack,.mcaddon,.zip" required />
    </label>
    <button type="submit">Upload & Install</button>
  </form>
</section>

<section class="card" style="margin-top:1rem;">
  <h2 style="margin-top:0;">Installed Packs</h2>
  {#if data.packs.length === 0}
    <p style="margin:0;color:var(--muted);">No packs installed yet.</p>
  {:else}
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Type</th>
          <th>UUID</th>
          <th>Version</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        {#each data.packs as pack}
          <tr>
            <td>{pack.manifest.name}</td>
            <td>{pack.type}</td>
            <td><code>{pack.manifest.uuid}</code></td>
            <td>{pack.manifest.version.join('.')}</td>
            <td>{pack.manifest.description || '-'}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</section>

<section class="card" style="margin-top:1rem;">
  <h2 style="margin-top:0;">World Pack Enablement</h2>
  {#if data.worlds.length === 0}
    <p style="margin:0;color:var(--muted);">No worlds found.</p>
  {:else}
    <table>
      <thead>
        <tr>
          <th>World</th>
          <th>Enabled Behavior Packs</th>
          <th>Enabled Resource Packs</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each data.worlds as world}
          <tr>
            <td>{world}</td>
            <td>{data.worldStatus[world]?.behavior?.length ?? 0}</td>
            <td>{data.worldStatus[world]?.resource?.length ?? 0}</td>
            <td><a href={`/packs/world/${encodeURIComponent(world)}`}>Manage</a></td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</section>

<section class="card" style="margin-top:1rem;">
  <h2 style="margin-top:0;">Apply Packs</h2>
  <p style="margin-top:0;color:var(--muted);">Pack changes require restart to fully apply.</p>
  <div style="display:flex;gap:0.7rem;flex-wrap:wrap;">
    <form method="POST" action="?/applyPacks">
      <input type="hidden" name="_csrf" value={data.csrfToken} />
      <input type="hidden" name="delay" value="0" />
      <button type="submit">Restart Immediately</button>
    </form>

    <form method="POST" action="?/applyPacks">
      <input type="hidden" name="_csrf" value={data.csrfToken} />
      <input type="hidden" name="delay" value="30" />
      <button class="secondary" type="submit">Restart In 30s</button>
    </form>
  </div>
</section>