# ioBroker.fail2bancontrol

![Logo](admin/fail2bancontrol.png)

[![NPM version](https://img.shields.io/npm/v/iobroker.fail2bancontrol.svg)](https://www.npmjs.com/package/iobroker.fail2bancontrol)
[![Downloads](https://img.shields.io/npm/dm/iobroker.fail2bancontrol.svg)](https://www.npmjs.com/package/iobroker.fail2bancontrol)
![Number of Installations](https://iobroker.live/badges/fail2bancontrol-installed.svg)
![Current version in stable repository](https://iobroker.live/badges/fail2bancontrol-stable.svg)

[![NPM](https://nodei.co/npm/iobroker.fail2bancontrol.png?downloads=true)](https://nodei.co/npm/iobroker.fail2bancontrol/)

**Tests:** ![Test and Release](https://github.com/oweitman/ioBroker.fail2bancontrol/workflows/Test%20and%20Release/badge.svg)

## fail2bancontrol adapter for ioBroker

Control and monitor a **fail2ban server** via the **fail2ban-control API**.

The adapter allows you to:

- monitor fail2ban server status
- display and monitor all configured jails
- view banned IP addresses
- change jail parameters
- execute server actions

The adapter polls the fail2ban-control API at configurable intervals.

Help, hints and pull requests are welcome.

## Requirements

The adapter requires a running **fail2ban-control API server**.

Example:

```text
http://<server>:9191
```

The adapter communicates with the API via HTTP.

Details about installation and APIs see
<https://github.com/oweitman/fail2bancontrol>

## Steps

1. Install the adapter

2. Configure the adapter in the admin interface

Required parameters:

| Parameter       | Description                          |
| --------------- | ------------------------------------ |
| address         | URL of the fail2ban-control API      |
| refreshOverview | refresh interval for server overview |
| refreshJails    | refresh interval for jail status     |
| refreshBanned   | refresh interval for banned IPs      |
| requestTimeout  | timeout for API requests             |

## Functions

## Server Information

The adapter provides several datapoints under

```text
fail2bancontrol.0.Server
```

Examples:

```text
Overview
Version
Loglevel
DbFile
DbMaxmatches
DbPurgeage
JailsJson
Banned
```

These datapoints reflect the information retrieved from the API.

## Server Actions

The following server actions can be triggered:

```text
Server.Restart
Server.Reload
Server.Stop
Server.UnbanAll
```

Setting the datapoint to **true** executes the action.

## Jail Monitoring

All jails are detected automatically.

Structure:

```text
fail2bancontrol.0.Jails.<jailname>
```

Example datapoints:

```text
CurrentlyFailed
TotalFailed
CurrentlyBanned
TotalBanned
BannedIPList
FileList
```

## Jail Configuration

Several jail parameters can be modified via datapoints.

Example:

```text
Maxretry
Findtime
Bantime
Maxmatches
Maxlines
```

Changing these datapoints sends a configuration update to the API.

## Jail Actions

Each jail supports the following commands:

```text
Restart
Reload
```

## sendTo Function

The adapter supports a generic **sendTo API function**.

This allows direct API interaction from scripts.

### Example

```javascript
sendTo(
    'fail2bancontrol.0',
    'api',
    {
        method: 'GET',
        endpoint: '/api/jails',
    },
    function (data) {
        console.log(data);
    },
);
```

Example with parameters:

```javascript
sendTo(
    'fail2bancontrol.0',
    'api',
    {
        method: 'POST',
        endpoint: '/api/jail/sshd/restart',
    },
    function (data) {
        console.log(data);
    },
);
```

## Troubleshooting

### Adapter does not connect

Check:

- API address
- API server running
- firewall rules

Test API manually:

```text
http://<server>:9191/api/overview
```

### No jails detected

Possible reasons:

- fail2ban-control API not configured correctly
- fail2ban not running
- API endpoint `/api/jails` returns empty list

## Todo Existing Functions

- improve error handling
- connection test button
- additional server statistics

## Todo New Functions

- event based updates
- additional visualization templates
- extended jail statistics

## Not Implemented / Planned Functions

- direct SSH access to fail2ban
- automatic jail creation

## Changelog

<!--
Placeholder for next version
-->

## **WORK IN PROGRESS**

- initial adapter implementation
- polling architecture
- dynamic jail detection
- jail parameter control

## License

MIT License

Copyright (c) 2026
oweitman

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
