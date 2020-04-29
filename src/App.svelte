<script>
  import { provideStoreon, useStoreon } from '@storeon/svelte'

  import Header from './header/Header.svelte'
  import Footer from './footer/Footer.svelte'
  import WorkSpace from './workspace/WorkSpace.svelte'
  import Modal from './components/modal/Modal.svelte'
  import Notifications from './components/notifications/Notifications.svelte'
  import InternetConnection from './utils/onlineCheck.js'
  import { store } from './store'

  provideStoreon(store)

  const { dispatch } = useStoreon()

  InternetConnection.notifyMainProcess()

  InternetConnection.onOnline(connected => {
    dispatch('internet/online')
  })

  InternetConnection.onOffline(connected => {
    dispatch('internet/offline')
  })

  if (InternetConnection.isOnline) dispatch('internet/online')
</script>

<Modal>
  <main class="ui fluid container inverted">
    <Header />
    <WorkSpace />
    <Footer />
  </main>
</Modal>

<Notifications />
