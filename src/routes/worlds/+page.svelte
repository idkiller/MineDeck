<script lang="ts">
  let { data, form } = $props();

  function formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let idx = 0;
    while (value >= 1024 && idx < units.length - 1) {
      value /= 1024;
      idx += 1;
    }
    return `${value.toFixed(value >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
  }
</script>

<svelte:head>
  <title>MineDeck Worlds</title>
</svelte:head>

<h1>World Management</h1>

{#if form?.error}
  <div class="banner error">{form.error}</div>
{/if}
{#if form?.message}
  <div class="banner ok">{form.message}</div>
{/if}

<section class="card">
  <h2 style="margin-top:0;">Worlds</h2>
  {#if data.worlds.length === 0}
    <p style="margin:0;color:var(--muted);">No worlds found in <code>/opt/mc-data/worlds</code>.</p>
  {:else}
    <table>
      <thead>
        <tr>
          <th>World</th>
          <th>Size</th>
          <th>Active</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {#each data.worlds as world}
          <tr>
            <td>{world.name}</td>
            <td>{formatBytes(world.sizeBytes)}</td>
            <td>{world.name === data.activeWorld ? 'Yes' : '-'}</td>
            <td>
              <div style="display:flex;gap:0.4rem;flex-wrap:wrap;">
                <form method="POST" action="?/backup">
                  <input type="hidden" name="_csrf" value={data.csrfToken} />
                  <input type="hidden" name="world" value={world.name} />
                  <button class="secondary" type="submit">Backup</button>
                </form>

                <form method="POST" action="?/setActive">
                  <input type="hidden" name="_csrf" value={data.csrfToken} />
                  <input type="hidden" name="world" value={world.name} />
                  <button class="warn" type="submit">Set Active</button>
                </form>
              </div>
            </td>
          </tr>
          <tr>
            <td colspan="4">
              <strong>Backups:</strong>
              {#if (data.backupsByWorld[world.name]?.length ?? 0) === 0}
                <span style="color:var(--muted);"> none</span>
              {:else}
                <div style="display:grid;gap:0.4rem;margin-top:0.4rem;">
                  {#each data.backupsByWorld[world.name] as backup}
                    <div class="card" style="padding:0.5rem;">
                      <div><code>{backup.path}</code></div>
                      <div style="font-size:0.9rem;color:var(--muted);">{backup.createdAt} ({formatBytes(backup.sizeBytes)})</div>
                      <form method="POST" action="?/restore" style="margin-top:0.4rem;display:flex;gap:0.4rem;align-items:flex-end;flex-wrap:wrap;">
                        <input type="hidden" name="_csrf" value={data.csrfToken} />
                        <input type="hidden" name="world" value={world.name} />
                        <input type="hidden" name="backupPath" value={backup.path} />
                        <label style="max-width:180px;">
                          Confirm (`RESTORE`)
                          <input name="confirm" required />
                        </label>
                        <button class="warn" type="submit">Restore</button>
                      </form>
                    </div>
                  {/each}
                </div>
              {/if}

              <form method="POST" action="?/delete" style="margin-top:0.6rem;display:flex;gap:0.4rem;align-items:flex-end;flex-wrap:wrap;">
                <input type="hidden" name="_csrf" value={data.csrfToken} />
                <input type="hidden" name="world" value={world.name} />
                <label style="max-width:220px;">
                  Delete confirm (type <code>{world.name}</code>)
                  <input name="confirm" required />
                </label>
                <button class="danger" type="submit">Delete World</button>
              </form>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</section>

<section class="card" style="margin-top:1rem;">
  <h2 style="margin-top:0;">Restart Recommended</h2>
  <form method="POST" action="?/restart">
    <input type="hidden" name="_csrf" value={data.csrfToken} />
    <button type="submit">Restart Server</button>
  </form>
</section>
