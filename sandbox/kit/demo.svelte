<!-- mock: the kit itself: the panel with real section cards, the list card's states, a delete confirm, and a modal -->
<script>
  import { Compare, Variant, Panel, SectionCard, Ask, Modal, sampleLive } from './index.js';
  const live = sampleLive('full');
</script>

<Compare
  title="Mock kit"
  note="Panel, SectionCard (as built: fields={'{false}'} rows spread=&quot;left&quot;), Ask, Modal on sampleLive('full')"
  cols={3}
>
  <Variant label="Panel" note="Toolbar, modes, page tabs, body, footer">
    <Panel height="760px" changes={2}>
      <SectionCard {live} at={0} fields={false} rows spread="left" />
      <SectionCard {live} at={1} fields={false} rows spread="left" changed />
      <SectionCard {live} at={3} fields={false} rows spread="left" />
    </Panel>
  </Variant>
  <Variant label="SectionCard" note="As built, with the settings, red with Ask over it">
    <SectionCard {live} at={2} fields={false} rows spread="left" />
    <SectionCard {live} at={1} />
    <SectionCard {live} at={1} fields={false} rows spread="left" red>
      {#snippet over()}<Ask question="Delete “Work”?" />{/snippet}
    </SectionCard>
  </Variant>
  <Variant label="Modal" note="ExplorerHead and .modal__box">
    <Modal
      title="Add block to Work"
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
