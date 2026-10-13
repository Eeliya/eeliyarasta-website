<!-- mock: "Add section" as a card: (a) dashed | (b) solid, like a section bar | (c) split; menus -->
<script>
  import AddSection from '../parts/AddSection.svelte';
</script>

<div style="display: grid; grid-template-columns: repeat(3, 384px); gap: 32px;">
  <AddSection variant="a" caption="(a) Dashed outline, + and Add section centred" />
  <AddSection variant="b" caption="(b) Solid, the section cards' background; + where their caret is" />
  <AddSection variant="c" caption="(c) Split: Add section adds an empty one; ▾ picks one with a block" />
  <AddSection variant="a" open caption="(a) open: the type menu (the Select list's look), the card's width" />
  <AddSection variant="b" open caption="(b) open" />
  <AddSection variant="c" open caption="(c) ▾ open: only the block types (empty is the main button)" />
</div>
