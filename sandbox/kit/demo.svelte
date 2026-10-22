<!-- mock: the kit itself: the panel with real section cards, the card's states, a delete confirm, and a modal -->
<script>
  import { Compare, Variant, Panel, SectionCard, Modal, sampleLive } from './index.js';
  const live = sampleLive('full');
</script>

<Compare
  title="Mock kit"
  note="Panel, SectionCard (as built: the real SectionCard.svelte), Modal on sampleLive('full')"
  cols={3}
>
  <Variant label="Panel" note="Toolbar, modes, page head, page tabs, body, footer">
    <Panel height="760px" changes={2}>
      <SectionCard {live} at={0} />
      <SectionCard {live} at={1} changed hover open hoverRow={0} />
      <SectionCard {live} at={3} />
    </Panel>
  </Variant>
  <Variant label="SectionCard" note="At rest, selected, open, and red with its delete confirm">
    <SectionCard {live} at={2} />
    <SectionCard {live} at={1} selected />
    <SectionCard {live} at={3} open />
    <SectionCard {live} at={1} red />
  </Variant>
  <Variant label="Modal" note="ExplorerHead and .modal__box">
    <Modal
      title="Add widget to Work"
      icon="fa-plus"
      crumbs={[{ label: 'after its last widget' }]}
      width="384px"
      height="240px"
    >
      <p class="hint">The body.</p>
      {#snippet foot()}<span class="hint small">A hint</span>{/snippet}
    </Modal>
  </Variant>
</Compare>
