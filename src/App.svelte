<script>
	import Header from './header/Header.svelte'
	import Footer from './footer/Footer.svelte'
	import WorkSpace from './workspace/WorkSpace.svelte'
	import Modal from './components/modal/Modal.svelte'
</script>

<Modal>
	<main class="ui fluid container inverted">
		<Header />
		<WorkSpace />
		<Footer />
	</main>
</Modal>