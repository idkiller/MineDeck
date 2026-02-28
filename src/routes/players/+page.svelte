<script lang="ts">
  let { data, form } = $props();
</script>

<svelte:head>
  <title>MineDeck Players</title>
</svelte:head>

<h1>Player Management</h1>

{#if !data.commandStatus.ok}
  <div class="banner warn">Command channel unavailable: {data.commandStatus.message}</div>
{/if}

{#if form?.error}
  <div class="banner error">{form.error}</div>
{/if}
{#if form?.message}
  <div class="banner ok">{form.message}</div>
{/if}

<div class="grid two">
  <section class="card">
    <h2 style="margin-top:0;">Allowlist</h2>
    <form method="POST" action="?/addAllow" style="display:flex;gap:0.5rem;align-items:flex-end;flex-wrap:wrap;">
      <input type="hidden" name="_csrf" value={data.csrfToken} />
      <label style="flex:1;min-width:180px;">
        Player Name
        <input name="name" required />
      </label>
      <button type="submit">Add</button>
    </form>

    <table style="margin-top:0.7rem;">
      <thead>
        <tr>
          <th>Name</th>
          <th>XUID</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each data.allowlist as entry}
          <tr>
            <td>{entry.name}</td>
            <td>{entry.xuid || '-'}</td>
            <td>
              <form method="POST" action="?/removeAllow">
                <input type="hidden" name="_csrf" value={data.csrfToken} />
                <input type="hidden" name="name" value={entry.name} />
                <button class="danger" type="submit">Remove</button>
              </form>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </section>

  <section class="card">
    <h2 style="margin-top:0;">Permissions</h2>
    <form method="POST" action="?/setPermission" style="display:flex;gap:0.5rem;align-items:flex-end;flex-wrap:wrap;">
      <input type="hidden" name="_csrf" value={data.csrfToken} />
      <label style="flex:1;min-width:180px;">
        Player Name or XUID
        <input name="identity" required />
      </label>
      <label>
        Permission
        <select name="permission">
          <option value="member">member</option>
          <option value="operator">operator</option>
        </select>
      </label>
      <button type="submit">Set</button>
    </form>

    <table style="margin-top:0.7rem;">
      <thead>
        <tr>
          <th>Name</th>
          <th>XUID</th>
          <th>Permission</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each data.permissions as entry}
          <tr>
            <td>{entry.name || '-'}</td>
            <td>{entry.xuid || '-'}</td>
            <td>{entry.permission}</td>
            <td>
              <form method="POST" action="?/removePermission">
                <input type="hidden" name="_csrf" value={data.csrfToken} />
                <input type="hidden" name="identity" value={entry.name || entry.xuid} />
                <button class="danger" type="submit">Remove</button>
              </form>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </section>
</div>

<section class="card" style="margin-top:1rem;">
  <h2 style="margin-top:0;">Online Players (list command)</h2>
  <pre style="margin:0;background:#0c1118;color:#dbe6f3;padding:0.8rem;border-radius:8px;">{data.onlinePlayers}</pre>
</section>
