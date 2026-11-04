<script lang="ts">
  // "Click or press any key to start", over a Practice Tool's area while it isn't
  // focused. The area must be `position: relative`.
  import { text } from '../text';
</script>

<p class="start">{text.practice.start}</p>

<style>
  .start {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    padding: 1rem;
    font-weight: 600;
    text-align: center;
    cursor: text;
  }
</style>
