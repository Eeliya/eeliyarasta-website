<!-- mock: a section's delete confirmation, no layout shift -->
<script>
  import DeleteSection from '../parts/DeleteSection.svelte';
</script>

<div style="display: grid; grid-template-columns: repeat(4, 384px); gap: 24px 32px;">
  <DeleteSection
    v="now"
    caption="Now (no confirm open): the trash asks in a row inside the card, pushing it down"
  />
  <DeleteSection v="a" caption="A: the tools give way to a red DELETE? pill and ✕, same 24px row" />
  <DeleteSection v="a" closed caption="A on a closed card: the same row, nothing moves" />
  <DeleteSection v="b" caption="B: a popover under the trash: the message, small Cancel / Delete" />
  <DeleteSection
    v="c"
    caption="C: the bar turns solid red: 'Delete Section 6?' and ✓ / ✕, no height change"
  />
  <DeleteSection v="c" closed caption="C on a closed card" />
  <DeleteSection
    v="d"
    caption="D: deleted at once; a toast over the panel's foot: 'Section 6 deleted · Undo'"
  />
  <DeleteSection
    v="e"
    caption="E: arm: the trash turns solid red ('Again' in the switch's place); a second click deletes, anything else disarms"
  />
</div>
