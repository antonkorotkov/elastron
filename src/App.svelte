<script>
  import { provideStoreon } from '@storeon/svelte'

  import Header from './header/Header.svelte'
  import Footer from './footer/Footer.svelte'
  import WorkSpace from './workspace/WorkSpace.svelte'
  import Modal from './components/modal/Modal.svelte'
  import Notifications from './components/notifications/Notifications.svelte'

  import { store } from './store'

  provideStoreon(store)
</script>

<Modal>
  <main class="ui fluid container inverted">
    <Header />
    <WorkSpace />
    <Footer />
  </main>
</Modal>

<Notifications />
