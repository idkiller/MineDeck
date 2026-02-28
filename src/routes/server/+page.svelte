<script lang="ts">
  let { data, form } = $props();

  const map = () => data.map as Record<string, string>;
  const restartRecommended = () => Boolean(form?.restartRecommended || data.restartRecommended);
</script>

<svelte:head>
  <title>MineDeck Server Settings</title>
</svelte:head>

<h1>Server Properties</h1>

{#if form?.error}
  <div class="banner error">{form.error}</div>
{/if}

{#if form?.message}
  <div class="banner ok">{form.message}</div>
{/if}

{#if restartRecommended()}
  <div class="banner warn" style="display:flex;justify-content:space-between;gap:1rem;align-items:center;">
    <span>Configuration changed. Restart is recommended.</span>
    <form method="POST" action="?/restart">
      <input type="hidden" name="_csrf" value={data.csrfToken} />
      <button type="submit">Restart Now</button>
    </form>
  </div>
{/if}

<section class="card">
  <h2 style="margin-top:0;">Common Settings</h2>

  <form method="POST" action="?/save" class="grid two">
    <input type="hidden" name="_csrf" value={data.csrfToken} />

    <label>
      Gamemode
      <select name="gamemode" value={map()['gamemode'] ?? 'survival'}>
        <option value="survival">survival</option>
        <option value="creative">creative</option>
        <option value="adventure">adventure</option>
      </select>
    </label>

    <label>
      Difficulty
      <select name="difficulty" value={map()['difficulty'] ?? 'easy'}>
        <option value="peaceful">peaceful</option>
        <option value="easy">easy</option>
        <option value="normal">normal</option>
        <option value="hard">hard</option>
      </select>
    </label>

    <label>
      Max Players
      <input name="max-players" type="number" min="1" max="65535" value={map()['max-players'] ?? '10'} />
    </label>

    <label>
      Server Port
      <input name="server-port" type="number" min="1" max="65535" value={map()['server-port'] ?? '19132'} />
    </label>

    <label>
      Level Name
      <input name="level-name" value={map()['level-name'] ?? 'Bedrock level'} />
    </label>

    <label>
      Allow Cheats
      <select name="allow-cheats" value={map()['allow-cheats'] ?? 'false'}>
        <option value="false">false</option>
        <option value="true">true</option>
      </select>
    </label>

    <label>
      Online Mode
      <select name="online-mode" value={map()['online-mode'] ?? 'true'}>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    </label>

    <label>
      Enable RCON
      <select name="enable-rcon" value={map()['enable-rcon'] ?? 'false'}>
        <option value="false">false</option>
        <option value="true">true</option>
      </select>
    </label>

    <label>
      RCON Port
      <input name="rcon.port" type="number" min="1" max="65535" value={map()['rcon.port'] ?? '19140'} />
    </label>

    <label>
      RCON Password
      <input name="rcon.password" value={map()['rcon.password'] ?? ''} />
    </label>

    <div style="grid-column:1/-1;display:flex;gap:0.6rem;">
      <button type="submit">Save Settings</button>
    </div>
  </form>

  {#if (map()['enable-rcon'] ?? 'false') !== 'true'}
    <form method="POST" action="?/enableRcon" style="margin-top:0.8rem;">
      <input type="hidden" name="_csrf" value={data.csrfToken} />
      <button class="warn" type="submit">Enable RCON (One Click)</button>
    </form>
  {/if}
</section>

<section class="card" style="margin-top:1rem;">
  <h2 style="margin-top:0;">Advanced Raw Editor</h2>
  <form method="POST" action="?/saveRaw" class="grid" style="gap:0.6rem;">
    <input type="hidden" name="_csrf" value={data.csrfToken} />
    <textarea name="raw">{data.raw}</textarea>
    <button type="submit">Save Raw</button>
  </form>
</section>
