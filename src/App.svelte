<script>
  import { provideStoreon, useStoreon } from '@storeon/svelte'

  import Header from './header/Header.svelte'
  import Footer from './footer/Footer.svelte'
  import WorkSpace from './workspace/WorkSpace.svelte'
  import Modal from './components/modal/Modal.svelte'
  import Notifications from './components/notifications/Notifications.svelte'
  import InternetConnection from './utils/onlineCheck.js'
  import { store } from './store'
  import { isThemeToggleChecked } from './utils/helpers'

  provideStoreon(store)

  const { dispatch, app } = useStoreon('app')

  InternetConnection.notifyMainProcess()

  InternetConnection.onOnline(connected => {
    dispatch('internet/online')
  })

  InternetConnection.onOffline(connected => {
    dispatch('internet/offline')
  })

  if (InternetConnection.isOnline) dispatch('internet/online')

  dispatch('server/info')

  $: inverted = isThemeToggleChecked($app.theme)
</script>

<Modal>
  <main class="ui fluid container" class:bg-black={inverted}>
    <Header />
    <WorkSpace />
    <Footer />
  </main>
</Modal>

<Notifications />

<style>
  main {
    min-height: 100%;
  }
  .bg-black {
    background: black;
  }
</style>
