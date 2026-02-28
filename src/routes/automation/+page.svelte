<script lang="ts">
  let { data, form } = $props();
</script>

<svelte:head>
  <title>MineDeck Automation</title>
</svelte:head>

<h1>Automation</h1>

{#if form?.error}
  <div class="banner error">{form.error}</div>
{/if}
{#if form?.message}
  <div class="banner ok">{form.message}</div>
{/if}

<section class="card">
  <h2 style="margin-top:0;">Create Job</h2>
  <div class="grid two">
    <form method="POST" action="?/create" class="card" style="padding:0.8rem;">
      <input type="hidden" name="_csrf" value={data.csrfToken} />
      <input type="hidden" name="type" value="daily_backup" />
      <input type="hidden" name="enabled" value="true" />
      <h3 style="margin-top:0;">Daily Backup</h3>
      <label>
        Time (HH:mm)
        <input name="time" type="time" required />
      </label>
      <label>
        World (optional; blank = active)
        <input name="world" />
      </label>
      <button type="submit" style="margin-top:0.5rem;">Create Daily Backup</button>
    </form>

    <form method="POST" action="?/create" class="card" style="padding:0.8rem;">
      <input type="hidden" name="_csrf" value={data.csrfToken} />
      <input type="hidden" name="type" value="scheduled_restart" />
      <input type="hidden" name="enabled" value="true" />
      <h3 style="margin-top:0;">Scheduled Restart</h3>
      <label>
        Cron Schedule
        <input name="schedule" placeholder="0 4 * * *" required />
      </label>
      <p style="font-size:0.85rem;color:var(--muted);margin:0.4rem 0;">Example: <code>0 4 * * *</code> runs at 04:00 daily.</p>
      <button type="submit">Create Restart Job</button>
    </form>
  </div>
</section>

<section class="card" style="margin-top:1rem;">
  <h2 style="margin-top:0;">Jobs</h2>
  {#if data.jobs.length === 0}
    <p style="margin:0;color:var(--muted);">No jobs configured.</p>
  {:else}
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Type</th>
          <th>Schedule</th>
          <th>Enabled</th>
          <th>Payload</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {#each data.jobs as job}
          <tr>
            <td>{job.id}</td>
            <td>{job.type}</td>
            <td><code>{job.schedule}</code></td>
            <td>{job.enabled ? 'yes' : 'no'}</td>
            <td><code>{JSON.stringify(job.payload)}</code></td>
            <td>
              <div style="display:flex;gap:0.4rem;flex-wrap:wrap;">
                <form method="POST" action="?/toggle">
                  <input type="hidden" name="_csrf" value={data.csrfToken} />
                  <input type="hidden" name="jobId" value={job.id} />
                  <input type="hidden" name="enabled" value={job.enabled ? 'false' : 'true'} />
                  <button class="secondary" type="submit">{job.enabled ? 'Disable' : 'Enable'}</button>
                </form>
              </div>
            </td>
          </tr>
          <tr>
            <td colspan="6">
              <form method="POST" action="?/update" class="grid two" style="padding:0.4rem 0;">
                <input type="hidden" name="_csrf" value={data.csrfToken} />
                <input type="hidden" name="jobId" value={job.id} />

                <label>
                  Type
                  <select name="type" value={job.type}>
                    <option value="daily_backup">daily_backup</option>
                    <option value="scheduled_restart">scheduled_restart</option>
                    <option value="one_shot_restart">one_shot_restart</option>
                  </select>
                </label>

                <label>
                  Schedule
                  <input name="schedule" value={job.schedule} />
                </label>

                <label>
                  Enabled
                  <select name="enabled" value={job.enabled ? 'true' : 'false'}>
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                </label>

                <label style="grid-column:1/-1;">
                  Payload JSON
                  <input name="payload" value={JSON.stringify(job.payload)} />
                </label>

                <div style="display:flex;gap:0.5rem;grid-column:1/-1;">
                  <button type="submit">Update</button>
                </div>
              </form>

              <form method="POST" action="?/delete" style="display:flex;gap:0.5rem;align-items:flex-end;flex-wrap:wrap;">
                <input type="hidden" name="_csrf" value={data.csrfToken} />
                <input type="hidden" name="jobId" value={job.id} />
                <label>
                  Confirm (type DELETE)
                  <input name="confirm" required />
                </label>
                <button class="danger" type="submit">Delete Job</button>
              </form>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</section>

<section class="card" style="margin-top:1rem;">
  <h2 style="margin-top:0;">Recent Job Runs</h2>
  {#if data.jobRuns.length === 0}
    <p style="margin:0;color:var(--muted);">No runs yet.</p>
  {:else}
    <table>
      <thead>
        <tr>
          <th>Time</th>
          <th>Job ID</th>
          <th>Status</th>
          <th>Message</th>
        </tr>
      </thead>
      <tbody>
        {#each data.jobRuns as run}
          <tr>
            <td>{run.ranAt}</td>
            <td>{run.jobId}</td>
            <td>{run.status}</td>
            <td>{run.message}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</section>