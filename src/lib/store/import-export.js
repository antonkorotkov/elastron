import get from 'lodash/get'
import { randomId } from '../utils/helpers'

export const importExport = store => {
    store.on('@init', () => {
        // IPC listeners removed.
        // Logs and errors will be handled during the API request lifecycle in ie/run
        return {
            importExport: {
                input: {
                    type: 'file',
                    file: '', // Now can hold File object or name
                    fileObject: null, // New field to hold actual File
                    index: null,
                    connection: null,
                    remoteIndices: [],
                    address: '',
                },
                output: {
                    type: 'index',
                    file: '', // Now can hold name
                    fileHandle: null, // New field to hold FileSystemFileHandle
                    index: null,
                    connection: null,
                    remoteIndices: [],
                    address: '',
                },
                options: [
                    {
                        name: 'limit',
                        value: '100',
                    },
                ],
                type: 'data',
                isRunning: false,
                logs: [],
                logFilter: ['info', 'error'],
                logsPerPage: 100,
                logsShowPages: 1,
            },
        }
    })

    store.on('@changed', (__, payload, store) => {
        if (
            get(payload, 'history.connection', false) ||
            get(payload, 'connection', false)
        ) {
            store.dispatch('ie/input/reset', null)
            store.dispatch('ie/output/reset', null)
        }
    })

    store.on('ie/logsPerPage', (state, logsPerPage) => ({
        importExport: {
            ...state.importExport,
            logsPerPage,
            logsShowPages: 1,
        },
    }))

    store.on('ie/logsShowMore', state => ({
        importExport: {
            ...state.importExport,
            logsShowPages: state.importExport.logsShowPages + 1,
        },
    }))

    store.on('ie/logFilter/on', (state, filter) => ({
        importExport: {
            ...state.importExport,
            logFilter: Array.from(new Set([...state.importExport.logFilter, filter])),
            logsShowPages: 1,
        },
    }))

    store.on('ie/logFilter/off', (state, filter) => {
        if (state.importExport.logFilter.length === 1)
            return {
                importExport: {
                    ...state.importExport,
                },
            }

        const logFilter = state.importExport.logFilter.filter(
            item => item !== filter
        )

        return {
            importExport: {
                ...state.importExport,
                logFilter,
                logsShowPages: 1,
            },
        }
    })

    store.on('ie/log', (state, log) => {
        let logs = [...state.importExport.logs, { ...log, id: randomId() }]

        return {
            importExport: {
                ...state.importExport,
                logs,
            },
        }
    })

    store.on('ie/log/clear', state => {
        return {
            importExport: {
                ...state.importExport,
                logs: [],
                logsShowPages: 1,
            },
        }
    })

    store.on('ie/type', (state, type) => ({
        importExport: {
            ...state.importExport,
            type,
        },
    }))

    store.on('ie/input/reset', state => ({
        importExport: {
            ...state.importExport,
            input: {
                ...state.importExport.input,
                file: '',
                index: null,
                connection: null,
                remoteIndices: [],
                address: '',
            },
        },
    }))

    store.on('ie/output/reset', state => ({
        importExport: {
            ...state.importExport,
            output: {
                ...state.importExport.output,
                file: '',
                index: null,
                connection: null,
                remoteIndices: [],
                address: '',
            },
        },
    }))

    store.on('ie/input/address', (state, address) => ({
        importExport: {
            ...state.importExport,
            input: {
                ...state.importExport.input,
                address,
            },
        },
    }))

    store.on('ie/output/address', (state, address) => ({
        importExport: {
            ...state.importExport,
            output: {
                ...state.importExport.output,
                address,
            },
        },
    }))

    store.on('ie/input/remoteIndices', (state, remoteIndices) => ({
        importExport: {
            ...state.importExport,
            input: {
                ...state.importExport.input,
                remoteIndices,
            },
        },
    }))

    store.on('ie/output/remoteIndices', (state, remoteIndices) => ({
        importExport: {
            ...state.importExport,
            output: {
                ...state.importExport.output,
                remoteIndices,
            },
        },
    }))

    store.on('ie/input/connection', (state, connection) => ({
        importExport: {
            ...state.importExport,
            input: {
                ...state.importExport.input,
                connection,
            },
        },
    }))

    store.on('ie/output/connection', (state, connection) => ({
        importExport: {
            ...state.importExport,
            output: {
                ...state.importExport.output,
                connection,
            },
        },
    }))

    store.on('ie/delete/option', (state, index) => {
        let options = [...state.importExport.options]
        options.splice(index, 1)

        return {
            importExport: {
                ...state.importExport,
                options,
            },
        }
    })

    store.on('ie/update/option', (state, { index, field, value }) => {
        let options = [...state.importExport.options]
        options[index][field] = value

        return {
            importExport: {
                ...state.importExport,
                options,
            },
        }
    })

    store.on('ie/add/option', state => {
        let options = [...state.importExport.options]
        options.push({
            name: '',
            value: '',
        })

        return {
            importExport: {
                ...state.importExport,
                options,
            },
        }
    })

    store.on('ie/input/type', (state, type) => ({
        importExport: {
            ...state.importExport,
            input: {
                ...state.importExport.input,
                type,
            },
        },
    }))

    store.on('ie/input/file', (state, file) => ({
        importExport: {
            ...state.importExport,
            input: {
                ...state.importExport.input,
                file,
            },
        },
    }))

    store.on('ie/input/index', (state, index) => ({
        importExport: {
            ...state.importExport,
            input: {
                ...state.importExport.input,
                index,
            },
        },
    }))

    store.on('ie/output/type', (state, type) => ({
        importExport: {
            ...state.importExport,
            output: {
                ...state.importExport.output,
                type,
            },
        },
    }))

    store.on('ie/output/file', (state, file) => ({
        importExport: {
            ...state.importExport,
            output: {
                ...state.importExport.output,
                file,
            },
        },
    }))

    store.on('ie/output/index', (state, index) => ({
        importExport: {
            ...state.importExport,
            output: {
                ...state.importExport.output,
                index,
            },
        },
    }))

    store.on('ie/input/fileObject', (state, fileObject) => ({
        importExport: {
            ...state.importExport,
            input: {
                ...state.importExport.input,
                fileObject,
            },
        },
    }))

    store.on('ie/output/fileHandle', (state, fileHandle) => ({
        importExport: {
            ...state.importExport,
            output: {
                ...state.importExport.output,
                fileHandle,
            },
        },
    }))

    store.on('ie/run', async (state, options) => {
        store.dispatch('ie/isRunning', true);

        try {
            const isImport = state.importExport.input.type === 'file';
            const isExport = state.importExport.output.type === 'file';

            let response;

            if (isImport) {
                const file = state.importExport.input.fileObject;
                if (!file) throw new Error("No input file selected");

                response = await fetch('/api/dumper', {
                    method: 'POST',
                    headers: {
                        'x-dumper-type': 'import',
                        'x-dumper-options': JSON.stringify(options)
                    },
                    body: file // Streams the file
                });

                const result = await response.json();
                if (!response.ok || result.error) throw new Error(result.error || 'Import failed');

                store.dispatch('ie/log', { type: 'success', message: 'Import completed successfully' });

            } else if (isExport) {
                const handle = state.importExport.output.fileHandle;
                if (!handle) throw new Error("No output file selected");

                // Check permissions
                // await handle.requestPermission({ mode: 'readwrite' });

                response = await fetch('/api/dumper', {
                    method: 'POST',
                    headers: {
                        'x-dumper-type': 'export',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ options })
                });

                if (!response.ok) {
                    const result = await response.json();
                    throw new Error(result.error || 'Export failed');
                }

                // Stream to file
                const writable = await handle.createWritable();
                await response.body.pipeTo(writable);

                store.dispatch('ie/log', { type: 'success', message: 'Export completed successfully' });
            } else {
                // If neither (e.g. index to index sync), user might expect simple fetch
                // But current /api/dumper logic supports index/remote-index via options?
                // Step 135 handled import/export specifically.
                // If index-to-index is needed, /api/dumper needs update or we pass options and server handles it.
                // Assuming 'elasticdump' library handles it if inputs/outputs are URLs.
                // But providing URLs to 'elasticdump' on server requires server connectivity.
                throw new Error("Direct Index-to-Index copy not implemented in streaming migration yet.");
            }

        } catch (e) {
            store.dispatch('ie/log', { type: 'error', message: e.message });
        } finally {
            store.dispatch('ie/finish');
        }

        return {
            importExport: {
                ...state.importExport,
                isRunning: true,
                logs: [],
                logsShowPages: 1,
            },
        }
    })

    store.on('ie/isRunning', (state, isRunning) => ({
        importExport: { ...state.importExport, isRunning }
    }));

    store.on('ie/finish', state => {
        return {
            importExport: {
                ...state.importExport,
                isRunning: false,
            },
        }
    })
}
