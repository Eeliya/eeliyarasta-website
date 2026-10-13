<!-- mock: the photo field and Photos list items, a | b | c side by side -->
<script>
  import ImageField from '../parts/ImageField.svelte';
</script>

<div style="display: flex; gap: 24px; align-items: flex-start;">
  <ImageField v="a" caption="A: as the source card: label inside, Choose / Change; list items add a grip and ✕" />
  <ImageField v="b" caption="B: the photo fills the card's height (64px), icon-only Media and ✕" />
  <ImageField v="c" caption="C: compact rows: grip, thumb, name / size, ✕, chevron; the row opens Media" />
</div>
