<!-- mock: the page's Content panel as tabs (Tabs.svelte): Sections | Transitions | SEO.
     tab: sections | transitions | seo. Transitions: the Backdrop and the curtain as plain
     fields under small headings (no collapsible cards); SEO: the SeoSection fields, plain. -->
<script>
  import Tabs from '../../src/editor/svelte/Tabs.svelte';
  import Section from '../../src/editor/svelte/Section.svelte';
  import Field from '../../src/editor/svelte/Field.svelte';
  import PhotoList from '../../src/editor/svelte/PhotoList.svelte';

  let { tab = 'sections', caption = '' } = $props();
  const nop = () => {};
  const PHOTOS = ['places/kasteel-de-haar/02.jpg', 'people/noor-vermeer/02.jpg', 'people/daan-okafor/02.jpg'];
  const items = PHOTOS.map((src, i) => [{ edit: `mock#/backdrop/${i}`, type: 'image', label: `Photo ${i + 1}`, value: src }]);
  const TABS = [['sections', 'Sections'], ['transitions', 'Transitions'], ['seo', 'SEO']];
</script>

{#snippet seg(options, now, label)}
  <div class="seg" role="radiogroup" aria-label={label}>
    {#each options as o (o)}
      <button type="button" role="radio" aria-checked={o === now} class={['seg__btn', o === now && 'is-active']}>{o}</button>
    {/each}
  </div>
{/snippet}

<div class="ptc">
  <p class="cap">{caption}</p>
  <div class="ptp">
    <Tabs tabs={TABS} value={tab} onpick={nop} label="Page" class="ptabs" />
    <div class="pane">
      {#if tab === 'sections'}
        <Section title="Section 1" name="Eeliya Rasta" open={false}>
          {#snippet bar()}<input type="checkbox" class="switch" checked aria-label="Show" />{/snippet}
        </Section>
        <Section title="Section 2" name="Statement">
          {#snippet bar()}<input type="checkbox" class="switch" checked aria-label="Show" />{/snippet}
          <div class="blk"><i class="fa-solid fa-grip-vertical"></i><i class="fa-solid fa-quote-left t"></i><span>Statement</span></div>
          <div class="blk"><i class="fa-solid fa-grip-vertical"></i><i class="fa-solid fa-arrow-right t"></i><span>Button</span></div>
        </Section>
        <Section title="Section 3" name="Work" open={false}>
          {#snippet bar()}<input type="checkbox" class="switch" checked aria-label="Show" />{/snippet}
        </Section>
        <button type="button" class="add"><i class="fa-solid fa-plus" aria-hidden="true"></i>Add section</button>
      {:else if tab === 'transitions'}
        <h3 class="sub">Backdrop <input type="checkbox" class="switch" checked aria-label="Show the backdrop" /></h3>
        <div class="fields">
          <PhotoList label="Photos" {items} addLabel="Add photo" onmove={nop} onremove={nop} onadd={nop}>
            {#snippet row(fields, _i, ctl)}<Field {...fields[0]} grab={ctl.grab} remove={ctl.remove} onvalue={nop} />{/snippet}
          </PhotoList>
          <div class="tf"><span class="tf__label">Transition</span>{@render seg(['Scroll', 'Fade'], 'Scroll', 'Transition')}</div>
          <div class="tf">
            <span class="tf__label">Shade</span>
            <div class="f__row shade"><input type="range" class="f__range" min="0" max="80" step="5" value="45" aria-label="Shade" /><span class="shade__val">45%</span></div>
          </div>
          <div class="tf"><span class="tf__label">Direction</span>{@render seg(['Vertical', 'Horizontal'], 'Vertical', 'Direction')}</div>
        </div>
        <hr class="line" />
        <h3 class="sub">Curtain</h3>
        <div class="fields">
          <div class="tf"><span class="tf__label">Curtain for this page</span>{@render seg(['Global', 'Custom', 'Off'], 'Global', 'Curtain')}</div>
          <p class="hint small">Uses the global curtain (Settings). Its timing stays in Motion.</p>
          <Field label="Curtain text" value="Eeliya Rasta" onvalue={nop} />
          <Field label="Subline" value="Photography · Amsterdam" onvalue={nop} />
        </div>
      {:else}
        <p class="hint">Search engines and share cards. Empty fields use the site defaults (Settings › SEO).</p>
        <div class="fields">
          <Field label="Title" placeholder="The page's heading" value="Work" onvalue={nop} />
          <Field label="Description" type="block" value="Portraits and places, photographed in and around Amsterdam." onvalue={nop} />
          <Field label="Share image" type="image" value="places/kasteel-de-haar/02.jpg" onvalue={nop} />
          <label class="tf"><span class="tf__label">Hide from search <input type="checkbox" class="switch" aria-label="Hide from search" /></span></label>
          <Field label="Canonical URL (when this page copies another)" placeholder="https://" value="" onvalue={nop} />
        </div>
        <div class="serp">
          <span class="serp__host">eeliyarasta.com › work</span>
          <span class="serp__title">Work · Eeliya Rasta</span>
          <span class="serp__desc">Portraits and places, photographed in and around Amsterdam.</span>
        </div>
      {/if}
    </div>
  </div>
</div>

<style lang="scss">
  .ptc { width: 384px; display: flex; flex-direction: column; gap: 12px; }
  .cap { margin: 0; min-height: 48px; color: var(--c-text-muted); font-size: var(--fs-sm); line-height: 16px; }
  .ptp { height: 920px; background: var(--c-surface); border-radius: var(--radius-lg); overflow: hidden; }
  .pane { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
  .fields { display: grid; gap: 12px; }
  .sub { margin: 0; height: 32px; display: flex; align-items: center; justify-content: space-between; font-size: var(--fs-sm); font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; color: var(--c-text-strong); }
  .line { width: 100%; margin: 4px 0; border: 0; border-top: 1px solid var(--c-line); }
  .add {
    width: calc(100% + 16px); margin-inline: -8px; height: 40px; display: flex; align-items: center; justify-content: center; gap: 8px;
    border: 1px dashed var(--c-line-strong, var(--c-fill-active)); border-radius: var(--radius-lg); background: none; color: var(--c-text);
    font: inherit; font-size: var(--fs-base); font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase;
  }
  .blk { height: 32px; display: flex; align-items: center; gap: 8px; padding: 0 8px; border-radius: var(--radius-md); background: var(--c-surface-2); color: var(--c-text-faint); span { color: var(--c-text); } .t { color: var(--c-text-muted); } }
  .shade { display: flex; align-items: center; gap: 8px; .f__range { flex: 1; } }
  .shade__val { width: 40px; text-align: right; font-variant-numeric: tabular-nums; }
  .serp { display: grid; gap: 4px; padding: 12px; border-radius: var(--radius-md); background: var(--c-surface-2); font-size: var(--fs-sm); }
  .serp__host { color: var(--c-text-muted); } .serp__title { color: var(--c-accent); font-size: var(--fs-base); } .serp__desc { color: var(--c-text); }
</style>
