<script>
  import pkg from '../../package.json'
</script>

<style>
  footer {
    position: fixed !important;
    bottom: 0;
    border-radius: 0 !important;
    width: 100%;
    z-index: 10;
  }
</style>

<footer class="ui segment">
  <div class="ui grid">
    <div class="eight wide column">
      <p>
        Made with 🖤 by
        <a href="https://github.com/antonkorotkov" target="_blank">
          @antonkorotkov
        </a>
      </p>
    </div>
    <div class="eight wide column right aligned">Version {pkg.version}</div>
  </div>
</footer>
