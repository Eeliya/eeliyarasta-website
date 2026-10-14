<!-- mock: the kit itself: the panel with real section cards, a closed card, and a modal -->
<script>
  import { Compare, Variant, Panel, SectionCard, Modal, sampleLive } from '../kit/index.js';
  const live = sampleLive();
</script>

<Compare
  title="Mock kit"
  note="Panel, SectionCard (open / closed / red), Modal: real components and styles"
  cols={3}
>
  <Variant label="Panel" note="Toolbar, modes, page tabs, body, footer">
    <Panel height="760px" changes={2}>
      <SectionCard {live} at={4} open={false} />
      <SectionCard {live} at={5} />
    </Panel>
  </Variant>
  <Variant label="SectionCard" note="open={false}, then red">
    <SectionCard {live} at={0} open={false} />
    <SectionCard {live} at={2} red />
  </Variant>
  <Variant label="Modal" note="ExplorerHead and .modal__box">
    <Modal
      title="Add block to Section 6"
      icon="fa-plus"
      crumbs={[{ label: 'after its last block' }]}
      width="384px"
      height="240px"
    >
      <p class="hint">The body.</p>
      {#snippet foot()}<span class="hint small">A hint</span>{/snippet}
    </Modal>
  </Variant>
</Compare>
