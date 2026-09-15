/**
 * Opens the Settings dialog through the modal-window context, optionally on
 * a given section. Loaded lazily, like the connection dialog.
 */
export const openSettingsDialog = async (open, initialSection) => {
	const { default: SettingsDialog } = await import('./SettingsDialog.svelte')
	open(SettingsDialog, { initialSection })
}
