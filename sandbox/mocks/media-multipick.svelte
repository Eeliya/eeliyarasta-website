<!-- mock: Media picking several photos for a photo list: 0 picked | 3 picked (badges 1–3) -->
<script>
  import MediaMulti from '../parts/MediaMulti.svelte';
</script>

<div style="display: flex; flex-direction: column; gap: 32px;">
  <MediaMulti picked={[]} caption="Opened from Add photo: nothing picked yet, Add disabled" />
  <MediaMulti picked={[6, 1, 13]} caption="3 picked, numbered in pick order; Add 3 photos adds them in that order. (A single photo field keeps one click + Use this photo.)" />
</div>
