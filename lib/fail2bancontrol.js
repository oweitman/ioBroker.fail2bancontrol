'use strict';

const { ioUtil } = require('./ioUtil');

/**
 * class for fail2bancontrol server adapter
 */
class Fail2bancontrol {
    /**
     * @param {object} adapter - Adapter object
     */
    constructor(adapter) {
        this.adapter = adapter;
        this.ioUtil = new ioUtil(adapter);

        this.basePathServer = 'Server';
        this.basePathJails = 'Jails';

        this.data = {};
        this.knownJails = [];

        this.refreshOverview = 30;
        this.refreshJails = 60;
        this.refreshBanned = 60;
        this.requestTimeout = 10000;

        this.stateTemplate = {
            Overview: {
                name: 'Overview',
                read: true,
                write: false,
                type: 'string',
                role: 'json',
                def: '{}',
            },
            Version: {
                name: 'Version',
                read: true,
                write: false,
                type: 'string',
                role: 'text',
                def: '',
            },
            Loglevel: {
                name: 'Loglevel',
                read: true,
                write: true,
                type: 'string',
                role: 'text',
                def: '',
            },
            DbFile: {
                name: 'DbFile',
                read: true,
                write: false,
                type: 'string',
                role: 'text',
                def: '',
            },
            DbMaxmatches: {
                name: 'DbMaxmatches',
                read: true,
                write: true,
                type: 'number',
                role: 'level',
                def: 0,
            },
            DbPurgeage: {
                name: 'DbPurgeage',
                read: true,
                write: true,
                type: 'number',
                role: 'value.interval',
                def: 0,
            },
            JailsJson: {
                name: 'JailsJson',
                read: true,
                write: false,
                type: 'string',
                role: 'json',
                def: '[]',
            },
            Banned: {
                name: 'Banned',
                read: true,
                write: false,
                type: 'string',
                role: 'json',
                def: '{"ips":[],"count":0}',
            },
            UnbanAll: {
                name: 'UnbanAll',
                read: true,
                write: true,
                type: 'boolean',
                role: 'button',
                def: false,
            },
            Reload: {
                name: 'Reload',
                read: true,
                write: true,
                type: 'boolean',
                role: 'button',
                def: false,
            },
            Restart: {
                name: 'Restart',
                read: true,
                write: true,
                type: 'boolean',
                role: 'button',
                def: false,
            },
            Stop: {
                name: 'Stop',
                read: true,
                write: true,
                type: 'boolean',
                role: 'button',
                def: false,
            },
        };

        this.jailStateTemplate = {
            Raw: {
                name: 'Raw',
                read: true,
                write: false,
                type: 'string',
                role: 'json',
                def: '{}',
            },
            CurrentlyFailed: {
                name: 'CurrentlyFailed',
                read: true,
                write: false,
                type: 'number',
                role: 'value',
                def: 0,
            },
            TotalFailed: {
                name: 'TotalFailed',
                read: true,
                write: false,
                type: 'number',
                role: 'value',
                def: 0,
            },
            CurrentlyBanned: {
                name: 'CurrentlyBanned',
                read: true,
                write: false,
                type: 'number',
                role: 'value',
                def: 0,
            },
            TotalBanned: {
                name: 'TotalBanned',
                read: true,
                write: false,
                type: 'number',
                role: 'value',
                def: 0,
            },
            BannedIPList: {
                name: 'BannedIPList',
                read: true,
                write: false,
                type: 'string',
                role: 'json',
                def: '[]',
            },
            FileList: {
                name: 'FileList',
                read: true,
                write: false,
                type: 'string',
                role: 'json',
                def: '[]',
            },
            Maxlines: {
                name: 'Maxlines',
                read: true,
                write: true,
                type: 'number',
                role: 'value',
                def: 0,
            },
            Maxmatches: {
                name: 'Maxmatches',
                read: true,
                write: true,
                type: 'number',
                role: 'value',
                def: 0,
            },
            Maxretry: {
                name: 'Maxretry',
                read: true,
                write: true,
                type: 'number',
                role: 'value',
                def: 0,
            },
            Findtime: {
                name: 'Findtime',
                read: true,
                write: true,
                type: 'number',
                role: 'value.interval',
                def: 0,
            },
            Bantime: {
                name: 'Bantime',
                read: true,
                write: true,
                type: 'number',
                role: 'value.interval',
                def: 0,
            },
            Restart: {
                name: 'Restart',
                read: true,
                write: true,
                type: 'boolean',
                role: 'button',
                def: false,
            },
            Reload: {
                name: 'Reload',
                read: true,
                write: true,
                type: 'boolean',
                role: 'button',
                def: false,
            },
        };
    }

    /**
     * Initialize the adapter.
     *
     * This function is called by the ioBroker framework when the adapter is started.
     * It checks the configuration parameters, subscribes to the datapoints and
     * fetches the initial data.
     *
     * @returns {Promise<void>} - Resolves when the initialization is finished
     */
    async init() {
        try {
            this.checkConfigParameters();
            await this.checkDatapoints();
            await this.subscribeDatapoints();

            await this.getOverviewData();
            await this.getJailsData();
            await this.getBannedData();

            this.doOverview();
            this.doJails();
            this.doBanned();
        } catch /*( error )*/ {
            this.adapter.stop();
        }
    }

    /**
     * Closes all active connections by logging the action, deleting observers,
     * and setting the doClose flag to true.
     */
    close() {
        this.ioUtil.closeConnections();
    }

    /**
     * Checks the configuration parameters of the adapter.
     *
     * This function is called in the init() function of the adapter. It checks the
     * configuration parameters of the adapter and sets the class properties
     * accordingly.
     *
     * It checks the following parameters:
     * - refreshOverview: The interval in seconds for retrieving the overview data.
     * - refreshJails: The interval in seconds for retrieving the jails data.
     * - refreshBanned: The interval in seconds for retrieving the banned data.
     * - requestTimeout: The timeout in milliseconds for the requests to the fail2ban server.
     */
    checkConfigParameters() {
        this.refreshOverview = this.ioUtil.checkNumberRange(this.adapter.config.refreshOverview, 5, 86400, 30);
        this.refreshJails = this.ioUtil.checkNumberRange(this.adapter.config.refreshJails, 5, 86400, 60);
        this.refreshBanned = this.ioUtil.checkNumberRange(this.adapter.config.refreshBanned, 5, 86400, 60);
        this.requestTimeout = this.ioUtil.checkNumberRange(this.adapter.config.requestTimeout, 1000, 60000, 10000);
    }

    /**
     * Checks the datapoints of the adapter.
     *
     * This function is called in the init() function of the adapter. It creates the
     * datapoints of the adapter if they do not already exist.
     *
     * It checks the following datapoints:
     * - The server datapoint folder
     * - All states of the server datapoint folder
     * - The jail datapoint folder
     */
    async checkDatapoints() {
        this.ioUtil.logdebug('checkDatapoints');

        await this.ioUtil.createFolderNotExistsAsync(this.basePathServer, null, null);

        for (const key in this.stateTemplate) {
            const stateTemplate = this.stateTemplate[key];
            await this.ioUtil.createObjectNotExistsAsync(stateTemplate, this.basePathServer, '');

            if (typeof stateTemplate.def !== 'undefined') {
                const state = await this.ioUtil.getStateAsync(stateTemplate.name, this.basePathServer, '');
                if (!state) {
                    await this.ioUtil.setStateAsync(stateTemplate.name, stateTemplate.def, this.basePathServer, '');
                }
            }
        }

        await this.ioUtil.createFolderNotExistsAsync(this.basePathJails, null, null);
    }

    /**
     * Subscribes to all states of the adapter.
     *
     * This function subscribes to all states of the adapter and logs a debug message
     * when the subscription is successful.
     */
    async subscribeDatapoints() {
        this.ioUtil.logdebug('subscribeDatapoints');
        this.adapter.subscribeStates('*');
    }

    /**
     * Is called if a subscribed state changes
     *
     * @param {string} id - State ID
     * @param {ioBroker.State | null | undefined} state - State object
     */
    async stateChange(id, state) {
        this.ioUtil.logsilly(`stateChange ${id}`);

        if (!id || !state || state.ack) {
            return;
        }

        const parts = id.split('.');
        if (parts.length < 3) {
            return;
        }

        const statePath = parts.slice(2);

        try {
            if (statePath[0] === this.basePathServer && statePath.length >= 2) {
                const serverState = statePath[1];

                if (serverState === 'Loglevel') {
                    await this.setLoglevel(String(state.val));
                    return;
                }

                if (serverState === 'DbMaxmatches') {
                    await this.setDbMaxmatches(Number(state.val));
                    return;
                }

                if (serverState === 'DbPurgeage') {
                    await this.setDbPurgeage(Number(state.val));
                    return;
                }

                if (serverState === 'UnbanAll' && state.val === true) {
                    await this.unbanAll();
                    await this.ioUtil.setStateAsync('UnbanAll', false, this.basePathServer, '');
                    return;
                }

                if (serverState === 'Reload' && state.val === true) {
                    await this.serverReload();
                    await this.ioUtil.setStateAsync('Reload', false, this.basePathServer, '');
                    return;
                }

                if (serverState === 'Restart' && state.val === true) {
                    await this.serverRestart();
                    await this.ioUtil.setStateAsync('Restart', false, this.basePathServer, '');
                    return;
                }

                if (serverState === 'Stop' && state.val === true) {
                    await this.serverStop();
                    await this.ioUtil.setStateAsync('Stop', false, this.basePathServer, '');
                    return;
                }
            }

            if (statePath[0] === this.basePathJails && statePath.length >= 3) {
                const safeJail = statePath[1];
                const stateName = statePath[2];
                const realJail = this.getRealJailName(safeJail);

                if (!realJail) {
                    this.adapter.log.warn(`Unknown jail for state change: ${safeJail}`);
                    return;
                }

                await this.handleJailStateChange(realJail, safeJail, stateName, state.val);
            }
        } catch (error) {
            this.adapter.log.error(`stateChange error for ${id}: ${error.message}`);
        }
    }

    /**
     * Processes incoming messages.
     *
     * @param {object} msg - The incoming message object
     */
    processMessages(msg) {
        this.ioUtil.logdebug(`processMessages ${JSON.stringify(msg)}`);
        if (msg.command === 'fail2banapi') {
            this.fail2banApi(msg);
        }
    }

    /**
     * Processes incoming messages with the command 'fail2banapi'.
     *
     * If the message payload is an object, it extracts the method, endpoint and body
     * from the payload. It then calls the request function with the extracted values
     * and sends the response back to the sender with the given callback.
     *
     * @param {object} msg - The incoming message object
     */
    async fail2banApi(msg) {
        try {
            if (typeof msg.message === 'object') {
                const method = msg.message.method || 'GET';
                const endpoint = msg.message.endpoint || '/api/overview';
                const body = msg.message.body;
                const data = await this.request(method, endpoint, body);

                if (msg.callback) {
                    this.adapter.sendTo(msg.from, msg.command, data, msg.callback);
                }
            }
        } catch (error) {
            this.adapter.log.error(`fail2banApi error: ${error.message}`);
            if (msg.callback) {
                this.adapter.sendTo(msg.from, msg.command, { error: error.message }, msg.callback);
            }
        }
    }

    /**
     * Makes a request to the fail2ban API.
     *
     * @param {string} method - The HTTP method to use for the request, either 'GET', 'POST', 'PUT' or 'DELETE'
     * @param {string} endpoint - The fail2ban API endpoint to call, e.g. '/api/overview'
     * @param {object} body - The request body, either an object or undefined
     * @returns {Promise<object>} - A promise that resolves with the response data or rejects with an error
     */
    async request(method, endpoint, body = undefined) {
        const baseUrl = String(this.adapter.config.address || '').replace(/\/+$/, '');
        const url = `${baseUrl}${endpoint}`;

        const controller = new AbortController();
        const timeout = this.adapter.setTimeout(() => controller.abort(), this.requestTimeout);

        try {
            const headers = {
                Accept: 'application/json',
            };

            if (body !== undefined) {
                headers['Content-Type'] = 'application/json';
            }

            const options = {
                method,
                signal: controller.signal,
                headers,
            };

            if (body !== undefined) {
                options.body = JSON.stringify(body);
            }
            const response = await fetch(url, options);
            const text = await response.text();

            let data;
            try {
                data = text ? JSON.parse(text) : {};
            } catch {
                data = { raw: text };
            }

            if (!response.ok) {
                throw new Error(`${response.status} ${response.statusText}: ${JSON.stringify(data)}`);
            }

            await this.ioUtil.setStateAsync('info.connection', true, null, null);
            return data;
        } catch (error) {
            await this.ioUtil.setStateAsync('info.connection', false, null, null);
            throw error;
        } finally {
            this.adapter.clearTimeout(timeout);
        }
    }

    /**
     * Sanitizes an ID part by replacing all non-word characters (except for period and hyphen)
     * with an underscore and removing any leading or trailing underscores.
     *
     * @param {string} text - The text to sanitize
     * @returns {string} - The sanitized text
     */
    sanitizeIdPart(text) {
        return String(text || '')
            .replace(/[^\w.-]+/g, '_')
            .replace(/^_+|_+$/g, '');
    }

    /**
     * Finds the real jail name from the known jails that matches the given safe jail name.
     *
     * @param {string} safeJail - The safe jail name to search for
     * @returns {string|null} - The real jail name if found, otherwise null
     */
    getRealJailName(safeJail) {
        const found = this.knownJails.find(jail => this.sanitizeIdPart(jail) === safeJail);
        return found || null;
    }

    /**
     * Ensures that the given jail has all the required state objects.
     *
     * It first creates the jail folder if it does not exist, and then creates all the state objects
     * specified in the jailStateTemplate.
     *
     * @param {string} jail - The name of the jail to ensure
     * @returns {Promise<void>} - A promise that resolves when the state objects are created
     */
    async ensureJailObjects(jail) {
        const safeJail = this.sanitizeIdPart(jail);

        await this.ioUtil.createFolderNotExistsAsync(this.basePathJails, null, null);
        await this.ioUtil.createFolderNotExistsAsync(safeJail, this.basePathJails, null);

        for (const key in this.jailStateTemplate) {
            await this.ioUtil.createObjectNotExistsAsync(this.jailStateTemplate[key], this.basePathJails, safeJail);
        }
    }

    /**
     * Handles state changes of jail state objects.
     *
     * Handles the state changes of jail state objects and performs the corresponding actions.
     *
     * @param {string} jail - The name of the jail
     * @param {string} safeJail - The safe jail name
     * @param {string} stateName - The name of the state that changed
     * @param {*} value - The new value of the state
     * @returns {Promise<void>} - A promise that resolves when the action is performed
     */
    async handleJailStateChange(jail, safeJail, stateName, value) {
        switch (stateName) {
            case 'Restart':
                if (value === true) {
                    await this.request('POST', `/api/jail/${encodeURIComponent(jail)}/restart`, {});
                    await this.ioUtil.setStateAsync('Restart', false, this.basePathJails, safeJail);
                    await this.getJailData(jail);
                }
                break;

            case 'Reload':
                if (value === true) {
                    await this.request('POST', `/api/jail/${encodeURIComponent(jail)}/reload`, {});
                    await this.ioUtil.setStateAsync('Reload', false, this.basePathJails, safeJail);
                    await this.getJailData(jail);
                }
                break;

            case 'Bantime':
                await this.setJailSetting(jail, 'bantime', Number(value));
                break;

            case 'Findtime':
                await this.setJailSetting(jail, 'findtime', Number(value));
                break;

            case 'Maxretry':
                await this.setJailSetting(jail, 'maxretry', Number(value));
                break;

            case 'Maxmatches':
                await this.setJailSetting(jail, 'maxmatches', Number(value));
                break;

            case 'Maxlines':
                await this.setJailSetting(jail, 'maxlines', Number(value));
                break;
        }
    }

    /**
     * Sets a jail setting.
     *
     * Sets a jail setting by sending a POST request to the fail2ban API.
     * The request is sent to `/api/jail/${encodeURIComponent(jail)}/${setting}` with the value
     * set to `Number(value)`. After the request is sent, the jail data is updated by
     * calling `getJailData(jail)`.
     *
     * @param {string} jail - The name of the jail
     * @param {string} setting - The setting to set (e.g. "bantime", "findtime", etc.)
     * @param {*} value - The value to set the setting to
     * @returns {Promise<void>} - A promise that resolves when the request is sent and the jail data is updated
     */
    async setJailSetting(jail, setting, value) {
        await this.request('POST', `/api/jail/${encodeURIComponent(jail)}/${setting}`, { value: Number(value) });
        await this.getJailData(jail);
    }

    /**
     * Sets the log level of the fail2ban server.
     *
     * Sets the log level of the fail2ban server by sending a POST request to the fail2ban API.
     * The request is sent to `/api/loglevel` with the value set to `Number(level)`. After the request is sent,
     * the overview data is updated by calling `getOverviewData()`.
     *
     * @param {string} level - The log level to set (e.g. "INFO", "DEBUG", etc.)
     * @returns {Promise<void>} - A promise that resolves when the request is sent and the overview data is updated
     */
    async setLoglevel(level) {
        await this.request('POST', '/api/loglevel', { level });
        await this.getOverviewData();
    }

    /**
     * Sets the maximum number of matches for a single banned IP address.
     *
     * Sets the maximum number of matches for a single banned IP address by sending a POST request
     * to the fail2ban API. The request is sent to `/api/db/maxmatches` with the value set to
     * `Number(value)`. After the request is sent, the overview data is updated by calling
     * `getOverviewData()`.
     *
     * @param {number} value - The maximum number of matches for a single banned IP address
     * @returns {Promise<void>} - A promise that resolves when the request is sent and the overview data is updated
     */
    async setDbMaxmatches(value) {
        await this.request('POST', '/api/db/maxmatches', { value: Number(value) });
        await this.getOverviewData();
    }

    /**
     * Sets the purge age of the fail2ban database in seconds.
     *
     * Sets the purge age of the fail2ban database in seconds by sending a POST request
     * to the fail2ban API. The request is sent to `/api/db/purgeage` with the value set to
     * `Number(seconds)`. After the request is sent, the overview data is updated by calling
     * `getOverviewData()`.
     *
     * @param {number} seconds - The purge age of the fail2ban database in seconds
     * @returns {Promise<void>} - A promise that resolves when the request is sent and the overview data is updated
     */
    async setDbPurgeage(seconds) {
        await this.request('POST', '/api/db/purgeage', { seconds: Number(seconds) });
        await this.getOverviewData();
    }

    /**
     * Unbans all banned IP addresses.
     *
     * Unbans all banned IP addresses by sending a POST request to the fail2ban API.
     * The request is sent to `/api/unban/all`. After the request is sent, the banned data and jail data
     * are updated by calling `getBannedData()` and `getJailsData()`, respectively.
     *
     * @returns {Promise<void>} - A promise that resolves when the request is sent and the banned and jail data are updated
     */
    async unbanAll() {
        await this.request('POST', '/api/unban/all', {});
        await this.getBannedData();
        await this.getJailsData();
    }

    /**
     * Reloads the fail2ban server.
     *
     * Reloads the fail2ban server by sending a POST request to the fail2ban API.
     * The request is sent to `/api/server/reload`. After the request is sent, the overview data and jail data
     * are updated by calling `getOverviewData()` and `getJailsData()`, respectively.
     *
     * @returns {Promise<void>} - A promise that resolves when the request is sent and the overview and jail data are updated
     */
    async serverReload() {
        await this.request('POST', '/api/server/reload', {});
        await this.getOverviewData();
        await this.getJailsData();
    }

    /**
     * Restarts the fail2ban server.
     *
     * Restarts the fail2ban server by sending a POST request to the fail2ban API.
     * The request is sent to `/api/server/restart`. After the request is sent, the overview data and jail data
     * are updated by calling `getOverviewData()` and `getJailsData()`, respectively.
     *
     * @returns {Promise<void>} - A promise that resolves when the request is sent and the overview and jail data are updated
     */
    async serverRestart() {
        await this.request('POST', '/api/server/restart', {});
        await this.getOverviewData();
        await this.getJailsData();
    }

    /**
     * Stops the fail2ban server.
     *
     * Stops the fail2ban server by sending a POST request to the fail2ban API.
     * The request is sent to `/api/server/stop`. After the request is sent, the overview data is updated by calling `getOverviewData()`.
     *
     * @returns {Promise<void>} - A promise that resolves when the request is sent and the overview data is updated
     */
    async serverStop() {
        await this.request('POST', '/api/server/stop', {});
        await this.getOverviewData();
    }

    /**
     * Retrieves the overview data and updates the state of the adapter.
     *
     * Calls `getOverviewData()` to retrieve the overview data and updates the state of the adapter.
     * If an error occurs while retrieving the data, it logs the error and continues without throwing an exception.
     * If the adapter is not being closed, it sets a timeout to call itself again after `refreshOverview * 1000` milliseconds.
     *
     * @returns {Promise<void>} - A promise that resolves when the overview data is retrieved and the state of the adapter is updated
     */
    async doOverview() {
        this.ioUtil.logdebug('doOverview');

        try {
            await this.getOverviewData();
        } catch (error) {
            this.adapter.log.error(`doOverview: ${error.message}`);
        }

        if (!this.ioUtil.doClose) {
            await this.ioUtil.delay(this.refreshOverview * 1000);
            this.doOverview();
        }
    }

    /**
     * Retrieves the jail data and updates the state of the adapter.
     *
     * Calls `getJailsData()` to retrieve the jail data and updates the state of the adapter.
     * If an error occurs while retrieving the data, it logs the error and continues without throwing an exception.
     * If the adapter is not being closed, it sets a timeout to call itself again after `refreshJails * 1000` milliseconds.
     *
     * @returns {Promise<void>} - A promise that resolves when the jail data is retrieved and the state of the adapter is updated
     */
    async doJails() {
        this.ioUtil.logdebug('doJails');

        try {
            await this.getJailsData();
        } catch (error) {
            this.adapter.log.error(`doJails: ${error.message}`);
        }

        if (!this.ioUtil.doClose) {
            await this.ioUtil.delay(this.refreshJails * 1000);
            this.doJails();
        }
    }

    /**
     * Retrieves the banned data and updates the state of the adapter.
     *
     * Calls `getBannedData()` to retrieve the banned data and updates the state of the adapter.
     * If an error occurs while retrieving the data, it logs the error and continues without throwing an exception.
     * If the adapter is not being closed, it sets a timeout to call itself again after `refreshBanned * 1000` milliseconds.
     *
     * @returns {Promise<void>} - A promise that resolves when the banned data is retrieved and the state of the adapter is updated
     */
    async doBanned() {
        this.ioUtil.logdebug('doBanned');

        try {
            await this.getBannedData();
        } catch (error) {
            this.adapter.log.error(`doBanned: ${error.message}`);
        }

        if (!this.ioUtil.doClose) {
            await this.ioUtil.delay(this.refreshBanned * 1000);
            this.doBanned();
        }
    }

    /**
     * Extracts the second line from a string if it exists, otherwise returns the first line.
     * If the string is null or undefined, it returns an empty string.
     * The lines are split by the newline character, trimmed, and filtered to remove empty lines.
     *
     * @param {string | null | undefined} value - The string to extract the line from
     * @returns {string} - The extracted line
     */
    extractValueLine(value) {
        if (value === undefined || value === null) {
            return '';
        }

        const lines = String(value)
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean);

        if (lines.length >= 2) {
            return lines[1];
        }

        return lines[0] || '';
    }

    /**
     * Retrieves the overview data, version, log level, database file, maximum number of matches for a single banned IP address,
     * and the purge age of the database from the fail2ban API, and updates the state of the adapter.
     *
     * Calls `request()` to retrieve the overview data, version, log level, database file, maximum number of matches for a single banned IP address,
     * and the purge age of the database from the fail2ban API. If an error occurs while retrieving the data, it logs the error and continues without throwing an exception.
     * After the data is retrieved, it updates the state of the adapter by calling `ioUtil.setStateAsync()` with the retrieved data.
     *
     * @returns {Promise<void>} - A promise that resolves when the overview data is retrieved and the state of the adapter is updated
     */
    async getOverviewData() {
        this.ioUtil.logdebug('getOverviewData');
        try {
            const overview = await this.request('GET', '/api/overview');
            const version = await this.request('GET', '/api/version');
            const loglevel = await this.request('GET', '/api/loglevel');
            const dbfile = await this.request('GET', '/api/db/file');
            const dbmaxmatches = await this.request('GET', '/api/db/maxmatches');
            const dbpurgeage = await this.request('GET', '/api/db/purgeage');
            const jails = await this.request('GET', '/api/jails');

            this.knownJails = Array.isArray(jails) ? jails : [];

            await this.ioUtil.setStateAsync('Overview', JSON.stringify(overview), this.basePathServer, '');
            await this.ioUtil.setStateAsync('Version', version.version || '', this.basePathServer, '');
            await this.ioUtil.setStateAsync(
                'Loglevel',
                this.extractValueLine(loglevel.loglevel),
                this.basePathServer,
                '',
            );
            await this.ioUtil.setStateAsync('DbFile', this.extractValueLine(dbfile.dbfile), this.basePathServer, '');
            await this.ioUtil.setStateAsync(
                'DbMaxmatches',
                Number(this.extractValueLine(dbmaxmatches.dbmaxmatches) || 0),
                this.basePathServer,
                '',
            );
            await this.ioUtil.setStateAsync(
                'DbPurgeage',
                Number(this.extractValueLine(dbpurgeage.dbpurgeage) || 0),
                this.basePathServer,
                '',
            );
            await this.ioUtil.setStateAsync('JailsJson', JSON.stringify(jails), this.basePathServer, '');

            this.data.Overview = overview;
            this.data.Jails = jails;
        } catch (error) {
            this.ioUtil.logerror(error.message);
            throw error;
        }
    }

    /**
     * Retrieves the banned data from the fail2ban API, and updates the state of the adapter.
     *
     * Calls `request()` to retrieve the banned data from the fail2ban API. If an error occurs while retrieving the data, it logs the error and continues without throwing an exception.
     * After the data is retrieved, it updates the state of the adapter by calling `ioUtil.setStateAsync()` with the retrieved data.
     *
     * @returns {Promise<void>} - A promise that resolves when the banned data is retrieved and the state of the adapter is updated
     */
    async getBannedData() {
        this.ioUtil.logdebug('getBannedData');
        const banned = await this.request('GET', '/api/banned');
        await this.ioUtil.setStateAsync('Banned', JSON.stringify(banned), this.basePathServer, '');
        this.data.Banned = banned;
    }

    /**
     * Removes jail objects that are no longer present in the fail2ban API.
     *
     * It first gets the list of current jail objects from the fail2ban API, sanitizes their IDs,
     * and gets the list of existing jail objects in the adapter. It then creates a set of jail objects
     * that need to be deleted by comparing the existing jail objects with the current jail objects.
     * Finally, it deletes the jail objects in the set by calling `ioUtil.deleteObjectAsync()`.
     *
     * @param {string[]} currentJails - The list of current jail objects from the fail2ban API
     * @returns {Promise<void>} - A promise that resolves when the jail objects are removed
     */
    async removeMissingJails(currentJails) {
        const currentSafe = currentJails.map(jail => this.sanitizeIdPart(jail));
        const objects = await this.ioUtil.getObjects(this.basePathJails);

        const toDelete = new Set();

        for (const id in objects) {
            const rel = id.replace(`${this.adapter.namespace}.`, '');
            const parts = rel.split('.');

            if (parts.length >= 2 && parts[0] === this.basePathJails) {
                const safeJail = parts[1];
                if (!currentSafe.includes(safeJail)) {
                    toDelete.add(safeJail);
                }
            }
        }

        for (const safeJail of toDelete) {
            await this.ioUtil.deleteObjectAsync(safeJail, this.basePathJails, null);
        }
    }

    /**
     * Retrieves the list of jail objects from the fail2ban API, updates the state of the adapter,
     * and ensures that all jail objects have the required state objects.
     *
     * It first gets the list of jail objects from the fail2ban API, sanitizes their IDs,
     * and updates the state of the adapter by calling `ioUtil.setStateAsync()` with the retrieved data.
     * Then, it removes any jail objects that are no longer present in the fail2ban API by calling `removeMissingJails()`.
     * Finally, it ensures that all jail objects have the required state objects by calling `ensureJailObjects()` and `getJailData()`
     * for each jail object.
     *
     * @returns {Promise<void>} - A promise that resolves when the jail data is retrieved and the state of the adapter is updated
     */
    async getJailsData() {
        this.ioUtil.logdebug('getJailsData');

        const jails = await this.request('GET', '/api/jails');
        const jailList = Array.isArray(jails) ? jails : [];

        this.knownJails = jailList;

        await this.ioUtil.setStateAsync('JailsJson', JSON.stringify(jailList), this.basePathServer, '');
        await this.removeMissingJails(jailList);

        for (const jail of jailList) {
            await this.ensureJailObjects(jail);
            await this.getJailData(jail);
        }
    }

    /**
     * Retrieves the jail data and updates the state of the adapter.
     *
     * It first sanitizes the jail name by calling `sanitizeIdPart()`, and then calls `request()` to retrieve the jail data from the fail2ban API.
     * After the data is retrieved, it updates the state of the adapter by calling `ioUtil.setStateAsync()` with the retrieved data.
     * It sets the state of the jail objects with the retrieved data, such as the currently failed, total failed, currently banned, total banned, banned IP list, file list, maximum number of matches for a single banned IP address, maximum number of retries for a single banned IP address,
     * maximum number of lines to watch for log entries, maximum number of log entries to watch for a single banned IP address, find time, and ban time.
     *
     * @param {string} jail - The name of the jail to retrieve the data for
     * @returns {Promise<void>} - A promise that resolves when the jail data is retrieved and the state of the adapter is updated
     */
    async getJailData(jail) {
        const safeJail = this.sanitizeIdPart(jail);
        const data = await this.request('GET', `/api/jail/${encodeURIComponent(jail)}/status`);

        await this.ensureJailObjects(jail);

        await this.ioUtil.setStateAsync('Raw', JSON.stringify(data), this.basePathJails, safeJail);
        await this.ioUtil.setStateAsync(
            'CurrentlyFailed',
            Number(data?.filter?.currentlyFailed || 0),
            this.basePathJails,
            safeJail,
        );
        await this.ioUtil.setStateAsync(
            'TotalFailed',
            Number(data?.filter?.totalFailed || 0),
            this.basePathJails,
            safeJail,
        );
        await this.ioUtil.setStateAsync(
            'CurrentlyBanned',
            Number(data?.actions?.currentlyBanned || 0),
            this.basePathJails,
            safeJail,
        );
        await this.ioUtil.setStateAsync(
            'TotalBanned',
            Number(data?.actions?.totalBanned || 0),
            this.basePathJails,
            safeJail,
        );
        await this.ioUtil.setStateAsync(
            'BannedIPList',
            JSON.stringify(data?.actions?.bannedIPList || []),
            this.basePathJails,
            safeJail,
        );
        await this.ioUtil.setStateAsync(
            'FileList',
            JSON.stringify(data?.filter?.fileList || []),
            this.basePathJails,
            safeJail,
        );

        await this.ioUtil.setStateAsync('Maxlines', Number(data?.extra?.maxlines || 0), this.basePathJails, safeJail);
        await this.ioUtil.setStateAsync(
            'Maxmatches',
            Number(data?.extra?.maxmatches || 0),
            this.basePathJails,
            safeJail,
        );
        await this.ioUtil.setStateAsync('Maxretry', Number(data?.extra?.maxretry || 0), this.basePathJails, safeJail);
        await this.ioUtil.setStateAsync('Findtime', Number(data?.extra?.findtime || 0), this.basePathJails, safeJail);
        await this.ioUtil.setStateAsync('Bantime', Number(data?.extra?.bantime || 0), this.basePathJails, safeJail);

        await this.ioUtil.setStateAsync('Maxlines', Number(data?.extra?.maxlines || 0), this.basePathJails, safeJail);
        await this.ioUtil.setStateAsync(
            'Maxmatches',
            Number(data?.extra?.maxmatches || 0),
            this.basePathJails,
            safeJail,
        );
        await this.ioUtil.setStateAsync('Maxretry', Number(data?.extra?.maxretry || 0), this.basePathJails, safeJail);
        await this.ioUtil.setStateAsync('Findtime', Number(data?.extra?.findtime || 0), this.basePathJails, safeJail);
        await this.ioUtil.setStateAsync('Bantime', Number(data?.extra?.bantime || 0), this.basePathJails, safeJail);
    }
}

module.exports = Fail2bancontrol;
